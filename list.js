'use strict';
// 問題の一覧（ママ用）。端末の記録（成績・選び・送信待ち）は読まない・書かない。
// 送るのは「ママの設定」（テスト対策のチェック・今回は出さない・問題の直し）だけ。送信先は common.js の SEND_URL（学習ボード）。
// 設定の写し（localStorage の ichimon.conf.v1）は、読めたとき・保存できたときに書く。
const SUBJECTS = ['国語', '算数', '理科', '社会'];
const LS_LDEV = 'ichimon.dev.v1.list';
const root = document.getElementById('list');
let DATA = null, RAW = [], CONF = emptyConf(), subj = '全部', hide = false, term = '', onlyPick = false;
let editing = null, draft = null, editMsg = '';
const revealed = new Set();

function sets() { return { pick: new Set(CONF.pick), off: new Set(CONF.off) }; }
function match(q) {
  if (subj !== '全部' && q.subject !== subj) return false;
  if (onlyPick && !CONF.pick.includes(q.id)) return false;
  if (!term) return true;
  const t = term.toLowerCase();
  return [q.q, q.a, q.unit || ''].some(s => plain(s).toLowerCase().includes(t));
}
function qById(id) { return DATA.questions.find(q => q.id === id); }
function attr(s) { return esc(s).replace(/"/g, '&quot;'); }
function item(q) {
  const hid = hide && !revealed.has(q.id) && editing !== q.id;
  const S = sets(), off = S.off.has(q.id), pk = S.pick.has(q.id), ed = !!CONF.edit[q.id];
  const ch = (q.choices || []).map(c => `<span>${ruby(c)}</span>`).join('');
  const tags = (q.type === 'input' ? '<i class="tg">かいてこたえる</i>' : '') + (q.map ? '<i class="tg m">地図' + (q.map.hl ? '：' + esc(q.map.hl) : '') + '</i>' : '') + (ed ? '<i class="tg m">直しあり</i>' : '');
  const acc = q.type === 'input' && q.accept ? `<div class="acc">OK：${q.accept.map(esc).join(' ／ ')}</div>` : '';
  return `<li class="it${off ? ' off' : ''}" data-id="${esc(q.id)}"><div class="iq">${tags}${ruby(q.q)}</div>
    ${hid ? '<div class="tapshow">タップでこたえ</div>' : `<div class="ia">${ruby(q.a)}</div>${ch ? `<div class="ich">${ch}</div>` : ''}${acc}`}
    <div class="isrc">${esc(q.src || '')}</div>
    <div class="ctl"><label class="pk"><input type="checkbox" data-act="pick" ${pk ? 'checked' : ''}>テスト対策</label><button class="fb offb" data-act="off" aria-pressed="${off}">${off ? '今回は出さない' : '今回出す'}</button><button class="fb" data-act="edit">編集</button></div>
    ${editing === q.id ? editForm(q) : ''}</li>`;
}
function editForm(q) {
  const d = draft;
  let body;
  if (q.type === 'input') {
    body = `<label>こたえ</label><input type="text" data-f="a" value="${attr(d.a)}"><label>OKのこたえ（「、」でくぎる）</label><input type="text" data-f="accept" value="${attr(d.accept)}">`;
  } else {
    body = `<label>せんたくし（正解の○をタップ）</label>${d.opts.map((o, i) => `<div class="eo"><button type="button" class="tap${d.ans === i ? ' sel' : ''}" data-act="ans" data-i="${i}" aria-label="正解にする">${d.ans === i ? '○' : ''}</button><input type="text" data-f="opt" data-i="${i}" value="${attr(o)}"></div>`).join('')}`;
  }
  return `<div class="ef"><label>もんだい</label><textarea data-f="q">${esc(d.q)}</textarea>${body}${editMsg ? `<div class="emsg">${esc(editMsg)}</div>` : ''}<p class="hint">ふりがなは つきません（変えなかった文字は、ふりがなのまま残ります）。</p><div class="row"><button type="button" class="fb sel" data-act="esave">保存</button><button type="button" class="fb" data-act="ecancel">やめる</button></div></div>`;
}
function startDraft(q) {
  draft = q.type === 'input'
    ? { q: plain(q.q), a: plain(q.a), accept: (q.accept || []).join('、') }
    : { q: plain(q.q), opts: [plain(q.a)].concat((q.choices || []).map(plain)), ans: 0 };
}
function readDraft() {
  if (!editing || !draft) return;
  const li = root.querySelector('.it[data-id="' + editing + '"]');
  if (!li || !li.querySelector('.ef')) return;
  const f = n => li.querySelector('[data-f="' + n + '"]');
  if (f('q')) draft.q = f('q').value;
  if (draft.opts) li.querySelectorAll('[data-f="opt"]').forEach(el => { draft.opts[+el.dataset.i] = el.value; });
  else { if (f('a')) draft.a = f('a').value; if (f('accept')) draft.accept = f('accept').value; }
}
// 保存用の値を作る。変えていない項目は元の文字（ふりがな付き）のまま使う。ダメなら {err}
function buildEdit(q) {
  const keep = (v, src) => { const hit = src.find(s => plain(s) === v); return hit === undefined ? v : hit; };
  const qq = draft.q.trim();
  if (!qq) return { err: 'もんだいが空です' };
  if (qq.length > 2000) return { err: 'もんだいが長すぎます（2000字まで）' };
  const o = { q: keep(qq, [q.q]) };
  if (q.type === 'input') {
    const a = draft.a.trim();
    if (!a) return { err: 'こたえが空です' };
    if (a.length > 2000) return { err: 'こたえが長すぎます（2000字まで）' };
    o.a = keep(a, [q.a]);
    const acc = draft.accept.split(/[、，,]/).map(x => x.trim()).filter(Boolean);
    o.accept = acc.length ? acc : [a];
  } else {
    const opts = draft.opts.map(x => x.trim());
    if (opts.some(x => !x)) return { err: '空のせんたくしがあります' };
    if (new Set(opts).size !== opts.length) return { err: '同じせんたくしがあります' };
    if (opts.some(x => x.length > 2000)) return { err: 'せんたくしが長すぎます（2000字まで）' };
    const src = [q.a].concat(q.choices || []);
    o.a = keep(opts[draft.ans], src);
    o.choices = opts.filter((_, i) => i !== draft.ans).map(x => keep(x, src));
  }
  return o;
}

// ---------- 保存（1つずつ順番に送る。押したらすぐ送る） ----------
let chain = Promise.resolve(), pendingN = 0, failed = [], stat = '';
function getDev() {
  let d = null;
  try { d = localStorage.getItem(LS_LDEV); } catch (e) {}
  if (!d) {
    d = 'list-' + Array.from({ length: 10 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
    try { localStorage.setItem(LS_LDEV, d); } catch (e) {}
  }
  return d;
}
// 応答が読めて ok:true なら成功。サーバーが断ったら失敗。応答が読めない（CORS等）ときだけ no-cors で同じものをもう一度送る（同じ変更を2回送っても結果は同じ）
async function postConf(changes) {
  const opt = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ api: 'ichimon_conf', dev: getDev(), changes }) };
  const url = SEND_OVERRIDE || SEND_URL;
  let j;
  try { const r = await fetch(url, opt); j = await r.json(); }
  catch (e) { await fetch(url, Object.assign({ mode: 'no-cors' }, opt)); return true; }
  return !!(j && j.ok);
}
function statHtml() {
  if (stat === 'saving') return '<span class="stat">保存中…</span>';
  if (stat === 'ok') return '<span class="stat">保存しました</span>';
  if (stat === 'ng') return '<span class="stat err">保存できませんでした（<button id="retry">もう一度</button>）</span>';
  return '';
}
function setStat(s) { stat = s; const el = document.getElementById('st'); if (el) el.innerHTML = statHtml(); }
function send(changes) {
  pendingN++; setStat('saving');
  chain = chain.then(() => postConf(changes).catch(() => false)).then(ok => {
    pendingN--;
    if (!ok) { failed = failed.concat(changes); setStat('ng'); }
    else { if (!failed.length) confCachePut(CONF); if (!pendingN) setStat(failed.length ? 'ng' : 'ok'); }
  });
}
function retry() {
  const ch = failed; failed = [];
  const last = {}; ch.forEach(c => { last[c.kind + '|' + c.qid] = c; });
  send(Object.keys(last).map(k => last[k]));
}

function setList(key, id, on) {
  const a = CONF[key].filter(x => x !== id);
  CONF[key] = on ? a.concat(id) : a;
}
function refreshItem(id) {
  const li = root.querySelector('.it[data-id="' + id + '"]'), q = qById(id);
  if (!li || !q) return;
  const t = document.createElement('div'); t.innerHTML = item(q);
  li.replaceWith(t.firstElementChild);
}
function cntText() {
  const n = DATA.questions.filter(match).length;
  return n + '問 ／ 全' + DATA.questions.length + '問　テスト対策 ' + CONF.pick.filter(id => qById(id)).length + '問';
}
function refreshHead() {
  const el = document.getElementById('cnt');
  if (el) el.textContent = cntText();
  const b = document.getElementById('po');
  if (b) b.textContent = 'テスト対策だけ表示（' + CONF.pick.length + '）';
}

function render() {
  readDraft();
  const all = DATA.questions;
  const shown = all.filter(match);
  const subs = SUBJECTS.filter(s => all.some(q => q.subject === s));
  let body = '';
  DATA.tests.forEach(t => {
    const tq = shown.filter(q => q.test === t.id);
    if (!tq.length) return;
    body += `<h2 class="ht">${esc(t.name)}${t.date ? '（' + esc(t.date.slice(5).replace('-', '/')) + '）' : ''}<small>${tq.length}問</small></h2>`;
    SUBJECTS.forEach(s => {
      const sq = tq.filter(q => q.subject === s);
      if (!sq.length) return;
      body += `<h3 class="hs">${s}<small>${sq.length}問</small></h3>`;
      const gs = [];
      sq.forEach(q => { const g = groupOf(q); if (!gs.includes(g)) gs.push(g); });
      gs.forEach(g => {
        const gq = sq.filter(q => groupOf(q) === g);
        body += `<h4 class="hg">${ruby(GROUP_RUBY[g] || g)}<small>${gq.length}問</small></h4><ul class="its">${gq.map(item).join('')}</ul>`;
      });
    });
  });
  const keep = term;
  root.innerHTML = `<div class="lhead">
    <div class="lt">問題の一覧（ママ用）<a href="mama.html">もどる</a></div>
    <div class="lf">${['全部'].concat(subs).map(s => `<button class="fb ${subj === s ? 'sel' : ''}" data-s="${s}">${s === '全部' ? 'ぜんぶ' : s}</button>`).join('')}</div>
    <div class="lq"><input id="qs" type="search" placeholder="問題・こたえ・単元でさがす" value="${esc(keep).replace(/"/g, '&quot;')}"><button class="fb ${hide ? 'sel' : ''}" id="hd">こたえをかくす</button></div>
    <div class="lq" style="margin-top:6px"><button class="fb ${onlyPick ? 'sel' : ''}" id="po">テスト対策だけ表示（${CONF.pick.length}）</button><span id="st">${statHtml()}</span></div>
    <div class="cnt" id="cnt">${cntText()}</div></div>${body || '<div class="empty">ありません</div>'}`;
  root.querySelectorAll('.fb[data-s]').forEach(b => b.onclick = () => { subj = b.dataset.s; render(); });
  document.getElementById('hd').onclick = () => { hide = !hide; revealed.clear(); render(); };
  document.getElementById('po').onclick = () => { onlyPick = !onlyPick; render(); };
  const inp = document.getElementById('qs');
  inp.oninput = () => { term = inp.value.trim(); const p = inp.selectionStart; render(); const n = document.getElementById('qs'); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
}

root.addEventListener('click', e => {
  if (e.target.closest('#retry')) return retry();
  const li = e.target.closest('.it');
  if (!li) return;
  const id = li.dataset.id, q = qById(id), act = e.target.closest('[data-act]');
  if (!act) {
    if (e.target.closest('.ef') || e.target.closest('.ctl')) return;
    if (!hide) return;
    if (revealed.has(id)) revealed.delete(id); else revealed.add(id);
    const y = window.scrollY; render(); window.scrollTo(0, y);
    return;
  }
  const a = act.dataset.act;
  if (a === 'pick') { setList('pick', id, act.checked); refreshHead(); send([{ qid: id, kind: 'pick', val: act.checked ? '1' : '0' }]); }
  else if (a === 'off') { const on = !CONF.off.includes(id); setList('off', id, on); refreshItem(id); send([{ qid: id, kind: 'off', val: on ? '1' : '0' }]); }
  else if (a === 'edit') {
    const prev = editing; readDraft(); editing = null;
    if (prev && prev !== id) refreshItem(prev);
    if (prev === id) return refreshItem(id); // もう一度押すと閉じる
    editing = id; editMsg = ''; startDraft(q); refreshItem(id);
  }
  else if (a === 'ans') { readDraft(); draft.ans = +act.dataset.i; refreshItem(id); }
  else if (a === 'ecancel') { editing = null; refreshItem(id); }
  else if (a === 'esave') {
    readDraft();
    const v = buildEdit(q);
    if (v.err) { editMsg = v.err; return refreshItem(id); }
    CONF.edit[id] = Object.assign({}, v, { at: new Date().toISOString().slice(0, 10) });
    DATA.questions = applyEdits(RAW, CONF);
    editing = null; editMsg = '';
    refreshItem(id);
    send([{ qid: id, kind: 'edit', val: v }]);
  }
});

Promise.all([fetch('data/questions.json', { cache: 'no-cache' }).then(r => r.json()), loadConf()]).then(([d, conf]) => {
  DATA = d; RAW = d.questions; CONF = conf; DATA.questions = applyEdits(RAW, CONF); render();
}).catch(() => { root.innerHTML = '<div class="empty">よみこめませんでした</div>'; });
