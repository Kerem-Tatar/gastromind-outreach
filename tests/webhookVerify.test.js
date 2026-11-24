import { describe, it, expect } from 'vitest';
import { verifySvixSignature, signPayload } from '../src/services/webhookVerify.js';

const secret = 'whsec_' + Buffer.from('another-secret-for-tests').toString('base64');
const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'abc' } });
const now = 1_800_000_000;

function headers(ts = now, payload = body, id = 'msg_1') {
  return { 'svix-id': id, 'svix-timestamp': String(ts), 'svix-signature': `v1,${signPayload(secret, id, ts, payload)}` };
}

describe('Svix webhook imzası', () => {
  it('geçerli imzayı kabul eder', () => {
    expect(verifySvixSignature({ secret, headers: headers(), rawBody: Buffer.from(body), nowSeconds: now })).toBe(true);
  });

  it('birden fazla imzadan biri doğruysa kabul eder', () => {
    const h = headers();
    h['svix-signature'] = `v1,yanlisimza ${h['svix-signature']}`;
    expect(verifySvixSignature({ secret, headers: h, rawBody: body, nowSeconds: now })).toBe(true);
  });

  it('gövdesi değiştirilmiş isteği reddeder', () => {
    const tampered = body.replace('delivered', 'opened');
    expect(verifySvixSignature({ secret, headers: headers(), rawBody: tampered, nowSeconds: now })).toBe(false);
  });

  it('yanlış secret ile imzalanmış isteği reddeder', () => {
    const other = 'whsec_' + Buffer.from('wrong').toString('base64');
    const h = { ...headers(), 'svix-signature': `v1,${signPayload(other, 'msg_1', now, body)}` };
    expect(verifySvixSignature({ secret, headers: h, rawBody: body, nowSeconds: now })).toBe(false);
  });

  it('eski zaman damgasını reddeder (replay koruması)', () => {
    const old = now - 10 * 60;
    expect(verifySvixSignature({ secret, headers: headers(old), rawBody: body, nowSeconds: now })).toBe(false);
  });

  it('eksik başlık veya secret yoksa reddeder', () => {
    const h = headers();
    delete h['svix-id'];
    expect(verifySvixSignature({ secret, headers: h, rawBody: body, nowSeconds: now })).toBe(false);
    expect(verifySvixSignature({ secret: '', headers: headers(), rawBody: body, nowSeconds: now })).toBe(false);
  });
});
