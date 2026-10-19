import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listHelpers } from '@/features/helpers/service';
import HelperDirectory from '@/features/helpers/helper-directory';

export const dynamic = 'force-dynamic';

export default async function HelpersPage() {
  const t = await getTranslations('helpers');
  const initial = await listHelpers({ search: '', cursorId: null });
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-semibold">{t('pages.index.title')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('pages.index.description')}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-3">
          <Link className="text-sm underline" href="/audit">{t('pages.index.auditLog')}</Link>
          <Link className="rounded bg-black px-4 py-2 text-white" href="/helpers/new">{t('pages.index.addHelper')}</Link>
        </nav>
      </header>
      <HelperDirectory initial={{ ...initial, search: '' }} />
      <Link className="mt-8 inline-block underline" href="/">{t('pages.index.backToWorkspace')}</Link>
    </main>
  );
}
