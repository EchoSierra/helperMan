import { describe, expect, it } from 'vitest';
import {
  ENROLLMENT_WINDOW_SECONDS,
  SESSION_ABSOLUTE_LIFETIME_SECONDS,
  canAccessHelperData,
  canManageAccounts,
  evaluateAccess,
  isAllowedAuthRequest,
  isAssignableRole,
  type AccessContext,
  type AuthRole,
} from '@/lib/auth/policy';

const now = new Date('2030-01-01T12:00:00Z');
const at = (seconds: number) => new Date(now.getTime() + seconds * 1000);
const session = (over: Partial<{ createdAt: Date; expiresAt: Date; mfaVerified: boolean }> = {}) => ({
  createdAt: now,
  expiresAt: at(SESSION_ABSOLUTE_LIFETIME_SECONDS),
  mfaVerified: true,
  ...over,
});
const user = (over: Partial<{ disabled: boolean; twoFactorEnabled: boolean }> = {}) => ({
  disabled: false,
  twoFactorEnabled: true,
  ...over,
});
const ctx = (roles: AuthRole[], status: AccessContext['status'] = 'granted'): AccessContext => ({
  status,
  userId: 'u',
  roles,
});

describe('session policy', () => {
  it('is 8 hours absolute', () => expect(SESSION_ABSOLUTE_LIFETIME_SECONDS).toBe(28800));

  it('grants a verified session within the lifetime', () => {
    expect(evaluateAccess({ session: session(), user: user(), roles: ['MAINTAINER'], now: at(28799) })).toBe('granted');
  });

  it('expires at exactly 8 hours regardless of activity', () => {
    expect(evaluateAccess({ session: session(), user: user(), roles: ['MAINTAINER'], now: at(28800) })).toBe('session-expired');
  });

  it('expires when the stored expiry has passed', () => {
    const s = session({ expiresAt: at(60) });
    expect(evaluateAccess({ session: s, user: user(), roles: ['ADMIN'], now: at(61) })).toBe('session-expired');
  });
});

describe('MFA gating', () => {
  it('denies protected access without TOTP enrollment', () => {
    const s = session({ mfaVerified: false });
    expect(evaluateAccess({ session: s, user: user({ twoFactorEnabled: false }), roles: ['ADMIN'], now })).toBe('mfa-enrollment-required');
  });

  it('does not upgrade a password-only session when TOTP is enabled later', () => {
    const s = session({ mfaVerified: false });
    expect(evaluateAccess({ session: s, user: user({ twoFactorEnabled: true }), roles: ['ADMIN'], now })).toBe('mfa-enrollment-required');
  });

  it('denies a verified session once TOTP was reset', () => {
    expect(evaluateAccess({ session: session(), user: user({ twoFactorEnabled: false }), roles: ['ADMIN'], now })).toBe('mfa-enrollment-required');
  });

  it('limits the enrollment-only session to a short window', () => {
    const s = session({ mfaVerified: false });
    const input = { session: s, user: user({ twoFactorEnabled: false }), roles: ['ADMIN'] as AuthRole[] };
    expect(evaluateAccess({ ...input, now: at(ENROLLMENT_WINDOW_SECONDS - 1) })).toBe('mfa-enrollment-required');
    expect(evaluateAccess({ ...input, now: at(ENROLLMENT_WINDOW_SECONDS) })).toBe('session-expired');
  });
});

describe('blocking states', () => {
  it('denies unauthenticated', () => {
    expect(evaluateAccess({ session: null, user: null, roles: [], now })).toBe('unauthenticated');
  });
  it('blocks disabled accounts immediately', () => {
    expect(evaluateAccess({ session: session(), user: user({ disabled: true }), roles: ['ADMIN'], now })).toBe('account-disabled');
  });
  it('denies accounts without an approved role', () => {
    expect(evaluateAccess({ session: session(), user: user(), roles: [], now })).toBe('no-role');
  });
});

describe('authorization boundaries', () => {
  it('requires Maintainer for helper data', () => {
    expect(canAccessHelperData(ctx(['MAINTAINER']))).toBe(true);
    expect(canAccessHelperData(ctx(['ADMIN', 'MAINTAINER']))).toBe(true);
    expect(canAccessHelperData(ctx(['ADMIN']))).toBe(false);
    expect(canAccessHelperData(ctx([]))).toBe(false);
  });
  it('requires Administrator for account operations', () => {
    expect(canManageAccounts(ctx(['ADMIN']))).toBe(true);
    expect(canManageAccounts(ctx(['ADMIN', 'MAINTAINER']))).toBe(true);
    expect(canManageAccounts(ctx(['MAINTAINER']))).toBe(false);
  });
  it('denies everything unless fully granted', () => {
    expect(canAccessHelperData(ctx(['MAINTAINER'], 'mfa-enrollment-required'))).toBe(false);
    expect(canManageAccounts(ctx(['ADMIN'], 'account-disabled'))).toBe(false);
  });
  it('only allows assigning the Maintainer role', () => {
    expect(isAssignableRole('MAINTAINER')).toBe(true);
    expect(isAssignableRole('ADMIN')).toBe(false);
    expect(isAssignableRole('ROOT')).toBe(false);
  });
});

describe('auth endpoint allowlist', () => {
  it.each([
    ['POST', '/sign-in/email'],
    ['POST', '/sign-out'],
    ['POST', '/two-factor/enable'],
    ['POST', '/two-factor/verify-totp'],
    ['GET', '/get-session'],
  ])('allows %s %s', (method, path) => expect(isAllowedAuthRequest(method, path)).toBe(true));

  it.each([
    ['POST', '/sign-up/email'],
    ['POST', '/two-factor/disable'],
    ['POST', '/two-factor/generate-backup-codes'],
    ['POST', '/two-factor/verify-backup-code'],
    ['POST', '/two-factor/send-otp'],
    ['POST', '/two-factor/verify-otp'],
    ['POST', '/two-factor/get-totp-uri'],
    ['POST', '/sign-in/social'],
    ['POST', '/sign-in/username'],
    ['POST', '/sign-in/magic-link'],
    ['POST', '/request-password-reset'],
    ['POST', '/reset-password'],
    ['POST', '/change-password'],
    ['POST', '/change-email'],
    ['POST', '/update-user'],
    ['POST', '/delete-user'],
    ['POST', '/link-social'],
    ['POST', '/revoke-sessions'],
    ['GET', '/list-sessions'],
    ['GET', '/sign-in/email'],
    ['GET', '/two-factor/enable'],
    ['POST', '/get-session'],
    ['POST', '/sign-in/email/../sign-up/email'],
  ])('denies %s %s', (method, path) => expect(isAllowedAuthRequest(method, path)).toBe(false));
});
