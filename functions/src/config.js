'use strict';
// Katalog paket & fitur WASHLY. Nilai di sini hanya BAWAAN: konfigurasi aktif disimpan di Firestore
// (billing_config/main) dan diubah admin lewat dasbor, tanpa deploy ulang kode.

// Fitur yang benar-benar ada di aplikasi. free: true = penuh, 'limited' = ada batas, false = khusus PRO.
const FEATURES = {
  // FREE: alat dasar yang tetap berguna
  map_survey:           { free: true,      pro: true, id: 'Pemetaan, GPS & survei lapangan', en: 'Mapping, GPS & field survey' },
  hydraulics:           { free: true,      pro: true, id: 'Analisis hidrolis jaringan', en: 'Network hydraulic analysis' },
  calc_basic:           { free: true,      pro: true, id: 'Kalkulator kebutuhan air & jumlah node', en: 'Water demand & node count calculator' },
  pump_basic:           { free: true,      pro: true, id: 'Head, daya & kurva pompa sumur bor', en: 'Borehole pump head, power & curve' },
  boq_cost:             { free: true,      pro: true, id: 'BoQ & RAB umum (volume, harga bawaan, ubah harga satuan)', en: 'General BoQ & cost estimate (quantities, default prices, edit unit prices)' },
  report_preview:       { free: true,      pro: true, id: 'Pratinjau laporan teknis (bertanda air)', en: 'Technical report preview (watermarked)' },
  data_export:          { free: true,      pro: true, id: 'Simpan/muat .json & .gpx', en: 'Save/load .json & .gpx' },
  assistant_offline:    { free: true,      pro: true, id: 'Asisten (basis pengetahuan luring)', en: 'Assistant (offline knowledge base)' },
  cloud_projects:       { free: 'limited', pro: true, id: 'Proyek tersimpan di cloud', en: 'Projects stored in the cloud' },
  // PRO: semua fitur dimaksimalkan
  calc_advanced:        { free: false,     pro: true, id: 'Kalkulator debit sumber & daya pompa', en: 'Source flow & pump power calculators' },
  pump_advanced:        { free: false,     pro: true, id: 'Daya pompa min/ideal/maks, spesifikasi pengadaan & paket all-in', en: 'Min/ideal/max pump power, procurement spec & all-in package' },
  treatment_design:     { free: false,     pro: true, id: 'Desain pengolahan air (aerator, filter, membran)', en: 'Water treatment design (aerator, filters, membranes)' },
  rab_advanced:         { free: false,     pro: true, id: 'RAB lanjutan: SHS/IKK provinsi, tingkat spesifikasi, edit item', en: 'Advanced cost estimate: provincial SHS/IKK, spec tiers, item editing' },
  report_print:         { free: false,     pro: true, id: 'Cetak / PDF laporan teknis', en: 'Print / PDF of the technical report' },
  rab_print:            { free: false,     pro: true, id: 'Cetak RAB', en: 'Print cost estimate' },
  esign:                { free: false,     pro: true, id: 'Review & tanda tangan elektronik', en: 'Review & electronic signatures' },
  custom_logo:          { free: false,     pro: true, id: 'Ganti logo instansi', en: 'Custom organisation logo' },
  ded_print:            { free: false,     pro: true, id: 'Cetak / PDF gambar DED', en: 'Print / PDF of DED drawings' },
  structural_design:    { free: false,     pro: true, id: 'Penulangan beton (BBS) & jembatan pipa', en: 'Concrete reinforcement (BBS) & pipe bridges' },
  rehab_module:         { free: false,     pro: true, id: 'Rehabilitasi sistem existing', en: 'Rehabilitation of existing systems' },
  groundwater_analysis: { free: false,     pro: true, id: 'Analisis potensi air tanah', en: 'Groundwater potential analysis' },
  dem_profile:          { free: false,     pro: true, id: 'Profil tanah detail dari DEM', en: 'Detailed ground profile from DEM' },
  manual_drawing:       { free: false,     pro: true, id: 'Gambar manual di lembar DED', en: 'Manual drawing on DED sheets' },
  ai_assistant:         { free: false,     pro: true, id: 'Mode AI (Claude) di Asisten', en: 'AI mode (Claude) in the Assistant' },
};

const FEATURES_REV = 2;
const DEFAULT_CONFIG = {
  version: 1,
  currency: 'IDR',
  enforce: false,            // false = semua fitur terbuka (perilaku lama). Admin menyalakan saat siap jualan.
  graceDays: 3,              // pembayaran web manual: akses tetap ada N hari setelah periode habis
  reminderDays: [7, 1],      // pengingat perpanjangan H-7 dan H-1
  pendingHours: 24,          // batas waktu bayar tagihan web
  freeLimits: { cloudProjects: 3 },
  plans: {
    FREE:        { code: 'FREE', name: 'WASHLY FREE', tier: 'FREE', months: 0, price: 0, active: true },
    PRO_MONTHLY: { code: 'PRO_MONTHLY', name: 'WASHLY PRO Bulanan', tier: 'PRO', months: 1, price: 125000, active: true, playProductId: 'washly_pro', playBasePlanId: 'monthly' },
    PRO_YEARLY:  { code: 'PRO_YEARLY', name: 'WASHLY PRO Tahunan', tier: 'PRO', months: 12, price: 499000, active: true, playProductId: 'washly_pro', playBasePlanId: 'yearly' },
  },
  // Disiapkan untuk promosi web (kode diverifikasi di server, harga akhir tetap dibayar lewat Midtrans).
  // Promosi Google Play WAJIB lewat offer di Play Console.
  promo: { enabled: false, codes: {} },
  // Transfer bank / QRIS manual: pengguna transfer, admin mengecek mutasi lalu mengonfirmasi di dasbor.
  // Virtual Account lewat Midtrans Core API (nomor VA tampil di aplikasi, PRO aktif otomatis lewat webhook)
  va: { enabled: true, banks: ['bca', 'bni', 'bri', 'mandiri', 'permata'] },
  manual: { enabled: false, bankName: '', accountNumber: '', accountName: '', qris: '', instructions: '', hours: 72 },
  features: Object.fromEntries(Object.entries(FEATURES).map(([k, v]) => [k, { free: v.free, pro: v.pro }])),
};

const PLAN_RE = /^[A-Z][A-Z0-9_]{1,31}$/;
// Validasi konfigurasi dari dasbor admin. Mengembalikan { ok, errors, config } dengan nilai yang sudah dibersihkan.
function validateConfig(input) {
  const errors = []; const c = JSON.parse(JSON.stringify(input || {}));
  const out = { ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)), ...c };
  const num = (v, lo, hi, name) => { const n = Number(v); if (!Number.isFinite(n) || n < lo || n > hi) { errors.push(`${name} harus angka ${lo}–${hi}`); return lo; } return n; };
  out.enforce = !!out.enforce;
  out.graceDays = num(out.graceDays, 0, 30, 'graceDays');
  out.pendingHours = num(out.pendingHours, 1, 168, 'pendingHours');
  out.reminderDays = (Array.isArray(out.reminderDays) ? out.reminderDays : []).map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 30).slice(0, 4);
  out.freeLimits = { cloudProjects: num(out.freeLimits && out.freeLimits.cloudProjects, 0, 1000, 'freeLimits.cloudProjects') };
  if (out.currency !== 'IDR') errors.push('Mata uang hanya IDR');
  const plans = {};
  for (const [code, p] of Object.entries(out.plans || {})) {
    if (!PLAN_RE.test(code) || !p || p.code !== code) { errors.push('Kode paket tidak valid: ' + code); continue; }
    const tier = p.tier === 'PRO' ? 'PRO' : p.tier === 'FREE' ? 'FREE' : null; if (!tier) { errors.push(code + ': tier harus FREE/PRO'); continue; }
    const months = tier === 'FREE' ? 0 : num(p.months, 1, 36, code + '.months');
    const price = tier === 'FREE' ? 0 : num(p.price, 1000, 100000000, code + '.price');
    if (tier === 'PRO' && !Number.isInteger(price)) errors.push(code + ': harga harus bilangan bulat rupiah');
    plans[code] = { code, name: String(p.name || code).slice(0, 60), tier, months, price, active: p.active !== false,
      ...(p.playProductId ? { playProductId: String(p.playProductId).slice(0, 100), playBasePlanId: String(p.playBasePlanId || '').slice(0, 63) } : {}) };
  }
  if (!plans.FREE) errors.push('Paket FREE wajib ada');
  if (!Object.values(plans).some(p => p.tier === 'PRO' && p.active)) errors.push('Minimal satu paket PRO aktif');
  out.plans = plans;
  const feats = {};
  // Revisi katalog: konfigurasi lama (rev < 2) masih menyimpan report_print gratis → pakai bawaan baru (cetak laporan khusus PRO)
  const oldRev = (Number(c.featuresRev) || 1) < FEATURES_REV; if (oldRev && out.features) { out.features = { ...out.features }; delete out.features.report_print; }
  out.featuresRev = FEATURES_REV;
  for (const k of Object.keys(FEATURES)) { const f = (out.features || {})[k] || DEFAULT_CONFIG.features[k];
    feats[k] = { free: f.free === true ? true : f.free === 'limited' ? 'limited' : false, pro: true }; }
  out.features = feats;
  const codes = {};
  for (const [code, pr] of Object.entries((out.promo && out.promo.codes) || {})) {
    if (!/^[A-Z0-9]{3,20}$/.test(code)) { errors.push('Kode promo tidak valid: ' + code); continue; }
    const pct = num(pr.percent, 1, 90, 'promo ' + code + '.percent');
    codes[code] = { percent: pct, planCodes: (pr.planCodes || []).filter(x => plans[x] && plans[x].tier === 'PRO'), validUntil: pr.validUntil || null, maxUses: pr.maxUses ? num(pr.maxUses, 1, 1e6, 'maxUses') : null, active: pr.active !== false };
  }
  out.promo = { enabled: !!(out.promo && out.promo.enabled), codes };
  const VA_BANKS = ['bca', 'bni', 'bri', 'mandiri', 'permata', 'cimb'];
  out.va = { enabled: !(out.va && out.va.enabled === false), banks: ((out.va && out.va.banks) || DEFAULT_CONFIG.va.banks).filter(b => VA_BANKS.includes(b)) };
  const m = out.manual || {}; const str = (v, n) => String(v || '').trim().slice(0, n);
  const qris = typeof m.qris === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(m.qris) ? m.qris : '';
  if (m.qris && !qris) errors.push('Gambar QRIS harus PNG/JPG');
  if (qris.length > 400000) errors.push('Gambar QRIS terlalu besar (maks. ±300 KB)');
  out.manual = { enabled: !!m.enabled, bankName: str(m.bankName, 60), accountNumber: str(m.accountNumber, 40).replace(/[^0-9 \-]/g, ''), accountName: str(m.accountName, 80),
    qris, instructions: str(m.instructions, 500), hours: num(m.hours == null ? 72 : m.hours, 1, 336, 'manual.hours') };
  if (out.manual.enabled && !((out.manual.bankName && out.manual.accountNumber && out.manual.accountName) || out.manual.qris)) errors.push('Transfer manual aktif: isi rekening (bank, nomor, nama) atau unggah QRIS');
  out.paymentsPublic = !!out.paymentsPublic; // buka pembayaran online untuk semua (hanya berlaku pada mode Production)
  out.midtrans = out.midtrans && typeof out.midtrans === 'object' ? { configured: !!out.midtrans.configured, mode: out.midtrans.mode === 'production' ? 'production' : 'sandbox', updatedAt: out.midtrans.updatedAt || null } : null;
  out.version = DEFAULT_CONFIG.version;
  return { ok: errors.length === 0, errors, config: out };
}

module.exports = { FEATURES, DEFAULT_CONFIG, validateConfig };
