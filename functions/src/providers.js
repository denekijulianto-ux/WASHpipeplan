'use strict';
// Klien HTTP untuk Midtrans (Snap + API status) dan Google Play Developer API (subscriptionsv2).
// Rahasia (server key) hanya dibaca dari Secret Manager di server; tidak pernah dikirim ke aplikasi.

function midtransClient({ serverKey, signatureKey, isProduction, notificationUrl, fetchImpl = fetch }) {
  const snapBase = isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const apiBase = isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  const headers = () => ({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(serverKey + ':').toString('base64'),
    // alamat notifikasi dikirim per transaksi → tidak perlu diatur di dashboard Midtrans
    ...(notificationUrl ? { 'X-Override-Notification': notificationUrl } : {}) });
  return {
    serverKey, isProduction: !!isProduction,
    // Midtrans (2026): notifikasi ditandatangani dengan Signature Secret Key; Server Key hanya untuk API. Terima keduanya selama transisi.
    signatureKeys: [signatureKey, serverKey].filter(k => k && k !== 'NOT_CONFIGURED'),
    async createSnap(payload) {
      const r = await fetchImpl(snapBase + '/snap/v1/transactions', { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.token) throw new Error('Midtrans Snap ' + r.status + ': ' + (j.error_messages || []).join('; '));
      return j;
    },
    // Core API: buat transaksi langsung (mis. Virtual Account) tanpa halaman Snap
    async charge(payload) {
      const r = await fetchImpl(apiBase + '/v2/charge', { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !['200', '201'].includes(String(j.status_code))) throw new Error('Midtrans charge ' + r.status + ' ' + (j.status_code || '') + ': ' + (j.status_message || ''));
      return j;
    },
    // Uji kunci tanpa membuat transaksi: order acak → 404 bila kunci benar, 401 bila salah
    async ping() {
      const r = await fetchImpl(apiBase + '/v2/WASHLY-CEK-' + Date.now() + '/status', { headers: headers() });
      const j = await r.json().catch(() => ({})); const code = String(j.status_code || r.status);
      return { ok: code === '404' || code === '200', unauthorized: code === '401' || r.status === 401, code, message: String(j.status_message || (j.error_messages || []).join('; ') || '').slice(0, 200) };
    },
    async getStatus(orderId) {
      const r = await fetchImpl(apiBase + '/v2/' + encodeURIComponent(orderId) + '/status', { headers: headers() });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) throw new Error('Midtrans status ' + r.status);
      return j;
    },
  };
}

function playClient({ packageName, getAccessToken, fetchImpl = fetch }) {
  const base = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/' + encodeURIComponent(packageName);
  const call = async (url, opt = {}) => {
    const token = await getAccessToken();
    const r = await fetchImpl(url, { ...opt, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
    const text = await r.text(); if (!r.ok) throw new Error('Google Play API ' + r.status + ': ' + text.slice(0, 300));
    return text ? JSON.parse(text) : {};
  };
  return {
    packageName,
    getSubscription: (token) => call(base + '/purchases/subscriptionsv2/tokens/' + encodeURIComponent(token)),
    acknowledge: (productId, token) => call(base + '/purchases/subscriptions/' + encodeURIComponent(productId) + '/tokens/' + encodeURIComponent(token) + ':acknowledge', { method: 'POST', body: '{}' }),
  };
}

module.exports = { midtransClient, playClient };
