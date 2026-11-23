'use strict';
// Logika siklus langganan yang murni (tanpa database) agar mudah diuji.
// Semua waktu dalam milidetik epoch (UTC).

const STATUS = ['FREE', 'ACTIVE', 'PENDING', 'PAST_DUE', 'GRACE_PERIOD', 'CANCELED', 'EXPIRED', 'REFUNDED'];
const DAY = 864e5;

function addMonths(ms, months) {
  const d = new Date(ms); const day = d.getUTCDate();
  d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last)); return d.getTime();
}

// Sampai kapan langganan ini memberi akses PRO (0 = tidak memberi akses).
function accessUntil(sub, now) {
  if (!sub) return 0;
  switch (sub.status) {
    case 'ACTIVE': case 'CANCELED': return sub.currentPeriodEnd > now ? sub.currentPeriodEnd : 0;
    case 'GRACE_PERIOD': return Math.max(sub.graceEndsAt || 0, sub.currentPeriodEnd || 0) > now ? Math.max(sub.graceEndsAt || 0, sub.currentPeriodEnd || 0) : 0;
    default: return 0; // PENDING, PAST_DUE (Play on hold / paused), EXPIRED, REFUNDED
  }
}

// Hak akses gabungan seorang pengguna dari semua langganannya (web, Google Play, admin, kelak organisasi).
function resolveEntitlement(subs, config, now) {
  let best = null, bestUntil = 0;
  for (const s of subs || []) { const u = accessUntil(s, now); if (u > bestUntil) { best = s; bestUntil = u; } }
  const plan = best && config.plans[best.planCode];
  const tier = best ? 'PRO' : 'FREE';
  const features = {}; for (const [k, f] of Object.entries(config.features)) features[k] = tier === 'PRO' ? true : f.free;
  return {
    tier, planCode: best ? best.planCode : 'FREE', planName: plan ? plan.name : (config.plans.FREE && config.plans.FREE.name) || 'WASHLY FREE',
    status: best ? best.status : 'FREE', provider: best ? best.provider : null, subscriptionId: best ? best.id : null,
    accessUntil: bestUntil || null, currentPeriodEnd: best ? best.currentPeriodEnd : null, autoRenew: best ? !!best.autoRenew : false,
    graceEndsAt: best && best.status === 'GRACE_PERIOD' ? best.graceEndsAt : null,
    features, limits: { cloudProjects: tier === 'PRO' ? null : config.freeLimits.cloudProjects },
  };
}

// Pembayaran web (Midtrans) terverifikasi → aktifkan atau perpanjang. Periode baru dimulai saat periode lama habis
// (pembayaran di muka ditumpuk, tidak hangus). Mengembalikan { sub, events }.
function applyWebPayment(sub, payment, plan, now) {
  const events = []; const prevUntil = sub ? accessUntil(sub, now) : 0;
  // Masa tenggang: periode baru disambung dari akhir periode lama (hari tenggang tidak gratis).
  const start = sub && sub.status === 'GRACE_PERIOD' ? sub.currentPeriodEnd : prevUntil > now ? Math.max(prevUntil, sub.currentPeriodEnd || 0) : now;
  const end = addMonths(start, plan.months);
  const base = sub || { id: payment.subscriptionId, subjectType: 'user', subjectId: payment.userId, userId: payment.userId, orgId: null, seats: 1,
    provider: 'midtrans', providerSubscriptionId: null, startedAt: now, createdAt: now };
  let type;
  if (!sub) type = 'subscription_created';
  else if (!prevUntil) type = 'subscription_reactivated';
  else type = 'subscription_renewed';
  if (sub && sub.planCode && sub.planCode !== plan.code) events.push({ type: plan.months > (sub.planMonths || 0) ? 'subscription_upgraded' : 'subscription_downgraded', from: sub.planCode, to: plan.code });
  events.unshift({ type: 'payment_succeeded' }, { type });
  const next = { ...base, planCode: plan.code, planMonths: plan.months, status: 'ACTIVE', autoRenew: true, renewalMode: 'manual',
    currentPeriodStart: prevUntil > now && sub.status !== 'GRACE_PERIOD' ? (sub.currentPeriodStart || now) : start, currentPeriodEnd: end, nextRenewalAt: end,
    canceledAt: null, graceEndsAt: null, lastPaymentId: payment.id, updatedAt: now };
  return { sub: next, events };
}

// Pengguna web membatalkan: tidak ada pengingat/penagihan lagi, akses tetap sampai akhir periode.
function cancelSub(sub, now) {
  if (!sub || !['ACTIVE', 'GRACE_PERIOD'].includes(sub.status)) return { sub, events: [] };
  return { sub: { ...sub, status: accessUntil(sub, now) ? 'CANCELED' : 'EXPIRED', autoRenew: false, canceledAt: now, nextRenewalAt: null, updatedAt: now }, events: [{ type: 'subscription_canceled' }] };
}

// Pemeriksaan berkala (langganan web/admin; Google Play diperbarui oleh RTDN dan verifikasi ulang).
function sweepSub(sub, config, now) {
  if (!sub || sub.provider === 'google_play') return { sub, events: [] };
  const events = []; let s = sub;
  if (s.status === 'ACTIVE' && s.currentPeriodEnd <= now) {
    if (s.autoRenew && s.provider === 'midtrans' && config.graceDays > 0) { s = { ...s, status: 'GRACE_PERIOD', graceEndsAt: s.currentPeriodEnd + config.graceDays * DAY, updatedAt: now }; events.push({ type: 'grace_period_started' }); }
    else { s = { ...s, status: 'EXPIRED', updatedAt: now }; events.push({ type: 'subscription_expired' }); }
  }
  if (s.status === 'GRACE_PERIOD' && (s.graceEndsAt || 0) <= now) { s = { ...s, status: 'EXPIRED', updatedAt: now }; events.push({ type: 'grace_period_ended' }, { type: 'subscription_expired' }); }
  if (s.status === 'CANCELED' && s.currentPeriodEnd <= now) { s = { ...s, status: 'EXPIRED', updatedAt: now }; events.push({ type: 'subscription_expired' }); }
  return { sub: s, events };
}

// Refund: akses periode yang dibayar dengan pembayaran ini dicabut segera.
function refundSub(sub, payment, now) {
  if (!sub) return { sub, events: [{ type: 'refund_processed' }] };
  const covers = sub.lastPaymentId === payment.id || accessUntil(sub, now) > 0;
  const s = covers ? { ...sub, status: 'REFUNDED', autoRenew: false, currentPeriodEnd: Math.min(sub.currentPeriodEnd || now, now), nextRenewalAt: null, updatedAt: now } : sub;
  return { sub: s, events: [{ type: 'refund_processed' }] };
}

// Status transaksi Midtrans → status pembayaran WASHLY.
function midtransPaymentStatus(n) {
  const ts = n.transaction_status, fraud = n.fraud_status;
  if (ts === 'settlement') return 'PAID';
  if (ts === 'capture') return fraud === 'accept' || !fraud ? 'PAID' : 'PENDING'; // challenge → tunggu keputusan
  if (ts === 'pending' || ts === 'authorize') return 'PENDING';
  if (ts === 'expire') return 'EXPIRED';
  if (ts === 'cancel') return 'CANCELED';
  if (ts === 'deny' || ts === 'failure') return 'FAILED';
  if (ts === 'refund' || ts === 'partial_refund' || ts === 'chargeback' || ts === 'partial_chargeback') return 'REFUNDED';
  return 'UNKNOWN';
}

// Google Play subscriptionsv2 → langganan WASHLY.
const PLAY_STATE = {
  SUBSCRIPTION_STATE_ACTIVE: 'ACTIVE', SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'GRACE_PERIOD', SUBSCRIPTION_STATE_ON_HOLD: 'PAST_DUE',
  SUBSCRIPTION_STATE_PAUSED: 'PAST_DUE', SUBSCRIPTION_STATE_CANCELED: 'CANCELED', SUBSCRIPTION_STATE_EXPIRED: 'EXPIRED',
  SUBSCRIPTION_STATE_PENDING: 'PENDING', SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED: 'EXPIRED',
};
function planFromPlay(config, productId, basePlanId) {
  return Object.values(config.plans).find(p => p.playProductId === productId && (!p.playBasePlanId || p.playBasePlanId === basePlanId)) || null;
}
function subFromPlay(prev, v2, ctx) {
  const li = (v2.lineItems || []).slice().sort((a, b) => Date.parse(b.expiryTime || 0) - Date.parse(a.expiryTime || 0))[0] || {};
  const plan = planFromPlay(ctx.config, li.productId, li.offerDetails && li.offerDetails.basePlanId);
  if (!plan) throw new Error('Produk Google Play tidak dikenal: ' + li.productId + '/' + (li.offerDetails && li.offerDetails.basePlanId));
  let status = PLAY_STATE[v2.subscriptionState] || 'EXPIRED';
  const autoRenew = !!(li.autoRenewingPlan && li.autoRenewingPlan.autoRenewEnabled);
  const end = Date.parse(li.expiryTime || 0) || 0;
  if (status === 'ACTIVE' && !autoRenew) status = 'CANCELED'; // dibatalkan tapi masih dalam periode berbayar
  if ((status === 'ACTIVE' || status === 'CANCELED') && end <= ctx.now) status = 'EXPIRED';
  const now = ctx.now;
  const s = { ...(prev || { id: ctx.id, subjectType: 'user', subjectId: ctx.uid, userId: ctx.uid, orgId: null, seats: 1, provider: 'google_play', createdAt: now, startedAt: Date.parse(v2.startTime || 0) || now }),
    planCode: plan.code, planMonths: plan.months, status, autoRenew, renewalMode: 'auto', providerSubscriptionId: v2.latestOrderId || null,
    purchaseTokenHash: ctx.tokenHash, currentPeriodEnd: end, nextRenewalAt: autoRenew ? end : null,
    graceEndsAt: status === 'GRACE_PERIOD' ? end : null, canceledAt: status === 'CANCELED' ? ((prev && prev.canceledAt) || Date.parse(v2.canceledStateContext && v2.canceledStateContext.userInitiatedCancellation && v2.canceledStateContext.userInitiatedCancellation.cancelTime || 0) || now) : (prev && prev.status === 'CANCELED' && status === 'ACTIVE' ? null : (prev && prev.canceledAt) || null),
    testPurchase: !!v2.testPurchase, updatedAt: now };
  if (!s.currentPeriodStart || (prev && prev.currentPeriodEnd !== end)) s.currentPeriodStart = prev && prev.currentPeriodEnd && prev.currentPeriodEnd < end ? prev.currentPeriodEnd : (Date.parse(v2.startTime || 0) || now);
  // Peristiwa dari perubahan status
  const events = []; const ps = prev && prev.status;
  if (!prev) events.push({ type: status === 'PENDING' ? 'payment_pending' : 'subscription_created' });
  else if (ps !== status) {
    const map = { ACTIVE: ps === 'CANCELED' ? 'subscription_restored' : ps === 'GRACE_PERIOD' || ps === 'PAST_DUE' ? 'payment_recovered' : 'subscription_reactivated',
      GRACE_PERIOD: 'grace_period_started', PAST_DUE: 'payment_failed', CANCELED: 'subscription_canceled', EXPIRED: 'subscription_expired' };
    if (map[status]) events.push({ type: map[status] });
  }
  if (prev && prev.planCode !== plan.code) events.push({ type: plan.months > (prev.planMonths || 0) ? 'subscription_upgraded' : 'subscription_downgraded', from: prev.planCode, to: plan.code });
  if (prev && prev.currentPeriodEnd && end > prev.currentPeriodEnd && status === 'ACTIVE' && ps === 'ACTIVE') events.push({ type: 'subscription_renewed' });
  return { sub: s, events, plan, lineItem: li };
}

module.exports = { STATUS, DAY, addMonths, accessUntil, resolveEntitlement, applyWebPayment, cancelSub, sweepSub, refundSub, midtransPaymentStatus, planFromPlay, subFromPlay };
