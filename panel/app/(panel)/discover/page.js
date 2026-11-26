'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../../lib/api-client.js';
import { CATEGORIES } from '../../../lib/labels.js';
import { useProvinces, useDistricts } from '../../../components/LocationFilters.js';
import { Notice, PageHeader } from '../../../components/ui.js';

const STORAGE_KEY = 'gm-discover-last';
const RATING_OPTIONS = [0, 3.5, 4, 4.2, 4.5, 4.7];

function readStored() {
  try { return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null'); } catch { return null; }
}
function store(value) {
  try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)); } catch { /* özel pencere vb. */ }
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

export default function DiscoverPage() {
  const [form, setForm] = useState({ province: '', districts: [], category: 'cafe', keyword: '', minRating: 4, minReviews: 20, maxPages: 1, neighborhoods: '' });
  const [districtFilter, setDistrictFilter] = useState('');
  const [usage, setUsage] = useState(null);
  const [result, setResult] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [notice, setNotice] = useState(null);
  const [searching, setSearching] = useState(false);
  const [findEmails, setFindEmails] = useState(true);
  const [importState, setImportState] = useState(null);
  const provinces = useProvinces();
  const districts = useDistricts(form.province);

  useEffect(() => {
    api('/places/usage').then(setUsage).catch(() => {});
    const last = readStored();
    if (last?.result) {
      setForm(last.form);
      setResult(last.result);
      setSelected(new Set(last.result.items.filter((p) => p.inArea && !p.alreadyAdded).map((p) => p.placeId)));
    }
  }, []);

  const neighborhoodList = form.neighborhoods.split(',').map((n) => n.trim()).filter(Boolean);
  const maxCalls = form.districts.length * (form.districts.length === 1 && neighborhoodList.length ? neighborhoodList.length : 1) * Number(form.maxPages);
  const visibleDistricts = useMemo(() => {
    const f = districtFilter.trim().toLocaleLowerCase('tr-TR');
    return f ? districts.filter((d) => d.toLocaleLowerCase('tr-TR').includes(f)) : districts;
  }, [districts, districtFilter]);

  const set = (k) => (e) => setForm((prev) => ({ ...prev, [k]: e.target.value }));
  const toggleDistrict = (d) => setForm((prev) => ({
    ...prev,
    districts: prev.districts.includes(d) ? prev.districts.filter((x) => x !== d) : [...prev.districts, d],
  }));

  async function search(e) {
    e.preventDefault();
    if (!form.province || !form.districts.length) {
      setNotice({ type: 'error', text: 'Bir il ve en az bir ilçe seçin.' });
      return;
    }
    if (usage && maxCalls > usage.remaining && !window.confirm(`Bu arama en fazla ${maxCalls} çağrı kullanabilir, bu ay kalan: ${usage.remaining}. Sınıra gelince arama durur ve o ana kadarki sonuçlar gösterilir. Devam edilsin mi?`)) return;
    setSearching(true);
    setNotice(null);
    setImportState(null);
    try {
      const res = await api('/places/search', {
        method: 'POST',
        json: {
          province: form.province,
          districts: form.districts,
          category: form.category,
          keyword: form.keyword,
          minRating: Number(form.minRating),
          minReviews: Number(form.minReviews),
          maxPages: Number(form.maxPages),
          neighborhoods: neighborhoodList,
        },
      });
      setResult(res);
      setUsage(res.usage);
      setSelected(new Set(res.items.filter((p) => p.inArea && !p.alreadyAdded).map((p) => p.placeId)));
      store({ form, result: res });
      const more = res.queries.filter((q) => q.hasMore).length;
      const lines = [`${res.calls} çağrı kullanıldı; filtrelere uyan ${res.items.length} işletme bulundu (Google toplam ${res.totalFound} sonuç döndürdü).`];
      if (res.stoppedReason) lines.push(`Arama erken durdu: ${res.stoppedReason}`);
      if (more) lines.push(`${more} sorguda daha fazla sonuç var; "sayfa sayısı"nı artırarak ya da mahalle bazında arayarak devamını alabilirsiniz.`);
      setNotice({ type: res.stoppedReason ? 'error' : 'ok', text: lines.join('\n') });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
      api('/places/usage').then(setUsage).catch(() => {});
    } finally {
      setSearching(false);
    }
  }

  async function importSelected() {
    const places = result.items.filter((p) => selected.has(p.placeId));
    if (!places.length) return;
    setImportState({ phase: 'import' });
    try {
      const res = await api('/places/import', { method: 'POST', json: { places } });
      const added = new Set(places.map((p) => p.placeId));
      const updated = { ...result, items: result.items.map((p) => (added.has(p.placeId) ? { ...p, alreadyAdded: true } : p)) };
      setResult(updated);
      setSelected(new Set());
      store({ form, result: updated });
      const toLookup = findEmails ? res.created.filter((b) => b.hasWebsite) : [];
      setImportState({ phase: toLookup.length ? 'emails' : 'done', imported: res, total: toLookup.length, done: 0, lookups: [] });
      if (toLookup.length) await lookupEmails(res, toLookup);
    } catch (err) {
      setImportState(null);
      setNotice({ type: 'error', text: err.message });
    }
  }

  // Web sitelerini 2'şer 2'şer tarar (her site en fazla 5 istek, zaman aşımlı).
  async function lookupEmails(imported, businesses) {
    const queue = [...businesses];
    const lookups = [];
    const worker = async () => {
      while (queue.length) {
        const b = queue.shift();
        let entry;
        try {
          const r = await api(`/businesses/${b._id}/find-email`, { method: 'POST' });
          entry = { ...b, ...r };
        } catch (err) {
          entry = { ...b, status: 'error', reason: err.message };
        }
        lookups.push(entry);
        setImportState((s) => ({ ...s, done: lookups.length, lookups: [...lookups] }));
      }
    };
    await Promise.all([worker(), worker()]);
    setImportState((s) => ({ ...s, phase: 'done' }));
  }

  const items = result?.items ?? [];
  const selectable = items.filter((p) => !p.alreadyAdded);
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.placeId));

  return (
    <div>
      <PageHeader title="İşletme bul">
        {usage && (
          <span className={`rounded-full px-3 py-1 text-xs ${usage.warning ? 'bg-accent-light text-accent' : 'bg-gray-100 text-gray-600'}`}>
            Bu ay Google çağrısı: <strong>{usage.count}</strong> / {usage.limit}
          </span>
        )}
      </PageHeader>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <form onSubmit={search} className="card mb-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-3">
          <div>
            <label className="label" htmlFor="d-province">İl *</label>
            <select id="d-province" className="input" value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value, districts: [] })}>
              <option value="">Seçin</option>
              {provinces.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="d-category">Kategori</label>
              <select id="d-category" className="input" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-keyword">Arama kelimesi {form.category === 'other' ? '*' : '(isteğe bağlı)'}</label>
              <input id="d-keyword" className="input" placeholder="ör. kahvaltı salonu" value={form.keyword} onChange={set('keyword')} />
            </div>
            <div>
              <label className="label" htmlFor="d-rating">Minimum puan</label>
              <select id="d-rating" className="input" value={form.minRating} onChange={set('minRating')}>
                {RATING_OPTIONS.map((r) => <option key={r} value={r}>{r === 0 ? 'Fark etmez' : `${r.toFixed(1)} ve üzeri`}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-reviews">Minimum yorum sayısı</label>
              <input id="d-reviews" type="number" min={0} className="input" value={form.minReviews} onChange={set('minReviews')} />
            </div>
            <div>
              <label className="label" htmlFor="d-pages">İlçe başına sonuç</label>
              <select id="d-pages" className="input" value={form.maxPages} onChange={set('maxPages')}>
                <option value={1}>En fazla 20 (1 çağrı)</option>
                <option value={2}>En fazla 40 (2 çağrı)</option>
                <option value={3}>En fazla 60 (3 çağrı)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="d-neighborhoods">Mahalleler (tek ilçede, virgülle)</label>
              <input id="d-neighborhoods" className="input" placeholder="ör. Moda, Fenerbahçe" disabled={form.districts.length !== 1}
                value={form.neighborhoods} onChange={set('neighborhoods')} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="submit" className="btn-primary" disabled={searching || !form.province || !form.districts.length}>
              {searching ? 'Aranıyor…' : 'Ara'}
            </button>
            {form.districts.length > 0 && <span className="text-xs text-gray-500">Bu arama en fazla <strong>{maxCalls}</strong> çağrı kullanır.</span>}
          </div>
          <p className="text-xs text-gray-500">
            Sonuçlar önce aşağıda listelenir; sadece seçtikleriniz eklenir. Büyük ilçelerde 60 sonuç sınırına takılırsanız mahalle bazında arayın.
          </p>
        </div>

        <div>
          <div className="mb-1 flex items-end justify-between gap-2">
            <span className="label mb-0">İlçeler * {form.districts.length > 0 && `(${form.districts.length} seçili)`}</span>
            {form.districts.length > 0 && <button type="button" className="text-xs text-gray-500 hover:text-accent" onClick={() => setForm({ ...form, districts: [] })}>Temizle</button>}
          </div>
          {!form.province ? (
            <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">Önce il seçin.</p>
          ) : (
            <>
              <input aria-label="İlçe ara" className="input mb-2" placeholder="İlçe ara…" value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)} />
              <div className="grid max-h-60 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto rounded-md border border-gray-200 p-2 text-sm sm:grid-cols-3">
                {visibleDistricts.map((d) => (
                  <label key={d} className="flex items-center gap-1.5">
                    <input type="checkbox" checked={form.districts.includes(d)} onChange={() => toggleDistrict(d)} /> {d}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      </form>

      {importState && <ImportProgress state={importState} onClose={() => setImportState(null)} />}

      {result && (
        <section className="card p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <h2 className="h2">Sonuçlar ({items.length})</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={findEmails} onChange={(e) => setFindEmails(e.target.checked)} />
                Eklenince web sitelerinden e-posta ara
              </label>
              <button type="button" className="btn-primary" disabled={!selected.size || importState?.phase === 'import' || importState?.phase === 'emails'} onClick={importSelected}>
                Seçilenleri ekle ({selected.size})
              </button>
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-500">Filtrelere uyan işletme bulunamadı. Minimum puan veya yorum sayısını düşürmeyi deneyin.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2"><input type="checkbox" aria-label="Hepsini seç" checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(selectable.map((p) => p.placeId)))} /></th>
                    <th className="px-3 py-2 font-medium">İşletme</th>
                    <th className="px-3 py-2 font-medium">Puan</th>
                    <th className="px-3 py-2 font-medium">Web sitesi</th>
                    <th className="px-3 py-2 font-medium">Telefon</th>
                    <th className="px-3 py-2 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p.placeId} className={`border-t border-gray-100 ${p.alreadyAdded ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2 align-top">
                        <input type="checkbox" aria-label={`${p.name} seç`} disabled={p.alreadyAdded} checked={selected.has(p.placeId)}
                          onChange={() => setSelected((prev) => { const n = new Set(prev); if (n.has(p.placeId)) n.delete(p.placeId); else n.add(p.placeId); return n; })} />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.mapsUrl ? <a href={p.mapsUrl} target="_blank" rel="noreferrer" className="hover:text-brand">{p.name}</a> : p.name}</div>
                        <div className="max-w-md truncate text-xs text-gray-500" title={p.address}>{p.address}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">{p.rating ? `★ ${p.rating.toFixed(1)}` : '—'} <span className="text-xs text-gray-500">({p.reviewCount})</span></td>
                      <td className="px-3 py-2">{p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="text-brand hover:underline">{hostOf(p.website)}</a> : <span className="text-xs text-amber-700">Yok</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-600">{p.phone ?? '—'}</td>
                      <td className="px-3 py-2 text-xs">
                        {p.alreadyAdded && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-gray-600">Zaten ekli</span>}
                        {!p.inArea && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700" title="Google bu işletmeyi başka bir ilçede gösteriyor">İlçe dışı{p.googleDistrict ? ` (${p.googleDistrict})` : ''}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ImportProgress({ state, onClose }) {
  const { phase, imported, total, done, lookups = [] } = state;
  if (phase === 'import') return <div className="card mb-4 text-sm">İşletmeler ekleniyor…</div>;
  const found = lookups.filter((l) => l.status === 'found');
  return (
    <section className="card mb-4 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p><strong>{imported.created.length}</strong> işletme eklendi{imported.duplicates ? `, ${imported.duplicates} tanesi zaten kayıtlıydı` : ''}{imported.errors.length ? `, ${imported.errors.length} tanesi eklenemedi` : ''}.</p>
          {total > 0 && (
            <p className="text-gray-600">
              {phase === 'emails' ? `Web sitelerinde e-posta aranıyor: ${done} / ${total}…` : `E-posta araması bitti: ${found.length} / ${total} işletmede bulundu.`}
            </p>
          )}
        </div>
        {phase === 'done' && <button type="button" onClick={onClose} aria-label="Kapat" className="text-gray-400 hover:text-gray-700">×</button>}
      </div>
      {total > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
          <div className="h-full bg-brand transition-all" style={{ width: `${Math.round((done / total) * 100)}%` }} />
        </div>
      )}
      {lookups.length > 0 && (
        <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs">
          {lookups.map((l) => (
            <li key={l._id}>
              <Link href={`/businesses/${l._id}`} className="font-medium hover:text-brand">{l.name}</Link>{': '}
              {l.status === 'found' ? <span className="text-brand">{l.email}</span> : <span className="text-gray-500">{l.reason ?? 'bulunamadı'}</span>}
            </li>
          ))}
        </ul>
      )}
      {phase === 'done' && (
        <p className="text-xs text-gray-500">
          E-postası bulunamayanlar Telefon/Instagram kanalına işaretlendi. Hepsini <Link href="/businesses?source=google_places" className="text-brand hover:underline">İşletmeler</Link> sayfasında görebilirsiniz.
        </p>
      )}
    </section>
  );
}
