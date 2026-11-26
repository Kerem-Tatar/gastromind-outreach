import { Campaign } from '../models/Campaign.js';
import { badRequest, notFound } from './errors.js';
import { assertObjectId } from './businessService.js';
import { resolveProvince, resolveDistrict, listProvinces } from './locations.js';

const EDITABLE = ['name', 'target', 'initialSubject', 'initialBody', 'followupSubject', 'followupBody', 'useAiPersonalization', 'isActive'];

function pick(obj) {
  const out = {};
  for (const k of EDITABLE) if (obj?.[k] !== undefined) out[k] = obj[k];
  return out;
}

// Hedef il/ilçe adlarını doğrular ve resmi yazıma çevirir.
function normalizeTarget(target = {}) {
  const provinces = (target.provinces ?? []).map((p) => {
    const name = resolveProvince(p);
    if (!name) throw badRequest(`Geçersiz il: ${p}`);
    return name;
  });
  const districts = (target.districts ?? []).map((d) => {
    const candidates = provinces.length ? provinces : listProvinces().map((p) => p.name);
    for (const p of candidates) {
      const name = resolveDistrict(p, d);
      if (name) return name;
    }
    throw badRequest(`Geçersiz ilçe: ${d}`);
  });
  return { provinces, districts, categories: target.categories ?? [] };
}

export async function createCampaign(input) {
  const data = pick(input);
  data.target = normalizeTarget(data.target);
  return Campaign.create(data);
}

export async function getCampaign(id) {
  assertObjectId(id);
  const campaign = await Campaign.findById(id);
  if (!campaign) throw notFound('Mail şablonu bulunamadı.');
  return campaign;
}

export async function updateCampaign(id, patch) {
  const campaign = await getCampaign(id);
  const data = pick(patch);
  if (data.target) data.target = normalizeTarget(data.target);
  campaign.set(data);
  await campaign.save();
  return campaign;
}

export async function deleteCampaign(id) {
  const campaign = await getCampaign(id);
  await campaign.deleteOne();
}

export function listCampaigns() {
  return Campaign.find().sort({ createdAt: -1 });
}
