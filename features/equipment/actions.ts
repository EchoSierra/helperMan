'use server';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import { formFields } from '@/features/form-data';
import {
  DuplicateMasterDataError,
  InvalidAssignmentError,
  InvalidStatusTransitionError,
  RecordNotFoundError,
} from '@/features/helpers/errors';
import {
  equipmentItemFormSchema,
  equipmentStatusSchema,
  equipmentTypeFormSchema,
} from '@/features/helpers/schemas';
import { requireMaintainer } from '@/lib/auth/guards';
import { localizedErrorMessage } from '@/lib/error-message';
import {
  assignEquipment,
  assignNewEquipmentToHelper,
  changeEquipmentStatus,
  createEquipmentItem,
  createEquipmentType,
  deleteEquipmentType,
  returnEquipment,
  updateEquipmentType,
} from './service';

export type EquipmentActionState = { message?: string; successToken?: number };

async function errorState(error: unknown): Promise<EquipmentActionState | null> {
  if (
    error instanceof DuplicateMasterDataError ||
    error instanceof InvalidAssignmentError ||
    error instanceof InvalidStatusTransitionError ||
    error instanceof RecordNotFoundError
  ) {
    return { message: (await localizedErrorMessage(error)) ?? error.message };
  }
  return null;
}

function revalidateEquipment() {
  revalidatePath('/equipment');
  revalidatePath('/helpers', 'layout');
}

export async function createEquipmentTypeAction(
  previous: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const t = await getTranslations('equipment');
  await requireMaintainer();
  const parsed = equipmentTypeFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: t('messages.validation.typeName') };
  try {
    await createEquipmentType({ name: parsed.data.name });
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function updateEquipmentTypeAction(
  typeId: string,
  previous: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const t = await getTranslations('equipment');
  await requireMaintainer();
  const parsed = equipmentTypeFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: t('messages.validation.typeName') };
  try {
    await updateEquipmentType({
      typeId,
      name: parsed.data.name,
      retired: parsed.data.retired === 'true',
    });
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  return { message: t('messages.saved'), successToken: (previous.successToken ?? 0) + 1 };
}

export async function deleteEquipmentTypeAction(
  typeId: string,
  previous: EquipmentActionState,
): Promise<EquipmentActionState> {
  await requireMaintainer();
  try {
    await deleteEquipmentType({ typeId });
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function createEquipmentItemAction(
  equipmentTypeId: string,
  previous: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const t = await getTranslations('equipment');
  await requireMaintainer();
  const parsed = equipmentItemFormSchema.safeParse({
    ...formFields(formData),
    equipmentTypeId,
  });
  if (!parsed.success) return { message: t('messages.validation.assetLabel') };
  try {
    await createEquipmentItem(parsed.data);
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function assignEquipmentAction(
  itemId: string,
  previous: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const t = await getTranslations('equipment');
  await requireMaintainer();
  const helperId = formData.get('helperId');
  if (typeof helperId !== 'string' || helperId.trim() === '') {
    return { message: t('messages.validation.helperRequired') };
  }
  try {
    await assignEquipment({ itemId, helperId });
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function assignEquipmentToHelperAction(
  helperId: string,
  previous: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const t = await getTranslations('equipment');
  await requireMaintainer();
  const itemId = formData.get('itemId');
  if (typeof itemId !== 'string' || itemId.trim() === '') {
    return { message: t('messages.validation.itemRequired') };
  }
  try {
    await assignEquipment({ itemId, helperId });
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  revalidatePath(`/helpers/${helperId}`);
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function assignNewEquipmentToHelperAction(
  helperId: string,
  previous: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const t = await getTranslations('equipment');
  await requireMaintainer();
  const parsed = equipmentItemFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: t('messages.validation.newAssignment') };
  try {
    await assignNewEquipmentToHelper({ ...parsed.data, helperId });
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  revalidatePath(`/helpers/${helperId}`);
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function returnEquipmentAction(
  itemId: string,
  previous: EquipmentActionState,
): Promise<EquipmentActionState> {
  await requireMaintainer();
  try {
    await returnEquipment({ itemId });
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  return { successToken: (previous.successToken ?? 0) + 1 };
}

export async function changeEquipmentStatusAction(
  itemId: string,
  previous: EquipmentActionState,
  formData: FormData,
): Promise<EquipmentActionState> {
  const t = await getTranslations('equipment');
  await requireMaintainer();
  const parsed = equipmentStatusSchema.safeParse(formData.get('status'));
  if (!parsed.success) return { message: t('messages.validation.statusRequired') };
  try {
    await changeEquipmentStatus({ itemId, status: parsed.data });
  } catch (error) {
    const result = await errorState(error);
    if (result) return result;
    throw error;
  }
  revalidateEquipment();
  return { message: t('messages.saved'), successToken: (previous.successToken ?? 0) + 1 };
}
