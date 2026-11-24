'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyPassword } from '../../lib/password.js';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '../../lib/session.js';
import { safeNextPath } from '../../lib/security.js';
import { serverConfig } from '../../lib/config.js';

export async function login(prevState, formData) {
  const cfg = serverConfig();
  if (!cfg.passwordHash || cfg.sessionSecret.length < 32) {
    return { error: 'Panel yapılandırması eksik (PANEL_PASSWORD_HASH / SESSION_SECRET).' };
  }
  const ok = verifyPassword(formData.get('password'), cfg.passwordHash);
  if (!ok) {
    // Kaba kuvvet denemelerini yavaşlat.
    await new Promise((r) => setTimeout(r, 1000));
    return { error: 'Parola hatalı.' };
  }
  (await cookies()).set(SESSION_COOKIE, createSessionToken(cfg.sessionSecret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(safeNextPath(formData.get('next')));
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
