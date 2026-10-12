'use server';

import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import {
  createMaintainerAccount,
  deleteMaintainerAccount,
  grantMaintainerRole,
  revokeMaintainerRole,
  resetPassword,
  resetTotp,
  revokeSessions,
  setAccountDisabled,
} from '@/lib/auth/account-admin';
import { ForbiddenError } from '@/lib/auth/errors';

const BASE = '/admin/maintainers';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

async function run(successCode: string, operation: () => Promise<unknown>): Promise<never> {
  try {
    await operation();
  } catch (error) {
    if (error instanceof ZodError) redirect(`${BASE}?error=invalid`);
    if (error instanceof ForbiddenError) redirect(`${BASE}?error=denied`);
    throw error;
  }
  redirect(`${BASE}?status=${successCode}`);
}

export async function createMaintainerAction(formData: FormData) {
  await run('created', () =>
    createMaintainerAccount({
      email: text(formData, 'email'),
      name: text(formData, 'name'),
      password: text(formData, 'password'),
    }),
  );
}

export async function setDisabledAction(formData: FormData) {
  const disable = text(formData, 'disable') === 'true';
  await run(disable ? 'disabled' : 'enabled', () =>
    setAccountDisabled({ userId: text(formData, 'userId') }, disable),
  );
}

export async function revokeSessionsAction(formData: FormData) {
  await run('sessions-revoked', () => revokeSessions({ userId: text(formData, 'userId') }));
}

export async function resetTotpAction(formData: FormData) {
  await run('totp-reset', () => resetTotp({ userId: text(formData, 'userId') }));
}

export async function resetPasswordAction(formData: FormData) {
  await run('password-reset', () =>
    resetPassword({ userId: text(formData, 'userId'), newPassword: text(formData, 'newPassword') }),
  );
}

export async function deleteMaintainerAction(formData: FormData) {
  await run('deleted', () => deleteMaintainerAccount({ userId: text(formData, 'userId') }));
}

export async function grantMaintainerRoleAction(formData: FormData) {
  await run('role-granted', () => grantMaintainerRole({ userId: text(formData, 'userId') }));
}

export async function revokeMaintainerRoleAction(formData: FormData) {
  await run('role-revoked', () => revokeMaintainerRole({ userId: text(formData, 'userId') }));
}
