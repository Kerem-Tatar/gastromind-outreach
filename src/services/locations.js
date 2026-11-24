// İl/ilçe doğrulaması. Hiçbir şehir sabit kodlanmaz; veri data/tr-locations.json'dan gelir.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const dataPath = fileURLToPath(new URL('../../data/tr-locations.json', import.meta.url));
const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// Türkçe karakterleri ve büyük/küçük harf farkını yok sayan anahtar: "İSTANBUL", "Istanbul", "istanbul" → "istanbul"
export function foldTr(value) {
  let s = String(value ?? '').trim().replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
  const map = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };
  s = s.replace(/[çğıöşüâîû]/g, (ch) => map[ch]).replace(/̇/g, '');
  return s.replace(/\s+/g, ' ');
}

const provinceIndex = new Map();
for (const p of data.provinces) {
  const districts = new Map(p.districts.map((d) => [foldTr(d), d]));
  provinceIndex.set(foldTr(p.name), { code: p.code, name: p.name, districts });
}

export function listProvinces() {
  return data.provinces.map((p) => ({ code: p.code, name: p.name }));
}

export function listDistricts(province) {
  const p = provinceIndex.get(foldTr(province));
  return p ? [...p.districts.values()] : null;
}

export function resolveProvince(name) {
  return provinceIndex.get(foldTr(name))?.name ?? null;
}

export function resolveDistrict(province, district) {
  const p = provinceIndex.get(foldTr(province));
  return p?.districts.get(foldTr(district)) ?? null;
}

// Geçerliyse resmi yazımla { province, district } döner, değilse null.
export function resolveLocation(province, district) {
  const p = resolveProvince(province);
  if (!p) return null;
  const d = resolveDistrict(p, district);
  return d ? { province: p, district: d } : null;
}

export const locationsSource = data._source;
