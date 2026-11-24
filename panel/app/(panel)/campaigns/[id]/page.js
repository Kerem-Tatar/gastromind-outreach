'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, qs } from '../../../../lib/api-client.js';
import { CATEGORIES, SKIP_REASON_LABEL } from '../../../../lib/labels.js';
import { TEMPLATE_VARIABLES, findUnknownVariables, renderPreview, SAMPLE_BUSINESS } from '../../../../lib/template.js';
import { useProvinces, useDistricts } from '../../../../components/LocationFilters.js';
import { Notice, Loading } from '../../../../components/ui.js';

const EMPTY = {
  name: '',
  target: { provinces: [], districts: [], categories: [] },
  initialSubject: '{{businessName}} için kısa bir öneri',
  initialBody: '{{greeting}}\n\n{{district}} bölgesindeki {{businessName}} için Gastromind\'ı tanıtmak istedim. Gastromind, misafirlerinize yapay zekâ destekli yemek önerileri sunan ve geri bildirimlerini toplayan bir sistem.\n\nUygunsanız 15 dakikalık online bir demo yapabiliriz: {{bookingUrl}}\n\nİyi çalışmalar,',
  followupSubject: '',
  followupBody: '',
  isActive: true,
  useAiPersonalization: false,
};

const TEMPLATE_FIELDS = [
  { key: 'initialSubject', label: 'İlk mail — konu', rows: 1 },
  { key: 'initialBody', label: 'İlk mail — metin', rows: 10 },
  { key: 'followupSubject', label: 'Hatırlatma — konu (isteğe bağlı)', rows: 1 },
  { key: 'followupBody', label: 'Hatırlatma — metin (isteğe bağlı)', rows: 6 },
];

export default function CampaignEditorPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const router = useRouter();
  const [form, setForm] = useState(isNew ? EMPTY : null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);
  const [focused, setFocused] = useState('initialBody');
  const [sampleId, setSampleId] = useState('');
  const [samples, setSamples] = useState([]);
  const [bookingUrl, setBookingUrl] = useState('');
  const [pickProvince, setPickProvince] = useState('');
  const refs = useRef({});
  const pendingCursor = useRef(null);
  const provinces = useProvinces();
  const districts = useDistricts(pickProvince);

  useEffect(() => {
    if (isNew) return;
    api(`/campaigns/${id}`).then((c) => setForm({ ...EMPTY, ...c, followupSubject: c.followupSubject ?? '', followupBody: c.followupBody ?? '' }))
      .catch((err) => setNotice({ type: 'error', text: err.message }));
  }, [id, isNew]);

  useEffect(() => { api('/settings').then((s) => setBookingUrl(s.bookingUrl || '')).catch(() => {}); }, []);

  const target = form?.target;
  useEffect(() => {
    if (!target) return;
    api(`/businesses${qs({ province: target.provinces[0], category: target.categories[0], limit: 30 })}`)
      .then((d) => setSamples(d.items)).catch(() => {});
  }, [target]);

  // Değişken eklendikten sonra imleci, render tamamlanır tamamlanmaz eklenen değişkenin sonuna taşı.
  useLayoutEffect(() => {
    const pending = pendingCursor.current;
    if (!pending) return;
    pendingCursor.current = null;
    const el = refs.current[pending.key];
    el?.focus();
    el?.setSelectionRange(pending.pos, pending.pos);
  }, [form]);

  const sample = useMemo(() => samples.find((b) => b._id === sampleId) ?? SAMPLE_BUSINESS, [samples, sampleId]);

  if (!form) return notice ? <Notice notice={notice} /> : <Loading />;

  const unknown = [...new Set(TEMPLATE_FIELDS.flatMap((f) => findUnknownVariables(form[f.key])))];
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setTarget = (key, value) => setForm((f) => ({ ...f, target: { ...f.target, [key]: value } }));
  const addUnique = (key, value) => value && !form.target[key].includes(value) && setTarget(key, [...form.target[key], value]);

  function insertVariable(name) {
    const el = refs.current[focused];
    const token = `{{${name}}}`;
    const value = form[focused] ?? '';
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    pendingCursor.current = { key: focused, pos: start + token.length };
    set(focused, value.slice(0, start) + token + value.slice(end));
  }

  function payload() {
    return {
      name: form.name,
      target: form.target,
      initialSubject: form.initialSubject,
      initialBody: form.initialBody,
      followupSubject: form.followupSubject || undefined,
      followupBody: form.followupBody || undefined,
      isActive: form.isActive,
    };
  }

  async function save(e) {
    e?.preventDefault();
    setSaving(true);
    try {
      if (isNew) {
        const created = await api('/campaigns', { method: 'POST', json: payload() });
        router.replace(`/campaigns/${created._id}`);
      } else {
        const updated = await api(`/campaigns/${id}`, { method: 'PATCH', json: payload() });
        setForm({ ...EMPTY, ...updated, followupSubject: updated.followupSubject ?? '', followupBody: updated.followupBody ?? '' });
        setNotice({ type: 'ok', text: 'Kampanya kaydedildi.' });
      }
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    if (!window.confirm('Hedefteki "Yeni" aşamasındaki ve e-postası olan işletmeler için taslak üretilsin mi? Taslaklar onay kuyruğuna düşer, hiçbiri otomatik gönderilmez.')) return;
    try {
      const res = await api(`/campaigns/${id}/drafts`, { method: 'POST', json: {} });
      const counts = {};
      for (const s of res.skipped) counts[s.reason] = (counts[s.reason] ?? 0) + 1;
      const skippedText = Object.entries(counts).map(([r, n]) => `${n} ${SKIP_REASON_LABEL[r] ?? r}`).join(', ');
      setNotice({ type: 'ok', text: `${res.created.length} taslak üretildi.${skippedText ? ` Atlananlar: ${skippedText}.` : ''}` });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  async function remove() {
    if (!window.confirm('Kampanya silinsin mi? Üretilmiş mesajlar silinmez.')) return;
    try {
      await api(`/campaigns/${id}`, { method: 'DELETE' });
      router.push('/campaigns');
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/campaigns" className="text-sm text-gray-500 hover:text-brand">← Kampanyalar</Link>
        <h1 className="h1 flex-1">{isNew ? 'Yeni kampanya' : form.name}</h1>
        {!isNew && <Link href="/queue" className="btn-secondary">Onay kuyruğu</Link>}
        {!isNew && <button type="button" className="btn-primary" onClick={generate} disabled={!form.isActive}>Taslak üret</button>}
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <form onSubmit={save} className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <section className="card space-y-3">
            <div>
              <label className="label" htmlFor="c-name">Kampanya adı *</label>
              <input id="c-name" className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <span className="label">Hedef iller ve ilçeler (boş bırakılırsa hepsi)</span>
              <div className="flex flex-wrap gap-2">
                <select aria-label="İl ekle" className="input w-44" value={pickProvince} onChange={(e) => { setPickProvince(e.target.value); addUnique('provinces', e.target.value); }}>
                  <option value="">İl ekle…</option>
                  {provinces.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
                </select>
                <select aria-label="İlçe ekle" className="input w-44" value="" disabled={!pickProvince} onChange={(e) => addUnique('districts', e.target.value)}>
                  <option value="">{pickProvince ? `${pickProvince} ilçesi ekle…` : 'Önce il seçin'}</option>
                  {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <Chips items={form.target.provinces} onRemove={(v) => setTarget('provinces', form.target.provinces.filter((x) => x !== v))} />
              <Chips items={form.target.districts} onRemove={(v) => setTarget('districts', form.target.districts.filter((x) => x !== v))} tone="gray" />
            </div>
            <div>
              <span className="label">Kategoriler (boş bırakılırsa hepsi)</span>
              <div className="flex flex-wrap gap-3 text-sm">
                {CATEGORIES.map((c) => (
                  <label key={c.value} className="flex items-center gap-1">
                    <input type="checkbox" checked={form.target.categories.includes(c.value)}
                      onChange={(e) => setTarget('categories', e.target.checked ? [...form.target.categories, c.value] : form.target.categories.filter((x) => x !== c.value))} />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} /> Aktif</label>
              <label className="flex items-center gap-1 text-gray-400" title="Faz 4'te gelecek"><input type="checkbox" disabled checked={form.useAiPersonalization} readOnly /> AI ile kişiselleştirme (yakında)</label>
            </div>
          </section>

          <section className="card space-y-3">
            <div>
              <span className="label">Değişken ekle (imlecin olduğu alana)</span>
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button key={v.name} type="button" title={v.hint} onMouseDown={(e) => e.preventDefault()} onClick={() => insertVariable(v.name)}
                    className="rounded border border-brand/30 bg-brand-light px-2 py-0.5 font-mono text-xs text-brand hover:bg-brand hover:text-white">{`{{${v.name}}}`}</button>
                ))}
              </div>
            </div>
            {TEMPLATE_FIELDS.map((f) => {
              const props = {
                id: `c-${f.key}`,
                ref: (el) => { refs.current[f.key] = el; },
                className: `input ${f.rows > 1 ? 'font-mono text-[13px]' : ''}`,
                value: form[f.key],
                required: f.key.startsWith('initial'),
                onFocus: () => setFocused(f.key),
                onChange: (e) => set(f.key, e.target.value),
              };
              return (
                <div key={f.key}>
                  <label className="label" htmlFor={props.id}>{f.label}{props.required ? ' *' : ''}</label>
                  {f.rows > 1 ? <textarea rows={f.rows} {...props} /> : <input {...props} />}
                </div>
              );
            })}
            {unknown.length > 0 && <p className="rounded-md bg-accent-light px-3 py-2 text-sm text-accent">Bilinmeyen değişken: {unknown.map((u) => `{{${u}}}`).join(', ')} — bu haliyle kaydedilemez.</p>}
            <p className="text-xs text-gray-500">Yasal footer (gönderen bilgisi ve çıkma linki) her maile otomatik eklenir.</p>
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn-primary" disabled={saving || unknown.length > 0}>{saving ? 'Kaydediliyor…' : isNew ? 'Kampanyayı oluştur' : 'Kaydet'}</button>
              {!isNew && <button type="button" className="btn-secondary text-accent" onClick={remove}>Sil</button>}
            </div>
          </section>
        </div>

        <section className="card space-y-3 self-start xl:sticky xl:top-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <h2 className="h2">Değişken önizlemesi</h2>
            <div className="w-64">
              <label className="label" htmlFor="c-sample">Örnek işletme</label>
              <select id="c-sample" className="input" value={sampleId} onChange={(e) => setSampleId(e.target.value)}>
                <option value="">Örnek veri ({SAMPLE_BUSINESS.name})</option>
                {samples.map((b) => <option key={b._id} value={b._id}>{b.name} — {b.location.district}</option>)}
              </select>
            </div>
          </div>
          <PreviewBlock title="İlk mail" subject={renderPreview(form.initialSubject, sample, bookingUrl)} body={renderPreview(form.initialBody, sample, bookingUrl)} />
          {(form.followupSubject || form.followupBody) && (
            <PreviewBlock title="Hatırlatma" subject={renderPreview(form.followupSubject, sample, bookingUrl)} body={renderPreview(form.followupBody, sample, bookingUrl)} />
          )}
          {!bookingUrl && <p className="text-xs text-amber-700">Randevu linki ayarlanmamış; {'{{bookingUrl}}'} boş kalır. Ayarlar sayfasından ekleyin.</p>}
        </section>
      </form>
    </div>
  );
}

function Chips({ items, onRemove, tone = 'brand' }) {
  if (!items.length) return null;
  const cls = tone === 'brand' ? 'bg-brand-light text-brand' : 'bg-gray-100 text-gray-700';
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {items.map((v) => (
        <span key={v} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${cls}`}>
          {v}<button type="button" aria-label={`${v} kaldır`} onClick={() => onRemove(v)} className="opacity-60 hover:opacity-100">×</button>
        </span>
      ))}
    </div>
  );
}

function PreviewBlock({ title, subject, body }) {
  return (
    <div className="rounded-md border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">{title}</div>
      <div className="space-y-2 p-3">
        <p className="text-sm"><span className="text-gray-500">Konu: </span><strong>{subject}</strong></p>
        <p className="whitespace-pre-line text-sm">{body}</p>
      </div>
    </div>
  );
}
