import { redirect } from 'next/navigation';
import { canAccessHelperData, canManageAccounts } from './policy';
import { getAccessContext } from './guards';

export async function requireMaintainerPage(): Promise<void> {
  const access = await getAccessContext();
  if (access.status === 'unauthenticated' || access.status === 'session-expired') redirect('/sign-in');
  if (access.status === 'mfa-enrollment-required') redirect('/mfa/enroll');
  if (!canAccessHelperData(access)) redirect('/');
}

export async function requireAdministratorPage(): Promise<void> {
  const access = await getAccessContext();
  if (access.status === 'unauthenticated' || access.status === 'session-expired') redirect('/sign-in');
  if (access.status === 'mfa-enrollment-required') redirect('/mfa/enroll');
  if (!canManageAccounts(access)) redirect('/');
}

export async function requireSessionPage(): Promise<void> {
  const access = await getAccessContext();
  if (access.status === 'unauthenticated' || access.status === 'session-expired') redirect('/sign-in');
  if (access.status === 'mfa-enrollment-required') redirect('/mfa/enroll');
  if (access.status !== 'granted') redirect('/');
}
