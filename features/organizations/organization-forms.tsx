'use client';

import { useActionState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { createOrganizationAction, updateOrganizationAction, type OrganizationActionState } from './actions';
import type { OrganizationItem } from './service';

export function CreateOrganizationForm() {
  const t = useTranslations('organizations');
  const [state, action, pending] = useActionState<OrganizationActionState, FormData>(createOrganizationAction, {});
  return (
    <form action={action} className="mt-4 flex max-w-xl flex-wrap items-end gap-3" key={state.successToken ?? 0}>
      <label className="block flex-1 space-y-1">
        <span className="text-sm font-medium">{t('create.name')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" maxLength={200} name="name" required />
      </label>
      <button className="rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('create.pending') : t('create.submit')}
      </button>
      {state.message && <p className="w-full text-sm text-red-700" role="alert">{state.message}</p>}
    </form>
  );
}

export function EditOrganizationForm({ organization }: { organization: OrganizationItem }) {
  const t = useTranslations('organizations');
  const action = useMemo(() => updateOrganizationAction.bind(null, organization.id), [organization.id]);
  const [state, formAction, pending] = useActionState<OrganizationActionState, FormData>(action, {});
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded border border-gray-200 p-4">
      <label className="block flex-1 space-y-1">
        <span className="text-sm font-medium">{t('edit.name')}</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={organization.name} maxLength={200} name="name" required />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t('edit.status')}</span>
        <select className="rounded border border-gray-300 px-3 py-2" defaultValue={organization.active ? 'true' : 'false'} name="active">
          <option value="true">{t('edit.active')}</option>
          <option value="false">{t('edit.retired')}</option>
        </select>
      </label>
      <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending} type="submit">
        {pending ? t('edit.pending') : t('edit.submit')}
      </button>
      {state.message && (
        <p className="w-full text-sm" role={state.successToken ? 'status' : 'alert'}>{state.message}</p>
      )}
    </form>
  );
}
