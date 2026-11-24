// Kural 5: GET hiçbir işlem yapmaz, sadece onay sayfası gösterir. Çıkarma POST ile yapılır.
// POST, RFC 8058 tek tık (List-Unsubscribe=One-Click) isteklerini de karşılar.
import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { findByToken, unsubscribe } from '../services/unsubscribeService.js';

function page(title, body) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title>
<style>body{font-family:Arial,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#222}
h1{color:#1f6f4a;font-size:22px}button{background:#1f6f4a;color:#fff;border:0;padding:12px 20px;border-radius:6px;font-size:16px;cursor:pointer}</style>
</head><body>${body}</body></html>`;
}

const invalidPage = page('Geçersiz bağlantı', '<h1>Bağlantı geçersiz</h1><p>Bu çıkma bağlantısı geçersiz veya süresi dolmuş.</p>');

export function unsubscribeRouter() {
  const r = express.Router();

  r.get('/:token', asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const business = await findByToken(req.params.token);
    if (!business) return res.status(404).type('html').send(invalidPage);
    return res.type('html').send(page('E-posta listesinden çık', `<h1>E-posta listesinden çıkmak istiyor musunuz?</h1>
<p>Onaylarsanız Gastromind size bir daha e-posta göndermeyecek.</p>
<form method="post" action="/unsubscribe/${business.unsubscribeToken}"><button type="submit">Evet, listeden çık</button></form>`));
  }));

  r.post('/:token', express.urlencoded({ extended: false, limit: '2kb' }), asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const business = await unsubscribe(req.params.token);
    if (!business) return res.status(404).type('html').send(invalidPage);
    return res.type('html').send(page('Listeden çıktınız', '<h1>Listeden çıktınız</h1><p>Size bir daha e-posta göndermeyeceğiz. İyi çalışmalar dileriz.</p>'));
  }));

  return r;
}
