'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, qs } from '../../../lib/api-client.js';
import { STAGES, CATEGORY_LABEL } from '../../../lib/labels.js';
import LocationFilters from '../../../components/LocationFilters.js';
import { Notice, Loading, PageHeader } from '../../../components/ui.js';

const LIMIT = 200;

export default function FunnelPage() {
  const [filters, setFilters] = useState({ province: '', district: '', category: '' });
  const [data, setData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const load = useCallback(async () => {
    try {
      const [businesses, funnel] = await Promise.all([
        api(`/businesses${qs({ ...filters, limit: LIMIT })}`),
        api(`/funnel${qs({ province: filters.province })}`),
      ]);
      setData({ businesses, funnel });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  async function moveTo(businessId, stage) {
    const business = data.businesses.items.find((b) => b._id === businessId);
    if (!business || business.stage === stage) return;
    if (stage === 'do_not_contact' && !window.confirm(`"${business.name}" iletişim kurulmayacak olarak işaretlensin mi?\nBekleyen taslakları iptal edilir ve bu işlem geri alınamaz.`)) return;
    try {
      await api(`/businesses/${businessId}/stage`, { method: 'POST', json: { stage } });
      setNotice(null);
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  const items = data?.businesses.items ?? [];
  return (
    <div>
      <PageHeader title="Huni" />
      <div className="card mb-4">
        <LocationFilters value={filters} onChange={setFilters} />
      </div>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      {!data ? <Loading /> : (
        <>
          {data.businesses.total > LIMIT && (
            <p className="mb-3 text-sm text-amber-700">Toplam {data.businesses.total} işletme var; ilk {LIMIT} tanesi gösteriliyor. Filtreyle daraltın.</p>
          )}
          <p className="mb-3 text-xs text-gray-500">Kartları sürükleyerek aşama değiştirebilirsiniz. Toplam {data.businesses.total} işletme.</p>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {STAGES.map((stage) => {
              const cards = items.filter((b) => b.stage === stage.value);
              return (
                <section key={stage.value}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(stage.value); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(null); moveTo(e.dataTransfer.getData('text/plain'), stage.value); }}
                  className={`flex w-60 shrink-0 flex-col rounded-lg border p-2 ${dragOver === stage.value ? 'border-brand bg-brand-light' : 'border-gray-200 bg-gray-100'} ${stage.value === 'do_not_contact' ? 'border-accent/30' : ''}`}
                  aria-label={stage.label}>
                  <h2 className={`mb-2 flex items-center justify-between px-1 text-sm font-semibold ${stage.value === 'do_not_contact' ? 'text-accent' : 'text-gray-700'}`}>
                    {stage.label}
                    <span className="rounded-full bg-white px-2 text-xs font-normal text-gray-500">{cards.length}</span>
                  </h2>
                  <div className="flex min-h-24 flex-col gap-2">
                    {cards.map((b) => (
                      <article key={b._id} draggable={b.stage !== 'do_not_contact'}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', b._id)}
                        className={`rounded-md border border-gray-200 bg-white p-2 text-sm shadow-sm ${b.stage !== 'do_not_contact' ? 'cursor-grab' : 'opacity-75'}`}>
                        <Link href={`/businesses/${b._id}`} className="font-medium hover:text-brand">{b.name}</Link>
                        <p className="text-xs text-gray-500">{b.location.district}, {b.location.province} · {CATEGORY_LABEL[b.category]}</p>
                        {!b.contact?.email && <p className="mt-1 text-xs text-amber-700">E-posta yok</p>}
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="card mt-2">
            <h2 className="h2 mb-2">Mesaj durumu {data.funnel.province ? `(${data.funnel.province})` : ''}</h2>
            <div className="flex flex-wrap gap-4 text-sm">
              {[['draft', 'Taslak'], ['approved', 'Onaylı'], ['sent', 'Gönderildi'], ['delivered', 'Teslim'], ['opened', 'Açıldı'], ['replied', 'Cevap'], ['bounced', 'Geri döndü'], ['failed', 'Başarısız']].map(([k, l]) => (
                <div key={k}><span className="text-gray-500">{l}:</span> <strong>{data.funnel.messages[k]}</strong></div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
