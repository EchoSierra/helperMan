'use server';

import { formFields } from '@/features/form-data';
import { revalidatePath } from 'next/cache';
import { requireMaintainer } from '@/lib/auth/guards';
import { createQualification, updateQualification } from './service';
import {
  createQualificationSchema,
  qualificationFormSchema,
  updateQualificationSchema,
} from '@/features/helpers/schemas';
import { RecordNotFoundError } from '@/features/helpers/errors';
import type { FormActionState } from '@/features/helpers/action-state';

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.reduce<Record<string, string[]>>((result, issue) => {
    const key = issue.path[0];
    if (typeof key === 'string') (result[key] ??= []).push(issue.message);
    return result;
  }, {});
}

export async function saveQualificationAction(
  helperId: string,
  qualificationId: string | null,
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireMaintainer();
  const fields = qualificationFormSchema.safeParse(formFields(formData));
  if (!fields.success) return { message: 'Review the highlighted fields.', fieldErrors: fieldErrors(fields.error) };

  try {
    if (qualificationId) {
      const input = updateQualificationSchema.safeParse({ helperId, qualificationId, ...fields.data });
      if (!input.success) return { message: 'Review the highlighted fields.', fieldErrors: fieldErrors(input.error) };
      await updateQualification(input.data);
    } else {
      const input = createQualificationSchema.safeParse({ helperId, ...fields.data });
      if (!input.success) return { message: 'Review the highlighted fields.', fieldErrors: fieldErrors(input.error) };
      await createQualification(input.data);
    }
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return { message: 'The helper profile or qualification no longer exists.' };
    }
    throw error;
  }
  revalidatePath(`/helpers/${helperId}`);
  revalidatePath('/reports/qualification-expiry');
  return { successToken: (previous.successToken ?? 0) + 1 };
}
