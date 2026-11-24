// CSV içe aktarma: işletme listesi ve İYS ret listesi.
import { Business } from '../models/Business.js';
import { CATEGORIES } from '../config/constants.js';
import { parseCsv } from './csv.js';
import { addSuppression } from './suppressionService.js';
import { badRequest } from './errors.js';

const MAX_ROWS = 5000;

const CATEGORY_ALIASES = {
  kafe: 'cafe', cafe: 'cafe', restoran: 'restaurant', restaurant: 'restaurant', lokanta: 'restaurant',
  firin: 'bakery', fırın: 'bakery', bakery: 'bakery', pastane: 'patisserie', patisserie: 'patisserie',
  bar: 'bar', diger: 'other', diğer: 'other', other: 'other',
};

function rowsFrom(csvText) {
  if (!csvText || !String(csvText).trim()) throw badRequest('CSV içeriği boş.');
  const rows = parseCsv(csvText);
  if (rows.length > MAX_ROWS) throw badRequest(`Tek seferde en fazla ${MAX_ROWS} satır içe aktarılabilir.`);
  return rows;
}

function mapCategory(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key) return 'other';
  const mapped = CATEGORY_ALIASES[key];
  if (!mapped || !CATEGORIES.includes(mapped)) return null;
  return mapped;
}

// Beklenen sütunlar: name, category, province, district, neighborhood, address, email, emailSource,
// phone, website, instagram, contactPerson, tags (| ile ayrılmış), notes, priority
export async function importBusinesses(csvText) {
  const rows = rowsFrom(csvText);
  const result = { created: 0, duplicates: 0, errors: [] };
  for (const [index, row] of rows.entries()) {
    const line = index + 2; // başlık satırı 1
    const category = mapCategory(row.category);
    if (!category) {
      result.errors.push({ line, error: `Geçersiz kategori: ${row.category}` });
      continue;
    }
    const email = row.email?.toLowerCase() || undefined;
    if (email && (await Business.exists({ 'contact.email': email }))) {
      result.duplicates += 1;
      continue;
    }
    try {
      await Business.create({
        name: row.name,
        category,
        location: { province: row.province, district: row.district, neighborhood: row.neighborhood || undefined, address: row.address || undefined },
        contact: {
          email,
          phone: row.phone || undefined,
          website: row.website || undefined,
          instagram: row.instagram || undefined,
          contactPerson: row.contactPerson || undefined,
        },
        emailSource: row.emailSource || undefined,
        source: 'manual',
        priority: row.priority ? Number(row.priority) : undefined,
        tags: row.tags ? row.tags.split('|').map((t) => t.trim()).filter(Boolean) : [],
        notes: row.notes || '',
      });
      result.created += 1;
    } catch (err) {
      result.errors.push({ line, error: validationMessage(err) });
    }
  }
  return result;
}

// İYS'den indirilen ret listesi. "email" (veya "e-posta"/"eposta"/"alici") sütunu aranır; yoksa ilk sütun kullanılır.
export async function importIysRejections(csvText) {
  const rows = rowsFrom(csvText);
  const result = { added: 0, alreadySuppressed: 0, errors: [] };
  for (const [index, row] of rows.entries()) {
    const key = Object.keys(row).find((k) => ['email', 'e-posta', 'eposta', 'alici', 'alıcı', 'recipient'].includes(k.toLowerCase()))
      ?? Object.keys(row)[0];
    const email = row[key];
    try {
      const { created } = await addSuppression(email, 'iys_ret', 'İYS ret listesi içe aktarımı');
      if (created) result.added += 1;
      else result.alreadySuppressed += 1;
    } catch (err) {
      result.errors.push({ line: index + 2, error: err.message });
    }
  }
  return result;
}

function validationMessage(err) {
  if (err?.name === 'ValidationError') return Object.values(err.errors).map((e) => e.message).join(' ');
  if (err?.code === 11000) return 'Kayıt zaten mevcut.';
  return 'Satır kaydedilemedi.';
}
