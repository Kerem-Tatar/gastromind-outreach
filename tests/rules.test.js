// Bölüm 3'teki değişmez kuralların servis katmanı testleri.
import { describe, it, expect } from 'vitest';
import { useTestDb } from './helpers/db.js';
import { makeBusiness, makeCampaign, makeMessage, fakeTransport, IN_WINDOW, WEEKEND } from './helpers/factories.js';
import { Business } from '../src/models/Business.js';
import { Message } from '../src/models/Message.js';
import { Suppression } from '../src/models/Suppression.js';
import { sendMessage, sendApprovedBatch } from '../src/services/sendService.js';
import { approveMessage, approveMany, generateInitialDrafts, updateDraft } from '../src/services/draftService.js';
import { changeStage, deleteBusiness } from '../src/services/businessService.js';
import { addSuppression, isSuppressed } from '../src/services/suppressionService.js';
import { updateSettings } from '../src/services/settingsService.js';
import { handleResendEvent } from '../src/services/webhookService.js';
import { importIysRejections, importBusinesses } from '../src/services/importService.js';
import { createCampaign } from '../src/services/campaignService.js';

useTestDb();
const now = () => IN_WINDOW;

describe('Kural 1: onaysız gönderim yok', () => {
  it('taslak durumundaki mesaj gönderilemez', async () => {
    const t = fakeTransport();
    const msg = await makeMessage(await makeBusiness());
    await expect(sendMessage(msg._id, { transport: t, now })).rejects.toMatchObject({ code: 'not_approved' });
    expect(t.sent).toHaveLength(0);
  });

  it('reddedilmiş mesaj gönderilemez', async () => {
    const t = fakeTransport();
    const msg = await makeMessage(await makeBusiness(), { status: 'rejected' });
    await expect(sendMessage(msg._id, { transport: t, now })).rejects.toMatchObject({ code: 'not_approved' });
    expect(t.sent).toHaveLength(0);
  });

  it('toplu gönderim sadece approved mesajları gönderir', async () => {
    const t = fakeTransport();
    const b1 = await makeBusiness();
    const b2 = await makeBusiness();
    await makeMessage(b1);
    const approved = await makeMessage(b2);
    await approveMessage(approved._id);
    const summary = await sendApprovedBatch({ transport: t, now, sleep: async () => {} });
    expect(summary.sent).toBe(1);
    expect(t.sent.map((e) => e.to)).toEqual([b2.contact.email]);
  });

  it('onaylı mesaj düzenlenirse tekrar taslağa döner', async () => {
    const msg = await makeMessage(await makeBusiness());
    await approveMessage(msg._id);
    const edited = await updateDraft(msg._id, { body: 'Yeni metin' });
    expect(edited.status).toBe('draft');
    await expect(sendMessage(msg._id, { transport: fakeTransport(), now })).rejects.toMatchObject({ code: 'not_approved' });
  });

  it('toplu onay sadece verilen kimlikleri onaylar', async () => {
    const m1 = await makeMessage(await makeBusiness());
    const m2 = await makeMessage(await makeBusiness());
    const res = await approveMany([String(m1._id)]);
    expect(res.approved).toHaveLength(1);
    expect((await Message.findById(m2._id)).status).toBe('draft');
  });
});

describe('Kural 2: ret listesi', () => {
  it('ret listesindeki adrese onaylı mesaj olsa bile gönderilmez', async () => {
    const t = fakeTransport();
    const b = await makeBusiness();
    const msg = await makeMessage(b);
    await approveMessage(msg._id);
    await addSuppression(b.contact.email.toUpperCase(), 'manual');
    await expect(sendMessage(msg._id, { transport: t, now })).rejects.toMatchObject({ code: 'blocked' });
    expect(t.sent).toHaveLength(0);
    expect((await Message.findById(msg._id)).status).toBe('failed');
  });

  it('ret listesindeki adres için taslak üretilmez ve onaylanamaz', async () => {
    const b = await makeBusiness();
    await addSuppression(b.contact.email, 'iys_ret');
    const campaign = await makeCampaign();
    const res = await generateInitialDrafts(campaign._id);
    expect(res.created).toHaveLength(0);
    expect(res.skipped[0].reason).toBe('suppressed');
    const msg = await makeMessage(b);
    await expect(approveMessage(msg._id)).rejects.toMatchObject({ code: 'suppressed' });
  });

  it('işletme silinse bile ret kaydı kalır; aynı adresle yeniden eklenen işletmeye gönderilmez', async () => {
    const b = await makeBusiness({ contact: { email: 'iletisim@silinen.com' } });
    await addSuppression('iletisim@silinen.com', 'unsubscribed');
    await deleteBusiness(b._id);
    expect(await isSuppressed('iletisim@silinen.com')).toBe(true);
    const again = await makeBusiness({ contact: { email: 'iletisim@silinen.com' } });
    const msg = await makeMessage(again, { status: 'approved' });
    await expect(sendMessage(msg._id, { transport: fakeTransport(), now })).rejects.toMatchObject({ code: 'blocked' });
  });

  it('hard bounce ve spam şikayeti ret listesine eklenir; soft bounce eklenmez', async () => {
    await handleResendEvent({ type: 'email.bounced', data: { email_id: 'x1', to: ['hard@ornek.com'], bounce: { type: 'Permanent' } } });
    await handleResendEvent({ type: 'email.bounced', data: { email_id: 'x2', to: ['soft@ornek.com'], bounce: { type: 'Transient' } } });
    await handleResendEvent({ type: 'email.complained', data: { email_id: 'x3', to: ['spam@ornek.com'] } });
    expect((await Suppression.findOne({ email: 'hard@ornek.com' })).reason).toBe('bounced');
    expect(await isSuppressed('soft@ornek.com')).toBe(false);
    expect((await Suppression.findOne({ email: 'spam@ornek.com' })).reason).toBe('complained');
  });

  it('İYS ret listesi CSV ile iys_ret sebebiyle içe aktarılır', async () => {
    const res = await importIysRejections('email\nRet1@Ornek.com\nret2@ornek.com\nret1@ornek.com\ngecersiz\n');
    expect(res).toMatchObject({ added: 2, alreadySuppressed: 1 });
    expect(res.errors).toHaveLength(1);
    expect((await Suppression.findOne({ email: 'ret1@ornek.com' })).reason).toBe('iys_ret');
  });
});

describe('Kural 3: do_not_contact kilidi', () => {
  it('bekleyen taslaklar iptal edilir, aşama geri alınamaz, gönderim yapılamaz', async () => {
    const b = await makeBusiness();
    const draft = await makeMessage(b);
    const approved = await makeMessage(b, { status: 'approved' });
    await changeStage(b._id, 'do_not_contact', 'Telefonda yazmayın dedi');

    expect((await Message.findById(draft._id)).status).toBe('rejected');
    expect((await Message.findById(approved._id)).status).toBe('rejected');
    await expect(changeStage(b._id, 'new')).rejects.toMatchObject({ code: 'do_not_contact_locked' });
    expect((await Business.findById(b._id)).stage).toBe('do_not_contact');
    expect(await isSuppressed(b.contact.email)).toBe(true);

    const sneaky = await makeMessage(b, { status: 'approved' });
    await expect(sendMessage(sneaky._id, { transport: fakeTransport(), now })).rejects.toMatchObject({ code: 'blocked' });
  });

  it('do_not_contact işletme için taslak üretilmez', async () => {
    const b = await makeBusiness();
    await changeStage(b._id, 'do_not_contact');
    const campaign = await makeCampaign();
    const res = await generateInitialDrafts(campaign._id, { businessIds: [String(b._id)] });
    expect(res.created).toHaveLength(0);
    expect(res.skipped[0].reason).toBe('do_not_contact');
  });
});

describe('Kural 4: gönderilen her mailde footer ve başlıklar', () => {
  it('Resend\'e giden mail footer, çıkma linki ve List-Unsubscribe başlıklarını içerir', async () => {
    const t = fakeTransport();
    const b = await makeBusiness();
    const msg = await makeMessage(b, { body: 'Sadece kısa bir metin.' });
    await approveMessage(msg._id);
    await sendMessage(msg._id, { transport: t, now });
    const [email] = t.sent;
    expect(email.text).toContain('Kerem Tatar');
    expect(email.text).toContain(`https://outreach.test/unsubscribe/${b.unsubscribeToken}`);
    expect(email.html).toContain(`/unsubscribe/${b.unsubscribeToken}`);
    expect(email.headers['List-Unsubscribe']).toContain(`/unsubscribe/${b.unsubscribeToken}`);
    expect(email.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('gönderen bilgileri eksikse gönderim yapılmaz', async () => {
    const saved = { ...process.env };
    try {
      for (const k of ['SENDER_FULL_NAME', 'MAIL_FROM_NAME', 'SENDER_PHONE', 'MAIL_REPLY_TO', 'MAIL_FROM_ADDRESS']) process.env[k] = '';
      await updateSettings({ sender: { fullName: '', companyName: '', email: '', phone: '' } });
      const t = fakeTransport();
      const msg = await makeMessage(await makeBusiness(), { status: 'approved' });
      await expect(sendMessage(msg._id, { transport: t, now })).rejects.toMatchObject({ code: 'sender_incomplete' });
      expect(t.sent).toHaveLength(0);
    } finally {
      Object.assign(process.env, saved);
    }
  });
});

describe('Kural 6: gönderim limitleri', () => {
  it('günlük limit aşılamaz', async () => {
    await updateSettings({ dailyLimit: 2 });
    const t = fakeTransport();
    for (let i = 0; i < 3; i += 1) {
      const msg = await makeMessage(await makeBusiness());
      await approveMessage(msg._id);
    }
    const summary = await sendApprovedBatch({ transport: t, now, sleep: async () => {} });
    expect(t.sent).toHaveLength(2);
    expect(summary.stoppedReason).toBe('daily_limit_reached');
  });

  it('günlük limit ayarı 100\'ün üzerine çıkarılamaz', async () => {
    await expect(updateSettings({ dailyLimit: 500 })).rejects.toThrow();
  });

  it('aynı alan adına günde en fazla 2 mail gider', async () => {
    const t = fakeTransport();
    for (const local of ['info', 'rezervasyon', 'iletisim']) {
      const b = await makeBusiness({ contact: { email: `${local}@ayni-zincir.com` } });
      await approveMessage((await makeMessage(b))._id);
    }
    const summary = await sendApprovedBatch({ transport: t, now, sleep: async () => {} });
    expect(t.sent).toHaveLength(2);
    expect(summary.skipped).toBe(1);
    expect(await Message.countDocuments({ status: 'approved' })).toBe(1);
  });

  it('mailler arasında 30–90 sn beklenir', async () => {
    const delays = [];
    for (let i = 0; i < 3; i += 1) await approveMessage((await makeMessage(await makeBusiness()))._id);
    await sendApprovedBatch({ transport: fakeTransport(), now, sleep: async (ms) => { delays.push(ms); } });
    expect(delays).toHaveLength(2);
    for (const ms of delays) {
      expect(ms).toBeGreaterThanOrEqual(30000);
      expect(ms).toBeLessThanOrEqual(90000);
    }
  });

  it('gönderim saatleri dışında gönderilmez', async () => {
    const t = fakeTransport();
    const msg = await makeMessage(await makeBusiness());
    await approveMessage(msg._id);
    await expect(sendMessage(msg._id, { transport: t, now: () => WEEKEND })).rejects.toMatchObject({ code: 'outside_send_window' });
    expect(t.sent).toHaveLength(0);
    expect((await Message.findById(msg._id)).status).toBe('approved');
  });
});

describe('Kural 7: sadece işletmenin yayınladığı iletişim bilgisi', () => {
  it('e-posta kaynağı (emailSource) olmadan e-posta kaydedilemez', async () => {
    await expect(makeBusiness({ emailSource: undefined })).rejects.toThrow(/emailSource/);
    await expect(makeBusiness({ emailSource: 'guessed' })).rejects.toThrow();
  });

  it('CSV içe aktarmada kaynağı olmayan e-posta satırı reddedilir', async () => {
    const csv = 'name,category,province,district,email,emailSource\nA Kafe,kafe,Ankara,Çankaya,a@akafe.com,website\nB Kafe,kafe,Ankara,Çankaya,b@bkafe.com,\n';
    const res = await importBusinesses(csv);
    expect(res.created).toBe(1);
    expect(res.errors[0].line).toBe(3);
  });
});

describe('il/ilçe doğrulaması ve şablon kaydı', () => {
  it('geçersiz il/ilçe ile işletme kaydedilemez, geçerli ad resmi yazıma çevrilir', async () => {
    await expect(makeBusiness({ location: { province: 'Ankara', district: 'Kadıköy' } })).rejects.toThrow(/il\/ilçe/);
    const b = await makeBusiness({ location: { province: 'istanbul', district: 'kadikoy' } });
    expect(b.location).toMatchObject({ province: 'İstanbul', district: 'Kadıköy' });
  });

  it('bilinmeyen değişken içeren kampanya kaydedilemez', async () => {
    await expect(createCampaign({ name: 'x', initialSubject: 'Merhaba {{firstName}}', initialBody: 'x' })).rejects.toThrow(/firstName/);
  });

  it('taslak şablona göre kişiselleştirilir', async () => {
    const b = await makeBusiness({ name: 'Kahve Köşesi', contact: { email: 'merhaba@kahvekosesi.com' } });
    await makeBusiness({ location: { province: 'İzmir', district: 'Karşıyaka' } }); // hedef dışı
    const campaign = await makeCampaign();
    const { created } = await generateInitialDrafts(campaign._id);
    expect(created).toHaveLength(1);
    expect(created[0].subject).toBe('Kahve Köşesi için kısa bir öneri');
    expect(created[0].body).toContain('Merhaba,');
    expect(created[0].body).toContain('Çankaya bölgesindeki kafe');
    expect(created[0].body).toContain('https://cal.com/gastromind/demo');
    expect(String(created[0].business)).toBe(String(b._id));
    const again = await generateInitialDrafts(campaign._id);
    expect(again.created).toHaveLength(0);
  });
});
