'use strict';
// ルビ（ふりがな）の一元管理。子ども向けの画面の文章は「自然な漢字表記」で書き、ここで読みを付ける。
//  - 辞書 DICT（rpg-ruby-dict.js）：[表記, 読み]。表記が漢字＋送り仮名のときは漢字の部分だけにルビ。表記の途中に仮名がある語は、読みを「|」で漢字のかたまりごとに区切る（例 ['見た目','み|め']）。
//  - 書式 {漢字|よみ}：画面や文章に直接書く既存の記法。辞書より優先。
//  - render(s)：文字列 → 安全なHTML（エスケープしたうえで ruby タグを足す）。annotate(el)：DOMのテキストにルビを足す（タグを外して漢字だけに戻す経路は作らない）。
//  - 設定：setOn(false) でルビを隠す（初期値ON。保存キー ichimon.rpg.ruby）。隠すのは RPG の画面だけで、学習問題の文には触れない。
(function (root, factory) {
  const m = factory(typeof module === 'object' && module.exports ? require('./rpg-ruby-dict.js') : root.RPGRubyDict, root);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.RPGRuby = m;
})(typeof self !== 'undefined' ? self : this, function (DICT, root) {
  const KANJI = /[㐀-鿿々〆]/, KANA = /[぀-ヿ]/;
  const isK = c => KANJI.test(c);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NOTE = /\{([^|{}]+)\|([^{}]+)\}/g;
  const by = {};   // 先頭の1文字 → [{key, parts}]（長い表記が先）
  const extra = {};   // 名前 → {漢字|よみ} 書式（データ側の ruby 欄から登録）
  function parts(key, reading) {   // 表記と読み → [{t:文字列, r:読み|null}]
    const out = []; let i = 0; const rs = String(reading).split('|'); let ri = 0;
    while (i < key.length) {
      let j = i; const k = isK(key[i]);
      while (j < key.length && isK(key[j]) === k) j++;
      const seg = key.slice(i, j);
      if (k) out.push({ t: seg, r: rs.length === 1 ? rs[0] : (rs[ri++] || '') }); else out.push({ t: seg, r: null });
      i = j;
    }
    return out;
  }
  function add(key, reading) {
    if (!key || !reading) return;
    const p = parts(key, reading), k0 = key[0]; (by[k0] = by[k0] || []).push({ key, parts: p });
    by[k0].sort((a, b) => b.key.length - a.key.length);
  }
  DICT.forEach(([k, r]) => add(k, r));
  function registerNote(name, note) {   // データの ruby 欄（{漢字|よみ} 書式）から、名前全体の読みを登録する
    if (!name || !note || !/\{/.test(note)) return;
    let ok = true, i = 0; const ps = [];
    note.replace(NOTE, (m, a, b, off) => { if (off > i) ps.push({ t: note.slice(i, off), r: null }); ps.push({ t: a, r: b }); i = off + m.length; return m; });
    if (i < note.length) ps.push({ t: note.slice(i), r: null });
    if (ps.map(x => x.t).join('') !== name) ok = false;
    if (!ok) return;
    const k0 = name[0]; (by[k0] = by[k0] || []).push({ key: name, parts: ps }); by[k0].sort((a, b) => b.key.length - a.key.length);
  }
  const rubyHtml = (t, r) => '<ruby>' + esc(t) + '<rt>' + esc(r) + '</rt></ruby>';
  // 辞書で照合して [{t, r}] の並びにする（書式 {漢字|よみ} は呼び出し側で先に分ける）
  function scan(s) {
    s = String(s); const out = []; let i = 0, buf = '';
    const flush = () => { if (buf) { out.push({ t: buf, r: null }); buf = ''; } };
    while (i < s.length) {
      const c = s[i], cand = by[c];
      if (cand) {
        const hit = cand.find(e => s.startsWith(e.key, i));
        if (hit) { flush(); hit.parts.forEach(p => out.push({ t: p.t, r: p.r, k: hit.key })); i += hit.key.length; continue; }
      }
      buf += c; i++;
    }
    flush(); return out;
  }
  function render(s) {   // 文字列 → HTML。{漢字|よみ} を ruby に、残りの漢字は辞書で ruby に
    s = String(s); let out = '', i = 0;
    s.replace(NOTE, (m, a, b, off) => { out += seg(s.slice(i, off)) + rubyHtml(a, b); i = off + m.length; return m; });
    return out + seg(s.slice(i));
  }
  function seg(t) { return scan(t).map(p => p.r ? rubyHtml(p.t, p.r) : esc(p.t)).join(''); }
  // 辞書で読みが付かなかった漢字（検査用）
  function uncovered(s) {
    const out = new Set(); String(s).replace(NOTE, '').split('').length;
    const plain = String(s).replace(NOTE, ''); scan(plain).forEach(p => { if (!p.r) p.t.split('').forEach(c => { if (isK(c)) out.add(c); }); });
    return Array.from(out);
  }
  // ---- DOM ----
  const SKIP = { RUBY: 1, RT: 1, RP: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, OPTION: 1, SELECT: 1, CANVAS: 1, TITLE: 1, CODE: 1, NOSCRIPT: 1 };
  const SCOPE = '.rs-app, .rs-fx, .rpg-strip, #rwRoot, .rs-scope, [data-rb]';
  function annotate(el) {
    if (!el || !el.ownerDocument) return 0; const doc = el.ownerDocument; let n = 0;
    const walker = doc.createTreeWalker(el, 4 /* SHOW_TEXT */, { acceptNode: t => {
      if (!KANJI.test(t.nodeValue)) return 2;
      for (let p = t.parentNode; p && p !== el.parentNode; p = p.parentNode) { if (p.nodeType === 1 && (SKIP[p.nodeName] || p.hasAttribute('data-noruby'))) return 2; }
      return 1;
    } });
    const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(t => {
      const ps = scan(t.nodeValue); if (!ps.some(p => p.r)) return;
      const f = doc.createDocumentFragment();
      ps.forEach(p => { if (p.r) { const r = doc.createElement('ruby'); r.appendChild(doc.createTextNode(p.t)); const rt = doc.createElement('rt'); rt.textContent = p.r; r.appendChild(rt); f.appendChild(r); } else f.appendChild(doc.createTextNode(p.t)); });
      t.parentNode.replaceChild(f, t); n++;
    });
    wrapFlexRuby(el);
    return n;
  }
  // flex／grid の直下に「文字＋ruby」が並ぶと、ruby と文字が別々の箱になって縦中央に揃えられ、ルビ付きの漢字だけ下にずれる（WebKit＝iPad で目立つ）。
  // 並んだ文字と ruby を1つの span（rb-line）にまとめて、ふつうの1行として組ませる。
  function wrapFlexRuby(el) {
    if (!el || !el.querySelectorAll || !el.ownerDocument || !el.ownerDocument.defaultView) return;
    const doc = el.ownerDocument, gcs = doc.defaultView.getComputedStyle.bind(doc.defaultView), seen = new Set();
    Array.prototype.forEach.call(el.querySelectorAll('ruby'), r => {
      const p = r.parentNode; if (!p || p.nodeType !== 1 || seen.has(p) || p.classList.contains('rb-line')) return;
      seen.add(p); if (!/flex|grid/.test(gcs(p).display)) return;
      let run = [];
      const flush = () => { if (run.some(n => n.nodeName === 'RUBY')) { const s = doc.createElement('span'); s.className = 'rb-line'; p.insertBefore(s, run[0]); run.forEach(n => s.appendChild(n)); } run = []; };
      Array.prototype.slice.call(p.childNodes).forEach(n => { if (n.nodeType === 3 || n.nodeName === 'RUBY') run.push(n); else flush(); });
      flush();
    });
  }
  let obs = null, pending = new Set(), sched = 0;
  function flushPending() {
    sched = 0; const list = Array.from(pending); pending.clear();
    list.forEach(n => { if (!n.isConnected) return; const host = n.nodeType === 1 ? n : n.parentNode; if (!host || host.nodeType !== 1) return; if (host.closest && host.closest(SCOPE)) annotate(host); else if (host.querySelectorAll) host.querySelectorAll(SCOPE).forEach(annotate); });
  }
  function observe(doc) {
    doc = doc || (typeof document !== 'undefined' ? document : null); if (!doc || obs || typeof MutationObserver === 'undefined') return;
    obs = new MutationObserver(ms => { ms.forEach(m => { if (m.type === 'characterData') pending.add(m.target.parentNode); else m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) pending.add(n); }); }); if (!sched) sched = setTimeout(flushPending, 0); });
    obs.observe(doc.body || doc.documentElement, { childList: true, subtree: true, characterData: true });
    annotateAll(doc);
  }
  function annotateAll(doc) { doc = doc || document; doc.querySelectorAll(SCOPE).forEach(annotate); }
  // ---- 設定（初期ON）----
  const KEY = 'ichimon.rpg.ruby';
  function isOn() { try { return (root.localStorage.getItem(KEY) !== '0'); } catch (e) { return true; } }
  function setOn(on) {
    try { root.localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    if (root.document) root.document.documentElement.classList.toggle('rb-off', !on);
    return on;
  }
  function init() { if (root.document) root.document.documentElement.classList.toggle('rb-off', !isOn()); }
  return { DICT, add, registerNote, render, scan, uncovered, annotate, annotateAll, observe, isOn, setOn, init, esc };
});
