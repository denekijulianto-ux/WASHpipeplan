'use strict';
// Cloud Functions WASHLY: langganan, pembayaran & dasbor pendapatan.
// Deploy: lihat BILLING.md. Region Jakarta (asia-southeast2).
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onMessagePublished } = require('firebase-functions/v2/pubsub');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { defineSecret, defineString } = require('firebase-functions/params');
const { setGlobalOptions, logger } = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { GoogleAuth } = require('google-auth-library');
const { makeService, BillingError } = require('./src/service');
const { midtransClient, playClient } = require('./src/providers');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast2', maxInstances: 10 });

const MIDTRANS_SERVER_KEY = defineSecret('MIDTRANS_SERVER_KEY');
const MIDTRANS_IS_PRODUCTION = defineString('MIDTRANS_IS_PRODUCTION', { default: 'false' });
const PLAY_PACKAGE_NAME = defineString('PLAY_PACKAGE_NAME', { default: 'com.washly.app' });
const ADMIN_EMAILS = defineString('ADMIN_EMAILS', { description: 'Email admin dipisah koma (sama dengan firestore.rules)' });
const APP_URL = defineString('APP_URL', { default: 'https://washlywater.github.io/' });
const NTFY_TOPIC = defineString('NTFY_TOPIC', { default: '' });
// Trigger Firestore harus berada di region yang sama dengan database Firestore (diisi otomatis oleh alur deploy)
const FIRESTORE_REGION = defineString('FIRESTORE_REGION', { default: 'asia-southeast2' });
const RTDN_TOPIC = 'play-billing';

const gauth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
let svc = null;
function service() {
  if (svc) return svc;
  const db = admin.firestore();
  svc = makeService({
    db, now: () => Date.now(), ts: (ms) => admin.firestore.Timestamp.fromMillis(ms), fetch,
    adminEmails: ADMIN_EMAILS.value().split(',').map(s => s.trim()).filter(Boolean),
    appUrl: APP_URL.value(), ntfyTopic: NTFY_TOPIC.value(),
    midtrans: midtransClient({ serverKey: MIDTRANS_SERVER_KEY.value(), isProduction: MIDTRANS_IS_PRODUCTION.value() === 'true' }),
    play: playClient({ packageName: PLAY_PACKAGE_NAME.value(), getAccessToken: async () => (await (await gauth.getClient()).getAccessToken()).token }),
  });
  return svc;
}
const wrap = (fn) => async (req) => {
  try { return await fn(service())(req.auth, req.data || {}); }
  catch (e) { if (e instanceof BillingError) throw new HttpsError(e.code, e.message); logger.error(e); throw new HttpsError('internal', 'Terjadi kesalahan di server langganan.'); }
};
const callOpts = { secrets: [MIDTRANS_SERVER_KEY], cors: true, enforceAppCheck: false };

// ---- Pengguna
exports.billingCheckout = onCall(callOpts, wrap(s => s.createCheckout));
exports.billingRefreshOrder = onCall(callOpts, wrap(s => s.refreshOrder));
exports.billingCancel = onCall(callOpts, wrap(s => s.cancelWeb));
exports.billingAccountId = onCall(callOpts, wrap(s => s.myAccountId));
exports.billingRefresh = onCall(callOpts, wrap(s => s.refreshMe));
exports.playVerify = onCall(callOpts, wrap(s => s.playVerify));
// ---- Admin (dicek ulang di server: email admin terverifikasi)
exports.adminBillingMetrics = onCall({ ...callOpts, memory: '512MiB', timeoutSeconds: 120 }, wrap(s => s.adminMetrics));
exports.adminBillingUsers = onCall(callOpts, wrap(s => s.adminUsers));
exports.adminBillingUser = onCall(callOpts, wrap(s => s.adminUserDetail));
exports.adminBillingGrant = onCall(callOpts, wrap(s => s.adminGrant));
exports.adminBillingRevoke = onCall(callOpts, wrap(s => s.adminRevoke));
exports.adminBillingConfig = onCall({ ...callOpts, timeoutSeconds: 300 }, wrap(s => s.adminSaveConfig));

// ---- Webhook Midtrans (URL ini diisi di Dashboard Midtrans → Settings → Payment → Notification URL)
exports.midtransWebhook = onRequest({ secrets: [MIDTRANS_SERVER_KEY], cors: false }, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
  try { const r = await service().handleMidtransNotification(req.body || {}); res.status(200).json({ ok: true, ...r }); }
  catch (e) {
    if (e instanceof BillingError && e.code === 'permission-denied') { logger.warn('Midtrans: tanda tangan tidak valid', { order: req.body && req.body.order_id }); res.status(401).json({ ok: false }); return; }
    if (e instanceof BillingError && e.code === 'not-found') { res.status(200).json({ ok: false, ignored: 'unknown order' }); return; }
    logger.error('Midtrans webhook gagal', e); res.status(500).json({ ok: false }); // Midtrans akan mengirim ulang
  }
});

// ---- Google Play Real-time Developer Notifications (Pub/Sub)
exports.playRtdn = onMessagePublished({ topic: RTDN_TOPIC }, async (event) => {
  const msg = event.data.message; let data = null;
  try { data = msg.json || JSON.parse(Buffer.from(msg.data, 'base64').toString('utf8')); } catch (e) { logger.warn('RTDN tidak bisa dibaca'); return; }
  if (data.packageName && data.packageName !== PLAY_PACKAGE_NAME.value()) { logger.warn('RTDN paket lain', data.packageName); return; }
  await service().handleRtdn(msg.messageId, data); // error → Pub/Sub mengulang
});

// ---- Pemeriksaan berkala: kedaluwarsa, masa tenggang, pengingat, tagihan tertunda
exports.billingSweep = onSchedule({ schedule: 'every 6 hours', timeZone: 'Asia/Jakarta', secrets: [MIDTRANS_SERVER_KEY], timeoutSeconds: 540 }, async () => {
  const r = await service().sweep(); logger.info('billingSweep', r);
});

// ---- Penghitung proyek cloud per pemilik (dipakai firestore.rules untuk batas paket FREE)
exports.projectUsage = onDocumentWritten({ document: 'projects/{pid}', region: FIRESTORE_REGION, secrets: [MIDTRANS_SERVER_KEY] }, async (event) => {
  const b = event.data.before.exists ? event.data.before.data() : null, a = event.data.after.exists ? event.data.after.data() : null;
  const owners = new Set([b && b.ownerUid, a && a.ownerUid].filter(Boolean));
  if (b && a && b.ownerUid === a.ownerUid) return; // ubahan biasa, jumlah tidak berubah
  for (const uid of owners) await service().recountUsage(uid);
});
