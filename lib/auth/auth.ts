import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware, getSessionFromCtx, isAPIError } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import prisma from '@/lib/db';
import { recordAuditEvent, type AuditAction } from './audit';
import { loadAuthEnv, parseTrustedProxies } from './env';
import {
  ENROLLMENT_WINDOW_SECONDS,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  SESSION_UPDATE_AGE_SECONDS,
  isAllowedAuthRequest,
} from './policy';

const INVALID_CREDENTIALS = { message: 'Invalid email or password', code: 'INVALID_EMAIL_OR_PASSWORD' } as const;

async function isSignInEligible(userId: string): Promise<boolean> {
  const user = await prisma.authUser.findUnique({
    where: { id: userId },
    select: { disabled: true, _count: { select: { roleAssignments: true } } },
  });
  return Boolean(user && !user.disabled && user._count.roleAssignments > 0);
}

function createAuth() {
  const env = loadAuthEnv();
  const production = process.env.NODE_ENV === 'production';

  return betterAuth({
    appName: 'Helper Manager',
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: 'postgresql' }),

    // Only email + password (followed by mandatory TOTP). No public sign-up.
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      autoSignIn: false,
      requireEmailVerification: false,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
    },
    account: { modelName: 'authAccount', accountLinking: { enabled: false } },
    verification: { modelName: 'authVerification' },

    user: {
      modelName: 'authUser',
      additionalFields: {
        disabled: { type: 'boolean', required: false, defaultValue: false, input: false },
      },
    },

    // DB-backed, revocable, absolute 8h sessions. No sliding renewal and no
    // cookie cache, so revocation and disablement apply on the next request.
    session: {
      modelName: 'authSession',
      expiresIn: SESSION_ABSOLUTE_LIFETIME_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
      additionalFields: {
        mfaVerified: { type: 'boolean', required: false, defaultValue: false, input: false },
      },
    },

    plugins: [
      twoFactor({
        issuer: 'Helper Manager',
        schema: { twoFactor: { modelName: 'authTwoFactor' } },
        skipVerificationOnEnable: false,
        allowPasswordless: false,
        // Zero codes are generated: self-service backup-code recovery is not approved.
        backupCodeOptions: { amount: 0 },
        totpOptions: { digits: 6, period: 30 },
      }),
    ],

    rateLimit: {
      enabled: true,
      window: 60,
      max: 30,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/two-factor/enable': { window: 60, max: 5 },
      },
    },

    advanced: {
      ipAddress: { trustedProxies: parseTrustedProxies() },
      useSecureCookies: production,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
    },

    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            if (!(await isSignInEligible(session.userId))) return false;
            const user = await prisma.authUser.findUnique({
              where: { id: session.userId },
              select: { twoFactorEnabled: true },
            });
            const mfaVerified = user?.twoFactorEnabled === true;
            return {
              data: {
                ...session,
                mfaVerified,
                // Password-only sessions can only complete enrollment, briefly.
                expiresAt: mfaVerified
                  ? new Date(Date.now() + SESSION_ABSOLUTE_LIFETIME_SECONDS * 1000)
                  : new Date(Date.now() + ENROLLMENT_WINDOW_SECONDS * 1000),
                ipAddress: null,
                userAgent: null,
              },
            };
          },
          after: async (session) => {
            try {
              await recordAuditEvent({
                actorId: session.userId,
                action: 'SESSION_STARTED',
                targetType: 'account',
                targetId: session.userId,
              });
            } catch (error) {
              // Fail closed: no session may exist without its audit event.
              await prisma.authSession.deleteMany({ where: { id: session.id } });
              throw error;
            }
          },
        },
      },
    },

    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (!isAllowedAuthRequest(ctx.method, ctx.path)) {
          throw new APIError('NOT_FOUND', { message: 'Not found' });
        }

        if (ctx.path === '/sign-in/email') {
          const email = typeof ctx.body?.email === 'string' ? ctx.body.email.trim().toLowerCase() : null;
          const user = email ? await ctx.context.internalAdapter.findUserByEmail(email) : null;
          if (user && !(await isSignInEligible(user.user.id))) {
            await recordAuditEvent({
              actorId: user.user.id,
              action: 'SIGN_IN_BLOCKED',
              targetType: 'account',
              targetId: user.user.id,
            });
            throw new APIError('UNAUTHORIZED', INVALID_CREDENTIALS);
          }
        }

        if (ctx.path === '/two-factor/enable' && ctx.body?.method !== undefined && ctx.body.method !== 'totp') {
          throw new APIError('BAD_REQUEST', { message: 'Unsupported method' });
        }

        if (ctx.path === '/two-factor/verify-totp' && ctx.body?.trustDevice) {
          throw new APIError('BAD_REQUEST', { message: 'Unsupported option' });
        }
      }),

      after: createAuthMiddleware(async (ctx) => {
        const failed = isAPIError(ctx.context.returned);
        const audit = (actorId: string | null, action: AuditAction) =>
          recordAuditEvent({ actorId, action, targetType: 'account', targetId: actorId });

        const revokeNewSession = async () => {
          const sessionId = ctx.context.newSession?.session.id;
          if (sessionId) await prisma.authSession.deleteMany({ where: { id: sessionId } });
        };

        try {
          await auditAuthEvent();
        } catch {
          await revokeNewSession();
          throw new APIError('INTERNAL_SERVER_ERROR', { message: 'Request could not be completed' });
        }

        async function auditAuthEvent() {
        if (ctx.path === '/sign-in/email') {
          const email = typeof ctx.body?.email === 'string' ? ctx.body.email.trim().toLowerCase() : null;
          const found = email ? await ctx.context.internalAdapter.findUserByEmail(email) : null;
          const userId = found?.user.id ?? null;
          await audit(userId, failed ? 'SIGN_IN_FAILED' : 'SIGN_IN_PASSWORD_ACCEPTED');
        } else if (ctx.path === '/sign-out') {
          const session = await getSessionFromCtx(ctx).catch(() => null);
          if (session && !failed) await audit(session.user.id, 'SIGN_OUT');
        } else if (ctx.path === '/two-factor/enable' && !failed) {
          const session = await getSessionFromCtx(ctx).catch(() => null);
          await audit(session?.user.id ?? null, 'TOTP_ENROLLMENT_STARTED');
        } else if (ctx.path === '/two-factor/verify-totp') {
          if (failed) {
            const session = await getSessionFromCtx(ctx).catch(() => null);
            await audit(session?.user.id ?? null, 'TOTP_VERIFICATION_FAILED');
          } else {
            const userId = ctx.context.newSession?.user.id ?? null;
            await audit(userId, 'TOTP_VERIFIED');
          }
        }
        }
      }),
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** Lazily created so builds and tests without secrets do not fail on import. */
export function getAuth(): Auth {
  instance ??= createAuth();
  return instance;
}
