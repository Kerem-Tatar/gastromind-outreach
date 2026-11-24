import { AppError } from '../services/errors.js';
import { logger } from '../config/logger.js';

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Bulunamadı.' });
}

// Kullanıcıya iç detay sızdırılmaz; beklenmeyen hatalar genel bir mesajla döner.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) return res.status(err.status).json({ error: err.message, code: err.code });
  if (err?.name === 'ValidationError') {
    const details = Object.values(err.errors ?? {}).map((e) => e.message);
    return res.status(400).json({ error: details.join(' ') || 'Geçersiz veri.', code: 'validation_error' });
  }
  if (err?.name === 'CastError') return res.status(400).json({ error: 'Geçersiz değer.', code: 'invalid_value' });
  if (err?.code === 11000) return res.status(409).json({ error: 'Bu kayıt zaten mevcut.', code: 'duplicate' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'Geçersiz JSON.', code: 'invalid_json' });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'İstek çok büyük.', code: 'too_large' });
  logger.error('Beklenmeyen hata', req.method, req.path, err);
  return res.status(500).json({ error: 'Beklenmeyen bir hata oluştu.', code: 'internal_error' });
}
