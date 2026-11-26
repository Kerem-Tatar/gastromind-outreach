import mongoose from 'mongoose';
import { DAILY_LIMIT_HARD_CAP } from '../config/constants.js';

const { Schema } = mongoose;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Tek kayıt (key: 'global').
const settingsSchema = new Schema(
  {
    key: { type: String, default: 'global', unique: true, immutable: true },
    dailyLimit: { type: Number, default: 30, min: 0, max: DAILY_LIMIT_HARD_CAP },
    sendWindow: {
      start: { type: String, default: '09:30', match: [TIME_RE, 'Saat SS:DD biçiminde olmalı.'] },
      end: { type: String, default: '17:30', match: [TIME_RE, 'Saat SS:DD biçiminde olmalı.'] },
      weekdaysOnly: { type: Boolean, default: true },
    },
    followupAfterDays: { type: Number, default: 4, min: 1 },
    maxFollowups: { type: Number, default: 1, min: 0, max: 3 },
    sender: {
      fullName: { type: String, default: '' },
      companyName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    bookingUrl: { type: String, default: '' },
    // Google Places aylık çağrı üst sınırı (0 = arama kapalı). Varsayılan .env veya 900.
    placesMonthlyLimit: { type: Number, min: 0, max: 20000 },
  },
  { timestamps: true },
);

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
