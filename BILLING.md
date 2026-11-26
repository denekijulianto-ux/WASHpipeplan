# WASHLY PRO — Langganan, Pembayaran & Dasbor Pendapatan

Dokumen ini menjelaskan sistem langganan yang **ditambahkan** ke WASHLY tanpa mengganti arsitektur lama
(aplikasi React satu-berkas + Firebase Auth + Cloud Firestore + Android Capacitor).

> Status singkat: kode backend, aturan keamanan, UI, dan plugin Android sudah selesai dan diuji secara lokal.
> **Belum aktif di produksi**: butuh paket Firebase Blaze, deploy Cloud Functions, akun Midtrans, dan produk
> langganan di Play Console (lihat [§9 Kesiapan produksi](#9-kesiapan-produksi)). Sampai `billing.enabled`
> dinyalakan di `auth-config.js` **dan** admin menyalakan "Aktifkan pembatasan FREE/PRO", aplikasi berperilaku persis seperti sebelumnya.

---

## 1. Arsitektur

```
 Aplikasi web (GitHub Pages)            Aplikasi Android (Capacitor)
 ┌──────────────────────────┐           ┌──────────────────────────────┐
 │ Billing store (hasAccess) │◄─────────►│ Billing store + plugin        │
 │ Harga · Upgrade · Langgan │  Firestore│ WashlyBilling (Play Billing 8)│
 └────────────┬─────────────┘  (baca)    └──────────────┬───────────────┘
              │ callable (ID token)                     │ purchaseToken
              ▼                                         ▼
 ┌──────────────────────────────────────────────────────────────────────┐
 │ Cloud Functions (asia-southeast2) — satu-satunya penulis data langganan│
 │ billingCheckout · billingRefreshOrder · billingCancel · playVerify     │
 │ midtransWebhook (HTTP) · playRtdn (Pub/Sub) · billingSweep (terjadwal) │
 │ projectUsage (trigger) · admin* (metrik, pengguna, grant, konfigurasi) │
 └──────────┬───────────────────────┬────────────────────────┬──────────┘
            │ Snap + Status API      │ Android Publisher API   │ Admin SDK
            ▼                        ▼                         ▼
        Midtrans               Google Play              Cloud Firestore
```

* **Sumber kebenaran hak akses:** dokumen `entitlements/{uid}`. Dokumen ini hanya ditulis server setelah pembayaran
  diverifikasi langsung ke Midtrans / Google Play. Aplikasi hanya membacanya (`firestore.rules`: `allow write: if false`).
* **Satu akun, semua platform:** hak akses melekat pada UID Firebase, bukan perangkat. Pembelian Google Play terlihat
  di web, dan pembelian web terlihat di Android (hanya untuk *memakai* fitur; aplikasi Android tidak mengarahkan ke
  pembayaran web — lihat §5).
* **Penegakan di server:** batas proyek cloud paket FREE ditegakkan oleh `firestore.rules` (membaca `usage/{uid}` dan
  `entitlements/{uid}`). Admin tetap tanpa batas.
* **Batasan yang jujur:** semua perhitungan rekayasa WASHLY berjalan di perangkat (luring). Karena itu kunci fitur
  seperti *Cetak DED* atau *Analisis air tanah* ditegakkan di aplikasi. Pengguna yang membongkar JavaScript bisa
  melewatinya di perangkatnya sendiri, tetapi tidak bisa memberi dirinya status PRO di server, menambah proyek cloud
  melebihi batas, atau memalsukan pembayaran. Memindahkan perhitungan ke server akan mematikan kerja luring di
  lapangan, jadi tidak dilakukan.

### Berkas

| Berkas | Isi |
|---|---|
| `functions/index.js` | Definisi Cloud Functions (region Jakarta), rahasia & parameter |
| `functions/src/config.js` | Katalog fitur, paket bawaan, validasi konfigurasi admin |
| `functions/src/lifecycle.js` | Logika siklus langganan murni (status, perpanjangan, tenggang, refund, pemetaan Google Play) |
| `functions/src/service.js` | Checkout, webhook, verifikasi Play, RTDN, sweep, notifikasi, fungsi admin |
| `functions/src/metrics.js` | Metrik pendapatan (MRR, ARR, ARPPU, konversi, churn) beserta definisinya |
| `functions/src/providers.js` | Klien HTTP Midtrans & Google Play Developer API |
| `functions/test/*.test.js` | 20 uji unit (Firestore tiruan di memori) |
| `functions/test-rules/rules.test.js` | Uji `firestore.rules` di Firestore Emulator |
| `firestore.rules` | Koleksi langganan baca-saja, batas proyek FREE |
| `src/index.dev.html` | `Billing` store (`Billing.has/require`), `PricingDialog`, `UpgradeDialog`, `SubscriptionDialog`, `AdminBillingDialog`, `ProGate`, titik-titik pembatasan |
| `android/.../WashlyBillingPlugin.java` | Plugin Google Play Billing (Billing Library 8.3.0) |
| `firebase.json` | Konfigurasi deploy rules & functions + emulator |

## 2. Paket & fitur

Harga bawaan (dapat diubah admin tanpa deploy di **Dasbor pendapatan → Paket & harga**):

| Paket | Kode | Harga | Periode |
|---|---|---|---|
| WASHLY FREE | `FREE` | Rp0 | — |
| WASHLY PRO Bulanan | `PRO_MONTHLY` | Rp125.000 | 1 bulan |
| WASHLY PRO Tahunan | `PRO_YEARLY` | Rp499.000 | 12 bulan (hemat 67% dibanding 12 × bulanan) |

Fitur (sesuai fitur yang **benar-benar ada** di aplikasi). FREE memuat alat dasar, PRO membuka semuanya:

| Fitur | FREE | PRO | Dibatasi di |
|---|---|---|---|
| Pemetaan, GPS & survei, analisis hidrolis jaringan, simpan/muat .json/.gpx, Asisten luring | ✓ | ✓ | — |
| Kalkulator **kebutuhan air & jumlah node** (dasar) | ✓ | ✓ | — |
| Kalkulator **debit sumber** & **daya pompa** | — | ✓ | tab kalkulator (`calc_advanced`) |
| Pompa sumur bor: head, daya, kurva, energi (dasar) | ✓ | ✓ | — |
| Pompa: daya min/ideal/maks, spesifikasi pengadaan, paket all-in | — | ✓ | `pump_advanced` |
| Desain pengolahan air (aerator, filter, membran, filter rumah tangga) | — | ✓ | `treatment_design` |
| BoQ & RAB **umum**: volume, harga bawaan, ubah harga satuan, PPN | ✓ | ✓ | — |
| RAB lanjutan: SHS/IKK provinsi, impor & cocokkan SHS, spesifikasi min/ideal/maks, edit item RAB | — | ✓ | `rab_advanced` |
| Laporan teknis | pratinjau di layar bertanda air (tanpa cetak/PDF) | cetak & PDF dengan RAB & lampiran spesifikasi | `report_preview` / `report_print`, `rab_print` |
| Review & **tanda tangan elektronik** | — | ✓ | dialog Status & review (`esign`) |
| **Ganti logo** instansi | — (logo WASHLY) | ✓ | `custom_logo` |
| Gambar DED | pratinjau di layar bertanda air (tanpa cetak/PDF) | cetak & PDF | `ded_print` |
| Penulangan beton (BBS) & jembatan pipa | — | ✓ | `structural_design` |
| Rehabilitasi sistem existing | — | ✓ | `rehab_module` |
| Analisis potensi air tanah · Profil DEM detail · Gambar manual DED · Mode AI | — | ✓ | masing-masing |
| Proyek tersimpan di cloud | 3 proyek (bisa diatur) | tanpa batas | `newProject` + **firestore.rules** |

Proyek & data yang sudah ada **tidak pernah dikunci atau dihapus** saat turun ke FREE. Semua pembatasan melalui satu pintu:
`Billing.has(feature)` / `Billing.require(feature)` / `<ProGate feature>`. Konfigurasi lama di Firestore yang belum memuat kunci fitur baru
otomatis memakai nilai bawaan di atas.

### Akun & akses proyek (berlaku dengan atau tanpa langganan)

* **Pendaftaran tanpa persetujuan admin.** Akun baru langsung aktif dengan paket FREE (`users/{uid}.status = 'approved'`).
  Akun lama yang masih `pending` diperlakukan aktif. Admin tetap bisa **menangguhkan** atau **menolak** akun di *Kelola pengguna*.
* **Proyek milik orang lain:**
  * **Pemilik & admin**: akses penuh.
  * **Petugas yang ditunjuk pemilik** (surveyor, penggambar, pemeriksa, penyetuju): melihat semua lembar dan menandatangani,
    tetapi **tidak dapat mengubah** isi proyek (perubahan ditolak di aplikasi, kecuali langkah tanda tangan/review).
  * **Pengguna lain**: tidak bisa melihat proyek sama sekali (daftar, jaringan pipa, maupun isinya). Daftar pengguna juga privat (hanya admin).
* **Penunjukan tim = fitur PRO.** Pemilik PRO menunjuk surveyor, penggambar, pemeriksa, dan penyetuju di *Status & review* dengan mengetik
  e-mail akun WASHLY. Fungsi `projectFindUser` memeriksa paket PRO pemilik lalu mencari akun itu (tanpa membuka daftar pengguna).
  `firestore.rules` (`mayAssignCrew`) menolak penunjukan orang lain oleh pemilik FREE; tim yang sudah ada tetap tersimpan bila PRO berakhir.
* **Ditegakkan di server:** `projects`, `projectNet`, `projectData`, dan `photos` hanya terbaca oleh pemilik, admin, dan tim proyeknya;
  `users` hanya terbaca oleh pemilik akun & admin. Teruji di emulator (`npm run test:rules`).
* Tampilan penampil selalu memangkas data ke jaringan saja, bahkan bila perangkat masih menyimpan salinan lengkap di cache.

## 3. Database (Cloud Firestore)

Tidak ada tabel pengguna baru: semuanya merujuk `users/{uid}` dan UID Firebase Auth yang sudah ada.

| Koleksi | Kunci | Isi | Baca | Tulis |
|---|---|---|---|---|
| `billing_config/main` | — | paket (kode, nama, tier, bulan, harga, aktif, produk/base plan Play), fitur per paket, `freeLimits`, `graceDays`, `reminderDays`, `pendingHours`, `promo`, `enforce` | publik | server |
| `entitlements/{uid}` | uid | `tier`, `planCode`, `status`, `provider`, `subscriptionId`, `accessUntil(Ts)`, `currentPeriodEnd`, `autoRenew`, `graceEndsAt`, `features`, `limits` | pemilik, admin | server |
| `subscriptions/{id}` | `web_{uid}` · `play_{hash token}` · `admin_{uid}_{t}` | `subjectType`(`user`/`org`), `subjectId`, `userId`, `orgId`, `seats`, `planCode`, `status`, `provider`, `providerSubscriptionId`, `purchaseTokenHash`, `startedAt`, `currentPeriodStart/End`, `nextRenewalAt`, `canceledAt`, `graceEndsAt`, `autoRenew`, `renewalMode`, `createdAt`, `updatedAt` | pemilik, admin | server |
| `payments/{id}` | order_id Midtrans · `play_{orderId}` | `userId`, `subscriptionId`, `provider`, `transactionId`, `amount`, `currency`, `status` (PENDING/PAID/FAILED/EXPIRED/CANCELED/REFUNDED), `method`, `paidAt`, `refundStatus`, `refundAmount`, `refundedAt`, `invoiceRef`, `promoCode`, `createdAt` | pemilik, admin | server |
| `subscription_events/{auto}` | — | jejak audit: `payment_initiated`, `payment_succeeded`, `payment_failed`, `subscription_created/renewed/reactivated/canceled/expired/upgraded/downgraded/restored`, `grace_period_started/ended`, `refund_processed`, `renewal_reminder_sent` (+ `actor`, `reason` untuk tindakan admin) | pemilik, admin | server |
| `projectNet/{pid}` | id proyek | salinan **jaringan saja** (nama, lokasi, titik: id/label/jenis/koordinat/elevasi, pipa: id/label/dari/ke/bahan/diameter/jalur), terkompresi | semua akun aktif | pemilik/petugas (bersama `projectData`) |
| `webhook_events/{provider_key}` | ID idempoten | `provider`, `eventType`, `payload` (tanpa rahasia), `payloadHash`, `status` (RECEIVED/PROCESSED/FAILED/IGNORED), `processedAt`, `error`, `attempts` | admin | server |
| `play_tokens/{sha256}` | hash token | token pembelian Play + `uid` (untuk RTDN & sweep) | **tidak ada** | server |
| `usage/{uid}` | uid | `cloudProjects` (dihitung ulang server) | pemilik, admin | server |
| `admin_audit/{auto}` | — | `actorUid`, `actorEmail`, `action` (grant/revoke/config), `target`, `reason`, `data`, `at` | admin | server |

Relasi: `users 1—n subscriptions 1—n payments`, `subscriptions 1—n subscription_events`, `users 1—1 entitlements`.
**Siap tim/organisasi:** setiap langganan punya `subjectType`/`subjectId`/`orgId`/`seats`. `resolveEntitlement()` menggabungkan
banyak langganan per pengguna, jadi langganan organisasi kelak cukup ditambahkan sebagai sumber hak akses baru tanpa
mengubah skema. Paket TEAM sendiri **belum** dibuat.

Migrasi: Firestore tanpa skema, jadi cukup deploy `firestore.rules` dan Functions. Dokumen terbentuk saat dipakai.
`billing_config/main` dibuat oleh admin saat menyimpan konfigurasi pertama kali. `usage/{uid}` diisi ulang oleh `billingSweep`.

## 4. Siklus langganan

Status: `FREE`, `ACTIVE`, `PENDING`, `PAST_DUE`, `GRACE_PERIOD`, `CANCELED`, `EXPIRED`, `REFUNDED`.
Yang memberi akses PRO: `ACTIVE`, `CANCELED` (sampai akhir periode), `GRACE_PERIOD` (sampai akhir tenggang).

**Web (Midtrans) — perpanjangan manual.** QRIS, VA, dan e-wallet tidak mendukung penagihan berulang yang bisa diandalkan,
jadi tiap periode dibayar sekali:

1. `billingCheckout` membuat `payments/{orderId}` = PENDING dan transaksi Snap, lalu aplikasi membuka halaman pembayaran Midtrans.
2. Midtrans memanggil `midtransWebhook`. Server **memverifikasi tanda tangan SHA-512**
   (`order_id+status_code+gross_amount+serverKey`, dibandingkan dengan waktu konstan), mencatat `webhook_events` (idempoten),
   lalu **mengambil ulang status dari API Midtrans**. Isi notifikasi tidak dipercaya; nominal & mata uang dicocokkan dengan tagihan.
3. Bila lunas, dalam satu transaksi Firestore: pembayaran PAID, langganan diaktifkan/diperpanjang, peristiwa dicatat,
   `entitlements` dihitung ulang, dan notifikasi dikirim.
4. Kembali ke aplikasi (`?billing=finish&order=`): aplikasi memanggil `billingRefreshOrder` (server menanyakan status ke
   Midtrans). Parameter URL seperti `transaction_status=settlement` **diabaikan**.
5. Pembayaran di muka ditumpuk: periode baru dimulai saat periode lama habis.
6. Pengingat H-7 & H-1. Setelah periode habis tanpa pembayaran: `GRACE_PERIOD` selama `graceDays` (bawaan 3 hari, PRO masih aktif),
   lalu `EXPIRED` → FREE. Bila membayar saat tenggang, periode baru disambung dari akhir periode lama (hari tenggang tidak gratis).
7. **Batal** (`billingCancel`): `CANCELED`, tidak ada pengingat lagi, PRO tetap aktif sampai akhir periode, lalu `EXPIRED`.
8. **Gagal/kedaluwarsa**: tagihan FAILED/EXPIRED, langganan berjalan tidak terganggu. Tagihan tertunda > `pendingHours` ditandai EXPIRED.
9. **Refund** (dari Dashboard Midtrans): notifikasi `refund` → pembayaran REFUNDED. Refund penuh mencabut PRO periode tersebut (`REFUNDED`).

**Google Play — perpanjangan otomatis oleh Google.**

1. Aplikasi meminta `billingAccountId` (hash UID) lalu menjalankan alur Play dengan `setObfuscatedAccountId`.
2. Token pembelian dikirim ke `playVerify`. Server memanggil `purchases.subscriptionsv2.get` dan memastikan
   `obfuscatedExternalAccountId` = akun ini. Token yang sudah tertaut ke akun lain ditolak.
3. Server meng-**acknowledge** pembelian (wajib dalam 3 hari), menyimpan token hanya di `play_tokens` (tak terbaca klien),
   mencatat transaksi per `latestOrderId`, dan menghitung ulang hak akses.
4. **RTDN** (Pub/Sub `play-billing`) → `playRtdn`: setiap perubahan (perpanjang, batal, tenggang, on-hold, kedaluwarsa,
   pulih, `voidedPurchase` = refund) diambil ulang dari API Play, lalu diterapkan. Idempoten per `messageId`.
5. Pemetaan: ACTIVE (+autoRenew mati → CANCELED), IN_GRACE_PERIOD → GRACE_PERIOD (PRO tetap), ON_HOLD/PAUSED → PAST_DUE (tanpa PRO),
   CANCELED → CANCELED (sampai `expiryTime`), EXPIRED → EXPIRED. Upgrade/downgrade (`linkedPurchaseToken`) menonaktifkan token lama.
6. **Pulihkan pembelian**: `queryPurchases` di perangkat → setiap token diverifikasi ulang di server (aman lintas perangkat).
7. `billingSweep` memeriksa ulang langganan Play yang periodenya lewat, sebagai cadangan bila RTDN terlewat.

**Admin:** `adminBillingGrant` memberi PRO tanpa pembayaran (wajib alasan, tercatat di `admin_audit` dan peristiwa) dan `adminBillingRevoke`
mencabut pemberian admin. Langganan berbayar **tidak bisa** diubah manual; harus lewat Midtrans/Play Console (refund/cancel).

**Notifikasi** memakai kotak masuk yang sudah ada (`notifications`, ikon lonceng) plus push ntfy bila `NTFY_TOPIC` diisi
(pesan umum tanpa data pribadi): aktif, diperpanjang, pengingat perpanjangan, gagal bayar, tenggang, dibatalkan, berakhir, refund.

### Menghubungkan Midtrans dari aplikasi (tanpa GitHub)
Admin: **Pendapatan → Pembayaran online**. Pilih **Sandbox/Production**, tempel **Server Key** (Settings → Access Keys → General Credentials →
*Generate server key*) dan **Signature Secret Key**, lalu **Simpan & uji koneksi**.
* `adminSetMidtrans` memvalidasi format & lingkungan (`SB-Mid-server-` untuk Sandbox), menguji kunci ke API status Midtrans (401 = ditolak),
  lalu menyimpannya di `billing_secrets/midtrans`. Koleksi ini tidak bisa dibaca atau ditulis dari aplikasi, termasuk oleh admin; audit hanya mencatat 4 digit terakhir.
  `billing_config/main.midtrans` hanya berisi status publik (`configured`, `mode`).
* Semua fungsi memakai kunci ini (dengan Secret Manager sebagai cadangan). Setiap transaksi mengirim header `X-Override-Notification`
  berisi alamat webhook, jadi Notification URL di dashboard tidak wajib diisi.
* Notifikasi diverifikasi dengan **Signature Secret Key** (aturan Midtrans 2026); Server Key diterima selama masa transisi.
* **Sandbox:** hanya admin yang boleh membuat transaksi (dijaga server), karena simulator publik bisa "membayar" tanpa uang.
  Transaksi Sandbox diberi tanda `sandbox: true` dan tidak dihitung pendapatan, MRR, maupun pelanggan.
* **Production:** setelah terhubung, centang **Buka pembayaran online untuk semua pengguna** (`paymentsPublic`).
* Uji otomatis: workflow **Uji pembayaran Sandbox** membuat VA atas nama admin, membayarnya di simulator, dan memeriksa PAID + PRO.

### Virtual Account di dalam aplikasi (Midtrans Core API)
Saat `payments: true`, tombol beli di web membuka **Pilih metode pembayaran**:
* **Virtual Account** BCA / BNI / BRI / Mandiri (biller code + bill key) / Permata. `billingVaCharge` memanggil `POST /v2/charge`
  (`bank_transfer` / `echannel` / `permata`) dan nomor VA tampil langsung di aplikasi beserta langkah bayar per bank.
  Setelah nasabah membayar, Midtrans memanggil `midtransWebhook` (tanda tangan + cek API status), lalu **PRO aktif otomatis** dan dialog VA ikut berubah.
  Tagihan VA yang masih berlaku dipakai ulang. Nama merchant yang tampil di aplikasi bank adalah nama merchant Midtrans, bukan nama pribadi.
* **QRIS, e-wallet & kartu**: halaman Snap Midtrans (seperti sebelumnya).
* **Transfer bank manual**: bila diaktifkan admin.
Bank VA bisa diatur di `billing_config/main.va.banks`. Di Production, aktivasi tiap bank VA dilakukan di dashboard Midtrans.

### Transfer bank / QRIS manual (tanpa payment gateway)
Saluran web yang aktif tanpa akun Midtrans. Diatur admin di **Pendapatan → Paket & harga → Pembayaran transfer bank / QRIS**
(bank, nomor rekening, atas nama, gambar QRIS opsional, batas waktu bayar).
1. `manualOrder`: server membuat tagihan `payments/{TRF-…}` PENDING dengan **nominal unik** (harga + 1–499 rupiah), dan memakai ulang tagihan terbuka yang sama.
2. Pengguna mentransfer lalu `manualProof`: nama & bank pengirim + foto bukti (≤ ±500 KB, hanya gambar) disimpan di `payment_proofs/{id}`
   (hanya pengirim & admin yang bisa membaca). Admin mendapat notifikasi. **Bukti tidak mengaktifkan PRO.**
3. Admin mencocokkan nominal unik dengan **mutasi rekening**, lalu **Konfirmasi dana masuk** (`adminManualDecide`) → pembayaran PAID,
   langganan `web_{uid}` aktif/diperpanjang (provider `manual`), peristiwa + audit dicatat, pengguna diberi tahu. Atau **Tolak** dengan alasan.
4. Tagihan yang tidak dibayar kedaluwarsa setelah `manual.hours` (bawaan 72 jam). Perpanjangan memakai alur yang sama, dengan pengingat H-7/H-1 dan masa tenggang.
5. Tidak tampil di aplikasi Android (kebijakan Play: wajib Google Play Billing).

## 5. Kepatuhan Google Play

* WASHLY PRO adalah layanan digital yang dipakai di dalam aplikasi, jadi **aplikasi Android memakai Google Play Billing**.
  Di Android, aplikasi tidak menampilkan pembayaran web, tautan, atau ajakan membayar di luar Play (`IS_NATIVE` menyembunyikan Midtrans).
* Pengguna yang sudah membeli di web tetap mendapat PRO saat masuk di Android (konten yang dibeli di luar aplikasi boleh
  diakses). Aplikasi tidak mengarahkan ke pembelian di luar.
* **User Choice Billing (UCB) di Indonesia**: Google membuka UCB untuk pengembang di Indonesia (sejak 2022), dan putusan
  KPPU yang dikuatkan Mahkamah Agung (Maret 2026) mewajibkan Google mengizinkan partisipasi UCB. Pada Juni 2026 Google
  mengumumkan program *expanded billing choice*, dengan rincian biaya untuk pasar selain US/UK/EEA "akan diumumkan".
  UCB **wajib pendaftaran di Play Console**, tetap harus menawarkan Google Play Billing berdampingan, dan memakai API khusus
  (`enableUserChoiceBilling`, pelaporan transaksi eksternal). **Belum diimplementasikan.** Jalur yang dipasang
  (hanya Play Billing) selalu patuh. Bila ingin UCB: daftar di Play Console → Policy → Billing choice, lalu tambahkan
  `UserChoiceBillingListener` di `WashlyBillingPlugin` dan alur Midtrans terpisah untuk Android.
* Acknowledge, verifikasi server, pembatalan & pengelolaan lewat Play (`manage()` membuka halaman langganan Play),
  dan tidak ada pola gelap (harga, periode, perpanjangan otomatis, dan cara batal ditampilkan sebelum membeli).
* Promosi/uji coba Play hanya lewat *offers* di Play Console. Kode promo WASHLY hanya untuk web (diverifikasi server, tetap dibayar).
* Catatan teknis: `setSubscriptionReplacementMode` ditandai deprecated di Billing Library 8.3, tetapi masih berfungsi.
  Ganti ke API penggantinya saat naik ke Billing Library 9.

## 6. Metrik pendapatan (Dasbor → Pendapatan & pelanggan)

Definisi lengkap ada di `functions/src/metrics.js` dan di panel "Definisi metrik" dasbor:

* **Pendapatan diterima** = pembayaran PAID di rentang. **Tertunda tidak dihitung.** Refund dikurangkan → pendapatan bersih.
  Google Play dicatat dengan harga daftar (bruto, sebelum potongan Google & pajak). Angka bersih resmi ada di laporan Play Console.
* **MRR** = Σ (harga paket ÷ bulan paket) untuk langganan berbayar yang memberi akses saat ini (tahunan ÷ 12). Pemberian admin tidak dihitung.
  **MRR berkomitmen** = tanpa langganan yang sudah dibatalkan. **ARR** = MRR × 12.
* **ARPPU** = pendapatan bersih ÷ pengguna unik yang membayar di rentang.
* **Konversi FREE→PRO** = pengguna yang pembayaran lunas pertamanya jatuh di rentang ÷ pengguna terdaftar yang belum pernah membayar sebelum rentang.
* **Churn langganan** = langganan berbayar yang berakhir/refund di rentang ÷ langganan berbayar aktif di awal rentang
  (bukan churn pengguna, bukan churn pendapatan).
* **Tingkat perpanjangan** = perpanjangan ÷ (perpanjangan + berakhir).
* Setiap kartu dibandingkan dengan periode sebelumnya yang sama panjang. Grafik per hari/minggu/bulan/tahun menampilkan
  diterima, tertunda, refund, dan langganan baru, dengan rincian per paket & per penyedia.

Metrik dihitung saat diminta dari seluruh koleksi. Untuk lebih dari ±50.000 pembayaran, tambahkan agregasi harian terjadwal.

## 7. Panduan deploy

### 7.1 Prasyarat
1. Firebase project `washpipe-93f48` dinaikkan ke paket **Blaze** (Cloud Functions & Secret Manager membutuhkannya).
2. Node.js 22 dan Firebase CLI: `npm i -g firebase-tools`, lalu `firebase login`.
3. Akun **Midtrans** (daftar di dashboard.midtrans.com; mulai di **Sandbox**).
4. Akses **Play Console** untuk `com.washly.app`.

### 7.2 Variabel & rahasia (tidak pernah di Git / di aplikasi)

| Nama | Jenis | Contoh / catatan |
|---|---|---|
| `MIDTRANS_SERVER_KEY` | **Secret** | `firebase functions:secrets:set MIDTRANS_SERVER_KEY` (Server Key Sandbox `SB-Mid-server-…`, lalu Production) |
| `MIDTRANS_IS_PRODUCTION` | param | `false` (sandbox) / `true` |
| `ADMIN_EMAILS` | param | sama dengan daftar admin di `firestore.rules` & `auth-config.js`, dipisah koma |
| `PLAY_PACKAGE_NAME` | param | `com.washly.app` |
| `APP_URL` | param | `https://washlywater.github.io/` (tujuan kembali dari Midtrans) |
| `NTFY_TOPIC` | param | opsional, sama dengan `notify.ntfyTopic` |

Parameter diisi di `functions/.env.washpipe-93f48` (file ini **jangan** di-commit; sudah diabaikan oleh `.gitignore`), contoh:
```
MIDTRANS_IS_PRODUCTION=false
ADMIN_EMAILS=admin1@contoh.org,admin2@contoh.org
PLAY_PACKAGE_NAME=com.washly.app
APP_URL=https://washlywater.github.io/
```
Akses Google Play memakai **service account bawaan Cloud Functions** (tanpa file kunci): lihat §7.5.

### 7.2b Deploy otomatis lewat GitHub Actions (disarankan)
`.github/workflows/deploy-firebase.yml` menjalankan uji backend lalu `firebase deploy --only firestore:rules,functions`
setiap kali `firestore.rules`, `functions/**`, atau `.deploy-trigger` berubah di `main` (juga bisa dijalankan manual).
* Secret repo **FIREBASE_SERVICE_ACCOUNT**: isi JSON kunci service account (peran: *Editor*, *Cloud Functions Admin*,
  *Secret Manager Admin*, *Service Account User*). Tanpa secret ini alur dilewati.
* Opsional: secret **MIDTRANS_SERVER_KEY**; variable **MIDTRANS_IS_PRODUCTION**, **NTFY_TOPIC**.
  Bila Server Key belum ada, secret diisi penanda `NOT_CONFIGURED` (pembayaran web belum aktif).
* `ADMIN_EMAILS` diambil dari `auth-config.js`; region trigger Firestore dideteksi dari lokasi database.

### 7.3 Deploy
```bash
cd functions && npm ci && npm test && cd ..
```
```bash
firebase deploy --only firestore:rules,functions --project washpipe-93f48
```

### 7.4 Midtrans
1. Dashboard Midtrans (Sandbox) → *Settings → Payment → Notification URL*:
   `https://asia-southeast2-washpipe-93f48.cloudfunctions.net/midtransWebhook`
2. *Finish/Unfinish/Error Redirect URL*: `https://washlywater.github.io/?billing=finish` (aplikasi juga mengirim `callbacks.finish` per transaksi).
3. *Snap Preferences*: aktifkan QRIS, Virtual Account, GoPay/ShopeePay/e-wallet, kartu kredit/debit.
4. Uji dengan simulator pembayaran Sandbox, lalu ganti ke kunci Production dan `MIDTRANS_IS_PRODUCTION=true`.
5. Refund dilakukan dari Dashboard Midtrans. Notifikasinya otomatis memperbarui WASHLY.

### 7.5 Google Play Billing
1. Play Console → *Monetize → Products → Subscriptions* → buat produk **`washly_pro`** dengan dua *base plan*:
   **`monthly`** (perpanjang otomatis 1 bulan, Rp125.000) dan **`yearly`** (12 bulan, Rp499.000).
   Atur masa tenggang (mis. 3–7 hari) dan *account hold*. Harga Play diatur di sini dan harus disamakan manual dengan konfigurasi WASHLY.
2. *Users and permissions*: undang service account Functions
   (`washpipe-93f48@appspot.gserviceaccount.com` atau `<nomor>-compute@developer.gserviceaccount.com`, lihat IAM)
   dengan izin **View financial data** dan **Manage orders and subscriptions**. Aktifkan *Google Play Android Developer API* di Google Cloud.
3. **RTDN**: buat topik Pub/Sub `play-billing` di project Firebase. Beri `google-play-developer-notifications@system.gserviceaccount.com`
   peran *Pub/Sub Publisher* pada topik. Play Console → *Monetize setup → Real-time developer notifications* → isi topik
   `projects/washpipe-93f48/topics/play-billing` → *Send test notification*.
4. *License testing*: tambahkan akun Gmail penguji agar pembelian memakai kartu uji (tidak ditagih).
5. Unggah AAB ke *Internal testing*. Billing hanya bekerja pada aplikasi yang diinstal dari Play (bukan APK sideload).

### 7.5a Status deploy (23 November 2026)
* Paket **Blaze aktif**. Deploy lewat GitHub Actions (`washlywater/washlywater.github.io`) **berhasil**: `firestore.rules` + **16 Cloud Functions**
  di `asia-southeast2`, kebijakan pembersihan image 7 hari, dan uji cepat pasca-deploy
  (checkout/admin/playVerify tanpa login → 401, webhook Midtrans bertanda tangan palsu → 401).
* `MIDTRANS_SERVER_KEY` masih berisi penanda `NOT_CONFIGURED`. Pembayaran web belum aktif sampai Server Key asli disimpan sebagai secret GitHub.
* `auth-config.js`: `functions: true` (dasbor & Beri PRO untuk admin), `payments: false` (tombol beli belum dibuka).

### 7.5b Mode saat ini (sebelum Midtrans siap)
`auth-config.js` → `billing: { enabled: true, enforce: true, payments: false }`:
* Pembatasan FREE/PRO **sudah berlaku** di aplikasi walau Cloud Functions belum di-deploy: tanpa dokumen `billing_config/main`,
  aplikasi memakai paket bawaan, semua akun selain admin = FREE, admin = semua fitur.
* Batas 3 proyek cloud dihitung dari proyek milik pengguna sendiri. Penegakan di server lewat `firestore.rules` + `usage/{uid}`
  baru penuh setelah Cloud Functions aktif.
* Paket terlihat di header (**Langganan FREE/PRO/ADMIN**) dan di **Kelola pengguna** (label di samping nama).
* Tombol beli menampilkan "pembayaran online belum dibuka". Dasbor pendapatan disembunyikan karena butuh Cloud Functions.
* Setelah deploy & Midtrans siap: ubah `payments` menjadi `true`.

### 7.6 Mengaktifkan di aplikasi
1. `auth-config.js` → `billing: { enabled: true, region: "asia-southeast2" }` → `npm run build` → push (GitHub Pages) → `npm run build:android`.
2. Masuk sebagai admin → **Pendapatan → Paket & harga** → periksa harga, lalu **Simpan konfigurasi** (dokumen `billing_config/main` terbentuk).
   Selama "Aktifkan pembatasan FREE/PRO" mati, semua orang tetap memakai semua fitur.
3. Uji end-to-end di Sandbox / License testing (§8), lalu nyalakan pembatasan.

## 8. Hasil uji (23 November 2026)

| Area | Skenario | Hasil |
|---|---|---|
| Backend (unit, `npm test`, 21 uji) | katalog FREE/PRO baru; checkout (login, akun tidak ditangguhkan, pendaftar lama `pending` boleh membeli, paket valid, batas 5 tagihan/jam); tanda tangan webhook salah; lunas → PRO (semua fitur PRO terbuka); webhook duplikat; status dari API (bukan isi notifikasi); nominal dimanipulasi; gagal/kedaluwarsa + coba lagi; upgrade bulanan→tahunan; batal → tetap PRO → FREE; pengingat → tenggang → kedaluwarsa; bayar saat tenggang; refund; tagihan tertunda kedaluwarsa; kode promo; Google Play verifikasi/akun lain ditolak/restore/RTDN/voided/upgrade; otorisasi & audit admin; ubah harga; MRR/ARR/ARPPU/konversi/churn | **PASS** |
| Aturan Firestore (emulator, 5 uji) | pengguna tak bisa menulis data langganan; isolasi baca; batas proyek FREE; **pendaftaran langsung aktif**, akun `pending` lama aktif, akun ditangguhkan diblokir & tak bisa mengaktifkan diri; **isi lengkap & foto proyek orang lain tertutup, `projectNet` terbaca, tidak bisa ditulis orang lain; pemilik/petugas/admin bisa membaca** | **PASS** |
| E2E langganan (25 cek) | alur FREE→pembayaran Midtrans (disimulasikan)→PRO, batal, batas proyek, dasbor admin, ubah harga | **PASS** |
| E2E akses & batas FREE (26 cek) | daftar → langsung masuk (FREE); kalkulator dasar terbuka, debit sumber & daya pompa terkunci; pompa dasar tampil, spesifikasi/all-in terkunci; desain pengolahan → upgrade; RAB umum tampil, SHS/IKK terkunci, edit item → upgrade; **laporan hanya pratinjau bertanda air (tanpa cetak, Ctrl+P diblokir, tanpa RAB)**; **e-sign → upgrade**; **ganti logo → upgrade**; proyek tersimpan + `projectNet`; server menolak isi lengkap proyek orang lain; penampil jaringan saja (hanya tab Peta, tanpa alat edit, tanpa bangunan/debit/tekanan/RAB); cetak/ekspor ditolak; proyek orang lain tak pernah ditulis; setelah PRO: kalkulator lanjutan, cetak laporan dengan RAB, e-sign terbuka | **PASS** |
| E2E akses petugas (10 cek) | pendaftaran tanpa persetujuan; pengguna lain hanya jaringan & tak bisa membuka data proyek; petugas yang ditunjuk melihat semua lembar, banner hanya-baca, **perubahan ditolak** | **PASS** |
| Regresi lama (mode Indonesia) | review & tanda tangan, RAB, laporan pompa, hapus akun | **PASS** |
| Android | build APK/AAB dengan Billing Library 8.3.0 | **PASS (build)** |
| Android | pembelian Play nyata, restore, pembatalan, perpanjangan, ganti perangkat | **NOT TESTED**, butuh produk di Play Console |
| Midtrans | transaksi sandbox nyata, notifikasi nyata, refund nyata | **NOT TESTED**, butuh akun & Server Key |
| Deploy | Cloud Functions, RTDN Pub/Sub, jadwal sweep | **NOT TESTED**, butuh paket Blaze |

Menjalankan ulang:
```bash
cd functions && npm test
```
```bash
cd functions && npm run test:rules
```

## 9. Kesiapan produksi

**Yang harus dilakukan pemilik (tidak bisa dikerjakan dari sini):**
1. Naikkan Firebase ke **Blaze** dan deploy (§7.3).
2. Buat akun **Midtrans**, isi Server Key sebagai secret, atur Notification URL (§7.4). Untuk Production Midtrans perlu verifikasi bisnis (KTP/NPWP/rekening).
3. **Play Console**: produk `washly_pro` + base plan `monthly`/`yearly`, akses service account, RTDN, penguji lisensi (§7.5).
   Akun Play Console perlu *payments profile* (merchant) untuk menjual langganan.
4. Perbarui formulir **Data safety** Play: tambahkan "Purchase history" (dikumpulkan, untuk fungsi aplikasi & manajemen akun).
5. Uji Sandbox + License testing menyeluruh, lalu nyalakan pembatasan.

**Catatan keamanan:**
* Server Key Midtrans hanya di Secret Manager. Client key **tidak** dipakai (pembayaran lewat redirect Snap).
* `auth-config.js` hanya berisi konfigurasi publik Firebase. Jangan menaruh rahasia di sana.
* Pembatasan fitur yang dihitung di perangkat bisa diakali oleh pengguna teknis di perangkatnya sendiri (lihat §1). Status PRO,
  pembayaran, kuota cloud, dan data admin tetap terlindungi di server.
* App Check belum diaktifkan. Disarankan diaktifkan untuk Functions callable setelah deploy.
* Rate limit: 5 tagihan tertunda per pengguna per jam. Webhook hanya diproses dengan tanda tangan valid + konfirmasi API.

**Belum dibuat (disengaja / di luar cakupan awal):**
* Paket TEAM/organisasi (skema sudah siap: `subjectType`, `orgId`, `seats`).
* Penagihan berulang otomatis untuk kartu di web (Midtrans Subscription API). Saat ini web memakai perpanjangan manual + pengingat.
* User Choice Billing Android (§5).
* Faktur PDF resmi. Riwayat pembayaran menampilkan nomor order/transaksi sebagai referensi.
* Agregasi metrik terjadwal untuk data sangat besar.
