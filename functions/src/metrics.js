'use strict';
// Metrik pendapatan & pelanggan untuk dasbor admin. Fungsi murni: data masuk → angka keluar.
//
// DEFINISI (berlaku untuk rentang [from, to)):
// - Pendapatan diterima (gross)  = Σ pembayaran berstatus PAID/REFUNDED yang paidAt-nya di rentang. PENDING tidak dihitung.
// - Refund                        = Σ refundAmount pembayaran yang refundedAt-nya di rentang.
// - Pendapatan bersih             = gross − refund.
// - Tertunda (pending)            = Σ pembayaran PENDING yang dibuat di rentang (BUKAN pendapatan).
// - Gagal                         = jumlah & nilai pembayaran FAILED/EXPIRED/CANCELED yang dibuat di rentang.
// - Google Play: nominal = harga daftar paket di konfigurasi (bruto, sebelum potongan Google & pajak).
//   Angka bersih resmi ada di laporan keuangan Play Console.
// - MRR (saat `to`)               = Σ harga paket ÷ bulan paket untuk setiap langganan berbayar yang memberi akses saat `to`
//   (status ACTIVE/GRACE_PERIOD/CANCELED-yang-belum-habis; langganan pemberian admin tidak dihitung).
//   MRR berkomitmen = sama, tetapi tanpa langganan yang sudah dibatalkan (tidak akan diperpanjang).
// - ARR                           = MRR × 12.
// - ARPPU                         = pendapatan bersih ÷ jumlah pengguna unik yang membayar (PAID) di rentang.
// - Konversi FREE→PRO             = pengguna yang pembayaran PAID PERTAMA-nya jatuh di rentang ÷ pengguna yang terdaftar
//   sebelum `to` dan belum pernah membayar sebelum `from`.
// - Churn langganan               = langganan berbayar yang BERAKHIR (event subscription_expired / refund) di rentang ÷
//   langganan berbayar yang aktif saat `from`. (Churn pengguna & churn pendapatan tidak dicampur di sini.)
// - Tingkat perpanjangan          = perpanjangan ÷ (perpanjangan + berakhir) di rentang.
const { accessUntil } = require('./lifecycle');

const ms = (v) => (v && v.toMillis ? v.toMillis() : typeof v === 'number' ? v : v ? Date.parse(v) || 0 : 0);
const inR = (t, from, to) => t >= from && t < to;

function bucketKey(t, g) {
  const d = new Date(t + 7 * 36e5); // zona waktu WIB untuk pengelompokan
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), day = String(d.getUTCDate()).padStart(2, '0');
  if (g === 'year') return String(y);
  if (g === 'month') return `${y}-${m}`;
  if (g === 'week') { const t0 = Date.UTC(y, d.getUTCMonth(), d.getUTCDate()); const dow = (new Date(t0).getUTCDay() + 6) % 7; const mon = new Date(t0 - dow * 864e5); return mon.toISOString().slice(0, 10); }
  return `${y}-${m}-${day}`;
}

function paidSub(s) { return s.provider !== 'admin'; }

function mrrAt(subs, config, t, committed) {
  let v = 0, monthly = 0, annual = 0, other = 0;
  for (const s of subs) { if (!paidSub(s) || !accessUntil(s, t)) continue; if (committed && s.status === 'CANCELED') continue;
    const p = config.plans[s.planCode]; if (!p || !p.months) continue; v += p.price / p.months;
    if (p.months === 1) monthly++; else if (p.months === 12) annual++; else other++; }
  return { mrr: Math.round(v), monthly, annual, other };
}

function computeMetrics({ users = [], subs = [], payments = [], events = [] }, config, { from, to, granularity = 'day' }) {
  users = users.map(u => ({ ...u, createdAt: ms(u.createdAt) }));
  payments = payments.map(p => ({ ...p, createdAt: ms(p.createdAt), paidAt: ms(p.paidAt), refundedAt: ms(p.refundedAt) }));
  events = events.map(e => ({ ...e, at: ms(e.at) }));
  subs = subs.map(s => ({ ...s, currentPeriodEnd: ms(s.currentPeriodEnd), graceEndsAt: ms(s.graceEndsAt) }));
  const now = Math.min(Date.now(), to);

  const proUsers = new Set(subs.filter(s => accessUntil(s, now)).map(s => s.userId));
  const range = (f, t) => {
    const gross = payments.filter(p => (p.status === 'PAID' || p.status === 'REFUNDED') && inR(p.paidAt, f, t)).reduce((a, p) => a + (p.amount || 0), 0);
    const refunds = payments.filter(p => p.refundedAt && inR(p.refundedAt, f, t)).reduce((a, p) => a + (p.refundAmount || p.amount || 0), 0);
    const pend = payments.filter(p => p.status === 'PENDING' && inR(p.createdAt, f, t));
    const failed = payments.filter(p => ['FAILED', 'EXPIRED', 'CANCELED'].includes(p.status) && inR(p.createdAt, f, t));
    const payers = new Set(payments.filter(p => (p.status === 'PAID' || p.status === 'REFUNDED') && inR(p.paidAt, f, t)).map(p => p.userId));
    const ev = (type) => events.filter(e => e.type === type && inR(e.at, f, t)).length;
    const firstPaid = {}; for (const p of payments) if ((p.status === 'PAID' || p.status === 'REFUNDED') && p.paidAt) firstPaid[p.userId] = Math.min(firstPaid[p.userId] || Infinity, p.paidAt);
    const converted = Object.values(firstPaid).filter(t0 => inR(t0, f, t)).length;
    const eligible = users.filter(u => u.createdAt < t && !(firstPaid[u.uid] < f)).length;
    const activeAtStart = subs.filter(s => paidSub(s) && accessUntil(s, f)).length;
    const ended = ev('subscription_expired') + ev('refund_processed'); const renewed = ev('subscription_renewed');
    return {
      revenueGross: gross, refunds, revenueNet: gross - refunds, pendingAmount: pend.reduce((a, p) => a + (p.amount || 0), 0), pendingCount: pend.length,
      failedCount: failed.length, failedAmount: failed.reduce((a, p) => a + (p.amount || 0), 0),
      transactions: payments.filter(p => inR(p.createdAt, f, t)).length, payingUsers: payers.size,
      arppu: payers.size ? Math.round((gross - refunds) / payers.size) : 0,
      newSubscriptions: ev('subscription_created') + ev('subscription_reactivated'), canceled: ev('subscription_canceled'), expired: ev('subscription_expired'),
      renewed, conversionRate: eligible ? converted / eligible : 0, converted, eligible,
      churnRate: activeAtStart ? ended / activeAtStart : 0, ended, activeAtStart, renewalRate: renewed + ended ? renewed / (renewed + ended) : null,
    };
  };
  const cur = range(from, to); const len = to - from; const prev = range(from - len, from);
  const m = mrrAt(subs, config, now, false), mc = mrrAt(subs, config, now, true);

  // Deret waktu
  const keys = []; const step = { day: 864e5, week: 7 * 864e5, month: 28 * 864e5, year: 365 * 864e5 }[granularity] || 864e5;
  for (let t = from; t < to; t += step) { const k = bucketKey(t, granularity); if (!keys.includes(k)) keys.push(k); }
  const ser = Object.fromEntries(keys.map(k => [k, { key: k, revenue: 0, refunds: 0, pending: 0, failed: 0, newSubs: 0, canceled: 0, byPlan: {}, byProvider: {} }]));
  for (const p of payments) {
    if ((p.status === 'PAID' || p.status === 'REFUNDED') && inR(p.paidAt, from, to)) { const b = ser[bucketKey(p.paidAt, granularity)]; if (b) { b.revenue += p.amount || 0; b.byPlan[p.planCode] = (b.byPlan[p.planCode] || 0) + (p.amount || 0); b.byProvider[p.provider] = (b.byProvider[p.provider] || 0) + (p.amount || 0); } }
    if (p.refundedAt && inR(p.refundedAt, from, to)) { const b = ser[bucketKey(p.refundedAt, granularity)]; if (b) b.refunds += p.refundAmount || p.amount || 0; }
    if (p.status === 'PENDING' && inR(p.createdAt, from, to)) { const b = ser[bucketKey(p.createdAt, granularity)]; if (b) b.pending += p.amount || 0; }
    if (['FAILED', 'EXPIRED', 'CANCELED'].includes(p.status) && inR(p.createdAt, from, to)) { const b = ser[bucketKey(p.createdAt, granularity)]; if (b) b.failed++; }
  }
  for (const e of events) { if (!inR(e.at, from, to)) continue; const b = ser[bucketKey(e.at, granularity)]; if (!b) continue;
    if (e.type === 'subscription_created' || e.type === 'subscription_reactivated') b.newSubs++; if (e.type === 'subscription_canceled') b.canceled++; }
  const byPlan = {}, byProvider = {};
  for (const p of payments) if ((p.status === 'PAID' || p.status === 'REFUNDED') && inR(p.paidAt, from, to)) { byPlan[p.planCode] = (byPlan[p.planCode] || 0) + (p.amount || 0); byProvider[p.provider] = (byProvider[p.provider] || 0) + (p.amount || 0); }

  return {
    range: { from, to, granularity }, generatedAt: Date.now(),
    overview: { totalUsers: users.length, proUsers: proUsers.size, freeUsers: Math.max(0, users.length - proUsers.size), activeSubscriptions: subs.filter(s => accessUntil(s, now)).length,
      mrr: m.mrr, committedMrr: mc.mrr, arr: m.mrr * 12, activeMonthly: m.monthly, activeAnnual: m.annual },
    current: cur, previous: prev, series: keys.map(k => ser[k]), byPlan, byProvider,
  };
}

module.exports = { computeMetrics, bucketKey, mrrAt };
