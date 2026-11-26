export const TIMEZONE = 'Europe/Istanbul';

export const CATEGORIES = ['cafe', 'restaurant', 'bakery', 'patisserie', 'bar', 'other'];
export const CATEGORY_LABELS_TR = {
  cafe: 'kafe',
  restaurant: 'restoran',
  bakery: 'fırın',
  patisserie: 'pastane',
  bar: 'bar',
  other: 'işletme',
};

export const STAGES = ['new', 'contacted', 'replied', 'meeting', 'pilot', 'customer', 'lost', 'do_not_contact'];
export const EMAIL_SOURCES = ['website', 'google_profile', 'manual', 'reply'];
export const CONTACT_CHANNELS = ['email', 'instagram', 'phone'];
export const BUSINESS_SOURCES = ['manual', 'google_places', 'referral', 'inbound'];

export const MESSAGE_CHANNELS = ['email', 'instagram', 'phone'];
export const MESSAGE_KINDS = ['initial', 'followup', 'manual'];
export const MESSAGE_STATUSES = ['draft', 'approved', 'sent', 'delivered', 'opened', 'replied', 'rejected', 'bounced', 'failed'];
// Ana akıştaki sıra; webhook olayları durumu sadece ileri taşır.
export const MESSAGE_FLOW = ['draft', 'approved', 'sent', 'delivered', 'opened', 'replied'];
export const SENT_STATUSES = ['sent', 'delivered', 'opened', 'replied', 'bounced'];

export const ACTIVITY_TYPES = ['stage_change', 'message_sent', 'message_event', 'note', 'call', 'meeting', 'unsubscribed'];
export const SUPPRESSION_REASONS = ['unsubscribed', 'bounced', 'complained', 'manual', 'iys_ret'];

// Değişmez gönderim kuralları (Kural 6). Ayarlardan değiştirilemez.
export const SEND_DELAY_MIN_SECONDS = 30;
export const SEND_DELAY_MAX_SECONDS = 90;
export const MAX_EMAILS_PER_DOMAIN_PER_DAY = 2;
// Günlük limit ayarlanabilir ama Resend ücretsiz kotası (100/gün) üst sınırdır.
export const DAILY_LIMIT_HARD_CAP = 100;

export const TEMPLATE_VARIABLES = ['greeting', 'businessName', 'contactPerson', 'district', 'province', 'category', 'bookingUrl'];

// Google Places (New) Text Search: puan, yorum, web sitesi ve telefon alanları "Text Search Enterprise"
// SKU'suna girer — ayda 1.000 ücretsiz istek, sonrası 1.000 istek başına ~35 $. Her sayfa 1 istektir.
export const PLACES_DEFAULT_MONTHLY_LIMIT = 900;
export const PLACES_FREE_MONTHLY_CAP = 1000;
export const PLACES_WARN_RATIO = 0.8;
export const PLACES_MAX_PAGES_PER_QUERY = 3; // Google en fazla 60 sonuç (3 × 20) döndürür
