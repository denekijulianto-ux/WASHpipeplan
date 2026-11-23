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
