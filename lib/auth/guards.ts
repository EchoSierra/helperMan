import { headers as nextHeaders } from 'next/headers';
import prisma from '@/lib/db';
import { getAuth } from './auth';
import { ForbiddenError, MfaEnrollmentRequiredError, UnauthenticatedError } from './errors';
import {
  canAccessHelperData,
  canManageAccounts,
  evaluateAccess,
  type AccessContext,
  type AuthRole,
} from './policy';

export type AuthorizedContext = AccessContext & { userId: string };

/**
 * Resolves the caller's access from the revocable DB session plus fresh user
 * and role state. Single source of truth for every server action / route.
 */
export async function getAccessContext(requestHeaders?: Headers): Promise<AccessContext> {
  const headers = requestHeaders ?? (await nextHeaders());
  const result = await getAuth().api.getSession({
    headers,
    query: { disableCookieCache: true, disableRefresh: true },
  });
  if (!result) return { status: 'unauthenticated', userId: null, roles: [] };

  const [user, assignments] = await Promise.all([
    prisma.authUser.findUnique({
      where: { id: result.user.id },
      select: { disabled: true, twoFactorEnabled: true },
    }),
    prisma.authRoleAssignment.findMany({ where: { userId: result.user.id }, select: { role: true } }),
  ]);
  const roles = assignments.map((a) => a.role as AuthRole);

  const status = evaluateAccess({
    session: {
      createdAt: new Date(result.session.createdAt),
      expiresAt: new Date(result.session.expiresAt),
      mfaVerified: (result.session as { mfaVerified?: boolean }).mfaVerified === true,
    },
    user: user ? { disabled: user.disabled, twoFactorEnabled: user.twoFactorEnabled === true } : null,
    roles,
    now: new Date(),
  });
  return { status, userId: status === 'unauthenticated' ? null : result.user.id, roles };
}

function assertGranted(context: AccessContext): asserts context is AuthorizedContext {
  if (context.status === 'mfa-enrollment-required') throw new MfaEnrollmentRequiredError();
  if (context.status !== 'granted' || !context.userId) throw new UnauthenticatedError();
}

/** Any fully authenticated (password + TOTP) account with an approved role. */
export async function requireSession(requestHeaders?: Headers): Promise<AuthorizedContext> {
  const context = await getAccessContext(requestHeaders);
  assertGranted(context);
  return context;
}

/** Helper-data access: Maintainer role only (Admin alone is denied). */
export async function requireMaintainer(requestHeaders?: Headers): Promise<AuthorizedContext> {
  const context = await requireSession(requestHeaders);
  if (!canAccessHelperData(context)) throw new ForbiddenError();
  return context;
}

/** Account operations: Administrator role only. */
export async function requireAdministrator(requestHeaders?: Headers): Promise<AuthorizedContext> {
  const context = await requireSession(requestHeaders);
  if (!canManageAccounts(context)) throw new ForbiddenError();
  return context;
}
