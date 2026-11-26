'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../../lib/api-client.js';
import { STAGES, CATEGORY_LABEL, ACTIVITY_LABEL, SKIP_REASON_LABEL, EMAIL_SOURCES, STAGE_LABEL, formatDate } from '../../../../lib/labels.js';
import BusinessForm from '../../../../components/BusinessForm.js';
import { Notice, Loading, Empty, StageBadge, StatusBadge } from '../../../../components/ui.js';

export default function BusinessDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [detail, setDetail] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [notice, setNotice] = useState(null);
  const [editing, setEditing] = useState(false);
  const [stage, setStage] = useState('');
  const [stageNote, setStageNote] = useState('');
  const [activity, setActivity] = useState({ type: 'note', text: '' });
  const [campaignId, setCampaignId] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api(`/businesses/${id}`);
      setDetail(d);
      setStage(d.business.stage);
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api('/campaigns').then((c) => setCampaigns(c.filter((x) => x.isActive))).catch(() => {}); }, []);

  const run = async (fn, okText) => {
    try {
      await fn();
      if (okText) setNotice({ type: 'ok', text: okText });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  };

  if (!detail) return notice ? <Notice notice={notice} /> : <Loading />;
  const { business: b, activities, messages } = detail;
  const locked = b.stage === 'do_not_contact';

  async function saveStage(e) {
    e.preventDefault();
    if (stage === b.stage) return;
    if (stage === 'do_not_contact' && !window.confirm('İletişim kurulmayacak olarak işaretlensin mi?\nBekleyen taslaklar iptal edilir, adres ret listesine girer ve bu işlem geri alınamaz.')) return;
    await run(() => api(`/businesses/${id}/stage`, { method: 'POST', json: { stage, note: stageNote } }), `Aşama "${STAGE_LABEL[stage]}" olarak güncellendi.`);
    setStageNote('');
  }

  async function addActivity(e) {
    e.preventDefault();
    await run(() => api(`/businesses/${id}/activities`, { method: 'POST', json: activity }), 'Kayıt eklendi.');
    setActivity({ type: activity.type, text: '' });
  }

  async function createDraft() {
    if (!campaignId) return;
    try {
      const res = await api(`/campaigns/${campaignId}/drafts`, { method: 'POST', json: { businessIds: [id] } });
      if (res.created.length) setNotice({ type: 'ok', text: 'Taslak oluşturuldu. Onay kuyruğunda düzenleyip onaylayabilirsiniz.' });
      else setNotice({ type: 'error', text: `Taslak oluşturulmadı: ${SKIP_REASON_LABEL[res.skipped[0]?.reason] ?? 'uygun değil'}.` });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  async function remove() {
    if (!window.confirm(`"${b.name}" silinsin mi? Bekleyen taslakları da silinir. Ret listesi kayıtları korunur.`)) return;
    try {
      await api(`/businesses/${id}`, { method: 'DELETE' });
      router.push('/businesses');
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  const emailSourceLabel = EMAIL_SOURCES.find((s) => s.value === b.emailSource)?.label;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/businesses" className="text-sm text-gray-500 hover:text-brand">← İşletmeler</Link>
        <h1 className="h1">{b.name}</h1>
        <StageBadge stage={b.stage} />
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="h2">Bilgiler</h2>
              <button type="button" className="btn-secondary" onClick={() => setEditing(!editing)}>{editing ? 'Vazgeç' : 'Düzenle'}</button>
            </div>
            {editing ? (
              <BusinessForm business={b} onSubmit={(payload) => run(async () => { await api(`/businesses/${id}`, { method: 'PATCH', json: payload }); setEditing(false); }, 'Bilgiler güncellendi.')} />
            ) : (
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Info label="Kategori" value={CATEGORY_LABEL[b.category]} />
                <Info label="Konum" value={[b.location.neighborhood, b.location.district, b.location.province].filter(Boolean).join(', ')} />
                <Info label="Adres" value={b.location.address} />
                <Info label="Yetkili" value={b.contact?.contactPerson} />
                <Info label="E-posta" value={b.contact?.email ? `${b.contact.email}${emailSourceLabel ? ` (${emailSourceLabel})` : ''}` : null} />
                <Info label="Telefon" value={b.contact?.phone} />
                <Info label="Web sitesi" value={b.contact?.website} />
                <Info label="Instagram" value={b.contact?.instagram} />
                <Info label="Puan" value={b.rating ? `${b.rating} (${b.reviewCount ?? 0} yorum)` : null} />
                <Info label="Öncelik" value={b.priority} />
                <Info label="Etiketler" value={b.tags?.join(', ')} />
                <Info label="Son temas" value={formatDate(b.lastContactedAt)} />
                {b.notes && <div className="sm:col-span-2"><dt className="text-xs text-gray-500">Notlar</dt><dd className="whitespace-pre-line">{b.notes}</dd></div>}
              </dl>
            )}
          </section>

          <section className="card">
            <h2 className="h2 mb-3">Mesajlar</h2>
            {messages.length === 0 ? <Empty>Henüz mesaj yok.</Empty> : (
              <ul className="divide-y divide-gray-100 text-sm">
                {messages.map((m) => (
                  <li key={m._id} className="flex flex-wrap items-center gap-2 py-2">
                    <StatusBadge status={m.status} />
                    <span className="flex-1 font-medium">{m.subject || '(konusuz)'}</span>
                    <span className="text-xs text-gray-500">{formatDate(m.sentAt || m.createdAt)}</span>
                    {['draft', 'approved'].includes(m.status) && <Link href={`/queue?id=${m._id}&status=${m.status}`} className="text-xs text-brand hover:underline">Kuyrukta aç</Link>}
                    {['sent', 'delivered', 'opened'].includes(m.status) && (
                      <button type="button" className="text-xs text-brand hover:underline"
                        onClick={() => run(() => api(`/messages/${m._id}/mark-replied`, { method: 'POST' }), 'Cevaplandı olarak işaretlendi.')}>Cevaplandı işaretle</button>
                    )}
                    {m.error && <span className="w-full text-xs text-accent">{m.error}</span>}
                  </li>
                ))}
              </ul>
            )}
            {!locked && (
              <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
                <div className="min-w-48 flex-1">
                  <label className="label" htmlFor="d-campaign">Mail şablonundan taslak oluştur</label>
                  <select id="d-campaign" className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                    <option value="">Mail şablonu seçin</option>
                    {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <button type="button" className="btn-primary" disabled={!campaignId || !b.contact?.email} onClick={createDraft}>Taslak oluştur</button>
                {!b.contact?.email && <p className="w-full text-xs text-amber-700">E-posta adresi olmadan taslak oluşturulamaz.</p>}
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4">
          <section className="card">
            <h2 className="h2 mb-3">Aşama</h2>
            {locked ? (
              <p className="text-sm text-accent">Bu işletme “iletişim kurulmayacak” aşamasında. Aşama geri alınamaz ve mail gönderilemez.</p>
            ) : (
              <form onSubmit={saveStage} className="space-y-2">
                <select aria-label="Aşama" className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
                  {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <input className="input" placeholder="Not (isteğe bağlı)" value={stageNote} onChange={(e) => setStageNote(e.target.value)} />
                <button type="submit" className="btn-primary w-full" disabled={stage === b.stage}>Aşamayı güncelle</button>
              </form>
            )}
          </section>

          <section className="card">
            <h2 className="h2 mb-3">Zaman çizelgesi</h2>
            <form onSubmit={addActivity} className="mb-3 space-y-2">
              <select aria-label="Kayıt tipi" className="input" value={activity.type} onChange={(e) => setActivity({ ...activity, type: e.target.value })}>
                <option value="note">Not</option><option value="call">Telefon görüşmesi</option><option value="meeting">Görüşme</option>
              </select>
              <textarea aria-label="Kayıt metni" className="input" rows={2} required placeholder="Ne konuşuldu?" value={activity.text} onChange={(e) => setActivity({ ...activity, text: e.target.value })} />
              <button type="submit" className="btn-secondary w-full">Ekle</button>
            </form>
            {activities.length === 0 ? <Empty>Kayıt yok.</Empty> : (
              <ol className="space-y-3 text-sm">
                {activities.map((a) => (
                  <li key={a._id} className="border-l-2 border-brand/40 pl-3">
                    <div className="text-xs text-gray-500">{formatDate(a.createdAt)} · {ACTIVITY_LABEL[a.type] ?? a.type}</div>
                    {a.type === 'stage_change' && a.meta && <div>{STAGE_LABEL[a.meta.from]} → {STAGE_LABEL[a.meta.to]}</div>}
                    {a.text && <div className="whitespace-pre-line">{a.text}</div>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <button type="button" className="text-sm text-accent hover:underline" onClick={remove}>İşletmeyi sil</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd>{value === undefined || value === null || value === '' ? '—' : value}</dd>
    </div>
  );
}
