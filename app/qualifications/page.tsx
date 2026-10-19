import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  CreateQualificationDefinitionForm,
  EditQualificationDefinitionForm,
} from '@/features/qualifications/catalog-forms';
import { listQualificationDefinitions } from '@/features/qualifications/catalog-service';

export const dynamic = 'force-dynamic';

export default async function QualificationsPage() {
  const t = await getTranslations('qualifications');
  const definitions = await listQualificationDefinitions();
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/">{t('page.backToWorkspace')}</Link>
      <h1 className="mt-5 text-3xl font-semibold">{t('page.title')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">
        {t('page.description')}
      </p>
      <CreateQualificationDefinitionForm />
      <section aria-label={t('page.listAriaLabel')} className="mt-8 space-y-3">
        {definitions.length === 0 ? (
          <p className="text-gray-600">{t('page.empty')}</p>
        ) : (
          definitions.map((definition) => (
            <EditQualificationDefinitionForm definition={definition} key={definition.id} />
          ))
        )}
      </section>
    </main>
  );
}
