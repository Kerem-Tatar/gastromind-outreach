import mongoose from 'mongoose';
import { ACTIVITY_TYPES } from '../config/constants.js';

const { Schema } = mongoose;

const activitySchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    type: { type: String, enum: ACTIVITY_TYPES, required: true },
    text: { type: String, default: '' },
    message: { type: Schema.Types.ObjectId, ref: 'Message' },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

export const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
