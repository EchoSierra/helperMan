'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { HelperDirectoryActionState } from './action-state';
import { searchHelpersAction } from './actions';

export default function HelperDirectory({ initial }: { initial: HelperDirectoryActionState }) {
  const t = useTranslations('helpers');
  const [state, formAction, pending] = useActionState(searchHelpersAction, initial);
  const [search, setSearch] = useState(initial.search);

  return (
    <div>
      <form action={formAction} className="my-6 flex flex-wrap items-end gap-3">
        <label className="flex-1 space-y-1">
          <span className="block text-sm font-medium">{t('directory.searchLabel')}</span>
          <input
            autoComplete="off"
            className="w-full rounded border border-gray-300 px-3 py-2"
            maxLength={100}
            name="search"
            onChange={(event) => setSearch(event.target.value)}
            value={search}
          />
        </label>
        <input name="cursorId" type="hidden" value={state.nextCursor ?? ''} />
        <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-50" disabled={pending} name="intent" type="submit" value="search">
          {t('directory.search')}
        </button>
        {state.nextCursor && (
          <button className="rounded border border-gray-400 px-4 py-2 disabled:opacity-50" disabled={pending} name="intent" type="submit" value="more">
            {pending ? t('directory.loading') : t('directory.loadMore')}
          </button>
        )}
      </form>
      {state.message && <p className="mb-4 text-sm text-red-700" role="alert">{state.message}</p>}
      {state.items.length === 0 ? (
        <p className="text-gray-600">{t('directory.noResults')}</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200">
          {state.items.map((helper) => (
            <li className="flex items-center justify-between gap-4 px-4 py-3" key={helper.id}>
              <Link className="font-medium underline" href={`/helpers/${helper.id}`}>
                {helper.firstName} {helper.lastName}
              </Link>
              {!helper.active && <span className="text-sm text-gray-600">{t('directory.inactive')}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
