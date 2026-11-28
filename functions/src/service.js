'use strict';
// Layanan langganan WASHLY. Semua keputusan hak akses & pembayaran dibuat DI SERVER berdasarkan data
// yang sudah diverifikasi ke penyedia pembayaran (Midtrans / Google Play) — tidak pernah dari klaim aplikasi.
//
// deps: { db, now(), ts(ms) → Timestamp, midtrans: { serverKey, createSnap, getStatus }, play: { packageName, getSubscription, acknowledge },
//         adminEmails: [], ntfyTopic, appUrl, fetch }
const crypto = require('crypto');
const { DEFAULT_CONFIG, validateConfig } = require('./config');
const L = require('./lifecycle');
const { computeMetrics } = require('./metrics');

class BillingError extends Error { constructor(code, message) { super(message); this.code = code; } }
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const accountIdFor = (uid) => sha256('washly:' + uid).slice(0, 64);
const normEmail = (e) => String(e || '').trim().toLowerCase();
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };

const NOTE = {
  activated: ['Selamat datang di WASHLY PRO!', 'Selamat datang di WASHLY PRO! Langganan Anda sudah aktif.'],
  renewed: ['Pembayaran berhasil', 'Langganan WASHLY PRO Anda berhasil diperpanjang.'],
  upcoming_web: ['Masa aktif PRO segera berakhir', 'Langganan WASHLY PRO Anda berakhir pada {0}. Perpanjang di Profil → Langganan agar akses PRO tidak terputus.'],
  upcoming_play: ['Perpanjangan PRO segera', 'Langganan WASHLY PRO Anda dijadwalkan diperpanjang otomatis pada {0}.'],
  failed: ['Pembayaran gagal', 'Pembayaran WASHLY PRO Anda tidak dapat diproses. Perbarui metode pembayaran agar akses tidak hilang.'],
  canceled: ['Langganan dibatalkan', 'Langganan Anda dibatalkan. Anda tetap dapat memakai PRO sampai {0}.'],
  expired: ['Langganan PRO berakhir', 'Langganan WASHLY PRO Anda sudah berakhir. Anda sekarang memakai WASHLY FREE.'],
  grace: ['Masa tenggang PRO', 'Periode PRO Anda sudah habis. Akses PRO masih aktif sampai {0}; perpanjang agar tidak terputus.'],
  manual_rejected: ['Transfer belum dapat dikonfirmasi', 'Transfer Anda untuk WASHLY PRO belum dapat dikonfirmasi admin: {0}. Silakan periksa kembali atau hubungi admin WASHLY.'],
  refunded: ['Refund diproses', 'Refund pembayaran WASHLY PRO Anda sudah diproses; akses PRO untuk periode tersebut dicabut.'],
};
const fmtDate = (t) => { const d = new Date(t + 7 * 36e5); return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`; };

function makeService(deps) {
  const { db } = deps; const now = () => deps.now ? deps.now() : Date.now();
  const col = (c) => db.collection(c);
  const isAdmin = (auth) => !!(auth && auth.token && auth.token.email_verified === true && (deps.adminEmails || []).map(normEmail).includes(normEmail(auth.token.email)));
  const needAuth = (auth) => { if (!auth || !auth.uid) throw new BillingError('unauthenticated', 'Silakan masuk terlebih dahulu.'); return auth.uid; };
  const needAdmin = (auth) => { needAuth(auth); if (!isAdmin(auth)) throw new BillingError('permission-denied', 'Khusus admin.'); };

  async function getConfig() {
    const d = await col('billing_config').doc('main').get();
    if (!d.exists) return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    const v = validateConfig(d.data()); return v.config;
  }
  async function logEvents(events, base) {
    for (const e of events) await col('subscription_events').add({ ...base, ...e, at: now() });
  }
  async function notifyUser(uid, kind, args = []) {
    const n = NOTE[kind]; if (!n) return;
    const u = await col('users').doc(uid).get(); const email = u.exists ? normEmail(u.data().email) : ''; if (!email) return;
    const body = n[1].replace(/\{(\d)\}/g, (_, i) => args[+i] ?? '');
    await col('notifications').add({ toEmail: email, toUid: uid, title: n[0], body, kind: 'billing', projectId: '', fromUid: '', fromName: 'WASHLY', read: false, at: deps.ts ? deps.ts(now()) : now() });
    if (deps.ntfyTopic && deps.fetch) try { // pesan umum tanpa data pribadi (server ntfy publik)
      await deps.fetch('https://ntfy.sh/', { method: 'POST', body: JSON.stringify({ topic: `${deps.ntfyTopic}-${sha256(email).slice(0, 10)}`, title: 'WASHLY', message: n[0], click: deps.appUrl || '', tags: ['droplet'] }) });
    } catch (e) { /* push opsional */ }
  }
  async function userSubs(uid) { const q = await col('subscriptions').where('userId', '==', uid).get(); return q.docs.map(d => ({ id: d.id, ...d.data() })); }
  async function recomputeEntitlement(uid, cfg) {
    const config = cfg || await getConfig(); const ent = L.resolveEntitlement(await userSubs(uid), config, now());
    await col('entitlements').doc(uid).set({ ...ent, uid, enforce: !!config.enforce, accessUntilTs: ent.accessUntil && deps.ts ? deps.ts(ent.accessUntil) : null, updatedAt: now() });
    return ent;
  }
  // Notifikasi pengguna sesuai peristiwa
  async function notifyFor(uid, events, sub) {
    const t = new Set(events.map(e => e.type));
    if (t.has('subscription_created') || t.has('subscription_reactivated')) await notifyUser(uid, 'activated');
    else if (t.has('subscription_renewed') || t.has('payment_recovered')) await notifyUser(uid, 'renewed');
    if (t.has('payment_failed')) await notifyUser(uid, 'failed');
    if (t.has('grace_period_started')) await notifyUser(uid, 'grace', [fmtDate(sub.graceEndsAt || sub.currentPeriodEnd)]);
    if (t.has('subscription_canceled')) await notifyUser(uid, 'canceled', [fmtDate(sub.currentPeriodEnd)]);
    if (t.has('subscription_expired')) await notifyUser(uid, 'expired');
    if (t.has('refund_processed')) await notifyUser(uid, 'refunded');
  }

  /* ---------------- WEB: Midtrans ---------------- */
  // Sandbox: pembayaran bisa "dibayar" dengan simulator publik Midtrans → hanya admin yang boleh mencoba
  // Kunci Midtrans: diisi admin di aplikasi (billing_secrets/midtrans, hanya terbaca server) atau Secret Manager (cadangan)
  let mtCache = null;
  async function mt() {
    if (!deps.midtransFactory) return deps.midtrans;
    if (mtCache && mtCache.at > now() - 30000) return mtCache.client;
    const d = await col('billing_secrets').doc('midtrans').get(); const x = d.exists ? d.data() : null;
    const client = x && x.serverKey ? deps.midtransFactory({ serverKey: x.serverKey, signatureKey: x.signatureKey, isProduction: x.mode === 'production' }) : deps.midtrans;
    mtCache = { at: now(), client }; return client;
  }
  const sandboxGuard = async (auth) => { const M = await mt(); if (M && M.isProduction === false && !isAdmin(auth)) throw new BillingError('failed-precondition', 'Pembayaran online masih dalam uji coba; belum dibuka untuk umum.'); return M; };
  async function createCheckout(auth, data = {}) {
    const uid = needAuth(auth); const M = await sandboxGuard(auth); const config = await getConfig();
    const plan = config.plans[String(data.planCode || '')];
    if (!plan || plan.tier !== 'PRO' || !plan.active) throw new BillingError('invalid-argument', 'Paket tidak tersedia.');
    const ud = await col('users').doc(uid).get(); const user = ud.exists ? ud.data() : null;
    if (!user || (!['approved', 'pending'].includes(user.status) && !isAdmin(auth))) throw new BillingError('failed-precondition', 'Akun ditangguhkan atau ditolak admin.');
    const recent = (await col('payments').where('userId', '==', uid).get()).docs.map(d => d.data()).filter(p => p.status === 'PENDING' && p.createdAt > now() - 36e5);
    if (recent.length >= 5) throw new BillingError('resource-exhausted', 'Terlalu banyak tagihan tertunda. Selesaikan atau tunggu tagihan sebelumnya kedaluwarsa.');
    let amount = plan.price, promoCode = null;
    if (data.promoCode) { const code = String(data.promoCode).toUpperCase().trim(); const pr = config.promo.enabled && config.promo.codes[code];
      const valid = pr && pr.active && (!pr.validUntil || Date.parse(pr.validUntil) > now()) && (!pr.planCodes.length || pr.planCodes.includes(plan.code));
      if (!valid) throw new BillingError('invalid-argument', 'Kode promo tidak berlaku.');
      if (pr.maxUses) { const used = (await col('payments').where('promoCode', '==', code).get()).docs.filter(d => d.data().status === 'PAID').length; if (used >= pr.maxUses) throw new BillingError('invalid-argument', 'Kuota kode promo habis.'); }
      amount = Math.max(1000, Math.round(plan.price * (100 - pr.percent) / 100)); promoCode = code; }
    const orderId = `WSH-${uid.slice(0, 8)}-${now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`.toUpperCase();
    const subscriptionId = 'web_' + uid;
    const pay = { id: orderId, userId: uid, subscriptionId, provider: 'midtrans', planCode: plan.code, amount, listPrice: plan.price, currency: 'IDR', promoCode,
      status: 'PENDING', method: null, transactionId: null, paidAt: null, refundStatus: null, refundAmount: 0, refundedAt: null, invoiceRef: orderId, createdAt: now(), updatedAt: now() };
    if (M.isProduction === false) pay.sandbox = true;
    await col('payments').doc(orderId).set(pay);
    let snap;
    try {
      snap = await M.createSnap({
        transaction_details: { order_id: orderId, gross_amount: amount },
        item_details: [{ id: plan.code, price: amount, quantity: 1, name: plan.name.slice(0, 50) }],
        customer_details: { first_name: String(user.name || '').slice(0, 50), email: normEmail(auth.token && auth.token.email || user.email) },
        callbacks: { finish: (deps.appUrl || '') + '?billing=finish&order=' + encodeURIComponent(orderId) },
        expiry: { unit: 'hour', duration: config.pendingHours },
        custom_field1: uid,
      });
    } catch (e) { await col('payments').doc(orderId).update({ status: 'FAILED', failureReason: 'checkout_error', updatedAt: now() }); throw new BillingError('unavailable', 'Layanan pembayaran tidak dapat dihubungi. Coba lagi.'); }
    await col('payments').doc(orderId).update({ snapToken: snap.token, redirectUrl: snap.redirect_url, updatedAt: now() });
    await logEvents([{ type: 'payment_initiated' }], { userId: uid, subscriptionId, paymentId: orderId, provider: 'midtrans', planCode: plan.code, amount });
    return { orderId, token: snap.token, redirectUrl: snap.redirect_url, amount };
  }

  // Virtual Account: buat transaksi Core API dan kembalikan nomor VA untuk ditampilkan di aplikasi
  async function createVaCharge(auth, data = {}) {
    const uid = needAuth(auth); const M = await sandboxGuard(auth); const config = await getConfig();
    if (!config.va.enabled) throw new BillingError('failed-precondition', 'Pembayaran Virtual Account belum dibuka.');
    const bank = String(data.bank || '').toLowerCase(); if (!config.va.banks.includes(bank)) throw new BillingError('invalid-argument', 'Bank Virtual Account tidak tersedia.');
    const plan = config.plans[String(data.planCode || '')];
    if (!plan || plan.tier !== 'PRO' || !plan.active) throw new BillingError('invalid-argument', 'Paket tidak tersedia.');
    const ud = await col('users').doc(uid).get(); const user = ud.exists ? ud.data() : null;
    if (!user || (!['approved', 'pending'].includes(user.status) && !isAdmin(auth))) throw new BillingError('failed-precondition', 'Akun ditangguhkan atau ditolak admin.');
    const mine = (await col('payments').where('userId', '==', uid).get()).docs.map(d => d.data());
    const open = mine.find(p => p.status === 'PENDING' && p.method === 'va_' + bank && p.planCode === plan.code && p.va && (p.expiresAt || 0) > now() + 10 * 6e4);
    if (open) return { orderId: open.id, amount: open.amount, bank, va: open.va, expiresAt: open.expiresAt, reused: true };
    if (mine.filter(p => p.status === 'PENDING' && p.createdAt > now() - 36e5).length >= 5) throw new BillingError('resource-exhausted', 'Terlalu banyak tagihan tertunda. Selesaikan atau tunggu tagihan sebelumnya kedaluwarsa.');
    const orderId = `WVA-${uid.slice(0, 8)}-${now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`.toUpperCase();
    const amount = plan.price; const hours = config.pendingHours;
    const pay = { id: orderId, userId: uid, subscriptionId: 'web_' + uid, provider: 'midtrans', planCode: plan.code, amount, listPrice: plan.price, currency: 'IDR', status: 'PENDING', method: 'va_' + bank,
      transactionId: null, paidAt: null, refundStatus: null, refundAmount: 0, refundedAt: null, invoiceRef: orderId, expiresAt: now() + hours * 36e5, createdAt: now(), updatedAt: now() };
    if (M.isProduction === false) pay.sandbox = true;
    await col('payments').doc(orderId).set(pay);
    const base = { transaction_details: { order_id: orderId, gross_amount: amount }, item_details: [{ id: plan.code, price: amount, quantity: 1, name: plan.name.slice(0, 50) }],
      customer_details: { first_name: String(user.name || '').slice(0, 50), email: normEmail(auth.token && auth.token.email || user.email) }, custom_expiry: { expiry_duration: hours, unit: 'hour' }, custom_field1: uid };
    const payload = bank === 'mandiri' ? { ...base, payment_type: 'echannel', echannel: { bill_info1: 'Pembayaran', bill_info2: 'WASHLY PRO' } }
      : bank === 'permata' ? { ...base, payment_type: 'permata' } : { ...base, payment_type: 'bank_transfer', bank_transfer: { bank } };
    let r;
    try { r = await M.charge(payload); }
    catch (e) {
      const detail = String(e && e.message || e).slice(0, 300);
      // Core API ditolak (mis. akun belum diizinkan membuat VA langsung) → buat tagihan Snap yang hanya menampilkan VA bank ini
      const SNAP_VA = { bca: 'bca_va', bni: 'bni_va', bri: 'bri_va', permata: 'permata_va', mandiri: 'echannel', cimb: 'cimb_va' };
      try {
        const snap = await M.createSnap({ transaction_details: base.transaction_details, item_details: base.item_details, customer_details: base.customer_details, custom_field1: uid,
          enabled_payments: [SNAP_VA[bank]], callbacks: { finish: (deps.appUrl || '') + '?billing=finish&order=' + encodeURIComponent(orderId) }, expiry: { unit: 'hour', duration: hours } });
        await col('payments').doc(orderId).update({ method: 'snap_va_' + bank, snapToken: snap.token, redirectUrl: snap.redirect_url, chargeError: detail, updatedAt: now() });
        await logEvents([{ type: 'payment_initiated', method: 'snap_va_' + bank }], { userId: uid, subscriptionId: pay.subscriptionId, paymentId: orderId, provider: 'midtrans', planCode: plan.code, amount });
        return { orderId, amount, bank, redirectUrl: snap.redirect_url, token: snap.token, snapFallback: true };
      } catch (e2) {
        const d2 = String(e2 && e2.message || e2).slice(0, 300);
        await col('payments').doc(orderId).update({ status: 'FAILED', failureReason: 'charge_error', chargeError: detail, snapError: d2, updatedAt: now() });
        throw new BillingError('unavailable', 'Virtual Account tidak dapat dibuat saat ini. Coba lagi atau pilih bank lain.' + (isAdmin(auth) ? ` [admin] Midtrans: ${detail} · Snap: ${d2}` : ''));
      }
    }
    const va = bank === 'mandiri' ? { billerCode: r.biller_code, billKey: r.bill_key } : { number: r.permata_va_number || (r.va_numbers && r.va_numbers[0] && r.va_numbers[0].va_number) };
    if (!va.number && !va.billKey) { await col('payments').doc(orderId).update({ status: 'FAILED', failureReason: 'no_va', updatedAt: now() }); throw new BillingError('unavailable', 'Nomor Virtual Account tidak diterima dari bank.'); }
    const exp = Date.parse(String(r.expiry_time || '').replace(' ', 'T') + '+07:00') || pay.expiresAt;
    await col('payments').doc(orderId).update({ va, transactionId: r.transaction_id || null, expiresAt: exp, updatedAt: now() });
    await logEvents([{ type: 'payment_initiated', method: 'va_' + bank }], { userId: uid, subscriptionId: pay.subscriptionId, paymentId: orderId, provider: 'midtrans', planCode: plan.code, amount });
    return { orderId, amount, bank, va, expiresAt: exp };
  }
  function verifyMidtransSignature(n, M = deps.midtrans) {
    if (!n || !n.order_id || !n.status_code || n.gross_amount == null || !n.signature_key) return false;
    const keys = (M.signatureKeys && M.signatureKeys.length) ? M.signatureKeys : [M.serverKey];
    return keys.some(k => safeEq(crypto.createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + k).digest('hex'), String(n.signature_key).toLowerCase()));
  }

  // Terapkan status transaksi yang SUDAH diambil langsung dari API Midtrans.
  async function applyMidtransStatus(st, source) {
    const orderId = st.order_id; const pref = col('payments').doc(orderId);
    const config = await getConfig(); let result = { orderId, changed: false };
    const newStatus = L.midtransPaymentStatus(st); if (newStatus === 'UNKNOWN') return { ...result, ignored: 'status ' + st.transaction_status };
    let after = null;
    await db.runTransaction(async (tx) => {
      const pd = await tx.get(pref); if (!pd.exists) throw new BillingError('not-found', 'Order tidak dikenal: ' + orderId);
      const p = pd.data();
      if (Math.round(Number(st.gross_amount)) !== Math.round(p.amount)) throw new BillingError('failed-precondition', 'Nominal tidak cocok untuk ' + orderId);
      if (st.currency && st.currency !== 'IDR') throw new BillingError('failed-precondition', 'Mata uang tidak cocok');
      const sref = col('subscriptions').doc(p.subscriptionId); const sd = await tx.get(sref); const sub = sd.exists ? { id: sd.id, ...sd.data() } : null;
      const base = { userId: p.userId, subscriptionId: p.subscriptionId, paymentId: orderId, provider: 'midtrans', planCode: p.planCode, source };
      const upd = { status: newStatus, transactionId: st.transaction_id || p.transactionId, method: st.payment_type || p.method, providerStatus: st.transaction_status, updatedAt: now() };
      let events = [], nextSub = null;
      if (newStatus === 'PAID') {
        if (p.status === 'PAID' || p.status === 'REFUNDED') return; // sudah diproses (idempotent)
        const plan = config.plans[p.planCode] || { code: p.planCode, months: 1 };
        const r = L.applyWebPayment(sub, { ...p, id: orderId }, plan, now()); nextSub = p.sandbox ? { ...r.sub, sandbox: true } : { ...r.sub, sandbox: false }; events = r.events;
        upd.paidAt = Date.parse((st.settlement_time || st.transaction_time || '').replace(' ', 'T') + '+07:00') || now();
      } else if (newStatus === 'REFUNDED') {
        if (p.status === 'REFUNDED') return;
        const amt = (st.refunds || []).reduce((a, r) => a + Number(r.refund_amount || 0), 0) || Number(st.refund_amount || 0) || p.amount;
        Object.assign(upd, { refundStatus: amt >= p.amount ? 'FULL' : 'PARTIAL', refundAmount: amt, refundedAt: now() });
        if (amt >= p.amount) { const r = L.refundSub(sub, { ...p, id: orderId }, now()); nextSub = r.sub; events = r.events; } else events = [{ type: 'refund_processed', partial: true }];
      } else if (newStatus === 'PENDING') {
        if (p.status !== 'PENDING') return;
      } else { // FAILED / EXPIRED / CANCELED
        if (p.status !== 'PENDING') return; // jangan menurunkan pembayaran yang sudah lunas
        events = [{ type: 'payment_failed', reason: st.transaction_status }];
      }
      tx.update(pref, upd); if (nextSub) tx.set(sref, nextSub);
      after = { uid: p.userId, events, base, sub: nextSub || sub }; result.changed = true;
    });
    if (after) { await logEvents(after.events, after.base); await recomputeEntitlement(after.uid, config);
      // Pembayaran gagal di checkout web tidak mengubah langganan berjalan; cukup diberi tahu bila memang ada langganan terdampak.
      const ev = after.events.filter(e => e.type !== 'payment_failed' || (after.sub && after.sub.status === 'GRACE_PERIOD'));
      await notifyFor(after.uid, ev, after.sub || {}); }
    return result;
  }

  async function handleMidtransNotification(body) {
    const M = await mt();
    if (!verifyMidtransSignature(body, M)) throw new BillingError('permission-denied', 'Tanda tangan notifikasi tidak valid');
    const key = `midtrans_${body.order_id}_${body.transaction_status}_${body.status_code}_${body.transaction_id || ''}`.replace(/[^\w-]/g, '_').slice(0, 300);
    const wref = col('webhook_events').doc(key);
    const prev = await wref.get();
    if (prev.exists && prev.data().status === 'PROCESSED') return { duplicate: true };
    const payload = { order_id: body.order_id, transaction_status: body.transaction_status, status_code: body.status_code, gross_amount: body.gross_amount, payment_type: body.payment_type, transaction_id: body.transaction_id, fraud_status: body.fraud_status || null };
    await wref.set({ provider: 'midtrans', eventType: body.transaction_status, payload, payloadHash: sha256(JSON.stringify(body)), status: 'RECEIVED', receivedAt: now(), attempts: (prev.exists ? prev.data().attempts || 0 : 0) + 1 });
    try {
      let st = await M.getStatus(body.order_id).catch(e => /\b404\b/.test(String(e.message)) ? null : /\b403\b/.test(String(e.message)) ? 'FORBIDDEN' : Promise.reject(e)); // sumber kebenaran: API status Midtrans
      // Merchant tanpa akses API status (403): pakai isi notifikasi yang tanda tangannya (SHA-512 dengan kunci rahasia) sudah terverifikasi di atas
      if (st === 'FORBIDDEN') st = { ...payload, currency: body.currency };
      if (!st || String(st.status_code) === '404') { await wref.update({ status: 'IGNORED', processedAt: now(), error: 'transaksi tidak dikenal Midtrans (mis. notifikasi uji)' }); return { ignored: 'unknown transaction' }; }
      if (st.order_id !== body.order_id) throw new Error('Status API tidak cocok');
      const r = await applyMidtransStatus(st, 'webhook');
      await wref.update({ status: 'PROCESSED', processedAt: now(), verifiedStatus: st.transaction_status, error: null });
      return r;
    } catch (e) { await wref.update({ status: 'FAILED', processedAt: now(), error: String(e.message || e).slice(0, 500) }); throw e; }
  }

  async function refreshOrder(auth, { orderId } = {}) {
    const uid = needAuth(auth); const pd = await col('payments').doc(String(orderId || '')).get();
    if (!pd.exists || (pd.data().userId !== uid && !isAdmin(auth))) throw new BillingError('not-found', 'Tagihan tidak ditemukan.');
    if (pd.data().provider !== 'midtrans') throw new BillingError('invalid-argument', 'Bukan tagihan web.');
    const st = await (await mt()).getStatus(orderId).catch(() => null);
    if (!st || st.status_code === '404') return { status: pd.data().status };
    await applyMidtransStatus(st, 'poll');
    return { status: (await col('payments').doc(orderId).get()).data().status };
  }

  async function cancelWeb(auth) {
    const uid = needAuth(auth); const sref = col('subscriptions').doc('web_' + uid); const sd = await sref.get();
    if (!sd.exists) throw new BillingError('not-found', 'Tidak ada langganan web aktif.');
    const r = L.cancelSub({ id: sd.id, ...sd.data() }, now()); if (!r.events.length) return { status: sd.data().status };
    await sref.set(r.sub); await logEvents(r.events, { userId: uid, subscriptionId: sd.id, provider: 'midtrans', actor: uid });
    const ent = await recomputeEntitlement(uid); await notifyFor(uid, r.events, r.sub); return { status: r.sub.status, accessUntil: ent.accessUntil };
  }

  /* ---------------- ANDROID: Google Play ---------------- */
  async function applyPlay(uid, token, v2, source) {
    const config = await getConfig(); const tokenHash = sha256(token); const id = 'play_' + tokenHash.slice(0, 40);
    const sref = col('subscriptions').doc(id); const sd = await sref.get(); const prev = sd.exists ? { id, ...sd.data() } : null;
    const r = L.subFromPlay(prev, v2, { config, now: now(), uid, id, tokenHash });
    await sref.set(r.sub);
    // Pembelian pengganti (upgrade/downgrade di Play) menonaktifkan token lama
    if (v2.linkedPurchaseToken) { const oid = 'play_' + sha256(v2.linkedPurchaseToken).slice(0, 40); const od = await col('subscriptions').doc(oid).get();
      if (od.exists && od.data().status !== 'EXPIRED') { await col('subscriptions').doc(oid).update({ status: 'EXPIRED', replacedBy: id, autoRenew: false, updatedAt: now() }); } }
    // Catat transaksi per orderId Play (pembelian awal & tiap perpanjangan memiliki orderId berbeda)
    const paidState = ['ACTIVE', 'CANCELED', 'GRACE_PERIOD'].includes(r.sub.status);
    if (v2.latestOrderId && paidState && r.sub.status !== 'GRACE_PERIOD') {
      const pid = 'play_' + v2.latestOrderId.replace(/[^\w.-]/g, '_'); const pd = await col('payments').doc(pid).get();
      if (!pd.exists) await col('payments').doc(pid).set({ id: pid, userId: uid, subscriptionId: id, provider: 'google_play', planCode: r.plan.code, amount: r.plan.price, amountSource: 'plan_list_price', currency: 'IDR',
        status: 'PAID', method: 'google_play', transactionId: v2.latestOrderId, paidAt: now(), refundStatus: null, refundAmount: 0, refundedAt: null, invoiceRef: v2.latestOrderId, testPurchase: !!v2.testPurchase, createdAt: now(), updatedAt: now() });
    }
    await logEvents(r.events, { userId: uid, subscriptionId: id, provider: 'google_play', planCode: r.plan.code, source });
    // Wajib: akui (acknowledge) pembelian dalam 3 hari, kalau tidak Google me-refund otomatis
    if (v2.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && ['ACTIVE', 'CANCELED', 'GRACE_PERIOD'].includes(r.sub.status))
      await deps.play.acknowledge(r.lineItem.productId, token).then(() => col('subscriptions').doc(id).update({ acknowledged: true })).catch(e => col('subscriptions').doc(id).update({ ackError: String(e.message || e).slice(0, 200) }));
    const ent = await recomputeEntitlement(uid, config); await notifyFor(uid, r.events, r.sub);
    return { subscriptionId: id, status: r.sub.status, entitlement: ent };
  }

  async function playVerify(auth, { purchaseToken, productId } = {}) {
    const uid = needAuth(auth); if (!purchaseToken || typeof purchaseToken !== 'string' || purchaseToken.length > 4096) throw new BillingError('invalid-argument', 'Token pembelian tidak valid.');
    const hash = sha256(purchaseToken); const tref = col('play_tokens').doc(hash); const td = await tref.get();
    if (td.exists && td.data().uid !== uid) throw new BillingError('permission-denied', 'Pembelian ini terhubung ke akun WASHLY lain.');
    let v2; try { v2 = await deps.play.getSubscription(purchaseToken); } catch (e) { throw new BillingError('failed-precondition', 'Google Play menolak token pembelian ini.'); }
    const acct = v2.externalAccountIdentifiers && v2.externalAccountIdentifiers.obfuscatedExternalAccountId;
    if (!td.exists && acct !== accountIdFor(uid)) throw new BillingError('permission-denied', 'Pembelian ini tidak dibuat dari akun WASHLY Anda.');
    if (!td.exists) await tref.set({ uid, token: purchaseToken, productId: productId || null, linkedAt: now() });
    const r = await applyPlay(uid, purchaseToken, v2, td.exists ? 'restore' : 'purchase');
    if (td.exists) await logEvents([{ type: 'subscription_restored_sync' }], { userId: uid, subscriptionId: r.subscriptionId, provider: 'google_play' });
    return r;
  }

  async function handleRtdn(messageId, data) {
    const wref = col('webhook_events').doc('play_' + String(messageId).replace(/[^\w-]/g, '_'));
    const prev = await wref.get(); if (prev.exists && prev.data().status === 'PROCESSED') return { duplicate: true };
    const n = data || {}; const kind = n.subscriptionNotification ? 'subscription' : n.voidedPurchaseNotification ? 'voided' : n.testNotification ? 'test' : 'other';
    const token = (n.subscriptionNotification || n.voidedPurchaseNotification || {}).purchaseToken;
    await wref.set({ provider: 'google_play', eventType: kind + ':' + ((n.subscriptionNotification || {}).notificationType ?? ''), payloadHash: sha256(JSON.stringify(n)), status: 'RECEIVED', receivedAt: now() });
    try {
      if (!token) { await wref.update({ status: 'IGNORED', processedAt: now() }); return { ignored: kind }; }
      const td = await col('play_tokens').doc(sha256(token)).get();
      if (!td.exists) { await wref.update({ status: 'IGNORED', processedAt: now(), error: 'token belum ditautkan ke akun (menunggu verifikasi dari aplikasi)' }); return { ignored: 'unlinked' }; }
      const uid = td.data().uid;
      if (kind === 'voided') {
        const id = 'play_' + sha256(token).slice(0, 40); const sd = await col('subscriptions').doc(id).get();
        const orderId = n.voidedPurchaseNotification.orderId; const pid = orderId ? 'play_' + orderId.replace(/[^\w.-]/g, '_') : null;
        if (pid) { const pd = await col('payments').doc(pid).get(); if (pd.exists && pd.data().status !== 'REFUNDED') await col('payments').doc(pid).update({ status: 'REFUNDED', refundStatus: 'FULL', refundAmount: pd.data().amount, refundedAt: now(), updatedAt: now() }); }
        if (sd.exists) { const r = L.refundSub({ id, ...sd.data() }, { id: pid }, now()); await col('subscriptions').doc(id).set(r.sub); await logEvents(r.events, { userId: uid, subscriptionId: id, provider: 'google_play', paymentId: pid }); await notifyFor(uid, r.events, r.sub); }
        await recomputeEntitlement(uid);
      } else { const v2 = await deps.play.getSubscription(token); await applyPlay(uid, token, v2, 'rtdn'); }
      await wref.update({ status: 'PROCESSED', processedAt: now(), error: null }); return { ok: true };
    } catch (e) { await wref.update({ status: 'FAILED', processedAt: now(), error: String(e.message || e).slice(0, 500) }); throw e; }
  }

  /* ---------------- Pemeriksaan berkala ---------------- */
  async function sweep() {
    const config = await getConfig(); const t = now(); const touched = new Set(); const out = { transitions: 0, reminders: 0, expiredPending: 0, playRechecked: 0 };
    const subs = (await col('subscriptions').where('status', 'in', ['ACTIVE', 'GRACE_PERIOD', 'CANCELED', 'PAST_DUE', 'PENDING']).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    for (const s of subs) {
      if (s.provider === 'google_play') { // cadangan bila RTDN terlewat: cek ulang ke Google bila periode sudah lewat
        if ((s.currentPeriodEnd || 0) < t) { const tk = (await col('play_tokens').where('uid', '==', s.userId).get()).docs.map(d => d.data()).find(x => 'play_' + sha256(x.token).slice(0, 40) === s.id);
          if (tk) try { await applyPlay(s.userId, tk.token, await deps.play.getSubscription(tk.token), 'sweep'); out.playRechecked++; } catch (e) {} }
      } else {
        const r = L.sweepSub(s, config, t);
        if (r.events.length) { await col('subscriptions').doc(s.id).set(r.sub); await logEvents(r.events, { userId: s.userId, subscriptionId: s.id, provider: s.provider, source: 'sweep' }); await notifyFor(s.userId, r.events, r.sub); touched.add(s.userId); out.transitions++; }
      }
      const cur = s;
      if (cur.status === 'ACTIVE' && cur.currentPeriodEnd > t) for (const d of config.reminderDays) {
        const key = `${cur.currentPeriodEnd}:${d}`; if (cur.currentPeriodEnd - t <= d * L.DAY && !(cur.reminded || []).includes(key)) {
          await notifyUser(cur.userId, cur.provider === 'google_play' ? 'upcoming_play' : 'upcoming_web', [fmtDate(cur.currentPeriodEnd)]);
          await col('subscriptions').doc(cur.id).update({ reminded: [...(cur.reminded || []), key].slice(-6) }); cur.reminded = [...(cur.reminded || []), key];
          await logEvents([{ type: 'renewal_reminder_sent', days: d }], { userId: cur.userId, subscriptionId: cur.id, provider: cur.provider }); out.reminders++; break; }
      }
    }
    const pend = (await col('payments').where('status', '==', 'PENDING').get()).docs;
    for (const d of pend) if (d.data().createdAt < t - ((d.data().provider === 'manual' ? config.manual.hours : config.pendingHours) + 1) * 36e5) { await d.ref.update({ status: 'EXPIRED', updatedAt: t, failureReason: 'not_paid' }); out.expiredPending++; }
    for (const uid of touched) await recomputeEntitlement(uid, config);
    // Hitung ulang pemakaian proyek cloud (batas paket FREE ditegakkan oleh firestore.rules dari dokumen ini)
    const users = (await col('users').get()).docs; for (const u of users) await recountUsage(u.id);
    return out;
  }
  async function recountUsage(uid) {
    const n = (await col('projects').where('ownerUid', '==', uid).get()).docs.length;
    await col('usage').doc(uid).set({ cloudProjects: n, updatedAt: now() }); return n;
  }

  /* ---------------- Admin ---------------- */
  async function audit(auth, action, target, reason, data) {
    await col('admin_audit').add({ actorUid: auth.uid, actorEmail: normEmail(auth.token.email), action, target, reason, data: data || null, at: now() });
  }
  async function adminMetrics(auth, { from, to, granularity } = {}) {
    needAdmin(auth); const t = Number(to) || now(); const f = Number(from) || t - 30 * L.DAY;
    if (!(f < t) || t - f > 3 * 366 * L.DAY) throw new BillingError('invalid-argument', 'Rentang tanggal tidak valid (maks. 3 tahun).');
    const g = ['day', 'week', 'month', 'year'].includes(granularity) ? granularity : 'day';
    const [users, subs, payments, events] = await Promise.all(['users', 'subscriptions', 'payments', 'subscription_events'].map(c => col(c).get().then(q => q.docs.map(d => ({ id: d.id, uid: d.id, ...d.data() })))));
    return computeMetrics({ users, subs, payments, events }, await getConfig(), { from: f, to: t, granularity: g });
  }
  async function adminUsers(auth, { q = '', status = '' } = {}) {
    needAdmin(auth); const qq = String(q).toLowerCase().slice(0, 100);
    const [users, ents] = await Promise.all([col('users').get(), col('entitlements').get()]); const em = {}; ents.docs.forEach(d => { em[d.id] = d.data(); });
    return users.docs.map(d => { const u = d.data(); const e = em[d.id] || null; return { uid: d.id, name: u.name || '', email: u.email || '', tier: e ? e.tier : 'FREE', status: e ? e.status : 'FREE', planCode: e ? e.planCode : 'FREE', provider: e ? e.provider : null, accessUntil: e ? e.accessUntil : null, autoRenew: e ? e.autoRenew : false }; })
      .filter(u => (!qq || (u.name + ' ' + u.email).toLowerCase().includes(qq)) && (!status || u.tier === status || u.status === status)).slice(0, 500);
  }
  async function adminUserDetail(auth, { uid } = {}) {
    needAdmin(auth); if (!uid) throw new BillingError('invalid-argument', 'uid wajib');
    const get = async (c) => (await col(c).where('userId', '==', uid).get()).docs.map(d => ({ id: d.id, ...d.data() }));
    const [u, e, subs, payments, events] = await Promise.all([col('users').doc(uid).get(), col('entitlements').doc(uid).get(), get('subscriptions'), get('payments'), get('subscription_events')]);
    const strip = (p) => { const { snapToken, ...rest } = p; return rest; };
    return { user: u.exists ? { uid, name: u.data().name, email: u.data().email } : null, entitlement: e.exists ? e.data() : null, subscriptions: subs.map(s => { const { purchaseTokenHash, ...r } = s; return r; }),
      payments: payments.map(strip).sort((a, b) => b.createdAt - a.createdAt), events: events.sort((a, b) => b.at - a.at).slice(0, 200) };
  }
  async function adminGrant(auth, { uid, planCode, months, reason } = {}) {
    needAdmin(auth); const config = await getConfig(); const plan = config.plans[planCode];
    if (!uid || !plan || plan.tier !== 'PRO') throw new BillingError('invalid-argument', 'Pengguna/paket tidak valid.');
    const m = Number(months); if (!Number.isInteger(m) || m < 1 || m > 36) throw new BillingError('invalid-argument', 'Lama 1–36 bulan.');
    if (!reason || String(reason).trim().length < 5) throw new BillingError('invalid-argument', 'Alasan wajib diisi (min. 5 karakter).');
    if (!(await col('users').doc(uid).get()).exists) throw new BillingError('not-found', 'Pengguna tidak ditemukan.');
    const id = 'admin_' + uid + '_' + now().toString(36); const t = now();
    const sub = { id, subjectType: 'user', subjectId: uid, userId: uid, orgId: null, seats: 1, provider: 'admin', planCode, planMonths: plan.months, status: 'ACTIVE', autoRenew: false, renewalMode: 'none',
      startedAt: t, currentPeriodStart: t, currentPeriodEnd: L.addMonths(t, m), nextRenewalAt: null, canceledAt: null, graceEndsAt: null, grantedBy: auth.uid, grantReason: String(reason).slice(0, 300), createdAt: t, updatedAt: t };
    await col('subscriptions').doc(id).set(sub);
    await logEvents([{ type: 'subscription_created', manual: true }], { userId: uid, subscriptionId: id, provider: 'admin', actor: auth.uid, reason: sub.grantReason });
    await audit(auth, 'grant', uid, sub.grantReason, { planCode, months: m, subscriptionId: id });
    await notifyUser(uid, 'activated'); return { subscriptionId: id, entitlement: await recomputeEntitlement(uid, config) };
  }
  async function adminRevoke(auth, { subscriptionId, reason } = {}) {
    needAdmin(auth); if (!reason || String(reason).trim().length < 5) throw new BillingError('invalid-argument', 'Alasan wajib diisi (min. 5 karakter).');
    const sref = col('subscriptions').doc(String(subscriptionId || '')); const sd = await sref.get(); if (!sd.exists) throw new BillingError('not-found', 'Langganan tidak ditemukan.');
    const s = sd.data(); if (s.provider !== 'admin') throw new BillingError('failed-precondition', 'Langganan berbayar dibatalkan/refund lewat penyedia pembayaran (Midtrans / Play Console), bukan diubah manual.');
    await sref.update({ status: 'EXPIRED', currentPeriodEnd: Math.min(s.currentPeriodEnd, now()), updatedAt: now(), revokedBy: auth.uid, revokeReason: String(reason).slice(0, 300) });
    await logEvents([{ type: 'subscription_expired', manual: true }], { userId: s.userId, subscriptionId: sd.id, provider: 'admin', actor: auth.uid, reason: String(reason).slice(0, 300) });
    await audit(auth, 'revoke', s.userId, String(reason).slice(0, 300), { subscriptionId: sd.id });
    return { entitlement: await recomputeEntitlement(s.userId) };
  }
  async function adminSaveConfig(auth, { config, reason } = {}) {
    needAdmin(auth); const v = validateConfig(config); if (!v.ok) throw new BillingError('invalid-argument', v.errors.join('; '));
    const before = await getConfig();
    await col('billing_config').doc('main').set({ ...v.config, midtrans: before.midtrans || null, updatedAt: now(), updatedBy: auth.uid });
    await audit(auth, 'config', 'billing_config/main', String(reason || '').slice(0, 300), { before: { enforce: before.enforce, plans: before.plans, freeLimits: before.freeLimits }, after: { enforce: v.config.enforce, plans: v.config.plans, freeLimits: v.config.freeLimits } });
    // Hak akses semua pengguna dihitung ulang (fitur per paket bisa berubah)
    const users = (await col('users').get()).docs; for (const u of users) await recomputeEntitlement(u.id, v.config);
    return { config: v.config };
  }
  /* ---------------- WEB: transfer bank / QRIS manual (konfirmasi admin) ---------------- */
  async function notifyAdmins(title, body) {
    for (const email of (deps.adminEmails || []).map(normEmail)) await col('notifications').add({ toEmail: email, toUid: '', title, body, kind: 'billing', projectId: '', fromUid: '', fromName: 'WASHLY', read: false, at: deps.ts ? deps.ts(now()) : now() });
  }
  async function createManualOrder(auth, data = {}) {
    const uid = needAuth(auth); const config = await getConfig(); const M = config.manual;
    if (!M.enabled) throw new BillingError('failed-precondition', 'Pembayaran transfer belum dibuka.');
    const plan = config.plans[String(data.planCode || '')];
    if (!plan || plan.tier !== 'PRO' || !plan.active) throw new BillingError('invalid-argument', 'Paket tidak tersedia.');
    const ud = await col('users').doc(uid).get(); const user = ud.exists ? ud.data() : null;
    if (!user || (!['approved', 'pending'].includes(user.status) && !isAdmin(auth))) throw new BillingError('failed-precondition', 'Akun ditangguhkan atau ditolak admin.');
    const mine = (await col('payments').where('userId', '==', uid).get()).docs.map(d => d.data());
    const open = mine.find(p => p.status === 'PENDING' && p.provider === 'manual' && p.planCode === plan.code);
    if (open) return { orderId: open.id, amount: open.amount, uniqueCode: open.uniqueCode, expiresAt: open.expiresAt, reused: true };
    if (mine.filter(p => p.status === 'PENDING' && p.createdAt > now() - 864e5).length >= 5) throw new BillingError('resource-exhausted', 'Terlalu banyak tagihan tertunda. Selesaikan atau tunggu tagihan sebelumnya kedaluwarsa.');
    // Kode unik 1–499 rupiah memudahkan admin mencocokkan transfer di mutasi rekening
    const taken = new Set((await col('payments').where('status', '==', 'PENDING').get()).docs.map(d => d.data()).filter(p => p.provider === 'manual').map(p => p.amount));
    let code = 0; for (let i = 0; i < 40 && !code; i++) { const c = 1 + crypto.randomInt(499); if (!taken.has(plan.price + c)) code = c; }
    if (!code) code = 1 + crypto.randomInt(499);
    const orderId = `TRF-${uid.slice(0, 6)}-${now().toString(36)}`.toUpperCase();
    const pay = { id: orderId, userId: uid, userEmail: normEmail(auth.token && auth.token.email || user.email), userName: String(user.name || '').slice(0, 80), subscriptionId: 'web_' + uid, provider: 'manual', planCode: plan.code,
      amount: plan.price + code, listPrice: plan.price, uniqueCode: code, currency: 'IDR', status: 'PENDING', method: 'bank_transfer', transactionId: null, paidAt: null, refundStatus: null, refundAmount: 0, refundedAt: null,
      invoiceRef: orderId, proof: false, expiresAt: now() + M.hours * 36e5, createdAt: now(), updatedAt: now() };
    await col('payments').doc(orderId).set(pay);
    await logEvents([{ type: 'payment_initiated' }], { userId: uid, subscriptionId: pay.subscriptionId, paymentId: orderId, provider: 'manual', planCode: plan.code, amount: pay.amount });
    return { orderId, amount: pay.amount, uniqueCode: code, expiresAt: pay.expiresAt };
  }
  async function submitManualProof(auth, data = {}) {
    const uid = needAuth(auth); const orderId = String(data.orderId || ''); const pref = col('payments').doc(orderId); const pd = await pref.get();
    if (!pd.exists || pd.data().userId !== uid || pd.data().provider !== 'manual') throw new BillingError('not-found', 'Tagihan tidak ditemukan.');
    if (pd.data().status !== 'PENDING') throw new BillingError('failed-precondition', 'Tagihan ini sudah diproses.');
    const img = typeof data.image === 'string' ? data.image : '';
    if (img && (!/^data:image\/(png|jpeg|webp);base64,/.test(img) || img.length > 700000)) throw new BillingError('invalid-argument', 'Bukti harus gambar PNG/JPG maks. ±500 KB.');
    const senderName = String(data.senderName || '').trim().slice(0, 80), senderBank = String(data.senderBank || '').trim().slice(0, 60);
    if (!senderName) throw new BillingError('invalid-argument', 'Isi nama pemilik rekening pengirim.');
    await col('payment_proofs').doc(orderId).set({ userId: uid, image: img, senderName, senderBank, note: String(data.note || '').slice(0, 300), at: now() });
    await pref.update({ proof: true, proofAt: now(), senderName, senderBank, updatedAt: now() });
    const p = pd.data();
    await notifyAdmins('Konfirmasi transfer WASHLY PRO', `${p.userName || p.userEmail} melaporkan transfer Rp ${p.amount.toLocaleString('id-ID')} (${p.planCode}) dari ${senderName}${senderBank ? ' / ' + senderBank : ''}. Cek mutasi rekening lalu konfirmasi di Pendapatan → Konfirmasi transfer.`);
    return { ok: true };
  }
  async function adminManualList(auth, { status = 'PENDING' } = {}) {
    needAdmin(auth);
    const ps = (await col('payments').where('provider', '==', 'manual').get()).docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(p => status === 'ALL' || p.status === status).sort((a, b) => (b.proofAt || b.createdAt) - (a.proofAt || a.createdAt)).slice(0, 100);
    for (const p of ps) { const pr = await col('payment_proofs').doc(p.id).get(); p.proofData = pr.exists ? pr.data() : null; }
    return ps;
  }
  async function adminManualDecide(auth, { orderId, decision, reason } = {}) {
    needAdmin(auth); if (!['approve', 'reject'].includes(decision)) throw new BillingError('invalid-argument', 'Keputusan tidak valid.');
    if (decision === 'reject' && String(reason || '').trim().length < 5) throw new BillingError('invalid-argument', 'Alasan penolakan wajib diisi (min. 5 karakter).');
    const config = await getConfig(); const pref = col('payments').doc(String(orderId || '')); let after = null;
    await db.runTransaction(async (tx) => {
      const pd = await tx.get(pref); if (!pd.exists || pd.data().provider !== 'manual') throw new BillingError('not-found', 'Tagihan tidak ditemukan.');
      const p = pd.data(); if (p.status !== 'PENDING' && !(p.status === 'EXPIRED' && decision === 'approve')) throw new BillingError('failed-precondition', 'Tagihan ini sudah diproses (' + p.status + ').');
      const base = { userId: p.userId, subscriptionId: p.subscriptionId, paymentId: p.id, provider: 'manual', planCode: p.planCode, actor: auth.uid };
      if (decision === 'reject') { tx.update(pref, { status: 'FAILED', failureReason: String(reason).slice(0, 300), decidedBy: auth.uid, decidedAt: now(), updatedAt: now() }); after = { uid: p.userId, events: [{ type: 'payment_failed', reason: 'ditolak admin: ' + String(reason).slice(0, 200) }], base, reject: true }; return; }
      const sref = col('subscriptions').doc(p.subscriptionId); const sd = await tx.get(sref); const sub = sd.exists ? { id: sd.id, ...sd.data() } : null;
      const plan = config.plans[p.planCode] || { code: p.planCode, months: 1 };
      const r = L.applyWebPayment(sub, { ...p, id: p.id, provider: 'manual' }, plan, now());
      tx.update(pref, { status: 'PAID', paidAt: now(), transactionId: 'manual-' + p.id, confirmedBy: auth.uid, confirmedByEmail: normEmail(auth.token.email), decidedAt: now(), updatedAt: now() });
      tx.set(sref, r.sub); after = { uid: p.userId, events: r.events, base, sub: r.sub };
    });
    await logEvents(after.events, after.base);
    await audit(auth, decision === 'approve' ? 'manual_confirm' : 'manual_reject', after.uid, String(reason || '').slice(0, 300), { orderId });
    const ent = await recomputeEntitlement(after.uid, config);
    if (after.reject) await notifyUser(after.uid, 'manual_rejected', [String(reason).slice(0, 200)]); else await notifyFor(after.uid, after.events, after.sub);
    return { status: decision === 'approve' ? 'PAID' : 'FAILED', entitlement: ent };
  }
  async function adminGetMidtrans(auth) {
    needAdmin(auth); const d = await col('billing_secrets').doc('midtrans').get(); const x = d.exists ? d.data() : null;
    const hint = (k) => k ? '…' + String(k).slice(-4) : null;
    return x && x.serverKey ? { configured: true, mode: x.mode, serverKeyHint: hint(x.serverKey), signatureKeyHint: hint(x.signatureKey), updatedAt: x.updatedAt, lastCheck: x.lastCheck || null } : { configured: false };
  }
  async function adminSetMidtrans(auth, data = {}) {
    needAdmin(auth); if (!deps.midtransFactory) throw new BillingError('failed-precondition', 'Server belum mendukung pengaturan Midtrans dari aplikasi.');
    const mode = data.mode === 'production' ? 'production' : 'sandbox';
    // buang spasi, baris baru & karakter tak terlihat yang sering ikut tersalin dari dashboard
    const clean = (v) => String(v || '').replace(/[\s\u200B-\u200D\uFEFF\u00A0]+/g, '').replace(/^["'`]+|["'`]+$/g, '');
    const serverKey = clean(data.serverKey), signatureKey = clean(data.signatureKey);
    if (/^(SB-)?Mid-client-/i.test(serverKey)) throw new BillingError('invalid-argument', 'Yang ditempel adalah Client Key (diawali "Mid-client-"). Kolom pertama harus diisi Server Key dari bagian Server Keys → Generate server key.');
    if (/^(SB-)?Mid-client-|^(SB-)?Mid-server-/i.test(signatureKey) && signatureKey === serverKey) throw new BillingError('invalid-argument', 'Kolom Signature Secret Key berisi kunci yang sama dengan Server Key. Salin dari baris "Signature Secret Key", atau kosongkan kolom itu.');
    // Format kunci Midtrans bisa berubah (kunci baru hasil "Generate server key"): cukup cek wajar, kebenarannya diuji langsung ke Midtrans
    if (serverKey.length < 16 || serverKey.length > 300 || !/^[\x21-\x7E]+$/.test(serverKey)) throw new BillingError('invalid-argument', 'Server Key tidak dikenali. Salin dari Midtrans → Settings → Access Keys → General Credentials → Server Keys (diawali "SB-Mid-server-" untuk Sandbox atau "Mid-server-" untuk Production).');
    if (mode === 'sandbox' && /^Mid-server-/.test(serverKey)) throw new BillingError('invalid-argument', 'Mode Sandbox memerlukan Server Key Sandbox (diawali "SB-Mid-server-"). Pastikan Environment di dashboard Midtrans: Sandbox.');
    if (mode === 'production' && serverKey.startsWith('SB-')) throw new BillingError('invalid-argument', 'Ini Server Key Sandbox. Untuk Production, ganti Environment di dashboard Midtrans ke Production lalu salin Server Key Production.');
    if (signatureKey && (signatureKey.length < 10 || signatureKey.length > 300 || !/^[\x21-\x7E]+$/.test(signatureKey))) throw new BillingError('invalid-argument', 'Signature Secret Key tidak dikenali. Salin dari baris "Signature Secret Key" (ikon salin).');
    // Uji ke Midtrans: kunci yang benar menjawab 404 (order uji memang tidak ada), kunci salah menjawab 401
    const client = deps.midtransFactory({ serverKey, signatureKey, isProduction: mode === 'production' });
    let ping = await client.ping().catch(e => ({ ok: false, error: String(e.message || e) }));
    let coreApi = true, coreNote = null;
    // 403 di API status = kunci dikenali tetapi akses Core API dibatasi untuk merchant ini → uji lewat Snap (halaman pembayaran Midtrans)
    if (!ping.ok && !ping.unauthorized && client.pingSnap) {
      const sp = await client.pingSnap().catch(e => ({ ok: false, error: String(e.message || e) }));
      if (sp.ok) { coreApi = false; coreNote = `API status/Core API menjawab HTTP ${ping.http || ping.code}${ping.message ? ' "' + ping.message + '"' : ''}`; ping = { ok: true }; }
      else if (sp.unauthorized) ping = { ok: false, unauthorized: true, http: 401, message: sp.message };
      else ping = { ...ping, message: [ping.message, 'Snap: HTTP ' + (sp.http || sp.error || '-') + (sp.message ? ' "' + sp.message + '"' : '')].filter(Boolean).join(' · ') };
    }
    if (!ping.ok && ping.unauthorized) {
      // Cek silang: kunci yang ditolak di satu lingkungan sering kali kunci dari lingkungan lain (format kunci baru tidak selalu berawalan "SB-")
      const other = mode === 'production' ? 'sandbox' : 'production', OtherName = other === 'production' ? 'Production' : 'Sandbox', Name = mode === 'production' ? 'Production' : 'Sandbox';
      const alt = await deps.midtransFactory({ serverKey, signatureKey, isProduction: other === 'production' }).ping().catch(() => ({ ok: false }));
      if (alt.ok) throw new BillingError('failed-precondition', `Server Key ini adalah kunci ${OtherName}, bukan ${Name}. Di dashboard Midtrans, ganti Environment (kiri atas) ke ${Name}, lalu salin Server Key dari Settings → Access Keys. Atau pilih "${OtherName}" di atas bila memang ingin memakai ${OtherName}.`);
      const pre = (serverKey.match(/^(SB-)?Mid-server-/i) || [''])[0];
      const diag = `Diagnosis: kunci yang diterima server ${serverKey.length} karakter, ${pre ? 'diawali "' + pre + '"' : 'TIDAK diawali "Mid-server-"'}${signatureKey && signatureKey === serverKey ? ', sama dengan Signature Secret Key' : ''}. Jawaban Midtrans ${Name}: HTTP ${ping.http || ping.code}${ping.message ? ' "' + ping.message + '"' : ''}; ${OtherName}: HTTP ${alt.http || alt.code || '-'}${alt.message ? ' "' + alt.message + '"' : ''}.`;
      throw new BillingError('failed-precondition', `Midtrans menolak Server Key ini (401). Kunci tidak dikenali di Production maupun Sandbox: kemungkinan tersalin tidak utuh, sudah dihapus/diganti di dashboard, atau yang tersalin bukan Server Key. Salin ulang dengan ikon salin di Settings → Access Keys → Server Keys. ${diag}`);
    }
    if (!ping.ok) throw new BillingError('failed-precondition', 'Tidak dapat menghubungi Midtrans: ' + (ping.error || ('HTTP ' + (ping.http || ping.code))) + (ping.message ? ' — ' + ping.message : ''));
    const t = now();
    await col('billing_secrets').doc('midtrans').set({ serverKey, signatureKey: signatureKey || null, mode, updatedAt: t, updatedBy: auth.uid, lastCheck: { at: t, ok: true, coreApi, note: coreNote } });
    // Jangan pernah membuat dokumen konfigurasi setengah jadi (tanpa 'enforce' → pembatasan FREE dianggap mati)
    const cref = col('billing_config').doc('main'); const cd = await cref.get();
    // Core API (Virtual Account langsung di aplikasi) tidak diizinkan untuk merchant ini → matikan VA di aplikasi; pengguna tetap bisa memilih VA di halaman pembayaran Midtrans (Snap)
    const vaPatch = coreApi ? {} : { va: { ...((await getConfig()).va || {}), enabled: false } };
    if (cd.exists) await cref.set({ midtrans: { configured: true, mode, coreApi, updatedAt: t }, ...vaPatch }, { merge: true });
    else await cref.set({ ...(await getConfig()), enforce: true, midtrans: { configured: true, mode, coreApi, updatedAt: t }, ...vaPatch, updatedAt: t, updatedBy: auth.uid });
    mtCache = null;
    await audit(auth, 'midtrans_keys', 'billing_secrets/midtrans', 'Kunci Midtrans diperbarui', { mode, serverKeyHint: '…' + serverKey.slice(-4), signature: !!signatureKey });
    return { ok: true, mode, coreApi, note: coreNote, serverKeyHint: '…' + serverKey.slice(-4), signatureKeyHint: signatureKey ? '…' + signatureKey.slice(-4) : null };
  }
  // Pemilik PRO mencari anggota tim proyek lewat e-mail (daftar pengguna tidak lagi terbuka untuk semua akun)
  async function findProjectMember(auth, { email } = {}) {
    const uid = needAuth(auth); const e = normEmail(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new BillingError('invalid-argument', 'Tulis alamat e-mail yang lengkap, misalnya nama@contoh.com.');
    if (!isAdmin(auth)) {
      const config = await getConfig();
      if (config.enforce) { const d = await col('entitlements').doc(uid).get(); const ent = d.exists ? d.data() : null;
        if (!(ent && ent.tier === 'PRO' && +ent.accessUntil > now())) throw new BillingError('permission-denied', 'Menentukan tim proyek sendiri adalah fitur WASHLY PRO.'); }
    }
    const q = await col('users').where('email', '==', e).get();
    if (q.empty) throw new BillingError('not-found', 'Belum ada akun WASHLY dengan e-mail itu. Minta orang tersebut mendaftar dulu (gratis), lalu coba lagi.');
    const d = q.docs[0]; const x = d.data();
    if (!['approved', 'pending'].includes(x.status)) throw new BillingError('failed-precondition', 'Akun dengan e-mail itu sedang tidak aktif.');
    const ed = await col('entitlements').doc(d.id).get(); const ex = ed.exists ? ed.data() : null;
    const plan = ex && ex.tier === 'PRO' && +ex.accessUntil > now() ? 'PRO' : 'FREE'; // anggota FREE ikut bekerja dengan fitur FREE
    return { uid: d.id, email: e, name: x.name || e, role: x.role || '', plan };
  }
  // Hapus akun sendiri (wajib Google Play). Lewat server karena pemilik FREE tidak boleh menghapus proyek satu per satu
  // (kuota proyek FREE permanen). Wajib login ulang < 10 menit sebelumnya.
  async function deleteMyAccount(auth, { withProjects } = {}) {
    const uid = needAuth(auth); const at = +((auth.token && auth.token.auth_time) || 0) * 1000;
    if (!at || now() - at > 10 * 60e3) throw new BillingError('failed-precondition', 'Demi keamanan, masukkan ulang kata sandi Anda lalu coba lagi.');
    const del = async (c, id) => { await col(c).doc(id).delete(); }; let projects = 0;
    if (withProjects) {
      const ps = await col('projects').where('ownerUid', '==', uid).get();
      for (const d of ps.docs) { await del('projectData', d.id); await del('projectNet', d.id); await del('projects', d.id); projects++; }
      const ph = await col('photos').where('ownerUid', '==', uid).get(); for (const d of ph.docs) await del('photos', d.id);
    }
    const email = normEmail(auth.token && auth.token.email);
    if (email) { const n = await col('notifications').where('toEmail', '==', email).get(); for (const d of n.docs) await del('notifications', d.id); }
    await del('profiles', uid); await del('users', uid);
    if (deps.deleteAuthUser) await deps.deleteAuthUser(uid);
    return { ok: true, projects };
  }
  async function myAccountId(auth) { return { accountId: accountIdFor(needAuth(auth)) }; }
  async function refreshMe(auth) { const uid = needAuth(auth); return { entitlement: await recomputeEntitlement(uid) }; }

  return { BillingError, getConfig, recomputeEntitlement, recountUsage, createCheckout, verifyMidtransSignature, handleMidtransNotification, applyMidtransStatus, refreshOrder, cancelWeb,
    playVerify, handleRtdn, sweep, adminGetMidtrans, adminSetMidtrans, createVaCharge, createManualOrder, submitManualProof, adminManualList, adminManualDecide, adminMetrics, adminUsers, adminUserDetail, adminGrant, adminRevoke, adminSaveConfig, myAccountId, refreshMe, findProjectMember, deleteMyAccount, isAdmin };
}

module.exports = { makeService, BillingError, accountIdFor, sha256 };
