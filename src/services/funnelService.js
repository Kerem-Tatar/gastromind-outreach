// Huni özeti: aşama sayıları ve mesaj durumları, il bazında filtrelenebilir.
import { Business } from '../models/Business.js';
import { Message } from '../models/Message.js';
import { STAGES, MESSAGE_STATUSES } from '../config/constants.js';
import { resolveProvince } from './locations.js';
import { badRequest } from './errors.js';

export async function funnelSummary({ province } = {}) {
  const match = {};
  if (province) {
    const name = resolveProvince(province);
    if (!name) throw badRequest('Geçersiz il.');
    match['location.province'] = name;
  }
  const stageRows = await Business.aggregate([{ $match: match }, { $group: { _id: '$stage', count: { $sum: 1 } } }]);
  const stages = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const r of stageRows) stages[r._id] = r.count;

  const businessIds = province ? (await Business.find(match).select('_id')).map((b) => b._id) : null;
  const msgMatch = businessIds ? { business: { $in: businessIds } } : {};
  const msgRows = await Message.aggregate([{ $match: msgMatch }, { $group: { _id: '$status', count: { $sum: 1 } } }]);
  const messages = Object.fromEntries(MESSAGE_STATUSES.map((s) => [s, 0]));
  for (const r of msgRows) messages[r._id] = r.count;

  const byProvince = await Business.aggregate([
    { $match: match },
    { $group: { _id: { province: '$location.province', stage: '$stage' }, count: { $sum: 1 } } },
    { $group: { _id: '$_id.province', stages: { $push: { k: '$_id.stage', v: '$count' } }, total: { $sum: '$count' } } },
    { $project: { _id: 0, province: '$_id', total: 1, stages: { $arrayToObject: '$stages' } } },
    { $sort: { total: -1 } },
  ]);

  const total = Object.values(stages).reduce((a, b) => a + b, 0);
  return { province: match['location.province'] ?? null, total, stages, messages, byProvince };
}
