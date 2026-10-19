'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { formFields } from '@/features/form-data';
import { DuplicateMasterDataError, RecordNotFoundError } from '@/features/helpers/errors';
import { qualificationDefinitionFormSchema } from '@/features/helpers/schemas';
import { requireMaintainer } from '@/lib/auth/guards';
import { createQualificationDefinition, updateQualificationDefinition } from './catalog-service';

export type CatalogActionState = { message?: string; successToken?: number };

export async function createQualificationDefinitionAction(
  previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  await requireMaintainer();
  const t = await getTranslations('qualifications');
  const parsed = qualificationDefinitionFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: t('messages.invalidDefinition') };
  try {
    await createQualificationDefinition(parsed.data);
  } catch (error) {
    if (error instanceof DuplicateMasterDataError) return { message: t('messages.duplicate') };
    throw error;
  }
  revalidatePath('/qualifications');
  revalidatePath('/helpers', 'layout');
  revalidatePath('/reports/qualification-expiry');
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function updateQualificationDefinitionAction(
  definitionId: string,
  previous: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  await requireMaintainer();
  const t = await getTranslations('qualifications');
  const parsed = qualificationDefinitionFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: t('messages.invalidDefinition') };
  try {
    await updateQualificationDefinition({
      definitionId,
      name: parsed.data.name,
      category: parsed.data.category,
      retired: parsed.data.retired === 'true',
    });
  } catch (error) {
    if (error instanceof DuplicateMasterDataError) return { message: t('messages.duplicate') };
    if (error instanceof RecordNotFoundError) return { message: t('messages.definitionNotFound') };
    throw error;
  }
  revalidatePath('/qualifications');
  revalidatePath('/helpers', 'layout');
  revalidatePath('/reports/qualification-expiry');
  return { message: t('messages.saved'), successToken: (previous.successToken ?? 0) + 1 };
}
