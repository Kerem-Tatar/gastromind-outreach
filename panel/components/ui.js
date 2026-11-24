'use client';

import { STAGE_LABEL, MESSAGE_STATUS_LABEL } from '../lib/labels.js';

export function Notice({ notice, onClose }) {
  if (!notice) return null;
  const tone = notice.type === 'error' ? 'bg-accent-light text-accent border-accent/30' : 'bg-brand-light text-brand border-brand/30';
  return (
    <div role="status" className={`mb-4 flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm ${tone}`}>
      <div className="whitespace-pre-line">{notice.text}</div>
      {onClose && <button type="button" onClick={onClose} aria-label="Kapat" className="opacity-60 hover:opacity-100">×</button>}
    </div>
  );
}

const STAGE_TONE = {
  new: 'bg-gray-100 text-gray-700', contacted: 'bg-blue-50 text-blue-700', replied: 'bg-amber-50 text-amber-700',
  meeting: 'bg-violet-50 text-violet-700', pilot: 'bg-teal-50 text-teal-700', customer: 'bg-brand-light text-brand',
  lost: 'bg-gray-200 text-gray-600', do_not_contact: 'bg-accent-light text-accent',
};

export function StageBadge({ stage }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STAGE_TONE[stage] ?? ''}`}>{STAGE_LABEL[stage] ?? stage}</span>;
}

const STATUS_TONE = {
  draft: 'bg-gray-100 text-gray-700', approved: 'bg-blue-50 text-blue-700', sent: 'bg-brand-light text-brand',
  delivered: 'bg-brand-light text-brand', opened: 'bg-teal-50 text-teal-700', replied: 'bg-violet-50 text-violet-700',
  rejected: 'bg-gray-200 text-gray-600', bounced: 'bg-accent-light text-accent', failed: 'bg-accent-light text-accent',
};

export function StatusBadge({ status }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TONE[status] ?? ''}`}>{MESSAGE_STATUS_LABEL[status] ?? status}</span>;
}

export function Loading({ text = 'Yükleniyor…' }) {
  return <p className="py-8 text-center text-sm text-gray-500">{text}</p>;
}

export function Empty({ children }) {
  return <p className="py-8 text-center text-sm text-gray-500">{children}</p>;
}

export function PageHeader({ title, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="h1">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
