import crypto from 'node:crypto';
import { env } from '../config/env.js';

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Admin API koruması: x-api-key başlığı ADMIN_API_KEY ile eşleşmeli.
export function requireApiKey(req, res, next) {
  const expected = env.adminApiKey;
  if (!expected) return res.status(503).json({ error: 'Admin API yapılandırılmamış.' });
  const provided = req.get('x-api-key');
  if (!provided || !safeEqual(provided, expected)) return res.status(401).json({ error: 'Yetkisiz istek.' });
  return next();
}
