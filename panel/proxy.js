// Oturum kontrolü: giriş yapılmamışsa sayfalar /login'e, API istekleri 401'e yönlenir.
import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './lib/session.js';
import { serverConfig } from './lib/config.js';

export function proxy(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (verifySessionToken(token, serverConfig().sessionSecret)) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Oturum süresi doldu, tekrar giriş yapın.' }, { status: 401 });
  }
  const url = new URL('/login', request.url);
  if (pathname !== '/') url.searchParams.set('next', pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
