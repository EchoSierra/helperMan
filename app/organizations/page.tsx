import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listOrganizations } from '@/features/organizations/service';
import { CreateOrganizationForm, EditOrganizationForm } from '@/features/organizations/organization-forms';

export const dynamic = 'force-dynamic';

export default async function OrganizationsPage() {
  const t = await getTranslations('organizations');
  const organizations = await listOrganizations();
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/">{t('page.backToWorkspace')}</Link>
      <h1 className="mt-5 text-3xl font-semibold">{t('page.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">
        {t('page.description')}
      </p>
      <CreateOrganizationForm />
      <section aria-label={t('page.listAriaLabel')} className="mt-8 space-y-3">
        {organizations.length === 0 ? (
          <p className="text-gray-600">{t('page.empty')}</p>
        ) : (
          organizations.map((organization) => (
            <EditOrganizationForm key={organization.id} organization={organization} />
          ))
        )}
      </section>
    </main>
  );
}
