'use server';

import { formFields } from '@/features/form-data';
import { revalidatePath } from 'next/cache';
import { requireMaintainer } from '@/lib/auth/guards';
import { createHelper, listHelpers, updateHelper } from './service';
import {
  createHelperSchema,
  directorySearchFormSchema,
  helperFormSchema,
  updateHelperSchema,
} from './schemas';
import { InvalidCursorError, RecordNotFoundError } from './errors';
import type { FormActionState, HelperDirectoryActionState } from './action-state';

function fieldErrors(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  return error.issues.reduce<Record<string, string[]>>((result, issue) => {
    const key = issue.path[0];
    if (typeof key === 'string') (result[key] ??= []).push(issue.message);
    return result;
  }, {});
}

export async function searchHelpersAction(
  previous: HelperDirectoryActionState,
  formData: FormData,
): Promise<HelperDirectoryActionState> {
  await requireMaintainer();
  const parsed = directorySearchFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { ...previous, message: 'Enter a valid search and try again.' };
  if (
    parsed.data.intent === 'more' &&
    (!parsed.data.cursorId || parsed.data.search !== previous.search)
  ) {
    return { ...previous, message: 'Search changed. Submit the search before loading more results.' };
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
      return { search: parsed.data.search, items: [], nextCursor: null, message: 'The directory changed. Search again.' };
    }
    throw error;
  }
}

export async function createHelperAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireMaintainer();
  const parsed = helperFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: 'Review the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };

  const input = createHelperSchema.safeParse(parsed.data);
  if (!input.success) return { message: 'Review the highlighted fields.', fieldErrors: fieldErrors(input.error) };
  const { helperId } = await createHelper(input.data);
  revalidatePath('/helpers');
  return { helperId };
}

export async function updateHelperAction(
  helperId: string,
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  await requireMaintainer();
  const parsed = helperFormSchema.safeParse(formFields(formData));
  if (!parsed.success) return { message: 'Review the highlighted fields.', fieldErrors: fieldErrors(parsed.error) };

  const input = updateHelperSchema.safeParse({ helperId, ...parsed.data });
  if (!input.success) return { message: 'Review the highlighted fields.', fieldErrors: fieldErrors(input.error) };
  try {
    await updateHelper(input.data);
  } catch (error) {
    if (error instanceof RecordNotFoundError) return { message: 'This helper profile no longer exists.' };
    throw error;
  }
  revalidatePath(`/helpers/${helperId}`);
  revalidatePath('/helpers');
  return { successToken: (previous.successToken ?? 0) + 1 };
}
