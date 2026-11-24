// Taslak üretimi ve onay akışı. Sistem sadece taslak üretir (Kural 1).
import { Business } from '../models/Business.js';
import { Message } from '../models/Message.js';
import { badRequest, conflict, notFound } from './errors.js';
import { getCampaign } from './campaignService.js';
import { assertObjectId } from './businessService.js';
import { isSuppressed } from './suppressionService.js';
import { renderTemplate, templateContext, assertValidTemplate } from './template.js';
import { getSettings, resolveBookingUrl, resolveSender } from './settingsService.js';
import { buildOutgoingEmail } from './emailBuilder.js';
import { fromHeader } from './mailer.js';
import { env } from '../config/env.js';

function targetFilter(target) {
  const filter = {};
  if (target.provinces?.length) filter['location.province'] = { $in: target.provinces };
  if (target.districts?.length) filter['location.district'] = { $in: target.districts };
  if (target.categories?.length) filter.category = { $in: target.categories };
  return filter;
}

// Kampanya hedefindeki (veya verilen) işletmeler için ilk mail taslaklarını üretir.
export async function generateInitialDrafts(campaignId, { businessIds } = {}) {
  const campaign = await getCampaign(campaignId);
  if (!campaign.isActive) throw badRequest('Kampanya aktif değil.');
  assertValidTemplate(campaign.initialSubject, 'Konu');
  assertValidTemplate(campaign.initialBody, 'Metin');

  let filter;
  if (Array.isArray(businessIds) && businessIds.length) {
    businessIds.forEach(assertObjectId);
    filter = { _id: { $in: businessIds } };
  } else {
    filter = { ...targetFilter(campaign.target), stage: 'new' };
  }
  const businesses = await Business.find(filter);
  const settings = await getSettings();
  const bookingUrl = resolveBookingUrl(settings);

  const created = [];
  const skipped = [];
  for (const business of businesses) {
    const reason = await skipReason(business, campaign._id);
    if (reason) {
      skipped.push({ business: business._id, name: business.name, reason });
      continue;
    }
    const ctx = templateContext(business, { bookingUrl });
    const message = await Message.create({
      business: business._id,
      campaign: campaign._id,
      channel: 'email',
      kind: 'initial',
      to: business.contact.email,
      subject: renderTemplate(campaign.initialSubject, ctx),
      body: renderTemplate(campaign.initialBody, ctx),
      status: 'draft',
    });
    created.push(message);
  }
  return { created, skipped };
}

async function skipReason(business, campaignId) {
  if (business.stage === 'do_not_contact') return 'do_not_contact';
  if (!business.contact?.email) return 'no_email';
  if (await isSuppressed(business.contact.email)) return 'suppressed';
  const existing = await Message.exists({
    business: business._id,
    campaign: campaignId,
    kind: 'initial',
    status: { $ne: 'rejected' },
  });
  if (existing) return 'already_has_message';
  return null;
}

export async function getMessage(id) {
  assertObjectId(id);
  const message = await Message.findById(id);
  if (!message) throw notFound('Mesaj bulunamadı.');
  return message;
}

export async function listMessages({ status, campaign, business, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (campaign) { assertObjectId(campaign); filter.campaign = campaign; }
  if (business) { assertObjectId(business); filter.business = business; }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    Message.find(filter).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit)
      .populate('business', 'name location stage contact.email'),
    Message.countDocuments(filter),
  ]);
  return { items, total, page: safePage, limit: safeLimit };
}

// Taslak düzenleme. Onaylanmış bir mesaj düzenlenirse tekrar taslağa döner (yeniden onay gerekir).
export async function updateDraft(id, { subject, body }) {
  const message = await getMessage(id);
  if (!['draft', 'approved'].includes(message.status)) throw conflict('Sadece gönderilmemiş taslaklar düzenlenebilir.', 'not_editable');
  if (subject !== undefined) message.subject = String(subject);
  if (body !== undefined) message.body = String(body);
  if (message.status === 'approved') {
    message.status = 'draft';
    message.approvedAt = undefined;
  }
  await message.save();
  return message;
}

export async function approveMessage(id) {
  const message = await getMessage(id);
  if (message.status !== 'draft') throw conflict('Sadece taslak durumundaki mesajlar onaylanabilir.', 'not_draft');
  if (!message.subject.trim() || !message.body.trim()) throw badRequest('Konu ve metin boş olamaz.');
  const business = await Business.findById(message.business);
  if (!business || business.stage === 'do_not_contact') throw conflict('Bu işletmeye mesaj gönderilemez.', 'do_not_contact');
  if (await isSuppressed(message.to)) throw conflict('Bu adres ret listesinde; onaylanamaz.', 'suppressed');
  message.status = 'approved';
  message.approvedAt = new Date();
  await message.save();
  return message;
}

// Toplu onay: sadece açıkça listelenen (arayüzde görünen) taslak kimlikleri onaylanır.
export async function approveMany(ids) {
  if (!Array.isArray(ids) || !ids.length) throw badRequest('Onaylanacak mesaj kimlikleri (ids) gerekli.');
  if (ids.length > 200) throw badRequest('Tek seferde en fazla 200 mesaj onaylanabilir.');
  const approved = [];
  const failed = [];
  for (const id of ids) {
    try {
      approved.push(await approveMessage(id));
    } catch (err) {
      failed.push({ id, error: err.message });
    }
  }
  return { approved, failed };
}

export async function rejectMessage(id) {
  const message = await getMessage(id);
  if (!['draft', 'approved'].includes(message.status)) throw conflict('Sadece gönderilmemiş mesajlar reddedilebilir.', 'not_rejectable');
  message.status = 'rejected';
  await message.save();
  return message;
}

export async function markReplied(id) {
  const message = await getMessage(id);
  if (!['sent', 'delivered', 'opened'].includes(message.status)) throw conflict('Sadece gönderilmiş mesajlar cevaplandı olarak işaretlenebilir.');
  message.status = 'replied';
  await message.save();
  return message;
}

// Gerçek mail önizlemesi (footer ve başlıklar dahil).
export async function previewMessage(id) {
  const message = await getMessage(id);
  const business = await Business.findById(message.business);
  if (!business) throw notFound('İşletme bulunamadı.');
  const settings = await getSettings();
  let from;
  try { from = fromHeader(); } catch { from = env.mailFromName || '(gönderen adresi tanımlı değil)'; }
  return buildOutgoingEmail({ message, business, sender: resolveSender(settings), from });
}
