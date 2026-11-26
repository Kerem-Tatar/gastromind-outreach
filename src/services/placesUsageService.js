// Aylık Google Places çağrı sayacı ve üst sınır (maliyet koruması).
import { PlacesUsage } from '../models/PlacesUsage.js';
import { PLACES_DEFAULT_MONTHLY_LIMIT, PLACES_FREE_MONTHLY_CAP, PLACES_WARN_RATIO } from '../config/constants.js';
import { AppError } from './errors.js';
import { localParts } from './time.js';
import { getSettings } from './settingsService.js';
import { env } from '../config/env.js';

export function monthKey(date = new Date()) {
  const p = localParts(date);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

export async function resolveMonthlyLimit() {
  const settings = await getSettings();
  return settings.placesMonthlyLimit ?? env.googlePlacesMonthlyCallLimit ?? PLACES_DEFAULT_MONTHLY_LIMIT;
}

export async function getUsage(now = new Date()) {
  const month = monthKey(now);
  const [doc, limit] = await Promise.all([PlacesUsage.findOne({ month }), resolveMonthlyLimit()]);
  const count = doc?.count ?? 0;
  return {
    month,
    count,
    limit,
    remaining: Math.max(0, limit - count),
    warning: limit > 0 && count >= limit * PLACES_WARN_RATIO,
    freeCap: PLACES_FREE_MONTHLY_CAP,
  };
}

// Bir çağrı hakkı ayırır (atomik). Sınır dolmuşsa hata fırlatır; Google'a istek gitmez.
export async function reserveCall(now = new Date()) {
  const month = monthKey(now);
  const limit = await resolveMonthlyLimit();
  if (limit <= 0) throw new AppError(429, 'Google Places araması kapalı (aylık sınır 0).', 'places_limit_reached');
  try {
    const doc = await PlacesUsage.findOneAndUpdate(
      { month, count: { $lt: limit } },
      { $inc: { count: 1 } },
      { upsert: true, new: true },
    );
    return doc.count;
  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError(429, `Bu ayın Google Places sınırına ulaşıldı (${limit} çağrı). Ayarlardan artırabilirsiniz.`, 'places_limit_reached');
    }
    throw err;
  }
}
