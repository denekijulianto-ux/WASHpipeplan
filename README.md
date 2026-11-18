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

## Urutan tanda tangan elektronik
1. **Surveyor & penggambar** menandatangani lebih dulu. Keduanya boleh orang yang sama; centang *Surveyor dan penggambar orang yang sama*. Bila orangnya bukan pemilik proyek, tekan *Simpan penunjukan & minta tanda tangan*.
2. Tombol **Ajukan untuk diperiksa** baru aktif bila tanda tangan perencana lengkap dan isi proyek belum berubah sejak ditandatangani.
3. **Pemeriksa**, lalu **penyetuju**. Pemeriksa tidak bisa menandatangani bila tanda tangan perencana tidak berlaku.

Tanda tangan surveyor & penggambar tercetak di kop gambar (DISURVEI / DIGAMBAR) dan di lembar pengesahan laporan.

## Profil petugas
- **Cara membuka:** tombol **Profil** di bilah atas (di HP: menu → *Profil saya*). Tanda kuning muncul bila profil belum lengkap.
- **Isi profil:**
  - foto profil, nama lengkap, alamat saat ini, asal PMI;
  - riwayat penugasan pipanisasi (tahun, lokasi, proyek, peran, panjang pipa, jiwa terlayani), bisa diambil dari proyek di aplikasi.
- **Untuk admin:** *Kelola pengguna → Lihat profil*.
- **Penyimpanan (mode daring):** profil disimpan di koleksi `profiles` dan hanya bisa dibaca pemilik dan admin; **perbarui `firestore.rules` di Firebase Console**.

## Tampak depan & belakang menara air (tab DED)
Setiap menara air mendapat lembar tambahan **Tampak depan & belakang**:
- **Tampak depan:** sisi akses tangga & katup outlet, tempat papan nama/logo.
- **Tampak belakang:** sisi pipa inlet & peluap, berupa cerminan tampak depan.

Kedua tampak memuat keterangan finishing (cat rangka baja / plester & cat beton, tandon PE), elevasi, dan ukuran utama.

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
- **Grafik:** muka tanah dan garis tekanan dari sumber ke node ujung yang dipilih.
- **Penanda:** titik tertinggi & terendah, serta titik tinggi/rendah lokal yang belum diberi air valve / wash out.
- **Interaksi:** kursor di grafik menandai lokasi di peta; klik untuk memusatkan peta.
- **Detail DEM:** tombol *Profil tanah detail dari DEM* mengambil elevasi tiap ± 10 m sepanjang pipa.

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
Di *Menu → Kelola pengguna*, admin mencentang **Pemeriksa** dan/atau **Penyetuju** per pengguna. Saat mengajukan review, daftar pilihan hanya berisi pengguna yang dicentang. Tidak semua Staf LPASL otomatis menjadi pemeriksa. Bila belum ada yang dicentang, semua pengguna aktif bisa dipilih.

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

## Asisten WASH (chatbot)
- Tombol **Asisten** di pojok kanan bawah.
- **Mode luring** (tanpa biaya): menjawab dari basis pengetahuan (cara memakai aplikasi, troubleshooting, kriteria teknis SPAM, baku mutu Permenkes 2/2023, STBM, standar Sphere). Tombol **Periksa proyek ini** memberi diagnosis cepat dari analisis hidrolis.
- **Mode AI (opsional)**: isi kunci API Anthropic di pengaturan asisten. Kunci disimpan hanya di perangkat itu. Pertanyaan dan ringkasan proyek dikirim ke Claude (model `claude-opus-5-5`), dan biaya ditagihkan ke kunci API tersebut.

## Notifikasi & alur review dengan tanda tangan elektronik
- **Pendaftar baru**: admin mendapat pop-up di aplikasi, notifikasi browser, dan entri di kotak masuk (ikon lonceng). Bila dikonfigurasi, admin juga mendapat push **ntfy** dan **email**.
- **Review**: pemilik proyek memilih **pemeriksa** (Staf LPASL) dan **penyetuju** (Kepala LPASL) di *Status, review & tanda tangan*, lalu menekan **Ajukan untuk diperiksa**. Alurnya:
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
