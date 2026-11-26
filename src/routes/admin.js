// Admin API (x-api-key ile korumalı). Route'lar sadece HTTP'yi yönetir; iş kuralları servislerde.
import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as businesses from '../services/businessService.js';
import * as campaigns from '../services/campaignService.js';
import * as drafts from '../services/draftService.js';
import * as sender from '../services/sendService.js';
import * as suppressions from '../services/suppressionService.js';
import { importBusinesses, importIysRejections } from '../services/importService.js';
import { funnelSummary } from '../services/funnelService.js';
import { getSettings, updateSettings } from '../services/settingsService.js';
import { listProvinces, listDistricts, locationsSource } from '../services/locations.js';
import { badRequest, notFound } from '../services/errors.js';
import { logger } from '../config/logger.js';

function csvFromRequest(req) {
  if (typeof req.body === 'string') return req.body;
  if (req.body && typeof req.body.csv === 'string') return req.body.csv;
  throw badRequest('CSV içeriği text/csv gövdesi veya { "csv": "..." } olarak gönderilmeli.');
}

export function adminRouter(deps = {}) {
  const r = express.Router();
  const sendDeps = { transport: deps.transport, now: deps.now, sleep: deps.sleep, random: deps.random };
  for (const k of Object.keys(sendDeps)) if (sendDeps[k] === undefined) delete sendDeps[k];

  // Konumlar
  r.get('/locations', (req, res) => res.json({ source: locationsSource, provinces: listProvinces() }));
  r.get('/locations/:province/districts', (req, res) => {
    const districts = listDistricts(req.params.province);
    if (!districts) throw notFound('İl bulunamadı.');
    res.json({ districts });
  });

  // İşletmeler
  r.get('/businesses', asyncHandler(async (req, res) => res.json(await businesses.listBusinesses(req.query))));
  r.post('/businesses', asyncHandler(async (req, res) => res.status(201).json(await businesses.createBusiness(req.body))));
  r.post('/businesses/import', asyncHandler(async (req, res) => res.json(await importBusinesses(csvFromRequest(req)))));
  r.get('/businesses/:id', asyncHandler(async (req, res) => res.json(await businesses.getBusinessDetail(req.params.id))));
  r.patch('/businesses/:id', asyncHandler(async (req, res) => res.json(await businesses.updateBusiness(req.params.id, req.body))));
  r.delete('/businesses/:id', asyncHandler(async (req, res) => {
    await businesses.deleteBusiness(req.params.id);
    res.status(204).end();
  }));
  r.post('/businesses/:id/stage', asyncHandler(async (req, res) => res.json(await businesses.changeStage(req.params.id, req.body?.stage, req.body?.note))));
  r.post('/businesses/:id/activities', asyncHandler(async (req, res) => res.status(201).json(await businesses.addManualActivity(req.params.id, req.body ?? {}))));

  // Kampanyalar
  r.get('/campaigns', asyncHandler(async (req, res) => res.json(await campaigns.listCampaigns())));
  r.post('/campaigns', asyncHandler(async (req, res) => res.status(201).json(await campaigns.createCampaign(req.body))));
  r.get('/campaigns/:id', asyncHandler(async (req, res) => res.json(await campaigns.getCampaign(req.params.id))));
  r.patch('/campaigns/:id', asyncHandler(async (req, res) => res.json(await campaigns.updateCampaign(req.params.id, req.body))));
  r.delete('/campaigns/:id', asyncHandler(async (req, res) => {
    await campaigns.deleteCampaign(req.params.id);
    res.status(204).end();
  }));
  r.get('/campaigns/:id/audience', asyncHandler(async (req, res) => res.json(await drafts.campaignAudience(req.params.id))));
  r.post('/campaigns/:id/drafts', asyncHandler(async (req, res) => {
    const result = await drafts.generateInitialDrafts(req.params.id, { businessIds: req.body?.businessIds });
    res.status(201).json(result);
  }));

  // Mesajlar / onay kuyruğu
  r.get('/messages', asyncHandler(async (req, res) => res.json(await drafts.listMessages(req.query))));
  r.post('/messages/approve', asyncHandler(async (req, res) => res.json(await drafts.approveMany(req.body?.ids))));
  r.post('/messages/send-approved', asyncHandler(async (req, res) => {
    if (sender.isSendRunInProgress()) return res.status(409).json({ error: 'Zaten devam eden bir gönderim var.' });
    // Mailler arası 30–90 sn bekleme olduğu için arka planda çalışır.
    sender.sendApprovedBatch(sendDeps)
      .then((summary) => logger.info('Toplu gönderim bitti', summary))
      .catch((err) => logger.error('Toplu gönderim hatası', err));
    return res.status(202).json({ started: true });
  }));
  r.get('/messages/:id', asyncHandler(async (req, res) => res.json(await drafts.getMessage(req.params.id))));
  r.get('/messages/:id/preview', asyncHandler(async (req, res) => res.json(await drafts.previewMessage(req.params.id))));
  r.patch('/messages/:id', asyncHandler(async (req, res) => res.json(await drafts.updateDraft(req.params.id, req.body ?? {}))));
  r.post('/messages/:id/approve', asyncHandler(async (req, res) => res.json(await drafts.approveMessage(req.params.id))));
  r.post('/messages/:id/reject', asyncHandler(async (req, res) => res.json(await drafts.rejectMessage(req.params.id))));
  r.post('/messages/:id/send', asyncHandler(async (req, res) => res.json(await sender.sendMessage(req.params.id, sendDeps))));
  r.post('/messages/:id/mark-replied', asyncHandler(async (req, res) => res.json(await drafts.markReplied(req.params.id))));

  // Ret listesi (silme yok — Kural 2)
  r.get('/suppressions', asyncHandler(async (req, res) => res.json(await suppressions.listSuppressions(req.query))));
  r.post('/suppressions', asyncHandler(async (req, res) => {
    const { suppression } = await suppressions.addSuppression(req.body?.email, req.body?.reason ?? 'manual', req.body?.note ?? '');
    res.status(201).json(suppression);
  }));
  r.post('/suppressions/import-iys', asyncHandler(async (req, res) => res.json(await importIysRejections(csvFromRequest(req)))));

  // Huni ve ayarlar
  r.get('/funnel', asyncHandler(async (req, res) => res.json(await funnelSummary(req.query))));
  r.get('/settings', asyncHandler(async (req, res) => res.json(await getSettings())));
  r.patch('/settings', asyncHandler(async (req, res) => res.json(await updateSettings(req.body ?? {}))));

  return r;
}
