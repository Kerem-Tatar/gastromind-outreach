// Gönderilecek nihai maili (footer + başlıklar dahil) üretir. Önizleme ve gönderim aynı fonksiyonu kullanır.
import { assertSenderComplete, buildFooterText, buildListUnsubscribeHeaders, unsubscribeUrl } from './footer.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function linkify(escaped) {
  // Uzun linkler (çıkma linki vb.) telefonda taşmasın diye satır içinde kırılabilir.
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="word-break:break-all">$1</a>');
}

function textToHtml(text) {
  return linkify(escapeHtml(text)).replace(/\n/g, '<br>');
}

export function buildOutgoingEmail({ message, business, sender, from }) {
  assertSenderComplete(sender);
  const token = business.unsubscribeToken;
  const footer = buildFooterText(sender, token);
  const text = `${message.body.trimEnd()}\n\n${footer}\n`;
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#222">${textToHtml(message.body.trimEnd())}</div>` +
    `<div style="font-family:Arial,sans-serif;font-size:12px;line-height:1.5;color:#666;margin-top:24px;overflow-wrap:anywhere">${textToHtml(footer)}` +
    `<br><a href="${escapeHtml(unsubscribeUrl(token))}">Listeden çık</a></div>`;
  return {
    from,
    to: message.to,
    replyTo: sender.email || undefined,
    subject: message.subject,
    text,
    html,
    headers: buildListUnsubscribeHeaders(sender, token),
  };
}
