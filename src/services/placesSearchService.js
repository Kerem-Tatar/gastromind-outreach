// "İşletme bul": il/ilçe/kategori ile Google'da arar, sonuçları KAYDETMEDEN önizleme olarak döndürür.
import { Business } from '../models/Business.js';
import { PLACES_MAX_PAGES_PER_QUERY, CATEGORIES } from '../config/constants.js';
import { badRequest } from './errors.js';
import { foldTr, resolveProvince, resolveDistrict, resolveLocation } from './locations.js';
import { searchTextPage } from './placesClient.js';
import { reserveCall, getUsage } from './placesUsageService.js';

const SEARCH_TERMS = { cafe: 'kafe', restaurant: 'restoran', bakery: 'fırın', patisserie: 'pastane', bar: 'bar', other: '' };
const PRICE_LEVELS = { PRICE_LEVEL_FREE: 0, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

function component(place, type) {
  return (place.addressComponents ?? []).find((c) => c.types?.includes(type))?.longText ?? '';
}

// Google sonucunu önizleme satırına çevirir.
export function toPreview(place, { province, district, category }) {
  const gDistrict = component(place, 'administrative_area_level_2');
  const gProvince = component(place, 'administrative_area_level_1');
  const address = place.formattedAddress ?? '';
  const inArea = gDistrict
    ? foldTr(gDistrict) === foldTr(district) && (!gProvince || foldTr(gProvince) === foldTr(province))
    : foldTr(address).includes(foldTr(district));
  return {
    placeId: place.id,
    name: place.displayName?.text ?? '(adsız)',
    category,
    province,
    district,
    neighborhood: component(place, 'administrative_area_level_4') || component(place, 'sublocality_level_1') || undefined,
    address,
    lat: place.location?.latitude,
    lng: place.location?.longitude,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? 0,
    priceLevel: PRICE_LEVELS[place.priceLevel] ?? null,
    website: place.websiteUri ?? null,
    phone: place.nationalPhoneNumber ?? null,
    mapsUrl: place.googleMapsUri ?? null,
    businessStatus: place.businessStatus ?? null,
    googleDistrict: gDistrict || null,
    inArea,
  };
}

export function buildQuery({ category, keyword, neighborhood, district, province }) {
  const term = (keyword?.trim() || SEARCH_TERMS[category] || '').trim();
  return [term, neighborhood, district, province].filter(Boolean).join(' ');
}

function validate(input) {
  const province = resolveProvince(input.province);
  if (!province) throw badRequest('Geçerli bir il seçin.');
  const districtNames = Array.isArray(input.districts) ? input.districts : [];
  if (!districtNames.length) throw badRequest('En az bir ilçe seçin (büyük illerde sonuç sınırına takılmamak için arama ilçe bazında yapılır).');
  if (districtNames.length > 15) throw badRequest('Tek seferde en fazla 15 ilçe aranabilir.');
  const districts = districtNames.map((d) => {
    const name = resolveDistrict(province, d);
    if (!name) throw badRequest(`Geçersiz ilçe: ${d}`);
    return name;
  });
  const category = CATEGORIES.includes(input.category) ? input.category : 'cafe';
  if (category === 'other' && !input.keyword?.trim()) throw badRequest('"Diğer" kategorisi için arama kelimesi yazın (ör. "kahvaltı salonu").');
  const maxPages = Math.min(Math.max(Number(input.maxPages) || 1, 1), PLACES_MAX_PAGES_PER_QUERY);
  const neighborhoods = (Array.isArray(input.neighborhoods) ? input.neighborhoods : []).map((n) => String(n).trim()).filter(Boolean).slice(0, 10);
  return {
    province, districts, category, maxPages, neighborhoods,
    keyword: input.keyword ? String(input.keyword).slice(0, 60) : '',
    minRating: Math.min(Math.max(Number(input.minRating) || 0, 0), 5),
    minReviews: Math.max(Number(input.minReviews) || 0, 0),
  };
}

// Her ilçe (ve varsa mahalle) için ayrı sorgu; sayfa başına sayaç artar. Sınır dolarsa o ana kadarki sonuçlar döner.
export async function searchPlaces(input, { fetchImpl } = {}) {
  const q = validate(input);
  const byId = new Map();
  const queries = [];
  let calls = 0;
  let stoppedReason = null;

  const targets = q.districts.flatMap((district) => (q.neighborhoods.length && q.districts.length === 1
    ? q.neighborhoods.map((neighborhood) => ({ district, neighborhood }))
    : [{ district }]));

  outer: for (const t of targets) {
    const textQuery = buildQuery({ ...q, ...t, province: q.province });
    let pageToken = null;
    let found = 0;
    for (let page = 0; page < q.maxPages; page += 1) {
      try {
        await reserveCall();
      } catch (err) {
        stoppedReason = err.message;
        break outer;
      }
      calls += 1;
      const res = await searchTextPage({ textQuery, pageToken, minRating: q.minRating }, fetchImpl ? { fetchImpl } : undefined);
      for (const place of res.places) {
        if (!place.id || byId.has(place.id)) continue;
        byId.set(place.id, toPreview(place, { province: q.province, district: t.district, category: q.category }));
      }
      found += res.places.length;
      pageToken = res.nextPageToken;
      if (!pageToken) break;
    }
    queries.push({ query: textQuery, results: found, hasMore: Boolean(pageToken) });
  }

  let items = [...byId.values()]
    .filter((p) => p.businessStatus !== 'CLOSED_PERMANENTLY')
    .filter((p) => (p.rating ?? 0) >= q.minRating && p.reviewCount >= q.minReviews);

  const existing = await Business.find({ googlePlaceId: { $in: items.map((p) => p.placeId) } }).select('googlePlaceId');
  const existingIds = new Set(existing.map((b) => b.googlePlaceId));
  items = items.map((p) => ({ ...p, alreadyAdded: existingIds.has(p.placeId) }))
    .sort((a, b) => Number(b.inArea) - Number(a.inArea) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));

  return { calls, queries, stoppedReason, totalFound: byId.size, items, usage: await getUsage() };
}

// Önizlemeden seçilenleri ekler. googlePlaceId ile tekrar eklenmez. E-posta burada aranmaz.
export async function importPlaces(places) {
  if (!Array.isArray(places) || !places.length) throw badRequest('Eklenecek işletme seçin.');
  if (places.length > 200) throw badRequest('Tek seferde en fazla 200 işletme eklenebilir.');
  const result = { created: [], duplicates: 0, errors: [] };
  for (const p of places) {
    if (!p?.placeId || !p?.name) { result.errors.push({ name: p?.name ?? '?', error: 'Eksik veri.' }); continue; }
    if (await Business.exists({ googlePlaceId: p.placeId })) { result.duplicates += 1; continue; }
    const location = resolveLocation(p.province, p.district);
    if (!location) { result.errors.push({ name: p.name, error: 'Geçersiz il/ilçe.' }); continue; }
    try {
      const business = await Business.create({
        name: String(p.name).slice(0, 200),
        category: CATEGORIES.includes(p.category) ? p.category : 'other',
        location: {
          ...location,
          neighborhood: p.neighborhood || undefined,
          address: p.address || undefined,
          lat: Number.isFinite(p.lat) ? p.lat : undefined,
          lng: Number.isFinite(p.lng) ? p.lng : undefined,
        },
        contact: { website: p.website || undefined, phone: p.phone || undefined },
        googlePlaceId: p.placeId,
        googleMapsUrl: p.mapsUrl || undefined,
        rating: Number.isFinite(p.rating) ? p.rating : undefined,
        reviewCount: Number.isFinite(p.reviewCount) ? p.reviewCount : undefined,
        priceLevel: Number.isFinite(p.priceLevel) ? p.priceLevel : undefined,
        source: 'google_places',
        contactChannel: p.website ? 'email' : p.phone ? 'phone' : 'instagram',
      });
      result.created.push({ _id: business._id, name: business.name, hasWebsite: Boolean(p.website) });
    } catch (err) {
      if (err?.code === 11000) result.duplicates += 1;
      else result.errors.push({ name: p.name, error: 'Kaydedilemedi.' });
    }
  }
  return result;
}
