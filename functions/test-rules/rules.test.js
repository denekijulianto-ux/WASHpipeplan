'use strict';
// Uji firestore.rules di Firestore Emulator: jalankan lewat  npm run test:rules
const test = require('node:test'); const fs = require('fs'); const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, Timestamp } = require('firebase/firestore');
let env;
const ADMIN = 'denekijulianto@gmail.com';
test.before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-washly', firestore: { rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'), host: '127.0.0.1', port: 8085 } });
});
test.after(async () => { await env.cleanup(); });
test.beforeEach(async () => { await env.clearFirestore(); });
const seed = (fn) => env.withSecurityRulesDisabled(async (c) => fn(c.firestore()));
const user = (uid, email) => env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const proj = (owner) => ({ ownerUid: owner, name: 'P', status: 'draft' });
async function base(db, { enforce = true, usage = null, ent = null } = {}) {
  await setDoc(doc(db, 'users/u'), { email: 'u@x.org', status: 'approved' });
  await setDoc(doc(db, 'billing_config/main'), { enforce, freeLimits: { cloudProjects: 3 }, plans: {} });
  if (usage != null) await setDoc(doc(db, 'usage/u'), { cloudProjects: usage });
  if (ent) await setDoc(doc(db, 'entitlements/u'), ent);
}

test('pengguna tidak bisa menulis data langganan/pembayaran/hak akses sendiri', async () => {
  await seed(db => base(db));
  const db = user('u', 'u@x.org'); const future = Timestamp.fromMillis(Date.now() + 864e5);
  await assertFails(setDoc(doc(db, 'entitlements/u'), { tier: 'PRO', accessUntilTs: future }));
  await assertFails(setDoc(doc(db, 'subscriptions/web_u'), { userId: 'u', status: 'ACTIVE' }));
  await assertFails(setDoc(doc(db, 'payments/x'), { userId: 'u', status: 'PAID' }));
  await assertFails(setDoc(doc(db, 'billing_config/main'), { enforce: false }));
  await assertFails(setDoc(doc(db, 'usage/u'), { cloudProjects: 0 }));
  await assertFails(setDoc(doc(db, 'subscription_events/e'), { userId: 'u' }));
});

test('baca: hak akses sendiri ya, orang lain tidak; konfigurasi harga publik; token Play & webhook tertutup', async () => {
  await seed(async db => { await base(db, { ent: { tier: 'FREE' } }); await setDoc(doc(db, 'entitlements/v'), { tier: 'PRO' });
    await setDoc(doc(db, 'payments/p1'), { userId: 'v', amount: 1 }); await setDoc(doc(db, 'play_tokens/h'), { uid: 'u', token: 'secret' }); await setDoc(doc(db, 'webhook_events/w'), { provider: 'midtrans' }); });
  const db = user('u', 'u@x.org');
  await assertSucceeds(getDoc(doc(db, 'entitlements/u'))); await assertFails(getDoc(doc(db, 'entitlements/v')));
  await assertFails(getDoc(doc(db, 'payments/p1'))); await assertFails(getDoc(doc(db, 'play_tokens/h'))); await assertFails(getDoc(doc(db, 'webhook_events/w')));
  await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), 'billing_config/main')));
  const adm = user('a', ADMIN); await assertSucceeds(getDoc(doc(adm, 'payments/p1'))); await assertSucceeds(getDoc(doc(adm, 'webhook_events/w'))); await assertFails(getDoc(doc(adm, 'play_tokens/h')));
});

test('batas proyek cloud FREE ditegakkan server; PRO & admin bebas; mode tanpa langganan tetap seperti dulu', async () => {
  const db = () => user('u', 'u@x.org');
  await seed(db => base(db, { enforce: false, usage: 99 })); await assertSucceeds(setDoc(doc(db(), 'projects/p1'), proj('u')));
  await env.clearFirestore(); await seed(db => base(db, { usage: 3 })); await assertFails(setDoc(doc(db(), 'projects/p2'), proj('u')));
  await env.clearFirestore(); await seed(db => base(db, { usage: 2 })); await assertSucceeds(setDoc(doc(db(), 'projects/p3'), proj('u')));
  await env.clearFirestore(); await seed(db => base(db, {})); await assertSucceeds(setDoc(doc(db(), 'projects/p4'), proj('u')));
  await env.clearFirestore(); await seed(db => base(db, { usage: 3, ent: { tier: 'PRO', accessUntilTs: Timestamp.fromMillis(Date.now() + 864e5) } })); await assertSucceeds(setDoc(doc(db(), 'projects/p5'), proj('u')));
  await env.clearFirestore(); await seed(db => base(db, { usage: 3, ent: { tier: 'PRO', accessUntilTs: Timestamp.fromMillis(Date.now() - 1000) } })); await assertFails(setDoc(doc(db(), 'projects/p6'), proj('u')));
  await env.clearFirestore(); await seed(async d => { await base(d, { usage: 3 }); await setDoc(doc(d, 'usage/a'), { cloudProjects: 50 }); });
  await assertSucceeds(setDoc(doc(user('a', ADMIN), 'projects/p7'), proj('a')));
});

test('pendaftaran langsung aktif tanpa persetujuan admin; akun lama "pending" aktif; akun ditangguhkan diblokir', async () => {
  await assertSucceeds(setDoc(doc(user('n1', 'n1@x.org'), 'users/n1'), { email: 'n1@x.org', name: 'N', status: 'approved' }));
  await assertFails(setDoc(doc(user('n2', 'n2@x.org'), 'users/n2'), { email: 'n2@x.org', name: 'N', status: 'suspended' }));
  await seed(async db => { await setDoc(doc(db, 'billing_config/main'), { enforce: false, freeLimits: { cloudProjects: 3 } });
    await setDoc(doc(db, 'users/old'), { email: 'old@x.org', status: 'pending' }); await setDoc(doc(db, 'users/bad'), { email: 'bad@x.org', status: 'suspended' }); });
  await assertSucceeds(setDoc(doc(user('old', 'old@x.org'), 'projects/po'), proj('old')));
  await assertFails(setDoc(doc(user('bad', 'bad@x.org'), 'projects/pb'), proj('bad')));
  await assertFails(setDoc(doc(user('bad', 'bad@x.org'), 'users/bad'), { email: 'bad@x.org', status: 'approved' }));
});

test('proyek orang lain: isi lengkap & foto tertutup, hanya jaringan pipa yang terbaca; petugas yang ditunjuk boleh membaca', async () => {
  await seed(async db => {
    for (const u of ['own', 'oth', 'chk']) await setDoc(doc(db, 'users/' + u), { email: u + '@x.org', status: 'approved' });
    await setDoc(doc(db, 'projects/p1'), { ownerUid: 'own', name: 'P', status: 'review', checkerUid: 'chk' });
    await setDoc(doc(db, 'projectData/p1'), { ownerUid: 'own', rev: 1, text: '{}' });
    await setDoc(doc(db, 'projectNet/p1'), { ownerUid: 'own', rev: 1, text: '{}' });
    await setDoc(doc(db, 'photos/f1'), { ownerUid: 'own', projectId: 'p1', data: 'x' });
  });
  const oth = user('oth', 'oth@x.org'), own = user('own', 'own@x.org'), chk = user('chk', 'chk@x.org'), adm = user('a', ADMIN);
  await assertFails(getDoc(doc(oth, 'projectData/p1'))); await assertFails(getDoc(doc(oth, 'photos/f1')));
  await assertSucceeds(getDoc(doc(oth, 'projectNet/p1'))); await assertSucceeds(getDoc(doc(oth, 'projects/p1')));
  await assertFails(setDoc(doc(oth, 'projectNet/p1'), { ownerUid: 'own', rev: 2, text: '{"nodes":[]}' }));
  await assertFails(setDoc(doc(oth, 'projectData/p1'), { ownerUid: 'own', rev: 2, text: '{}' }));
  for (const db of [own, chk, adm]) { await assertSucceeds(getDoc(doc(db, 'projectData/p1'))); await assertSucceeds(getDoc(doc(db, 'photos/f1'))); }
  await assertSucceeds(setDoc(doc(own, 'projectNet/p1'), { ownerUid: 'own', rev: 2, text: '{}' }));
});

test('bukti transfer: hanya pengirim & admin yang bisa membaca; tidak ada yang bisa menulis dari aplikasi', async () => {
  await seed(async db => { await setDoc(doc(db, 'users/u'), { email: 'u@x.org', status: 'approved' }); await setDoc(doc(db, 'payment_proofs/T1'), { userId: 'u', image: 'data:x' }); });
  await assertSucceeds(getDoc(doc(user('u', 'u@x.org'), 'payment_proofs/T1')));
  await assertFails(getDoc(doc(user('v', 'v@x.org'), 'payment_proofs/T1')));
  await assertSucceeds(getDoc(doc(user('a', ADMIN), 'payment_proofs/T1')));
  await assertFails(setDoc(doc(user('u', 'u@x.org'), 'payment_proofs/T2'), { userId: 'u' }));
  await assertFails(setDoc(doc(user('u', 'u@x.org'), 'payments/T3'), { userId: 'u', provider: 'manual', status: 'PAID' }));
});

test('kunci Midtrans di billing_secrets tidak terbaca siapa pun dari aplikasi, termasuk admin', async () => {
  await seed(async db => { await setDoc(doc(db, 'billing_secrets/midtrans'), { serverKey: 'SB-Mid-server-x' }); });
  await assertFails(getDoc(doc(user('a', ADMIN), 'billing_secrets/midtrans')));
  await assertFails(setDoc(doc(user('a', ADMIN), 'billing_secrets/midtrans'), { serverKey: 'y' }));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'billing_secrets/midtrans')));
});
