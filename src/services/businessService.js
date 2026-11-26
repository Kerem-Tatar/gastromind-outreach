import mongoose from 'mongoose';
import { Business } from '../models/Business.js';
import { Message } from '../models/Message.js';
import { STAGES } from '../config/constants.js';
import { badRequest, conflict, notFound } from './errors.js';
import { logActivity, listActivities } from './activityService.js';
import { addSuppression, escapeRegex } from './suppressionService.js';

// API üzerinden düzenlenebilen alanlar. stage ve unsubscribeToken burada değiştirilemez.
const EDITABLE_FIELDS = [
  'name', 'category', 'location', 'contact', 'emailSource', 'emailSourceUrl', 'contactChannel', 'googlePlaceId',
  'googleMapsUrl', 'rating', 'reviewCount', 'priceLevel', 'source', 'priority', 'tags', 'notes', 'nextActionAt',
];

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj?.[k] !== undefined) out[k] = obj[k];
  return out;
}

export function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw badRequest('Geçersiz kimlik.', 'invalid_id');
}

export async function getBusiness(id) {
  assertObjectId(id);
  const business = await Business.findById(id);
  if (!business) throw notFound('İşletme bulunamadı.');
  return business;
}

export async function createBusiness(input) {
  return Business.create(pick(input, EDITABLE_FIELDS));
}

export async function updateBusiness(id, patch) {
  const business = await getBusiness(id);
  if (patch.stage !== undefined) throw badRequest('Aşama değişikliği için /stage uç noktasını kullanın.');
  const fields = pick(patch, EDITABLE_FIELDS);
  const previousEmail = business.contact?.email ?? '';
  for (const [k, v] of Object.entries(fields)) {
    if (['location', 'contact'].includes(k) && v && typeof v === 'object') {
      for (const [sub, subValue] of Object.entries(v)) business.set(`${k}.${sub}`, subValue);
    } else {
      business.set(k, v);
    }
  }
  // E-posta elle değiştirildiyse eski kaynak linki artık bu adresin kanıtı değildir.
  if ((business.contact?.email ?? '') !== previousEmail && fields.emailSourceUrl === undefined) {
    business.emailSourceUrl = undefined;
  }
  if (business.contact?.email) business.contactChannel = 'email';
  await business.save();
  return business;
}

// Silme: bekleyen taslaklar silinir, gönderilmiş mesaj geçmişi ve ret listesi kayıtları korunur (Kural 2).
export async function deleteBusiness(id) {
  const business = await getBusiness(id);
  await Message.deleteMany({ business: business._id, status: { $in: ['draft', 'approved'] } });
  await business.deleteOne();
}

export async function listBusinesses({ province, district, category, stage, q, source, contactChannel, hasEmail, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (source) filter.source = source;
  if (contactChannel) filter.contactChannel = contactChannel;
  if (hasEmail === 'yes') filter['contact.email'] = { $exists: true, $nin: [null, ''] };
  if (hasEmail === 'no') filter['contact.email'] = { $in: [null, ''] };
  if (province) filter['location.province'] = province;
  if (district) filter['location.district'] = district;
  if (category) filter.category = category;
  if (stage) filter.stage = stage;
  if (q) {
    const re = { $regex: escapeRegex(q), $options: 'i' };
    filter.$or = [{ name: re }, { 'contact.email': re }, { tags: re }];
  }
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const [items, total] = await Promise.all([
    Business.find(filter).sort({ createdAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit),
    Business.countDocuments(filter),
  ]);
  return { items, total, page: safePage, limit: safeLimit };
}

export async function getBusinessDetail(id) {
  const business = await getBusiness(id);
  const [activities, messages] = await Promise.all([
    listActivities(business._id),
    Message.find({ business: business._id }).sort({ createdAt: -1 }),
  ]);
  return { business, activities, messages };
}

// Kural 3: do_not_contact geri alınamaz; bekleyen taslaklar iptal edilir, adres ret listesine girer.
export async function changeStage(id, stage, note = '') {
  if (!STAGES.includes(stage)) throw badRequest('Geçersiz aşama.');
  const business = await getBusiness(id);
  if (business.stage === 'do_not_contact') {
    throw conflict('Bu işletme "iletişim kurulmayacak" aşamasında; aşama geri alınamaz.', 'do_not_contact_locked');
  }
  if (business.stage === stage) return business;
  const from = business.stage;
  business.stage = stage;
  await business.save();
  if (stage === 'do_not_contact') await lockDoNotContact(business, note);
  await logActivity(business._id, 'stage_change', note, { meta: { from, to: stage } });
  return business;
}

export async function lockDoNotContact(business, note = '') {
  await Message.updateMany(
    { business: business._id, status: { $in: ['draft', 'approved'] } },
    { $set: { status: 'rejected', error: 'do_not_contact' } },
  );
  if (business.contact?.email) {
    await addSuppression(business.contact.email, 'manual', note || 'İşletme iletişim istemedi (do_not_contact).');
  }
}

const MANUAL_ACTIVITY_TYPES = ['note', 'call', 'meeting'];

export async function addManualActivity(id, { type, text }) {
  if (!MANUAL_ACTIVITY_TYPES.includes(type)) throw badRequest('Aktivite tipi note, call veya meeting olmalı.');
  if (!text || !String(text).trim()) throw badRequest('Aktivite metni boş olamaz.');
  const business = await getBusiness(id);
  return logActivity(business._id, type, String(text).trim());
}
