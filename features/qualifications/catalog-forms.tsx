'use client';

import { useActionState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { QualificationDefinitionItem } from './catalog-service';
import {
  createQualificationDefinitionAction,
  updateQualificationDefinitionAction,
  type CatalogActionState,
} from './catalog-actions';

export function CreateQualificationDefinitionForm() {
  const t = useTranslations('qualifications');
  const [state, action, pending] = useActionState<CatalogActionState, FormData>(
    createQualificationDefinitionAction,
    {},
  );
  return (
    <form action={action} className="mt-4 grid max-w-2xl gap-3 rounded border border-gray-200 p-4 sm:grid-cols-[1fr_1fr_auto]" key={state.successToken ?? 0}>
      <label className="space-y-1">
        <span className="block text-sm font-medium">{t('catalog.create.name')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={200} name="name" required />
      </label>
      <label className="space-y-1">
        <span className="block text-sm font-medium">{t('catalog.create.category')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={100} name="category" />
      </label>
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('catalog.create.pending') : t('catalog.create.submit')}
      </button>
      {state.message && <p className="text-sm text-red-700 sm:col-span-3" role="alert">{state.message}</p>}
    </form>
  );
}

export function EditQualificationDefinitionForm({
  definition,
}: {
  definition: QualificationDefinitionItem;
}) {
  const t = useTranslations('qualifications');
  const action = useMemo(
    () => updateQualificationDefinitionAction.bind(null, definition.id),
    [definition.id],
  );
  const [state, formAction, pending] = useActionState<CatalogActionState, FormData>(action, {});
  return (
    <form action={formAction} className="grid gap-3 rounded border border-gray-200 p-4 sm:grid-cols-[1fr_1fr_9rem_auto] sm:items-end">
      <label className="space-y-1">
        <span className="block text-sm font-medium">{t('catalog.edit.name')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={definition.name} maxLength={200} name="name" required />
      </label>
      <label className="space-y-1">
        <span className="block text-sm font-medium">{t('catalog.edit.category')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={definition.category ?? ''} maxLength={100} name="category" />
      </label>
      <label className="space-y-1">
        <span className="block text-sm font-medium">{t('catalog.edit.status')}</span>
        <select className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={definition.retired ? 'true' : 'false'} name="retired">
          <option value="false">{t('catalog.edit.active')}</option>
          <option value="true">{t('catalog.edit.retired')}</option>
        </select>
      </label>
      <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('catalog.edit.pending') : t('catalog.edit.submit')}
      </button>
      {state.message && (
        <p className="text-sm sm:col-span-4" role={state.successToken ? 'status' : 'alert'}>{state.message}</p>
      )}
    </form>
  );
}
