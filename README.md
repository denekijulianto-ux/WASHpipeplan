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

## Menara air (tab DED)
Pilih **Menara Air (Tower Tandon)** lalu **Tambah**. Ada tiga sistem:
- full beton bertulang (rangka + bak beton);
- rangka beton + tandon PVC/PE;
- rangka baja (besi) + tandon PVC/PE.

Ukuran tandon bisa dipilih dari 300 sampai 10.000 L, dengan 1 sampai 6 unit. Gambar DED berisi:
- tampak depan, denah platform, denah pondasi dan detail pondasi;
- data teknis, termasuk cek kolom, cek daya dukung tanah dan cek gaya angkat. Cek ini bersifat indikatif dan wajib diverifikasi ahli struktur;
- volume pekerjaan, yang otomatis masuk ke RAB.

Bila menara dihubungkan ke node reservoir, aplikasi menghitung tinggi menara minimum agar sisa tekanan ≥ 10 mka.

## Pipa lengkung (HDPE / pipa fleksibel)
Pipa tidak harus lurus dari node ke node:
- **Di peta:** pilih pipa, lalu seret titik ⊕ di tengah garis untuk melengkungkannya. Titik belok bisa diseret untuk dipindah atau diklik untuk dihapus.
- **Saat menggambar:** pakai **Gambar pipa**, lalu ubah ke **Klik = titik lengkung** (tombol L) untuk membelokkan pipa tanpa membuat node.
- **Saat merekam GPS atau impor GPX** dengan pipa HDPE/PE: belokan jejak menjadi titik lengkung, dan node hanya dibuat tiap ± jarak maksimum.

Pipa HDPE/PE tidak memerlukan fitting bend selama radius lengkungnya ≥ 25×OD (HDPE) atau 20×OD (PE). Lengkung yang lebih tajam, dan setiap belokan pipa PVC/GIP, otomatis dihitung sebagai fitting bend di BoQ. Panjang pipa dihitung mengikuti lengkungannya.

## Reservoir bersekat, broncaptering V, hidran & skema instalasi filter
- **Reservoir → Sistem penyekat**: pilih sekat pengendapan (ambang luapan + penguras ruang endap), sekat pengendapan + saringan pasir (ruang endap → saringan aliran turun → lubang bawah sekat → ruang air bersih), atau sekat berliku (bak kontak klorin).
- **Pondasi panggung batu kali** (semua bak): isi tinggi pondasi > 0 agar bak berdiri di atas pasangan batu kali/batu pecah.
- **Hidran umum**: ukuran kran/outlet ½" sampai 2" (½, ¾, 1, 1¼, 1½, 2 inci).
- **Broncaptering bentuk V**: dinding sayap batu kali, area tangkapan kerikil–ijuk–lempung–tanah urug, dinding depan dengan V-notch (debit → tinggi air), bak pengumpul + manhole, pipa ventilasi, dan saluran terbuka pengalih air hujan. Lembar DED berisi denah, potongan 1–1, detail V-notch, dan tutup manhole.
- **Skema instalasi filter** (mode tabung FRP): pompa → tabung filter → menara tandon → distribusi. Katup bisa berupa multiport valve atau manifold 5 katup manual, lengkap dengan tabel operasi filter / cuci balik / bilas.

## Jenis filtrasi & media (tab Olah Air)
Di setiap desain IPA terpusat, bagian **Jenis filtrasi & spesifikasi media** menyediakan tiga jenis filtrasi:
- **Bak beton terpisah:** unit-unit IPA standar.
- **Menyatu di bak penampung / reservoir:** satu bak bersekat dengan urutan ruang penenang/pengendap → saringan kerikil/pasir → karbon aktif (aliran naik) → ruang air bersih. Bak bisa dibuat baru, atau ruang filternya ditempelkan ke reservoir yang sudah ada. Pada pilihan kedua, RAB hanya menghitung ruang filter.
- **Tabung FRP bertekanan:** ukuran tabung (844 s.d. 4872), jumlah, laju filtrasi dan katup multiport dipilih otomatis. Tabung bisa dipasang menyatu di platform menara air (beban ikut dicek) atau terpisah di samping menara.

Spesifikasi media yang bisa dipilih:
- ukuran mesh pasir silika (8–16 s.d. 40–70 mesh);
- bilangan iodin dan ukuran butir karbon aktif;
- filter cartridge (1–50 µm);
- membran MF/UF/NF, lengkap dengan ukuran pori, MWCO, fluks dan recovery.

Pilihan ini memengaruhi perkiraan kualitas air olahan, gambar DED dan RAB.

## Konstruksi tambahan (tab DED)
Setiap bangunan, termasuk menara air, bisa diberi konstruksi tambahan:
- bak katup (gate valve) atau bak meter air pada pipa inlet/outlet/penguras;
- saluran drainase;
- pagar pengaman;
- lantai rabat;
- item lain dengan isian bebas.

Volume dan harganya masuk ke RAB bangunan tersebut. Gambar detailnya ada di lembar "Konstruksi tambahan".

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
