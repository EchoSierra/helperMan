import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import HelperForm from '@/features/helpers/helper-form';
import { listOrganizationOptions } from '@/features/organizations/service';
import { getHelperFormData } from '@/features/helpers/service';

export const dynamic = 'force-dynamic';

export default async function EditHelperPage({
  params,
}: {
  params: Promise<{ helperId: string }>;
}) {
  const t = await getTranslations('helpers');
  const { helperId } = await params;
  const helper = await getHelperFormData(helperId);
  if (!helper) notFound();
  const organizations = await listOrganizationOptions(helper.organizationId);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href={`/helpers/${helper.id}`}>{t('pages.edit.back')}</Link>
      <h1 className="mt-5 text-3xl font-semibold">{t('pages.edit.title')}</h1>
      <HelperForm helper={helper} organizations={organizations} />
    </main>
  );
}
