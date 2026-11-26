import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { CATEGORIES, EMAIL_SOURCES, BUSINESS_SOURCES, STAGES, CONTACT_CHANNELS } from '../config/constants.js';
import { resolveLocation } from '../services/locations.js';

const { Schema } = mongoose;

export function newUnsubscribeToken() {
  return crypto.randomBytes(24).toString('hex');
}

const locationSchema = new Schema(
  {
    province: { type: String, required: [true, 'İl zorunludur.'], trim: true },
    district: { type: String, required: [true, 'İlçe zorunludur.'], trim: true },
    neighborhood: { type: String, trim: true },
    address: { type: String, trim: true },
    lat: Number,
    lng: Number,
  },
  { _id: false },
);

const contactSchema = new Schema(
  {
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    website: { type: String, trim: true },
    instagram: { type: String, trim: true },
    contactPerson: { type: String, trim: true },
  },
  { _id: false },
);

const businessSchema = new Schema(
  {
    name: { type: String, required: [true, 'İşletme adı zorunludur.'], trim: true },
    category: { type: String, enum: CATEGORIES, required: true, default: 'other' },
    location: { type: locationSchema, required: true },
    contact: { type: contactSchema, default: () => ({}) },
    emailSource: { type: String, enum: EMAIL_SOURCES },
    // E-postanın bulunduğu sayfa (ör. web sitesinin iletişim sayfası) — Kural 7 kanıtı.
    emailSourceUrl: { type: String, trim: true },
    // Önerilen iletişim kanalı: e-posta bulunamazsa instagram/phone (sistem sadece e-posta gönderir).
    contactChannel: { type: String, enum: CONTACT_CHANNELS, default: 'email' },
    googleMapsUrl: { type: String, trim: true },
    googlePlaceId: { type: String, unique: true, sparse: true },
    rating: Number,
    reviewCount: Number,
    priceLevel: Number,
    source: { type: String, enum: BUSINESS_SOURCES, default: 'manual' },
    stage: { type: String, enum: STAGES, default: 'new' },
    priority: { type: Number, min: 1, max: 3, default: 2 },
    tags: { type: [String], default: [] },
    notes: { type: String, default: '' },
    lastContactedAt: Date,
    nextActionAt: Date,
    unsubscribeToken: { type: String, unique: true, default: newUnsubscribeToken, immutable: true },
  },
  { timestamps: true },
);

businessSchema.index({ 'location.province': 1, stage: 1 });
businessSchema.index({ 'contact.email': 1 });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

businessSchema.pre('validate', function validateBusiness(next) {
  // İl/ilçe tr-locations.json ile doğrulanır ve resmi yazıma çevrilir.
  if (this.location?.province && this.location?.district) {
    const resolved = resolveLocation(this.location.province, this.location.district);
    if (!resolved) {
      this.invalidate('location', 'Geçersiz il/ilçe.');
    } else {
      this.location.province = resolved.province;
      this.location.district = resolved.district;
    }
  }
  // Kural 7: e-posta varsa nereden alındığı (emailSource) zorunlu.
  const email = this.contact?.email;
  if (email) {
    if (!EMAIL_RE.test(email)) this.invalidate('contact.email', 'Geçersiz e-posta adresi.');
    if (!this.emailSource) this.invalidate('emailSource', 'E-posta adresinin kaynağı (emailSource) zorunludur.');
  }
  next();
});

export const Business = mongoose.models.Business || mongoose.model('Business', businessSchema);
