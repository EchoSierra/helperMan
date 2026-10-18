import 'server-only';
import { getTranslations } from 'next-intl/server';

const KNOWN_ERRORS = [
  'RecordNotFoundError',
  'InvalidCursorError',
  'InvalidOrganizationError',
  'DuplicateOrganizationError',
  'DuplicateMasterDataError',
  'InvalidAssignmentError',
  'InvalidStatusTransitionError',
  'DuplicateQualificationAssignmentError',
  'UnauthenticatedError',
  'MfaEnrollmentRequiredError',
  'ForbiddenError',
] as const;

/** Localized message for a known domain error (matched by class name), or null for unknown errors. */
export async function localizedErrorMessage(error: unknown): Promise<string | null> {
  if (!(error instanceof Error) || !(KNOWN_ERRORS as readonly string[]).includes(error.name)) return null;
  const t = await getTranslations('errors');
  return t(error.name);
}
