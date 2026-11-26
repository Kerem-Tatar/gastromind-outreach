// Google Places ile işletme bulma: maliyet koruması, önizleme, tekrar eklenmeme, e-posta bulma.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useTestDb } from './helpers/db.js';
import { makeBusiness } from './helpers/factories.js';
import { searchPlaces, importPlaces, buildQuery } from '../src/services/placesSearchService.js';
import { searchTextPage, FIELD_MASK } from '../src/services/placesClient.js';
import { reserveCall, getUsage } from '../src/services/placesUsageService.js';
import { updateSettings } from '../src/services/settingsService.js';
import { lookupBusinessEmail } from '../src/services/emailLookupService.js';
import { Business } from '../src/models/Business.js';
import { PlacesUsage } from '../src/models/PlacesUsage.js';

useTestDb();

function place(id, overrides = {}) {
  return {
    id,
    displayName: { text: `Kafe ${id}` },
    formattedAddress: `Caferağa, Moda Cd. No:${id}, 34710 Kadıköy/İstanbul, Türkiye`,
    addressComponents: [
      { longText: 'Kadıköy', types: ['administrative_area_level_2', 'political'] },
      { longText: 'İstanbul', types: ['administrative_area_level_1', 'political'] },
    ],
    location: { latitude: 40.98, longitude: 29.02 },
    rating: 4.5,
    userRatingCount: 120,
    websiteUri: `https://kafe${id}.com`,
    nationalPhoneNumber: '0216 000 00 00',
    googleMapsUri: `https://maps.google.com/?cid=${id}`,
    businessStatus: 'OPERATIONAL',
    ...overrides,
  };
}

// pages: her çağrıda sıradaki sayfa döner.
function fakeGoogle(pages, { status = 200, error } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    if (status !== 200) return new Response(JSON.stringify(error ?? {}), { status });
    const page = pages[Math.min(calls.length - 1, pages.length - 1)];
    return new Response(JSON.stringify(page), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  fakeGoogle.calls = calls;
  fetchImpl.calls = calls;
  return fetchImpl;
}

const saved = process.env.GOOGLE_PLACES_API_KEY;
beforeEach(() => { process.env.GOOGLE_PLACES_API_KEY = 'test-places-key-123'; });
afterEach(() => { process.env.GOOGLE_PLACES_API_KEY = saved ?? ''; });

const search = { province: 'istanbul', districts: ['kadıköy'], category: 'cafe', minRating: 4.2, minReviews: 50 };

describe('Google Places istemcisi', () => {
  it('sadece gereken alanları ister, Türkçe ve TR bölgesiyle arar, minRating aşağı yuvarlanır', async () => {
    const g = fakeGoogle([{ places: [] }]);
    await searchTextPage({ textQuery: 'kafe Kadıköy İstanbul', minRating: 4.2 }, { fetchImpl: g });
    const [call] = g.calls;
    expect(call.url).toBe('https://places.googleapis.com/v1/places:searchText');
    expect(call.headers['X-Goog-Api-Key']).toBe('test-places-key-123');
    expect(call.headers['X-Goog-FieldMask']).toBe(FIELD_MASK);
    expect(FIELD_MASK).not.toMatch(/reviews|photos|openingHours/);
    expect(call.body).toMatchObject({ textQuery: 'kafe Kadıköy İstanbul', languageCode: 'tr', regionCode: 'TR', pageSize: 20, minRating: 4 });
  });

  it('Google hatalarını anlaşılır Türkçe hataya çevirir', async () => {
    const g = fakeGoogle([], { status: 403, error: { error: { status: 'PERMISSION_DENIED' } } });
    await expect(searchTextPage({ textQuery: 'x' }, { fetchImpl: g })).rejects.toMatchObject({ code: 'places_denied' });
  });

  it('anahtar yoksa istek atmaz', async () => {
    process.env.GOOGLE_PLACES_API_KEY = '';
    const g = fakeGoogle([{ places: [] }]);
    await expect(searchTextPage({ textQuery: 'x' }, { fetchImpl: g })).rejects.toMatchObject({ code: 'places_not_configured' });
    expect(g.calls).toHaveLength(0);
  });
});

describe('maliyet koruması: aylık çağrı sayacı', () => {
  it('sınıra kadar sayar, sınırda durdurur ve %80\'de uyarır', async () => {
    await updateSettings({ placesMonthlyLimit: 5 });
    for (let i = 0; i < 4; i += 1) await reserveCall();
    expect(await getUsage()).toMatchObject({ count: 4, limit: 5, remaining: 1, warning: true });
    await reserveCall();
    await expect(reserveCall()).rejects.toMatchObject({ code: 'places_limit_reached' });
    expect((await getUsage()).count).toBe(5);
  });

  it('sınır dolunca arama Google\'a istek atmadan durur ve o ana kadarki sonuçları döner', async () => {
    await updateSettings({ placesMonthlyLimit: 2 });
    const g = fakeGoogle([
      { places: [place('1')], nextPageToken: 't2' },
      { places: [place('2')], nextPageToken: 't3' },
      { places: [place('3')] },
    ]);
    const res = await searchPlaces({ ...search, maxPages: 3 }, { fetchImpl: g });
    expect(g.calls).toHaveLength(2);
    expect(res.calls).toBe(2);
    expect(res.items).toHaveLength(2);
    expect(res.stoppedReason).toMatch(/sınırına ulaşıldı/);
  });

  it('varsayılan sınır 900 (Text Search Enterprise ücretsiz kotası 1.000)', async () => {
    expect((await getUsage()).limit).toBe(900);
  });
});

describe('işletme bulma önizlemesi', () => {
  it('ilçe bazında sorgu kurar, sayfaları dolaşır, sayacı sayfa başına artırır', async () => {
    const g = fakeGoogle([
      { places: [place('1'), place('2')], nextPageToken: 'p2' },
      { places: [place('3')] },
    ]);
    const res = await searchPlaces({ ...search, maxPages: 3 }, { fetchImpl: g });
    expect(g.calls.map((c) => c.body.textQuery)).toEqual(['kafe Kadıköy İstanbul', 'kafe Kadıköy İstanbul']);
    expect(g.calls[1].body.pageToken).toBe('p2');
    expect(res.calls).toBe(2);
    expect((await getUsage()).count).toBe(2);
    expect(res.items.map((p) => p.placeId)).toEqual(['1', '2', '3']);
  });

  it('puan ve yorum filtresini uygular, kapanmış işletmeleri eler, ilçe dışını işaretler', async () => {
    const g = fakeGoogle([{ places: [
      place('iyi'),
      place('dusuk', { rating: 4.1 }),
      place('az-yorum', { userRatingCount: 10 }),
      place('kapali', { businessStatus: 'CLOSED_PERMANENTLY' }),
      place('uskudar', { addressComponents: [{ longText: 'Üsküdar', types: ['administrative_area_level_2'] }] }),
    ] }]);
    const res = await searchPlaces(search, { fetchImpl: g });
    expect(res.items.map((p) => [p.placeId, p.inArea])).toEqual([['iyi', true], ['uskudar', false]]);
  });

  it('daha önce eklenmiş işletmeyi işaretler ve tekrar eklenmesini engeller', async () => {
    await makeBusiness({ googlePlaceId: '1', location: { province: 'İstanbul', district: 'Kadıköy' } });
    const g = fakeGoogle([{ places: [place('1'), place('2')] }]);
    const res = await searchPlaces(search, { fetchImpl: g });
    expect(res.items.find((p) => p.placeId === '1').alreadyAdded).toBe(true);
    const imported = await importPlaces(res.items);
    expect(imported.created).toHaveLength(1);
    expect(imported.duplicates).toBe(1);
    expect(await Business.countDocuments({ googlePlaceId: '2' })).toBe(1);
    const again = await importPlaces(res.items);
    expect(again.created).toHaveLength(0);
  });

  it('eklenen işletme google_places kaynaklı, e-postasız ve kanal bilgisiyle kaydedilir', async () => {
    const g = fakeGoogle([{ places: [place('9'), place('10', { websiteUri: undefined })] }]);
    const { items } = await searchPlaces(search, { fetchImpl: g });
    await importPlaces(items);
    const withSite = await Business.findOne({ googlePlaceId: '9' });
    expect(withSite).toMatchObject({ source: 'google_places', category: 'cafe', rating: 4.5, reviewCount: 120, contactChannel: 'email' });
    expect(withSite.location).toMatchObject({ province: 'İstanbul', district: 'Kadıköy' });
    expect(withSite.contact.email).toBeUndefined();
    expect((await Business.findOne({ googlePlaceId: '10' })).contactChannel).toBe('phone');
  });

  it('il/ilçe doğrulaması ve sorgu metni', async () => {
    await expect(searchPlaces({ ...search, districts: [] })).rejects.toThrow(/en az bir ilçe/i);
    await expect(searchPlaces({ ...search, districts: ['Çankaya'] })).rejects.toThrow(/Geçersiz ilçe/);
    expect(buildQuery({ category: 'patisserie', neighborhood: 'Moda', district: 'Kadıköy', province: 'İstanbul' })).toBe('pastane Moda Kadıköy İstanbul');
    expect(await PlacesUsage.countDocuments()).toBe(0);
  });
});

describe('web sitesinden e-posta bulma (işletmeye kaydetme)', () => {
  const site = (pages) => async (url) => {
    const path = new URL(url).pathname;
    return path in pages ? new Response(pages[path], { status: 200, headers: { 'content-type': 'text/html' } }) : new Response('', { status: 404 });
  };

  it('bulunan adresi website kaynağı ve kaynak URL ile kaydeder', async () => {
    const b = await Business.create({ name: 'Moda Kafe', category: 'cafe', location: { province: 'İstanbul', district: 'Kadıköy' }, contact: { website: 'https://modakafe.com' }, source: 'google_places' });
    const res = await lookupBusinessEmail(b._id, { fetchImpl: site({ '/robots.txt': '', '/': '', '/iletisim': 'info@modakafe.com' }) });
    expect(res.status).toBe('found');
    const saved2 = await Business.findById(b._id);
    expect(saved2).toMatchObject({ emailSource: 'website', emailSourceUrl: 'https://modakafe.com/iletisim', contactChannel: 'email' });
    expect(saved2.contact.email).toBe('info@modakafe.com');
  });

  it('bulamazsa telefon/instagram kanalına işaretler; mevcut e-postanın üzerine yazmaz', async () => {
    const b = await Business.create({ name: 'Sitesiz', category: 'cafe', location: { province: 'İstanbul', district: 'Kadıköy' }, contact: { phone: '0216' } });
    expect((await lookupBusinessEmail(b._id)).status).toBe('not_found');
    expect((await Business.findById(b._id)).contactChannel).toBe('phone');

    const withEmail = await makeBusiness({ contact: { email: 'elle@ornek.com', website: 'https://ornek.com' }, emailSource: 'manual' });
    const res = await lookupBusinessEmail(withEmail._id, { fetchImpl: async () => { throw new Error('çağrılmamalı'); } });
    expect(res.status).toBe('already_has_email');
    expect((await Business.findById(withEmail._id)).contact.email).toBe('elle@ornek.com');
  });
});
