import Link from 'next/link';
import { requireSessionPage } from '@/lib/auth/page-guards';
import { changePasswordAction } from '@/features/accounts/self-actions';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from '@/lib/auth/policy';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  invalid: `Enter your current password, a valid authenticator code, and a different new password of at least ${MIN_PASSWORD_LENGTH} characters.`,
  denied: 'The current password or authenticator code is incorrect, or too many attempts were made. Try again later.',
};

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSessionPage();
  const { error } = await searchParams;
  const errorMessage = error ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto min-h-screen max-w-md px-6 py-10">
      <Link className="text-sm underline" href="/">Back</Link>
      <h1 className="mt-5 text-3xl font-semibold">Change password</h1>
      <p className="mt-2 text-sm text-gray-600">You will be signed out everywhere and must sign in again.</p>
      {errorMessage && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800" role="alert">{errorMessage}</p>}
      <form action={changePasswordAction} className="mt-6 space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Current password</span>
          <input autoComplete="current-password" className="w-full rounded border border-gray-300 px-3 py-2" maxLength={MAX_PASSWORD_LENGTH} name="currentPassword" required type="password" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Six-digit authenticator code</span>
          <input autoComplete="one-time-code" className="w-full rounded border border-gray-300 px-3 py-2" inputMode="numeric" maxLength={6} name="code" pattern="[0-9]{6}" required />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">New password</span>
          <input autoComplete="new-password" className="w-full rounded border border-gray-300 px-3 py-2" maxLength={MAX_PASSWORD_LENGTH} minLength={MIN_PASSWORD_LENGTH} name="newPassword" required type="password" />
        </label>
        <button className="w-full rounded bg-black px-4 py-2 font-medium text-white" type="submit">Change password</button>
      </form>
    </main>
  );
}
