import { z } from 'zod';

const helperId = z.string().trim().min(1).max(64);

function nullableText(maxLength: number) {
  return z.preprocess(
    (value: unknown) =>
      value === undefined || (typeof value === 'string' && value.trim() === '')
        ? null
        : typeof value === 'string'
          ? value.trim()
          : value,
    z.string().max(maxLength).nullable(),
  );
}

const helperFields = {
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.preprocess(
    (value: unknown) =>
      value === undefined || (typeof value === 'string' && value.trim() === '')
        ? null
        : typeof value === 'string'
          ? value.trim()
          : value,
    z.email().max(254).nullable(),
  ),
  phone: nullableText(50),
  address: nullableText(300),
  organizationId: z.preprocess(
    (value: unknown) =>
      value === undefined || (typeof value === 'string' && value.trim() === '') ? null : value,
    helperId.nullable(),
  ),
};

export const createHelperSchema = z
  .object({ ...helperFields, active: z.boolean().default(true) })
  .strict();

export const updateHelperSchema = z
  .object({ helperId, ...helperFields, active: z.boolean() })
  .strict();

export const helperFormSchema = z
  .object({
    ...helperFields,
    active: z.enum(['true', 'false']).transform((value) => value === 'true'),
  })
  .strict();

export const directorySearchSchema = z
  .object({
    search: z.string().trim().max(100).default(''),
    cursorId: z.preprocess(
      (value: unknown) =>
        value === undefined || (typeof value === 'string' && value.trim() === '') ? null : value,
      helperId.nullable(),
    ),
  })
  .strict();

export const directorySearchFormSchema = directorySearchSchema
  .extend({ intent: z.enum(['search', 'more']) })
  .strict();

export const qualificationValidityFields = {
  validThrough: z.preprocess(
    (value: unknown) => (value === '' || value === undefined ? null : value),
    z.iso.date().nullable(),
  ),
};

export const qualificationFields = {
  definitionId: helperId,
  ...qualificationValidityFields,
};

export const createQualificationSchema = z
  .object({ helperId, ...qualificationFields })
  .strict();

export const updateQualificationSchema = z
  .object({ helperId, qualificationId: helperId, ...qualificationValidityFields })
  .strict();

export const qualificationFormSchema = z.object(qualificationFields).strict();
export const qualificationValidityFormSchema = z.object(qualificationValidityFields).strict();

export const qualificationDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category: nullableText(100),
  })
  .strict();

export const qualificationDefinitionFormSchema = qualificationDefinitionSchema
  .extend({ retired: z.enum(['true', 'false']).optional() })
  .strict();

export const equipmentTypeSchema = z.object({ name: z.string().trim().min(1).max(200) }).strict();
export const equipmentTypeFormSchema = equipmentTypeSchema
  .extend({ retired: z.enum(['true', 'false']).optional() })
  .strict();

export const equipmentItemFormSchema = z
  .object({
    equipmentTypeId: helperId,
    assetLabel: nullableText(100),
  })
  .strict();

export const equipmentStatusSchema = z.enum(['AVAILABLE', 'IN_REPAIR', 'RETIRED']);

export const organizationNameSchema = z.object({ name: z.string().trim().min(1).max(200) }).strict();

export const organizationFormSchema = z
  .object({ name: z.string().trim().min(1).max(200), active: z.enum(['true', 'false']).optional() })
  .strict();
