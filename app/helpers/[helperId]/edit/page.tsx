import Link from 'next/link';
import { notFound } from 'next/navigation';
import HelperForm from '@/features/helpers/helper-form';
import { getHelperFormData } from '@/features/helpers/service';

export const dynamic = 'force-dynamic';

export default async function EditHelperPage({
  params,
}: {
  params: Promise<{ helperId: string }>;
}) {
  const { helperId } = await params;
  const helper = await getHelperFormData(helperId);
  if (!helper) notFound();
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href={`/helpers/${helper.id}`}>Back to profile</Link>
      <h1 className="mt-5 text-3xl font-semibold">Edit helper profile</h1>
      <HelperForm helper={helper} />
    </main>
  );
}
