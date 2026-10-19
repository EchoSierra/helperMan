'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { formFields } from '@/features/form-data';
import { requireMaintainer } from '@/lib/auth/guards';
import { DuplicateOrganizationError, RecordNotFoundError } from '@/features/helpers/errors';
import { organizationFormSchema } from '@/features/helpers/schemas';
import { createOrganization, updateOrganization } from './service';

export type OrganizationActionState = { message?: string; successToken?: number };

export async function createOrganizationAction(
  previous: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  await requireMaintainer();
  const t = await getTranslations('organizations');
  const parsed = organizationFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: t('messages.invalidName') };
  try {
    await createOrganization({ name: parsed.data.name });
  } catch (error) {
    if (error instanceof DuplicateOrganizationError) return { message: t('messages.duplicate') };
    throw error;
  }
  revalidatePath('/organizations');
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function updateOrganizationAction(
  organizationId: string,
  previous: OrganizationActionState,
  formData: FormData,
): Promise<OrganizationActionState> {
  await requireMaintainer();
  const t = await getTranslations('organizations');
  const parsed = organizationFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: t('messages.invalidName') };
  try {
    await updateOrganization({
      organizationId,
      name: parsed.data.name,
      active: parsed.data.active !== 'false',
    });
  } catch (error) {
    if (error instanceof DuplicateOrganizationError) return { message: t('messages.duplicate') };
    if (error instanceof RecordNotFoundError) return { message: t('messages.notFound') };
    throw error;
  }
  revalidatePath('/organizations');
  revalidatePath('/helpers', 'layout');
  return { message: t('messages.saved'), successToken: (previous.successToken ?? 0) + 1 };
}
