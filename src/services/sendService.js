// Gönderim akışı. Değişmez kurallar burada zorunlu kontrol olarak uygulanır:
// Kural 1 (sadece approved), 2 (ret listesi), 3 (do_not_contact), 4 (footer), 6 (limitler).
import { Business } from '../models/Business.js';
import { Message } from '../models/Message.js';
import {
  SEND_DELAY_MAX_SECONDS, SEND_DELAY_MIN_SECONDS, MAX_EMAILS_PER_DOMAIN_PER_DAY, DAILY_LIMIT_HARD_CAP, SENT_STATUSES,
} from '../config/constants.js';
import { AppError, conflict } from './errors.js';
import { getMessage } from './draftService.js';
import { isSuppressed, escapeRegex } from './suppressionService.js';
import { getSettings, resolveSender } from './settingsService.js';
import { buildOutgoingEmail } from './emailBuilder.js';
import { fromHeader, resendTransport } from './mailer.js';
import { isWithinSendWindow, startOfLocalDay } from './time.js';
import { logActivity } from './activityService.js';
import { logger } from '../config/logger.js';

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function randomDelayMs(random = Math.random) {
  const seconds = SEND_DELAY_MIN_SECONDS + random() * (SEND_DELAY_MAX_SECONDS - SEND_DELAY_MIN_SECONDS);
  return Math.round(seconds * 1000);
}

function domainOf(email) {
  return String(email).split('@')[1]?.toLowerCase() ?? '';
}

export async function countSentToday(now) {
  return Message.countDocuments({ channel: 'email', sentAt: { $gte: startOfLocalDay(now) }, status: { $in: SENT_STATUSES } });
}

export async function countSentToDomainToday(domain, now) {
  return Message.countDocuments({
    channel: 'email',
    sentAt: { $gte: startOfLocalDay(now) },
    status: { $in: SENT_STATUSES },
    to: { $regex: `@${escapeRegex(domain)}$`, $options: 'i' },
  });
}

// Gönderim öncesi tüm kontroller. Kalıcı engelde mesaj 'failed' olur; geçici engelde (limit, saat) 'approved' kalır.
async function checkSendable(message, settings, now) {
  if (message.status !== 'approved') {
    throw conflict('Sadece onaylanmış mesajlar gönderilebilir.', 'not_approved');
  }
  if (message.channel !== 'email') throw conflict('Bu kanal sistem tarafından gönderilmez.', 'channel_not_sendable');
  const business = await Business.findById(message.business);
  if (!business) return { permanent: 'İşletme kaydı bulunamadı.' };
  if (business.stage === 'do_not_contact') return { permanent: 'do_not_contact' };
  if (!message.to) return { permanent: 'Alıcı adresi yok.' };
  if (await isSuppressed(message.to)) return { permanent: 'suppressed' };

  if (!isWithinSendWindow(settings.sendWindow, now)) {
    throw new AppError(409, 'Şu an gönderim saatleri dışında.', 'outside_send_window');
  }
  const dailyLimit = Math.min(settings.dailyLimit, DAILY_LIMIT_HARD_CAP);
  if ((await countSentToday(now)) >= dailyLimit) {
    throw new AppError(429, 'Günlük gönderim limitine ulaşıldı.', 'daily_limit_reached');
  }
  if ((await countSentToDomainToday(domainOf(message.to), now)) >= MAX_EMAILS_PER_DOMAIN_PER_DAY) {
    throw new AppError(429, 'Bu alan adına bugün yeterince mail gönderildi.', 'domain_limit_reached');
  }
  return { business };
}

async function markFailed(message, error) {
  message.status = 'failed';
  message.error = error;
  await message.save();
}

// Tek bir onaylı mesajı gönderir. deps: { transport, now }
export async function sendMessage(id, { transport = resendTransport, now = () => new Date() } = {}) {
  const message = await getMessage(id);
  const settings = await getSettings();
  const check = await checkSendable(message, settings, now());
  if (check.permanent) {
    await markFailed(message, check.permanent);
    throw conflict('Bu mesaj gönderilemez (ret listesi veya iletişim kilidi).', 'blocked');
  }
  const { business } = check;
  const email = buildOutgoingEmail({ message, business, sender: resolveSender(settings), from: fromHeader() });

  // Aynı mesajın iki kez gönderilmesini önlemek için atomik olarak kilitlenir.
  const locked = await Message.findOneAndUpdate(
    { _id: message._id, status: 'approved' },
    { $set: { status: 'sent', sentAt: now() } },
    { new: true },
  );
  if (!locked) throw conflict('Mesaj zaten işleniyor.', 'already_processing');

  try {
    const result = await transport(email);
    locked.providerMessageId = result?.id;
    locked.error = undefined;
    await locked.save();
  } catch (err) {
    const permanent = err?.code === 'mailer_rejected';
    // Geçici hatada mesaj tekrar onaylı duruma döner; kalıcı hatada failed olur.
    locked.status = permanent ? 'failed' : 'approved';
    locked.sentAt = undefined;
    locked.error = err?.message ?? 'Gönderim hatası';
    await locked.save();
    throw err instanceof AppError ? err : new AppError(502, 'Mail gönderilemedi.', 'send_failed');
  }

  business.lastContactedAt = now();
  if (business.stage === 'new') business.stage = 'contacted';
  await business.save();
  await logActivity(business._id, 'message_sent', locked.subject, { message: locked._id });
  return locked;
}

let running = false;

export function isSendRunInProgress() {
  return running;
}

// Onaylı mesajları sırayla, aralarında rastgele 30–90 sn bekleyerek gönderir.
// Limit veya saat dışı durumunda durur. Aynı anda tek çalışma.
export async function sendApprovedBatch({ transport = resendTransport, now = () => new Date(), sleep = defaultSleep, random = Math.random } = {}) {
  if (running) throw conflict('Zaten devam eden bir gönderim var.', 'send_in_progress');
  running = true;
  const summary = { sent: 0, failed: 0, skipped: 0, stoppedReason: null };
  try {
    const queue = await Message.find({ status: 'approved', channel: 'email' }).sort({ approvedAt: 1 }).select('_id');
    let first = true;
    for (const { _id } of queue) {
      if (!first) await sleep(randomDelayMs(random));
      try {
        await sendMessage(_id, { transport, now });
        summary.sent += 1;
        first = false;
      } catch (err) {
        if (['daily_limit_reached', 'outside_send_window', 'mailer_not_configured', 'sender_incomplete'].includes(err.code)) {
          summary.stoppedReason = err.code;
          break;
        }
        if (err.code === 'domain_limit_reached') summary.skipped += 1;
        else summary.failed += 1;
        logger.warn('Gönderim hatası', String(_id), err.code ?? '', err.message);
      }
    }
  } finally {
    running = false;
  }
  return summary;
}
