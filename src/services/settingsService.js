import { Settings } from '../models/Settings.js';
import { env } from '../config/env.js';

const EDITABLE = ['dailyLimit', 'sendWindow', 'followupAfterDays', 'maxFollowups', 'sender', 'bookingUrl'];

export async function getSettings() {
  const existing = await Settings.findOne({ key: 'global' });
  if (existing) return existing;
  try {
    return await Settings.create({
      key: 'global',
      sender: {
        fullName: env.senderFullName,
        companyName: env.mailFromName,
        email: env.mailReplyTo || env.mailFromAddress,
        phone: env.senderPhone,
        address: env.senderAddress,
      },
      bookingUrl: env.bookingUrl,
    });
  } catch (err) {
    if (err?.code === 11000) return Settings.findOne({ key: 'global' });
    throw err;
  }
}

export async function updateSettings(patch) {
  const settings = await getSettings();
  for (const key of EDITABLE) {
    if (patch[key] === undefined) continue;
    if (typeof patch[key] === 'object' && patch[key] !== null && !Array.isArray(patch[key])) {
      for (const [k, v] of Object.entries(patch[key])) settings.set(`${key}.${k}`, v);
    } else {
      settings.set(key, patch[key]);
    }
  }
  await settings.save();
  return settings;
}

// Footer'da kullanılacak gönderen bilgileri (ayar yoksa .env'den).
export function resolveSender(settings) {
  const s = settings?.sender ?? {};
  return {
    fullName: s.fullName || env.senderFullName,
    companyName: s.companyName || env.mailFromName,
    email: s.email || env.mailReplyTo || env.mailFromAddress,
    phone: s.phone || env.senderPhone,
    address: s.address || env.senderAddress,
  };
}

export function resolveBookingUrl(settings) {
  return settings?.bookingUrl || env.bookingUrl || '';
}
