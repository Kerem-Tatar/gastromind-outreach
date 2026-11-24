'use client';

import { useEffect, useState } from 'react';
import { api } from '../lib/api-client.js';
import { CATEGORIES } from '../lib/labels.js';

let provincesCache = null;
const districtsCache = new Map();

export function useProvinces() {
  const [provinces, setProvinces] = useState(provincesCache ?? []);
  useEffect(() => {
    if (provincesCache) return;
    api('/locations').then((d) => { provincesCache = d.provinces; setProvinces(d.provinces); }).catch(() => {});
  }, []);
  return provinces;
}

export function useDistricts(province) {
  const [districts, setDistricts] = useState([]);
  useEffect(() => {
    if (!province) { setDistricts([]); return; }
    if (districtsCache.has(province)) { setDistricts(districtsCache.get(province)); return; }
    let alive = true;
    api(`/locations/${encodeURIComponent(province)}/districts`)
      .then((d) => { districtsCache.set(province, d.districts); if (alive) setDistricts(d.districts); })
      .catch(() => alive && setDistricts([]));
    return () => { alive = false; };
  }, [province]);
  return districts;
}

// İl → ilçe → kategori filtre satırı. value: { province, district, category }
export default function LocationFilters({ value, onChange, showCategory = true, children }) {
  const provinces = useProvinces();
  const districts = useDistricts(value.province);
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-44">
        <label className="label" htmlFor="f-province">İl</label>
        <select id="f-province" className="input" value={value.province ?? ''}
          onChange={(e) => onChange({ ...value, province: e.target.value, district: '' })}>
          <option value="">Tüm iller</option>
          {provinces.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
        </select>
      </div>
      <div className="w-44">
        <label className="label" htmlFor="f-district">İlçe</label>
        <select id="f-district" className="input" value={value.district ?? ''} disabled={!value.province}
          onChange={(e) => onChange({ ...value, district: e.target.value })}>
          <option value="">Tüm ilçeler</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
      {showCategory && (
        <div className="w-40">
          <label className="label" htmlFor="f-category">Kategori</label>
          <select id="f-category" className="input" value={value.category ?? ''} onChange={(e) => onChange({ ...value, category: e.target.value })}>
            <option value="">Tüm kategoriler</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      )}
      {children}
    </div>
  );
}
