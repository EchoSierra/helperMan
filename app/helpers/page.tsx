import Link from 'next/link';
import { listHelpers } from '@/features/helpers/service';
import HelperDirectory from '@/features/helpers/helper-directory';

export const dynamic = 'force-dynamic';

export default async function HelpersPage() {
  const initial = await listHelpers({ search: '', cursorId: null });
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-semibold">Helpers</h1>
          <p className="mt-1 text-sm text-gray-600">Search and manage helper profiles and qualifications.</p>
        </div>
        <nav className="flex flex-wrap items-center gap-3">
          <Link className="text-sm underline" href="/audit">Audit log</Link>
          <Link className="rounded bg-black px-4 py-2 text-white" href="/helpers/new">Add helper</Link>
        </nav>
      </header>
      <HelperDirectory initial={{ ...initial, search: '' }} />
      <Link className="mt-8 inline-block underline" href="/">Back to workspace</Link>
    </main>
  );
}
