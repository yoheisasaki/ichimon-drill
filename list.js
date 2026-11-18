'use strict';
// 問題の一覧（ママ用）。localStorage は読まない・書かない。送信もしない。
const SUBJECTS = ['国語', '算数', '理科', '社会'];
const root = document.getElementById('list');
let DATA = null, subj = '全部', hide = false, term = '';
const revealed = new Set();

function match(q) {
  if (subj !== '全部' && q.subject !== subj) return false;
  if (!term) return true;
  const t = term.toLowerCase();
  return [q.q, q.a, q.unit || ''].some(s => plain(s).toLowerCase().includes(t));
}
function item(q) {
  const hid = hide && !revealed.has(q.id);
  const ch = (q.choices || []).map(c => `<span>${ruby(c)}</span>`).join('');
  const tags = (q.type === 'input' ? '<i class="tg">かいてこたえる</i>' : '') + (q.map ? '<i class="tg m">地図' + (q.map.hl ? '：' + esc(q.map.hl) : '') + '</i>' : '');
  const acc = q.type === 'input' && q.accept ? `<div class="acc">OK：${q.accept.map(esc).join(' ／ ')}</div>` : '';
  return `<li class="it" data-id="${esc(q.id)}"><div class="iq">${tags}${ruby(q.q)}</div>
    ${hid ? '<div class="tapshow">タップでこたえ</div>' : `<div class="ia">${ruby(q.a)}</div>${ch ? `<div class="ich">${ch}</div>` : ''}${acc}`}
    <div class="isrc">${esc(q.src || '')}</div></li>`;
}
function render() {
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
    <div class="cnt" id="cnt">${shown.length}問 ／ 全${all.length}問</div></div>${body || '<div class="empty">ありません</div>'}`;
  root.querySelectorAll('.fb[data-s]').forEach(b => b.onclick = () => { subj = b.dataset.s; render(); });
  document.getElementById('hd').onclick = () => { hide = !hide; revealed.clear(); render(); };
  const inp = document.getElementById('qs');
  inp.oninput = () => { term = inp.value.trim(); const p = inp.selectionStart; render(); const n = document.getElementById('qs'); n.focus(); try { n.setSelectionRange(p, p); } catch (e) {} };
  root.querySelectorAll('.it').forEach(li => li.onclick = () => {
    if (!hide) return;
    const id = li.dataset.id;
    if (revealed.has(id)) revealed.delete(id); else revealed.add(id);
    const y = window.scrollY; render(); window.scrollTo(0, y);
  });
}
fetch('data/questions.json', { cache: 'no-cache' }).then(r => r.json()).then(d => { DATA = d; render(); })
  .catch(() => { root.innerHTML = '<div class="empty">よみこめませんでした</div>'; });
