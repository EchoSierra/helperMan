'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { LOCALES } from './config';
import { setLocaleAction } from './locale-actions';

export function LocaleSwitcher() {
  const t = useTranslations('common');
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span>{t('language')}</span>
      <select
        className="rounded border border-gray-300 px-2 py-1"
        disabled={pending}
        onChange={(event) => startTransition(() => setLocaleAction(event.target.value))}
        value={locale}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>{t(`locales.${code}`)}</option>
        ))}
      </select>
    </label>
  );
}
