/* WASHLY — lapisan integrasi Android (Capacitor).
 * Hanya aktif di aplikasi Android; versi web tidak terpengaruh.
 * - Cetak laporan/DED  → dialog cetak Android (bisa "Simpan sebagai PDF")
 * - Unduh berkas (.json, .gpx, foto) → pemilih lokasi simpan Android (Storage Access Framework)
 * - Tautan eksternal / window.open → browser / aplikasi bawaan (email, peta, dll.)
 * - Tombol Kembali Android → tutup dialog/panel dulu, lalu ke tab Peta, lalu tekan 2× untuk keluar
 * - Kembali dari latar belakang → picu sinkron cloud
 */
(function () {
  'use strict';
  var C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;
  var P = C.Plugins || {};
  var N = P.WashlyNative, App = P.App;
  document.documentElement.classList.add('washly-native');

  // ---------- pesan singkat (toast) ----------
  var toastEl = null, toastT = 0;
  function toast(msg) {
    if (!document.body) return;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:99999;max-width:88vw;background:#12334A;color:#fff;font:500 13px "IBM Plex Sans",sans-serif;padding:9px 16px;border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.25);text-align:center;transition:opacity .2s;pointer-events:none';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg; toastEl.style.opacity = '1';
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.style.opacity = '0'; }, 2200);
  }

  // ---------- service worker tidak dipakai di aplikasi (aset sudah terpasang lokal) ----------
  try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }).catch(function () {}); } catch (e) {}

  // ---------- cetak → PrintManager Android ----------
  window.print = function () {
    var paper = 'A4', landscape = false;
    try {
      var root = document.getElementById('print-root');
      var isReport = !!(root && root.querySelector('.rp'));
      var pg = document.getElementById('tp-page');
      var m = pg && /size:\s*(A3|A4)\s+landscape/.exec(pg.textContent || '');
      if (!isReport) { paper = m ? m[1] : 'A3'; landscape = true; }
    } catch (e) {}
    var proj = '';
    try { var h1 = document.querySelector('#print-root h1'); var hb = document.querySelector('header button[title="Ubah data proyek"]') || document.querySelector('header .truncate');
      proj = ((h1 && h1.textContent) || (hb && hb.textContent) || '').trim(); } catch (e) {}
    var isRep = !landscape;
    var name = ((isRep ? 'Laporan ' : 'DED ') + (proj || 'WASHLY')).replace(/[^\w\- ]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
    var done = function () { window.dispatchEvent(new Event('afterprint')); };
    if (!N) { toast('Fitur cetak tidak tersedia.'); done(); return; }
    N.print({ name: name, paper: paper, landscape: landscape }).then(done, function (e) { toast('Cetak gagal: ' + ((e && e.message) || e)); done(); });
  };

  // ---------- simpan berkas ----------
  function guessMime(name) {
    var ext = String(name || '').split('.').pop().toLowerCase();
    return ({ json: 'application/json', gpx: 'application/gpx+xml', csv: 'text/csv', txt: 'text/plain', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', pdf: 'application/pdf', kml: 'application/vnd.google-earth.kml+xml' })[ext] || 'application/octet-stream';
  }
  function blobToBase64(blob) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { var s = String(r.result); res(s.slice(s.indexOf(',') + 1)); }; r.onerror = rej; r.readAsDataURL(blob); });
  }
  function saveHref(href, name) {
    if (!N) return;
    fetch(href).then(function (r) { return r.blob(); }).then(function (blob) {
      return blobToBase64(blob).then(function (b64) { return N.saveFile({ fileName: name || 'washly-berkas', mimeType: blob.type || guessMime(name), data: b64 }); });
    }).then(function (r) { if (r && r.saved) toast('Berkas disimpan: ' + (name || '')); }, function (e) { toast('Gagal menyimpan berkas: ' + ((e && e.message) || e)); });
  }

  // ---------- tautan eksternal ----------
  function isExternal(a) {
    var href = a.getAttribute('href') || '';
    if (/^(mailto|tel|sms|geo|whatsapp|intent):/i.test(href)) return true;
    if (!/^https?:/i.test(a.href)) return false;
    return a.target === '_blank' || a.host !== location.host;
  }
  function openExternal(url) { if (N) N.openExternal({ url: url }).catch(function () { toast('Tautan tidak dapat dibuka.'); }); }
  window.open = function (url) { if (url) openExternal(new URL(String(url), location.href).href); return null; };

  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute('download')) { saveHref(this.href, this.getAttribute('download')); return; }
    if (isExternal(this)) { openExternal(this.href); return; }
    return origClick.call(this);
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || e.defaultPrevented) return;
    if (a.hasAttribute('download')) { e.preventDefault(); saveHref(a.href, a.getAttribute('download')); }
    else if (isExternal(a)) { e.preventDefault(); openExternal(a.href); }
  }, true);

  // ---------- menu Bagikan Android (Web Share API tidak ada di WebView) ----------
  navigator.canShare = function (d) { return !!(d && d.files && d.files.length && N); };
  navigator.share = function (d) {
    if (!N) return Promise.reject(new Error('Bagikan tidak tersedia'));
    var f = d && d.files && d.files[0];
    if (!f) { if (d && d.url) { openExternal(d.url); return Promise.resolve(); } return Promise.reject(new Error('Tidak ada berkas')); }
    return blobToBase64(f).then(function (b64) { return N.shareFile({ fileName: f.name, mimeType: (f.type && f.type !== 'text/plain') ? f.type : guessMime(f.name), data: b64, title: d.title || '', text: d.text || '' }); });
  };

  // ---------- layar tetap menyala saat merekam GPS (Screen Wake Lock API tidak ada di WebView) ----------
  try {
    var wake = { request: function () { if (N) N.keepAwake({ on: true }); var s = { released: false, release: function () { s.released = true; if (N) N.keepAwake({ on: false }); return Promise.resolve(); }, addEventListener: function () {} }; return Promise.resolve(s); } };
    Object.defineProperty(navigator, 'wakeLock', { value: wake, configurable: true });
  } catch (e) {}

  // ---------- tombol Kembali Android ----------
  function visible(el) { if (!el || !el.isConnected) return false; var r = el.getBoundingClientRect(); var s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; }
  function zOf(el) { var z = parseInt(getComputedStyle(el).zIndex, 10); return isNaN(z) ? 0 : z; }
  function topmost(list) { var best = null; list.forEach(function (el, i) { if (!best || zOf(el) >= zOf(best)) best = el; }); return best; }
  var lastBack = 0;
  function onBack() {
    // 1) sedang mencetak: abaikan
    var pr = document.getElementById('print-root'); if (pr && pr.children.length) return;
    // 2) dialog / lapisan modal (latar gelap menutup dialog bila diklik)
    var ov = Array.prototype.slice.call(document.querySelectorAll('.fixed.inset-0')).filter(visible);
    if (ov.length) { topmost(ov).dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window })); return; }
    // 3) panel yang punya tombol tutup (asisten, panel bawah peta, profil elevasi, dll.)
    var closers = Array.prototype.slice.call(document.querySelectorAll('[title="Tutup"],[title="Tutup panel"],[aria-label="Tutup panel"],[title="Tutup profil"],[aria-label="Tutup menu"],[title="Tutup profil elevasi"]')).filter(visible);
    if (closers.length) { closers[closers.length - 1].click(); return; }
    // 4) kembali ke tab pertama (Peta)
    var tabs = Array.prototype.slice.call(document.querySelectorAll('header nav button')).filter(visible);
    if (tabs.length > 1) {
      var active = tabs.findIndex(function (b) { return /border-aqua-400/.test(b.className); });
      if (active > 0) { tabs[0].click(); return; }
    }
    // 5) tekan 2× untuk keluar
    var now = Date.now();
    if (now - lastBack < 2000) { if (App) App.exitApp(); return; }
    lastBack = now; toast('Tekan Kembali sekali lagi untuk keluar dari WASHLY');
  }
  if (App && App.addListener) {
    App.addListener('backButton', onBack);
    // kembali dari latar belakang: perbarui sinkron cloud & GPS
    App.addListener('resume', function () { try { document.dispatchEvent(new Event('visibilitychange')); } catch (e) {} });
  }

  // ---------- keyboard: jaga kolom isian tetap terlihat saat keyboard muncul ----------
  window.addEventListener('resize', function () {
    var a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) setTimeout(function () { try { a.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {} }, 80);
  });
  window.__washlyNative = { toast: toast, onBack: onBack };
})();
