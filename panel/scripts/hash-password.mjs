// Kullanım: npm run hash-password -- 'parolam'
// Çıktıyı PANEL_PASSWORD_HASH olarak .env.local'a (ve Vercel'e) yaz.
import { hashPassword } from '../lib/password.js';

const password = process.argv[2];
if (!password || password.length < 10) {
  console.error('En az 10 karakterlik bir parola ver: npm run hash-password -- "parolam"');
  process.exit(1);
}
console.log(hashPassword(password));
