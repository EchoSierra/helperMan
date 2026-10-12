'use server';

import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { changeOwnPassword } from '@/lib/auth/account-self';
import { ForbiddenError, UnauthenticatedError } from '@/lib/auth/errors';

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

export async function changePasswordAction(formData: FormData) {
  try {
    await changeOwnPassword({
      currentPassword: text(formData, 'currentPassword'),
      code: text(formData, 'code').trim(),
      newPassword: text(formData, 'newPassword'),
    });
  } catch (error) {
    if (error instanceof ZodError) redirect('/account/password?error=invalid');
    if (error instanceof ForbiddenError) redirect('/account/password?error=denied');
    if (error instanceof UnauthenticatedError) redirect('/sign-in');
    throw error;
  }
  redirect('/sign-in');
}
