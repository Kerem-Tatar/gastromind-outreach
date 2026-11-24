// MongoDB bağlantı ayarları. Adreste veritabanı adı yoksa varsayılan isim kullanılır
// (aksi halde MongoDB verileri "test" adlı veritabanına yazar).
export const DEFAULT_DB_NAME = 'gastromind-outreach';

export function dbNameFromUri(uri) {
  const match = String(uri).match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/);
  const name = match ? decodeURIComponent(match[1]) : '';
  return name || null;
}

export function mongoConnectOptions(uri) {
  return {
    serverSelectionTimeoutMS: 15000,
    dbName: dbNameFromUri(uri) ?? DEFAULT_DB_NAME,
  };
}
