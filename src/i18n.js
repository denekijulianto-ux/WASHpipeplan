/* WASHLY — mode bahasa (Indonesia / English).
 * Teks sumber aplikasi berbahasa Indonesia. Pada mode English, lapisan ini menerjemahkan teks yang tampil
 * (teks, title, placeholder, aria-label, alt; termasuk teks gambar DED) memakai kamus window.WASHLY_I18N_EN:
 *   { t: { "teks Indonesia": "English text" }, p: [["Template {0} Indonesia", "English {0} template"], …] }
 * Isian pengguna (input, textarea) tidak diubah. Ganti bahasa: washlySetLang('en' | 'id').
 */
(function () {
  'use strict';
  var KEY = 'washly-lang';
  var lang = 'id';
  try {
    var saved = localStorage.getItem(KEY);
    if (saved === 'en' || saved === 'id') lang = saved;
    else lang = /^id\b|^in\b|^ms\b/i.test((navigator.language || 'id')) ? 'id' : 'en';
  } catch (e) {}
  window.WASHLY_LANG = lang;
  window.washlySetLang = function (l) { try { localStorage.setItem(KEY, l === 'en' ? 'en' : 'id'); } catch (e) {} location.reload(); };
  try { document.documentElement.lang = lang; } catch (e) {}
  window.washlyT = function (s) { return s; };
  if (lang !== 'en') return;

  var DICT = (window.WASHLY_I18N_EN && window.WASHLY_I18N_EN.t) || {};
  var LOWER = {}; Object.keys(DICT).forEach(function (k) { LOWER[k.toLowerCase()] = DICT[k]; });
  var PATS = ((window.WASHLY_I18N_EN && window.WASHLY_I18N_EN.p) || []).map(function (pr) {
    var parts = pr[0].split(/\{\d+\}/); var idx = (pr[0].match(/\{(\d+)\}/g) || []).map(function (m) { return +m.slice(1, -1); });
    var rx = new RegExp('^' + parts.map(function (s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'); }).join('([\\s\\S]*?)') + '$');
    return { rx: rx, idx: idx, en: pr[1], lit: parts.join('').length };
  }).filter(function (p) { return p.lit >= 3; }).sort(function (a, b) { return b.lit - a.lit; });

  function core(s) {
    var k = s.replace(/\s+/g, ' ');
    if (Object.prototype.hasOwnProperty.call(DICT, k)) return DICT[k];
    if (Object.prototype.hasOwnProperty.call(LOWER, k.toLowerCase())) { var v = LOWER[k.toLowerCase()]; return k === k.toUpperCase() ? v.toUpperCase() : v; }
    for (var i = 0; i < PATS.length; i++) {
      var m = PATS[i].rx.exec(k); if (!m) continue;
      var p = PATS[i];
      return p.en.replace(/\{(\d+)\}/g, function (_, n) { var pos = p.idx.indexOf(+n); var val = pos >= 0 ? m[pos + 1] : ''; var t = val && /[A-Za-z]/.test(val) ? core(val) : null; return t != null ? t : val; });
    }
    // tanda baca di ujung: "Simpan:" → "Save:"
    var mm = /^(.*?)([\s:.…,;!?)]+)$/.exec(k); if (mm && mm[1] && mm[1] !== k) { var t2 = core(mm[1]); if (t2 != null) return t2 + mm[2]; }
    var mo = /^([(\s]+)(.*)$/.exec(k); if (mo && mo[2] && mo[2] !== k) { var t3 = core(mo[2]); if (t3 != null) return mo[1] + t3; }
    return null;
  }
  function tr(s) {
    if (!s || !/[A-Za-z]{2}/.test(s)) return null;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s); if (!m[2]) return null;
    var t = core(m[2]); return t == null ? null : m[1] + t + m[3];
  }
  window.washlyT = function (s) { var t = tr(String(s)); return t == null ? s : t; };

  var ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|CODE|PRE|NOSCRIPT)$/;
  function skipEl(el) { for (var e = el, d = 0; e && d < 40; e = e.parentNode, d++) { if (e.nodeType !== 1) continue; if (SKIP.test(e.nodeName) || e.isContentEditable || (e.hasAttribute && e.hasAttribute('data-noi18n'))) return true; } return false; }
  function doText(n) { var p = n.parentNode; if (!p || SKIP.test(p.nodeName) || skipEl(p)) return; var v = n.nodeValue, t = tr(v); if (t != null && t !== v) n.nodeValue = t; }
  function doEl(el) { if (!el.getAttribute || skipEl(/^(INPUT|TEXTAREA)$/.test(el.nodeName) ? el.parentNode : el)) return; for (var i = 0; i < ATTRS.length; i++) { var v = el.getAttribute(ATTRS[i]); if (v) { var t = tr(v); if (t != null && t !== v) el.setAttribute(ATTRS[i], t); } } }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return; if (/^(INPUT|TEXTAREA)$/.test(root.nodeName)) { doEl(root); return; } if (SKIP.test(root.nodeName)) return;
    doEl(root);
    var w = document.createTreeWalker(root, 5 /* ELEMENT | TEXT */, null), n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  var obs = new MutationObserver(function (recs) {
    for (var i = 0; i < recs.length; i++) { var r = recs[i];
      if (r.type === 'characterData') doText(r.target);
      else if (r.type === 'attributes') doEl(r.target);
      else for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]); }
  });
  obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  if (document.body) walk(document.body); else document.addEventListener('DOMContentLoaded', function () { walk(document.body); });
  ['alert', 'confirm', 'prompt'].forEach(function (fn) { var orig = window[fn]; if (!orig) return; window[fn] = function (msg) { var a = Array.prototype.slice.call(arguments); a[0] = window.washlyT(msg); return orig.apply(window, a); }; });
})();
