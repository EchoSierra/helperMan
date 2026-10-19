'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { FormActionState } from '@/features/helpers/action-state';
import { removeQualificationAction, saveQualificationAction } from './actions';
import type { QualificationDefinitionItem } from './catalog-service';

type Qualification = { id: string; definitionId: string; title: string; validThrough: string | null };

export default function QualificationForm({
  helperId,
  qualification,
  definitions,
}: {
  helperId: string;
  qualification?: Qualification;
  definitions: QualificationDefinitionItem[];
}) {
  const t = useTranslations('qualifications');
  const router = useRouter();
  const action = useMemo(
    () => saveQualificationAction.bind(null, helperId, qualification?.id ?? null),
    [helperId, qualification?.id],
  );
  const removeAction = useMemo(
    () => removeQualificationAction.bind(null, helperId, qualification?.id ?? ''),
    [helperId, qualification?.id],
  );
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(action, {});
  const [removeState, removeFormAction, removePending] = useActionState<FormActionState, FormData>(removeAction, {});

  useEffect(() => {
    if (state.successToken) router.refresh();
  }, [router, state.successToken]);

  useEffect(() => {
    if (removeState.successToken) router.refresh();
  }, [router, removeState.successToken]);

  return (
    <div className="mt-4 rounded border border-gray-200 p-4">
      <form action={formAction} className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end" key={state.successToken ?? 'initial'}>
        {qualification ? (
          <div className="space-y-1">
            <span className="block text-sm font-medium">{t('form.qualification')}</span>
            <p className="py-2">{qualification.title}</p>
          </div>
        ) : (
          <label className="space-y-1">
            <span className="block text-sm font-medium">{t('form.qualification')}</span>
            <select className="w-full rounded border border-gray-300 px-3 py-2" defaultValue="" name="definitionId" required>
              <option disabled value="">{t('form.selectQualification')}</option>
              {definitions.map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.name}
                  {definition.category ? ` — ${definition.category}` : ''}
                  {definition.retired ? ` (${t('form.retired')})` : ''}
                </option>
              ))}
            </select>
            {state.fieldErrors?.definitionId?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
          </label>
        )}
        <label className="space-y-1">
          <span className="block text-sm font-medium">{t('form.validThrough')}</span>
          <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={qualification?.validThrough ?? ''} name="validThrough" type="date" />
          {state.fieldErrors?.validThrough?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
        </label>
        <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={pending} type="submit">
          {pending ? t('form.pending') : qualification ? t('form.save') : t('form.add')}
        </button>
        {state.message && <p className="text-sm text-red-700 sm:col-span-3" role="alert">{state.message}</p>}
      </form>
      {qualification && (
        <form action={removeFormAction} className="mt-3 border-t border-gray-200 pt-3">
          <button className="rounded border border-red-700 px-3 py-2 text-sm text-red-700 disabled:opacity-50" disabled={removePending} type="submit">
            {removePending ? t('form.removing') : t('form.remove')}
          </button>
          {removeState.message && <p className="mt-2 text-sm text-red-700" role="alert">{removeState.message}</p>}
        </form>
      )}
    </div>
  );
}
