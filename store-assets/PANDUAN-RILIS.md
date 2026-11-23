# Panduan rilis WASHLY ke Google Play (yang dikerjakan sendiri)

Bagian yang bisa dikerjakan dari sisi kode **sudah selesai**:

| Status | Pekerjaan |
|---|---|
| ✅ | APK & AAB 1.0.0 sudah ditandatangani |
| ✅ | Login Firebase sudah dicek bisa dipakai dari aplikasi Android |
| ✅ | Kebijakan privasi & halaman hapus akun sudah lengkap: Tim WASHLY, washlywater@gmail.com, 30 hari |
| ✅ | Jawaban Data Safety sudah diputuskan |

Langkah di bawah ini butuh akun, perangkat, atau tanda tangan Anda sendiri. Kerjakan berurutan. Total ± 1–2 jam, belum termasuk waktu tunggu review Google.

---

## Langkah 0 — Alamat web tanpa nama pribadi (1 klik)
Repo WASHLY sudah berada di akun GitHub **washlywater**. Tinggal satu klik agar situs tayang di **https://washlywater.github.io/**:

1. Buka <https://github.com/washlywater/washly-ux.github.io/settings> (login sebagai **washlywater**).
2. Kotak **Repository name** paling atas: hapus isinya, ketik `washlywater.github.io` → klik **Rename**.
3. Tunggu ± 5 menit, lalu buka <https://washlywater.github.io/>. Halaman login WASHLY harus muncul.
4. Firebase Console → **Authentication → Settings → Authorized domains** → *Add domain* → `washlywater.github.io`.
   Link langsung: <https://console.firebase.google.com/project/washpipe-93f48/authentication/settings>

Catatan: semua dokumen & panduan ini sudah memakai alamat baru. Data cloud tidak berubah; pengguna web cukup membuka alamat baru dan login. Aplikasi Android tidak terpengaruh.

## Langkah 1 — Amankan kunci upload (5 menit) ⚠️ PALING PENTING
File `washly-upload.jks` dan `keystore.properties` sudah dikirim ke chat.

1. Simpan **kedua file** di 2 tempat aman:
   - Google Drive pribadi, di folder yang tidak dibagikan;
   - flashdisk / hard disk yang disimpan di rumah.
2. Catat kata sandinya di pengelola kata sandi, misalnya Google Password Manager. Kata sandinya ada di dalam `keystore.properties`.
3. Jangan kirim file ini ke siapa pun dan jangan unggah ke GitHub.

Tanpa kunci ini Anda **tidak bisa mengirim update** aplikasi. Kunci memang bisa direset lewat Google, tapi butuh beberapa hari.

## Langkah 2 — Terbitkan aturan Firestore baru (3 menit)
Ini wajib agar fitur **Hapus akun** berjalan.

1. Buka <https://console.firebase.google.com/project/washpipe-93f48/firestore/rules>.
2. Buka file `firestore.rules` di repositori (sudah dikirim juga), salin **seluruh isinya**.
3. Di halaman Rules: hapus isi lama, tempel isi baru, lalu klik **Publish**.

## Langkah 3 — Cek halaman privasi online (1 menit)
Buka kedua alamat ini di browser HP atau laptop. Pastikan halamannya tampil dan e-mail washlywater@gmail.com terlihat.
- <https://washlywater.github.io/privacy.html>
- <https://washlywater.github.io/hapus-akun.html>

Bila muncul "404", tunggu 5–10 menit (GitHub Pages sedang memperbarui), lalu muat ulang.

## Langkah 4 — Coba aplikasi di HP Android (30 menit)
1. Kirim file **`WASHLY-1.0.0-debug.apk`** ke HP, misalnya lewat WhatsApp ke diri sendiri atau Google Drive.
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
Reviewer Google perlu bisa masuk ke aplikasi, sedangkan akun baru harus disetujui admin dulu.
1. Di aplikasi WASHLY, klik **Daftar akun**. Contoh isian: nama `Google Play Review`, e-mail misalnya `washlywater+review@gmail.com`, kata sandi baru yang kuat.
2. Masuk dengan akun admin Anda → **Kelola pengguna** → **Setujui** akun tersebut.
3. Di Play Console → **Policy → App content → App access** → pilih *All or some functionality is restricted* → *Add instructions*. Isi e-mail & kata sandi akun tadi, lalu tempel catatan ini:
   `Login with the credentials above (pre-approved account). Menu → "Proyek baru dari contoh" opens a sample water-network project. Tabs: Peta (map), Hidrolis, Olah Air, RAB, DED.`

## Langkah 8 — Isi App content (20 menit)
Semuanya di **Policy → App content**.

| Formulir | Isian |
|---|---|
| **Ads** | No, my app does not contain ads |
| **Content rating** | Isi kuesioner IARC (e-mail washlywater@gmail.com). Kategori *All other app types*. Kekerasan/seksual/judi: **No**. Pengguna berinteraksi/berbagi konten: **Yes**. Berbagi lokasi dengan pengguna lain: **Yes**. Pembelian digital: **No**. Fitur AI generatif: **Yes** (ada tombol lapor jawaban). |
| **Target audience** | 18 and over |
| **News app** | No |
| **Data safety** | Ikuti tabel di `PLAY-STORE.md` §4. Dienkripsi saat transit: **Yes**. Pengguna bisa minta hapus data: **Yes**. Lokasi presisi & konten pengguna: **dibagikan** (sudah diputuskan). Tidak ada iklan/analitik. |
| **Account deletion** | Delete account URL: `https://washlywater.github.io/hapus-akun.html` |
| **Government app** | No (kecuali dirilis atas nama instansi pemerintah) |
| **Financial features / Health** | None |

## Langkah 9 — Unggah AAB & uji (1 hari – 14 hari)
1. **Test and release → Testing → Internal testing → Create new release**.
2. Pilih **Use Google-managed key (Play App Signing)** → unggah **`WASHLY-1.0.0-release.aab`**.
3. **Release notes (id-ID):**
   `Rilis pertama WASHLY untuk Android: pemetaan GPS, analisis hidrolis, pompa & pengolahan air, RAB, gambar DED, sinkron cloud HP↔PC, dan bekerja tanpa sinyal.`
4. *Testers* → buat daftar e-mail penguji → simpan → bagikan *opt-in link* ke penguji.
5. **Akun pribadi:** buat juga rilis **Closed testing** dengan **≥ 12 penguji** yang tetap ikut **14 hari berturut-turut**, misalnya rekan kerja / mitra lapangan. Setelah itu klik *Apply for production* di Dashboard dan jawab pertanyaan Google tentang pengujian.

## Langkah 10 — Rilis publik
1. **Production → Create new release** → *Add from library* (AAB yang sama) → isi release notes.
2. **Countries:** Indonesia (atau tambah negara lain).
3. *Review release* → **Start rollout to Production**.
4. Review Google biasanya beberapa hari hingga ± 1 minggu. Setelah disetujui, WASHLY tampil di Play Store.

---

## Untuk update berikutnya
Cukup minta di chat, misalnya "naikkan versi ke 1.0.1". Saya akan menaikkan `versionCode`, build AAB baru dengan kunci yang sama, lalu Anda unggah lewat **Production → Create new release**.
