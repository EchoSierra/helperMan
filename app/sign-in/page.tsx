import SignInForm from './sign-in-form';

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">Sign in to Helper Manager</h1>
      <p className="mt-2 text-sm text-gray-600">Use your administrator-provided account.</p>
      <SignInForm />
    </main>
  );
}
