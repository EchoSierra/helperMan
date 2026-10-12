import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAccessContext } from '@/lib/auth/guards';
import EnrollmentForm from './enrollment-form';

export default async function EnrollPage() {
  const access = await getAccessContext();

  if (access.status === 'unauthenticated' || access.status === 'session-expired') {
    redirect('/sign-in');
  }
  if (access.status === 'granted') redirect('/');
  if (access.status !== 'mfa-enrollment-required') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold">Account unavailable</h1>
        <p className="mt-3 text-sm text-gray-700">
          This account cannot enroll in multi-factor authentication. Contact an administrator.
        </p>
        <Link className="mt-6 underline" href="/sign-in">
          Return to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">Set up your authenticator</h1>
      <p className="mt-2 text-sm text-gray-600">
        Multi-factor authentication is required before you can access Helper Manager.
      </p>
      <EnrollmentForm />
    </main>
  );
}
