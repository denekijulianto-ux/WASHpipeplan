# Panduan rilis WASHLY ke Google Play — versi 1.4.0

Bagian yang bisa dikerjakan dari sisi kode **sudah selesai**:

| Status | Pekerjaan |
|---|---|
| ✅ | **AAB & APK 1.4.0 (versionCode 5)** sudah ditandatangani dengan kunci upload WASHLY (`WASHLY-1.4.0-release.aab`, `WASHLY-1.4.0-release.apk`) |
| ✅ | Berisi semua pembaruan terbaru: paket FREE/PRO, pratinjau laporan & DED bertanda air, hidrolis Ø dalam, jaringan loop, catatan tanggung jawab |
| ✅ | Situs, kebijakan privasi, syarat, refund & halaman hapus akun tayang di https://washlywater.github.io/ |
| ✅ | Aturan Firestore & Cloud Functions sudah ter-deploy otomatis (tidak perlu publish manual lagi) |
| ✅ | Di Android, langganan PRO **hanya** lewat Google Play Billing (Midtrans/VA/transfer disembunyikan, sesuai kebijakan Google Play) |

Langkah di bawah ini butuh akun, perangkat, atau tanda tangan Anda sendiri. Kerjakan berurutan.

---

## Langkah 1 — Amankan kunci upload (5 menit) ⚠️ PALING PENTING
File `washly-upload.jks` dan `keystore.properties` sudah dikirim ke chat sebelumnya (kunci yang sama dipakai untuk 1.4.0).

1. Pastikan **kedua file** tersimpan di 2 tempat aman (Google Drive pribadi yang tidak dibagikan + flashdisk/hard disk).
2. Kata sandinya ada di dalam `keystore.properties`; catat juga di pengelola kata sandi.
3. Jangan kirim ke siapa pun dan jangan unggah ke GitHub.

Tanpa kunci ini Anda **tidak bisa mengirim update**. Dengan Play App Signing kunci bisa direset lewat Google, tapi butuh beberapa hari.

## Langkah 4 — Coba aplikasi di HP Android (30 menit)
1. Kirim file **`WASHLY-1.4.0-release.apk`** ke HP, misalnya lewat WhatsApp ke diri sendiri atau Google Drive.
2. Buka file APK itu. Bila diminta, izinkan "Instal aplikasi tidak dikenal", lalu **Instal**.
3. Coba hal-hal berikut dan catat yang tidak berjalan:
   - [ ] Splash WASHLY muncul, lalu halaman login.
   - [ ] Login dengan akun Anda; data proyek dari PC muncul.
   - [ ] Peta tampil (citra satelit), GPS bisa dipakai (izinkan lokasi saat diminta), titik bisa ditandai.
   - [ ] Ambil foto asesmen dengan kamera.
   - [ ] Tab Hidrolis, Olah Air, RAB, DED terbuka dengan benar.
   - [ ] Menu → **Cetak laporan** → pilih *Simpan sebagai PDF* → PDF bisa dibuka.
   - [ ] Menu → **Unduh .json** → pilih folder → berkas tersimpan.
   - [ ] Menu → **Bagikan titik & jejak (.gpx)** → muncul pilihan WhatsApp/Drive.
   - [ ] Tombol **Kembali** HP menutup menu/dialog; di tab Peta, tekan 2× untuk keluar.
   - [ ] Mode pesawat: aplikasi tetap terbuka. Setelah online lagi, data muncul di PC.
4. **Ambil 4–8 screenshot** dari HP untuk Play Store: peta dengan citra satelit, hidrolis, pompa, RAB, gambar DED. Screenshot dari HP asli lebih bagus daripada draf yang saya buat.

> Bila ada yang tidak berjalan, kirim screenshot / ceritakan di chat. Saya perbaiki lalu build ulang APK & AAB.

## Langkah 5 — Buat akun Google Play Developer (15 menit + verifikasi)
1. Buka <https://play.google.com/console/signup>. Masuk dengan akun Google yang akan memiliki aplikasi. Sebaiknya pakai washlywater@gmail.com supaya terpisah dari akun pribadi.
2. Pilih jenis akun:
   - **Organisasi**: perlu nomor D-U-N-S, gratis lewat dnb.com tapi butuh beberapa hari. Tidak wajib uji tertutup 14 hari.
   - **Pribadi**: lebih cepat, tetapi **wajib uji tertutup minimal 12 penguji selama 14 hari** sebelum rilis publik (lihat Langkah 9).
3. Bayar biaya pendaftaran satu kali, lalu verifikasi identitas (KTP) dan nomor HP.

## Langkah 6 — Buat aplikasi & isi listing (20 menit)
Play Console → **Create app**:
* **App name:** `WASHLY: Simplify the Flow`
* **Default language:** Indonesian – id-ID
* **App / Game:** App · **Free / Paid:** Free → centang semua pernyataan → *Create app*.

Lalu buka **Grow → Store presence → Main store listing**:
* **Short description:**
  `Perencanaan jaringan air bersih: GPS, hidrolis, RAB & gambar DED.`
* **Full description:** salin dari `PLAY-STORE.md` §2 (blok "Full description (ID)").
* **App icon:** `play-icon-512.png`
* **Feature graphic:** `feature-graphic-1024x500.png`
* **Phone screenshots:** screenshot dari Langkah 4 (atau draf di folder `screenshots/`).
* **Category:** Productivity · **Email:** `washlywater@gmail.com`
* **Privacy policy:** `https://washlywater.github.io/privacy.html`

## Langkah 7 — Buat akun untuk reviewer Google (5 menit)
Reviewer Google perlu bisa masuk ke aplikasi. Akun baru langsung aktif (paket FREE); agar reviewer bisa melihat semua fitur, beri akun ini PRO lewat Dasbor pendapatan → Pengguna & langganan → *Beri PRO* (bila langganan sudah diaktifkan).
1. Di aplikasi WASHLY, klik **Daftar akun**. Contoh isian: nama `Google Play Review`, e-mail misalnya `washlywater+review@gmail.com`, kata sandi baru yang kuat.
2. (Opsional, bila pembatasan FREE/PRO sudah dinyalakan) masuk sebagai admin → **Pendapatan → Pengguna & langganan** → pilih akun tersebut → **Beri PRO** 12 bulan dengan alasan "Akun reviewer Google Play".
3. Di Play Console → **Policy → App content → App access** → pilih *All or some functionality is restricted* → *Add instructions*. Isi e-mail & kata sandi akun tadi, lalu tempel catatan ini:
   `Login with the credentials above (full-access review account). Menu → "Proyek baru dari contoh" opens a sample water-network project. Tabs: Peta (map), Hidrolis, Olah Air, RAB, DED.`

## Langkah 8 — Isi App content (20 menit)
Semuanya di **Policy → App content**.

| Formulir | Isian |
|---|---|
| **Ads** | No, my app does not contain ads |
| **Content rating** | Isi kuesioner IARC (e-mail washlywater@gmail.com). Kategori *All other app types*. Kekerasan/seksual/judi: **No**. Pengguna berinteraksi/berbagi konten: **Yes**. Berbagi lokasi dengan pengguna lain: **Yes**. Pembelian digital: **Yes** (langganan WASHLY PRO). Fitur AI generatif: **Yes** (ada tombol lapor jawaban). |
| **Target audience** | 18 and over |
| **News app** | No |
| **Data safety** | Ikuti tabel di `PLAY-STORE.md` §4. Dienkripsi saat transit: **Yes**. Pengguna bisa minta hapus data: **Yes**. Lokasi presisi & konten pengguna: **dibagikan** (sudah diputuskan). Tidak ada iklan/analitik. |
| **Account deletion** | Delete account URL: `https://washlywater.github.io/hapus-akun.html` |
| **Government app** | No (kecuali dirilis atas nama instansi pemerintah) |
| **Financial features / Health** | None |

## Langkah 8b — Langganan WASHLY PRO di Google Play (20 menit)
Tanpa langkah ini aplikasi tetap bisa dirilis; tombol upgrade di Android akan menampilkan "produk belum tersedia".

1. **Monetize → Payments profile**: buat profil pembayaran (data rekening untuk menerima hasil penjualan).
2. Unggah AAB dulu ke *Internal testing* (Langkah 9) — Google baru mengizinkan membuat produk setelah ada AAB yang memakai Play Billing.
3. **Monetize → Products → Subscriptions → Create subscription**:
   - Product ID: **`washly_pro`** (harus persis) · Name: `WASHLY PRO`
   - Base plan **`monthly`**: Auto-renewing, 1 bulan, harga **Rp125.000**
   - Base plan **`yearly`**: Auto-renewing, 1 tahun, harga **Rp499.000**
   - Aktifkan (*Activate*) kedua base plan.
4. **Izinkan server WASHLY memeriksa pembelian** (agar PRO aktif otomatis):
   - Buka https://console.cloud.google.com/iam-admin/serviceaccounts?project=washpipe-93f48 , salin e-mail service account **`…-compute@developer.gserviceaccount.com`** (dipakai Cloud Functions).
   - Play Console → **Users and permissions → Invite new users** → tempel e-mail tadi → tab *App permissions* → pilih WASHLY → centang **View financial data** dan **Manage orders and subscriptions** → *Invite user*.
5. (Opsional) Notifikasi real-time: **Monetize → Monetization setup → Real-time developer notifications** → Topic name: `projects/washpipe-93f48/topics/play-billing`.

## Langkah 9 — Unggah AAB & uji (1 hari – 14 hari)
1. **Test and release → Testing → Internal testing → Create new release**.
2. Pilih **Use Google-managed key (Play App Signing)** → unggah **`WASHLY-1.4.0-release.aab`**.
3. **Release notes (id-ID):**
   `Rilis pertama WASHLY untuk Android: pemetaan & asesmen GPS, analisis hidrolis (termasuk jaringan loop, terverifikasi terhadap EPANET), pompa & pengolahan air, BoQ & RAB, gambar DED, laporan siap cetak, e-sign persetujuan, sinkron cloud HP↔PC, dan bekerja tanpa sinyal. Paket FREE & WASHLY PRO.`
4. *Testers* → buat daftar e-mail penguji → simpan → bagikan *opt-in link* ke penguji.
5. **Akun pribadi:** buat juga rilis **Closed testing** dengan **≥ 12 penguji** yang tetap ikut **14 hari berturut-turut**, misalnya rekan kerja / mitra lapangan. Setelah itu klik *Apply for production* di Dashboard dan jawab pertanyaan Google tentang pengujian.

## Langkah 10 — Rilis publik
1. **Production → Create new release** → *Add from library* (AAB yang sama) → isi release notes.
2. **Countries:** Indonesia (atau tambah negara lain).
3. *Review release* → **Start rollout to Production**.
4. Review Google biasanya beberapa hari hingga ± 1 minggu. Setelah disetujui, WASHLY tampil di Play Store.

---

## Untuk update berikutnya
Cukup minta di chat, misalnya "naikkan versi ke 1.4.1". Saya akan menaikkan `versionCode`, build AAB baru dengan kunci yang sama, lalu Anda unggah lewat **Production → Create new release**.
