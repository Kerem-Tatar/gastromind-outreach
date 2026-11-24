// Svix (Standard Webhooks) imza doğrulaması — Resend webhook'ları bu formatı kullanır.
// İmza: base64(HMAC-SHA256(secret, `${id}.${timestamp}.${rawBody}`)), başlık: "v1,<imza> v1,<imza2>".
import crypto from 'node:crypto';

export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

function secretBytes(secret) {
  const raw = String(secret).startsWith('whsec_') ? secret.slice(6) : secret;
  return Buffer.from(raw, 'base64');
}

export function signPayload(secret, id, timestamp, rawBody) {
  return crypto.createHmac('sha256', secretBytes(secret)).update(`${id}.${timestamp}.${rawBody}`).digest('base64');
}

// Geçerliyse true. Eksik başlık, eski/ileri zaman damgası veya uyuşmayan imzada false.
export function verifySvixSignature({ secret, headers, rawBody, nowSeconds = Math.floor(Date.now() / 1000) }) {
  if (!secret) return false;
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatureHeader = headers['svix-signature'];
  if (!id || !timestamp || !signatureHeader) return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
  const expected = Buffer.from(signPayload(secret, id, timestamp, body));
  return String(signatureHeader)
    .split(' ')
    .map((part) => part.split(','))
    .filter(([version, sig]) => version === 'v1' && sig)
    .some(([, sig]) => {
      const candidate = Buffer.from(sig);
      return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
    });
}
