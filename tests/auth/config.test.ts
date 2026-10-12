import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ default: {} }));

import { getAuth } from '@/lib/auth/auth';
import { loadAuthEnv } from '@/lib/auth/env';
import { retentionPolicyBlockers } from '@/lib/auth/preflight-policy';
import {
  createMaintainerSchema,
  resetPasswordSchema,
  resetTotpSchema,
  assertNotSelf,
} from '@/lib/auth/account-admin';
import { ForbiddenError } from '@/lib/auth/errors';

const SECRET = 'x'.repeat(40);

describe('auth configuration', () => {
  process.env.BETTER_AUTH_SECRET = SECRET;
  process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  const auth = getAuth();

  it('uses an absolute 8h session without sliding renewal or cookie cache', () => {
    const { session } = auth.options;
    expect(session?.expiresIn).toBe(28800);
    expect(session?.disableSessionRefresh).toBe(true);
    expect(session?.updateAge).toBeGreaterThanOrEqual(28800);
    expect(session?.cookieCache?.enabled).toBe(false);
  });

  it('disables public sign-up and non-password sign-in', () => {
    expect(auth.options.emailAndPassword?.disableSignUp).toBe(true);
    expect(auth.options.emailAndPassword?.autoSignIn).toBe(false);
    expect((auth.options as Record<string, unknown>).socialProviders).toBeUndefined();
    expect(auth.options.account?.accountLinking?.enabled).toBe(false);
  });

  it('generates no backup codes and does not trust user-supplied roles', () => {
    expect(auth.options.user?.additionalFields).not.toHaveProperty('role');
    expect(auth.options.user?.additionalFields?.disabled?.input).toBe(false);
    expect(auth.options.session?.additionalFields?.mfaVerified?.input).toBe(false);
  });

  it('rejects disallowed endpoints through auth.api as well', async () => {
    await expect(
      auth.api.signUpEmail({ body: { email: 'a@b.co', password: 'a-long-password-1', name: 'x' } }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(auth.api.verifyBackupCode({ body: { code: 'abc' } })).rejects.toMatchObject({ statusCode: 404 });
    await expect(auth.api.disableTwoFactor({ body: { password: 'x' } })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('fails fast on weak secret without echoing it', () => {
    expect(() => loadAuthEnv({ BETTER_AUTH_SECRET: 'short', BETTER_AUTH_URL: 'http://localhost' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(() => loadAuthEnv({ BETTER_AUTH_SECRET: 'short', BETTER_AUTH_URL: 'http://localhost' })).not.toThrow(/short'/);
  });

  it('requires HTTPS for the configured production origin', () => {
    expect(() =>
      loadAuthEnv({
        BETTER_AUTH_SECRET: SECRET,
        BETTER_AUTH_URL: 'http://helpers.example.org',
        NODE_ENV: 'production',
      }),
    ).toThrow(/HTTPS/);
  });
});

describe('production retention preflight', () => {
  it('blocks until both organization schedules are approved', () => {
    expect(retentionPolicyBlockers([])).toHaveLength(2);
    expect(retentionPolicyBlockers(['INACTIVE_HELPER'])).toHaveLength(1);
  });

  it('passes the retention gate only after both schedules are approved', () => {
    expect(retentionPolicyBlockers(['INACTIVE_HELPER', 'AUDIT_LOG'])).toEqual([]);
  });
});

describe('account administration inputs', () => {
  it('rejects client-supplied role or unknown fields', () => {
    const base = { email: 'm@example.org', name: 'M', password: 'a-long-password-1' };
    expect(createMaintainerSchema.safeParse(base).success).toBe(true);
    expect(createMaintainerSchema.safeParse({ ...base, role: 'ADMIN' }).success).toBe(false);
  });
  it('rejects client-supplied verification claims during administrator resets', () => {
    expect(resetTotpSchema.safeParse({ userId: 'a' }).success).toBe(true);
    expect(resetTotpSchema.safeParse({ userId: 'a', identityVerified: true }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ userId: 'a', newPassword: 'short', identityVerified: true }).success).toBe(false);
    expect(
      resetPasswordSchema.safeParse({ userId: 'a', newPassword: 'a-long-password-1', identityVerified: true }).success,
    ).toBe(false);
  });
  it('forbids acting on oneself', () => {
    expect(() => assertNotSelf({ userId: 'a' }, 'a')).toThrow(ForbiddenError);
    expect(() => assertNotSelf({ userId: 'a' }, 'b')).not.toThrow();
  });
});

describe('trusted proxy configuration', () => {
  it('parses valid IPs and CIDRs, ignores unset, and rejects junk', async () => {
    const { parseTrustedProxies } = await import('@/lib/auth/env');
    expect(parseTrustedProxies({})).toBeUndefined();
    expect(parseTrustedProxies({ TRUSTED_PROXIES: ' 10.0.0.1, 2001:db8::/32 ' })).toEqual(['10.0.0.1', '2001:db8::/32']);
    expect(() => parseTrustedProxies({ TRUSTED_PROXIES: 'nope' })).toThrow(/TRUSTED_PROXIES/);
    expect(() => parseTrustedProxies({ TRUSTED_PROXIES: '10.0.0.0/33' })).toThrow();
  });
});
