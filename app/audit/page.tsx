import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { listAuditEvents } from '@/features/audit/service';

export const dynamic = 'force-dynamic';

type AuditPageProps = {
  searchParams: Promise<{ after?: string | string[] }>;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const t = await getTranslations('audit');
  const params = await searchParams;
  const page = await listAuditEvents({ afterId: params.after });
  const formatAction = (value: string) => (t.has(`actions.${value}`) ? t(`actions.${value}`) : value);
  const formatTargetType = (value: string) => (t.has(`targetTypes.${value}`) ? t(`targetTypes.${value}`) : value);
  const formatValue = (value: string | null) => {
    if (value === null) return t('table.emptyValue');
    if (t.has(`status.${value}`)) return t(`status.${value}`);
    if (t.has(`equipmentStatus.${value}`)) return t(`equipmentStatus.${value}`);
    return value;
  };

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <Link className="text-sm underline" href="/helpers">{t('page.back')}</Link>
      <header className="mt-5 border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-semibold">{t('page.title')}</h1>
        <p className="mt-1 text-sm text-gray-600">{t('page.description')}</p>
      </header>

      {page.items.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600">{t('page.empty')}</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-gray-600">
                <th className="px-3 py-2 font-medium">{t('table.time')}</th>
                <th className="px-3 py-2 font-medium">{t('table.actor')}</th>
                <th className="px-3 py-2 font-medium">{t('table.action')}</th>
                <th className="px-3 py-2 font-medium">{t('table.target')}</th>
                <th className="px-3 py-2 font-medium">{t('table.oldValue')}</th>
                <th className="px-3 py-2 font-medium">{t('table.newValue')}</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((event) => (
                <tr key={event.id} className="border-b border-gray-100 align-top">
                  <td className="whitespace-nowrap px-3 py-3">
                    {event.occurredAt.toISOString().replace('T', ' ').replace('Z', ' UTC')}
                  </td>
                  <td className="break-all px-3 py-3">{event.actorId ? (event.actorName ?? event.actorId) : t('table.systemActor')}</td>
                  <td className="px-3 py-3">{formatAction(event.action)}</td>
                  <td className="break-all px-3 py-3">
                    {formatTargetType(event.targetType)}
                    {event.targetId ? `: ${event.targetName ?? event.targetId}` : ''}
                  </td>
                  <td className="px-3 py-3">{formatValue(event.oldValue)}</td>
                  <td className="px-3 py-3">{formatValue(event.newValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page.nextCursor && (
        <nav aria-label="Audit log pagination" className="mt-6">
          <Link
            className="rounded border border-gray-300 px-4 py-2 text-sm underline"
            href={`/audit?after=${encodeURIComponent(page.nextCursor)}`}
          >
            {t('page.older')}
          </Link>
        </nav>
      )}
    </main>
  );
}
