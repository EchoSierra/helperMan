import Link from 'next/link';
import { notFound } from 'next/navigation';
import HelperForm from '@/features/helpers/helper-form';
import QualificationForm from '@/features/qualifications/qualification-form';
import { getHelperProfile } from '@/features/helpers/service';

export const dynamic = 'force-dynamic';

export default async function HelperProfilePage({
  params,
}: {
  params: Promise<{ helperId: string }>;
}) {
  const { helperId } = await params;
  const helper = await getHelperProfile(helperId);
  if (!helper) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10">
      <Link className="text-sm underline" href="/helpers">Back to helpers</Link>
      <header className="mt-5 flex flex-wrap items-start justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-semibold">{helper.firstName} {helper.lastName}</h1>
          <p className="mt-2 text-sm text-gray-600">
            {helper.active ? 'Active helper' : 'Inactive helper'} · Reference {helper.id}
          </p>
        </div>
        <Link className="rounded border border-gray-400 px-4 py-2" href={`/helpers/${helper.id}/edit`}>Edit profile</Link>
      </header>

      <section aria-labelledby="profile-heading" className="py-8">
        <h2 className="text-xl font-semibold" id="profile-heading">Profile</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-sm text-gray-600">Email</dt><dd>{helper.email ?? 'Not provided'}</dd></div>
          <div><dt className="text-sm text-gray-600">Phone</dt><dd>{helper.phone ?? 'Not provided'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-sm text-gray-600">Address</dt><dd className="whitespace-pre-wrap">{helper.address ?? 'Not provided'}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="qualifications-heading" className="border-t border-gray-200 py-8">
        <h2 className="text-xl font-semibold" id="qualifications-heading">Qualifications</h2>
        {helper.qualifications.length === 0 ? (
          <p className="mt-3 text-gray-600">No qualifications recorded.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {helper.qualifications.map((qualification) => (
              <div className="rounded border border-gray-200 p-4" key={qualification.id}>
                <p className="text-sm text-gray-600">Record {qualification.id}</p>
                <QualificationForm helperId={helper.id} qualification={qualification} />
              </div>
            ))}
          </div>
        )}
        <QualificationForm helperId={helper.id} />
      </section>
      <Link className="inline-block underline" href="/reports/qualification-expiry">Qualification expiry report</Link>
    </main>
  );
}
