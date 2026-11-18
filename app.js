'use strict';
// 送信先（学習ボードの Apps Script Webアプリ）
const SEND_URL = 'https://script.google.com/macros/s/AKfycbwR6PPGrKn5HL1yJ8-xc_sjV-kaEDY2dv0jD_e7XyRSjQUd2E_2_Pq-rGE6tWxHRj3QFg/exec';
const PARAMS = new URLSearchParams(location.search);
const MAMA = PARAMS.get('mama') === '1'; // ママモード：送信せず、保存キーも別名
const NOSEND = PARAMS.get('nosend') === '1' || MAMA;
const SEND_OVERRIDE = PARAMS.get('send'); // テスト用：送信先を差し替え
const ROUND = 10, MASTER = 3, REASK_GAP = 3, REASK_MAX = 5, BATCH = 200;
const SUBJECTS = ['国語', '算数', '理科', '社会'];
const LS_SFX = MAMA ? '.mama' : '';
const LS_STATS = 'ichimon.stats.v1' + LS_SFX, LS_Q = 'ichimon.queue.v1' + LS_SFX, LS_DEV = 'ichimon.dev.v1' + LS_SFX, LS_SEL = 'ichimon.sel.v1' + LS_SFX;
// ---------- 保存（localStorage。使えなくても動く） ----------
const mem = {};
function lsGet(k) { try { const v = localStorage.getItem(k); return v === null ? (mem[k] ?? null) : v; } catch (e) { return mem[k] ?? null; } }
function lsSet(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} }
function load(k, d) { try { const v = lsGet(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function save(k, v) { lsSet(k, JSON.stringify(v)); }

let dev = lsGet(LS_DEV);
if (!dev) { dev = Array.from({ length: 16 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join(''); lsSet(LS_DEV, dev); }
let stats = load(LS_STATS, {});   // qid -> {w:まちがい回数, c:正解回数, s:続けて正解, l:最後の結果('o'|'x'), t:最後の日時}
let queue = load(LS_Q, { seq: 0, rows: [] });

// ---------- ふりがな ----------
// ---------- データ ----------
let DATA = null, current = null, filter = '全部';
let units = {}; // 教科 -> 選んだまとまり（空＝ぜんぶまぜる）
(function () { const v = load(LS_SEL, null); if (v && typeof v === 'object') { if (typeof v.filter === 'string') filter = v.filter; if (v.units && typeof v.units === 'object') units = v.units; } })();
function saveSel() { save(LS_SEL, { filter, units }); }
function groupsOf(subject) {
  const seen = [];
  qs().filter(q => q.subject === subject).forEach(q => { const g = groupOf(q); if (!seen.includes(g)) seen.push(g); });
  return seen;
}
let S = null; // 回の状態
const app = document.getElementById('app');

function qs() { return DATA.questions.filter(q => q.test === current.id); }
function st(id) { return stats[id] || { w: 0, c: 0, s: 0, l: '', t: '' }; }
function isMaster(id) { return st(id).s >= MASTER; }
function isHard(id) { const x = st(id); return x.w > 0 && x.s < MASTER; }
function counts(list) { return { hard: list.filter(q => isHard(q.id)).length, ok: list.filter(q => isMaster(q.id)).length, all: list.length }; }
function score(q) {
  const x = st(q.id), seen = x.w + x.c > 0;
  return x.w * 3 + (x.l === 'x' ? 5 : 0) + (seen ? 0 : 2) - x.s - (x.s >= MASTER ? 3 : 0);
}
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(list, n) {
  return shuffle(list).map(q => [q, score(q)]).sort((a, b) => b[1] - a[1]).slice(0, n).map(p => p[0]);
}
function pool() {
  const sel = (units[filter] || []);
  return qs().filter(q => filter === '全部' || (filter === 'ちず' ? !!q.map : filter === 'かく' ? q.type === 'input' : q.subject === filter && (!sel.length || sel.includes(groupOf(q)))));
}
// 地図は地図問題が初めて出るときに1回だけ読む
let mapsP = null;
function loadMaps() {
  if (!mapsP) mapsP = Promise.all([fetch('data/map_chubu_kanto.json').then(r => r.json()), fetch('data/features.json').then(r => r.json())]).catch(e => { mapsP = null; throw e; });
  return mapsP;
}
function mapLabel(q) {
  const m = q.map; if (!m) return '';
  return '地図：' + (m.hl && m.mark ? m.hl + 'の' + m.mark : (m.hl || m.mark || ''));
}

// ---------- 画面：最初 ----------
function home() {
  const all = qs();
  const subs = SUBJECTS.filter(s => all.some(q => q.subject === s));
  if (filter !== '全部' && filter !== 'ちず' && filter !== 'かく' && !subs.includes(filter)) filter = '全部';
  let gs = [];
  if (subs.includes(filter)) {
    gs = groupsOf(filter);
    units[filter] = (units[filter] || []).filter(g => gs.includes(g));
  }
  const card = (label, list, cls, key) => {
    const c = counts(list);
    return `<button class="subj ${cls} ${filter === key ? 'sel' : ''}" data-f="${key}">${label}<small>にがて ${c.hard}こ ／ おぼえた ${c.ok}こ<br>ぜんぶ ${c.all}こ</small></button>`;
  };
  const p = pool(), hard = p.filter(q => isHard(q.id));
  app.innerHTML = `
    <h1>一問一答</h1>
    ${MAMA ? '<div class="mama"><b>ママ用</b>（きろくは のこりません／むすこさんの記録とは べつ）<a href="list.html">問題の一覧を見る</a></div>' : ''}
    <div class="sub">${esc(current.name)}${current.date ? '（' + esc(current.date.slice(5).replace('-', '/')) + '）' : ''}</div>
    <div class="subjects">${card('ぜんぶ', all, 'all', '全部')}${subs.map(s => card(s, all.filter(q => q.subject === s), '', s)).join('')}${all.some(q => q.map) ? card('ちず', all.filter(q => q.map), '', 'ちず') : ''}${all.some(q => q.type === 'input') ? card('かいて こたえる', all.filter(q => q.type === 'input'), '', 'かく') : ''}</div>
    ${gs.length ? `<div class="chips"><button class="chip ${units[filter].length ? '' : 'sel'}" data-g="">ぜんぶまぜる<small>${all.filter(q => q.subject === filter).length}こ</small></button>${gs.map(g => { const l = all.filter(q => q.subject === filter && groupOf(q) === g), c = counts(l); return `<button class="chip ${units[filter].includes(g) ? 'sel' : ''}" data-g="${esc(g)}">${ruby(GROUP_RUBY[g] || g)}<small>にがて ${c.hard} ／ ${c.all}こ</small></button>`; }).join('')}</div>` : ''}
    <button class="big go" id="go">スタート（${Math.min(ROUND, p.length)}もん）</button>
    <button class="big hard" id="hard" ${hard.length ? '' : 'disabled'}>にがてだけ（${hard.length}こ）</button>
    <div class="credit">地図：国土数値情報（行政区域データ）を加工して作成</div>`;
  app.querySelectorAll('.subj').forEach(b => b.onclick = () => { filter = b.dataset.f; saveSel(); home(); });
  app.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    const g = b.dataset.g, cur = units[filter] || [];
    units[filter] = !g ? [] : cur.includes(g) ? cur.filter(x => x !== g) : cur.concat(g);
    saveSel(); home();
  });
  document.getElementById('go').onclick = () => start(pick(p, ROUND));
  document.getElementById('hard').onclick = () => start(pick(hard, ROUND));
}

// ---------- 回 ----------
function start(list) {
  if (!list.length) return home();
  S = { sess: dev.slice(0, 4) + '-' + Date.now().toString(36), queue: list.slice(), idx: 0, total: list.length, reask: 0, correct: 0, wrong: [], wrongIds: new Set(), skips: 0, seen: new Set(), locked: false, timer: null };
  question();
}
function question() {
  const q = S.queue[S.idx];
  S.locked = false; S.cur = q;
  const isIn = q.type === 'input';
  const opts = isIn ? [] : shuffle([q.a, ...q.choices]);
  S.opts = opts;
  app.innerHTML = `
    <div class="top">
      <button class="btn-quit" id="quit">✕ やめる</button>
      <div class="dname">${ruby(q.subject)}<br>${ruby(q.unit || '')}</div>
      <div class="pill">${S.idx + 1} / ${S.queue.length}</div>
    </div>
    <div class="bar"><i style="width:${(S.idx / S.queue.length) * 100}%"></i></div>
    <div class="card${q.map ? ' withmap' : ''}"><div class="qt">${ruby(q.q)}</div></div>
    ${q.map ? '<div class="map' + (isIn ? ' small' : '') + '" id="map"></div>' : ''}
    ${isIn ? `<div class="inbox"><input id="ans" class="ans" type="text" inputmode="text" lang="ja" placeholder="ひらがなで かいてね" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"><button class="big go" id="submit" disabled>こたえる</button><button class="skip" id="skip">わかんない</button></div>` : ''}
    <div class="choices">${opts.map((o, i) => `<button class="choice" data-i="${i}"><span class="dot"></span><span>${ruby(o)}</span></button>`).join('')}</div>
    ${isIn ? '' : '<div class="skipw"><button class="skip" id="skipc">わかんない</button></div>'}
    <div class="next" id="next"></div>
    <div class="score">せいかい ${S.correct}こ</div>`;
  document.getElementById('quit').onclick = () => { clearTimeout(S.timer); app.onclick = null; flush(); home(); };
  app.querySelectorAll('.choice').forEach(b => b.onclick = () => answer(+b.dataset.i));
  if (isIn) setupInput(q); else document.getElementById('skipc').onclick = () => answer(-1);
  if (q.map) loadMaps().then(([md, ft]) => { const c = document.getElementById('map'); if (c && S.cur === q) renderMap(c, md, ft, q.map, { aspect: isIn ? 2.4 : 1.7 }); }).catch(() => {});
}
// 入力問題：ひらがな・カタカナ・全角半角・空白・末尾の「。」をそろえて比べる
function norm(t) {
  return String(t).normalize('NFKC').replace(/\s+/g, '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[。.．]+$/, '');
}
function judge(q, text) { const n = norm(text); return !!n && q.accept.some(a => norm(a) === n); }
function setupInput(q) {
  const inp = document.getElementById('ans'), sub = document.getElementById('submit'), skip = document.getElementById('skip');
  const sync = () => { sub.disabled = !norm(inp.value); };
  inp.addEventListener('input', sync);
  inp.addEventListener('focus', () => setTimeout(() => sub.scrollIntoView({ block: 'end', behavior: 'smooth' }), 350));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && norm(inp.value)) { e.preventDefault(); answerInput(inp.value); } });
  sub.onclick = () => { if (norm(inp.value)) answerInput(inp.value); };
  skip.onclick = () => answerInput(null);
}
function answerInput(text) {
  if (S.locked) return; S.locked = true;
  const q = S.cur, skipped = text === null, ok = !skipped && judge(q, text);
  const inp = document.getElementById('ans');
  inp.blur(); inp.readOnly = true;
  document.getElementById('submit').disabled = true;
  if (skipped) S.skips++;
  record(q, ok, skipped ? 'わかんない' : String(text).trim(), skipped);
  const nx = document.getElementById('next');
  if (ok) {
    if (!S.seen.has(q.id)) S.correct++;
    S.seen.add(q.id);
    inp.classList.add('ok');
    nx.innerHTML = '<span class="okmsg">○ せいかい！</span>';
    document.querySelector('.score').textContent = 'せいかい ' + S.correct + 'こ';
    S.timer = setTimeout(advance, 800);
  } else {
    S.seen.add(q.id);
    if (!S.wrongIds.has(q.id)) { S.wrongIds.add(q.id); S.wrong.push(q); }
    inp.classList.add('ng');
    if (S.reask < REASK_MAX) { S.reask++; const at = Math.min(S.idx + REASK_GAP, S.queue.length); S.queue.splice(at, 0, q); }
    nx.innerHTML = '<div class="correct">× こたえ：' + ruby(q.a) + '</div>';
    S.timer = setTimeout(() => {
      nx.insertAdjacentHTML('beforeend', '<div class="tapnext">タップして つぎへ ▶</div>');
      app.onclick = e => { if (e.target.closest('#quit')) return; app.onclick = null; advance(); };
    }, 1100);
  }
}
function answer(i) {
  if (S.locked) return; S.locked = true;
  const q = S.cur, skipped = i < 0, picked = skipped ? 'わかんない' : S.opts[i], ok = !skipped && picked === q.a;
  const btns = [...app.querySelectorAll('.choice')];
  if (skipped) { S.skips++; }
  record(q, ok, picked, skipped);
  if (ok) {
    if (!S.seen.has(q.id)) S.correct++;
    S.seen.add(q.id);
    btns[i].classList.add('ok'); btns[i].querySelector('.dot').textContent = '○';
    document.querySelector('.score').textContent = 'せいかい ' + S.correct + 'こ';
    S.timer = setTimeout(advance, 600);
  } else {
    S.seen.add(q.id);
    if (!S.wrongIds.has(q.id)) { S.wrongIds.add(q.id); S.wrong.push(q); }
    if (!skipped) { btns[i].classList.add('ng'); btns[i].querySelector('.dot').textContent = '×'; }
    btns.forEach((b, j) => { if (S.opts[j] === q.a) b.classList.add('glow'); else if (j !== i) b.classList.add('dim'); });
    if (S.reask < REASK_MAX) { S.reask++; const at = Math.min(S.idx + REASK_GAP, S.queue.length); S.queue.splice(at, 0, q); }
    const nx = document.getElementById('next');
    S.timer = setTimeout(() => {
      nx.textContent = 'タップして つぎへ ▶';
      app.onclick = e => { if (e.target.closest('#quit')) return; app.onclick = null; advance(); };
    }, 1100);
  }
}
function advance() {
  clearTimeout(S.timer); app.onclick = null;
  S.idx++;
  if (S.idx >= S.queue.length) return result();
  question();
}

// ---------- 画面：おわり ----------
function result() {
  flush();
  const right = S.total - S.wrong.length;
  app.innerHTML = `
    <h1>おわり！</h1>
    <div class="res-score">${right}<small> / ${S.total} せいかい</small></div>
    ${S.skips ? `<div class="skipcount">わかんない ${S.skips}こ</div>` : ''}
    ${S.wrong.length ? `<div class="wrong-list"><h2>まちがえた もんだい</h2>${S.wrong.map(q => `<div class="wi">${q.map ? `<span class="ml">${esc(mapLabel(q))}</span>` : ''}${ruby(q.q)}<b>こたえ：${ruby(q.a)}</b></div>`).join('')}</div>` : '<div class="perfect">ぜんぶ せいかい！ すごい！</div>'}
    <button class="big hard" id="again" ${S.wrong.length ? '' : 'disabled'}>まちがえたのだけ もう1回</button>
    <button class="big go" id="more">つぎの10もん</button>
    <button class="big plain" id="end">おわる</button>`;
  document.getElementById('again').onclick = () => start(shuffle(S.wrong));
  document.getElementById('more').onclick = () => {
    const p = pool(), done = new Set(S.queue.map(q => q.id)), fresh = p.filter(q => !done.has(q.id));
    start(pick(fresh.length >= 3 ? fresh : p, ROUND));
  };
  document.getElementById('end').onclick = () => home();
}

// ---------- 記録と送信 ----------
function now() {
  const d = new Date(), p = n => String(n).padStart(2, '0'), o = -d.getTimezoneOffset(), a = Math.abs(o);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${o >= 0 ? '+' : '-'}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}
function record(q, ok, picked, skipped) {
  const t = now(), x = Object.assign({ w: 0, c: 0, s: 0, l: '', t: '' }, stats[q.id]);
  if (ok) { x.c++; x.s++; x.l = 'o'; } else { x.w++; x.s = 0; x.l = 'x'; if (skipped) x.k = (x.k || 0) + 1; }
  x.t = t; stats[q.id] = x; save(LS_STATS, stats);
  queue.seq++;
  const row = { rid: dev + '-' + queue.seq, t, test: q.test, qid: q.id, ok, pick: plain(picked), sess: S.sess };
  if (skipped) row.skip = 1;
  queue.rows.push(row);
  save(LS_Q, queue);
}
let sending = false;
function post(rows, mode) {
  const opt = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ api: 'ichimon', dev, rows }) };
  if (mode) opt.mode = mode;
  return fetch(SEND_OVERRIDE || SEND_URL, opt);
}
// 方式：まず通常の fetch。応答が読めて ok:true なら、送れた分を消す。
// 応答が読めない（CORS等で例外）ときは mode:'no-cors' で同じ行をもう一度送り、
// 送信が成立（不透明な応答）したら消す。通信自体の失敗なら残して次回再送。
// 二重送信はサーバー側が rid で弾く。
async function flush() {
  if (NOSEND || sending || !queue.rows.length) return;
  sending = true;
  try {
    while (queue.rows.length) {
      const rows = queue.rows.slice(0, BATCH); let sent = false;
      try {
        const r = await post(rows);
        const j = await r.json();
        if (j && j.ok) sent = true; else break;
      } catch (e) {
        try { await post(rows, 'no-cors'); sent = true; } catch (e2) { break; }
      }
      if (!sent) break;
      const gone = new Set(rows.map(r => r.rid));
      queue.rows = queue.rows.filter(r => !gone.has(r.rid)); save(LS_Q, queue);
    }
  } finally { sending = false; }
}
window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

// ---------- 起動 ----------
fetch('data/questions.json', { cache: 'no-cache' }).then(r => r.json()).then(d => {
  DATA = d; current = d.tests.find(t => t.current) || d.tests[0];
  home(); flush();
}).catch(() => { app.innerHTML = '<div class="empty">もんだいを よみこめませんでした。<br>ネットを つないで もう一度ひらいてね。</div>'; });
