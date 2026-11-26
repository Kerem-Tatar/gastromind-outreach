// Bir işletmenin web sitesinden iletişim e-postası bulup kaydeder (Kural 7: sadece işletmenin yayınladığı adres).
import { getBusiness } from './businessService.js';
import { findContactEmail } from './emailFinder.js';
import { logActivity } from './activityService.js';

const REASON_TR = {
  invalid_website: 'web sitesi adresi geçersiz',
  robots_unreachable: 'site yanıt vermedi',
  robots_disallowed: 'site robots.txt ile taramaya izin vermiyor',
  not_found: 'sitede e-posta bulunamadı',
  no_website: 'web sitesi yok',
};

function fallbackChannel(business) {
  if (business.contact?.instagram) return 'instagram';
  if (business.contact?.phone) return 'phone';
  return 'instagram';
}

export async function lookupBusinessEmail(id, { fetchImpl } = {}) {
  const business = await getBusiness(id);
  if (business.contact?.email) {
    return { status: 'already_has_email', email: business.contact.email, business };
  }
  if (!business.contact?.website) {
    business.contactChannel = fallbackChannel(business);
    await business.save();
    return { status: 'not_found', reason: REASON_TR.no_website, business };
  }

  const result = await findContactEmail(business.contact.website, fetchImpl ? { fetchImpl } : undefined);
  if (result.email) {
    business.contact.email = result.email;
    business.emailSource = 'website';
    business.emailSourceUrl = result.sourceUrl;
    business.contactChannel = 'email';
    await business.save();
    await logActivity(business._id, 'note', `E-posta web sitesinden bulundu: ${result.email} (${result.sourceUrl})`);
    return { status: 'found', email: result.email, sourceUrl: result.sourceUrl, business };
  }
  business.contactChannel = fallbackChannel(business);
  await business.save();
  return { status: 'not_found', reason: REASON_TR[result.reason] ?? 'bulunamadı', business };
}
