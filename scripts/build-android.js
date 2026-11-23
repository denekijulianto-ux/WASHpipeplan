// Membuat folder www/ untuk aplikasi Android (Capacitor) dari index.html hasil build web.
// Semua library dipasang lokal (tanpa CDN) agar aplikasi tetap terbuka tanpa sinyal di lapangan.
// Pemakaian: npm run build:android   (menjalankan build.js → skrip ini → npx cap sync android)
const fs = require('fs'); const path = require('path'); const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..'); const NM = path.join(ROOT, 'node_modules'); const WWW = path.join(ROOT, 'www'); const V = path.join(WWW, 'vendor');
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });
const cp = (src, dst) => { fs.mkdirSync(path.dirname(dst), { recursive: true }); fs.copyFileSync(src, dst); };
const must = (html, re, label) => { if (!re.test(html)) throw new Error('Pola tidak ditemukan di index.html: ' + label); };

rm(WWW); fs.mkdirSync(V, { recursive: true });
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ---- 1. library pihak ketiga (versi sama dengan CDN di versi web) ----
const libs = [
  ['react/umd/react.production.min.js', 'react.production.min.js', /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/react\/18\.3\.1\/umd\/react\.production\.min\.js/],
  ['react-dom/umd/react-dom.production.min.js', 'react-dom.production.min.js', /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/react-dom\/18\.3\.1\/umd\/react-dom\.production\.min\.js/],
  ['leaflet/dist/leaflet.js', 'leaflet/leaflet.js', /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/1\.9\.4\/leaflet\.js/],
  ['leaflet/dist/leaflet.css', 'leaflet/leaflet.css', /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/leaflet\/1\.9\.4\/leaflet\.css/],
  ['lucide/dist/umd/lucide.min.js', 'lucide.min.js', /https:\/\/unpkg\.com\/lucide@0\.460\.0\/dist\/umd\/lucide\.min\.js/],
  ['qrcodejs/qrcode.min.js', 'qrcode.min.js', /https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0\/qrcode\.min\.js/],
];
for (const [src, dst, re] of libs) { cp(path.join(NM, src), path.join(V, dst)); must(html, re, dst); html = html.replace(re, 'vendor/' + dst); }
for (const f of fs.readdirSync(path.join(NM, 'leaflet/dist/images'))) cp(path.join(NM, 'leaflet/dist/images', f), path.join(V, 'leaflet/images', f));
// Firebase compat SDK (dimuat dinamis oleh aplikasi)
const fbVer = (html.match(/const FB_VER = '([\d.]+)'/) || [])[1];
const fbPkg = JSON.parse(fs.readFileSync(path.join(NM, 'firebase/package.json'), 'utf8')).version;
if (fbVer !== fbPkg) throw new Error(`Versi Firebase aplikasi (${fbVer}) ≠ paket npm (${fbPkg}). Jalankan: npm i -D firebase@${fbVer}`);
for (const m of ['app', 'auth', 'firestore']) cp(path.join(NM, `firebase/firebase-${m}-compat.js`), path.join(V, `firebase/firebase-${m}-compat.js`));
must(html, /https:\/\/www\.gstatic\.com\/firebasejs\/\$\{FB_VER\}\/firebase-\$\{m\}-compat\.js/, 'firebase loader');
html = html.replace('https://www.gstatic.com/firebasejs/${FB_VER}/firebase-${m}-compat.js', 'vendor/firebase/firebase-${m}-compat.js');

// ---- 2. huruf IBM Plex (lokal) ----
let fontCss = '';
for (const [pkg, weights] of [['ibm-plex-sans', [400, 500, 600, 700]], ['ibm-plex-mono', [400, 500, 600]]]) for (const w of weights) for (const sub of ['latin', 'latin-ext']) {
  const f = `${pkg}-${sub}-${w}-normal.woff2`; const p = path.join(NM, '@fontsource', pkg, 'files', f); if (!fs.existsSync(p)) continue; cp(p, path.join(V, 'fonts', f));
  const fam = pkg === 'ibm-plex-sans' ? 'IBM Plex Sans' : 'IBM Plex Mono';
  fontCss += `@font-face{font-family:'${fam}';font-style:normal;font-display:swap;font-weight:${w};src:url(fonts/${f}) format('woff2');${sub === 'latin' ? 'unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD;' : ''}}\n`;
}
fs.writeFileSync(path.join(V, 'fonts.css'), fontCss);
html = html.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n?/, '').replace(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n?/, '');
must(html, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, 'google fonts');
html = html.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^"]*">/, '<link rel="stylesheet" href="vendor/fonts.css">');

// ---- 3. Tailwind: dikompilasi sebelumnya (konfigurasi sama dengan versi web) ----
const cfgM = html.match(/tailwind\.config = (\{[\s\S]*?\n {4}\});/); if (!cfgM) throw new Error('tailwind.config tidak ditemukan');
const cfg = Function('return ' + cfgM[1])();
const tmp = path.join(ROOT, '.tw-android'); rm(tmp); fs.mkdirSync(tmp);
fs.writeFileSync(path.join(tmp, 'tailwind.config.js'), 'module.exports = ' + JSON.stringify({ ...cfg, content: [path.join(ROOT, 'src/index.dev.html'), path.join(ROOT, 'mobile/*.js')] }) + ';');
fs.writeFileSync(path.join(tmp, 'in.css'), '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n');
execFileSync(process.execPath, [path.join(NM, 'tailwindcss/lib/cli.js'), '-c', path.join(tmp, 'tailwind.config.js'), '-i', path.join(tmp, 'in.css'), '-o', path.join(V, 'tailwind.css'), '--minify'], { stdio: 'pipe' });
rm(tmp);
must(html, /<script src="https:\/\/cdn\.tailwindcss\.com\/[\d.]+"><\/script>\n<script>\n\s*if \(window\.tailwind\) \{[\s\S]*?\n<\/script>\n/, 'tailwind cdn');
html = html.replace(/<script src="https:\/\/cdn\.tailwindcss\.com\/[\d.]+"><\/script>\n<script>\n\s*if \(window\.tailwind\) \{[\s\S]*?\n<\/script>\n/, '<link rel="stylesheet" href="vendor/tailwind.css">\n');

// ---- 4. PWA/service worker tidak dipakai di aplikasi Android ----
must(html, /<script>\n\s*\/\/ PWA: manifest & service worker[\s\S]*?<\/script>\n/, 'pwa block');
html = html.replace(/<script>\n\s*\/\/ PWA: manifest & service worker[\s\S]*?<\/script>\n/, '');

// ---- 5. lapisan integrasi Android + tampilan awal bermerek ----
cp(path.join(ROOT, 'mobile/native-shim.js'), path.join(WWW, 'native-shim.js'));
html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<script src="native-shim.js"></script>');
// tanpa viewport-fit=cover: WebView diberi jarak dari status bar & navigasi Android (aman untuk semua layar)
html = html.replace('content="width=device-width, initial-scale=1, viewport-fit=cover"', 'content="width=device-width, initial-scale=1"');
must(html, /<div id="boot">[^<]*<\/div>/, 'boot');
html = html.replace(/<div id="boot">[^<]*<\/div>/, '<div id="boot"><div style="display:flex;flex-direction:column;align-items:center;gap:14px"><img src="icons/washly-logo.png" alt="WASHLY" style="width:min(260px,70vw);height:auto"><div style="font:500 15px \'IBM Plex Sans\',sans-serif;color:#1676C0;letter-spacing:.02em">Simplify the Flow.</div></div></div>');
html = html.replace(/#boot \{([^}]*)background: #[0-9a-fA-F]+;/, '#boot {$1background: #ffffff;');
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '');

// ---- 6. berkas aplikasi lain ----
fs.writeFileSync(path.join(WWW, 'index.html'), html);
cp(path.join(ROOT, 'auth-config.js'), path.join(WWW, 'auth-config.js'));
for (const f of ['privacy.html', 'hapus-akun.html']) cp(path.join(ROOT, f), path.join(WWW, f));
for (const f of fs.readdirSync(path.join(ROOT, 'icons'))) cp(path.join(ROOT, 'icons', f), path.join(WWW, 'icons', f));

// ---- 7. pemeriksaan: tidak ada lagi script/style dari CDN ----
const leftovers = (html.match(/<(script|link)[^>]+(src|href)="https?:\/\/[^"]+"/g) || []);
if (leftovers.length) throw new Error('Masih ada aset CDN: ' + leftovers.join(' | '));
const size = (d) => fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? size(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
console.log(`www/ siap untuk Android (${Math.round(size(WWW) / 1024)} KB)`);
