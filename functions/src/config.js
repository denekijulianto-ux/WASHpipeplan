'use strict';
// Katalog paket & fitur WASHLY. Nilai di sini hanya BAWAAN: konfigurasi aktif disimpan di Firestore
// (billing_config/main) dan diubah admin lewat dasbor, tanpa deploy ulang kode.

// Fitur yang benar-benar ada di aplikasi. free: true = penuh, 'limited' = ada batas, false = khusus PRO.
const FEATURES = {
  map_survey:           { free: true,      pro: true, id: 'Pemetaan, GPS & survei lapangan', en: 'Mapping, GPS & field survey' },
  hydraulics:           { free: true,      pro: true, id: 'Analisis hidrolis jaringan', en: 'Network hydraulic analysis' },
  pumps_treatment:      { free: true,      pro: true, id: 'Pompa & pengolahan air', en: 'Pumps & water treatment' },
  calculator:           { free: true,      pro: true, id: 'Kalkulator kebutuhan air, node & daya pompa', en: 'Water demand, node & pump power calculator' },
  boq_cost:             { free: true,      pro: true, id: 'BoQ & RAB', en: 'Bill of quantities & cost estimate' },
  report_print:         { free: true,      pro: true, id: 'Cetak laporan teknis (PDF)', en: 'Print technical report (PDF)' },
  data_export:          { free: true,      pro: true, id: 'Simpan/muat .json & .gpx', en: 'Save/load .json & .gpx' },
  review_workflow:      { free: true,      pro: true, id: 'Review & tanda tangan elektronik', en: 'Review & electronic signatures' },
  assistant_offline:    { free: true,      pro: true, id: 'Asisten (basis pengetahuan luring)', en: 'Assistant (offline knowledge base)' },
  cloud_projects:       { free: 'limited', pro: true, id: 'Proyek tersimpan di cloud', en: 'Projects stored in the cloud' },
  ded_print:            { free: false,     pro: true, id: 'Cetak / PDF gambar DED', en: 'Print / PDF of DED drawings' },
  structural_design:    { free: false,     pro: true, id: 'Penulangan beton (BBS) & jembatan pipa', en: 'Concrete reinforcement (BBS) & pipe bridges' },
  rehab_module:         { free: false,     pro: true, id: 'Rehabilitasi sistem existing', en: 'Rehabilitation of existing systems' },
  groundwater_analysis: { free: false,     pro: true, id: 'Analisis potensi air tanah', en: 'Groundwater potential analysis' },
  dem_profile:          { free: false,     pro: true, id: 'Profil tanah detail dari DEM', en: 'Detailed ground profile from DEM' },
  manual_drawing:       { free: false,     pro: true, id: 'Gambar manual di lembar DED', en: 'Manual drawing on DED sheets' },
  ai_assistant:         { free: false,     pro: true, id: 'Mode AI (Claude) di Asisten', en: 'AI mode (Claude) in the Assistant' },
};

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
  out.version = DEFAULT_CONFIG.version;
  return { ok: errors.length === 0, errors, config: out };
}

module.exports = { FEATURES, DEFAULT_CONFIG, validateConfig };
