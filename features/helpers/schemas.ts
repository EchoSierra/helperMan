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

export const qualificationFields = {
  title: z.string().trim().min(1).max(200),
  validThrough: z.preprocess(
    (value: unknown) => (value === '' || value === undefined ? null : value),
    z.iso.date().nullable(),
  ),
};

export const createQualificationSchema = z
  .object({ helperId, ...qualificationFields })
  .strict();

export const updateQualificationSchema = z
  .object({ helperId, qualificationId: helperId, ...qualificationFields })
  .strict();

export const qualificationFormSchema = z.object(qualificationFields).strict();
