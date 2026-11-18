'use strict';
// ルビ辞書の抜け検査：子ども向けの文言（データ・会話・画面の文字列）の漢字のうち、辞書でも {漢字|よみ} でも読みが付かないものを一覧にする。
// node rpg/tools/ruby_audit.js            … 読みが付かない漢字の連なりと、出てくる文脈
// node rpg/tools/ruby_audit.js --check    … 抜けがあれば終了コード1（テスト用）
const fs = require('fs'), path = require('path');
const R = require('../js/rpg-ruby.js'), D = require('../js/rpg-data.js'), W = require('../js/rpg-world.js'), ST = require('../js/rpg-story.js'), M = require('../js/rpg-meta.js');
const KANJI = /[㐀-鿿々〆]/;
const ROOT = path.join(__dirname, '..', '..');
// 名前の読み（データの ruby 欄）を登録
Object.values(D.JOBS).forEach(j => R.registerNote(j.name, j.ruby)); Object.values(D.SKILLS).forEach(s => R.registerNote(s.name, s.ruby)); D.REGIONS.forEach(r => R.registerNote(r.name, r.ruby));
const found = new Map();   // 連なり → {n, ctx}
const seenTexts = new Set();
function see(text, ctx) {
  text = String(text); if (!KANJI.test(text)) return; seenTexts.add(text);
  const plain = text.replace(/\{([^|{}]+)\|([^{}]+)\}/g, '');
  const ps = R.scan(plain); let run = '';
  const flush = () => { if (run) { const e = found.get(run) || { n: 0, ctx: ctx + '：' + text.slice(0, 40) }; e.n++; found.set(run, e); run = ''; } };
  ps.forEach(p => { if (p.r) { flush(); return; } p.t.split('').forEach(c => { if (KANJI.test(c)) run += c; else flush(); }); flush(); });
  flush();
}
// ---- データ ----
const seenObj = new Set();
function walk(o, ctx, depth) {
  if (depth > 6 || o == null) return;
  if (typeof o === 'string') { see(o, ctx); return; }
  if (typeof o !== 'object' || seenObj.has(o)) return; seenObj.add(o);
  if (Array.isArray(o)) { o.forEach((x, i) => walk(x, ctx, depth + 1)); return; }
  Object.keys(o).forEach(k => { if (k === 'ruby' || k === 'id') return; walk(o[k], ctx + '.' + k, depth + 1); });
}
walk(D.JOBS, 'JOBS', 0); walk(D.SKILLS, 'SKILLS', 0); walk(D.PASSIVES, 'PASSIVES', 0); walk(D.REGIONS.map(r => ({ name: r.name, points: r.points, mat: r.mat, item: r.item, story: r.story, enemies: r.enemies.map(e => ({ name: e.name, p: e.pattern.map(p => p.n) })), boss: { name: r.boss.name, p: r.boss.pattern.map(p => p.n) } })), 'REGIONS', 0);
Object.values(D.ITEMS).forEach(i => { see(i.name, 'ITEM'); see(M.effectShort(i.id), 'EFFECT'); see(M.effectText(i.id), 'EFFECTTEXT'); });
walk(W.QUESTS && Object.values(W.QUESTS).map(q => ({ name: q.name, segs: q.segs.map(s => ({ p: s.point })) })), 'QUESTS', 0); walk(W.BG_NAMES, 'BGN', 0); walk(W.UNIQ, 'UNIQ', 0); walk(W.SECRET_DEFS, 'SECRET', 0); walk(W.TRIALS, 'TRIALS', 0);
walk(ST.R, 'STORY', 0); walk(ST.ENDING, 'ENDING', 0);
D.ROUTE.forEach(r => ST.pagesFor(r).forEach(p => see(p.text, 'PAGE'))); Object.values(W.QUESTS).forEach(q => q.segs.forEach(r => ST.pagesFor(r).forEach(p => see(p.text, 'QPAGE'))));
Object.values(D.SKILLS).forEach(s => { see(M.skillText(s, 99), 'SKILLTEXT'); });
try { M.achievements && null; } catch (e) {}
// ---- 画面・UI の文字列（ソースの日本語の塊）----
const FILES = ['rpg/js/rpg-screens.js', 'rpg/js/rpg-ui.js', 'rpg/js/rpg-meta.js', 'rpg/js/rpg-core.js', 'rpg/js/rpg-battle.js', 'rpg/js/rpg-adventure.js', 'rpg/js/rpg-world.js'];
const PAT = /[^'"`<>{}$\n]*[㐀-鿿][^'"`<>{}$\n]*/g;
FILES.forEach(f => {
  fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
    const s = line.trim(); if (s.startsWith('//') || s.startsWith('/*') || s.startsWith('*')) return;
    const code = line.replace(/\s\/\/[^'"`]*$/, '').replace(/\/\*.*?\*\//g, '');
    let m; PAT.lastIndex = 0;
    while ((m = PAT.exec(code))) {
      const c = m[0]; const a = m.index, b = a + c.length;
      if ((a > 0 && code[a - 1] === '{' && code[b] === '}')) continue;   // {漢字|よみ} の中
      if (/\|[ぁ-んー]+$/.test(c.trim())) continue;
      if (/^[\s　]*$/.test(c)) continue;
      see(c.trim(), f.replace('rpg/js/', '') + ':' + (i + 1));
    }
  });
});
// --review：1文字の辞書項目（送り仮名の続きで読みが変わりうる）が当たった箇所を一覧にする。読み違いを目で確かめるため
if (process.argv.includes('--review')) {
  const rv = new Map();
  const probe = (text) => { text = String(text).replace(/\{([^|{}]+)\|([^{}]+)\}/g, ''); const ps = R.scan(text); let pos = 0; ps.forEach(p => { if (p.r && p.k && p.k.length === 1) { const ctx = text.slice(Math.max(0, pos - 1), pos + 4); rv.set(p.t + text[pos + 1] + (text[pos + 2] || '') + ' → ' + p.r, ctx); } pos += p.t.length; }); };
  seenTexts.forEach(probe);
  Array.from(rv.keys()).sort().forEach(k => console.log(k + '	' + rv.get(k))); process.exit(0);
}
const rows = Array.from(found.entries()).sort((a, b) => b[1].n - a[1].n);
if (process.argv.includes('--check')) { if (rows.length) { console.log('ルビ辞書の抜け ' + rows.length + ' 件'); rows.slice(0, 40).forEach(([k, v]) => console.log(k, v.n, v.ctx)); process.exit(1); } console.log('ルビ辞書の抜けなし'); process.exit(0); }
rows.forEach(([k, v]) => console.log(k + '\t' + v.n + '\t' + v.ctx));
console.log('---- 抜け ' + rows.length + ' 件');
