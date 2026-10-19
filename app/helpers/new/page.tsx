import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listOrganizationOptions } from '@/features/organizations/service';
import HelperForm from '@/features/helpers/helper-form';

export const dynamic = 'force-dynamic';

export default async function NewHelperPage() {
  const t = await getTranslations('helpers');
  const organizations = await listOrganizationOptions(null);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/helpers">{t('pages.new.back')}</Link>
      <h1 className="mt-5 text-3xl font-semibold">{t('pages.new.title')}</h1>
      <HelperForm organizations={organizations} />
    </main>
  );
}
