import mongoose from 'mongoose';
import { SUPPRESSION_REASONS } from '../config/constants.js';

const { Schema } = mongoose;

// Ret listesi (Kural 2). İşletme kaydından bağımsızdır: işletme silinse bile kayıt kalır.
const suppressionSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    reason: { type: String, enum: SUPPRESSION_REASONS, required: true },
    note: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Suppression = mongoose.models.Suppression || mongoose.model('Suppression', suppressionSchema);
