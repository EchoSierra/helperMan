'use server';

import { formFields } from '@/features/form-data';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { requireMaintainer } from '@/lib/auth/guards';
import { createQualification, removeQualification, updateQualification } from './service';
import {
  createQualificationSchema,
  qualificationFormSchema,
  qualificationValidityFormSchema,
  updateQualificationSchema,
} from '@/features/helpers/schemas';
import {
  DuplicateQualificationAssignmentError,
  InvalidAssignmentError,
  RecordNotFoundError,
} from '@/features/helpers/errors';
import type { FormActionState } from '@/features/helpers/action-state';

function qualificationFieldErrors(
  t: Awaited<ReturnType<typeof getTranslations>>,
  error: { issues: Array<{ path: PropertyKey[]; message: string }> },
) {
  const messages = {
    definitionId: t('form.definitionError'),
    validThrough: t('form.validThroughError'),
  } as const;

  return error.issues.reduce<Record<string, string[]>>((result, issue) => {
    const key = issue.path[0];
    if (typeof key === 'string' && key in messages) {
      (result[key] ??= []).push(messages[key as keyof typeof messages]);
    }
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
  const t = await getTranslations('qualifications');
  try {
    if (qualificationId) {
      const fields = qualificationValidityFormSchema.safeParse(formFields(formData));
      if (!fields.success) {
        return {
          message: t('form.summary'),
          fieldErrors: qualificationFieldErrors(t, fields.error),
        };
      }
      const input = updateQualificationSchema.safeParse({ helperId, qualificationId, ...fields.data });
      if (!input.success) {
        return {
          message: t('form.summary'),
          fieldErrors: qualificationFieldErrors(t, input.error),
        };
      }
      await updateQualification(input.data);
    } else {
      const fields = qualificationFormSchema.safeParse(formFields(formData));
      if (!fields.success) {
        return {
          message: t('form.summary'),
          fieldErrors: qualificationFieldErrors(t, fields.error),
        };
      }
      const input = createQualificationSchema.safeParse({ helperId, ...fields.data });
      if (!input.success) {
        return {
          message: t('form.summary'),
          fieldErrors: qualificationFieldErrors(t, input.error),
        };
      }
      await createQualification(input.data);
    }
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return { message: t('messages.recordNotFound') };
    }
    if (error instanceof InvalidAssignmentError || error instanceof DuplicateQualificationAssignmentError) {
      return {
        message:
          error instanceof InvalidAssignmentError
            ? t('messages.assignmentUnavailable')
            : t('messages.alreadyAssigned'),
      };
    }
    throw error;
  }
  revalidatePath(`/helpers/${helperId}`);
  revalidatePath('/reports/qualification-expiry');
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function removeQualificationAction(
  helperId: string,
  qualificationId: string,
  previous: FormActionState,
  _formData: FormData,
): Promise<FormActionState> {
  await requireMaintainer();
  const t = await getTranslations('qualifications');
  try {
    await removeQualification({ helperId, qualificationId });
  } catch (error) {
    if (error instanceof RecordNotFoundError) {
      return { message: t('messages.recordNotFound') };
    }
    throw error;
  }
  revalidatePath(`/helpers/${helperId}`);
  revalidatePath('/reports/qualification-expiry');
  return { successToken: (previous.successToken ?? 0) + 1 };
}
