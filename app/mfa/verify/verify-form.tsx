'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth/client';

export default function VerifyForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) {
        setError(t('mfaVerifyForm.errors.invalid'));
      } else {
        router.replace('/');
      }
    } catch {
      setError(t('mfaVerifyForm.errors.failed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <label className="block space-y-1">
        <span className="text-sm font-medium">{t('mfaVerifyForm.code')}</span>
        <input
          autoComplete="one-time-code"
          className="w-full rounded border border-gray-300 px-3 py-2"
          inputMode="numeric"
          maxLength={6}
          onChange={(event) => setCode(event.target.value)}
          pattern="[0-9]{6}"
          required
          value={code}
        />
      </label>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button
        className="w-full rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? t('mfaVerifyForm.pending') : t('mfaVerifyForm.submit')}
      </button>
    </form>
  );
}
