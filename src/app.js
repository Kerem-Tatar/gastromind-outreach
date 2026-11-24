import express from 'express';
import { requireApiKey } from './middleware/apiKey.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { adminRouter } from './routes/admin.js';
import { unsubscribeRouter } from './routes/unsubscribe.js';
import { webhooksRouter } from './routes/webhooks.js';

// deps: testlerde mail transport'u, saat ve bekleme fonksiyonunu değiştirmek için.
export function createApp(deps = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Webhook'lar ham gövdeye ihtiyaç duyar; JSON parser'dan önce bağlanır.
  app.use('/webhooks', webhooksRouter());
  app.use('/unsubscribe', unsubscribeRouter());

  app.get('/health', (req, res) => res.json({ ok: true }));

  app.use('/api', requireApiKey,
    express.json({ limit: '1mb' }),
    express.text({ type: ['text/csv', 'text/plain'], limit: '5mb' }),
    adminRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
