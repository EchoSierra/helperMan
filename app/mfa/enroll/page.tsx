import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getAccessContext } from '@/lib/auth/guards';
import EnrollmentForm from './enrollment-form';

export default async function EnrollPage() {
  const t = await getTranslations('auth');
  const access = await getAccessContext();

  if (access.status === 'unauthenticated' || access.status === 'session-expired') {
    redirect('/sign-in');
  }
  if (access.status === 'granted') redirect('/');
  if (access.status !== 'mfa-enrollment-required') {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold">{t('mfaEnrollPage.unavailable.title')}</h1>
        <p className="mt-3 text-sm text-gray-700">
          {t('mfaEnrollPage.unavailable.body')}
        </p>
        <Link className="mt-6 underline" href="/sign-in">
          {t('mfaEnrollPage.unavailable.link')}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('mfaEnrollPage.title')}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {t('mfaEnrollPage.subtitle')}
      </p>
      <EnrollmentForm />
    </main>
  );
}
