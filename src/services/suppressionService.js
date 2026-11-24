// Ret listesi (Kural 2). Kayıtlar silinmez; API'de silme işlemi yoktur.
import { Suppression } from '../models/Suppression.js';
import { SUPPRESSION_REASONS } from '../config/constants.js';
import { badRequest } from './errors.js';

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export async function isSuppressed(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;
  return Boolean(await Suppression.exists({ email: normalized }));
}

// Zaten varsa mevcut kaydı korur (ilk sebep kalır).
export async function addSuppression(email, reason, note = '') {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw badRequest('Geçersiz e-posta adresi.');
  if (!SUPPRESSION_REASONS.includes(reason)) throw badRequest('Geçersiz ret sebebi.');
  const result = await Suppression.findOneAndUpdate(
    { email: normalized },
    { $setOnInsert: { email: normalized, reason, note } },
    { upsert: true, new: true, includeResultMetadata: true },
  );
  return { suppression: result.value, created: !result.lastErrorObject?.updatedExisting };
}

export async function listSuppressions({ q, reason, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (reason) filter.reason = reason;
  if (q) filter.email = { $regex: escapeRegex(normalizeEmail(q)) };
  const items = await Suppression.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit);
  const total = await Suppression.countDocuments(filter);
  return { items, total, page, limit };
}

export function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
