export class AuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class UnauthenticatedError extends AuthError {
  constructor() {
    super('Authentication required.', 401, 'UNAUTHENTICATED');
  }
}

export class MfaEnrollmentRequiredError extends AuthError {
  constructor() {
    super('TOTP enrollment must be completed first.', 403, 'MFA_ENROLLMENT_REQUIRED');
  }
}

export class ForbiddenError extends AuthError {
  constructor() {
    super('Forbidden.', 403, 'FORBIDDEN');
  }
}
