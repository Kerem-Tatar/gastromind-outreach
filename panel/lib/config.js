// Panel sunucu tarafı ayarları. Bu değerler tarayıcıya gönderilmez (NEXT_PUBLIC_ öneki yok).
export function serverConfig() {
  return {
    backendUrl: (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, ''),
    adminApiKey: process.env.ADMIN_API_KEY || '',
    sessionSecret: process.env.SESSION_SECRET || '',
    passwordHash: process.env.PANEL_PASSWORD_HASH || '',
  };
}
