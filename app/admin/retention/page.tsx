import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { setRetentionPolicyAction } from '@/features/retention/actions';
import { listRetentionPolicies } from '@/features/retention/service';
import { RETENTION_KINDS } from '@/lib/retention';

export const dynamic = 'force-dynamic';

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const t = await getTranslations('admin');
  const locale = await getLocale();
  const { status, error } = await searchParams;
  const policies = await listRetentionPolicies();
  const formatDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link className="text-sm underline" href="/">{t('retention.back')}</Link>
      <h1 className="mt-5 text-3xl font-semibold">{t('retention.title')}</h1>
      <p className="mt-2 text-sm text-gray-700">{t('retention.description')}</p>
      {status === 'saved' && <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-900" role="status">{t('retention.saved')}</p>}
      {error && (
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error === 'denied' ? t('retention.errors.denied') : t('retention.errors.invalid')}
        </p>
      )}
      {RETENTION_KINDS.map((kind) => {
        const policy = policies.find((item) => item.kind === kind);
        const title = t(`retention.kinds.${kind}.title`);
        return (
          <section className="mt-8" key={kind}>
            <h2 className="text-xl font-medium">{title}</h2>
            <p className="mt-1 text-sm text-gray-700">{t(`retention.kinds.${kind}.help`)}</p>
            <p className="mt-2 text-sm">
              {policy
                ? t('retention.approved', {
                    days: policy.periodDays,
                    reference: policy.decisionReference,
                    date: formatDate.format(policy.approvedAt),
                  })
                : t('retention.notApproved')}
            </p>
            <form action={setRetentionPolicyAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="kind" type="hidden" value={kind} />
              <label className="space-y-1 text-sm">
                <span className="block font-medium">{t('retention.form.periodLabel', { title })}</span>
                <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={policy?.periodDays} max={36500} min={1} name="periodDays" required type="number" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block font-medium">{t('retention.form.referenceLabel', { title })}</span>
                <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={policy?.decisionReference} maxLength={200} name="decisionReference" required />
                <span className="block text-xs text-gray-600">{t('retention.form.referenceHelp')}</span>
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input name="confirmApproved" required type="checkbox" />
                <span>{t('retention.form.confirm')}</span>
              </label>
              <div className="sm:col-span-2">
                <button className="rounded bg-black px-4 py-2 text-white" type="submit">{t('retention.form.submit', { title })}</button>
              </div>
            </form>
          </section>
        );
      })}
    </main>
  );
}
