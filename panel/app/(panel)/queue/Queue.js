'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from '../../../lib/api-client.js';
import { formatDate } from '../../../lib/labels.js';
import { Notice, Loading, Empty, PageHeader, StageBadge } from '../../../components/ui.js';

const TABS = [
  { value: 'draft', label: 'Taslaklar' },
  { value: 'approved', label: 'Onaylananlar' },
];

export default function Queue() {
  const router = useRouter();
  const params = useSearchParams();
  const status = params.get('status') === 'approved' ? 'approved' : 'draft';
  const selectedId = params.get('id');

  const [list, setList] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const data = await api(`/messages${qs({ status, limit: 200 })}`);
      setList(data);
      setChecked((prev) => new Set([...prev].filter((id) => data.items.some((m) => m._id === id))));
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }, [status]);

  useEffect(() => { setList(null); setChecked(new Set()); loadList(); }, [loadList]);

  const select = (id, nextStatus = status) => router.replace(`/queue${qs({ status: nextStatus, id })}`, { scroll: false });

  // Seçili mesaj listede yoksa ilkini seç
  useEffect(() => {
    if (!list) return;
    if (!list.items.length) return;
    if (!selectedId || !list.items.some((m) => m._id === selectedId)) select(list.items[0]._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, selectedId]);

  function toggle(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function bulkApprove() {
    const ids = [...checked];
    if (!ids.length) return;
    if (!window.confirm(`${ids.length} taslak onaylansın mı? Onaylanan mailler gönderim saatlerinde limitlere uyularak gönderilebilir.`)) return;
    setBusy(true);
    try {
      const res = await api('/messages/approve', { method: 'POST', json: { ids } });
      const lines = [`${res.approved.length} taslak onaylandı.`];
      for (const f of res.failed) lines.push(`Onaylanamadı: ${f.error}`);
      setNotice({ type: res.failed.length ? 'error' : 'ok', text: lines.join('\n') });
      setChecked(new Set());
      await loadList();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function sendAll() {
    if (!window.confirm('Onaylı mailler sırayla gönderilsin mi?\nMailler arasında 30–90 sn beklenir; günlük limit, alan adı limiti ve gönderim saatleri uygulanır. İşlem arka planda sürer.')) return;
    try {
      await api('/messages/send-approved', { method: 'POST' });
      setNotice({ type: 'ok', text: 'Gönderim başladı. Mailler arka planda aralıklarla gidecek; birkaç dakika sonra sayfayı yenileyin.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  const items = list?.items ?? [];
  const allChecked = items.length > 0 && items.every((m) => checked.has(m._id));

  return (
    <div>
      <PageHeader title="Onay kuyruğu">
        {status === 'draft' && (
          <button type="button" className="btn-primary" disabled={!checked.size || busy} onClick={bulkApprove}>
            Seçilenleri onayla{checked.size ? ` (${checked.size})` : ''}
          </button>
        )}
        {status === 'approved' && items.length > 0 && (
          <button type="button" className="btn-primary" onClick={sendAll}>Onaylıların hepsini gönder</button>
        )}
      </PageHeader>

      <div className="mb-4 flex gap-1 border-b border-gray-200">
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => router.replace(`/queue?status=${t.value}`)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${status === t.value ? 'border-brand font-medium text-brand' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {t.label}{status === t.value && list ? ` (${list.total})` : ''}
          </button>
        ))}
      </div>

      <Notice notice={notice} onClose={() => setNotice(null)} />

      {!list ? <Loading /> : items.length === 0 ? (
        <div className="card"><Empty>{status === 'draft' ? 'Onay bekleyen taslak yok. Mail şablonları sayfasından taslak üretebilirsiniz.' : 'Gönderilmeyi bekleyen onaylı mail yok.'}</Empty></div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <aside className="card max-h-[75vh] overflow-y-auto p-0">
            {status === 'draft' && (
              <label className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 text-xs text-gray-600">
                <input type="checkbox" checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(items.map((m) => m._id)))} />
                Listedeki hepsini seç
              </label>
            )}
            <ul>
              {items.map((m) => (
                <li key={m._id} className={`flex items-start gap-2 border-b border-gray-100 px-3 py-2 last:border-0 ${m._id === selectedId ? 'bg-brand-light' : 'hover:bg-gray-50'}`}>
                  {status === 'draft' && <input type="checkbox" className="mt-1" aria-label={`${m.business?.name ?? ''} seç`} checked={checked.has(m._id)} onChange={() => toggle(m._id)} />}
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => select(m._id)}>
                    <div className="truncate text-sm font-medium">{m.business?.name ?? '(silinmiş işletme)'}</div>
                    <div className="truncate text-xs text-gray-500">{m.subject}</div>
                    <div className="text-xs text-gray-400">{m.business?.location?.district}, {m.business?.location?.province}</div>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          {selectedId && items.some((m) => m._id === selectedId) && (
            <MessageEditor key={selectedId} id={selectedId} status={status}
              onChanged={async (text, nextStatus) => {
                setNotice(text ? { type: 'ok', text } : null);
                await loadList();
                if (nextStatus && nextStatus !== status) router.replace(`/queue?status=${status}`);
              }}
              onError={(text) => setNotice({ type: 'error', text })} />
          )}
        </div>
      )}
    </div>
  );
}

function MessageEditor({ id, status, onChanged, onError }) {
  const [message, setMessage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [draft, setDraft] = useState({ subject: '', body: '' });
  const [busy, setBusy] = useState(false);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const load = useCallback(async () => {
    try {
      const m = await api(`/messages/${id}`);
      setMessage(m);
      setDraft({ subject: m.subject, body: m.body });
    } catch (err) {
      onErrorRef.current(err.message);
      return;
    }
    // Önizleme ayrı yüklenir: gönderen bilgisi eksikse hata önizleme alanında gösterilir.
    try {
      setPreview(await api(`/messages/${id}/preview`));
    } catch (err) {
      setPreview({ error: err.message });
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (!message) return <div className="card"><Loading /></div>;
  const dirty = draft.subject !== message.subject || draft.body !== message.body;

  async function act(fn) {
    setBusy(true);
    try { await fn(); } catch (err) { onError(err.message); } finally { setBusy(false); }
  }

  const save = () => act(async () => {
    const updated = await api(`/messages/${id}`, { method: 'PATCH', json: draft });
    if (status === 'approved' && updated.status === 'draft') {
      await onChanged('Mail düzenlendiği için tekrar taslağa döndü; yeniden onaylamanız gerekiyor.', 'draft');
      return;
    }
    await load();
    await onChanged('Taslak kaydedildi.');
  });

  const approve = () => act(async () => {
    if (dirty) await api(`/messages/${id}`, { method: 'PATCH', json: draft });
    await api(`/messages/${id}/approve`, { method: 'POST' });
    await onChanged('Taslak onaylandı.', 'approved');
  });

  const reject = () => act(async () => {
    if (!window.confirm('Bu taslak reddedilsin mi?')) return;
    await api(`/messages/${id}/reject`, { method: 'POST' });
    await onChanged('Taslak reddedildi.', 'rejected');
  });

  const sendNow = () => act(async () => {
    if (!window.confirm(`Bu mail şimdi ${message.to} adresine gönderilsin mi?`)) return;
    await api(`/messages/${id}/send`, { method: 'POST' });
    await onChanged(`Mail gönderildi: ${message.to}`, 'sent');
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="h2">Düzenle</h2>
          <Link href={`/businesses/${message.business}`} className="text-xs text-brand hover:underline">İşletmeyi aç</Link>
        </div>
        <div>
          <span className="label">Alıcı</span>
          <p className="text-sm">{message.to}</p>
        </div>
        <div>
          <label className="label" htmlFor="m-subject">Konu</label>
          <input id="m-subject" className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="m-body">Metin</label>
          <textarea id="m-body" className="input font-mono text-[13px]" rows={14} value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          <p className="mt-1 text-xs text-gray-500">Yasal footer ve çıkma linki gönderimde otomatik eklenir; buraya yazmanıza gerek yok.</p>
        </div>
        {status === 'approved' && <p className="text-xs text-amber-700">Onaylı bir maili düzenlerseniz tekrar taslağa döner.</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled={!dirty || busy} onClick={save}>Kaydet</button>
          {status === 'draft' && <button type="button" className="btn-primary" disabled={busy} onClick={approve}>{dirty ? 'Kaydet ve onayla' : 'Onayla'}</button>}
          {status === 'approved' && <button type="button" className="btn-primary" disabled={busy || dirty} onClick={sendNow}>Şimdi gönder</button>}
          <button type="button" className="btn-danger" disabled={busy} onClick={reject}>Reddet</button>
        </div>
        <p className="text-xs text-gray-400">Oluşturuldu: {formatDate(message.createdAt)}{message.approvedAt ? ` · Onay: ${formatDate(message.approvedAt)}` : ''}</p>
        {message.error && <p className="text-xs text-accent">Son hata: {message.error}</p>}
      </section>

      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="h2">Önizleme</h2>
          {dirty && <span className="text-xs text-amber-700">Kaydedilmemiş değişiklik var; önizleme kaydedince güncellenir.</span>}
        </div>
        {preview?.error && <p className="rounded-md bg-accent-light px-3 py-2 text-sm text-accent">{preview.error}</p>}
        {preview && !preview.error && (
          <>
            <dl className="space-y-0.5 text-xs text-gray-600">
              <div><dt className="inline font-medium">Kimden: </dt><dd className="inline">{preview.from}</dd></div>
              <div><dt className="inline font-medium">Kime: </dt><dd className="inline">{preview.to}</dd></div>
              {preview.replyTo && <div><dt className="inline font-medium">Yanıt: </dt><dd className="inline">{preview.replyTo}</dd></div>}
              <div><dt className="inline font-medium">Konu: </dt><dd className="inline">{preview.subject}</dd></div>
              <div><dt className="inline font-medium">List-Unsubscribe: </dt><dd className="inline break-all">{preview.headers?.['List-Unsubscribe']}</dd></div>
            </dl>
            <iframe title="Mail önizlemesi" sandbox="" srcDoc={preview.html} className="h-[28rem] w-full rounded-md border border-gray-200 bg-white" />
          </>
        )}
      </section>
    </div>
  );
}
