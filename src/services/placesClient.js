// Google Places API (New) — Text Search istemcisi. Bağımlılık yok (fetch), zaman aşımı ve Türkçe hata mesajları.
// Sadece gereken alanlar istenir (field mask). Puan/yorum/web sitesi/telefon "Text Search Enterprise" SKU'sudur.
import { env } from '../config/env.js';
import { AppError } from './errors.js';

const URL_SEARCH = 'https://places.googleapis.com/v1/places:searchText';
const TIMEOUT_MS = 15000;

export const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.websiteUri',
  'places.nationalPhoneNumber',
  'nextPageToken',
].join(',');

function googleError(status, body) {
  const reason = body?.error?.status ?? '';
  if (status === 429 || reason === 'RESOURCE_EXHAUSTED') return new AppError(429, 'Google Places kotası doldu. Google Cloud kota ayarlarını kontrol edin.', 'places_quota');
  if (status === 403 || reason === 'PERMISSION_DENIED') return new AppError(502, 'Google Places isteği reddedildi: API anahtarı geçersiz, kısıtlı ya da Places API (New) etkin değil.', 'places_denied');
  if (status === 400) return new AppError(400, 'Google Places isteği geçersiz bulundu.', 'places_bad_request');
  return new AppError(502, `Google Places hatası (HTTP ${status}).`, 'places_error');
}

// Tek sayfa arama. Dönüş: { places: [...], nextPageToken }
export async function searchTextPage({ textQuery, pageToken, minRating }, { fetchImpl = fetch } = {}) {
  if (!env.googlePlacesApiKey) throw new AppError(503, 'Google Places yapılandırılmamış (GOOGLE_PLACES_API_KEY eksik).', 'places_not_configured');
  const body = { textQuery, languageCode: 'tr', regionCode: 'TR', pageSize: 20 };
  if (pageToken) body.pageToken = pageToken;
  // Google minRating'i 0.5'lik adıma YUKARI yuvarlar (4.2 → 4.5). Aşağı yuvarlayıp kesin filtreyi biz yaparız.
  if (minRating > 0) body.minRating = Math.min(5, Math.floor(minRating * 2) / 2);
  let res;
  try {
    res = await fetchImpl(URL_SEARCH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.googlePlacesApiKey, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new AppError(502, timeout ? 'Google Places zaman aşımına uğradı.' : 'Google Places servisine ulaşılamadı.', 'places_unreachable');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw googleError(res.status, data);
  return { places: Array.isArray(data.places) ? data.places : [], nextPageToken: data.nextPageToken ?? null };
}
