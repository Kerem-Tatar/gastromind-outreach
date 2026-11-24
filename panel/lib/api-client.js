'use client';

// Tarayıcı tarafı API çağrısı. İstekler panelin /api köprüsüne gider (anahtar sunucuda eklenir).
export async function api(path, { method = 'GET', json, text, contentType } = {}) {
  const init = { method, headers: {} };
  if (json !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(json);
  } else if (text !== undefined) {
    init.headers['content-type'] = contentType ?? 'text/csv';
    init.body = text;
  }
  const res = await fetch(`/api${path}`, init);
  if (res.status === 401) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error('Oturum süresi doldu.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'İşlem başarısız oldu.');
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}
