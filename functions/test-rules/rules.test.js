'use strict';
// Uji firestore.rules di Firestore Emulator: jalankan lewat  npm run test:rules
const test = require('node:test'); const assert = require('node:assert/strict'); const fs = require('fs'); const path = require('path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, Timestamp, collection, query, where, getDocs } = require('firebase/firestore');
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

test('proyek privat: akun lain tidak bisa membaca daftar proyek, jaringan pipa, isi, foto, maupun daftar pengguna; tim yang ditunjuk & admin bisa', async () => {
  await seed(async db => {
    for (const u of ['own', 'oth', 'chk']) await setDoc(doc(db, 'users/' + u), { email: u + '@x.org', status: 'approved' });
    await setDoc(doc(db, 'projects/p1'), { ownerUid: 'own', name: 'P', status: 'review', checkerUid: 'chk', approverUid: '', surveyorUid: 'own', drafterUid: 'own' });
    await setDoc(doc(db, 'projects/p2'), { ownerUid: 'oth', name: 'Q', status: 'draft' });
    await setDoc(doc(db, 'projectData/p1'), { ownerUid: 'own', rev: 1, text: '{}' });
    await setDoc(doc(db, 'projectNet/p1'), { ownerUid: 'own', rev: 1, text: '{}' });
    await setDoc(doc(db, 'photos/f1'), { ownerUid: 'own', projectId: 'p1', data: 'x' });
  });
  const oth = user('oth', 'oth@x.org'), own = user('own', 'own@x.org'), chk = user('chk', 'chk@x.org'), adm = user('a', ADMIN);
  for (const path of ['projects/p1', 'projectNet/p1', 'projectData/p1', 'photos/f1', 'users/own']) await assertFails(getDoc(doc(oth, path)));
  await assertFails(getDocs(collection(oth, 'projects')));                       // daftar semua proyek: ditolak
  await assertFails(getDocs(collection(oth, 'users')));                          // daftar semua pengguna: ditolak
  await assertSucceeds(getDoc(doc(oth, 'users/oth')));                           // profil sendiri: boleh
  await assertSucceeds(getDoc(doc(oth, 'projects/baru')));                       // dokumen belum ada (sebelum menyimpan proyek baru): boleh
  await assertSucceeds(getDocs(query(collection(oth, 'projects'), where('ownerUid', '==', 'oth'))));
  const asChecker = await assertSucceeds(getDocs(query(collection(chk, 'projects'), where('checkerUid', '==', 'chk'))));
  assert.equal(asChecker.size, 1);
  for (const db of [own, chk, adm]) for (const path of ['projects/p1', 'projectNet/p1', 'projectData/p1', 'photos/f1']) await assertSucceeds(getDoc(doc(db, path)));
  await assertSucceeds(getDocs(collection(adm, 'projects'))); await assertSucceeds(getDocs(collection(adm, 'users')));
  await assertFails(setDoc(doc(oth, 'projectNet/p1'), { ownerUid: 'own', rev: 2, text: '{"nodes":[]}' }));
  await assertFails(setDoc(doc(oth, 'projectData/p1'), { ownerUid: 'own', rev: 2, text: '{}' }));
  await assertSucceeds(setDoc(doc(own, 'projectNet/p1'), { ownerUid: 'own', rev: 2, text: '{}' }));
});

test('tim proyek: pemilik PRO boleh menunjuk orang lain; pemilik FREE hanya dirinya sendiri; tim lama tetap bisa disimpan', async () => {
  const future = Timestamp.fromMillis(Date.now() + 864e5);
  const mk = async (ent) => { await env.clearFirestore(); await seed(async db => { await base(db, { ent }); await setDoc(doc(db, 'users/c'), { email: 'c@x.org', status: 'approved' });
    await setDoc(doc(db, 'projects/p1'), { ownerUid: 'u', name: 'P', status: 'draft', checkerUid: '', approverUid: '', surveyorUid: '', drafterUid: '' }); }); };
  const u = () => user('u', 'u@x.org');
  await mk({ tier: 'FREE' });
  await assertSucceeds(updateDoc(doc(u(), 'projects/p1'), { surveyorUid: 'u', drafterUid: 'u' }));    // diri sendiri: boleh
  await assertFails(updateDoc(doc(u(), 'projects/p1'), { checkerUid: 'c' }));                        // orang lain: PRO saja
  await assertFails(setDoc(doc(u(), 'projects/p9'), { ownerUid: 'u', name: 'X', status: 'draft', approverUid: 'c' }));
  await assertSucceeds(updateDoc(doc(u(), 'projects/p1'), { name: 'Ganti nama' }));                   // tim tidak berubah: boleh
  await mk({ tier: 'PRO', accessUntilTs: future });
  await assertSucceeds(updateDoc(doc(u(), 'projects/p1'), { checkerUid: 'c', approverUid: 'c', surveyorUid: 'c', drafterUid: 'c' }));
  await assertSucceeds(getDoc(doc(user('c', 'c@x.org'), 'projects/p1')));                           // anggota tim kini bisa membuka
  await mk({ tier: 'PRO', accessUntilTs: Timestamp.fromMillis(Date.now() - 1000) });                // PRO berakhir
  await assertFails(updateDoc(doc(u(), 'projects/p1'), { checkerUid: 'c' }));
  await assertSucceeds(updateDoc(doc(user('a', ADMIN), 'projects/p1'), { checkerUid: 'c' }));        // admin bebas
});

test('kerja bersama: tim ikut mengedit di draft/revisi; dikunci saat diperiksa; perpindahan status wajib PRO pelakunya', async () => {
  const future = Timestamp.fromMillis(Date.now() + 864e5);
  const mk = async (status, ents = {}) => { await env.clearFirestore(); await seed(async db => { await base(db, {});
    for (const u of ['c', 'x']) await setDoc(doc(db, 'users/' + u), { email: u + '@x.org', status: 'approved' });
    for (const [u, e] of Object.entries(ents)) await setDoc(doc(db, 'entitlements/' + u), e);
    await setDoc(doc(db, 'projects/p1'), { ownerUid: 'u', name: 'P', status, checkerUid: 'c', approverUid: '', surveyorUid: 'u', drafterUid: 'u' });
    await setDoc(doc(db, 'projectData/p1'), { ownerUid: 'u', rev: 1, text: '{}' }); }); };
  const PRO = { tier: 'PRO', accessUntilTs: future }; const c = () => user('c', 'c@x.org'), u = () => user('u', 'u@x.org');
  await mk('draft');                                                                                   // anggota tim FREE, tahap draft
  await assertSucceeds(updateDoc(doc(c(), 'projects/p1'), { name: 'Diubah anggota tim', rev: 2 }));
  await assertSucceeds(setDoc(doc(c(), 'projectData/p1'), { ownerUid: 'u', rev: 2, text: '{"x":1}' }));
  await assertFails(updateDoc(doc(c(), 'projects/p1'), { checkerUid: 'x' }));                          // tidak boleh mengubah tim
  await assertFails(updateDoc(doc(user('x', 'x@x.org'), 'projects/p1'), { name: 'orang luar' }));    // bukan anggota tim
  await assertFails(updateDoc(doc(u(), 'projects/p1'), { status: 'review' }));                         // pemilik FREE: ajukan = PRO
  await mk('draft', { u: PRO }); await assertSucceeds(updateDoc(doc(u(), 'projects/p1'), { status: 'review' }));
  await mk('review');
  // (pemeriksa tetap boleh menyimpan selama 'review' untuk tanda tangan; penguncian isi saat diperiksa dijaga aplikasi)
  await assertFails(updateDoc(doc(c(), 'projects/p1'), { status: 'checked' }));                       // pemeriksa FREE tidak bisa memeriksa
  await mk('review', { c: PRO }); await assertSucceeds(updateDoc(doc(c(), 'projects/p1'), { status: 'checked' }));
  await mk('checked'); await assertSucceeds(updateDoc(doc(u(), 'projects/p1'), { status: 'draft' }));  // kembali ke draft selalu boleh
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
