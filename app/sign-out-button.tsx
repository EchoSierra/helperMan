'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth/client';

export default function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState(false);

  async function signOut() {
    setError(false);
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError(true);
        return;
      }
      router.replace('/sign-in');
    } catch {
      setError(true);
    }
  }

  return (
    <div className="text-right">
      <button className="rounded border border-gray-300 px-3 py-2 text-sm" onClick={signOut} type="button">
        Sign out
      </button>
      {error && <p className="mt-1 text-xs text-red-700" role="alert">Sign out failed. Try again.</p>}
    </div>
  );
}
