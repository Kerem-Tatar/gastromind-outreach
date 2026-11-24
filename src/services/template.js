// Şablon motoru: sadece izin verilen {{değişken}}ler.
import { TEMPLATE_VARIABLES, CATEGORY_LABELS_TR } from '../config/constants.js';
import { badRequest } from './errors.js';

const VAR_RE = /\{\{\s*([^{}]*?)\s*\}\}/g;

export function findUnknownVariables(template) {
  if (!template) return [];
  const unknown = new Set();
  for (const match of String(template).matchAll(VAR_RE)) {
    if (!TEMPLATE_VARIABLES.includes(match[1])) unknown.add(match[1]);
  }
  return [...unknown];
}

export function assertValidTemplate(template, label = 'Şablon') {
  const unknown = findUnknownVariables(template);
  if (unknown.length) {
    throw badRequest(`${label} bilinmeyen değişken içeriyor: ${unknown.map((v) => `{{${v}}}`).join(', ')}`, 'unknown_template_variable');
  }
}

export function buildGreeting(contactPerson) {
  const name = String(contactPerson ?? '').trim();
  return name ? `Merhaba ${name},` : 'Merhaba,';
}

export function templateContext(business, { bookingUrl = '' } = {}) {
  return {
    greeting: buildGreeting(business.contact?.contactPerson),
    businessName: business.name ?? '',
    contactPerson: business.contact?.contactPerson ?? '',
    district: business.location?.district ?? '',
    province: business.location?.province ?? '',
    category: CATEGORY_LABELS_TR[business.category] ?? 'işletme',
    bookingUrl,
  };
}

export function renderTemplate(template, context) {
  assertValidTemplate(template);
  return String(template ?? '').replace(VAR_RE, (_, name) => String(context[name] ?? ''));
}
