'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from '../../../lib/api-client.js';
import { SUPPRESSION_REASON_LABEL, formatDate } from '../../../lib/labels.js';
import { Notice, Loading, Empty, PageHeader } from '../../../components/ui.js';

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('/settings').then((s) => setForm({
      dailyLimit: s.dailyLimit,
      sendWindow: { ...s.sendWindow },
      followupAfterDays: s.followupAfterDays,
      maxFollowups: s.maxFollowups,
      sender: { fullName: '', companyName: '', email: '', phone: '', address: '', ...s.sender },
      bookingUrl: s.bookingUrl ?? '',
    })).catch((err) => setNotice({ type: 'error', text: err.message }));
  }, []);

  if (!form) return notice ? <Notice notice={notice} /> : <Loading />;

  const setSender = (k) => (e) => setForm({ ...form, sender: { ...form.sender, [k]: e.target.value } });
  const setWindow = (k, v) => setForm({ ...form, sendWindow: { ...form.sendWindow, [k]: v } });

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api('/settings', {
        method: 'PATCH',
        json: { ...form, dailyLimit: Number(form.dailyLimit), followupAfterDays: Number(form.followupAfterDays), maxFollowups: Number(form.maxFollowups) },
      });
      setNotice({ type: 'ok', text: 'Ayarlar kaydedildi.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader title="Ayarlar" />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <form onSubmit={save} className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="h2">Gönderim limitleri</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="s-daily">Günlük mail limiti (en fazla 100)</label>
              <input id="s-daily" type="number" min={0} max={100} className="input" value={form.dailyLimit} onChange={(e) => setForm({ ...form, dailyLimit: e.target.value })} />
            </div>
            <div className="text-xs text-gray-500 sm:pt-5">Mailler arası 30–90 sn bekleme ve aynı alan adına günde en fazla 2 mail kuralı değiştirilemez.</div>
            <div>
              <label className="label" htmlFor="s-start">Gönderim başlangıcı</label>
              <input id="s-start" type="time" className="input" value={form.sendWindow.start} onChange={(e) => setWindow('start', e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="s-end">Gönderim bitişi</label>
              <input id="s-end" type="time" className="input" value={form.sendWindow.end} onChange={(e) => setWindow('end', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.sendWindow.weekdaysOnly} onChange={(e) => setWindow('weekdaysOnly', e.target.checked)} />
              Sadece hafta içi gönder (saatler Türkiye saatine göre)
            </label>
          </div>
          <h2 className="h2 pt-2">Hatırlatmalar</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="s-fdays">Cevap yoksa kaç gün sonra</label>
              <input id="s-fdays" type="number" min={1} className="input" value={form.followupAfterDays} onChange={(e) => setForm({ ...form, followupAfterDays: e.target.value })} />
            </div>
            <div>
              <label className="label" htmlFor="s-fmax">En fazla hatırlatma</label>
              <input id="s-fmax" type="number" min={0} max={3} className="input" value={form.maxFollowups} onChange={(e) => setForm({ ...form, maxFollowups: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-gray-500">Hatırlatma taslakları Faz 5'te otomatik üretilecek.</p>
        </section>

        <section className="card space-y-3">
          <h2 className="h2">Gönderen bilgileri (yasal footer)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="s-fullName">Ad soyad</label><input id="s-fullName" className="input" value={form.sender.fullName} onChange={setSender('fullName')} /></div>
            <div><label className="label" htmlFor="s-company">Şirket / marka</label><input id="s-company" className="input" value={form.sender.companyName} onChange={setSender('companyName')} /></div>
            <div><label className="label" htmlFor="s-email">İletişim e-postası</label><input id="s-email" type="email" className="input" value={form.sender.email} onChange={setSender('email')} /></div>
            <div><label className="label" htmlFor="s-phone">Telefon</label><input id="s-phone" className="input" value={form.sender.phone} onChange={setSender('phone')} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="s-address">Adres</label><input id="s-address" className="input" value={form.sender.address} onChange={setSender('address')} /></div>
            <div className="sm:col-span-2"><label className="label" htmlFor="s-booking">Randevu linki (Cal.com)</label><input id="s-booking" className="input" placeholder="https://cal.com/…" value={form.bookingUrl} onChange={(e) => setForm({ ...form, bookingUrl: e.target.value })} /></div>
          </div>
          <p className="text-xs text-gray-500">Boş bırakılan alanlar için sunucudaki .env değerleri kullanılır. Ad (veya şirket) ve bir iletişim bilgisi olmadan mail gönderilmez.</p>
        </section>

        <div className="lg:col-span-2">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Kaydediliyor…' : 'Ayarları kaydet'}</button>
        </div>
      </form>

      <Suppressions />
    </div>
  );
}

function Suppressions() {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try { setData(await api(`/suppressions${qs({ q, limit: 50 })}`)); } catch (err) { setNotice({ type: 'error', text: err.message }); }
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t); }, [load]);

  async function add(e) {
    e.preventDefault();
    try {
      await api('/suppressions', { method: 'POST', json: { email, reason: 'manual', note } });
      setEmail(''); setNote('');
      setNotice({ type: 'ok', text: 'Adres ret listesine eklendi.' });
      await load();
    } catch (err) { setNotice({ type: 'error', text: err.message }); }
  }

  async function importIys(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const res = await api('/suppressions/import-iys', { method: 'POST', text: await file.text() });
      const lines = [`${res.added} adres eklendi, ${res.alreadySuppressed} adres zaten listedeydi, ${res.errors.length} satır hatalı.`];
      for (const er of res.errors.slice(0, 10)) lines.push(`Satır ${er.line}: ${er.error}`);
      setNotice({ type: res.errors.length ? 'error' : 'ok', text: lines.join('\n') });
      await load();
    } catch (err) { setNotice({ type: 'error', text: err.message }); }
  }

  return (
    <section className="card mt-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="h2">Ret listesi</h2>
          <p className="text-xs text-gray-500">Bu adreslere hiçbir koşulda mail gönderilmez. Kayıtlar silinemez.</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={importIys} aria-label="İYS CSV dosyası" />
          <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>İYS ret listesi içe aktar (CSV)</button>
        </div>
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <form onSubmit={add} className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1"><label className="label" htmlFor="sup-email">E-posta</label><input id="sup-email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="min-w-56 flex-1"><label className="label" htmlFor="sup-note">Not</label><input id="sup-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <button type="submit" className="btn-primary">Listeye ekle</button>
      </form>
      <input aria-label="Ret listesinde ara" className="input" placeholder="Ara…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!data ? <Loading /> : data.items.length === 0 ? <Empty>Kayıt yok.</Empty> : (
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-gray-500"><tr><th className="py-1 font-medium">E-posta</th><th className="py-1 font-medium">Sebep</th><th className="py-1 font-medium">Not</th><th className="py-1 font-medium">Tarih</th></tr></thead>
          <tbody>
            {data.items.map((s) => (
              <tr key={s._id} className="border-t border-gray-100">
                <td className="py-1.5">{s.email}</td>
                <td className="py-1.5">{SUPPRESSION_REASON_LABEL[s.reason] ?? s.reason}</td>
                <td className="py-1.5 text-gray-500">{s.note}</td>
                <td className="py-1.5 text-gray-500">{formatDate(s.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && data.total > data.items.length && <p className="text-xs text-gray-500">Toplam {data.total} kayıt; son 50 tanesi gösteriliyor.</p>}
    </section>
  );
}
