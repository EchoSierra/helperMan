'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export default function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email, password, rememberMe: false });
      if (result.error) {
        setError('Sign-in failed. Check your credentials or contact an administrator.');
      } else if (result.data && 'twoFactorRedirect' in result.data && result.data.twoFactorRedirect) {
        router.replace('/mfa/verify');
      } else {
        router.replace('/mfa/enroll');
      }
    } catch {
      setError('Sign-in failed. Check your credentials or contact an administrator.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-8 space-y-5" onSubmit={submit}>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Email</span>
        <input
          autoComplete="username"
          className="w-full rounded border border-gray-300 px-3 py-2"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Password</span>
        <input
          autoComplete="current-password"
          className="w-full rounded border border-gray-300 px-3 py-2"
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>
      {error && (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <button
        className="w-full rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
