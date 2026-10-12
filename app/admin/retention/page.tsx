import Link from 'next/link';
import { setRetentionPolicyAction } from '@/features/retention/actions';
import { listRetentionPolicies } from '@/features/retention/service';
import { RETENTION_KINDS, type RetentionKind } from '@/lib/retention';

export const dynamic = 'force-dynamic';

const LABELS: Record<RetentionKind, { title: string; help: string }> = {
  INACTIVE_HELPER: {
    title: 'Inactive helper records',
    help: 'Days after a helper becomes inactive before the helper and their qualifications are permanently deleted.',
  },
  AUDIT_LOG: {
    title: 'Audit log',
    help: 'Days after which audit events are permanently deleted.',
  },
};

export default async function RetentionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;
  const policies = await listRetentionPolicies();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-10">
      <Link className="text-sm underline" href="/">Back</Link>
      <h1 className="mt-5 text-3xl font-semibold">Retention schedules</h1>
      <p className="mt-2 text-sm text-gray-700">
        Record the schedules the organization has formally approved. There are no defaults: until a schedule is approved,
        nothing is deleted and production use stays blocked. Data is only deleted when an operator runs the retention job.
      </p>
      {status === 'saved' && <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-900" role="status">Schedule saved.</p>}
      {error && (
        <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error === 'denied' ? 'That action is not permitted for this account.' : 'The input was not valid. Check the fields and try again.'}
        </p>
      )}
      {RETENTION_KINDS.map((kind) => {
        const policy = policies.find((item) => item.kind === kind);
        return (
          <section className="mt-8" key={kind}>
            <h2 className="text-xl font-medium">{LABELS[kind].title}</h2>
            <p className="mt-1 text-sm text-gray-700">{LABELS[kind].help}</p>
            <p className="mt-2 text-sm">
              {policy
                ? `Approved: ${policy.periodDays} days · decision ${policy.decisionReference} · recorded ${policy.approvedAt.toISOString().slice(0, 10)}`
                : 'Not approved yet.'}
            </p>
            <form action={setRetentionPolicyAction} className="mt-3 grid gap-3 sm:grid-cols-2">
              <input name="kind" type="hidden" value={kind} />
              <label className="space-y-1 text-sm">
                <span className="block font-medium">Period (days) for {LABELS[kind].title}</span>
                <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={policy?.periodDays} max={36500} min={1} name="periodDays" required type="number" />
              </label>
              <label className="space-y-1 text-sm">
                <span className="block font-medium">Decision reference for {LABELS[kind].title}</span>
                <input className="w-full rounded border border-gray-300 px-3 py-2" defaultValue={policy?.decisionReference} maxLength={200} name="decisionReference" required />
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input name="confirmApproved" required type="checkbox" />
                <span>The organization has formally approved this schedule.</span>
              </label>
              <div className="sm:col-span-2">
                <button className="rounded bg-black px-4 py-2 text-white" type="submit">Save {LABELS[kind].title} schedule</button>
              </div>
            </form>
          </section>
        );
      })}
    </main>
  );
}
