'use strict';
// Uji pembayaran Midtrans Sandbox dari ujung ke ujung, dijalankan di GitHub Actions (workflow "Uji pembayaran Sandbox").
// 1) token login admin (custom token → ID token)  2) billingVaCharge (VA BNI)  3) bayar lewat simulator Sandbox Midtrans
// 4) tunggu notifikasi → payments PAID, entitlements PRO  5) laporkan. Mode "probe": hanya membaca form simulator.
const admin = require('firebase-admin'); const fs = require('fs'); const path = require('path');
const PROJECT = 'washpipe-93f48'; const REGION = 'asia-southeast2'; const FN = `https://${REGION}-${PROJECT}.cloudfunctions.net`;
const mode = process.argv[2] || 'run'; const bank = process.argv[3] || 'bni';
const SIM = { bni: 'https://simulator.sandbox.midtrans.com/bni/va/index', bca: 'https://simulator.sandbox.midtrans.com/bca/va/index', bri: 'https://simulator.sandbox.midtrans.com/openapi/va/index?bank=bri', permata: 'https://simulator.sandbox.midtrans.com/permata/va/index' };
const forms = (html) => [...html.matchAll(/<form[^>]*>[\s\S]*?<\/form>/gi)].map(m => ({ tag: m[0].match(/<form[^>]*>/i)[0], inputs: [...m[0].matchAll(/<(input|select|button)[^>]*>/gi)].map(x => x[0]) }));
async function probe() {
  for (const [b, u] of Object.entries(SIM)) { const r = await fetch(u); const h = await r.text(); console.log(`\n== ${b} ${u} → HTTP ${r.status}, ${h.length} b`); console.log(JSON.stringify(forms(h), null, 1).slice(0, 2500)); }
}
function cfg() { global.window = {}; require(path.join(__dirname, '../../auth-config.js')); return window.TIRTAPLAN_AUTH; }
async function run() {
  const C = cfg(); admin.initializeApp({ projectId: PROJECT }); const db = admin.firestore();
  const email = C.adminEmails[0]; const u = await admin.auth().getUserByEmail(email); console.log('Admin uji: uid', u.uid.slice(0, 6) + '…');
  const ct = await admin.auth().createCustomToken(u.uid);
  const tr = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${C.firebase.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ct, returnSecureToken: true }) })).json();
  if (!tr.idToken) throw new Error('Gagal membuat token login: ' + JSON.stringify(tr).slice(0, 200));
  const call = async (name, data) => { const r = await fetch(`${FN}/${name}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tr.idToken }, body: JSON.stringify({ data }) }); const j = await r.json(); if (j.error) throw new Error(name + ': ' + j.error.message); return j.result; };
  const va = await call('billingVaCharge', { planCode: 'PRO_MONTHLY', bank }); console.log('VA dibuat:', bank.toUpperCase(), va.va.number || va.va.billKey, 'order', va.orderId, 'Rp', va.amount);
  // bayar lewat simulator
  const page = await (await fetch(SIM[bank])).text(); const f = forms(page)[0]; if (!f) throw new Error('Form simulator tidak ditemukan');
  const action = new URL((f.tag.match(/action="([^"]*)"/i) || [])[1] || SIM[bank], SIM[bank]).href;
  const fields = {}; for (const i of f.inputs) { const n = (i.match(/name="([^"]+)"/) || [])[1]; if (!n) continue; const v = (i.match(/value="([^"]*)"/) || [])[1] || ''; fields[n] = /va|number|account/i.test(n) ? (va.va.number || va.va.billKey) : v; }
  console.log('Inquiry ke', action, Object.keys(fields));
  let r = await fetch(action, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields) }); let h = await r.text();
  for (let step = 0; step < 3; step++) { const g = forms(h).find(x => /pay|bayar|confirm/i.test(x.tag + x.inputs.join(''))); if (!g) break;
    const act = new URL((g.tag.match(/action="([^"]*)"/i) || [])[1] || action, action).href; const fl = {};
    for (const i of g.inputs) { const n = (i.match(/name="([^"]+)"/) || [])[1]; if (n) fl[n] = (i.match(/value="([^"]*)"/) || [])[1] || ''; }
    console.log('Bayar ke', act, Object.keys(fl)); r = await fetch(act, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fl) }); h = await r.text();
    if (/success|berhasil/i.test(h)) { console.log('Simulator: pembayaran sukses'); break; } }
  // tunggu notifikasi webhook
  let p = null; for (let i = 0; i < 24; i++) { p = (await db.collection('payments').doc(va.orderId).get()).data(); if (p.status === 'PAID') break; await new Promise(z => setTimeout(z, 5000)); }
  const wh = (await db.collection('webhook_events').get()).docs.map(d => d.data()).filter(w => w.payload && w.payload.order_id === va.orderId);
  console.log('Notifikasi webhook diterima:', wh.length, wh.map(w => `${w.eventType}:${w.status}${w.error ? ' (' + w.error + ')' : ''}`).join(', '));
  if (!p || p.status !== 'PAID') { const rr = await call('billingRefreshOrder', { orderId: va.orderId }).catch(e => ({ status: 'ERR ' + e.message })); console.log('Status via cek API (tanpa webhook):', rr.status); }
  p = (await db.collection('payments').doc(va.orderId).get()).data(); const e = (await db.collection('entitlements').doc(u.uid).get()).data();
  console.log('HASIL: pembayaran', p.status, '· sandbox', !!p.sandbox, '· hak akses', e && e.tier, '· penyedia', e && e.provider);
  fs.writeFileSync('sandbox-result.json', JSON.stringify({ status: p.status, webhooks: wh.length, tier: e && e.tier }));
  if (p.status !== 'PAID') process.exit(1);
  if (!wh.some(w => w.status === 'PROCESSED')) { console.log('::warning::Pembayaran terverifikasi lewat cek API, tetapi notifikasi webhook tidak/ belum diterima. Periksa Payment Notification URL di dashboard Midtrans Sandbox.'); }
}
(mode === 'probe' ? probe() : run()).catch(e => { console.error('GAGAL:', e.message); process.exit(1); });
