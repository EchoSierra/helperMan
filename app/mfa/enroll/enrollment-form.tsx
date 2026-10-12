'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

function getTotpSecret(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get('secret');
  } catch {
    return null;
  }
}

export default function EnrollmentForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.enable({ password, method: 'totp' });
      const data = result.data;
      if (result.error || !data || data.method !== 'totp') {
        setError('Unable to start authenticator setup. Sign in again or contact an administrator.');
        return;
      }
      setTotpUri(data.totpURI);
      setPassword('');
    } catch {
      setError('Unable to start authenticator setup. Sign in again or contact an administrator.');
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await authClient.twoFactor.verifyTotp({ code, trustDevice: false });
      if (result.error) {
        setError('That authenticator code could not be verified. Try the current code again.');
      } else {
        router.replace('/');
      }
    } catch {
      setError('Authenticator setup could not be completed. Sign in again or contact an administrator.');
    } finally {
      setPending(false);
    }
  }

  if (totpUri) {
    const secret = getTotpSecret(totpUri);
    return (
      <form className="mt-8 space-y-5" onSubmit={verify}>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>Open an authenticator app and add a time-based account.</li>
          <li>Enter this setup key manually. Keep it private and do not send it to anyone.</li>
        </ol>
        {secret ? (
          <code className="block break-all rounded bg-gray-100 p-3 text-sm" aria-label="Authenticator setup key">
            {secret}
          </code>
        ) : (
          <p className="text-sm text-red-700" role="alert">
            The setup key could not be displayed. Start enrollment again.
          </p>
        )}
        <label className="block space-y-1">
          <span className="text-sm font-medium">Six-digit authenticator code</span>
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
          disabled={pending || !secret}
          type="submit"
        >
          {pending ? 'Verifying…' : 'Verify and finish setup'}
        </button>
      </form>
    );
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={begin}>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Confirm your password</span>
        <input
          autoComplete="current-password"
          className="w-full rounded border border-gray-300 px-3 py-2"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
      <button
        className="w-full rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Preparing…' : 'Start TOTP setup'}
      </button>
    </form>
  );
}
