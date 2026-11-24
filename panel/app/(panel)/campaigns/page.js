'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client.js';
import { CATEGORY_LABEL, formatDate } from '../../../lib/labels.js';
import { Notice, Loading, Empty, PageHeader } from '../../../components/ui.js';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => { api('/campaigns').then(setCampaigns).catch((err) => setNotice({ type: 'error', text: err.message })); }, []);

  return (
    <div>
      <PageHeader title="Kampanyalar">
        <Link href="/campaigns/new" className="btn-primary">Yeni kampanya</Link>
      </PageHeader>
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="card p-0">
        {!campaigns ? <Loading /> : campaigns.length === 0 ? <Empty>Henüz kampanya yok.</Empty> : (
          <ul className="divide-y divide-gray-100">
            {campaigns.map((c) => (
              <li key={c._id}>
                <Link href={`/campaigns/${c._id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <span className="font-medium">{c.name}</span>
                  {!c.isActive && <span className="rounded-full bg-gray-200 px-2 text-xs text-gray-600">Pasif</span>}
                  <span className="flex-1 text-sm text-gray-500">
                    {[c.target.provinces.join(', ') || 'Tüm iller', c.target.districts.join(', '), c.target.categories.map((x) => CATEGORY_LABEL[x]).join(', ')].filter(Boolean).join(' · ')}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(c.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
