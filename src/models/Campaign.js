import mongoose from 'mongoose';
import { CATEGORIES } from '../config/constants.js';
import { findUnknownVariables } from '../services/template.js';

const { Schema } = mongoose;

const campaignSchema = new Schema(
  {
    name: { type: String, required: [true, 'Kampanya adı zorunludur.'], trim: true },
    target: {
      provinces: { type: [String], default: [] },
      districts: { type: [String], default: [] },
      categories: { type: [{ type: String, enum: CATEGORIES }], default: [] },
    },
    initialSubject: { type: String, required: [true, 'İlk mail konusu zorunludur.'] },
    initialBody: { type: String, required: [true, 'İlk mail metni zorunludur.'] },
    followupSubject: String,
    followupBody: String,
    useAiPersonalization: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Bilinmeyen değişken içeren şablon kaydedilemez.
campaignSchema.pre('validate', function validateTemplates(next) {
  for (const field of ['initialSubject', 'initialBody', 'followupSubject', 'followupBody']) {
    const unknown = findUnknownVariables(this[field]);
    if (unknown.length) this.invalidate(field, `Bilinmeyen şablon değişkeni: ${unknown.map((v) => `{{${v}}}`).join(', ')}`);
  }
  next();
});

export const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
