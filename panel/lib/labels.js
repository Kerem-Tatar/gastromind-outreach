// Arayüz etiketleri (Türkçe). Değerler backend'deki enum'larla aynı.
export const STAGES = [
  { value: 'new', label: 'Yeni' },
  { value: 'contacted', label: 'İletişime geçildi' },
  { value: 'replied', label: 'Cevap verdi' },
  { value: 'meeting', label: 'Görüşme' },
  { value: 'pilot', label: 'Pilot' },
  { value: 'customer', label: 'Müşteri' },
  { value: 'lost', label: 'Kaybedildi' },
  { value: 'do_not_contact', label: 'İletişim kurulmayacak' },
];
export const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.value, s.label]));

export const CATEGORIES = [
  { value: 'cafe', label: 'Kafe' },
  { value: 'restaurant', label: 'Restoran' },
  { value: 'bakery', label: 'Fırın' },
  { value: 'patisserie', label: 'Pastane' },
  { value: 'bar', label: 'Bar' },
  { value: 'other', label: 'Diğer' },
];
export const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));
// Şablonda {{category}} olarak kullanılan küçük harfli hali
export const CATEGORY_TEMPLATE = { cafe: 'kafe', restaurant: 'restoran', bakery: 'fırın', patisserie: 'pastane', bar: 'bar', other: 'işletme' };

export const EMAIL_SOURCES = [
  { value: 'website', label: 'Web sitesi' },
  { value: 'google_profile', label: 'Google işletme profili' },
  { value: 'manual', label: 'Elle (işletmenin verdiği)' },
  { value: 'reply', label: 'Cevap maili' },
];

export const MESSAGE_STATUS_LABEL = {
  draft: 'Taslak', approved: 'Onaylandı', sent: 'Gönderildi', delivered: 'Teslim edildi', opened: 'Açıldı',
  replied: 'Cevaplandı', rejected: 'Reddedildi', bounced: 'Geri döndü', failed: 'Başarısız',
};

export const ACTIVITY_LABEL = {
  stage_change: 'Aşama değişti', message_sent: 'Mail gönderildi', message_event: 'Mail olayı', note: 'Not',
  call: 'Telefon', meeting: 'Görüşme', unsubscribed: 'Listeden çıktı',
};

export const SUPPRESSION_REASON_LABEL = {
  unsubscribed: 'Listeden çıktı', bounced: 'Geri döndü (hard bounce)', complained: 'Spam şikayeti', manual: 'Elle', iys_ret: 'İYS ret',
};

export const SKIP_REASON_LABEL = {
  do_not_contact: 'iletişim kurulmayacak', no_email: 'e-posta yok', suppressed: 'ret listesinde', already_has_message: 'bu şablonla zaten mesajı var',
};

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export const CONTACT_CHANNEL_LABEL = { email: 'E-posta', instagram: 'Instagram', phone: 'Telefon' };
export const SOURCE_LABEL = { manual: 'Elle', google_places: 'Google', referral: 'Referans', inbound: 'Gelen' };
