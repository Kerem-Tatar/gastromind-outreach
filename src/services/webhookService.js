// Resend webhook olaylarını işler: durum güncellemesi, bounce/complaint → ret listesi (Kural 2).
import { Message } from '../models/Message.js';
import { MESSAGE_FLOW } from '../config/constants.js';
import { addSuppression } from './suppressionService.js';
import { logActivity } from './activityService.js';

const FORWARD_STATUS = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.opened': 'opened',
};

// Sadece ileri yönde ilerletir (ör. opened → delivered geri dönmez).
function advance(current, next) {
  const ci = MESSAGE_FLOW.indexOf(current);
  const ni = MESSAGE_FLOW.indexOf(next);
  return ci !== -1 && ni > ci ? next : current;
}

function isHardBounce(data) {
  const type = String(data?.bounce?.type ?? '').toLowerCase();
  // Tipi belirtilmemişse güvenli tarafta kalınır ve kalıcı kabul edilir.
  return !['transient', 'temporary', 'soft', 'undetermined'].includes(type);
}

export async function handleResendEvent(event) {
  const type = event?.type;
  const data = event?.data ?? {};
  const providerId = data.email_id;
  const message = providerId ? await Message.findOne({ providerMessageId: providerId }) : null;
  const recipients = Array.isArray(data.to) ? data.to : data.to ? [data.to] : [];
  const addresses = message?.to ? [message.to] : recipients;

  if (FORWARD_STATUS[type]) {
    if (message) {
      const next = advance(message.status, FORWARD_STATUS[type]);
      if (next !== message.status) {
        message.status = next;
        await message.save();
      }
    }
  } else if (type === 'email.bounced') {
    if (isHardBounce(data)) {
      for (const email of addresses) await addSuppression(email, 'bounced', 'Kalıcı geri dönüş (hard bounce)');
      if (message) {
        message.status = 'bounced';
        message.error = 'hard_bounce';
        await message.save();
      }
    }
  } else if (type === 'email.complained') {
    for (const email of addresses) await addSuppression(email, 'complained', 'Spam şikayeti');
  } else if (type === 'email.failed' && message && message.status === 'sent') {
    message.status = 'failed';
    message.error = 'provider_failed';
    await message.save();
  } else {
    return { handled: false };
  }

  if (message) {
    await logActivity(message.business, 'message_event', type, { message: message._id });
  }
  return { handled: true, messageFound: Boolean(message) };
}
