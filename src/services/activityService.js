import { Activity } from '../models/Activity.js';

export function logActivity(businessId, type, text = '', extra = {}) {
  return Activity.create({ business: businessId, type, text, ...extra });
}

export function listActivities(businessId) {
  return Activity.find({ business: businessId }).sort({ createdAt: -1 });
}
