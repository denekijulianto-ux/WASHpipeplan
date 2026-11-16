# TirtaPlan Studio

Pemetaan GPS, analisis hidrolis, BoQ/RAB, dan gambar DED jaringan air bersih dalam satu aplikasi web.

## Isi folder
- `index.html`: aplikasi siap pakai (hasil build, cepat dibuka di HP).
- `src/index.dev.html`: kode sumber (React + JSX). Edit berkas ini, lalu jalankan build.
- `manifest.webmanifest`, `sw.js`, `icons/`: membuat aplikasi bisa dipasang di HP dan tetap jalan offline.
- `build.js`, `package.json`: skrip build.

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
