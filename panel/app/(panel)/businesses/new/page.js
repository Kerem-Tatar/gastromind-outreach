'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '../../../../lib/api-client.js';
import BusinessForm from '../../../../components/BusinessForm.js';
import { Notice, PageHeader } from '../../../../components/ui.js';

export default function NewBusinessPage() {
  const router = useRouter();
  const [notice, setNotice] = useState(null);

  async function create(payload) {
    try {
      const business = await api('/businesses', { method: 'POST', json: { ...payload, source: 'manual' } });
      router.push(`/businesses/${business._id}`);
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  }

  return (
    <div>
      <PageHeader title="Yeni işletme" />
      <Notice notice={notice} onClose={() => setNotice(null)} />
      <div className="card"><BusinessForm onSubmit={create} submitLabel="İşletmeyi ekle" /></div>
    </div>
  );
}
