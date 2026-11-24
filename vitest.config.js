import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      APP_BASE_URL: 'https://outreach.test',
      ADMIN_API_KEY: 'test-admin-key-123',
      RESEND_API_KEY: 're_test_secret_key',
      RESEND_WEBHOOK_SECRET: 'whsec_' + Buffer.from('test-webhook-secret-bytes').toString('base64'),
      MAIL_FROM_NAME: 'Gastromind',
      MAIL_FROM_ADDRESS: 'kerem@gastromind.test',
      MAIL_REPLY_TO: 'kerem@gastromind.test',
      SENDER_FULL_NAME: 'Kerem Tatar',
      SENDER_PHONE: '+90 555 000 00 00',
      SENDER_ADDRESS: 'Ankara, Türkiye',
      BOOKING_URL: 'https://cal.com/gastromind/demo',
    },
  },
});
