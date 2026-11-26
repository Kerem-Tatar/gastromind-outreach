// Kampanya hedefleme ve "hedefteki işletmeler" listesi.
import { describe, it, expect } from 'vitest';
import { useTestDb } from './helpers/db.js';
import { makeBusiness, makeCampaign, makeMessage } from './helpers/factories.js';
import { campaignAudience, generateInitialDrafts } from '../src/services/draftService.js';
import { changeStage } from '../src/services/businessService.js';
import { addSuppression } from '../src/services/suppressionService.js';

useTestDb();

const loc = (province, district) => ({ location: { province, district } });

describe('kampanya hedefi', () => {
  it('ilçe seçimi sadece kendi ilinde geçerli; ilçesi seçilmeyen ilin tamamı hedefte', async () => {
    const gazipasa = await makeBusiness({ name: 'Gazipaşa Kahve', ...loc('Antalya', 'Gazipaşa') });
    await makeBusiness({ name: 'Alanya Kahve', ...loc('Antalya', 'Alanya') });
    const karsiyaka = await makeBusiness({ name: 'Karşıyaka Kahve', ...loc('İzmir', 'Karşıyaka') });
    await makeBusiness({ name: 'Çankaya Kahve', ...loc('Ankara', 'Çankaya') });
    const campaign = await makeCampaign({ target: { provinces: ['Antalya', 'İzmir'], districts: ['Gazipaşa'], categories: [] } });

    const audience = await campaignAudience(campaign._id);
    expect(audience.items.map((b) => b.name).sort()).toEqual(['Gazipaşa Kahve', 'Karşıyaka Kahve']);

    const { created } = await generateInitialDrafts(campaign._id);
    expect(created.map((m) => String(m.business)).sort()).toEqual([String(gazipasa._id), String(karsiyaka._id)].sort());
  });

  it('kampanyadan sonra eklenen işletme hedefte görünür', async () => {
    const campaign = await makeCampaign({ target: { provinces: ['Antalya'], districts: ['Gazipaşa'], categories: [] } });
    expect((await campaignAudience(campaign._id)).total).toBe(0);
    await makeBusiness({ name: 'Sonradan Eklenen', ...loc('Antalya', 'Gazipaşa') });
    const audience = await campaignAudience(campaign._id);
    expect(audience.total).toBe(1);
    expect(audience.items[0]).toMatchObject({ name: 'Sonradan Eklenen', status: 'ready' });
  });

  it('her işletmenin taslak uygunluk durumunu raporlar', async () => {
    const campaign = await makeCampaign({ target: { provinces: ['Ankara'], districts: [], categories: [] } });
    await makeBusiness({ name: 'A Hazır' });
    const withMsg = await makeBusiness({ name: 'B Mesajı var' });
    await makeMessage(withMsg, { campaign: campaign._id, kind: 'initial' });
    await makeBusiness({ name: 'C E-postasız', contact: {}, emailSource: undefined });
    const sup = await makeBusiness({ name: 'D Ret listesinde' });
    await addSuppression(sup.contact.email, 'iys_ret');
    const dnc = await makeBusiness({ name: 'E Yazmayın' });
    await changeStage(dnc._id, 'do_not_contact');
    const contacted = await makeBusiness({ name: 'F Görüşüldü' });
    await changeStage(contacted._id, 'meeting');

    const audience = await campaignAudience(campaign._id);
    const byName = Object.fromEntries(audience.items.map((b) => [b.name, b.status]));
    expect(byName).toEqual({
      'A Hazır': 'ready',
      'B Mesajı var': 'already_has_message',
      'C E-postasız': 'no_email',
      'D Ret listesinde': 'suppressed',
      'E Yazmayın': 'do_not_contact',
      'F Görüşüldü': 'not_new',
    });
    expect(audience.counts.ready).toBe(1);

    // "Hazır" sayısı, taslak üretiminin gerçekten ürettiği sayıyla aynı olmalı
    const { created } = await generateInitialDrafts(campaign._id);
    expect(created).toHaveLength(audience.counts.ready);
  });
});
