// Resend gönderim istemcisi (bağımlılık yok, fetch ile). Zaman aşımı ve anlamlı hata yönetimi içerir.
import { env } from '../config/env.js';
import { AppError } from './errors.js';

const RESEND_URL = 'https://api.resend.com/emails';
const TIMEOUT_MS = 15000;

export function fromHeader() {
  const address = env.mailFromAddress;
  if (!address) throw new AppError(422, 'Gönderen adresi (MAIL_FROM_ADDRESS) tanımlı değil.', 'sender_incomplete');
  return env.mailFromName ? `${env.mailFromName} <${address}>` : address;
}

// Resend'e gönderir, { id } döner. Hata durumunda Türkçe mesajlı AppError fırlatır.
export async function resendTransport(email, { fetchImpl = fetch } = {}) {
  if (!env.resendApiKey) throw new AppError(503, 'E-posta servisi yapılandırılmamış (RESEND_API_KEY eksik).', 'mailer_not_configured');
  let res;
  try {
    res = await fetchImpl(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: email.from,
        to: [email.to],
        reply_to: email.replyTo,
        subject: email.subject,
        text: email.text,
        html: email.html,
        headers: email.headers,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    throw new AppError(502, timeout ? 'E-posta servisi zaman aşımına uğradı.' : 'E-posta servisine ulaşılamadı.', 'mailer_unreachable');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const permanent = res.status === 422 || res.status === 400;
    const error = new AppError(502, `E-posta servisi isteği reddetti (HTTP ${res.status}).`, permanent ? 'mailer_rejected' : 'mailer_error');
    error.providerMessage = typeof data?.message === 'string' ? data.message.slice(0, 300) : undefined;
    throw error;
  }
  return { id: data.id };
}
