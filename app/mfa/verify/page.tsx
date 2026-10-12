import VerifyForm from './verify-form';

export default function VerifyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">Verify your sign-in</h1>
      <p className="mt-2 text-sm text-gray-600">Enter the current code from your authenticator app.</p>
      <VerifyForm />
    </main>
  );
}
