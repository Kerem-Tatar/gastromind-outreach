import mongoose from 'mongoose';

// Google Places aylık çağrı sayacı (ay: "2026-11", Europe/Istanbul). Her sayfa isteği 1 çağrıdır.
const placesUsageSchema = new mongoose.Schema(
  {
    month: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const PlacesUsage = mongoose.models.PlacesUsage || mongoose.model('PlacesUsage', placesUsageSchema);
