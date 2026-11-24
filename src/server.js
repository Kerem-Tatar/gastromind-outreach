import mongoose from 'mongoose';
import { loadEnvFile, env } from './config/env.js';
import { logger } from './config/logger.js';
import { mongoConnectOptions } from './config/db.js';

loadEnvFile();

const { createApp } = await import('./app.js');

async function main() {
  if (!env.mongodbUri) {
    logger.error('MONGODB_URI tanımlı değil.');
    process.exit(1);
  }
  await mongoose.connect(env.mongodbUri, mongoConnectOptions(env.mongodbUri));
  logger.info(`MongoDB bağlandı (veritabanı: ${mongoose.connection.db.databaseName})`);
  const app = createApp();
  app.listen(env.port, () => logger.info(`gastromind-outreach ${env.port} portunda çalışıyor`));
}

main().catch((err) => {
  logger.error('Sunucu başlatılamadı', err);
  process.exit(1);
});
