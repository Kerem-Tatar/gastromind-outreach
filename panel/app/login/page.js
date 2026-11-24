import LoginForm from './LoginForm.js';

export const metadata = { title: 'Giriş · Gastromind Outreach' };

export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand font-bold text-white">G</span>
          <div>
            <h1 className="text-lg font-semibold">Gastromind Outreach</h1>
            <p className="text-xs text-gray-500">Yönetim paneli</p>
          </div>
        </div>
        <LoginForm next={typeof next === 'string' ? next : '/'} />
      </div>
    </main>
  );
}
