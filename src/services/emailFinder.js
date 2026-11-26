// İşletmenin KENDİ web sitesinde yayınladığı iletişim e-postasını bulur (Kural 7).
// - Sadece ana sayfa ve /iletisim, /contact, /hakkimizda sayfaları; sayfa başına tek istek.
// - robots.txt'ye uyulur, her istekte zaman aşımı vardır, açık bir User-Agent kullanılır.
// - E-posta tahmini YAPILMAZ: sadece sayfada açıkça yazan adresler döner.
const USER_AGENT_TOKEN = 'GastromindOutreachBot';
export const USER_AGENT = `${USER_AGENT_TOKEN}/1.0 (+https://gastro-mind.com; iletisim: info@gastro-mind.com)`;
export const CONTACT_PATHS = ['/', '/iletisim', '/contact', '/hakkimizda'];
const TIMEOUT_MS = 8000;
const MAX_BYTES = 1_000_000;

import { isAllowed, parseRobots } from './robots.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const IGNORED_DOMAINS = [
  'example.com', 'example.org', 'domain.com', 'email.com', 'sentry.io', 'wixpress.com', 'sentry-next.wixpress.com',
  'godaddy.com', 'wordpress.com', 'wordpress.org', 'w3.org', 'schema.org', 'googleapis.com', 'cloudflare.com',
];
const IGNORED_LOCAL = /^(no-?reply|do-?not-?reply|bounce|mailer-daemon|postmaster|abuse|privacy|kvkk|webmaster|admin|root|test)$/i;
const ASSET_SUFFIX = /\.(png|jpe?g|gif|webp|svg|css|js|ico|avif)$/i;

// Sadece herkese açık http(s) adresleri. Yerel/özel ağ adresleri reddedilir.
export function normalizeWebsite(url) {
  const raw = String(url ?? '').trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) && !/^https?:\/\//i.test(raw)) return null; // ftp:// vb.
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!['http:', 'https:'].includes(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host) || host.includes(':')) return null; // çıplak IP adresleri
  return u.origin;
}

function hostOf(origin) {
  return new URL(origin).hostname.replace(/^www\./, '').toLowerCase();
}

// HTML içinden e-posta adaylarını çıkarır (mailto: linkleri + metin). Cloudflare gizlemesi çözülmez.
export function extractEmails(html) {
  const text = String(html ?? '')
    .replace(/&#64;|&#x40;|\[at\]|\(at\)/gi, '@')
    .replace(/%40/g, '@');
  const found = new Set();
  for (const m of text.matchAll(/mailto:([^"'?\s>]+)/gi)) {
    for (const e of decodeURIComponentSafe(m[1]).match(EMAIL_RE) ?? []) found.add(e.toLowerCase());
  }
  for (const e of text.match(EMAIL_RE) ?? []) found.add(e.toLowerCase());
  return [...found].filter(isPlausibleEmail);
}

function decodeURIComponentSafe(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

function isPlausibleEmail(email) {
  const [local, domain] = email.split('@');
  if (!local || !domain || ASSET_SUFFIX.test(email)) return false;
  if (IGNORED_LOCAL.test(local)) return false;
  if (IGNORED_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))) return false;
  if (/^[0-9a-f]{16,}$/i.test(local)) return false; // takip kimliği gibi rastgele dizeler
  return true;
}

// Aynı alan adındaki adres önceliklidir; sonra info@/iletisim@ gibi genel adresler.
export function pickBestEmail(emails, siteHost) {
  if (!emails.length) return null;
  const score = (e) => {
    const [local, domain] = e.split('@');
    let s = 0;
    if (domain === siteHost || domain.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${domain}`)) s += 10;
    if (/^(info|iletisim|contact|merhaba|hello|rezervasyon|reservation|bilgi)$/.test(local)) s += 3;
    return s;
  };
  return [...emails].sort((a, b) => score(b) - score(a))[0];
}

async function fetchText(url, fetchImpl) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,text/plain;q=0.9,*/*;q=0.1', 'Accept-Language': 'tr,en;q=0.5' },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, status: res.status, text: '' };
  const type = res.headers.get('content-type') ?? '';
  if (type && !/text\/|html|xml/i.test(type)) return { ok: false, status: res.status, text: '' };
  const buf = await res.arrayBuffer();
  return { ok: true, status: res.status, text: Buffer.from(buf.slice(0, MAX_BYTES)).toString('utf8'), url: res.url || url };
}

// Sonuç: { email, sourceUrl } veya { email: null, reason, checked: [...] }
export async function findContactEmail(website, { fetchImpl = fetch } = {}) {
  const origin = normalizeWebsite(website);
  if (!origin) return { email: null, reason: 'invalid_website', checked: [] };
  const siteHost = hostOf(origin);

  let robots = [];
  try {
    const r = await fetchText(`${origin}/robots.txt`, fetchImpl);
    if (r.ok) robots = parseRobots(r.text);
  } catch {
    // robots.txt okunamazsa (zaman aşımı vb.) site taranmaz: güvenli tarafta kal.
    return { email: null, reason: 'robots_unreachable', checked: [] };
  }

  const checked = [];
  let blocked = 0;
  for (const path of CONTACT_PATHS) {
    if (!isAllowed(robots, USER_AGENT_TOKEN, path)) { blocked += 1; continue; }
    const url = `${origin}${path}`;
    checked.push(url);
    let page;
    try {
      page = await fetchText(url, fetchImpl);
    } catch {
      continue;
    }
    if (!page.ok) continue;
    // Başka bir siteye yönlendirildiyse (ör. sosyal medya) oradaki adresler işletmenin sitesi sayılmaz.
    const finalOrigin = normalizeWebsite(page.url);
    if (finalOrigin && hostOf(finalOrigin) !== siteHost) continue;
    const best = pickBestEmail(extractEmails(page.text), siteHost);
    if (best) return { email: best, sourceUrl: url, checked };
  }
  return { email: null, reason: blocked === CONTACT_PATHS.length ? 'robots_disallowed' : 'not_found', checked };
}
