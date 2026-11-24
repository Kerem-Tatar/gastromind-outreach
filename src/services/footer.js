// Yasal footer ve List-Unsubscribe başlıkları (Kural 4).
// Footer gönderim anında eklenir; şablonda veya taslakta saklanmaz, bu yüzden şablondan kaldırılamaz.
import { env } from '../config/env.js';
import { AppError } from './errors.js';

export function unsubscribeUrl(token) {
  return `${env.appBaseUrl}/unsubscribe/${token}`;
}

// Footer için zorunlu gönderen bilgileri eksikse gönderim yapılmaz.
export function assertSenderComplete(sender) {
  const missing = [];
  if (!sender?.fullName && !sender?.companyName) missing.push('gönderen adı');
  if (!sender?.email && !sender?.phone) missing.push('iletişim bilgisi (e-posta veya telefon)');
  if (missing.length) {
    throw new AppError(422, `Yasal footer için eksik gönderen bilgisi: ${missing.join(', ')}. Ayarlardan tamamlayın.`, 'sender_incomplete');
  }
}

export function buildFooterText(sender, token) {
  const name = [sender.fullName, sender.companyName].filter(Boolean).join(' · ');
  const contact = [sender.email, sender.phone].filter(Boolean).join(' · ');
  const lines = [
    '—',
    name,
    contact,
    sender.address || '',
    'Bu e-postayı işletmenizin herkese açık iletişim adresine gönderdik.',
    `Bir daha e-posta almak istemiyorsanız: ${unsubscribeUrl(token)}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function buildListUnsubscribeHeaders(sender, token) {
  const parts = [`<${unsubscribeUrl(token)}>`];
  if (sender.email) parts.push(`<mailto:${sender.email}?subject=unsubscribe>`);
  return {
    'List-Unsubscribe': parts.join(', '),
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
