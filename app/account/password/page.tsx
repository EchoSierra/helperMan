import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { requireSessionPage } from '@/lib/auth/page-guards';
import { changePasswordAction } from '@/features/accounts/self-actions';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/auth/policy';

export const dynamic = 'force-dynamic';

const ERROR_KEYS = {
  invalid: 'invalid',
  denied: 'denied',
} as const;

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const t = await getTranslations('auth');
  await requireSessionPage();
  const { error } = await searchParams;
  const errorKey = error ? ERROR_KEYS[error as keyof typeof ERROR_KEYS] : undefined;
  const errorMessage = errorKey
    ? t(`passwordPage.errors.${errorKey}`, { minPasswordLength: MIN_PASSWORD_LENGTH })
    : undefined;

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <Link className="text-sm underline" href="/">{t('passwordPage.back')}</Link>
      <h1 className="mt-5 text-3xl font-semibold">{t('passwordPage.title')}</h1>
      <p className="mt-2 text-sm text-gray-600">{t('passwordPage.subtitle')}</p>
      {errorMessage && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{errorMessage}</p>}
      <form action={changePasswordAction} className="mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('passwordPage.currentPassword')}</span>
          <input autoComplete="current-password" className="w-full rounded border border-gray-300 px-3 py-2" maxLength={MAX_PASSWORD_LENGTH} name="currentPassword" required type="password" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('passwordPage.code')}</span>
          <input autoComplete="one-time-code" className="w-full rounded border border-gray-300 px-3 py-2" inputMode="numeric" maxLength={6} name="code" pattern="[0-9]{6}" required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">{t('passwordPage.newPassword')}</span>
          <input autoComplete="new-password" className="w-full rounded border border-gray-300 px-3 py-2" maxLength={MAX_PASSWORD_LENGTH} minLength={MIN_PASSWORD_LENGTH} name="newPassword" required type="password" />
        </label>
        <button className="w-full rounded bg-black px-4 py-2 font-medium text-white" type="submit">{t('passwordPage.submit')}</button>
      </form>
    </main>
  );
}
