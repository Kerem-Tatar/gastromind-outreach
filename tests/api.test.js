// HTTP uçtan uca: Faz 1 kabul akışı, çıkma linki (Kural 5), webhook, API anahtarı.
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { useTestDb } from './helpers/db.js';
import { fakeTransport, IN_WINDOW } from './helpers/factories.js';
import { createApp } from '../src/app.js';
import { Business } from '../src/models/Business.js';
import { Message } from '../src/models/Message.js';
import { Activity } from '../src/models/Activity.js';
import { isSuppressed } from '../src/services/suppressionService.js';
import { signPayload } from '../src/services/webhookVerify.js';

useTestDb();

const KEY = { 'x-api-key': 'test-admin-key-123' };

function setup() {
  const transport = fakeTransport();
  const app = createApp({ transport, now: () => IN_WINDOW, sleep: async () => {} });
  return { app, transport };
}

async function createBusiness(app, overrides = {}) {
  const res = await request(app).post('/api/businesses').set(KEY).send({
    name: 'Moda Kahve',
    category: 'cafe',
    location: { province: 'İstanbul', district: 'Kadıköy' },
    contact: { email: 'info@modakahve.com', contactPerson: 'Ayşe Hanım' },
    emailSource: 'website',
    ...overrides,
  });
  expect(res.status).toBe(201);
  return res.body;
}

describe('admin API koruması', () => {
  it('x-api-key olmadan veya yanlış anahtarla 401 döner', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/businesses')).status).toBe(401);
    expect((await request(app).get('/api/businesses').set('x-api-key', 'yanlis')).status).toBe(401);
    expect((await request(app).get('/api/businesses').set(KEY)).status).toBe(200);
  });

  it('beklenmeyen hatalarda iç detay sızdırmaz, Türkçe hata döner', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/businesses/gecersiz-id').set(KEY);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Geçersiz kimlik.');
  });
});

describe('Faz 1 kabul akışı', () => {
  it('işletme → kampanya → taslak → onay → gönderim → çıkma linki', async () => {
    const { app, transport } = setup();
    const business = await createBusiness(app);

    const campaign = await request(app).post('/api/campaigns').set(KEY).send({
      name: 'Kadıköy kafeleri',
      target: { provinces: ['istanbul'], districts: ['kadıköy'], categories: ['cafe'] },
      initialSubject: '{{businessName}} için Gastromind',
      initialBody: '{{greeting}}\n\n{{district}} bölgesindeki {{businessName}} için kısa bir önerim var.\n{{bookingUrl}}',
    });
    expect(campaign.status).toBe(201);
    expect(campaign.body.target.provinces).toEqual(['İstanbul']);

    const drafts = await request(app).post(`/api/campaigns/${campaign.body._id}/drafts`).set(KEY).send({});
    expect(drafts.status).toBe(201);
    expect(drafts.body.created).toHaveLength(1);
    const messageId = drafts.body.created[0]._id;
    expect(drafts.body.created[0].body).toContain('Merhaba Ayşe Hanım,');

    // Onaysız gönderim denemesi reddedilir
    expect((await request(app).post(`/api/messages/${messageId}/send`).set(KEY)).status).toBe(409);

    const preview = await request(app).get(`/api/messages/${messageId}/preview`).set(KEY);
    expect(preview.body.text).toContain(`/unsubscribe/${business.unsubscribeToken}`);

    expect((await request(app).patch(`/api/messages/${messageId}`).set(KEY).send({ subject: 'Moda Kahve için kısa bir öneri' })).status).toBe(200);
    expect((await request(app).post(`/api/messages/${messageId}/approve`).set(KEY)).body.status).toBe('approved');

    const sent = await request(app).post(`/api/messages/${messageId}/send`).set(KEY);
    expect(sent.status).toBe(200);
    expect(sent.body.status).toBe('sent');
    expect(transport.sent[0].subject).toBe('Moda Kahve için kısa bir öneri');
    expect((await Business.findById(business._id)).stage).toBe('contacted');

    // Çıkma linki: GET sadece onay sayfası (Kural 5)
    const page = await request(app).get(`/unsubscribe/${business.unsubscribeToken}`);
    expect(page.status).toBe(200);
    expect(page.text).toContain('<form method="post"');
    expect(await isSuppressed('info@modakahve.com')).toBe(false);
    expect((await Business.findById(business._id)).stage).toBe('contacted');

    // POST ile çıkarma (RFC 8058 tek tık gövdesiyle)
    const post = await request(app).post(`/unsubscribe/${business.unsubscribeToken}`)
      .type('form').send('List-Unsubscribe=One-Click');
    expect(post.status).toBe(200);
    expect(await isSuppressed('info@modakahve.com')).toBe(true);
    expect((await Business.findById(business._id)).stage).toBe('do_not_contact');
    expect(await Activity.exists({ business: business._id, type: 'unsubscribed' })).toBeTruthy();

    // İkinci POST da güvenli
    expect((await request(app).post(`/unsubscribe/${business.unsubscribeToken}`)).status).toBe(200);

    const funnel = await request(app).get('/api/funnel?province=istanbul').set(KEY);
    expect(funnel.body.stages.do_not_contact).toBe(1);
    expect(funnel.body.messages.sent).toBe(1);
  });

  it('geçersiz çıkma token\'ı 404 döner', async () => {
    const { app } = setup();
    expect((await request(app).get('/unsubscribe/abc')).status).toBe(404);
    expect((await request(app).post(`/unsubscribe/${'0'.repeat(48)}`)).status).toBe(404);
  });

  it('aşama değiştirme ve not ekleme zaman çizelgesine düşer', async () => {
    const { app } = setup();
    const b = await createBusiness(app);
    expect((await request(app).post(`/api/businesses/${b._id}/stage`).set(KEY).send({ stage: 'replied', note: 'Mail ile döndü' })).status).toBe(200);
    expect((await request(app).post(`/api/businesses/${b._id}/activities`).set(KEY).send({ type: 'call', text: 'Arandı, ilgili' })).status).toBe(201);
    expect((await request(app).patch(`/api/businesses/${b._id}`).set(KEY).send({ stage: 'customer' })).status).toBe(400);
    const detail = await request(app).get(`/api/businesses/${b._id}`).set(KEY);
    expect(detail.body.activities.map((a) => a.type).sort()).toEqual(['call', 'stage_change']);
  });

  it('CSV ile işletme ve İYS ret listesi içe aktarılır', async () => {
    const { app } = setup();
    const csv = 'name;category;province;district;email;emailSource\nKafe A;kafe;Ankara;Çankaya;a@kafea.com;website\nKafe B;restoran;Ankara;Yanlışilçe;b@kafeb.com;website\n';
    const res = await request(app).post('/api/businesses/import').set(KEY).set('Content-Type', 'text/csv').send(csv);
    expect(res.body.created).toBe(1);
    expect(res.body.errors).toHaveLength(1);
    const iys = await request(app).post('/api/suppressions/import-iys').set(KEY).send({ csv: 'email\nret@ornek.com\n' });
    expect(iys.body.added).toBe(1);
  });
});

describe('Resend webhook', () => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  function signed(body, ts = Math.floor(Date.now() / 1000)) {
    return { 'svix-id': 'msg_test', 'svix-timestamp': String(ts), 'svix-signature': `v1,${signPayload(secret, 'msg_test', ts, body)}`, 'content-type': 'application/json' };
  }

  it('geçerli imzalı olay mesaj durumunu günceller; bounce ret listesine ekler', async () => {
    const { app } = setup();
    const b = await createBusiness(app);
    const msg = await Message.create({ business: b._id, to: 'info@modakahve.com', subject: 's', body: 'b', status: 'sent', sentAt: new Date(), providerMessageId: 'em_1' });

    const delivered = JSON.stringify({ type: 'email.delivered', data: { email_id: 'em_1', to: ['info@modakahve.com'] } });
    expect((await request(app).post('/webhooks/resend').set(signed(delivered)).send(delivered)).status).toBe(200);
    expect((await Message.findById(msg._id)).status).toBe('delivered');

    const bounced = JSON.stringify({ type: 'email.bounced', data: { email_id: 'em_1', to: ['info@modakahve.com'], bounce: { type: 'Permanent' } } });
    expect((await request(app).post('/webhooks/resend').set(signed(bounced)).send(bounced)).status).toBe(200);
    expect((await Message.findById(msg._id)).status).toBe('bounced');
    expect(await isSuppressed('info@modakahve.com')).toBe(true);
  });

  it('değiştirilmiş gövde ve eski zaman damgası 401 döner', async () => {
    const { app } = setup();
    const body = JSON.stringify({ type: 'email.complained', data: { email_id: 'x', to: ['a@b.com'] } });
    const tampered = body.replace('a@b.com', 'c@d.com');
    expect((await request(app).post('/webhooks/resend').set(signed(body)).send(tampered)).status).toBe(401);
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect((await request(app).post('/webhooks/resend').set(signed(body, old)).send(body)).status).toBe(401);
    expect(await isSuppressed('c@d.com')).toBe(false);
    expect(await isSuppressed('a@b.com')).toBe(false);
  });
});
