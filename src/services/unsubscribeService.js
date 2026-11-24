// Tek tıkla çıkma (Kural 4–5). Sadece POST ile çağrılır; GET onay sayfası gösterir.
import { Business } from '../models/Business.js';
import { addSuppression } from './suppressionService.js';
import { logActivity } from './activityService.js';
import { lockDoNotContact } from './businessService.js';

const TOKEN_RE = /^[a-f0-9]{48}$/;

export async function findByToken(token) {
  if (!TOKEN_RE.test(String(token))) return null;
  return Business.findOne({ unsubscribeToken: token });
}

// Adresi ret listesine ekler ve işletmeyi do_not_contact'a kilitler. Tekrar çağrılması güvenlidir.
export async function unsubscribe(token) {
  const business = await findByToken(token);
  if (!business) return null;
  if (business.contact?.email) await addSuppression(business.contact.email, 'unsubscribed', 'Çıkma linki ile');
  if (business.stage !== 'do_not_contact') {
    const from = business.stage;
    business.stage = 'do_not_contact';
    await business.save();
    await lockDoNotContact(business, 'Çıkma linki ile listeden çıktı.');
    await logActivity(business._id, 'unsubscribed', 'Çıkma linki ile listeden çıktı.', { meta: { from, to: 'do_not_contact' } });
  }
  return business;
}
