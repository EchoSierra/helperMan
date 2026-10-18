import SignInForm from './sign-in-form';
import { getTranslations } from 'next-intl/server';

export default async function SignInPage() {
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('signInPage.title')}</h1>
      <p className="mt-2 text-sm text-gray-600">{t('signInPage.subtitle')}</p>
      <SignInForm />
    </main>
  );
}
