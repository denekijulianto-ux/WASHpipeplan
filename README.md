# WASHLY – Simplify the flow

Pemetaan GPS, analisis hidrolis, BoQ/RAB, dan gambar DED jaringan air bersih dalam satu aplikasi web.

## Isi folder
- `index.html`: aplikasi siap pakai (hasil build, cepat dibuka di HP).
- `src/index.dev.html`: kode sumber (React + JSX). Edit berkas ini, lalu jalankan build.
- `auth-config.js`, `firestore.rules`: pengaturan login daring (lihat bagian Akun & login).
- `manifest.webmanifest`, `sw.js`, `icons/`: membuat aplikasi bisa dipasang di HP dan tetap jalan offline.
- `build.js`, `package.json`: skrip build.

## Langganan WASHLY PRO (FREE / PRO bulanan / PRO tahunan)
Paket FREE memuat alat dasar: peta & survei GPS, analisis hidrolis, kalkulator kebutuhan air, perhitungan pompa dasar, BoQ & RAB umum, cetak laporan tanpa RAB, dan 3 proyek cloud. PRO membuka semuanya: cetak RAB & DED, tanda tangan elektronik, ganti logo, kalkulator debit sumber & daya pompa, spesifikasi pompa & paket all-in, desain pengolahan air, RAB lanjutan (SHS/IKK, spesifikasi, edit item), penulangan & jembatan pipa, rehabilitasi, analisis air tanah, profil DEM, gambar manual, mode AI, dan proyek cloud tanpa batas.
Akun baru langsung aktif (FREE) tanpa persetujuan admin. Proyek milik orang lain hanya bisa dilihat jaringan pipanya (ditegakkan di server); petugas yang ditunjuk pemilik bisa melihat semua lembar & menandatangani tanpa bisa mengubah.
Pembayaran web lewat **Midtrans**, Android lewat **Google Play Billing**; status PRO diverifikasi server (Cloud Functions) dan berlaku di semua perangkat. Admin punya **dasbor pendapatan** (MRR, ARR, ARPPU, konversi, churn, grafik) dan bisa mengubah harga tanpa deploy.
Belum aktif sampai Cloud Functions di-deploy dan `billing.enabled` dinyalakan. Panduan lengkap, skema database, dan hasil uji ada di **[BILLING.md](BILLING.md)**.

## Bahasa Indonesia / English
Tombol **ID | EN** ada di layar masuk, bilah atas (PC) dan menu ☰ (HP). Pilihan disimpan di perangkat; saat pertama dibuka, bahasa mengikuti bahasa browser/HP (Indonesia → ID, lainnya → EN). Isi proyek (nama, label, catatan) tidak diterjemahkan. Asisten AI menjawab dalam bahasa yang dipilih.
Kamus ada di `src/i18n-en-dict.js` (`t` = teks persis, `p` = template dengan `{0}`), mesinnya di `src/i18n.js`. Bila menambah teks UI baru, tambahkan terjemahannya di kamus lalu `npm run build`.

## Lokasi saya (tab Peta)
Tombol bulat **⌖ Lokasi saya** di peta (PC: kanan, di bawah "Profil elevasi"; HP: kanan bawah di atas tombol Asisten) menyalakan GPS bila belum aktif, lalu membawa peta ke posisi Anda dan terus mengikuti saat berjalan. Akurasi tampil di sebelah tombol (±m). Geser peta untuk berhenti mengikuti; tekan lagi untuk kembali ke posisi Anda. Butuh izin Lokasi dan alamat HTTPS.

## Aplikasi Android (Google Play)
WASHLY juga tersedia sebagai aplikasi Android (`com.washly.app`, Capacitor 8). Aplikasinya sama dengan versi web: satu kode sumber, backend Firebase yang sama.
- Build APK/AAB, penandatanganan, dan cara update: lihat **[ANDROID.md](ANDROID.md)**.
- Materi Google Play (deskripsi, Data safety, content rating, panduan rilis): lihat **[store-assets/PLAY-STORE.md](store-assets/PLAY-STORE.md)**.
- Kebijakan privasi: `privacy.html`. Petunjuk hapus akun: `hapus-akun.html`. Keduanya masih draf; lengkapi bagian `[ISI]`.
- Hapus akun sendiri: *Menu → Profil saya → Hapus akun* (wajib Google Play). Terbitkan ulang `firestore.rules` agar fitur ini berjalan.

## Sinkron otomatis HP ↔ PC
- Data yang dipetakan di HP (titik, pipa, jejak GPS, foto, bangunan) tersimpan ke cloud ± 1–2 detik setelah diubah. Bila HP offline, data disimpan di HP dan dikirim begitu ada sinyal.
- PC yang membuka proyek yang sama memuat perubahan itu **otomatis**, tanpa impor: muncul pesan *"Data terbaru dari HP (nama petugas) dimuat otomatis"*.
- Proyek baru yang dibuat di HP memunculkan kotak *"Proyek baru dari HP: … — Buka"* di PC.
- Syarat: login dengan akun yang sama (atau akun yang ditunjuk pada proyek itu) di HP dan PC, mode cloud (Firebase) aktif.
- Bila PC sedang mengedit proyek yang sama dan belum tersimpan, aplikasi tidak menimpa: dialog konflik menawarkan versi cloud, salinan, atau timpa.

## Berkas kerja (daftar proyek) & review
- Tombol **Proyek** membuka daftar berkas kerja: buat proyek baru, buka, salin, hapus. Setiap perubahan tersimpan otomatis ke cloud (login daring) dan ke perangkat untuk kerja offline; setelah login di perangkat mana pun, semua proyek tetap bisa dibuka.
- **Semua proyek tim** dapat dibuka oleh anggota yang disetujui; yang bukan pemilik/admin membukanya hanya-baca dan dapat menyimpan salinan.
- Bila proyek diubah di dua tempat, aplikasi menawarkan: pakai versi cloud, simpan versi sendiri sebagai salinan, atau timpa.
- **Status & review**: Sedang dikerjakan → Menunggu pemeriksaan → Sudah diperiksa (**Pemeriksa**) → Disetujui (**Penyetuju**), dengan opsi kembalikan untuk revisi. Pemeriksaan & persetujuan dilakukan akun admin; akun ber-peran "Pemeriksa" hanya dapat memeriksa. Nama pemeriksa & penyetuju masuk otomatis ke laporan dan kop gambar DED. Mengubah isi proyek yang sudah diperiksa/disetujui mengembalikan statusnya ke "Sedang dikerjakan".
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

## Hak mengatur petugas
Hanya **pemilik proyek** dan **admin** yang dapat memilih/mengubah orang yang bertugas pada sebuah proyek:
- petugas aktif di perangkat;
- daftar tim petugas;
- nama Disurvei / Digambar / Pemeriksa / Penyetuju di data proyek dan kop gambar;
- penunjukan surveyor, penggambar, pemeriksa, dan penyetuju di *Status & review*.

Pengguna lain yang membuka proyek itu melihat bagian tersebut terkunci (ikon gembok). Di sisi cloud, aturan `firestore.rules` (fungsi `sameCrew`) menolak perubahan penunjukan oleh selain pemilik/admin.

## Urutan tanda tangan elektronik
1. **Surveyor & penggambar** menandatangani lebih dulu. Keduanya boleh orang yang sama; centang *Surveyor dan penggambar orang yang sama*. Bila orangnya bukan pemilik proyek, tekan *Simpan penunjukan & minta tanda tangan*.
2. Tombol **Ajukan untuk diperiksa** baru aktif bila tanda tangan perencana lengkap dan isi proyek belum berubah sejak ditandatangani.
3. **Pemeriksa**, lalu **penyetuju**. Pemeriksa tidak bisa menandatangani bila tanda tangan perencana tidak berlaku.

Tanda tangan surveyor & penggambar tercetak di kop gambar (DISURVEI / DIGAMBAR) dan di lembar pengesahan laporan.

## Profil petugas
- **Cara membuka:** tombol **Profil** di bilah atas (di HP: menu → *Profil saya*). Tanda kuning muncul bila profil belum lengkap.
- **Isi profil:**
  - foto profil, nama lengkap, alamat saat ini, asal organisasi/instansi;
  - riwayat penugasan pipanisasi (tahun, lokasi, proyek, peran, panjang pipa, jiwa terlayani), bisa diambil dari proyek di aplikasi.
- **Untuk admin:** *Kelola pengguna → Lihat profil*.
- **Penyimpanan (mode daring):** profil disimpan di koleksi `profiles` dan hanya bisa dibaca pemilik dan admin; **perbarui `firestore.rules` di Firebase Console**.

## Tampak depan & belakang menara air (tab DED)
Setiap menara air mendapat lembar tambahan **Tampak depan & belakang**:
- **Tampak depan:** sisi akses tangga & katup outlet, tempat papan nama/logo.
- **Tampak belakang:** sisi pipa inlet & peluap, berupa cerminan tampak depan.

Kedua tampak memuat keterangan finishing (cat rangka baja / plester & cat beton, tandon PE), elevasi, dan ukuran utama.

## Jembatan pipa / perlintasan (tab DED → bangunan "Jembatan Pipa / Perlintasan")
- **Pipa gantung kabel baja (sling / suspension):** untuk menyeberangi sungai, lembah, tebing, atau jalan raya.
  - Input: bentang, elevasi tanah kedua tepi, dasar rintangan, muka air banjir (sungai) atau ruang bebas jalan 5,1 m, rasio sag, jarak hanger, jumlah kabel, faktor keamanan.
  - Dihitung: beban pipa + air, sag & tarik kabel, diameter wire rope 6×19 IWRC (min. Ø10 mm), tinggi menara, kolom pipa baja / beton, pondasi, sudut & tarik backstay, ukuran blok angkur (deadman), jumlah & panjang hanger, panjang kabel, klip, turnbuckle.
- **Jembatan rangka baja** (bentang ≤ 25 m): tinggi rangka, profil siku batang tepi/diagonal, berat baja, lendutan, abutment.
- **Perlintasan bawah jalan:** pipa selubung (casing), panjang, kedalaman tutup, cara galian terbuka atau boring, pengembalian aspal, izin.
- **Pipa yang melintas** bisa dipilih dari peta (bahan & diameter otomatis).
- **Peringatan:** ruang bebas, pipa non-GI di bentang gantung, jarak hanger, bentang rangka terlalu panjang.
- **Gambar DED:** tampak samping (profil rintangan, menara, kabel, hanger, pipa, angkur, ukuran) atau potongan jalan, 3 gambar detail (sadel menara, hanger & klem pipa, blok angkur / potongan rangka, tumpuan, pipa masuk tanah / ujung selubung, spacer, patok), dan tabel data teknis.
- **RAB:** semua item masuk otomatis.
- **Catatan:** perhitungan indikatif, wajib diverifikasi ahli struktur dan survei geoteknik.

## Rangka beton & penulangan (tab DED → bangunan → "Rangka beton & penulangan")
Untuk reservoir, bak penangkap mata air, bak pembagi, BPT, hidran umum, dan menara air (rangka beton/kolom, termasuk pedestal menara baja).
- **Setting:** mutu beton (K-175 … K-350), mutu besi (BJTS 420B / BJTS 280 / BJTP 280), selimut beton. Tulangan bisa diatur manual per elemen; kosong / auto = hasil hitungan.
- **Hitungan (SNI 2847:2019, metode kekuatan):**
  - Dinding bak: tekanan air & tanah, faktor 1,4 × durabilitas 1,3, tulangan horizontal termasuk tarik langsung. Tulangan minimum 0,3 % dibagi dua muka (ACI 350).
  - Pelat dasar & atap: pelat dua arah.
  - Kolom: beban aksial terfaktor dengan tulangan minimum 1 %. Sengkang mengikuti SRPMM (daerah gempa): jarak rapat di tumpuan, renggang di lapangan.
  - Balok puncak, balok ring & sloof: momen lentur dengan tulangan minimum.
  - Pelat lantai menara dan pondasi telapak: lentur + cek geser.
  - Tulangan manual yang kurang dari kebutuhan ditandai merah.
- **Daftar potong besi (BBS):** kode, bentuk, diameter, panjang potong (termasuk kait 12d & lewatan 40d), jumlah, berat per elemen. Rekap per diameter mencakup jumlah batang 12 m dan kawat bendrat.
- **RAB:** item pembesian per diameter dari berat BBS (bukan lagi perkiraan kg/m³); harga & uraian beton ikut mutu yang dipilih.
- **DED:** lembar *Detail penulangan*:
  - bangunan bak: potongan dinding, pelat dasar & atap;
  - menara: penampang kolom, balok puncak, balok ring, sloof, potongan pondasi;
  - tabel hasil desain, rekap besi, dan daftar potong.
- **Catatan:** hitungan indikatif; wajib diperiksa ahli struktur.

## Rekap volume & biaya di DED
- Lembar *Rekap volume & biaya* memuat semua item RAB: volume, harga satuan, sumber harga (kode SHS / bawaan × IKK / manual), dan jumlah.
- Angkanya sama persis dengan tab BoQ & RAB karena berasal dari satu hitungan. Harga yang diubah di RAB/SHS langsung ikut berubah di gambar.
- Lembar ini dan lembar penulangan dapat dimatikan di tab DED → opsi lembar.

## Rehabilitasi / renovasi sistem existing
Untuk desa yang sudah punya jaringan atau bangunan air lama:
- **Pipa** (pilih pipa di peta → *Status pipa*): Baru, Existing baik (dipakai apa adanya), Existing rehabilitasi, atau Bongkar & ganti baru.
  - Untuk rehabilitasi: isi jumlah titik bocor, panjang pipa yang diganti, dan panjang pipa terbuka yang perlu diamankan.
  - Koefisien C pipa lama bisa diisi (pipa tua berkerak) supaya analisis hidrolis lebih realistis.
  - Pipa existing tidak dihitung lagi sebagai pipa baru, galian, atau fitting.
- **Node aksesoris** (gate valve, air valve, wash out, hidran, SR): status yang sama; rehabilitasi = servis / perbaikan.
- **Bangunan** (intake, broncaptering, reservoir, bak pembagi, BPT, hidran, menara air, jembatan pipa) — tab DED → *Kondisi bangunan*:
  - Asesmen: tingkat kerusakan (ringan/sedang/berat), tahun dibangun, tanggal, asesor, catatan.
  - **Isi otomatis** menghitung volume pekerjaan perbaikan dari ukuran bangunan dan tingkat kerusakan (kuras, injeksi retak, tambal beton, plester ulang, waterproofing food grade, tutup manhole, perpipaan, katup, ventilasi, tangga, media saringan, area tangkapan, tandon, rangka baja, kabel jembatan, pagar, cat, uji bocor & desinfeksi). Semua volume bisa diubah.
  - Biaya rehabilitasi dibandingkan dengan biaya bangun baru; peringatan muncul bila kerusakan berat atau biaya > 60% bangun baru.
  - "Existing baik" = tanpa item RAB.
- **RAB:** bagian *Rehabilitasi jaringan pipa existing* (bocor, penggantian sebagian, pengamanan pipa terbuka, pembongkaran, servis katup, survei kebocoran, flushing) dan bagian *Rehabilitasi {bangunan}*.
- **Peta & denah DED:** pipa diberi warna status (abu = existing baik, oranye = rehabilitasi, merah = ganti).
- **DED:** lembar *Rencana rehabilitasi* per bangunan (data asesmen, foto kondisi dari peta, daftar pekerjaan + kemasan) dan lembar *Rencana rehabilitasi jaringan* (rekap aset existing & pekerjaan).

## Pipa lengkung (HDPE / pipa fleksibel)
Pipa tidak harus lurus dari node ke node:
- **Di peta:** pilih pipa, lalu seret titik ⊕ di tengah garis untuk melengkungkannya. Titik belok bisa diseret untuk dipindah atau diklik untuk dihapus.
- **Saat menggambar:** pakai **Gambar pipa**, lalu ubah ke **Klik = titik lengkung** (tombol L) untuk membelokkan pipa tanpa membuat node.
- **Saat merekam GPS atau impor GPX** dengan pipa HDPE/PE: belokan jejak menjadi titik lengkung, dan node hanya dibuat tiap ± jarak maksimum.

Pipa HDPE/PE tidak memerlukan fitting bend selama radius lengkungnya ≥ 25×OD (HDPE) atau 20×OD (PE). Lengkung yang lebih tajam, dan setiap belokan pipa PVC/GIP, otomatis dihitung sebagai fitting bend di BoQ. Panjang pipa dihitung mengikuti lengkungannya.

## Debit sumber air & kapasitas jiwa (Kalkulator → tab "Debit sumber air")
- **Metode pengukuran:**
  - volumetrik (ember + stopwatch, beberapa percobaan);
  - pelampung (lebar × dalam × waktu tempuh);
  - ambang V-notch / persegi;
  - current meter;
  - debit uji pompa;
  - volume embung/bendungan (tampungan, aliran masuk, penguapan, lama kemarau);
  - penampungan air hujan.
- **Penyesuaian:** faktor debit andalan (musim pengukuran) dan porsi yang boleh diambil.
- **Hasil:**
  - debit terukur / andalan / boleh diambil (L/dtk), volume (m³/hari), kecepatan aliran;
  - jumlah jiwa, KK, SR, dan hidran yang bisa dilayani pada beberapa standar kebutuhan;
  - rekomendasi: cukup/kurang dibanding proyeksi kebutuhan, bangunan penangkap, diameter pipa transmisi, volume reservoir, dan cek bisa gravitasi.
- **Integrasi:**
  - hubungkan ke node sumber; Analisis Hidrolis memperingatkan bila kebutuhan melebihi kapasitas sumber;
  - buat reservoir sesuai volume, broncaptering / broncaptering V, dan hidran umum;
  - ubah diameter pipa dari sumber;
  - tambahkan bendung & intake (sungai) atau intake embung ke RAB.

## Profil elevasi di peta (tab Peta → "Profil elevasi")
- **Posisi:** di PC, grafik menempel di panel kanan (di atas data node/pipa), jadi peta jaringan tetap terlihat penuh. Di HP: menu Tampilan.
- **Grafik:** muka tanah dan garis tekanan dari sumber ke node ujung yang dipilih.
- **Penanda:** titik tertinggi & terendah, serta titik tinggi/rendah lokal yang belum diberi air valve / wash out.
- **Interaksi:** kursor di grafik menandai lokasi di peta; klik untuk memusatkan peta.
- **Detail DEM:** tombol *Profil tanah detail dari DEM* mengambil elevasi tiap ± 10 m sepanjang pipa.

## Laporan: kurva & data pompa
*Cetak laporan* memuat bagian khusus untuk setiap sumur bor:
- kurva pompa H–Q, kurva sistem, dan titik kerja;
- data operasi: muka air, kedalaman pompa, debit, rincian TDH, pipa riser, selubung, daya, energi & biaya listrik;
- spesifikasi teknis pompa untuk pengadaan.

## Kolom kemasan / qty beli (tab BoQ & RAB)
Setiap item RAB mendapat kolom **Kemasan / qty beli** yang mengubah volume menjadi jumlah barang yang dibeli:

| Material | Kemasan |
|---|---|
| Pipa HDPE | roll 100 m (Ø ≤ 63), roll 50 m (Ø75–110), batang 6 m (≥ Ø125) |
| Pipa PVC | batang 4 m |
| Pipa GI | batang 6 m |
| Pipa PE fleksibel | roll 100 m |
| Kabel | roll 50/100 m |
| Beton (per mutu K-100 … K-350, perkiraan AHSP) | zak semen 50 kg + m³ pasir + m³ kerikil |
| Plester / pasangan bata / pasangan batu | zak semen + pasir (+ bata/batu) |
| Besi tulangan | batang 12 m + kawat bendrat |
| Bekisting | lembar multiplek 1,22 × 2,44 m |
| Pasir / urugan | truk dump, mobil bak, atau karung |
| Media filter | sak 25 kg |
| Fitting & katup | pcs / unit / set |

Di mode *Edit item RAB* isi kolom bisa diubah per item (tombol ↺ untuk kembali ke otomatis). Kolom ini ikut tercetak di laporan.

## Detail visual fitting & aksesoris (tab DED)
Lembar **Detail fitting & aksesoris** (grup *Jaringan distribusi*) menampilkan gambar visual berlabel untuk:
- gate valve, air valve (+ stop kran), wash out, tee, bend, reducer, dop;
- thrust block, box pengaman katup, check valve, meter air SR, clamp saddle, ball valve, sambungan socket/stub flange, kran umum.

Tiap gambar dilengkapi simbol denah, spesifikasi (ideal), dan daftar ukuran/jumlah yang dipakai di proyek. Di *Opsi gambar jaringan* lembar ini bisa dimatikan atau diatur untuk menampilkan semua jenis.

## Kedalaman pompa & selubung pendingin (tab Olah Air → kartu sumur bor)
- **Kedalaman pompa (m bmt):** 0 = otomatis, yaitu 1 m di atas saringan. Isi angka untuk memasang pompa lebih dalam.
- **Selubung pendingin (flow inducer sleeve):**
  - mode *Otomatis* (dipasang bila pompa berada di zona saringan), *Selalu pasang*, atau *Tidak dipasang*;
  - ukuran pipa selubung dipilih otomatis (muat di casing, lebih besar dari motor) dan bisa diganti; bahan PVC tebal atau SS304.
- **Hitungan:** kecepatan air pendingin di sela motor–selubung (min. 0,08 m/dtk untuk motor 4", 0,16 m/dtk untuk motor 6", maks. 3 m/dtk) dan panjang selubung.
- **Ikut ke:** RAB (item "Selubung pendingin pompa"), tabel spesifikasi pompa, dan gambar DED sumur bor.
- **Diameter pompa:** pompa 4" dipakai sampai ± 16 m³/jam dan motor ≤ 7,5 kW. Pompa 6" butuh casing ≥ 8".

## Pipa riser pompa (tab Olah Air → kartu sumur bor → "Pipa riser")
- **Bahan:** GI medium, stainless SS304, uPVC column pipe, HDPE PN16, atau selang lay-flat (boreline).
- **Diameter:** otomatis atau pilih 1" sampai 6". Otomatis memilih ukuran terkecil dengan kecepatan ≤ 1,8 m/dtk yang muat di casing.
- **Pemeriksaan:**
  - kecepatan air (ideal 1–2 m/dtk);
  - kehilangan tekan (masuk ke head pompa);
  - ruang di casing: Ø sambungan + kabel pipih + celah ≤ Ø dalam casing;
  - kecocokan dengan outlet pompa (reducer/increaser);
  - batas tekanan bahan terhadap tekanan tutup pompa.
- **RAB:** pipa riser sesuai bahan & ukuran. Tali pengaman pompa otomatis ditambahkan untuk riser plastik/selang.

## Logo WASHLY
Logo bawaan aplikasi, kop setiap lembar DED, dan sampul laporan memakai logo WASHLY. Logo lain bisa diunggah per proyek (Data Proyek → Ganti logo), dan tombol *Kembalikan logo bawaan* mengembalikannya ke WASHLY.

## Paket sumur bor all-in (tab Olah Air → kartu sumur bor)
- **Isi estimasi biaya** (dengan cadangan 10% dan harga per meter kedalaman):
  - survei geolistrik, izin, dan mobilisasi rig;
  - pengeboran & konstruksi sumur, logging, uji pompa & laboratorium;
  - pompa, panel, kabel, dan riser;
  - kepala sumur & rumah pompa;
  - sambungan listrik atau PLTS.
- **Masuk RAB:** pilih *rincian per item* atau *satu paket all-in (lump sum)*.

## Air tanah & hidrologi (tab Peta → panel "Air tanah & hidrologi")
- **Lapisan peta:**
  - sungai, mata air & sumur dari OpenStreetMap (Overpass);
  - sungai & badan air (Esri Hydro) dan relief bayangan (Esri);
  - lapisan sendiri: WMS, tile XYZ, ArcGIS MapServer, GeoJSON (mis. batas Cekungan Air Tanah/CAT), atau gambar/scan Peta Hidrogeologi dengan koordinat batasnya.
- **Analisis potensi titik air tanah:**
  - grid di sekitar pusat area (radius 0,5–5 km) dengan tumpang-susun berbobot dari:
    - kemiringan lereng, indeks kebasahan topografi (TWI), dan posisi lembah (semuanya dari DEM);
    - jarak ke sungai & kerapatan aliran (OSM);
    - litologi;
  - hasilnya dikoreksi data lapangan: sumur existing (muka air, debit, kering saat kemarau) dan pendugaan geolistrik/VES (tafsiran resistivitas → tebal & kedalaman akuifer);
  - keluaran: peta kelas potensi (sangat rendah – sangat tinggi) dan 5 titik usulan dengan jenis sumur (dangkal / bor), perkiraan kedalaman, muka air, dan debit. Satu klik menjadikannya titik sumur bor di proyek.
- **Catatan:** hasilnya penapisan awal. Tetap lakukan survei geolistrik, pengamatan sumur warga, dan uji pompa, serta urus izin penggunaan air tanah.

## Kalkulator (tombol "Kalkulator" di bilah atas)
- **Kebutuhan air & jumlah node:**
  - proyeksi penduduk, debit rata-rata / hari maksimum / jam puncak (L/dtk), debit pompa sesuai jam operasi;
  - jumlah sumur bor, volume reservoir, jumlah SR & hidran umum;
  - jumlah node jaringan utama yang disarankan dibanding node proyek;
  - tombol untuk menerapkan kebutuhan ke node HU & pengaturan SR.
- **Daya pompa sumur bor:** rincian head total (muka air dinamis, beda tinggi, gesekan Hazen-Williams, kehilangan minor, sisa tekan) dan kebutuhan motor tiga tingkat dalam kW & HP.

## Daya pompa minimal / ideal / maksimal
Kartu sumur bor dan pompa filter menampilkan tabel kebutuhan motor tiga tingkat:
- **Minimal:** head pas, efisiensi 70%, tanpa cadangan.
- **Ideal:** head +10%, faktor layanan 1,15.
- **Maksimal:** head +25%, debit +10%, efisiensi 50%.

Tiap tingkat berisi daya hidrolik & poros, motor standar kW/HP, arus, energi, dan biaya listrik. Motor yang dipasang bisa dipilih: otomatis atau salah satu tingkat. Pilihan ini dipakai untuk energi, RAB, dan DED; bila motor lebih kecil dari daya poros, aplikasi memberi peringatan.

## Sistem aerator (tab Olah Air → DED)
Aktifkan unit *Aerasi* pada rangkaian IPA (disarankan otomatis bila besi/mangan/amonia tinggi), lalu pilih jenisnya:
- **Nampan bertingkat (multiple tray)**: jumlah nampan, jarak, beban hidrolik, media (kokas/kerikil/bio-ball), bahan rangka (galvanis/SS304/FRP).
- **Tangga / cascade (beton)**: jumlah anak tangga, tinggi & lebar injakan.
- **Semprot (spray nozzle)**: debit per nosel & tekanan → jumlah dan diameter nosel.
- **Difuser gelembung + blower**: waktu tinggal, kedalaman, rasio udara → jumlah difuser & daya blower.
Lembar DED *Aerator* (potongan, denah, data teknis, daftar bahan) muncul otomatis di grup *Sumber & pengolahan air*, dan itemnya masuk RAB.

## Spesifikasi teknis pompa
Kartu sumur bor dan pompa filter menampilkan tabel *Spesifikasi teknis pompa (untuk pengadaan)*:
- titik kerja Q–H, head tutup, kW/HP;
- 1/3 fasa, arus, kVA, ukuran outlet;
- jumlah stage dan diameter pompa submersible (dengan cek muat di casing & aliran pendingin motor);
- ukuran kabel + rugi tegangan, starter & MCB, genset cadangan, standar uji.

Pilih *Sumber listrik pompa* untuk memaksa 1 atau 3 fasa. Tabel yang sama tercetak di lembar DED sumur bor, dan uraian RAB pompa/panel/kabel ikut spesifik.

## Spesifikasi minimal / ideal / maksimal di RAB
Setiap item bahan punya tiga rekomendasi spesifikasi (mis. HDPE PE80 PN8 / PE100 PN10 / PE100 PN16; gate valve CI PN10 / DI PN16 / DI PN16 epoxy; beton K-175 / K-225 / K-300).
- **Memilih tingkat:** pilih *Min / Ideal / Maks* per item, atau sekaligus untuk semua item di kepala tabel RAB.
- **Harga:** harga satuan otomatis dikalikan faktor tingkat (Ideal = harga bawaan/SHS). Harga yang diketik manual tidak diubah.
- **Membandingkan:** klik *bandingkan* untuk melihat ketiga spesifikasi beserta harganya.
- **Cetak:** laporan memuat spesifikasi terpilih per item dan lampiran perbandingan ketiga tingkat.

## Ukuran tabung FRP, cartridge, housing & membran
- **Tabung FRP:** ukuran bisa dipilih per tahap (844 … 4872) atau otomatis.
- **Cartridge:**
  - jenis: PP/melt-blown, pleated, CTO karbon blok, GAC, keramik;
  - ukuran: Slim 2,5" × 10"/20", Big Blue 4,5" × 10"/20", industri 2,5" × 20"/30"/40" (housing multi);
  - bahan housing: plastik, SS304, SS316;
  - opsi tahap CTO tambahan setelah filter sedimen.
- **Membran UF/MF:**
  - ukuran modul: 4" × 40", 6" × 60", 8" × 60", 10" × 72";
  - bahan: PVDF, PES/PS, PAN, PVC, keramik.
- **Membran NF:** ukuran 4040 / 8040 (TFC).

## Gambar DED manual
- **Menggambar di lembar otomatis:** tekan **Gambar manual di lembar ini** di tab DED, lalu pakai alat yang tersedia:
  - garis, panah dengan keterangan, polyline, persegi/lingkaran berarsir (beton, tanah, pasir, kerikil, batu, air, putih penutup);
  - garis ukur (angka otomatis dari skala), teks, simbol (katup, pompa, meter, kran, arah utara, dll.);
  - sisipkan foto sketsa tangan.
- **Bantuan menggambar:** snap grid, garis lurus (Shift), urungkan, gandakan, hapus.
- **Lembar kosong:** **Tambah lembar gambar manual** membuat lembar kosong ber-kop dengan judul, skala, catatan, dan acuan standar sendiri.
- **Cetak & tanda tangan:** gambar manual ikut tercetak dan termasuk dalam sidik dokumen tanda tangan.

## Hak pemeriksa & penyetuju (custom)
Di *Menu → Kelola pengguna*, admin mencentang **Pemeriksa** dan/atau **Penyetuju** per pengguna. Saat mengajukan review, daftar pilihan hanya berisi pengguna yang dicentang. Tidak semua staf otomatis menjadi pemeriksa. Bila belum ada yang dicentang, semua pengguna aktif bisa dipilih.

## Unggah gambar tanda tangan
Di jendela tanda tangan elektronik, tekan **Unggah gambar tanda tangan** (PNG/JPG hasil foto/scan). Latar putih dihapus otomatis bila opsi dicentang.

## Acuan SNI pada DED
- Setiap lembar DED punya kotak **ACUAN STANDAR** di kop gambar sesuai jenis lembarnya:
  - jaringan: SNI 7509:2011, SNI 7511, SNI 7831:2012, Permen PUPR 27/2016;
  - bangunan beton: SNI 2847:2019, SNI 2052:2017, SNI 1726:2019;
  - menara: ditambah SNI 1727:2020 dan SNI 1729:2020;
  - pengolahan: SNI 6774:2008, SNI 3981:2008, Permenkes 2/2023;
  - SR: SNI 7509:2011, SNI 8153:2015.
- Lembar baru **Kriteria desain & SNI** berisi daftar acuan, tabel pemeriksaan kriteria hasil analisis hidrolis (kecepatan, sisa tekan, tekanan maksimum, gradien kehilangan tekan, tekanan di meter SR, kapasitas tampungan, kualitas air olahan), kriteria desain yang dipakai, dan catatan umum teknis.
- Tombol **Terapkan kriteria SNI 7509:2011** ada di tab Analisis Hidrolis → Kriteria desain. Kriterianya: kecepatan 0,3–3,0 m/s, sisa tekan ≥ 10 m, tekanan maks. 80 m, gradien hf ≤ 10 m/km. Nilai ini dikutip konsisten di literatur; tetap cocokkan dengan dokumen SNI resmi.
- Daftar acuan bisa diubah di tab DED → **Acuan standar (SNI)**: centang/hapus, ubah nomor, tahun, dan judul, atau tambah acuan lain. Butir bertanda (*) perlu dicocokkan judul/edisinya dengan katalog BSN.

## Standar Harga Satuan (SHS) per provinsi (tab BoQ & RAB)
- Pilih **provinsi acuan SHS**. Harga bawaan aplikasi disusun untuk Jawa Barat dan disesuaikan dengan faktor **IKK** (Indeks Kemahalan Konstruksi) provinsi tersebut.
- Angka IKK di aplikasi adalah **perkiraan**. Perbarui dari tabel resmi BPS (Indeks Kemahalan Konstruksi provinsi) bila diperlukan; isiannya bisa diubah langsung.
- **Impor daftar SHS** resmi (Pergub/Perbup) dengan menempel dari Excel/PDF atau memuat berkas CSV (kolom: kode, uraian, satuan, harga). Lalu tekan **Cocokkan otomatis**. Pencocokan memperhatikan diameter/ukuran dan jenis material. Tautan per item bisa diperiksa dan diubah lewat tombol **SHS** di tabel RAB (mode Edit item RAB).
- Urutan harga: harga yang diisi manual → item SHS tertaut → harga bawaan × faktor IKK. Acuan SHS tercantum di laporan cetak.

## Asisten WASHLY (chatbot)
- Tombol **Asisten** di pojok kanan bawah.
- **Mode luring** (tanpa biaya): menjawab dari basis pengetahuan (cara memakai aplikasi, troubleshooting, kriteria teknis SPAM, baku mutu Permenkes 2/2023, STBM, standar Sphere). Tombol **Periksa proyek ini** memberi diagnosis cepat dari analisis hidrolis.
- **Mode AI (opsional)**: isi kunci API Anthropic di pengaturan asisten. Kunci disimpan hanya di perangkat itu. Pertanyaan dan ringkasan proyek dikirim ke Claude (model `claude-opus-5-5`), dan biaya ditagihkan ke kunci API tersebut.

## Notifikasi & alur review dengan tanda tangan elektronik
- **Pendaftar baru**: admin mendapat pop-up di aplikasi, notifikasi browser, dan entri di kotak masuk (ikon lonceng). Bila dikonfigurasi, admin juga mendapat push **ntfy** dan **email**.
- **Review**: pemilik proyek memilih **pemeriksa** dan **penyetuju** di *Status, review & tanda tangan*, lalu menekan **Ajukan untuk diperiksa**. Alurnya:
  1. Pemeriksa mendapat notifikasi, membuka proyek, lalu **Periksa & tanda tangani** (tanda tangan digambar di layar).
  2. Proyek otomatis diteruskan ke penyetuju, yang kemudian **Setujui & tanda tangani**.
  3. Pemilik dan pemeriksa diberi tahu bahwa proyek disetujui.
- Tanda tangan tercantum di kop setiap lembar DED dan di **Lembar pengesahan** laporan, bersama waktu dan sidik dokumen (SHA-256). Mengubah isi proyek setelah ditandatangani membatalkan tanda tangan.
- Ini tanda tangan elektronik internal aplikasi, **bukan** TTE tersertifikasi BSrE/PSrE.
- **Notifikasi saat aplikasi tertutup** (opsional, di `auth-config.js` → `notify`):
  - `ntfyTopic`: isi kata acak. Setiap pengguna lalu memasang aplikasi gratis **ntfy** dan berlangganan topik pribadinya, yang tertera di ikon lonceng.
  - `emailjs`: isi Service ID, Template ID, dan Public Key dari emailjs.com (gratis 200 email/bulan). Template memakai variabel `{{to_email}}`, `{{to_name}}`, `{{subject}}`, `{{message}}`, `{{link}}`.
- Setelah memperbarui aplikasi, **tempel ulang `firestore.rules`** di Firebase Console. Aturan baru menambah koleksi `notifications`, izin pemeriksa/penyetuju, dan daftar pengguna untuk pemilihan pemeriksa.

## Lokasi pekerjaan & foto asesmen
- **Lokasi pekerjaan**: saat membuat proyek baru, dialog Data proyek langsung meminta koordinat lokasi pekerjaan. Koordinat bisa diambil dari GPS, diketik (desimal / DMS / UTM), atau dicari dari nama desa. Saat berkas dibuka, peta langsung menuju lokasi itu. Setelah jaringan digambar, peta menyesuaikan jaringan, dan tiap proyek mengingat tampilan petanya sendiri.
- **Foto asesmen**: tombol **Ambil foto** ada di inspektur node/bangunan, panel GPS, dan tab daftar **Foto**. Foto bisa diambil dengan kamera HP atau dipilih dari galeri. Koordinat GPS, waktu, dan nama petugas ikut tersimpan. Foto bisa diberi kategori (sumber air, bak/reservoir existing, fasilitas, dll.), keterangan, dan dikaitkan ke titik tertentu.
- Foto tampil sebagai penanda ungu di peta dan ikut dicetak di laporan (bagian *Dokumentasi foto asesmen*).
- Penyimpanan foto: miniatur disimpan di berkas proyek, sedangkan foto penuh (maks. 1600 px) disimpan di perangkat. **Simpan .json** ikut menyertakan foto penuh.
- Bila login daring aktif, foto diunggah ke koleksi Firestore `photos`. Untuk itu, aturan `firestore.rules` terbaru perlu ditempel ulang di Firebase Console.

## Sambungan rumah (SR) & meter air
- Pilih tipe **Sambungan Rumah (meter air)**, lalu klik lokasi rumah di peta (alat Tambah titik). Titik SR juga bisa ditandai lewat GPS atau impor koordinat. Pipa dinas (bawaan PE Ø20) otomatis tersambung ke pipa distribusi terdekat lewat titik sadel (clamp saddle). Batas jarak sambung bawaan 150 m.
- Kebutuhan air SR = jiwa × L/org/hari × faktor jam puncak. Tekanan di meter dicek terhadap batas minimum SR (bawaan 5 mka). Pengaturannya ada di tab Analisis Hidrolis → Kriteria desain.
- Di inspektur SR bisa diisi nama pelanggan, jumlah jiwa, dan ukuran meter (½"/¾"/1"), serta tersedia tombol "Sambung ulang ke pipa terdekat".
- RAB mendapat bagian **Pekerjaan Sambungan Rumah**: clamp saddle, paket meter air, box meter, kran halaman, dan pemasangan.
- DED mendapat lembar **Sambungan rumah**: potongan tipikal SR bernomor dan daftar meter air beserta tekanannya.

## Setting pompa filter
Untuk filter tabung FRP, pompa umpan (sebelum filter) atau pompa booster (setelah tandon) bisa diatur:
- jenis pompa (sentrifugal, multistage, jet, submersible, booster);
- Q & H otomatis atau manual;
- beda tinggi statis, efisiensi, dan jam operasi.

Aplikasi menghitung daya dan motor standar, cara kontrol (pelampung WLC / pressure switch), serta memberi peringatan bila debit atau head tidak sesuai dengan filter.

## Reservoir bersekat, broncaptering V, hidran & skema instalasi filter
- **Reservoir → Sistem penyekat**: pilih sekat pengendapan (ambang luapan + penguras ruang endap), sekat pengendapan + saringan pasir (ruang endap → saringan aliran turun → lubang bawah sekat → ruang air bersih), atau sekat berliku (bak kontak klorin).
- **Pondasi panggung batu kali** (semua bak): isi tinggi pondasi > 0 agar bak berdiri di atas pasangan batu kali/batu pecah.
- **Hidran umum**: ukuran kran/outlet ½" sampai 2½" (Ø15–Ø75 mm).
- **Broncaptering bentuk V**: dinding sayap batu kali, area tangkapan kerikil–ijuk–lempung–tanah urug, dinding depan dengan V-notch (debit → tinggi air), bak pengumpul + manhole, pipa ventilasi, dan saluran terbuka pengalih air hujan. Lembar DED berisi denah, potongan 1–1, detail V-notch, dan tutup manhole.
- **Posisi filter FRP**: sebelum bak/menara (setelah pompa) atau **setelah bak penampung/menara, sebelum distribusi**. Untuk posisi setelah bak, aplikasi mengecek tinggi tekan yang tersedia dibanding kehilangan tekan filter dan menambahkan **pompa booster** bila perlu (otomatis / pakai / tanpa pompa).
- **Lebih dari satu tabung FRP**: pasir/greensand, karbon aktif, alumina dan resin masing-masing di tabung terpisah (atau pasir + karbon digabung dalam satu tabung multimedia), plus jumlah tabung paralel minimum per tahap.
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

**Mode lokal** (bawaan, selama `auth-config.js` belum diisi): akun tersimpan di perangkat masing-masing, kata sandi di-hash (PBKDF2). Akun pertama di perangkat menjadi admin; pendaftar berikutnya langsung aktif (paket FREE). Mode ini hanya mengunci aplikasi per perangkat — siapa pun yang membuka situs di perangkatnya sendiri tetap bisa membuat akun lokal.

**Login daring (disarankan) — setiap orang bisa mendaftar dan langsung memakai paket FREE; admin dapat menangguhkan akun:**
1. Buka https://console.firebase.google.com → *Add project* (paket gratis Spark cukup).
2. *Build → Authentication → Get started → Email/Password* → aktifkan.
3. *Build → Firestore Database → Create database* (mode produksi, lokasi `asia-southeast2` / Jakarta).
4. *Firestore → Rules*: tempel isi `firestore.rules`, ganti `admin@organisasi.org` dengan email admin → *Publish*.
5. *Authentication → Settings → Authorized domains*: tambahkan domain GitHub Pages Anda (mis. `washlywater.github.io`).
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
