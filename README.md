# TirtaPlan Studio

Pemetaan GPS, analisis hidrolis, BoQ/RAB, dan gambar DED jaringan air bersih dalam satu aplikasi web.

## Isi folder
- `index.html`: aplikasi siap pakai (hasil build, cepat dibuka di HP).
- `src/index.dev.html`: kode sumber (React + JSX). Edit berkas ini, lalu jalankan build.
- `auth-config.js`, `firestore.rules`: pengaturan login daring (lihat bagian Akun & login).
- `manifest.webmanifest`, `sw.js`, `icons/`: membuat aplikasi bisa dipasang di HP dan tetap jalan offline.
- `build.js`, `package.json`: skrip build.

## Berkas kerja (daftar proyek) & review
- Tombol **Proyek** membuka daftar berkas kerja: buat proyek baru, buka, salin, hapus. Setiap perubahan tersimpan otomatis ke cloud (login daring) dan ke perangkat untuk kerja offline; setelah login di perangkat mana pun, semua proyek tetap bisa dibuka.
- **Semua proyek tim** dapat dibuka oleh anggota yang disetujui; yang bukan pemilik/admin membukanya hanya-baca dan dapat menyimpan salinan.
- Bila proyek diubah di dua tempat, aplikasi menawarkan: pakai versi cloud, simpan versi sendiri sebagai salinan, atau timpa.
- **Status & review**: Sedang dikerjakan → Menunggu pemeriksaan → Sudah diperiksa (**Staf LPASL**) → Disetujui (**Kepala LPASL**), dengan opsi kembalikan untuk revisi. Pemeriksaan & persetujuan dilakukan akun admin; akun ber-peran "Staf LPASL" hanya dapat memeriksa. Nama pemeriksa & penyetuju masuk otomatis ke laporan dan kop gambar DED. Mengubah isi proyek yang sudah diperiksa/disetujui mengembalikan statusnya ke "Sedang dikerjakan".
- Penyimpanan cloud memerlukan aturan terbaru di `firestore.rules` (tempel ulang ke Firestore → Rules → Publish).

## Mengedit BoQ & RAB
Di tab **BoQ & RAB**, tekan **Edit item RAB** untuk:
- mengubah uraian, volume dan satuan item (ikon ↺ mengembalikan nilai otomatis);
- menghapus item (item otomatis disembunyikan dan bisa ditampilkan kembali; item tambahan dihapus permanen);
- menambah item baru di bagian mana pun, menambah bagian pekerjaan baru, dan mengganti judul bagian;
- **Kembalikan semua item ke otomatis** untuk membuang semua perubahan.

Perubahan ikut tersimpan di berkas proyek, muncul di laporan cetak, dan mengembalikan status proyek yang sudah diperiksa/disetujui ke *draf*.

## Akun & login
Aplikasi meminta **Daftar / Masuk** sebelum dipakai. Data proyek dipisah per akun, dan akun yang masuk otomatis tercatat sebagai petugas.

**Mode lokal** (bawaan, selama `auth-config.js` belum diisi): akun tersimpan di perangkat masing-masing, kata sandi di-hash (PBKDF2). Akun pertama di perangkat menjadi admin; pendaftar berikutnya menunggu persetujuan admin perangkat itu. Mode ini hanya mengunci aplikasi per perangkat — siapa pun yang membuka situs di perangkatnya sendiri tetap bisa membuat akun lokal.

**Login daring (disarankan) — hanya orang yang disetujui admin yang bisa memakai aplikasi:**
1. Buka https://console.firebase.google.com → *Add project* (paket gratis Spark cukup).
2. *Build → Authentication → Get started → Email/Password* → aktifkan.
3. *Build → Firestore Database → Create database* (mode produksi, lokasi `asia-southeast2` / Jakarta).
4. *Firestore → Rules*: tempel isi `firestore.rules`, ganti `admin@organisasi.org` dengan email admin → *Publish*.
5. *Authentication → Settings → Authorized domains*: tambahkan `denekijulianto-ux.github.io`.
6. *Project settings → General → Your apps → Web (</>)* → daftarkan aplikasi → salin `firebaseConfig`.
7. Edit `auth-config.js` di GitHub: tempel konfigurasi ke `firebase: {...}` dan isi `adminEmails` → *Commit*. Situs diperbarui dalam 1–2 menit.
8. Admin mendaftar dengan email admin, klik tautan verifikasi di email, keluar lalu masuk lagi. Pendaftar lain disetujui lewat **Kelola pengguna**.

Login pertama di sebuah perangkat butuh internet; setelah itu aplikasi tetap bisa dibuka offline (status akun disimpan 30 hari).

## Memakai di HP (wajib HTTPS agar GPS berfungsi)
1. Unggah seluruh folder ini ke hosting HTTPS, mis. Netlify Drop (app.netlify.com/drop), GitHub Pages, atau Cloudflare Pages.
2. Buka alamat https-nya di HP, izinkan akses lokasi.
3. Pasang ke layar utama: Android/Chrome menu ⋮ → Instal aplikasi; iPhone/Safari → Bagikan → Tambah ke Layar Utama.
4. Buka area kerja sekali saat masih ada sinyal agar aplikasi dan peta tersimpan untuk dipakai offline.

Di laptop, tombol **Buka di HP** menampilkan kode QR alamat aplikasi.

## Pompa sumur bor & pengolahan air (tab Olah Air)
- Node **Sumur Bor + Pompa**: memompa ke reservoir (transmisi) atau langsung ke jaringan. Head, titik kerja (kurva pompa × kurva sistem), kW motor, energi, biaya listrik, dan opsi PLTS dihitung otomatis.
- **Pengolahan air** skala terpusat (di sumber atau di bak penampung) dan rumah tangga: isi hasil uji kualitas air baku, rangkaian proses dipilih otomatis, dimensi unit dihitung, dan kualitas air olahan diperkirakan terhadap baku mutu Permenkes No. 2/2023.
- Gambar DED: konstruksi sumur bor & pompa, diagram alir & profil hidrolis IPA, detail unit filter, dan filter rumah tangga. Semuanya masuk RAB.

## Organisasi & petugas
- Logo dan nama organisasi pelaksana diatur di **Data proyek → Organisasi** (bisa diganti dengan logo lain).
- Daftar petugas di **Data proyek → Tim petugas**. Di setiap perangkat, pilih petugas yang sedang bertugas; semua titik, pipa, bangunan, dan jejak GPS dari perangkat itu tercatat atas namanya beserta waktunya.

## Memindahkan data HP ↔ laptop
Data tersimpan di masing-masing perangkat. Kirim lewat **Menu → Bagikan data proyek (.json)**, lalu di perangkat tujuan **Muat .json → Gabungkan ke proyek ini**.

## Build ulang setelah mengedit sumber
```
npm install
npm run build
```
