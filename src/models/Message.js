import mongoose from 'mongoose';
import { MESSAGE_CHANNELS, MESSAGE_KINDS, MESSAGE_STATUSES } from '../config/constants.js';

const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    campaign: { type: Schema.Types.ObjectId, ref: 'Campaign', index: true },
    channel: { type: String, enum: MESSAGE_CHANNELS, default: 'email' },
    kind: { type: String, enum: MESSAGE_KINDS, default: 'initial' },
    to: { type: String, lowercase: true, trim: true },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    status: { type: String, enum: MESSAGE_STATUSES, default: 'draft', index: true },
    approvedAt: Date,
    sentAt: { type: Date, index: true },
    error: String,
    providerMessageId: { type: String, index: true, sparse: true },
  },
  { timestamps: true },
);

export const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);
