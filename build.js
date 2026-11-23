// Kompilasi src/index.dev.html (JSX) menjadi index.html siap pakai, tanpa Babel di browser.
// Pemakaian: npm install   lalu   npm run build
const fs = require('fs'); const path = require('path'); const Babel = require('@babel/standalone');
const src = path.join(__dirname, 'src', 'index.dev.html'), out = path.join(__dirname, 'index.html');
let html = fs.readFileSync(src, 'utf8');
const m = html.match(/<script type="text\/babel" data-presets="react">([\s\S]*?)<\/script>/);
if (!m) throw new Error('Blok <script type="text/babel"> tidak ditemukan');
const code = Babel.transform(m[1], { presets: ['react'], comments: false, compact: false }).code;
html = html.replace(m[0], () => '<script>\n' + code + '\n</script>')
  .replace(/<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/babel-standalone\/[^"]+"><\/script>\n?/, '')
  .replace("if (!window.Babel) missing.push('Babel');", '')
  .replace('<title>WASHLY - Simplify the flow</title>', '<title>WASHLY - Simplify the flow</title>\n<!-- Berkas hasil build: edit src/index.dev.html lalu jalankan "npm run build" -->');
// Kamus & mesin bahasa (src/i18n-en-dict.js + src/i18n.js) ditanam langsung agar bekerja offline
for (const f of ['i18n-en-dict.js', 'i18n.js']) {
  const tag = `<script src="${f}"></script>`; if (!html.includes(tag)) throw new Error('Tag ' + tag + ' tidak ditemukan');
  const js = fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace(tag, () => '<script>\n' + js + '\n</script>');
}
fs.writeFileSync(out, html);
console.log('index.html dibuat (' + Math.round(html.length / 1024) + ' KB)');
