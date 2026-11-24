'use client';

import { useActionState } from 'react';
import { login } from './actions.js';

export default function LoginForm({ next }) {
  const [state, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? '/'} />
      <div>
        <label className="label" htmlFor="password">Parola</label>
        <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" className="input" />
      </div>
      {state?.error && <p className="rounded-md bg-accent-light px-3 py-2 text-sm text-accent">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary w-full py-2">{pending ? 'Giriş yapılıyor…' : 'Giriş yap'}</button>
    </form>
  );
}
