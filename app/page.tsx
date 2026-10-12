import Link from 'next/link';
import { redirect } from 'next/navigation';
import SignOutButton from './sign-out-button';
import { getAccessContext } from '@/lib/auth/guards';
import { canAccessHelperData } from '@/lib/auth/policy';

export default async function Home() {
  const access = await getAccessContext();
  if (access.status === 'unauthenticated' || access.status === 'session-expired') redirect('/sign-in');
  if (access.status === 'mfa-enrollment-required') redirect('/mfa/enroll');

  if (access.status !== 'granted') {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6">
        <h1 className="text-3xl font-semibold">Account unavailable</h1>
        <p className="mt-3 text-gray-700">Contact an administrator to restore access.</p>
        <Link className="mt-6 underline" href="/sign-in">Return to sign in</Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-10">
      <header className="flex items-center justify-between border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-3xl font-semibold">Helper Manager</h1>
          <p className="mt-1 text-sm text-gray-600">Secure workspace</p>
        </div>
        <SignOutButton />
      </header>
      <section className="py-12">
        <h2 className="text-xl font-medium">Your account is protected</h2>
        {canAccessHelperData(access) ? (
          <nav aria-label="Maintainer workspace" className="mt-6 flex flex-wrap gap-3">
            <Link className="rounded bg-black px-4 py-2 text-white" href="/helpers">Helper directory</Link>
            <Link className="rounded border border-gray-400 px-4 py-2" href="/reports/qualification-expiry">Qualification expiry</Link>
          </nav>
        ) : (
          <p className="mt-3 max-w-2xl text-gray-700">
            Sign-in, multi-factor authentication, session expiry, and role checks are active. Helper data requires the Maintainer role.
          </p>
        )}
      </section>
    </main>
  );
}
