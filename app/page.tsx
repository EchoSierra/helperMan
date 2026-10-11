import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export default function Home({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Helper Manager - Project Initialized</h1>
      <p className="mt-4 text-lg">The environment is ready for development.</p>
    </main>
  );
}
