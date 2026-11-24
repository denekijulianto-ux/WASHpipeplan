# Verifikasi perhitungan hidrolis WASHLY

Dokumen ini menunjukkan bahwa mesin hidrolis WASHLY memberi hasil yang sama dengan **EPANET 2.2**, perangkat lunak standar industri dari US EPA, untuk jaringan yang sama. Hasil lengkapnya ada di [`hasil.md`](hasil.md).

## Cara kerja uji
1. `export.js` membuka aplikasi WASHLY yang sudah di-build di browser (Playwright). Skrip ini menjalankan **kode hidrolis asli aplikasi** (`computeHydraulics`) pada 8 jaringan:
   - proyek contoh Desa Sukamaju;
   - 3 jaringan bercabang acak (12, 25, dan 40 node) dengan bahan HDPE/PVC/GIP campuran dan Ø 32–110 mm;
   - 4 jaringan **loop**: proyek contoh + 1 pipa penghubung, grid 4×3 (1 reservoir), grid 6×5 (2 reservoir), dan grid 12×10 (2 reservoir + 10 cabang mati).

   Data jaringan beserta hasil WASHLY ditulis ke `kasus.json`.
2. `banding.py` membangun jaringan yang sama di EPANET (lewat pustaka WNTR) dan menyelesaikannya, lalu membandingkan debit, kecepatan, dan tekanan setiap pipa dan node.

Panjang pipa, kebutuhan air per node, elevasi, koefisien C, dan diameter dalam diambil dari WASHLY. Jadi yang diuji adalah **mesin hitungnya**, bukan data masukannya.

```bash
(cd www && python3 -m http.server 8767) &
node tests/verifikasi-hidrolis/export.js
pip install wntr && python3 tests/verifikasi-hidrolis/banding.py
```

## Ringkasan hasil

| Besaran | Jaringan bercabang | Jaringan loop / multi-reservoir |
|---|---|---|
| Debit tiap pipa | 0,0000 L/dtk (identik) | ≤ 0,008 L/dtk (≤ 0,6 % untuk pipa ≥ 0,5 L/dtk) |
| Kecepatan tiap pipa | identik | ≤ 0,002 m/dtk |
| Tekanan node | ≤ 0,24 m (1,8 m pada jaringan uji ekstrem) | ≤ 0,14 m |
| Kehilangan tekanan kumulatif | ≤ 0,4 % | ≤ 0,3 % |

Uji tambahan untuk jaringan besar (tidak disimpan di `kasus.json` karena ukurannya):

| Jaringan | Pipa | Loop | Waktu hitung | Selisih debit maks. | Selisih tekanan maks. |
|---|---|---|---|---|---|
| Grid 20×20 (solver Cholesky) | 761 | 361 | ±110 ms | 0,0003 L/dtk | 0,017 m |
| Grid 30×30 (solver jarang PCG, > 800 node inti) | 1.741 | 841 | ±145 ms | 0,0007 L/dtk | 0,076 m |

Selisih kecil pada kehilangan tekanan berasal dari pembulatan konstanta Hazen-Williams. WASHLY memakai 10,67 dan 4,87 (bentuk yang umum di buku teks dan pedoman), sedangkan EPANET memakai 10,667 dan 4,871. Pada jaringan yang realistis selisihnya di bawah 0,25 m. Pada jaringan uji C yang sengaja dibuat ekstrem (total kehilangan tekanan ±560 m), selisihnya 1,8 m, tetap 0,33 %.

## Contoh hitung manual (pipa p_1 proyek contoh)
HDPE PE100 PN10 Ø110 → Ø dalam = 110 − 2 × (110 / 17) = **97,06 mm**; L = 76,15 m; Q = 5 L/dtk; C = 130.

- hf = 10,67 × 76,15 × 0,005^1,852 / (130^1,852 × 0,09706^4,87) = **0,464 m** (WASHLY: 0,464 m)
- v = 0,005 / (π/4 × 0,09706²) = **0,676 m/dtk** (WASHLY: 0,676 m/dtk)

## Perbaikan diameter dalam (November 2026)
Sebelum perbaikan, WASHLY memakai ukuran nominal pipa HDPE/PVC (Ø luar) sebagai diameter aliran. Akibatnya kehilangan tekanan terhitung terlalu kecil, sekitar 1,5–1,9× dari seharusnya. Di proyek contoh, tekanan hidran HU1 turun dari 26,9 mka (versi lama) menjadi **6,7 mka**, di bawah batas minimum 10 mka. Lihat tabel "Dampak perbaikan" di `hasil.md`.

Diameter dalam yang dipakai sekarang:

| Bahan | Dasar | Ø dalam |
|---|---|---|
| HDPE PE100 PN10 | SDR 17 (SNI 4829.2 / ISO 4427) | Ø luar − 2 × Ø luar/17 |
| PVC RRJ PN10 | S-12,5 = SDR 26 (SNI 06-0084-2002) | Ø luar − 2 × Ø luar/26 (dinding min. 1,6 mm) |
| PE gulungan | SDR 11 | Ø luar − 2 × Ø luar/11 (dinding min. 2,0 mm) |
| GIP medium | BS 1387 | tabel Ø dalam per DN (mis. DN50 → 53,0 mm) |

Untuk pipa existing atau kelas tekanan lain, Ø dalam hasil ukur bisa diisi per pipa (panel pipa → "Ø dalam terukur").

## Metode perhitungan
- **Jaringan bercabang dengan satu sumber:** debit tiap pipa = jumlah kebutuhan di hilirnya. Hasilnya eksak, tanpa iterasi.
- **Jaringan loop atau beberapa reservoir dalam satu jaringan:** **metode gradien Todini-Pilati (1988)**, metode yang sama dengan EPANET. Unknown-nya head node dan debit pipa, diselesaikan dengan iterasi Newton sampai perubahan debit < 10⁻⁸ (biasanya 5–10 iterasi).
  - Cabang mati (termasuk sambungan rumah) dipangkas dulu, sehingga matriks hanya berisi inti loop.
  - Inti loop ≤ 800 node diselesaikan dengan Cholesky; yang lebih besar dengan conjugate gradient berprakondisi.
- Reservoir yang menerima aliran dari reservoir lain yang lebih tinggi diberi peringatan.

## Batasan yang tetap berlaku
- Sumur bor yang memompa **langsung** ke jaringan loop/multi-sumber yang juga dilayani reservoir dihitung sebagai node biasa (aplikasi memberi peringatan). Alirkan pompa ke reservoir (mode transmisi). Pompa transmisi dan pompa langsung ke jaringan bercabang dihitung penuh.
- Kondisi statis (jam puncak), bukan simulasi periode-panjang (extended period) seperti fluktuasi muka air reservoir sepanjang hari.
- Kehilangan tekanan minor (belokan, katup) pada jaringan distribusi tidak dihitung terpisah, sama seperti model EPANET di uji ini (minor loss = 0).
- Ketelitian hasil bergantung pada data masukan, terutama **elevasi**. Elevasi dari DEM bisa meleset beberapa meter, jadi untuk desain final gunakan survei topografi.
- Hasil perhitungan adalah alat bantu perencanaan dan wajib diperiksa serta disahkan tenaga ahli yang berwenang.
