'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from '../../../lib/api-client.js';
import { CATEGORY_LABEL, STAGES, CONTACT_CHANNEL_LABEL, formatDate } from '../../../lib/labels.js';
import LocationFilters from '../../../components/LocationFilters.js';
import { Notice, Loading, Empty, PageHeader, StageBadge } from '../../../components/ui.js';

const PAGE_SIZE = 50;

export default function BusinessesPage() {
  const [filters, setFilters] = useState({ province: '', district: '', category: '', stage: '', q: '', source: '', hasEmail: '' });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api(`/businesses${qs({ ...filters, page, limit: PAGE_SIZE })}`));
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  // "İşletme bul" sayfasından gelen ?source=google_places gibi filtreler
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const fromUrl = {};
    for (const k of ['source', 'hasEmail', 'stage', 'province']) if (sp.get(k)) fromUrl[k] = sp.get(k);
    if (Object.keys(fromUrl).length) setFilters((f) => ({ ...f, ...fromUrl }));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setFilters((f) => (f.q === search ? f : { ...f, q: search })); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function importCsv(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    try {
      const result = await api('/businesses/import', { method: 'POST', text: await file.text() });
      const lines = [`${result.created} işletme eklendi, ${result.duplicates} tekrar eden atlandı, ${result.errors.length} satır hatalı.`];
      for (const err of result.errors.slice(0, 15)) lines.push(`Satır ${err.line}: ${err.error}`);
      if (result.errors.length > 15) lines.push(`… ve ${result.errors.length - 15} hata daha`);
      setNotice({ type: result.errors.length ? 'error' : 'ok', text: lines.join('\n') });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setImporting(false);
    }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (
    <div>
      <PageHeader title="İşletmeler">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} aria-label="CSV dosyası" />
        <button type="button" className="btn-secondary" disabled={importing} onClick={() => fileRef.current?.click()}>
          {importing ? 'İçe aktarılıyor…' : 'CSV içe aktar'}
        </button>
        <Link href="/businesses/new" className="btn-primary">Yeni işletme</Link>
      </PageHeader>

      <div className="card mb-4">
        <LocationFilters value={filters} onChange={(v) => { setPage(1); setFilters(v); }}>
          <div className="w-44">
            <label className="label" htmlFor="f-stage">Aşama</label>
            <select id="f-stage" className="input" value={filters.stage} onChange={(e) => { setPage(1); setFilters({ ...filters, stage: e.target.value }); }}>
              <option value="">Tüm aşamalar</option>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="w-40">
            <label className="label" htmlFor="f-hasEmail">E-posta</label>
            <select id="f-hasEmail" className="input" value={filters.hasEmail} onChange={(e) => { setPage(1); setFilters({ ...filters, hasEmail: e.target.value }); }}>
              <option value="">Hepsi</option>
              <option value="yes">E-postası olan</option>
              <option value="no">E-postası olmayan</option>
            </select>
          </div>
          <div className="w-36">
            <label className="label" htmlFor="f-source">Kaynak</label>
            <select id="f-source" className="input" value={filters.source} onChange={(e) => { setPage(1); setFilters({ ...filters, source: e.target.value }); }}>
              <option value="">Hepsi</option>
              <option value="google_places">Google</option>
              <option value="manual">Elle / CSV</option>
            </select>
          </div>
          <div className="min-w-48 flex-1">
            <label className="label" htmlFor="f-q">Ara</label>
            <input id="f-q" className="input" placeholder="Ad, e-posta veya etiket" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </LocationFilters>
        <details className="mt-3 text-xs text-gray-500">
          <summary className="cursor-pointer">CSV biçimi</summary>
          <p className="mt-1">İlk satır başlık; virgül veya noktalı virgül ayırıcı. Sütunlar: <code>name, category, province, district, neighborhood, address, email, emailSource, phone, website, instagram, contactPerson, tags, notes, priority</code>. E-posta varsa <code>emailSource</code> (website, google_profile, manual, reply) zorunlu. Etiketleri <code>|</code> ile ayırın.</p>
        </details>
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="card overflow-x-auto p-0">
        {!data ? <Loading /> : data.items.length === 0 ? <Empty>Kayıt bulunamadı.</Empty> : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-3 py-2 font-medium">İşletme</th>
                <th className="px-3 py-2 font-medium">Konum</th>
                <th className="px-3 py-2 font-medium">Kategori</th>
                <th className="px-3 py-2 font-medium">E-posta</th>
                <th className="px-3 py-2 font-medium">Aşama</th>
                <th className="px-3 py-2 font-medium">Son temas</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-3 py-2"><Link href={`/businesses/${b._id}`} className="font-medium hover:text-brand">{b.name}</Link></td>
                  <td className="px-3 py-2 text-gray-600">{b.location.district}, {b.location.province}</td>
                  <td className="px-3 py-2 text-gray-600">{CATEGORY_LABEL[b.category]}</td>
                  <td className="px-3 py-2 text-gray-600">{b.contact?.email || <span className="text-xs text-amber-700">Yok{b.contactChannel && b.contactChannel !== 'email' ? ` · ${CONTACT_CHANNEL_LABEL[b.contactChannel]} ile ulaşın` : ''}</span>}</td>
                  <td className="px-3 py-2"><StageBadge stage={b.stage} /></td>
                  <td className="px-3 py-2 text-gray-600">{formatDate(b.lastContactedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {data && data.total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button type="button" className="btn-secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Önceki</button>
          <span>{page} / {totalPages}</span>
          <button type="button" className="btn-secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Sonraki</button>
        </div>
      )}
    </div>
  );
}
