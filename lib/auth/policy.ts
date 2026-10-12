/**
 * Pure authentication/authorization policy. No I/O, so it can be unit tested
 * and reused by every server-side guard.
 */

export const AUTH_ROLES = ['ADMIN', 'MAINTAINER'] as const;
export type AuthRole = (typeof AUTH_ROLES)[number];

/** Absolute session lifetime. Never renewed. */
export const SESSION_ABSOLUTE_LIFETIME_SECONDS = 8 * 60 * 60;
/** Lifetime of a password-only session that may only complete TOTP enrollment. */
export const ENROLLMENT_WINDOW_SECONDS = 15 * 60;
/** Effectively disables Better Auth's sliding refresh (must be >= lifetime). */
export const SESSION_UPDATE_AGE_SECONDS = 365 * 24 * 60 * 60;

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Only these Better Auth endpoints are reachable, over HTTP and via auth.api.
 * Everything else (sign-up, backup codes, 2FA disable, OTP, password reset,
 * account linking, user self-service) is denied.
 */
const ALLOWED_AUTH_ENDPOINTS: ReadonlyArray<readonly [method: string, path: string]> = [
  ['POST', '/sign-in/email'],
  ['POST', '/sign-out'],
  ['POST', '/two-factor/enable'],
  ['POST', '/two-factor/verify-totp'],
  ['GET', '/get-session'],
];

export function isAllowedAuthRequest(method: string | undefined, path: string): boolean {
  const normalized = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return ALLOWED_AUTH_ENDPOINTS.some(
    ([allowedMethod, allowedPath]) =>
      allowedPath === normalized && (method === undefined || method.toUpperCase() === allowedMethod),
  );
}

export type AccessInput = {
  session: { createdAt: Date; expiresAt: Date; mfaVerified: boolean } | null;
  user: { disabled: boolean; twoFactorEnabled: boolean } | null;
  roles: readonly AuthRole[];
  now: Date;
};

export type AccessStatus =
  | 'unauthenticated'
  | 'session-expired'
  | 'account-disabled'
  | 'no-role'
  | 'mfa-enrollment-required'
  | 'granted';

export type AccessContext = {
  status: AccessStatus;
  userId: string | null;
  roles: readonly AuthRole[];
};

/**
 * Decides what a session may do right now. Called on every protected request
 * with fresh database state, so disablement, role changes, and revocation take
 * effect immediately.
 */
export function evaluateAccess(input: AccessInput): AccessStatus {
  const { session, user, roles, now } = input;
  if (!session || !user) return 'unauthenticated';
  if (user.disabled) return 'account-disabled';
  if (roles.length === 0) return 'no-role';

  const createdAt = session.createdAt.getTime();
  const nowMs = now.getTime();

  // Protected access requires TOTP to have been verified when this session was created.
  const mfaComplete = session.mfaVerified && user.twoFactorEnabled;
  const lifetimeSeconds = mfaComplete ? SESSION_ABSOLUTE_LIFETIME_SECONDS : ENROLLMENT_WINDOW_SECONDS;
  if (nowMs >= createdAt + lifetimeSeconds * 1000 || nowMs >= session.expiresAt.getTime()) {
    return 'session-expired';
  }
  return mfaComplete ? 'granted' : 'mfa-enrollment-required';
}

export function hasRole(roles: readonly AuthRole[], role: AuthRole): boolean {
  return roles.includes(role);
}

/** Helper data requires an explicit Maintainer assignment; ADMIN never implies it. */
export function canAccessHelperData(context: AccessContext): boolean {
  return context.status === 'granted' && hasRole(context.roles, 'MAINTAINER');
}

export function canManageAccounts(context: AccessContext): boolean {
  return context.status === 'granted' && hasRole(context.roles, 'ADMIN');
}

/** Only the Maintainer role may be granted or revoked through account management. */
export function isAssignableRole(role: string): role is 'MAINTAINER' {
  return role === 'MAINTAINER';
}
