// Backend köprüsü: tarayıcı /api/* ister, panel sunucusu isteği ADMIN_API_KEY ile backend'e iletir.
// Böylece API anahtarı tarayıcıya hiç gitmez.
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from '../../../lib/session.js';
import { isSameOrigin } from '../../../lib/security.js';
import { serverConfig } from '../../../lib/config.js';

export const dynamic = 'force-dynamic';

// Render'ın ücretsiz servisi uykudaysa ilk istek onu uyandırır (~1 dk sürebilir).
const TIMEOUT_MS = 70000;

function json(status, error) {
  return Response.json({ error }, { status });
}

async function forward(request, { params }) {
  const cfg = serverConfig();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySessionToken(token, cfg.sessionSecret)) return json(401, 'Oturum süresi doldu, tekrar giriş yapın.');
  if (request.method !== 'GET' && !isSameOrigin(request.headers.get('origin'), request.headers.get('host'))) {
    return json(403, 'Geçersiz istek kaynağı.');
  }
  if (!cfg.adminApiKey) return json(500, 'Panel yapılandırması eksik (ADMIN_API_KEY).');

  const { path } = await params;
  const target = `${cfg.backendUrl}/api/${path.map(encodeURIComponent).join('/')}${new URL(request.url).search}`;
  const headers = { 'x-api-key': cfg.adminApiKey };
  const contentType = request.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer();

  const attempt = () => fetch(target, { method: request.method, headers, body, signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
  let res;
  try {
    res = await attempt();
  } catch {
    // Sadece okuma isteklerinde bir kez yeniden dene (yazma isteği iki kez işlenmesin).
    if (request.method !== 'GET') return json(502, 'Sunucuya ulaşılamadı. Biraz sonra tekrar deneyin.');
    try {
      res = await attempt();
    } catch {
      return json(502, 'Sunucuya ulaşılamadı. Biraz sonra tekrar deneyin.');
    }
  }
  const outHeaders = new Headers();
  const resType = res.headers.get('content-type');
  if (resType) outHeaders.set('content-type', resType);
  outHeaders.set('cache-control', 'no-store');
  return new Response(res.status === 204 ? null : await res.arrayBuffer(), { status: res.status, headers: outHeaders });
}

export { forward as GET, forward as POST, forward as PATCH, forward as DELETE };
