// MongoDB bağlantı testi: npm run check:db
// Bağlantı adresini (şifre içerdiği için) asla yazdırmaz; sadece sunucu adı ve veritabanı adını gösterir.
import mongoose from 'mongoose';
import { loadEnvFile, env } from '../src/config/env.js';
import { redact } from '../src/config/logger.js';

loadEnvFile();

async function main() {
  const uri = env.mongodbUri;
  if (!uri) {
    console.error('✗ MONGODB_URI tanımlı değil (.env dosyasında veya ortam değişkenlerinde).');
    process.exit(1);
  }
  const started = Date.now();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  const db = mongoose.connection.db;
  const { version } = await db.admin().command({ buildInfo: 1 });
  await db.command({ ping: 1 });
  console.log(`✓ Bağlandı (${Date.now() - started} ms)`);
  console.log(`  Sunucu: ${mongoose.connection.host}`);
  console.log(`  Veritabanı: ${db.databaseName}${db.databaseName === 'test' ? '  ← adreste veritabanı adı yok; varsayılan "test" kullanılıyor' : ''}`);
  console.log(`  MongoDB sürümü: ${version}`);

  // Yazma/okuma/silme yetkisi kontrolü (geçici bir kayıtla).
  const col = db.collection('_healthcheck');
  const { insertedId } = await col.insertOne({ at: new Date() });
  const found = await col.findOne({ _id: insertedId });
  await col.deleteOne({ _id: insertedId });
  console.log(`✓ Yazma/okuma/silme: ${found ? 'çalışıyor' : 'okunamadı'}`);

  const collections = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => n !== '_healthcheck');
  console.log(`  Koleksiyonlar: ${collections.length ? collections.join(', ') : '(henüz yok — ilk kayıtta oluşur)'}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  const msg = redact(err?.message ?? String(err));
  console.error('✗ Bağlantı başarısız:', msg);
  if (/auth|Authentication/i.test(msg)) console.error('  → Kullanıcı adı/şifre hatalı olabilir (şifrede özel karakter varsa URL-encode edilmeli).');
  if (/ENOTFOUND|querySrv/i.test(msg)) {
    console.error('  → Sunucu adı çözülemedi. Adresi kontrol edin; adres doğruysa bu makinenin DNS\'i SRV kayıtlarını');
    console.error('    çözemiyor olabilir (ör. Claude Code bulut oturumları). Bu durumda testi kendi bilgisayarınızda veya Render\'da çalıştırın.');
  }
  if (/timed out|Server selection|ECONNREFUSED|whitelist|IP/i.test(msg)) console.error('  → Atlas > Network Access\'te bu makinenin IP\'sine izin verilmemiş olabilir.');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
