import Link from 'next/link';
import HelperForm from '@/features/helpers/helper-form';

export const dynamic = 'force-dynamic';

export default function NewHelperPage() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/helpers">Back to helpers</Link>
      <h1 className="mt-5 text-3xl font-semibold">Add helper</h1>
      <HelperForm />
    </main>
  );
}
