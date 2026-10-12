import Link from 'next/link';
import { listAuditEvents } from '@/features/audit/service';

export const dynamic = 'force-dynamic';

type AuditPageProps = {
  searchParams: Promise<{ after?: string | string[] }>;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  const page = await listAuditEvents({ afterId: params.after });

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <Link className="text-sm underline" href="/helpers">Back to helpers</Link>
      <header className="mt-5 border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-semibold">Audit log</h1>
        <p className="mt-1 text-sm text-gray-600">Recent account and helper-data activity.</p>
      </header>

      {page.items.length === 0 ? (
        <p className="mt-6 text-sm text-gray-600">No audit events have been recorded.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-gray-300 text-gray-600">
                <th className="px-3 py-2 font-medium">Time (UTC)</th>
                <th className="px-3 py-2 font-medium">Actor reference</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((event) => (
                <tr key={event.id} className="border-b border-gray-100 align-top">
                  <td className="whitespace-nowrap px-3 py-3">
                    {event.occurredAt.toISOString().replace('T', ' ').replace('Z', ' UTC')}
                  </td>
                  <td className="break-all px-3 py-3">{event.actorId ?? 'System'}</td>
                  <td className="px-3 py-3">{event.action}</td>
                  <td className="break-all px-3 py-3">
                    {event.targetType}
                    {event.targetId ? `: ${event.targetId}` : ''}
                  </td>
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
            Older events
          </Link>
        </nav>
      )}
    </main>
  );
}
