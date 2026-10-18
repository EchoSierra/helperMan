import VerifyForm from './verify-form';
import { getTranslations } from 'next-intl/server';

export default async function VerifyPage() {
  const t = await getTranslations('auth');
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">{t('mfaVerifyPage.title')}</h1>
      <p className="mt-2 text-sm text-gray-600">{t('mfaVerifyPage.subtitle')}</p>
      <VerifyForm />
    </main>
  );
}
