'use server';

import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import { ForbiddenError } from '@/lib/auth/errors';
import { setRetentionPolicy } from './service';

const BASE = '/admin/retention';

export async function setRetentionPolicyAction(formData: FormData) {
  const field = (key: string) => {
    const value = formData.get(key);
    return typeof value === 'string' ? value : undefined;
  };
  try {
    await setRetentionPolicy({
      kind: field('kind'),
      periodDays: field('periodDays'),
      decisionReference: field('decisionReference'),
      confirmApproved: field('confirmApproved'),
    });
  } catch (error) {
    if (error instanceof ZodError) redirect(`${BASE}?error=invalid`);
    if (error instanceof ForbiddenError) redirect(`${BASE}?error=denied`);
    throw error;
  }
  redirect(`${BASE}?status=saved`);
}
