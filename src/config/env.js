// Ortam değişkenleri. Gizli bilgiler sadece .env dosyasında durur (Kural 8):
// bu modül değerleri asla loglamaz; logger, bilinen gizli değerleri maskeler.
import fs from 'node:fs';

const SECRET_KEYS = [
  'ADMIN_API_KEY',
  'PANEL_PASSWORD_HASH',
  'SESSION_SECRET',
  'MONGODB_URI',
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
  'GOOGLE_PLACES_API_KEY',
  'OPENAI_API_KEY',
  'CALCOM_WEBHOOK_SECRET',
  'JOB_SECRET',
];

let loaded = false;

export function loadEnvFile(path = '.env') {
  if (loaded) return;
  loaded = true;
  if (fs.existsSync(path) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path);
  }
}

function read(name, fallback = '') {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value.trim();
}

// Her çağrıda güncel değeri okur (testlerde process.env değiştirilebilsin diye).
export const env = {
  get port() { return Number(read('PORT', '4000')); },
  get appBaseUrl() { return read('APP_BASE_URL', 'http://localhost:4000').replace(/\/+$/, ''); },
  get adminApiKey() { return read('ADMIN_API_KEY'); },
  get mongodbUri() { return read('MONGODB_URI'); },
  get resendApiKey() { return read('RESEND_API_KEY'); },
  get resendWebhookSecret() { return read('RESEND_WEBHOOK_SECRET'); },
  get mailFromName() { return read('MAIL_FROM_NAME'); },
  get mailFromAddress() { return read('MAIL_FROM_ADDRESS'); },
  get mailReplyTo() { return read('MAIL_REPLY_TO'); },
  get senderFullName() { return read('SENDER_FULL_NAME'); },
  get senderPhone() { return read('SENDER_PHONE'); },
  get senderAddress() { return read('SENDER_ADDRESS'); },
  get bookingUrl() { return read('BOOKING_URL'); },
  get jobSecret() { return read('JOB_SECRET'); },
};

export function secretValues() {
  return SECRET_KEYS.map((k) => process.env[k]).filter((v) => typeof v === 'string' && v.length >= 6);
}
