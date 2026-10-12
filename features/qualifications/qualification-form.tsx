'use client';

import { useActionState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { FormActionState } from '@/features/helpers/action-state';
import { saveQualificationAction } from './actions';

type Qualification = { id: string; title: string; validThrough: string | null };

export default function QualificationForm({
  helperId,
  qualification,
}: {
  helperId: string;
  qualification?: Qualification;
}) {
  const router = useRouter();
  const action = useMemo(
    () => saveQualificationAction.bind(null, helperId, qualification?.id ?? null),
    [helperId, qualification?.id],
  );
  const [state, formAction, pending] = useActionState<FormActionState, FormData>(action, {});

  useEffect(() => {
    if (state.successToken) router.refresh();
  }, [router, state.successToken]);

  return (
    <form action={formAction} className="mt-4 grid gap-3 rounded border border-gray-200 p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end" key={state.successToken ?? 'initial'}>
      <label className="space-y-1">
        <span className="block text-sm font-medium">Qualification title</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={qualification?.title ?? ''} maxLength={200} name="title" required />
        {state.fieldErrors?.title?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
      </label>
      <label className="space-y-1">
        <span className="block text-sm font-medium">Valid through (optional)</span>
        <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={qualification?.validThrough ?? ''} name="validThrough" type="date" />
        {state.fieldErrors?.validThrough?.map((message) => <span className="block text-sm text-red-700" key={message}>{message}</span>)}
      </label>
      <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={pending} type="submit">
        {pending ? 'Saving…' : qualification ? 'Save' : 'Add qualification'}
      </button>
      {state.message && <p className="text-sm text-red-700 sm:col-span-3" role="alert">{state.message}</p>}
    </form>
  );
}
