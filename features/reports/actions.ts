'use server';

import { formFields } from '@/features/form-data';
import { getTranslations } from 'next-intl/server';
import { requireMaintainer } from '@/lib/auth/guards';
import { InvalidCursorError } from '@/features/helpers/errors';
import type { QualificationExpiryActionState } from '@/features/helpers/action-state';
import { listQualificationExpiries } from '@/features/qualifications/service';
import { z } from 'zod';

const cursorSchema = z.object({
  afterId: z.preprocess(
    (value: unknown) => (value === '' || value === undefined ? null : value),
    z.string().trim().min(1).max(64).nullable(),
  ),
  reportDate: z.iso.date(),
}).strict();

export async function loadMoreQualificationExpiriesAction(
  previous: QualificationExpiryActionState,
  formData: FormData,
): Promise<QualificationExpiryActionState> {
  await requireMaintainer();
  const t = await getTranslations('reports');
  const parsed = cursorSchema.safeParse(formFields(formData));
  if (!parsed.success || !parsed.data.afterId) {
    return { ...previous, message: t('messages.pageLoadError') };
  }
  try {
    const result = await listQualificationExpiries({
      afterId: parsed.data.afterId,
      reportDate: parsed.data.reportDate,
    });
    return {
      ...result,
      items: [...previous.items, ...result.items],
    };
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      return { ...previous, nextCursor: null, message: t('messages.reportChanged') };
    }
    throw error;
  }
}
