'use client';

import { useActionState } from 'react';
import type { QualificationExpiryActionState } from '@/features/helpers/action-state';
import { loadMoreQualificationExpiriesAction } from './actions';

export default function QualificationExpiryReport({
  initial,
}: {
  initial: QualificationExpiryActionState;
}) {
  const [state, formAction, pending] = useActionState(loadMoreQualificationExpiriesAction, initial);

  return (
    <>
      <p className="mt-2 text-sm text-gray-600">
        Includes expired qualifications and those valid through {state.through} (UTC), for active and inactive helpers.
      </p>
      {state.message && <p className="mt-4 text-sm text-red-700" role="alert">{state.message}</p>}
      {state.items.length === 0 ? (
        <p className="mt-8 text-gray-600">No expired or soon-to-expire qualifications.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300">
                <th className="px-3 py-2" scope="col">Helper</th>
                <th className="px-3 py-2" scope="col">Qualification</th>
                <th className="px-3 py-2" scope="col">Valid through</th>
                <th className="px-3 py-2" scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.items.map((item, index) => (
                <tr className="border-b border-gray-200" key={`${item.helperId}-${item.qualificationTitle}-${item.validThrough}-${index}`}>
                  <td className="px-3 py-2">
                    <span className="block">{item.helperName}{!item.helperActive && <span className="ml-2 text-xs text-gray-600">(Inactive)</span>}</span>
                    <span className="text-xs text-gray-600">Reference {item.helperId}</span>
                  </td>
                  <td className="px-3 py-2">{item.qualificationTitle}</td>
                  <td className="px-3 py-2">{item.validThrough}</td>
                  <td className="px-3 py-2">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {state.nextCursor && (
        <form action={formAction} className="mt-6">
          <input name="afterId" type="hidden" value={state.nextCursor} />
          <input name="reportDate" type="hidden" value={state.today} />
          <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending} type="submit">
            {pending ? 'Loading…' : 'Load more'}
          </button>
        </form>
      )}
    </>
  );
}
