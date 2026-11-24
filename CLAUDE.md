# Gastromind Outreach: Proje Şartnamesi

> Bu dosya Claude Code için yazıldı. Repo kök dizinine `CLAUDE.md` adıyla koy.
> Claude Code her oturumda bu dosyayı okur. Fazları sırayla uygula ve her fazın sonunda dur, onay iste.

## 1. Proje nedir

Gastromind, restoran ve kafeler için AI destekli bir yemek önerisi ve müşteri geri bildirim sistemidir (ayrı repolar: `gastromind-frontend`, `gastromind-backend`).

**Bu repo (`gastromind-outreach`)** Gastromind'ın müşteri bulma aracıdır:
1. Türkiye genelinde restoran/kafe işletmelerini bulur (lead),
2. her işletme için kişiselleştirilmiş bir e-posta **taslağı** üretir,
3. kullanıcı onayladıktan sonra gönderir,
4. teslim, açılma, cevap ve hatırlatma süreçlerini takip eder,
5. ilgilenen işletmeyi online bir demo görüşmesine yönlendirir.

Tek kullanıcısı var: Kerem (proje sahibi). Bir iç araç, halka açık bir ürün değil.

## 2. Kapsam: Türkiye geneli

- Hedef bölge **81 ilin tamamı**. Sistem hiçbir şehri sabit kodlamaz.
- Konum hiyerarşisi: `il → ilçe → (opsiyonel) mahalle`. İl ve ilçe listesi repoda statik bir JSON veri dosyası olarak tutulur (`data/tr-locations.json`). Kaynak olarak açık bir il/ilçe veri setini kullan ve kaynağını dosyanın başına yaz.
- Kullanıcı aramaları şu şekilde başlatır: "İl: Ankara, İlçe: Çankaya, Kategori: kafe". Ya da birden fazla il seçer.
- Görüşmeler **online** yapılır (Google Meet / Zoom). Fiziksel ziyaret varsayılmaz. Randevu linki Cal.com üzerinden.
- Tüm metinler, şablonlar ve arayüz **Türkçe**. Kod, değişken ve tablo isimleri **İngilizce**.
- Saat dilimi: `Europe/Istanbul`. Gönderimler sadece hafta içi 09:30–17:30 arasında yapılır (ayarlanabilir).

## 3. Değişmez kurallar (hiçbir koşulda delinmez)

Bu kurallar kodun içinde zorunlu kontroller olarak uygulanır. Ayarla, şablonla ya da API isteğiyle kapatılamaz. Her biri için test yazılır.

1. **Onaysız gönderim yok.** Sistem sadece taslak üretir. `approved` durumunda olmayan hiçbir mesaj gönderilemez. Toplu onay olabilir ama her taslak arayüzde görünür olmalı.
2. **Ret listesi (suppression).** Listeden çıkan, spam şikayeti yapan, maili kalıcı olarak geri dönen (hard bounce) ya da İYS'de ret kaydı olan adresler `suppressions` tablosuna girer. Bu adreslere bir daha asla gönderim yapılmaz. İşletme kaydı silinse bile ret kaydı kalır.
3. **`do_not_contact` kilidi.** "Yazmayın" diyen işletme bu aşamaya geçer, bekleyen taslakları iptal edilir ve aşaması geri alınamaz.
4. **Her mailde yasal footer.** Gönderen adı, iletişim bilgisi ve tek tıkla çıkma linki otomatik eklenir. Şablondan kaldırılamaz. Ayrıca `List-Unsubscribe` ve `List-Unsubscribe-Post: List-Unsubscribe=One-Click` başlıkları eklenir.
5. **Çıkma linki GET ile işlem yapmaz.** GET bir onay sayfası gösterir, çıkarma işlemi POST ile yapılır (mail istemcileri linkleri önceden açabildiği için).
6. **Gönderim limitleri.** Günlük limit (varsayılan 30, ayarlanabilir), mailler arasında rastgele 30–90 saniye bekleme, aynı alan adına günde en fazla 2 mail.
7. **Sadece işletmenin kendi yayınladığı iletişim bilgileri** kullanılır (web sitesi, Google işletme profili). Kişisel e-posta tahmin edilmez (`ad.soyad@...` üretmek yasak). Satın alınmış listeler kullanılmaz.
8. **Gizli bilgiler** (API anahtarları) sadece `.env` dosyasında durur, loglanmaz, repoya girmez.

### Yasal bağlam (kod yorumlarında ve README'de belirt)
- Tacir/esnafa ticari elektronik ileti için önceden onay şartı yok, ama reddetme hakkını kullananlara gönderilemez.
- Gönderimden önce adresler İYS'ye kaydedilir ve ret durumları kontrol edilir. MVP'de bu kontrol manuel yapılır (İYS'den indirilen ret listesi CSV ile içe aktarılır, reason: `iys_ret`). Otomatik İYS entegrasyonu sonraki bir faz.
- İYS kaydı için kurumsal (alan adı uzantılı) e-posta gerekir.
- Bu bir hukuki görüş değildir. README'de "büyük hacimli gönderimden önce hukuki kontrol önerilir" notu bulunur.

## 4. Teknoloji yığını

| Katman | Seçim | Not |
|---|---|---|
| Backend | Node.js 20+, Express, ES modules | Gastromind backend'i ile aynı |
| Veritabanı | MongoDB (Atlas M0 ücretsiz) + Mongoose | Gastromind'dan **ayrı** veritabanı |
| Panel | Next.js (App Router) + Tailwind | Gastromind frontend ile aynı |
| E-posta gönderimi | Resend (ücretsiz: 100/gün, 3.000/ay) | Gelen mailler de kotaya dahil |
| E-posta alma | ImprovMX → Gmail | Cevaplar Kerem'in Gmail'ine düşer |
| Lead bulma | Google Places API (New): Text Search | Faz 3. Google Cloud'da faturalandırma hesabı (kart) gerekir; Text Search Pro için ayda 5.000 çağrı ücretsiz. Google Cloud'da günlük kota sınırı ve bütçe uyarısı kurulur |
| Taslak kişiselleştirme | OpenAI API | Faz 4. Gastromind'da zaten kullanılıyor |
| Randevu | Cal.com | Faz 5'te webhook |
| Deploy | Backend: Render (free web service), Panel: Vercel, Zamanlanmış işler: GitHub Actions (`schedule`) | Render Cron Job ücretli (aylık min. $1), kullanılmaz. GitHub Actions, backend'deki korumalı `/internal/jobs/*` endpoint'lerini çağırır (`x-job-secret` başlığıyla). Free Render servisi uyuyorsa ilk istek onu uyandırır; zaman aşımı ve 1 kez yeniden deneme olmalı |

Bağımlılıkları minimum tut. Yeni bir paket eklemeden önce gerekçesini yaz.

## 5. Veri modeli

### `Business`
- `name`, `category` (`cafe | restaurant | bakery | patisserie | bar | other`)
- `location`: `{ province, district, neighborhood?, address?, lat?, lng? }`. `province` ve `district` `tr-locations.json` ile doğrulanır.
- `contact`: `{ email?, phone?, website?, instagram?, contactPerson? }`
- `emailSource`: `website | google_profile | manual | reply`. Adresin nereden alındığının kanıtı.
- `googlePlaceId` (unique, sparse), `rating`, `reviewCount`, `priceLevel`
- `source`: `manual | google_places | referral | inbound`
- `stage`: `new | contacted | replied | meeting | pilot | customer | lost | do_not_contact`
- `priority` (1–3), `tags[]`, `notes`, `lastContactedAt`, `nextActionAt`
- `unsubscribeToken` (rastgele, 24 byte hex)
- İndeksler: `{ 'location.province': 1, stage: 1 }`, `{ 'contact.email': 1 }`

### `Campaign`
- `name`, hedef: `{ provinces[], districts[], categories[] }`
- `initialSubject`, `initialBody`, `followupSubject?`, `followupBody?`
- `useAiPersonalization` (bool, Faz 4), `isActive`

### `Message`
- `business`, `campaign`, `channel` (`email | instagram | phone`), `kind` (`initial | followup | manual`)
- `to`, `subject`, `body`
- `status`: `draft → approved → sent → delivered → opened → replied`, yan dallar: `rejected | bounced | failed`
- `approvedAt`, `sentAt`, `error`, `providerMessageId`

### `Activity`
İşletme zaman çizelgesi: `stage_change | message_sent | message_event | note | call | meeting | unsubscribed`.

### `Suppression`
`email` (unique, lowercase), `reason` (`unsubscribed | bounced | complained | manual | iys_ret`), `note`.

### `Settings` (tek kayıt)
Günlük limit, gönderim saat aralığı, hatırlatma gün sayısı, maksimum hatırlatma sayısı, gönderen bilgileri.

### Şablon değişkenleri
`{{greeting}}` (isim varsa "Merhaba Ahmet Bey,", yoksa "Merhaba,"), `{{businessName}}`, `{{contactPerson}}`, `{{district}}`, `{{province}}`, `{{category}}`, `{{bookingUrl}}`.
Bilinmeyen değişken içeren bir şablon kaydedilmeye çalışılırsa hata döner.

## 6. Fazlar

Her fazın sonunda: testler geçmeli, README güncellenmeli, değişikliklerin kısa özeti yazılmalı ve **bir sonraki faza geçmeden önce durup onay istenmeli.**

### Faz 1: Backend çekirdeği
- Klasör yapısı: `src/{config,models,services,routes,middleware,jobs}`, `data/`, `tests/`
- Bölüm 5'teki modeller, il/ilçe doğrulaması
- Admin API'si (`x-api-key` ile korumalı): işletme CRUD, aşama değiştirme, aktivite ekleme, kampanya CRUD, taslak üretme, düzenleme, onaylama/reddetme, onaylıları gönderme, huni özeti (il bazında filtrelenebilir)
- Herkese açık: `/unsubscribe/:token` (GET onay sayfası, POST çıkarma), `/webhooks/resend` (Svix imza doğrulamalı, ham gövde)
- CSV içe aktarma: işletme listesi ve İYS ret listesi
- **Testler (Vitest + mongodb-memory-server):** Bölüm 3'teki her kural için en az bir test, webhook imza testi (geçerli, değiştirilmiş, eski zaman damgası) ve şablon testi
- **Kabul kriteri:** Elle eklenen bir işletme için taslak üretilip onaylanabiliyor, Resend test moduyla gönderilebiliyor ve çıkma linki çalışıyor.

### Faz 2: Admin paneli (Next.js)
- Giriş: tek kullanıcı, parola ve httpOnly session cookie
- Sayfalar:
  - **Huni:** Aşamalara göre kanban, il/ilçe/kategori filtresi
  - **İşletmeler:** Tablo, arama, filtre, CSV içe aktarma
  - **İşletme detay:** Bilgiler, zaman çizelgesi, not/telefon ekleme, aşama değiştirme
  - **Onay kuyruğu:** Taslağı solda düzenle, sağda gerçek mail önizlemesi (footer dahil), onayla/reddet, toplu onay
  - **Kampanyalar:** Şablon editörü, değişken önizlemesi
  - **Ayarlar:** Limitler, gönderen bilgileri
- Gastromind marka renkleri: yeşil `#1f6f4a`, kırmızı vurgu
- **Kabul kriteri:** Faz 1'deki bütün akış panelden, curl kullanmadan yapılabiliyor.

### Faz 3: Google Places ile lead bulma
- Panelde "İşletme bul": il, ilçe(ler), kategori, minimum puan, minimum yorum sayısı
- Google Places API (New) Text Search, ör. `"kafe Çankaya Ankara"`. Büyük ilçelerde sonuç limitine takılmamak için ilçe bazında, gerekirse mahalle bazında sorgu
- Sonuçlar önce bir **önizleme listesinde** gösterilir, kullanıcı seçtiklerini ekler. `googlePlaceId` ile tekrar eklenmesi engellenir
- **Maliyet koruması:** Aylık API çağrı sayacı ve ayarlanabilir üst sınır. Sınıra yaklaşınca uyarı, aşınca durdurma. Field mask ile sadece gereken alanlar istenir
- Web sitesi olan işletmeler için **iletişim e-postası çıkarma**: sadece ana sayfa ve `/iletisim`, `/contact`, `/hakkimizda` sayfaları, `robots.txt`'ye saygı, istek başına zaman aşımı, sayfa başına tek istek, açık bir User-Agent. Bulunan adres `emailSource: website` ve kaynak URL ile kaydedilir
- E-postası bulunamayan işletmeler `instagram/phone` kanalı için işaretlenir
- **Kabul kriteri:** "Kafe, Kadıköy, İstanbul, puan ≥ 4.2" aramasıyla 20+ işletme önizlenip seçilenler eklenebiliyor ve API sayacı doğru artıyor.

### Faz 4: AI ile kişiselleştirme
- Kampanyada `useAiPersonalization` açıksa: şablon + işletme verisi (kategori, ilçe, puan, kısa yorum özeti) → OpenAI → **tek paragraflık kişisel giriş cümlesi** üretilir, şablonun geri kalanı aynı kalır
- Kurallar: uydurma bilgi yok ("menünüzdeki X'i denedim" gibi sahte deneyimler yasak), en fazla 2 cümle, samimi ama profesyonel bir Türkçe. Çıktı yine **taslak** olarak onay kuyruğuna düşer
- Instagram DM ve telefon görüşmesi için kısa metin/not taslağı (sistem göndermez, kullanıcı kopyalar)
- **Kabul kriteri:** 10 işletmelik bir partide her taslak farklı ve doğru bir giriş cümlesine sahip, hiçbirinde uydurma iddia yok.

### Faz 5: Takip otomasyonu
- GitHub Actions zamanlanmış workflow: günde bir kez hatırlatma **taslakları** (cevap yoksa N gün sonra, en fazla M hatırlatma). Gönderim yine onayla yapılır
- Onaylı mesajları gönderim saatleri içinde, limitlere uyarak gönderen zamanlanmış görev
- Cal.com webhook: randevu alınınca işletme `meeting` aşamasına geçer ve aktivite kaydı düşer (imza doğrulamalı)
- Haftalık özet: kaç mail gitti, kaç cevap geldi, kaç görüşme yapıldı, il bazında dönüşüm

## 6.1 Çalışma hızı
Kerem bütün fazları 1-2 gün içinde tamamlamak istiyor. Bu yüzden:
- Bir fazın çalışan, testli minimum halini önce bitir; cilalamayı sona bırak.
- Faz sonunda kısa özet + "Kerem'in yapması gerekenler" listesi (API anahtarı, hesap, DNS vb.) ver, sonra onay iste.
- Dış servis anahtarı henüz yoksa o kısmı mock'la test et ve README'de "anahtar gelince şu komutla doğrula" diye yaz; bekleme.

## 7. Kod kuralları
- Küçük, tek iş yapan fonksiyonlar. Servis katmanı iş kurallarını, route'lar sadece HTTP'yi yönetir
- Hata mesajları Türkçe, kullanıcıya iç detay sızdırılmaz
- Her dış servis çağrısında (Resend, Google, OpenAI) zaman aşımı ve anlamlı hata yönetimi
- Commit mesajları kısa ve İngilizce, ör. `feat: add suppression check to send flow`
- **Kerem'in açıkça istemediği bir değişiklik yapmadan önce sor.** Özellikle şema değişikliği, yeni bağımlılık ve kapsam genişletme için

## 8. Ortam değişkenleri (`.env.example`)
```
PORT=4000
APP_BASE_URL=
ADMIN_API_KEY=
PANEL_PASSWORD_HASH=
SESSION_SECRET=
MONGODB_URI=
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
MAIL_FROM_NAME=
MAIL_FROM_ADDRESS=
MAIL_REPLY_TO=
SENDER_FULL_NAME=
SENDER_PHONE=
SENDER_ADDRESS=
BOOKING_URL=
GOOGLE_PLACES_API_KEY=
GOOGLE_PLACES_MONTHLY_CALL_LIMIT=
OPENAI_API_KEY=
CALCOM_WEBHOOK_SECRET=
JOB_SECRET=
```
