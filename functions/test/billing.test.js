'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { makeDb } = require('./fake-db');
const { makeService, accountIdFor, sha256 } = require('../src/service');
const { DEFAULT_CONFIG, validateConfig } = require('../src/config');
const { computeMetrics } = require('../src/metrics');
const L = require('../src/lifecycle');

const DAY = 864e5; const T0 = Date.UTC(2026, 0, 10, 3, 0, 0);
const SERVER_KEY = 'SB-Mid-server-TEST';
const sign = (n) => crypto.createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + SERVER_KEY).digest('hex');

function setup({ enforce = true } = {}) {
  const db = makeDb(); const clock = { t: T0 };
  const mid = { statuses: {}, created: [] }; const play = { subs: {}, acks: [] }; const pushes = [];
  const s = makeService({
    db, now: () => clock.t, ts: (ms) => new Date(ms), adminEmails: ['boss@x.org'], appUrl: 'https://app/', ntfyTopic: 'wtest', fetch: async (u, o) => { pushes.push(JSON.parse(o.body)); return { ok: true }; },
    midtrans: { serverKey: SERVER_KEY, createSnap: async (p) => { mid.created.push(p); return { token: 'tok-' + p.transaction_details.order_id, redirect_url: 'https://pay/' + p.transaction_details.order_id }; }, getStatus: async (id) => mid.statuses[id] },
    play: { packageName: 'com.washly.app', getSubscription: async (tk) => { if (!play.subs[tk]) throw new Error('404'); return play.subs[tk]; }, acknowledge: async (pid, tk) => { play.acks.push(tk); } },
  });
  const seedUser = async (uid, email, status = 'approved') => db.collection('users').doc(uid).set({ email, name: uid.toUpperCase(), status, createdAt: T0 - 30 * DAY });
  const auth = (uid, email, verified = true) => ({ uid, token: { email, email_verified: verified } });
  const midSettle = (orderId, amount, extra = {}) => { const n = { order_id: orderId, status_code: '200', gross_amount: amount.toFixed(2), transaction_status: 'settlement', transaction_id: 'trx-' + orderId, payment_type: 'qris', currency: 'IDR', settlement_time: '2026-01-10 10:05:00', ...extra }; mid.statuses[orderId] = n; return { ...n, signature_key: sign(n) }; };
  const ent = async (uid) => (await db.collection('entitlements').doc(uid).get()).data();
  if (enforce) db.collection('billing_config').doc('main').set({ ...DEFAULT_CONFIG, enforce: true });
  return { db, s, clock, mid, play, pushes, seedUser, auth, midSettle, ent };
}

test('konfigurasi: harga & paket divalidasi', () => {
  assert.equal(validateConfig(DEFAULT_CONFIG).ok, true);
  const bad = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); bad.plans.PRO_MONTHLY.price = -5; bad.plans.PRO_YEARLY.price = 'x';
  const v = validateConfig(bad); assert.equal(v.ok, false); assert.ok(v.errors.some(e => e.includes('PRO_MONTHLY.price')));
  const noPro = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); noPro.plans.PRO_MONTHLY.active = false; noPro.plans.PRO_YEARLY.active = false;
  assert.equal(validateConfig(noPro).ok, false);
});

test('checkout web: butuh login, akun disetujui, paket valid; tagihan PENDING tanpa mengaktifkan PRO', async () => {
  const { s, seedUser, auth, db, ent } = setup();
  await assert.rejects(s.createCheckout(null, { planCode: 'PRO_MONTHLY' }), { code: 'unauthenticated' });
  await seedUser('u1', 'u1@x.org', 'pending');
  await assert.rejects(s.createCheckout(auth('u1', 'u1@x.org'), { planCode: 'PRO_MONTHLY' }), { code: 'failed-precondition' });
  await seedUser('u2', 'u2@x.org');
  await assert.rejects(s.createCheckout(auth('u2', 'u2@x.org'), { planCode: 'FREE' }), { code: 'invalid-argument' });
  const r = await s.createCheckout(auth('u2', 'u2@x.org'), { planCode: 'PRO_MONTHLY' });
  assert.match(r.redirectUrl, /^https:\/\/pay\//); assert.equal(r.amount, 125000);
  const p = (await db.collection('payments').doc(r.orderId).get()).data();
  assert.equal(p.status, 'PENDING'); assert.equal(p.userId, 'u2'); assert.equal(await ent('u2'), undefined);
});

test('checkout web: batas 5 tagihan tertunda per jam', async () => {
  const { s, seedUser, auth } = setup(); await seedUser('u', 'u@x.org');
  for (let i = 0; i < 5; i++) await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' });
  await assert.rejects(s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' }), { code: 'resource-exhausted' });
});

test('webhook Midtrans: tanda tangan salah ditolak, tidak ada aktivasi', async () => {
  const { s, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org');
  const { orderId } = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' });
  const n = midSettle(orderId, 125000); n.signature_key = 'f'.repeat(128);
  await assert.rejects(s.handleMidtransNotification(n), { code: 'permission-denied' });
  assert.equal(await ent('u'), undefined);
});

test('webhook Midtrans: lunas → PRO aktif 1 bulan, notifikasi, duplikat tidak memperpanjang dua kali', async () => {
  const { s, db, seedUser, auth, midSettle, ent, pushes } = setup(); await seedUser('u', 'u@x.org');
  const { orderId } = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' });
  const n = midSettle(orderId, 125000);
  const r1 = await s.handleMidtransNotification(n); assert.equal(r1.changed, true);
  const e = await ent('u'); assert.equal(e.tier, 'PRO'); assert.equal(e.planCode, 'PRO_MONTHLY'); assert.equal(e.features.ded_print, true);
  assert.equal(e.accessUntil, L.addMonths(T0, 1));
  const p = (await db.collection('payments').doc(orderId).get()).data(); assert.equal(p.status, 'PAID'); assert.equal(p.method, 'qris');
  const notes = (await db.collection('notifications').get()).docs.map(d => d.data()); assert.ok(notes.some(x => x.toEmail === 'u@x.org' && /Selamat datang di WASHLY PRO/.test(x.body)));
  assert.ok(pushes.length >= 1 && !JSON.stringify(pushes).includes('u@x.org'), 'push ntfy tanpa email');
  const r2 = await s.handleMidtransNotification(n); assert.equal(r2.duplicate, true);
  // notifikasi berbeda (mis. dikirim ulang dengan transaction_id lain) tetap tidak memperpanjang karena pembayaran sudah PAID
  const n3 = { ...n, transaction_id: 'other' }; n3.signature_key = sign(n3); await s.handleMidtransNotification(n3);
  assert.equal((await ent('u')).accessUntil, L.addMonths(T0, 1));
  const evs = (await db.collection('subscription_events').get()).docs.map(d => d.data().type);
  assert.equal(evs.filter(t => t === 'subscription_created').length, 1);
});

test('webhook Midtrans: isi notifikasi tidak dipercaya — status diambil dari API Midtrans', async () => {
  const { s, mid, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org');
  const { orderId } = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' });
  const n = midSettle(orderId, 125000); mid.statuses[orderId] = { ...mid.statuses[orderId], transaction_status: 'pending', status_code: '201' };
  await s.handleMidtransNotification(n); const e = await ent('u'); assert.ok(!e || e.tier === 'FREE');
});

test('webhook Midtrans: nominal tidak cocok ditolak', async () => {
  const { s, mid, db, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org');
  const { orderId } = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_YEARLY' });
  const n = midSettle(orderId, 1000); // penyerang membuat transaksi Rp1.000 dengan order_id yang sama
  await assert.rejects(s.handleMidtransNotification(n)); assert.equal(await ent('u'), undefined);
  assert.equal((await db.collection('payments').doc(orderId).get()).data().status, 'PENDING');
  assert.equal((await db.collection('webhook_events').get()).docs[0].data().status, 'FAILED');
});

test('pembayaran gagal / kedaluwarsa: tetap FREE, tagihan EXPIRED', async () => {
  const { s, db, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org');
  const { orderId } = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' });
  const n = midSettle(orderId, 125000, { transaction_status: 'expire', status_code: '407' }); n.signature_key = sign({ ...n });
  await s.handleMidtransNotification(n);
  assert.equal((await db.collection('payments').doc(orderId).get()).data().status, 'EXPIRED');
  assert.ok(!(await ent('u')) || (await ent('u')).tier === 'FREE');
  // bayar ulang (retry) dengan tagihan baru → aktif
  const r2 = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' });
  await s.handleMidtransNotification(midSettle(r2.orderId, 125000)); assert.equal((await ent('u')).tier, 'PRO');
});

test('upgrade bulanan → tahunan ditumpuk setelah periode berjalan', async () => {
  const { s, db, clock, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org');
  const a = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' }); await s.handleMidtransNotification(midSettle(a.orderId, 125000));
  clock.t += 10 * DAY;
  const b = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_YEARLY' }); await s.handleMidtransNotification(midSettle(b.orderId, 499000));
  const e = await ent('u'); assert.equal(e.planCode, 'PRO_YEARLY'); assert.equal(e.accessUntil, L.addMonths(L.addMonths(T0, 1), 12));
  const evs = (await db.collection('subscription_events').get()).docs.map(d => d.data().type); assert.ok(evs.includes('subscription_upgraded')); assert.ok(evs.includes('subscription_renewed'));
});

test('pembatalan: PRO tetap sampai akhir periode, lalu turun ke FREE', async () => {
  const { s, db, clock, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org');
  const a = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' }); await s.handleMidtransNotification(midSettle(a.orderId, 125000));
  clock.t += 5 * DAY; const r = await s.cancelWeb(auth('u', 'u@x.org'));
  assert.equal(r.status, 'CANCELED'); let e = await ent('u'); assert.equal(e.tier, 'PRO'); assert.equal(e.autoRenew, false);
  clock.t = L.addMonths(T0, 1) + 1000; await s.sweep(); e = await ent('u'); assert.equal(e.tier, 'FREE');
  const notes = (await db.collection('notifications').get()).docs.map(d => d.data().body);
  assert.ok(notes.some(b => /dibatalkan.*sampai/.test(b))); assert.ok(notes.some(b => /sudah berakhir/.test(b)));
});

test('perpanjangan manual: pengingat H-7, masa tenggang, lalu kedaluwarsa; bayar saat tenggang menyambung periode', async () => {
  const { s, db, clock, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org');
  const a = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' }); await s.handleMidtransNotification(midSettle(a.orderId, 125000));
  const end = L.addMonths(T0, 1);
  clock.t = end - 6 * DAY; let r = await s.sweep(); assert.equal(r.reminders, 1); r = await s.sweep(); assert.equal(r.reminders, 0, 'pengingat tidak dobel');
  clock.t = end + 3600e3; await s.sweep(); let e = await ent('u'); assert.equal(e.status, 'GRACE_PERIOD'); assert.equal(e.tier, 'PRO');
  const b = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' }); await s.handleMidtransNotification(midSettle(b.orderId, 125000));
  e = await ent('u'); assert.equal(e.status, 'ACTIVE'); assert.equal(e.accessUntil, L.addMonths(end, 1), 'periode baru dihitung dari akhir periode lama');
  // tanpa pembayaran: tenggang 3 hari lalu FREE
  clock.t = L.addMonths(end, 1) + 1000; await s.sweep(); assert.equal((await ent('u')).status, 'GRACE_PERIOD');
  clock.t = L.addMonths(end, 1) + 3 * DAY + 1000; await s.sweep(); assert.equal((await ent('u')).tier, 'FREE');
  const evs = (await db.collection('subscription_events').get()).docs.map(d => d.data().type);
  for (const t of ['grace_period_started', 'grace_period_ended', 'subscription_expired', 'renewal_reminder_sent']) assert.ok(evs.includes(t), t);
});

test('refund penuh mencabut PRO dan tercatat', async () => {
  const { s, db, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org');
  const a = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' }); await s.handleMidtransNotification(midSettle(a.orderId, 125000));
  const n = midSettle(a.orderId, 125000, { transaction_status: 'refund', status_code: '200', refund_amount: '125000.00' }); await s.handleMidtransNotification(n);
  const p = (await db.collection('payments').doc(a.orderId).get()).data(); assert.equal(p.status, 'REFUNDED'); assert.equal(p.refundAmount, 125000);
  assert.equal((await ent('u')).tier, 'FREE');
});

test('tagihan tertunda kedaluwarsa otomatis oleh sweep', async () => {
  const { s, db, clock, seedUser, auth } = setup(); await seedUser('u', 'u@x.org');
  const a = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' }); clock.t += 26 * 36e5; await s.sweep();
  assert.equal((await db.collection('payments').doc(a.orderId).get()).data().status, 'EXPIRED');
});

test('kode promo diverifikasi di server', async () => {
  const { s, db, seedUser, auth } = setup(); await seedUser('u', 'u@x.org');
  await assert.rejects(s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_YEARLY', promoCode: 'HEMAT' }), { code: 'invalid-argument' });
  const cfg = { ...DEFAULT_CONFIG, enforce: true, promo: { enabled: true, codes: { HEMAT: { percent: 20, planCodes: ['PRO_YEARLY'], active: true } } } };
  await db.collection('billing_config').doc('main').set(cfg);
  const r = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_YEARLY', promoCode: 'hemat' }); assert.equal(r.amount, 399200);
  await assert.rejects(s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY', promoCode: 'HEMAT' }), { code: 'invalid-argument' });
});

function playSub(state, { exp, autoRenew = true, base = 'monthly', order = 'GPA.1', acct, ack = 'ACKNOWLEDGEMENT_STATE_PENDING', linked } = {}) {
  return { subscriptionState: state, latestOrderId: order, acknowledgementState: ack, startTime: new Date(T0).toISOString(), linkedPurchaseToken: linked,
    externalAccountIdentifiers: acct ? { obfuscatedExternalAccountId: acct } : undefined,
    lineItems: [{ productId: 'washly_pro', expiryTime: new Date(exp).toISOString(), autoRenewingPlan: { autoRenewEnabled: autoRenew }, offerDetails: { basePlanId: base } }] };
}

test('Google Play: token harus milik akun ini; berhasil → PRO, acknowledge, transaksi tercatat; sinkron lintas perangkat', async () => {
  const { s, db, play, seedUser, auth, ent } = setup(); await seedUser('a', 'a@x.org'); await seedUser('b', 'b@x.org');
  play.subs.TK1 = playSub('SUBSCRIPTION_STATE_ACTIVE', { exp: T0 + 30 * DAY, acct: accountIdFor('a') });
  await assert.rejects(s.playVerify(auth('b', 'b@x.org'), { purchaseToken: 'TK1' }), { code: 'permission-denied' });
  await assert.rejects(s.playVerify(auth('a', 'a@x.org'), { purchaseToken: 'NOPE' }), { code: 'failed-precondition' });
  const r = await s.playVerify(auth('a', 'a@x.org'), { purchaseToken: 'TK1', productId: 'washly_pro' });
  assert.equal(r.status, 'ACTIVE'); assert.deepEqual(play.acks, ['TK1']);
  const e = await ent('a'); assert.equal(e.tier, 'PRO'); assert.equal(e.provider, 'google_play');
  const pays = (await db.collection('payments').get()).docs.map(d => d.data()); assert.equal(pays.length, 1); assert.equal(pays[0].amount, 125000);
  // restore di perangkat lain oleh akun yang sama: ok; oleh akun lain: ditolak
  await s.playVerify(auth('a', 'a@x.org'), { purchaseToken: 'TK1' });
  assert.equal((await db.collection('payments').get()).docs.length, 1, 'restore tidak membuat transaksi ganda');
  await assert.rejects(s.playVerify(auth('b', 'b@x.org'), { purchaseToken: 'TK1' }), { code: 'permission-denied' });
  // token tidak pernah disimpan di koleksi yang bisa dibaca pengguna
  const sub = (await db.collection('subscriptions').get()).docs[0].data(); assert.ok(!JSON.stringify(sub).includes('TK1'));
});

test('Google Play RTDN: dibatalkan (tetap PRO), tenggang, kedaluwarsa, duplikat, refund (voided), perpanjangan', async () => {
  const { s, db, play, clock, seedUser, auth, ent } = setup(); await seedUser('a', 'a@x.org');
  play.subs.TK = playSub('SUBSCRIPTION_STATE_ACTIVE', { exp: T0 + 30 * DAY, acct: accountIdFor('a') });
  await s.playVerify(auth('a', 'a@x.org'), { purchaseToken: 'TK' });
  const note = (type) => ({ subscriptionNotification: { notificationType: type, purchaseToken: 'TK', subscriptionId: 'washly_pro' } });
  play.subs.TK = playSub('SUBSCRIPTION_STATE_ACTIVE', { exp: T0 + 60 * DAY, order: 'GPA.1..0', acct: accountIdFor('a'), ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' });
  clock.t = T0 + 30 * DAY; await s.handleRtdn('m1', note(2));
  assert.equal((await db.collection('payments').get()).docs.length, 2, 'perpanjangan = transaksi baru');
  assert.equal((await s.handleRtdn('m1', note(2))).duplicate, true);
  play.subs.TK = playSub('SUBSCRIPTION_STATE_ACTIVE', { exp: T0 + 60 * DAY, order: 'GPA.1..0', autoRenew: false, acct: accountIdFor('a'), ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' });
  await s.handleRtdn('m2', note(3)); let e = await ent('a'); assert.equal(e.status, 'CANCELED'); assert.equal(e.tier, 'PRO');
  play.subs.TK = playSub('SUBSCRIPTION_STATE_IN_GRACE_PERIOD', { exp: T0 + 63 * DAY, order: 'GPA.1..0', acct: accountIdFor('a'), ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' });
  clock.t = T0 + 61 * DAY; await s.handleRtdn('m3', note(6)); e = await ent('a'); assert.equal(e.status, 'GRACE_PERIOD'); assert.equal(e.tier, 'PRO');
  play.subs.TK = playSub('SUBSCRIPTION_STATE_ON_HOLD', { exp: T0 + 61 * DAY, order: 'GPA.1..0', acct: accountIdFor('a'), ack: 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED' });
  clock.t = T0 + 64 * DAY; await s.handleRtdn('m4', note(5)); e = await ent('a'); assert.equal(e.tier, 'FREE'); assert.equal(e.status, 'FREE');
  await s.handleRtdn('m5', { voidedPurchaseNotification: { purchaseToken: 'TK', orderId: 'GPA.1..0' } });
  const p = (await db.collection('payments').doc('play_GPA.1..0').get()).data(); assert.equal(p.status, 'REFUNDED');
  assert.equal((await s.handleRtdn('m6', { subscriptionNotification: { notificationType: 4, purchaseToken: 'UNKNOWN' } })).ignored, 'unlinked');
});

test('Google Play: upgrade (linkedPurchaseToken) menonaktifkan langganan lama', async () => {
  const { s, db, play, seedUser, auth, ent } = setup(); await seedUser('a', 'a@x.org');
  play.subs.OLD = playSub('SUBSCRIPTION_STATE_ACTIVE', { exp: T0 + 30 * DAY, acct: accountIdFor('a') }); await s.playVerify(auth('a', 'a@x.org'), { purchaseToken: 'OLD' });
  play.subs.NEW = playSub('SUBSCRIPTION_STATE_ACTIVE', { exp: T0 + 365 * DAY, base: 'yearly', order: 'GPA.2', acct: accountIdFor('a'), linked: 'OLD' }); await s.playVerify(auth('a', 'a@x.org'), { purchaseToken: 'NEW' });
  const old = (await db.collection('subscriptions').doc('play_' + sha256('OLD').slice(0, 40)).get()).data(); assert.equal(old.status, 'EXPIRED');
  assert.equal((await ent('a')).planCode, 'PRO_YEARLY');
});

test('admin: hanya email admin terverifikasi; pemberian manual wajib alasan & tercatat; langganan berbayar tidak bisa dicabut manual', async () => {
  const { s, db, seedUser, auth, midSettle, ent } = setup(); await seedUser('u', 'u@x.org'); await seedUser('boss', 'boss@x.org');
  await assert.rejects(s.adminMetrics(auth('u', 'u@x.org'), {}), { code: 'permission-denied' });
  await assert.rejects(s.adminMetrics(auth('boss', 'boss@x.org', false), {}), { code: 'permission-denied' });
  await assert.rejects(s.adminGrant(auth('u', 'u@x.org'), { uid: 'u', planCode: 'PRO_MONTHLY', months: 1, reason: 'saya sendiri' }), { code: 'permission-denied' });
  await assert.rejects(s.adminSaveConfig(auth('u', 'u@x.org'), { config: DEFAULT_CONFIG }), { code: 'permission-denied' });
  const A = auth('boss', 'boss@x.org');
  await assert.rejects(s.adminGrant(A, { uid: 'u', planCode: 'PRO_MONTHLY', months: 1, reason: '' }), { code: 'invalid-argument' });
  const g = await s.adminGrant(A, { uid: 'u', planCode: 'PRO_MONTHLY', months: 2, reason: 'Hadiah relawan lapangan' });
  assert.equal((await ent('u')).tier, 'PRO');
  const aud = (await db.collection('admin_audit').get()).docs.map(d => d.data()); assert.equal(aud[0].actorEmail, 'boss@x.org'); assert.equal(aud[0].reason, 'Hadiah relawan lapangan');
  await s.adminRevoke(A, { subscriptionId: g.subscriptionId, reason: 'Salah pemberian' }); assert.equal((await ent('u')).tier, 'FREE');
  const c = await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' }); await s.handleMidtransNotification(midSettle(c.orderId, 125000));
  await assert.rejects(s.adminRevoke(A, { subscriptionId: 'web_u', reason: 'coba cabut' }), { code: 'failed-precondition' });
  const users = await s.adminUsers(A, { q: 'u@x' }); assert.equal(users[0].tier, 'PRO');
  const det = await s.adminUserDetail(A, { uid: 'u' }); assert.ok(det.payments.length >= 1); assert.ok(!JSON.stringify(det).includes('snapToken'));
});

test('admin: ubah harga tanpa deploy — tervalidasi & dipakai checkout berikutnya', async () => {
  const { s, seedUser, auth } = setup(); await seedUser('u', 'u@x.org');
  const A = auth('boss', 'boss@x.org'); const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG)); cfg.plans.PRO_MONTHLY.price = 99000; cfg.enforce = true;
  await s.adminSaveConfig(A, { config: cfg, reason: 'Harga peluncuran' });
  assert.equal((await s.createCheckout(auth('u', 'u@x.org'), { planCode: 'PRO_MONTHLY' })).amount, 99000);
  cfg.plans.PRO_MONTHLY.price = 5; await assert.rejects(s.adminSaveConfig(A, { config: cfg }), { code: 'invalid-argument' });
});

test('metrik: MRR dinormalisasi, pending bukan pendapatan, refund dikurangi, ARPPU, konversi, churn', () => {
  const cfg = DEFAULT_CONFIG; const to = T0 + 30 * DAY, from = T0;
  const users = [{ uid: 'a', createdAt: T0 - DAY }, { uid: 'b', createdAt: T0 - DAY }, { uid: 'c', createdAt: T0 - DAY }, { uid: 'd', createdAt: T0 - DAY }];
  const subs = [
    { userId: 'a', provider: 'midtrans', planCode: 'PRO_MONTHLY', status: 'ACTIVE', currentPeriodEnd: to + 10 * DAY },
    { userId: 'b', provider: 'google_play', planCode: 'PRO_YEARLY', status: 'CANCELED', currentPeriodEnd: to + 100 * DAY },
    { userId: 'c', provider: 'admin', planCode: 'PRO_MONTHLY', status: 'ACTIVE', currentPeriodEnd: to + 10 * DAY },
  ];
  const payments = [
    { userId: 'a', provider: 'midtrans', planCode: 'PRO_MONTHLY', amount: 125000, status: 'PAID', paidAt: T0 + DAY, createdAt: T0 + DAY },
    { userId: 'b', provider: 'google_play', planCode: 'PRO_YEARLY', amount: 499000, status: 'REFUNDED', paidAt: T0 + 2 * DAY, createdAt: T0 + 2 * DAY, refundedAt: T0 + 3 * DAY, refundAmount: 499000 },
    { userId: 'd', provider: 'midtrans', planCode: 'PRO_YEARLY', amount: 499000, status: 'PENDING', createdAt: T0 + 4 * DAY },
    { userId: 'd', provider: 'midtrans', planCode: 'PRO_MONTHLY', amount: 125000, status: 'FAILED', createdAt: T0 + 5 * DAY },
  ];
  const m = computeMetrics({ users, subs, payments, events: [{ type: 'subscription_expired', at: T0 + 5 * DAY }] }, cfg, { from, to, granularity: 'week' });
  assert.equal(m.overview.mrr, Math.round(125000 + 499000 / 12)); assert.equal(m.overview.committedMrr, 125000); assert.equal(m.overview.arr, m.overview.mrr * 12);
  assert.equal(m.current.revenueGross, 624000); assert.equal(m.current.refunds, 499000); assert.equal(m.current.revenueNet, 125000);
  assert.equal(m.current.pendingAmount, 499000); assert.equal(m.current.failedCount, 1); assert.equal(m.current.arppu, Math.round(125000 / 2));
  assert.equal(m.current.converted, 2); assert.equal(m.current.eligible, 4); assert.equal(m.overview.proUsers, 3); assert.equal(m.overview.freeUsers, 1);
  assert.ok(m.series.length >= 4); assert.equal(m.series.reduce((a, b) => a + b.revenue, 0), 624000);
});
