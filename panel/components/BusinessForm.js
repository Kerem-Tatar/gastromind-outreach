'use client';

import { useState } from 'react';
import { CATEGORIES, EMAIL_SOURCES } from '../lib/labels.js';
import { useProvinces, useDistricts } from './LocationFilters.js';

function initial(b) {
  return {
    name: b?.name ?? '',
    category: b?.category ?? 'cafe',
    province: b?.location?.province ?? '',
    district: b?.location?.district ?? '',
    neighborhood: b?.location?.neighborhood ?? '',
    address: b?.location?.address ?? '',
    email: b?.contact?.email ?? '',
    emailSource: b?.emailSource ?? '',
    phone: b?.contact?.phone ?? '',
    website: b?.contact?.website ?? '',
    instagram: b?.contact?.instagram ?? '',
    contactPerson: b?.contact?.contactPerson ?? '',
    priority: b?.priority ?? 2,
    tags: (b?.tags ?? []).join(', '),
    notes: b?.notes ?? '',
  };
}

export function toPayload(f) {
  return {
    name: f.name.trim(),
    category: f.category,
    location: { province: f.province, district: f.district, neighborhood: f.neighborhood || undefined, address: f.address || undefined },
    contact: {
      email: f.email.trim() || undefined,
      phone: f.phone.trim() || undefined,
      website: f.website.trim() || undefined,
      instagram: f.instagram.trim() || undefined,
      contactPerson: f.contactPerson.trim() || undefined,
    },
    emailSource: f.email.trim() ? f.emailSource || undefined : undefined,
    priority: Number(f.priority),
    tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
    notes: f.notes,
  };
}

function Field({ label, id, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label" htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

export default function BusinessForm({ business, onSubmit, submitLabel = 'Kaydet' }) {
  const [f, setF] = useState(() => initial(business));
  const [saving, setSaving] = useState(false);
  const provinces = useProvinces();
  const districts = useDistricts(f.province);
  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try { await onSubmit(toPayload(f)); } finally { setSaving(false); }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="İşletme adı *" id="b-name"><input id="b-name" className="input" required value={f.name} onChange={set('name')} /></Field>
      <Field label="Kategori *" id="b-category">
        <select id="b-category" className="input" value={f.category} onChange={set('category')}>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </Field>
      <Field label="Öncelik" id="b-priority">
        <select id="b-priority" className="input" value={f.priority} onChange={set('priority')}>
          <option value={1}>1 — Yüksek</option><option value={2}>2 — Orta</option><option value={3}>3 — Düşük</option>
        </select>
      </Field>
      <Field label="İl *" id="b-province">
        <select id="b-province" className="input" required value={f.province} onChange={(e) => setF((p) => ({ ...p, province: e.target.value, district: '' }))}>
          <option value="">Seçin</option>
          {provinces.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
        </select>
      </Field>
      <Field label="İlçe *" id="b-district">
        <select id="b-district" className="input" required value={f.district} onChange={set('district')} disabled={!f.province}>
          <option value="">Seçin</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
          {f.district && !districts.includes(f.district) && <option value={f.district}>{f.district}</option>}
        </select>
      </Field>
      <Field label="Mahalle" id="b-neighborhood"><input id="b-neighborhood" className="input" value={f.neighborhood} onChange={set('neighborhood')} /></Field>
      <Field label="Adres" id="b-address" className="sm:col-span-2 lg:col-span-3"><input id="b-address" className="input" value={f.address} onChange={set('address')} /></Field>
      <Field label="E-posta" id="b-email"><input id="b-email" type="email" className="input" value={f.email} onChange={set('email')} /></Field>
      <Field label={`E-posta kaynağı${f.email ? ' *' : ''}`} id="b-emailSource">
        <select id="b-emailSource" className="input" value={f.emailSource} onChange={set('emailSource')} required={Boolean(f.email.trim())} disabled={!f.email.trim()}>
          <option value="">Seçin</option>
          {EMAIL_SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </Field>
      <Field label="Yetkili kişi" id="b-contactPerson"><input id="b-contactPerson" className="input" placeholder="ör. Ahmet Bey" value={f.contactPerson} onChange={set('contactPerson')} /></Field>
      <Field label="Telefon" id="b-phone"><input id="b-phone" className="input" value={f.phone} onChange={set('phone')} /></Field>
      <Field label="Web sitesi" id="b-website"><input id="b-website" className="input" value={f.website} onChange={set('website')} /></Field>
      <Field label="Instagram" id="b-instagram"><input id="b-instagram" className="input" value={f.instagram} onChange={set('instagram')} /></Field>
      <Field label="Etiketler (virgülle)" id="b-tags" className="sm:col-span-2 lg:col-span-3"><input id="b-tags" className="input" value={f.tags} onChange={set('tags')} /></Field>
      <Field label="Notlar" id="b-notes" className="sm:col-span-2 lg:col-span-3"><textarea id="b-notes" rows={3} className="input" value={f.notes} onChange={set('notes')} /></Field>
      <p className="text-xs text-gray-500 sm:col-span-2 lg:col-span-3">
        Sadece işletmenin kendi yayınladığı iletişim bilgilerini girin (web sitesi, Google profili). Kişisel e-posta tahmin etmeyin.
      </p>
      <div className="sm:col-span-2 lg:col-span-3">
        <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Kaydediliyor…' : submitLabel}</button>
      </div>
    </form>
  );
}
