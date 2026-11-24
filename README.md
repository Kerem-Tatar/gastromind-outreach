# Gastromind Outreach

Gastromind için iç kullanım amaçlı müşteri bulma ve e-posta outreach aracı. Türkiye genelindeki (81 il) restoran ve kafeleri listeler, kişiselleştirilmiş e-posta **taslakları** üretir, kullanıcı onayından sonra gönderir ve süreci takip eder.

Proje şartnamesi: [`CLAUDE.md`](CLAUDE.md).

## Durum

| Faz | Kapsam | Durum |
|---|---|---|
| 1 | Backend çekirdeği (modeller, admin API, çıkma linki, Resend webhook, CSV, testler) | ✅ |
| 2 | Admin paneli (Next.js, `panel/`) | ✅ |
| 3 | Google Places ile lead bulma | ⏳ |
| 4 | AI ile kişiselleştirme | ⏳ |
| 5 | Takip otomasyonu (GitHub Actions, Cal.com) | ⏳ |

## Kurulum

Node.js 20.12+ gerekir.

```bash
npm install
cp .env.example .env   # değerleri doldur
npm run dev            # http://localhost:4000
npm test
```

`.env` dosyası `node src/server.js` başlarken otomatik okunur (Node'un yerleşik `process.loadEnvFile`'ı; ek paket yok). Render'da değişkenler panelden girilir.

### Zorunlu ortam değişkenleri (Faz 1)

| Değişken | Açıklama |
|---|---|
| `MONGODB_URI` | MongoDB Atlas bağlantısı (Gastromind'dan **ayrı** veritabanı). Adreste veritabanı adı yoksa `gastromind-outreach` kullanılır |
| `ADMIN_API_KEY` | Admin API anahtarı (`x-api-key` başlığı). Üretmek için: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `APP_BASE_URL` | Backend'in herkese açık adresi; çıkma linkleri bununla üretilir |
| `RESEND_API_KEY` | Resend API anahtarı |
| `RESEND_WEBHOOK_SECRET` | Resend webhook imza anahtarı (`whsec_...`) |
| `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `MAIL_REPLY_TO` | Gönderen bilgileri (adres Resend'de doğrulanmış alan adından olmalı) |
| `SENDER_FULL_NAME`, `SENDER_PHONE`, `SENDER_ADDRESS` | Yasal footer bilgileri |
| `BOOKING_URL` | Cal.com randevu linki (`{{bookingUrl}}`) |

Gönderen bilgileri ve randevu linki ayarlardan (`PATCH /api/settings`) da değiştirilebilir; ayar boşsa `.env` değeri kullanılır.

## Klasör yapısı

```
src/
  config/      ortam değişkenleri, sabitler, logger
  models/      Business, Campaign, Message, Activity, Suppression, Settings
  services/    iş kuralları (taslak, onay, gönderim, ret listesi, webhook, CSV, huni)
  routes/      admin API, çıkma sayfası, webhook (sadece HTTP)
  middleware/  API anahtarı, hata yönetimi
  jobs/        (Faz 5)
data/tr-locations.json   81 il / 973 ilçe (kaynak dosyanın başında)
tests/                   Vitest + mongodb-memory-server
panel/                   Admin paneli (Next.js 16 App Router + Tailwind 4)
```

## Admin paneli (`panel/`)

Next.js (App Router) + Tailwind. Tek kullanıcı: parola ile giriş, imzalı **httpOnly** oturum cookie'si (7 gün).

**Güvenlik modeli:** Tarayıcı backend'e doğrudan bağlanmaz. Panel `/api/*` isteklerini sunucu tarafında oturumu doğrulayıp `ADMIN_API_KEY` ile backend'e iletir; API anahtarı tarayıcıya hiç gitmez. Veri değiştiren isteklerde `Origin` kontrolü (CSRF) yapılır. Render uykudaysa ilk istek ~1 dk sürebilir (70 sn zaman aşımı, okuma isteklerinde 1 yeniden deneme).

| Sayfa | İçerik |
|---|---|
| Huni | Aşamalara göre kanban (sürükle-bırak), il/ilçe/kategori filtresi, mesaj durumu özeti |
| İşletmeler | Tablo, arama, il/ilçe/kategori/aşama filtresi, sayfalama, CSV içe aktarma, yeni işletme |
| İşletme detay | Bilgiler (düzenlenebilir), zaman çizelgesi, not/telefon/görüşme ekleme, aşama değiştirme, kampanyadan taslak oluşturma, silme |
| Onay kuyruğu | Solda taslak düzenleme, sağda footer ve başlıklar dahil gerçek mail önizlemesi; onayla/reddet, seçerek toplu onay; onaylılar sekmesinde tek tek veya toplu gönderim |
| Kampanyalar | Hedef (il/ilçe/kategori), şablon editörü, değişken ekleme butonları, gerçek işletme verisiyle canlı önizleme, bilinmeyen değişken uyarısı, taslak üretme |
| Ayarlar | Günlük limit, gönderim saatleri, hatırlatma ayarları, gönderen bilgileri, randevu linki; ret listesi görüntüleme, elle ekleme ve İYS CSV içe aktarma |

### Kurulum

```bash
cd panel
npm install
cp .env.example .env.local
npm run hash-password -- "guclu-bir-parola"   # çıktıyı PANEL_PASSWORD_HASH'e yaz
npm run dev                                    # http://localhost:3000 (backend 4000'de çalışıyor olmalı)
npm test                                       # oturum/parola/CSRF testleri
```

| Değişken | Açıklama |
|---|---|
| `BACKEND_URL` | Backend adresi (yerelde `http://localhost:4000`, canlıda Render adresi) |
| `ADMIN_API_KEY` | Backend'dekiyle aynı değer |
| `PANEL_PASSWORD_HASH` | `npm run hash-password` çıktısı (scrypt) |
| `SESSION_SECRET` | En az 32 karakter rastgele değer |

### Vercel'e deploy

1. Vercel'de yeni proje → bu repo → **Root Directory: `panel`** (framework Next.js olarak algılanır).
2. Environment Variables: yukarıdaki dört değişken (`BACKEND_URL` = Render adresi).
3. Deploy. Panel `noindex` başlığıyla yayınlanır.

## Değişmez kurallar

Bunlar kodda zorunlu kontrol olarak uygulanır; ayar, şablon veya API isteğiyle kapatılamaz. Her biri için `tests/` altında test vardır.

1. **Onaysız gönderim yok.** Sadece `approved` mesaj gönderilir. Onaylı bir mesaj düzenlenirse tekrar `draft` olur. Toplu onay sadece açıkça listelenen kimlikler için çalışır (`src/services/sendService.js`, `draftService.js`).
2. **Ret listesi.** Çıkma, spam şikayeti, kalıcı bounce, İYS reddi ve `do_not_contact` adresleri `suppressions` tablosuna girer. Gönderim anında tekrar kontrol edilir. API'de silme işlemi yoktur; işletme silinse bile kayıt kalır.
3. **`do_not_contact` kilidi.** Bu aşamaya geçen işletmenin bekleyen taslakları iptal edilir (`rejected`, `error: do_not_contact`), adresi ret listesine girer, aşaması bir daha değiştirilemez.
4. **Yasal footer.** Gönderen adı, iletişim bilgisi ve çıkma linki gönderim anında eklenir (taslakta saklanmaz, şablondan kaldırılamaz). `List-Unsubscribe` ve `List-Unsubscribe-Post: List-Unsubscribe=One-Click` başlıkları eklenir. Gönderen bilgisi eksikse gönderim yapılmaz.
5. **Çıkma linki GET ile işlem yapmaz.** `GET /unsubscribe/:token` onay sayfası gösterir, çıkarma `POST` ile yapılır (RFC 8058 tek tık POST'u da desteklenir).
6. **Limitler.** Günlük limit (varsayılan 30, en fazla 100 = Resend ücretsiz kotası), mailler arası rastgele 30–90 sn, aynı alan adına günde en fazla 2 mail, sadece gönderim saatlerinde (varsayılan hafta içi 09:30–17:30, `Europe/Istanbul`). Bekleme süresi ve alan adı limiti ayarlanamaz.
7. **Sadece işletmenin yayınladığı iletişim bilgisi.** E-posta kaydedilirken kaynağı (`emailSource`: `website | google_profile | manual | reply`) zorunludur. Kişisel e-posta tahmini yapılmaz, satın alınmış liste kullanılmaz.
8. **Gizli bilgiler** sadece `.env` dosyasında durur (`.gitignore`'da). Logger bilinen gizli değerleri maskeler.

## Yasal bağlam

- Tacir/esnafa gönderilen ticari elektronik iletiler için önceden onay şartı yoktur, ancak reddetme hakkını kullananlara ileti gönderilemez.
- Gönderimden önce adresler İYS'ye kaydedilmeli ve ret durumları kontrol edilmelidir. MVP'de bu kontrol **manueldir**: İYS'den indirilen ret listesi CSV olarak `POST /api/suppressions/import-iys` ile içe aktarılır (sebep: `iys_ret`). Otomatik İYS entegrasyonu sonraki bir fazdır.
- İYS kaydı için kurumsal (alan adı uzantılı) e-posta gerekir.
- **Bu bir hukuki görüş değildir. Büyük hacimli gönderimden önce hukuki kontrol önerilir.**

## API

Tüm `/api/*` uçları `x-api-key` başlığı ister. Hata gövdesi: `{ "error": "Türkçe mesaj", "code": "..." }`.

| Metot | Yol | Açıklama |
|---|---|---|
| GET | `/api/locations`, `/api/locations/:il/districts` | İl ve ilçe listesi |
| GET/POST | `/api/businesses` | Liste (`province, district, category, stage, q, page, limit`) / oluştur |
| GET/PATCH/DELETE | `/api/businesses/:id` | Detay (aktiviteler ve mesajlar dahil) / güncelle / sil |
| POST | `/api/businesses/:id/stage` | `{ stage, note }` aşama değiştir |
| POST | `/api/businesses/:id/activities` | `{ type: note\|call\|meeting, text }` |
| POST | `/api/businesses/import` | CSV (`text/csv` gövde veya `{ csv }`) |
| GET/POST | `/api/campaigns` | Kampanya liste / oluştur |
| GET/PATCH/DELETE | `/api/campaigns/:id` | |
| POST | `/api/campaigns/:id/drafts` | Hedefteki `new` aşamasındaki işletmeler için taslak üret; `{ businessIds }` ile belirli işletmeler |
| GET | `/api/messages` | `status, campaign, business` filtresi |
| GET | `/api/messages/:id/preview` | Footer ve başlıklar dahil gerçek mail önizlemesi |
| PATCH | `/api/messages/:id` | `{ subject, body }` taslak düzenle |
| POST | `/api/messages/:id/approve`, `/reject`, `/mark-replied` | |
| POST | `/api/messages/approve` | `{ ids: [...] }` toplu onay |
| POST | `/api/messages/:id/send` | Tek onaylı mesajı hemen gönder (tüm kurallar geçerli) |
| POST | `/api/messages/send-approved` | Onaylıların hepsini arka planda, 30–90 sn arayla gönder (202) |
| GET/POST | `/api/suppressions` | Ret listesi / elle ekle |
| POST | `/api/suppressions/import-iys` | İYS ret CSV'si |
| GET | `/api/funnel?province=` | Huni özeti |
| GET/PATCH | `/api/settings` | Limitler, gönderim saatleri, gönderen bilgileri |

Herkese açık: `GET /health`, `GET|POST /unsubscribe/:token`, `POST /webhooks/resend`.

### CSV biçimleri

İşletme listesi (virgül veya noktalı virgül ayırıcı, ilk satır başlık):

```
name,category,province,district,neighborhood,address,email,emailSource,phone,website,instagram,contactPerson,tags,notes,priority
Moda Kahve,kafe,İstanbul,Kadıköy,,,info@modakahve.com,website,,https://modakahve.com,,Ayşe Hanım,butik|deniz,,2
```

`category`: `kafe/cafe, restoran/restaurant, fırın/bakery, pastane/patisserie, bar, diğer/other`. E-posta varsa `emailSource` zorunludur. Aynı e-posta zaten kayıtlıysa satır atlanır.

İYS ret listesi: `email` (veya `e-posta`, `alici`) sütunu; yoksa ilk sütun kullanılır.

### Şablon değişkenleri

`{{greeting}}` (isim varsa "Merhaba Ahmet Bey,", yoksa "Merhaba,"), `{{businessName}}`, `{{contactPerson}}`, `{{district}}`, `{{province}}`, `{{category}}`, `{{bookingUrl}}`. Bilinmeyen değişken içeren şablon kaydedilemez.

## Uçtan uca deneme (curl)

```bash
export API=http://localhost:4000 KEY=<ADMIN_API_KEY>

# 1) İşletme ekle — Resend test adresi: delivered@resend.dev
curl -s -X POST $API/api/businesses -H "x-api-key: $KEY" -H 'Content-Type: application/json' -d '{
  "name":"Test Kafe","category":"cafe",
  "location":{"province":"Ankara","district":"Çankaya"},
  "contact":{"email":"delivered@resend.dev","contactPerson":"Ahmet Bey"},
  "emailSource":"manual"}'

# 2) Kampanya
curl -s -X POST $API/api/campaigns -H "x-api-key: $KEY" -H 'Content-Type: application/json' -d '{
  "name":"Ankara deneme","target":{"provinces":["Ankara"],"categories":["cafe"]},
  "initialSubject":"{{businessName}} için kısa bir öneri",
  "initialBody":"{{greeting}}\n\n{{district}} bölgesindeki {{businessName}} için Gastromind'"'"'ı tanıtmak istedim.\nDemo: {{bookingUrl}}"}'

# 3) Taslak üret → önizle → onayla → gönder
curl -s -X POST $API/api/campaigns/<CAMPAIGN_ID>/drafts -H "x-api-key: $KEY"
curl -s $API/api/messages/<MESSAGE_ID>/preview -H "x-api-key: $KEY"
curl -s -X POST $API/api/messages/<MESSAGE_ID>/approve -H "x-api-key: $KEY"
curl -s -X POST $API/api/messages/<MESSAGE_ID>/send -H "x-api-key: $KEY"

# 4) Çıkma linki: tarayıcıda $API/unsubscribe/<unsubscribeToken> aç → butona bas
```

Gönderim saatleri dışında deniyorsan önce `PATCH /api/settings` ile `{"sendWindow":{"start":"00:00","end":"23:59","weekdaysOnly":false}}` ayarla, sonra geri al.

### Anahtar gelince doğrulama

- **MongoDB:** `npm run check:db` — bağlanır, ping atar, geçici bir kayıtla yazma/okuma/silme yetkisini dener. Bağlantı adresini yazdırmaz.

- **Resend:** `.env`'e `RESEND_API_KEY` ve doğrulanmış alan adından `MAIL_FROM_ADDRESS` gir, yukarıdaki akışı `delivered@resend.dev` ile çalıştır. Mesaj `sent` olmalı ve `providerMessageId` dolmalı.
- **Resend webhook:** Resend panelinde `https://<APP_BASE_URL>/webhooks/resend` adresine `email.sent, email.delivered, email.opened, email.bounced, email.complained, email.failed` olaylarını ekle, verilen `whsec_...` değerini `RESEND_WEBHOOK_SECRET`'a yaz. Test mailinden sonra mesaj durumu `delivered` olmalı. `bounced@resend.dev` adresine gönderim, adresi ret listesine eklemeli.

## Testler

```bash
npm test
```

Testler `mongodb-memory-server` ile bellek içi MongoDB kullanır; ilk çalıştırmada MongoDB binary'si indirilir. İnternet erişimi kısıtlı bir ortamda sistemdeki bir `mongod`'u kullanmak için: `MONGOMS_SYSTEM_BINARY=/yol/mongod npm test`.
