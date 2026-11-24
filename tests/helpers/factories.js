import { Business } from '../../src/models/Business.js';
import { Campaign } from '../../src/models/Campaign.js';
import { Message } from '../../src/models/Message.js';

// Salı 24 Kasım 2026, 10:00 İstanbul (07:00 UTC) — gönderim saatleri içinde.
export const IN_WINDOW = new Date('2026-11-24T07:00:00Z');
// Cumartesi 28 Kasım 2026, 11:00 İstanbul
export const WEEKEND = new Date('2026-11-28T08:00:00Z');
// Salı 24 Kasım 2026, 19:00 İstanbul
export const EVENING = new Date('2026-11-24T16:00:00Z');

let seq = 0;

export function makeBusiness(overrides = {}) {
  seq += 1;
  return Business.create({
    name: `Test Kafe ${seq}`,
    category: 'cafe',
    location: { province: 'Ankara', district: 'Çankaya' },
    contact: { email: `info@kafe${seq}.com.tr`, contactPerson: 'Ahmet Bey' },
    emailSource: 'website',
    ...overrides,
  });
}

export function makeCampaign(overrides = {}) {
  return Campaign.create({
    name: 'Ankara kafeleri',
    target: { provinces: ['Ankara'], districts: [], categories: ['cafe'] },
    initialSubject: '{{businessName}} için kısa bir öneri',
    initialBody: '{{greeting}}\n\n{{district}} bölgesindeki {{category}} olarak {{businessName}} için bir fikrim var.\nDemo: {{bookingUrl}}',
    ...overrides,
  });
}

export function makeMessage(business, overrides = {}) {
  return Message.create({
    business: business._id,
    channel: 'email',
    kind: 'manual',
    to: business.contact.email,
    subject: 'Merhaba',
    body: 'Merhaba, kısa bir tanıtım.',
    status: 'draft',
    ...overrides,
  });
}

export function fakeTransport() {
  const sent = [];
  const transport = async (email) => {
    sent.push(email);
    return { id: `re_${sent.length}_${Date.now()}` };
  };
  transport.sent = sent;
  return transport;
}
