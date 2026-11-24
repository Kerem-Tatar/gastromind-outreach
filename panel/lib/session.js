// İmzalı oturum token'ı (HMAC-SHA256). Biçim: <bitiş-zamanı>.<nonce>.<imza>
// httpOnly cookie'de saklanır; içinde kullanıcı bilgisi yoktur (tek kullanıcı).
import crypto from 'node:crypto';

export const SESSION_COOKIE = 'gm_session';
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSessionToken(secret, nowMs = Date.now()) {
  if (!secret) throw new Error('SESSION_SECRET tanımlı değil');
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `${exp}.${crypto.randomBytes(16).toString('base64url')}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token, secret, nowMs = Date.now()) {
  if (!token || !secret) return false;
  const parts = String(token).split('.');
  if (parts.length !== 3) return false;
  const [exp, nonce, sig] = parts;
  const expected = Buffer.from(sign(`${exp}.${nonce}`, secret));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return false;
  return Number(exp) > Math.floor(nowMs / 1000);
}
