// Web sitesinden e-posta bulma (Kural 7) ve robots.txt.
import { describe, it, expect } from 'vitest';
import { findContactEmail, extractEmails, pickBestEmail, normalizeWebsite, USER_AGENT } from '../src/services/emailFinder.js';
import { parseRobots, isAllowed } from '../src/services/robots.js';

// pages: { '/robots.txt': '...', '/': '<html>' } — olmayan sayfa 404.
function fakeSite(pages, { redirects = {}, hang = [] } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ua: init?.headers?.['User-Agent'] });
    const path = new URL(url).pathname;
    if (hang.includes(path)) {
      const err = new Error('timeout'); err.name = 'TimeoutError'; throw err;
    }
    if (redirects[path]) {
      const r = new Response(pages[path] ?? '', { status: 200, headers: { 'content-type': 'text/html' } });
      Object.defineProperty(r, 'url', { value: redirects[path] });
      return r;
    }
    if (!(path in pages)) return new Response('yok', { status: 404 });
    return new Response(pages[path], { status: 200, headers: { 'content-type': path.endsWith('.txt') ? 'text/plain' : 'text/html; charset=utf-8' } });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

describe('e-posta çıkarma', () => {
  it('mailto ve düz metindeki adresleri bulur, çöp adresleri eler', () => {
    const html = `<a href="mailto:Info@KahveEvi.com?subject=x">yaz</a> rezervasyon: rezervasyon@kahveevi.com
      <img src="logo@2x.png"> noreply@kahveevi.com user@example.com 5f2a9c8e7d6b5a4c3e2f1a0b@sentry.wixpress.com bilgi&#64;kahveevi.com`;
    expect(extractEmails(html).sort()).toEqual(['bilgi@kahveevi.com', 'info@kahveevi.com', 'rezervasyon@kahveevi.com']);
  });

  it('sitenin kendi alan adındaki adresi tercih eder', () => {
    expect(pickBestEmail(['kahveevi@gmail.com', 'info@kahveevi.com'], 'kahveevi.com')).toBe('info@kahveevi.com');
    expect(pickBestEmail(['kahveevi@gmail.com'], 'kahveevi.com')).toBe('kahveevi@gmail.com');
  });

  it('sadece herkese açık http(s) siteleri kabul eder', () => {
    expect(normalizeWebsite('kahveevi.com/menu')).toBe('https://kahveevi.com');
    expect(normalizeWebsite('http://localhost:4000')).toBeNull();
    expect(normalizeWebsite('http://192.168.1.10')).toBeNull();
    expect(normalizeWebsite('ftp://kahveevi.com')).toBeNull();
  });
});

describe('robots.txt', () => {
  const robots = parseRobots(`User-agent: *\nDisallow: /iletisim\nAllow: /iletisim/genel\n\nUser-agent: BadBot\nDisallow: /`);
  it('genel kurallara uyar, en uzun eşleşme kazanır', () => {
    expect(isAllowed(robots, 'GastromindOutreachBot', '/')).toBe(true);
    expect(isAllowed(robots, 'GastromindOutreachBot', '/iletisim')).toBe(false);
    expect(isAllowed(robots, 'GastromindOutreachBot', '/iletisim/genel')).toBe(true);
    expect(isAllowed(robots, 'BadBot', '/')).toBe(false);
  });
  it('bize özel grup varsa genel grubu değil onu uygular', () => {
    const r = parseRobots('User-agent: *\nDisallow: /\n\nUser-agent: GastromindOutreachBot\nAllow: /');
    expect(isAllowed(r, 'GastromindOutreachBot', '/contact')).toBe(true);
  });
});

describe('Kural 7: sadece işletmenin kendi sitesinde yayınladığı adres', () => {
  it('iletişim sayfasındaki adresi kaynak URL ile döndürür; açık User-Agent kullanır', async () => {
    const site = fakeSite({ '/robots.txt': '', '/': '<p>Hoş geldiniz</p>', '/iletisim': '<a href="mailto:merhaba@kahveevi.com">' });
    const res = await findContactEmail('https://www.kahveevi.com', { fetchImpl: site });
    expect(res).toMatchObject({ email: 'merhaba@kahveevi.com', sourceUrl: 'https://www.kahveevi.com/iletisim' });
    expect(site.calls.every((c) => c.ua === USER_AGENT)).toBe(true);
  });

  it('sadece izinli 4 sayfaya ve sayfa başına bir kez gider', async () => {
    const site = fakeSite({ '/robots.txt': '', '/': 'x', '/iletisim': 'x', '/contact': 'x', '/hakkimizda': 'x' });
    const res = await findContactEmail('kahveevi.com', { fetchImpl: site });
    expect(res.email).toBeNull();
    expect(site.calls.map((c) => new URL(c.url).pathname)).toEqual(['/robots.txt', '/', '/iletisim', '/contact', '/hakkimizda']);
  });

  it('robots.txt yasaklıyorsa sayfaları açmaz', async () => {
    const site = fakeSite({ '/robots.txt': 'User-agent: *\nDisallow: /', '/': 'info@kahveevi.com' });
    const res = await findContactEmail('kahveevi.com', { fetchImpl: site });
    expect(res).toMatchObject({ email: null, reason: 'robots_disallowed' });
    expect(site.calls).toHaveLength(1);
  });

  it('robots.txt okunamazsa (zaman aşımı) siteyi taramaz', async () => {
    const site = fakeSite({ '/': 'info@kahveevi.com' }, { hang: ['/robots.txt'] });
    const res = await findContactEmail('kahveevi.com', { fetchImpl: site });
    expect(res).toMatchObject({ email: null, reason: 'robots_unreachable' });
  });

  it('başka siteye yönlendirilen sayfadaki adresi kullanmaz', async () => {
    const site = fakeSite({ '/robots.txt': '', '/': 'iletisim@baskasirket.com' }, { redirects: { '/': 'https://instagram.com/kahveevi' } });
    expect((await findContactEmail('kahveevi.com', { fetchImpl: site })).email).toBeNull();
  });

  it('adres tahmin etmez: sitede adres yoksa info@alanadi gibi bir şey üretmez', async () => {
    const site = fakeSite({ '/robots.txt': '', '/': '<h1>Kahve Evi</h1> Ahmet Yılmaz', '/iletisim': 'Tel: 0312 000 00 00' });
    const res = await findContactEmail('kahveevi.com', { fetchImpl: site });
    expect(res.email).toBeNull();
  });
});
