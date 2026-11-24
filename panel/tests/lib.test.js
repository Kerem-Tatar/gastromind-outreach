import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken, SESSION_TTL_SECONDS } from '../lib/session.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { safeNextPath, isSameOrigin } from '../lib/security.js';

const secret = 'x'.repeat(40);

test('oturum token: geçerli, değiştirilmiş, süresi dolmuş, yanlış secret', () => {
  const now = Date.now();
  const token = createSessionToken(secret, now);
  assert.equal(verifySessionToken(token, secret, now), true);
  assert.equal(verifySessionToken(token.slice(0, -2) + 'aa', secret, now), false);
  assert.equal(verifySessionToken(token.replace(/^\d+/, String(9999999999)), secret, now), false);
  assert.equal(verifySessionToken(token, secret, now + (SESSION_TTL_SECONDS + 1) * 1000), false);
  assert.equal(verifySessionToken(token, 'y'.repeat(40), now), false);
  assert.equal(verifySessionToken('', secret, now), false);
  assert.equal(verifySessionToken(token, '', now), false);
});

test('parola hash doğrulama', () => {
  const stored = hashPassword('cok-gizli-parola');
  assert.match(stored, /^scrypt:[\w-]+:[\w-]+$/);
  assert.ok(!stored.includes('$'));
  assert.equal(verifyPassword('cok-gizli-parola', stored), true);
  assert.equal(verifyPassword('yanlis-parola', stored), false);
  assert.equal(verifyPassword('cok-gizli-parola', ''), false);
  assert.equal(verifyPassword('cok-gizli-parola', 'bcrypt:abc:def'), false);
});

test('giriş sonrası yönlendirme sadece site içi', () => {
  assert.equal(safeNextPath('/queue?x=1'), '/queue?x=1');
  assert.equal(safeNextPath('//evil.com'), '/');
  assert.equal(safeNextPath('https://evil.com'), '/');
  assert.equal(safeNextPath('/\\evil.com'), '/');
  assert.equal(safeNextPath(undefined), '/');
});

test('CSRF: Origin kontrolü', () => {
  assert.equal(isSameOrigin('https://panel.example.com', 'panel.example.com'), true);
  assert.equal(isSameOrigin('https://evil.com', 'panel.example.com'), false);
  assert.equal(isSameOrigin(null, 'panel.example.com'), false);
  assert.equal(isSameOrigin('bozuk', 'panel.example.com'), false);
});
