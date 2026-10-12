import Link from 'next/link';
import QualificationExpiryReport from '@/features/reports/qualification-expiry-report';
import { listQualificationExpiries } from '@/features/qualifications/service';

export const dynamic = 'force-dynamic';

export default async function QualificationExpiryPage() {
  const initial = await listQualificationExpiries({ afterId: null });
  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-10">
      <Link className="text-sm underline" href="/helpers">Back to helpers</Link>
      <h1 className="mt-5 text-3xl font-semibold">Qualification expiry</h1>
      <QualificationExpiryReport initial={initial} />
    </main>
  );
}
