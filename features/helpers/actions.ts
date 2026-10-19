'use server';

import { formFields } from '@/features/form-data';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { requireMaintainer } from '@/lib/auth/guards';
import { createHelper, listHelpers, updateHelper } from './service';
import {
  createHelperSchema,
  directorySearchFormSchema,
  helperFormSchema,
  updateHelperSchema,
} from './schemas';
import { InvalidCursorError, InvalidOrganizationError, RecordNotFoundError } from './errors';
import type { FormActionState, HelperDirectoryActionState } from './action-state';

function helperFieldErrors(
  t: Awaited<ReturnType<typeof getTranslations>>,
  error: { issues: Array<{ path: PropertyKey[]; message: string }> },
) {
  const messages = {
    firstName: t('form.firstNameError'),
    lastName: t('form.lastNameError'),
    email: t('form.emailError'),
    phone: t('form.phoneError'),
    address: t('form.addressError'),
    organizationId: t('form.organizationError'),
  } as const;

  return error.issues.reduce<Record<string, string[]>>((result, issue) => {
    const key = issue.path[0];
    if (typeof key === 'string' && key in messages) {
      (result[key] ??= []).push(messages[key as keyof typeof messages]);
    }
    return result;
  }, {});
}

export async function searchHelpersAction(
  previous: HelperDirectoryActionState,
  formData: FormData,
): Promise<HelperDirectoryActionState> {
  await requireMaintainer();
  const t = await getTranslations('helpers');
  const parsed = directorySearchFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { ...previous, message: t('directory.invalidSearch') };
  if (
    parsed.data.intent === 'more' &&
    (!parsed.data.cursorId || parsed.data.search !== previous.search)
  ) {
    return { ...previous, message: t('directory.searchChanged') };
  }

  try {
    const result = await listHelpers({
      search: parsed.data.search,
      cursorId: parsed.data.intent === 'more' ? parsed.data.cursorId : null,
    });
    return {
      search: parsed.data.search,
      items: parsed.data.intent === 'more' ? [...previous.items, ...result.items] : result.items,
      nextCursor: result.nextCursor,
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return {
        search: parsed.data.search,
        items: [],
        nextCursor: null,
        message: t('directory.changed'),
      };
    }
    throw error;
  }
}

export async function createHelperAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireMaintainer();
  const t = await getTranslations('helpers');
  const parsed = helperFormSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    return { message: t('form.summary'), fieldErrors: helperFieldErrors(t, parsed.error) };
  }

  const input = createHelperSchema.safeParse(parsed.data);
  if (!input.success) {
    return { message: t('form.summary'), fieldErrors: helperFieldErrors(t, input.error) };
  }
  let helperId: string;
  try {
    ({ helperId } = await createHelper(input.data));
  } catch (error) {
    if (error instanceof InvalidOrganizationError) {
      return {
        message: t('form.summary'),
        fieldErrors: { organizationId: [t('form.organizationError')] },
      };
    }
    throw error;
  }
  revalidatePath('/helpers');
  return { helperId };
}

export async function updateHelperAction(
  helperId: string,
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireMaintainer();
  const t = await getTranslations('helpers');
  const parsed = helperFormSchema.safeParse(formFields(formData));
  if (!parsed.success) {
    return { message: t('form.summary'), fieldErrors: helperFieldErrors(t, parsed.error) };
  }

  const input = updateHelperSchema.safeParse({ helperId, ...parsed.data });
  if (!input.success) {
    return { message: t('form.summary'), fieldErrors: helperFieldErrors(t, input.error) };
  }
  try {
    await updateHelper(input.data);
  } catch (error) {
    if (error instanceof RecordNotFoundError) return { message: t('form.notFound') };
    if (error instanceof InvalidOrganizationError) {
      return {
        message: t('form.summary'),
        fieldErrors: { organizationId: [t('form.organizationError')] },
      };
    }
    throw error;
  }
  revalidatePath(`/helpers/${helperId}`);
  revalidatePath('/helpers');
  return { successToken: (previous.successToken ?? 0) + 1 };
}
