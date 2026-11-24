// Kampanya editöründe canlı önizleme için backend'deki şablon motorunun aynısı.
import { CATEGORY_TEMPLATE } from './labels.js';

export const TEMPLATE_VARIABLES = [
  { name: 'greeting', hint: '"Merhaba Ahmet Bey," veya "Merhaba,"' },
  { name: 'businessName', hint: 'İşletme adı' },
  { name: 'contactPerson', hint: 'Yetkili kişi' },
  { name: 'district', hint: 'İlçe' },
  { name: 'province', hint: 'İl' },
  { name: 'category', hint: 'kafe, restoran…' },
  { name: 'bookingUrl', hint: 'Randevu linki' },
];
const NAMES = TEMPLATE_VARIABLES.map((v) => v.name);
const VAR_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function findUnknownVariables(template) {
  const unknown = new Set();
  for (const m of String(template ?? '').matchAll(VAR_RE)) if (!NAMES.includes(m[1])) unknown.add(m[1]);
  return [...unknown];
}

export function renderPreview(template, business, bookingUrl) {
  const person = business?.contact?.contactPerson?.trim();
  const ctx = {
    greeting: person ? `Merhaba ${person},` : 'Merhaba,',
    businessName: business?.name ?? '',
    contactPerson: person ?? '',
    district: business?.location?.district ?? '',
    province: business?.location?.province ?? '',
    category: CATEGORY_TEMPLATE[business?.category] ?? 'işletme',
    bookingUrl: bookingUrl ?? '',
  };
  return String(template ?? '').replace(VAR_RE, (whole, name) => (NAMES.includes(name) ? ctx[name] : whole));
}

export const SAMPLE_BUSINESS = {
  name: 'Örnek Kahve Evi',
  category: 'cafe',
  location: { province: 'Ankara', district: 'Çankaya' },
  contact: { contactPerson: 'Ahmet Bey' },
};
