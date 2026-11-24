// Resend webhook'u: ham gövde + Svix imza doğrulaması.
import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifySvixSignature } from '../services/webhookVerify.js';
import { handleResendEvent } from '../services/webhookService.js';
import { env } from '../config/env.js';

export function webhooksRouter() {
  const r = express.Router();

  r.post('/resend', express.raw({ type: '*/*', limit: '256kb' }), asyncHandler(async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
    const valid = verifySvixSignature({ secret: env.resendWebhookSecret, headers: req.headers, rawBody });
    if (!valid) return res.status(401).json({ error: 'Geçersiz imza.' });
    let event;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Geçersiz JSON.' });
    }
    const result = await handleResendEvent(event);
    return res.json({ ok: true, ...result });
  }));

  return r;
}
