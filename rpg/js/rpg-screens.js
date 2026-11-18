'use strict';
// 画面（第2段）：ホームの上部・下部ナビ・ぼうけん（地図）・まち・じぶん・装備・店・鍛冶・転職・技設定・外見・図鑑・実績
// 絵は全て仮（コード描画・CSS）。ロジックは rpg-meta.js。ここはDOMだけ。
(function (root) {
  const RPG = root.RPG; if (!RPG) return;
  const D = root.RPGData, C = root.RPGCore, B = root.RPGBattle, M = root.RPGMeta, SP = root.RPGSprites, A = root.RPGAdv, W = root.RPGWorld, ST = root.RPGStory;
  const doc = root.document, app = () => doc.getElementById('app');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NOW = () => (root.__RPG_NOW ? root.__RPG_NOW() : Date.now());
  const reduceMotion = () => { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const save = () => RPG.save;
  const UI = { screen: 'home', params: {}, eq: null, slot: 'weapon', shopTab: 'weapon', confirm: null, tier: 'base', sel: null, tactic: null, look: null, name: '', codexTab: 'enemy', msg: '' };
  const TABS = [['home', 'ホーム'], ['adv', 'ぼうけん'], ['town', 'まち'], ['me', 'じぶん']];
  const ROOT_OF = { adv: 'adv', town: 'town', me: 'me', place: 'town', equip: 'me', shop: 'town', forge: 'town', jobs: 'town', jobdetail: 'town', loadout: 'adv', look: 'me', codex: 'me', ach: 'town', data: 'me' };
  const PARENT = { place: 'town', equip: 'me', shop: 'place', forge: 'place', jobs: 'place', jobdetail: 'jobs', loadout: 'adv', look: 'me', codex: 'me', ach: 'place', data: 'me' };
  const TACTICS = [['auto', 'おまかせ', 'ようすを見て 自動でえらぶ'], ['attack', 'せめる', 'こうげきを おもに。回復は HPがひくい時だけ'], ['guard', 'まもる', '予告された大技にそなえ、回復も早め']];

  // ---------- 小さな部品 ----------
  function look() { return M.lookOf(save()); }
  function hero(canvas, job, k, o) {   // 主人公（仮絵）。canvas に 14x(16) ドットを k 倍で描く
    if (!canvas) return; const W = 20, H = 18; canvas.width = W; canvas.height = H; canvas.style.width = (W * k) + 'px'; canvas.style.height = (H * k) + 'px';
    const g = canvas.getContext('2d'); g.clearRect(0, 0, W, H); o = o || {};
    if (o.bg) SP.drawBackground(g, W, H, o.bg);
    SP.drawHero(g, job, 3, H - 1, { look: o.look === false ? null : (o.look || look()), tint: o.tint, outfit: o.look === false ? null : M.costumeColor(save()) });
  }
  function enemyCv(canvas, id, boss, k) { const W = 18, H = 16; canvas.width = W; canvas.height = H; canvas.style.width = W * k + 'px'; canvas.style.height = H * k + 'px'; const g = canvas.getContext('2d'); SP.drawEnemy(g, id, boss, 2, H - 1, {}); }
  function jobSprites() { app().querySelectorAll('canvas[data-job]').forEach(c => hero(c, c.dataset.job, +c.dataset.k || 3, { look: c.dataset.plain ? false : undefined })); }
  const bar = (v, max) => `<div class="rs-bar"><i style="width:${max ? Math.min(100, Math.round(v / max * 100)) : 100}%"></i></div>`;
  const coinHtml = () => `<span class="rs-coin">● ${save().coins}</span>`;
  const itemLine = id => { const it = D.ITEMS[id]; return it ? it.name : '（なし）'; };
  function statLine(id) {
    const st = M.statOf(save(), id), it = D.ITEMS[id]; if (!it) return '';
    return st.atk != null ? `こうげき ${st.atk}` : st.def != null ? `ぼうぎょ ${st.def}` : '';
  }
  const iconOf = id => { const a = RPG.assets && (RPG.assets['icon_' + id] || RPG.assets['icon_' + id.replace(/^(u_.+)_\d$/, '$1')]); return a && a.path ? `<img class="rs-ic" src="${a.path}" width="32" height="32" alt="" aria-hidden="true">` : ''; };
  const rankTag = it => it.rank ? `<i class="rs-rank">ランク${D.RANK_NAME[it.rank - 1]}</i>` : '';
  const rareTag = it => (it.rarity === 'rare' ? '<i class="rs-rare">レア</i>' : it.relic ? '<i class="rs-rare">ひきょう</i>' : it.rarity === 'unique' ? '<i class="rs-rare">固有</i>' : '') + (it.provisional ? '<i class="rs-prov">仮名</i>' : '');
  const tierName = t => ({ base: 'きほん職', adv: '上級職', top: '最上級職' })[t];
  const noticeBox = () => RPG.noticeHtml();
  function commit() { const ok = RPG.persist(); if (!ok) UI.msg = RPG.err === 'stale' ? 'ほかの画面で すすんでいます。よみこみなおしてね。' : 'ほぞんできませんでした（「ゲームのデータ」でかきだしてね）。'; return ok; }

  // ---------- 下部ナビ ----------
  RPG.navHtml = function (active) {
    return `<div class="rs-navspace"></div><nav class="rs-nav" aria-label="メニュー">${TABS.map(([id, nm]) => `<button class="rs-tab${id === active ? ' on' : ''}" data-tab="${id}"${id === active ? ' aria-current="page"' : ''}>${nm}</button>`).join('')}</nav>`;
  };
  function bindNav() {
    app().querySelectorAll('.rs-tab').forEach(b => b.onclick = () => { const id = b.dataset.tab; if (id === 'home') { root.home(); } else go(id); });
  }

  // ---------- ホームの上部（既存の学習ホームの上に出す） ----------
  RPG.homeTop = function () {
    if (!RPG.ok) return RPG.noticeHtml();
    const s = save(), job = s.job, jd = D.JOBS[job], jl = C.jobLevel(job, s.jobXp[job]), hl = C.heroLevel(s.advXp);
    const key = C.todayKey(s, NOW()), used = s.daily.used[key] || 0, nx = C.nextSkill(job, s.jobXp[job]);
    const chip = (n, label) => `<div class="rs-bonus${used >= n ? ' used' : ''}"><b>${label}</b><small>${used >= n ? 'つかった' : 'まだ つかえる'}</small></div>`;
    const a = s.active, resume = a && a.basic.n > 0 && a.basic.n < C.ADV_UNIT;
    const g = s.goal && D.JOBS[s.goal.job] ? s.goal.job : null;
    let goalTxt = ''; if (g) { const pr = M.jobProgress(s, g).filter(r => !r.pending); const left = pr.filter(r => !r.done); goalTxt = `もくひょう：${esc(D.JOBS[g].name)}${left.length ? '（' + left.map(r => esc(r.text)).join('、') + ' まで）' : '（もう なれる！）'}`; }
    return `${noticeBox()}<section class="rs-homecard" aria-label="ぼうけん者のようす">
      <div class="rs-hc-top"><canvas class="rs-herocv" id="rsHomeHero" aria-hidden="true"></canvas>
        <div class="rs-hc-info"><div class="rs-hc-name">${esc(s.name || 'ぼうけん者')}</div><div class="rs-hc-job">${esc(jd.name)} Lv${jl.lv}</div><div class="rs-hc-sub">ぼうけん者 Lv${hl.lv} ／ ${coinHtml()}</div></div></div>
      <div class="rs-hc-b"><span>きょうの ぼうけんボーナス</span><div class="rs-bonuses">${chip(1, 'けいけんち ×3')}${chip(2, 'けいけんち ×2')}</div></div>
      ${resume ? `<button class="rs-resume" id="rsResume">つづきから（${a.basic.n} / ${C.ADV_UNIT}）</button>` : ''}
      <div class="rs-hc-line">${nx ? `つぎの わざ：<b>${esc(nx.skill.name)}</b>（あと ${Math.max(0, nx.remain)}）` : 'この職業の わざは ぜんぶ おぼえた'}</div>
      ${goalTxt ? `<div class="rs-hc-line">${goalTxt}</div>` : ''}</section>`;
  };
  RPG.bindHomeTop = function () {
    const c = doc.getElementById('rsHomeHero'); if (c) hero(c, save().job, 4);
    const r = doc.getElementById('rsResume'); if (r) r.onclick = () => { const go = doc.getElementById('go'); if (go) go.click(); };
    bindNav();
  };

  // ---------- 画面の骨組み ----------
  function frame(title, body, opt) {
    opt = opt || {}; const back = opt.back !== false;
    return `<div class="rs" id="rsRoot"><div class="rs-head">${back ? '<button class="rs-back" id="rsBack" aria-label="もどる">‹ もどる</button>' : '<span class="rs-back sp"></span>'}<h1 class="rs-title">${title}</h1>${opt.right || '<span class="rs-back sp"></span>'}</div>${UI.msg ? `<div class="rs-msg" role="status">${esc(UI.msg)}</div>` : ''}${noticeBox()}${body}</div>${RPG.navHtml(ROOT_OF[UI.screen] || 'me')}`;
  }
  function go(name, params) {
    UI.screen = name; UI.params = params || {}; UI.msg = '';
    if (name === 'equip') { UI.eq = Object.assign({}, save().equip); UI.slot = 'weapon'; }
    if (name === 'loadout') { UI.sel = M.currentSkills(save()).slice(); UI.tactic = save().loadout.tactic || 'auto'; }
    if (name === 'look') { UI.look = Object.assign({}, save().look); UI.name = save().name || ''; }
    if (name === 'jobs') UI.tier = (params && params.tier) || UI.tier;
    UI.confirm = null; render(); root.scrollTo && root.scrollTo(0, 0);
  }
  function render() {
    const A = app(); if (!RPG.ok && !save()) { root.home(); return; }
    RPG.unmount && RPG.unmount(); A.className = 'rs-app';
    const f = VIEWS[UI.screen] || VIEWS.me; A.innerHTML = f(UI.params);
    const back = doc.getElementById('rsBack');
    if (back) back.onclick = () => { if (UI.params && UI.params.from === 'result') return root.home(); if (UI.params && UI.params.back) return go(UI.params.back); const p = PARENT[UI.screen]; if (p === 'place') go('place', { id: (UI.params && UI.params.place) || 'guild' }); else go(p || 'me'); };
    bindNav(); jobSprites();
    const after = AFTER[UI.screen]; if (after) after(UI.params);
    A.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go, b.dataset.p ? JSON.parse(b.dataset.p) : {}));
  }
  RPG.open = function (name, params) { if (!RPG.ok) return false; go(name, params); return true; };
  RPG.screenName = () => UI.screen;
  const rerender = () => { const y = root.scrollY; render(); root.scrollTo && root.scrollTo(0, y); };

  const VIEWS = {}, AFTER = {};

  // ---------- ぼうけん（地図・技設定のまとめ・おねがい） ----------
  VIEWS.adv = function () {
    const s = save(), info = M.mapInfo(s), r = A.currentRoute(s), ed = D.ENEMIES[r.enemy], q = r.quest ? W.QUESTS[r.quest] : null;
    const kept = A.keptHp(s, r), hpKeep = kept != null ? Math.round(kept / r.stats.hp * 100) : 100;
    const sk = M.currentSkills(s).map(id => D.SKILLS[id].name), tac = TACTICS.find(t => t[0] === (s.loadout.tactic || 'auto'))[1];
    const CH = { 1: '第1章　消えた灯台', 2: '第2章　空の下の世界', 3: '第3章　十二のしるし' };
    const nodeHtml = (x, i) => `<li class="rs-node ${x.cleared ? 'clear' : x.current ? 'cur' : 'lock'}"><span class="rs-dot">${x.cleared ? '✓' : i + 1}</span><div><b>${esc(x.name)}</b><small>${x.cleared ? 'とっぱ ずみ' : x.current ? (x.atBoss ? `ボスの たたかい　${x.inRegion - x.nNormal + 1} / ${x.total - x.nNormal}` : `${esc(x.points[Math.min(x.points.length - 1, Math.floor(x.inRegion / 3))])}　${x.inRegion + 1} / ${x.total}`) : 'まだ ここまで きていない'}</small>${x.current ? `<small>${esc(x.story)}</small>` : ''}${x.current || x.cleared ? `<small>ボス：${esc(x.boss)}</small>` : ''}</div></li>`;
    const chapters = [1, 2, 3].map(c => `<div class="rs-h2">${CH[c]}</div><ol class="rs-map">${info.map((x, i) => x.ch === c ? nodeHtml(x, i - info.findIndex(y => y.ch === c)) : '').join('')}</ol>`).join('');
    const wish = D.WISH_LIST.map(w => `<button class="rs-chip${s.wish === w ? ' on' : ''}" data-wish="${w}" aria-pressed="${s.wish === w}">${esc(D.WISH_NAME[w])}</button>`).join('');
    const a = s.active, nOver = !q && s.progress.step >= D.ROUTE.length;
    return frame('ぼうけん', `
      <div class="rs-panel"><div class="rs-h2">いまの ぼうけん</div>
        <div class="rs-now"><canvas class="rs-ecv" id="rsEnemy" aria-hidden="true"></canvas><div><b>${esc(ed.name)}</b>${ed.boss ? '<i class="rs-rare">ボス</i>' : ''}<small>${esc(q ? (q.kind === 'rematch' ? q.name : q.name + '・' + r.point) : D.REGIONS[r.region].name + '・' + r.point)}${nOver ? '（ぜんぶ クリア！ さいごの ボスと さいせん）' : ''}</small>${ed.weak ? `<small>よわてん：${esc(D.EL_NAME[ed.weak])}</small>` : ''}${hpKeep < 100 ? `<small>のこりHP ${hpKeep}%（つづきの たたかい）</small>` : ''}</div></div>
        ${a && a.basic.n > 0 ? `<div class="rs-note">ぼうけん ${a.basic.n} / ${C.ADV_UNIT}もん（つづきから）</div>` : ''}
        <button class="rs-big" id="rsStart">がくしゅうを えらんで スタート</button></div>
      <div class="rs-panel"><div class="rs-h2">わざと さくせん</div><p class="rs-p">${sk.map(esc).join('・')}／さくせん：${esc(tac)}</p><button class="rs-btn" data-go="loadout">わざ・さくせんを かえる</button></div>
      <div class="rs-panel"><div class="rs-h2">宝箱の おねがい</div><p class="rs-p">朝星の宝箱から レアが出るとき、この種類から えらばれます。</p><div class="rs-chips" role="group">${wish}</div></div>
      <div class="rs-panel">${chapters}</div>`, { back: false });
  };
  AFTER.adv = function () {
    const c = doc.getElementById('rsEnemy'); if (c) { const s = save(), r = A.currentRoute(s); enemyCv(c, r.enemy, D.ENEMIES[r.enemy].boss, 4); }
    doc.getElementById('rsStart').onclick = () => root.home();
    app().querySelectorAll('[data-wish]').forEach(b => b.onclick = () => { M.setWish(save(), b.dataset.wish); commit(); rerender(); });
  };

  // ---------- まち ----------
  const PLACES = {
    guild: { name: 'ギルド', desc: 'ギルド長ミラが ぼうけんの ようすを きいてくれる。', links: [['jobs', 'てんしょく'], ['ach', 'じっせき']] },
    shop: { name: 'そうびや', desc: 'ぶき・ぼうぐ・アクセサリーを かう・うる・かえる。', links: [['shop', 'みせ（かう・うる）'], ['equip', 'そうびを かえる']] },
    forge: { name: 'かじや', desc: '鍛冶師トトが そうびを きたえてくれる。', links: [['forge', 'きょうか']] },
    temple: { name: 'しんでん', desc: 'しるしの 力を ととのえる。ぼうけんの まえに わざを えらぶ。', links: [['loadout', 'わざ・さくせん']] },
    room: { name: 'じしつ', desc: 'じぶんの へや。', links: [['look', 'なまえ・みため'], ['codex', 'ずかん'], ['data', 'ゲームのデータ']] },
    ship: { name: 'くうせん', desc: '見習い船長ルカの船。ぼうけんの ちずを ひらく。', links: [['adv', 'ぼうけんの ちず']] }
  };
  VIEWS.town = function () {
    const spots = [['guild', 'ギルド', 8, 40], ['shop', 'そうびや', 38, 52], ['forge', 'かじや', 68, 44], ['temple', 'しんでん', 12, 16], ['room', 'じしつ', 62, 14], ['ship', 'くうせん', 40, 8]];
    return frame('風待ちの町', `<p class="rs-p c">行きたい ばしょを タップ（仮の絵です）</p>
      <div class="rs-town" role="group" aria-label="まちの地図">${spots.map(([id, nm, x, y]) => `<button class="rs-spot s-${id}" style="left:${x}%;top:${y}%" data-place="${id}"><span class="rs-bld"></span><b>${nm}</b></button>`).join('')}<div class="rs-sea"></div></div>`, { back: false });
  };
  AFTER.town = function () {
    app().querySelectorAll('[data-place]').forEach(b => b.onclick = () => { const id = b.dataset.place; if (id === 'ship') go('adv'); else go('place', { id }); });
  };
  VIEWS.place = function (p) {
    const pl = PLACES[p.id] || PLACES.guild;
    return frame(pl.name, `<p class="rs-p c">${esc(pl.desc)}</p><div class="rs-list">${pl.links.map(([to, nm]) => `<button class="rs-big alt" data-go="${to}" data-p='${JSON.stringify({ place: p.id })}'>${nm}</button>`).join('')}</div>`);
  };

  // ---------- じぶん ----------
  VIEWS.me = function () {
    const s = save(), jl = C.jobLevels(s), hl = C.heroLevel(s.advXp), st = M.statsWith(s, s.equip), jd = D.JOBS[s.job];
    const jobs = D.JOB_IDS.map(j => { const lv = C.jobLevel(j, s.jobXp[j]); return `<div class="rs-jl${j === s.job ? ' me' : ''}"><span>${esc(D.JOBS[j].name)}</span><b>Lv${lv.lv}</b></div>`; }).join('');
    const cs = M.codexSummary(s);
    return frame('じぶん', `
      <div class="rs-panel rs-me"><canvas class="rs-herocv" id="rsMeHero" aria-hidden="true"></canvas><div><div class="rs-hc-name">${esc(s.name || 'ぼうけん者')}</div><div class="rs-hc-job">${esc(jd.name)} Lv${jl[s.job]}</div><div class="rs-hc-sub">ぼうけん者 Lv${hl.lv}</div>${bar(hl.into, hl.need)}<div class="rs-hc-sub">${coinHtml()}</div></div></div>
      <div class="rs-panel"><div class="rs-h2">つよさ</div><div class="rs-stats"><div>HP <b>${st.maxHp}</b></div><div>こうげき <b>${st.atk}</b></div><div>ぼうぎょ <b>${st.def}</b></div></div></div>
      <div class="rs-panel"><div class="rs-h2">いまの そうび</div>
        ${['weapon', 'armor', 'acc'].map(sl => `<div class="rs-eqrow"><small>${M.SLOT_NAME[sl]}</small><b>${esc(itemLine(s.equip[sl]))}${s.equip[sl] && M.enhLv(s, s.equip[sl]) ? ' +' + M.enhLv(s, s.equip[sl]) : ''}</b></div>`).join('')}
        <button class="rs-btn" data-go="equip" data-p='{"back":"me"}'>そうびを みる・かえる</button></div>
      <div class="rs-panel"><div class="rs-h2">職業レベル</div><div class="rs-jls">${jobs}</div><button class="rs-btn" data-go="jobs" data-p='{"back":"me"}'>てんしょく</button></div>
      <div class="rs-panel rs-links"><button class="rs-btn" data-go="look">なまえ・みため</button><button class="rs-btn" data-go="codex">ずかん（てき ${cs.enemies.seen}/${cs.enemies.total}・そうび ${cs.items.got}/${cs.items.total}）</button><button class="rs-btn" data-go="ach">じっせき</button><button class="rs-btn" data-go="data">ゲームのデータ</button></div>`, { back: false });
  };
  AFTER.me = function () { hero(doc.getElementById('rsMeHero'), save().job, 5); };

  // ---------- 装備 ----------
  VIEWS.equip = function (p) {
    const s = save(), cur = M.statsWith(s, s.equip), tr = M.statsWith(s, UI.eq), changed = ['weapon', 'armor', 'acc'].some(k => (UI.eq[k] || null) !== (s.equip[k] || null));
    const diff = (a, b) => b === a ? '<i class="rs-same">±0</i>' : b > a ? `<i class="rs-up">+${b - a}</i>` : `<i class="rs-down">${b - a}</i>`;
    const slots = ['weapon', 'armor', 'acc'].map(sl => `<button class="rs-tab2${UI.slot === sl ? ' on' : ''}" data-slot="${sl}">${M.SLOT_NAME[sl]}</button>`).join('');
    const owned = Object.keys(s.inv.items).map(i => D.ITEMS[i]).filter(i => i.slot === UI.slot).sort((a, b) => (b.rank - a.rank) || (a.rarity < b.rarity ? 1 : -1));
    const rows = owned.map(it => {
      const err = M.canEquip(s, it.id), on = UI.eq[UI.slot] === it.id, lv = M.enhLv(s, it.id), eff = M.effectText(it.id);
      return `<button class="rs-item${on ? ' on' : ''}${err ? ' ng' : ''}" data-eq="${it.id}" ${err ? 'aria-disabled="true"' : ''}><div>${iconOf(it.id)}<b>${esc(it.name)}${lv ? ' +' + lv : ''}</b>${rankTag(it)}${rareTag(it)}${s.equip[UI.slot] === it.id ? '<i class="rs-now2">そうびちゅう</i>' : ''}</div><small>${esc(statLine(it.id))}${eff ? '　' + esc(eff) : ''}${err ? '　（' + esc(err) + '）' : ''}</small></button>`;
    }).join('') || '<p class="rs-p">まだ もっていません。</p>';
    return frame('そうび', `
      <div class="rs-panel rs-eqhead"><canvas class="rs-herocv" id="rsEqHero" aria-hidden="true"></canvas>
        <table class="rs-cmp"><tr><th></th><th>いま</th><th>ためし</th><th></th></tr>
          <tr><td>HP</td><td>${cur.maxHp}</td><td>${tr.maxHp}</td><td>${diff(cur.maxHp, tr.maxHp)}</td></tr>
          <tr><td>こうげき</td><td>${cur.atk}</td><td>${tr.atk}</td><td>${diff(cur.atk, tr.atk)}</td></tr>
          <tr><td>ぼうぎょ</td><td>${cur.def}</td><td>${tr.def}</td><td>${diff(cur.def, tr.def)}</td></tr></table></div>
      <div class="rs-tabs2" role="tablist">${slots}</div>
      <div class="rs-list">${rows}${UI.slot !== 'weapon' ? `<button class="rs-item${!UI.eq[UI.slot] ? ' on' : ''}" data-eq=""><b>はずす</b></button>` : ''}</div>
      ${s.active ? '<div class="rs-note">ぼうけんの 途中は そうびを かえられません。</div>' : ''}
      <div class="rs-row2"><button class="rs-btn" id="eqRec">おすすめに する</button><button class="rs-btn" id="eqReset" ${changed ? '' : 'disabled'}>もとに もどす</button></div>
      <button class="rs-big" id="eqOk" ${changed && !s.active ? '' : 'disabled'}>これで けってい</button>
      <p class="rs-p c">「けってい」を おすまでは そうびは かわりません。</p>`, { back: true });
  };
  AFTER.equip = function () {
    const s = save(); hero(doc.getElementById('rsEqHero'), s.job, 4);
    app().querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { UI.slot = b.dataset.slot; rerender(); });
    app().querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const id = b.dataset.eq; if (id && M.canEquip(s, id)) { UI.msg = M.canEquip(s, id); rerender(); UI.msg = ''; return; } UI.eq[UI.slot] = id || null; UI.msg = ''; rerender(); });
    doc.getElementById('eqRec').onclick = () => { UI.eq = M.recommendEquip(s); UI.msg = 'おすすめを ためしています。きまったら「けってい」。'; rerender(); UI.msg = ''; };
    doc.getElementById('eqReset').onclick = () => { UI.eq = Object.assign({}, s.equip); rerender(); };
    doc.getElementById('eqOk').onclick = () => { const r = M.setEquip(s, UI.eq); if (!r.ok) { UI.msg = r.err; rerender(); return; } commit(); UI.msg = UI.msg || 'そうびを かえました。'; UI.eq = Object.assign({}, s.equip); rerender(); };
  };

  // ---------- 店 ----------
  VIEWS.shop = function () {
    const s = save(), rank = C.maxRank(s), tabs = [['weapon', 'ぶき'], ['armor', 'ぼうぐ'], ['acc', 'アクセ'], ['sell', 'うる・かえす']].map(([id, nm]) => `<button class="rs-tab2${UI.shopTab === id ? ' on' : ''}" data-st="${id}">${nm}</button>`).join('');
    let body;
    if (UI.shopTab === 'sell') {
      const own = Object.keys(s.inv.items).filter(i => i !== 'w_start').map(i => D.ITEMS[i]);
      body = own.length ? own.map(it => {
        const ref = M.canRefund(s, it.id), eqd = M.isEquipped(s, it.id), conf = UI.confirm === it.id;
        const act = eqd ? '<span class="rs-small">そうびちゅう</span>' : ref ? `<button class="rs-btn sm" data-refund="${it.id}">${conf ? 'ほんとうに かえす' : `かえす +${s.inv.fresh[it.id]}`}</button>` : `<button class="rs-btn sm" data-sell="${it.id}">${conf ? 'ほんとうに うる' : `うる +${M.sellPrice(it.id)}`}</button>`;
        return `<div class="rs-item"><div><b>${esc(it.name)}${M.enhLv(s, it.id) ? ' +' + M.enhLv(s, it.id) : ''}</b>${rankTag(it)}${rareTag(it)}</div><small>${esc(statLine(it.id))}${ref ? '　まだ つかっていない：同じ ねだんで かえせる' : '　店の ねだんの 25%で うれる'}</small>${act}</div>`;
      }).join('') : '<p class="rs-p">うれるものが ありません。</p>';
    } else {
      const items = Object.values(D.ITEMS).filter(i => i.slot === UI.shopTab && i.rarity === 'normal' && i.rank && i.rank <= rank);
      body = items.map(it => {
        const have = !!s.inv.items[it.id], can = C.canBuy(s, it.id), eff = M.effectText(it.id);
        return `<div class="rs-item"><div><b>${esc(it.name)}</b>${rankTag(it)}<i class="rs-cat">${esc(M.CAT_NAME[it.cat])}</i></div><small>${esc(statLine(it.id))}${eff ? '　' + esc(eff) : ''}</small>${have ? '<span class="rs-small">もっている</span>' : `<button class="rs-btn sm" data-buy="${it.id}" ${can ? 'disabled' : ''}>${it.price} コインで かう</button>${can ? `<small class="rs-why">${esc(can)}</small>` : ''}`}</div>`;
      }).join('') + `<p class="rs-p">${['ランクIIは 砂海を とっぱすると 売りだされます。', 'ランクIIIは 第1章を クリアすると 売りだされます。', 'ランクIVは 逆さ遺跡を とっぱすると 売りだされます。', 'ランクVは 第2章を クリアすると 売りだされます。', 'ランクVIは 天測の塔を とっぱすると 売りだされます。', ''][rank - 1]}</p>`;
    }
    return frame('そうびや', `<div class="rs-panel c">${coinHtml()}</div><div class="rs-tabs2">${tabs}</div><div class="rs-list">${body}</div>`);
  };
  AFTER.shop = function () {
    const s = save();
    app().querySelectorAll('[data-st]').forEach(b => b.onclick = () => { UI.shopTab = b.dataset.st; UI.confirm = null; rerender(); });
    app().querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const r = M.buyChecked(s, b.dataset.buy); UI.msg = r.ok ? `${D.ITEMS[b.dataset.buy].name} を かいました。` : r.err; if (r.ok) commit(); rerender(); });
    app().querySelectorAll('[data-sell],[data-refund]').forEach(b => b.onclick = () => {
      const id = b.dataset.sell || b.dataset.refund; if (UI.confirm !== id) { UI.confirm = id; rerender(); return; }
      const r = b.dataset.refund ? M.refund(s, id) : M.sell(s, id); UI.confirm = null; UI.msg = r.ok ? `+${r.coin} コイン` : r.err; if (r.ok) commit(); rerender();
    });
  };

  // ---------- 鍛冶 ----------
  VIEWS.forge = function () {
    const s = save(), own = Object.keys(s.inv.items).filter(i => i !== 'w_start').map(i => D.ITEMS[i]).sort((a, b) => b.rank - a.rank);
    const rows = own.map(it => {
      const i = M.enhanceInfo(s, it.id), lv = i.lv;
      const st = statLine(it.id), after = i.after != null && lv < D.ENH_MAX ? `→ ${it.atk != null ? 'こうげき' : 'ぼうぎょ'} ${i.after}` : '';
      return `<div class="rs-item"><div><b>${esc(it.name)}${lv ? ' +' + lv : ''}</b>${rankTag(it)}${rareTag(it)}</div><small>${esc(st)} ${esc(after)}${it.slot === 'acc' ? '　（こうかの 量が +5%ずつ）' : ''}</small>
        ${lv >= D.ENH_MAX ? '<span class="rs-small">さいだい（+3）</span>' : `<small>ひよう ${i.coin}コイン ＋ ${esc(C.oreName(it.rank))} ×${i.ore}（もち ${i.have}）</small><button class="rs-btn sm" data-enh="${it.id}" ${i.err ? 'disabled' : ''}>+${lv + 1}に きょうか</button>${i.err ? `<small class="rs-why">${esc(i.err)}</small>` : ''}`}</div>`;
    }).join('') || '<p class="rs-p">きたえられる そうびが ありません。</p>';
    const mats = Object.keys(s.inv.mats).filter(k => s.inv.mats[k] > 0).map(k => {
      let nm = k; if (k.startsWith('ore_')) nm = C.oreName(+k.slice(4)); else if (k.startsWith('bm_')) { const r = D.REGIONS.find(x => 'bm_' + x.id === k); nm = r ? r.mat : k; }
      return `<span class="rs-mat">${esc(nm)} ×${s.inv.mats[k]}</span>`;
    }).join('') || '<small>まだ ありません</small>';
    return frame('かじや', `<div class="rs-panel c">${coinHtml()}<p class="rs-p">きょうかは +3まで。かならず せいこうします。1回ごとに 基準の せいのうが +5%。</p></div>
      <div class="rs-panel"><div class="rs-h2">そざい</div><div class="rs-mats">${mats}</div><p class="rs-p">ボスの そざいで つくる 固有そうびは、まだ つくれません（じっそうまえ）。</p></div><div class="rs-list">${rows}</div>`);
  };
  AFTER.forge = function () {
    app().querySelectorAll('[data-enh]').forEach(b => b.onclick = () => { const r = M.enhance(save(), b.dataset.enh); UI.msg = r.ok ? `+${r.lv} に なりました！` : r.err; if (r.ok) commit(); rerender(); });
  };

  // ---------- 転職 ----------
  VIEWS.jobs = function () {
    const s = save(), tabs = ['base', 'adv', 'top'].map(t => `<button class="rs-tab2${UI.tier === t ? ' on' : ''}" data-tier="${t}">${tierName(t)}</button>`).join('');
    const cards = D.JOB_IDS.filter(j => D.JOBS[j].tier === UI.tier).map(j => {
      const lv = C.jobLevel(j, s.jobXp[j]).lv, e = C.canChangeJob(s, j), me = s.job === j, goal = s.goal && s.goal.job === j;
      return `<button class="rs-jobcard${me ? ' me' : ''}${e && !me ? ' lock' : ''}" data-go="jobdetail" data-p='${JSON.stringify({ job: j })}'><canvas data-job="${j}" data-k="3" aria-hidden="true"></canvas><div><b>${esc(D.JOBS[j].name)}</b><small>Lv${lv}${me ? '（いまの職業）' : e ? '' : '（なれる）'}${goal ? '　★もくひょう' : ''}</small></div></button>`;
    }).join('');
    return frame('てんしょく', `<div class="rs-tabs2" role="tablist">${tabs}</div><div class="rs-jobgrid">${cards}</div><p class="rs-p c">転職は むりょうです。職業ごとの レベルは そのまま のこります。ぼうけんの 途中は かえられません。</p>`);
  };
  AFTER.jobs = function () { app().querySelectorAll('[data-tier]').forEach(b => b.onclick = () => { UI.tier = b.dataset.tier; rerender(); }); };
  VIEWS.jobdetail = function (p) {
    const s = save(), j = p.job || s.job, jd = D.JOBS[j], jl = C.jobLevel(j, s.jobXp[j]), e = C.canChangeJob(s, j), me = s.job === j, goal = s.goal && s.goal.job === j;
    UI.params = p;
    const sk = D.SKILLS_OF[j].map(k => `<div class="rs-sk${k.lv > jl.lv ? ' lock' : ''}"><div><b>${esc(k.name)}</b><i class="rs-cost">ゲージ${k.cost}</i><i class="rs-lv">Lv${k.lv}</i>${k.inh ? '<i class="rs-rare">けいしょう○</i>' : ''}</div><small>${esc(M.skillText(k, jl.lv))}</small></div>`).join('');
    const ps = (D.PASSIVES[j] || []).map(x => `<div class="rs-sk${x[0] > jl.lv ? ' lock' : ''}"><div><b>${esc(x[1])}</b><i class="rs-lv">Lv${x[0]}</i></div><small>${esc(x[2])}</small></div>`).join('');
    const reqs = M.jobProgress(s, j).map(r => `<div class="rs-req${r.done ? ' ok' : ''}"><span>${r.done ? '✓' : '・'}</span>${esc(r.text)}${r.pending ? '' : `　（${r.now}${r.unit || ''} / ${r.need}${r.unit || ''}）`}</div>`).join('');
    const cats = jd.weapons.map(c => M.CAT_NAME[c]).join('・');
    return frame(esc(jd.name), `
      <div class="rs-panel rs-jobhead"><canvas data-job="${j}" data-k="6" aria-hidden="true"></canvas><div><b>${esc(tierName(jd.tier))}</b><div>Lv${jl.lv}${jl.capped ? '（上限）' : ''}</div>${bar(jl.into, jl.need)}<small>つかえる ぶき：${esc(cats)}</small></div></div>
      ${reqs ? `<div class="rs-panel"><div class="rs-h2">てんしょく じょうけん</div>${reqs}</div>` : ''}
      <div class="rs-panel"><div class="rs-h2">とくべつな 力</div>${ps}<div class="rs-h2">わざ</div>${sk}</div>
      <div class="rs-note">${me ? 'いま この職業です。' : e ? esc(e) : 'この職業に なれます！'}</div>
      <button class="rs-big gold" id="jobDo" ${e || me ? 'disabled' : ''}>この職業に なる</button>
      ${jd.tier !== 'base' ? `<button class="rs-btn" id="jobGoal">${goal ? 'もくひょうを やめる' : 'もくひょうに する'}</button>` : ''}`);
  };
  AFTER.jobdetail = function (p) {
    const s = save(), j = p.job;
    const d = doc.getElementById('jobDo'); if (d) d.onclick = () => {
      const first = !s.seen['job_' + j], r = M.changeJob(s, j); if (!r.ok) { UI.msg = r.err; rerender(); return; }
      s.seen['job_' + j] = 1; commit(); showJobFx(j, first, r.gifts, () => go('me'));
    };
    const g = doc.getElementById('jobGoal'); if (g) g.onclick = () => { M.setGoal(s, s.goal && s.goal.job === j ? null : j); commit(); rerender(); };
  };
  // 転職の演出（初回のみ。スキップできる。動きが苦手な設定では静止）
  function showJobFx(j, first, gifts, done) {
    const gift = gifts && gifts.length ? `<div class="rs-fx-gift">${gifts.map(g => esc(D.ITEMS[g].name)).join('、')} を もらった！</div>` : '';
    if (!first) { UI.msg = `${D.JOBS[j].name} に なりました。`; return done(); }
    const o = doc.createElement('div'); o.className = 'rs-fx' + (reduceMotion() ? ' still' : ''); o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', '転職');
    o.innerHTML = `<div class="rs-fx-in"><canvas data-job="${j}" data-k="8" aria-hidden="true"></canvas><div class="rs-fx-t">${esc(D.JOBS[j].name)} に なった！</div>${gift}<button class="rs-big" id="fxSkip">とじる</button></div>`;
    doc.body.appendChild(o);
    o.querySelectorAll('canvas[data-job]').forEach(c => hero(c, c.dataset.job, 8));
    const close = () => { o.remove(); done(); }; o.querySelector('#fxSkip').onclick = close;
    if (!reduceMotion()) setTimeout(() => { if (o.isConnected) close(); }, 2600);
  }

  // ---------- 技設定 ----------
  VIEWS.loadout = function () {
    const s = save(), jobs = C.jobLevels(s), job = s.job, lv = jobs[job], inhOn = M.advInherit(s);
    const own = D.SKILLS_OF[job].filter(k => k.lv <= lv), inh = inhOn ? B.inheritable(jobs).filter(id => D.SKILLS[id].job !== job).map(id => D.SKILLS[id]) : [];
    const sel = UI.sel, errs = B.validateLoadout(job, jobs, sel, inhOn);
    const chip = k => { const on = sel.includes(k.id); return `<button class="rs-sk btn${on ? ' on' : ''}" data-sk="${k.id}" aria-pressed="${on}"><div><b>${esc(k.name)}</b><i class="rs-cost">ゲージ${k.cost}</i>${k.job !== job ? `<i class="rs-rare">${esc(D.JOBS[k.job].name)}の わざ</i>` : ''}</div><small>${esc(M.skillText(k, k.job === job ? lv : 1))}</small></button>`; };
    return frame('わざ・さくせん', `
      <div class="rs-panel"><div class="rs-h2">${esc(D.JOBS[job].name)}の わざ（3つまで）</div><p class="rs-p">えらんだ わざは、こたえに あわせて 自動でつかわれます。ぼうけんを はじめると、とちゅうでは かえられません。</p><div class="rs-list">${own.map(chip).join('')}</div></div>
      <div class="rs-panel"><div class="rs-h2">ほかの 職業の わざ（1つだけ）</div>${inhOn ? (inh.length ? `<div class="rs-list">${inh.map(chip).join('')}</div>` : '<p class="rs-p">けいしょうできる わざが まだ ありません。</p>') : '<p class="rs-p">きほん職の どれかが Lv5に なると つかえます。</p>'}</div>
      <div class="rs-panel"><div class="rs-h2">さくせん</div><div class="rs-list">${TACTICS.map(([id, nm, ds]) => `<button class="rs-sk btn${UI.tactic === id ? ' on' : ''}" data-tac="${id}" aria-pressed="${UI.tactic === id}"><div><b>${nm}</b></div><small>${esc(ds)}</small></button>`).join('')}</div></div>
      ${errs.length ? `<div class="rs-note">${esc(errs[0])}</div>` : ''}${s.active ? '<div class="rs-note">ぼうけんの 途中は かえられません。</div>' : ''}
      <div class="rs-row2"><button class="rs-btn" id="lkRec">おすすめに する</button></div>
      <button class="rs-big" id="lkOk" ${errs.length || s.active ? 'disabled' : ''}>これで けってい</button>`);
  };
  AFTER.loadout = function () {
    const s = save(), jobs = C.jobLevels(s);
    app().querySelectorAll('[data-sk]').forEach(b => b.onclick = () => {
      const id = b.dataset.sk, i = UI.sel.indexOf(id); if (i >= 0) UI.sel.splice(i, 1);
      else { UI.sel.push(id); if (UI.sel.length > 3) UI.sel.shift(); }
      rerender();
    });
    app().querySelectorAll('[data-tac]').forEach(b => b.onclick = () => { UI.tactic = b.dataset.tac; rerender(); });
    doc.getElementById('lkRec').onclick = () => { UI.sel = B.recommendLoadout(s.job, jobs); rerender(); };
    doc.getElementById('lkOk').onclick = () => { const r = M.setLoadout(s, UI.sel, UI.tactic); UI.msg = r.ok ? 'けっていしました。つぎの ぼうけんから つかわれます。' : r.err; if (r.ok) commit(); rerender(); };
  };

  // ---------- 外見 ----------
  VIEWS.look = function () {
    const L = UI.look, sw = (key, arr) => arr.map((c, i) => `<button class="rs-sw${L[key] === i ? ' on' : ''}" style="background:${c}" data-lk="${key}" data-v="${i}" aria-label="${i + 1}ばん" aria-pressed="${L[key] === i}"></button>`).join('');
    const num = (key, n) => Array.from({ length: n }, (_, i) => `<button class="rs-chip${L[key] === i ? ' on' : ''}" data-lk="${key}" data-v="${i}" aria-pressed="${L[key] === i}">${i + 1}</button>`).join('');
    return frame('なまえ・みため', `
      <div class="rs-panel c"><canvas class="rs-herocv" id="rsLookHero" aria-hidden="true"></canvas></div>
      <div class="rs-panel"><label class="rs-h2" for="rsName">なまえ（8もじまで）</label><input id="rsName" class="rs-input" maxlength="8" value="${esc(UI.name)}" autocomplete="off" placeholder="ぼうけん者"><p class="rs-p">なまえは この たんまつの なかだけに のこります。公開されません。</p></div>
      <div class="rs-panel"><div class="rs-h2">かお</div><div class="rs-chips">${num('face', M.FACE_N)}</div><div class="rs-h2">かみがた</div><div class="rs-chips">${num('hair', M.HAIR_N)}</div>
        <div class="rs-h2">はだの いろ</div><div class="rs-chips">${sw('skin', M.SKIN)}</div><div class="rs-h2">かみの いろ</div><div class="rs-chips">${sw('hairColor', M.HAIR_COLOR)}</div>
        <p class="rs-p">みための へんこうは むりょう。職業や そうびには えいきょうしません。</p></div>
      <button class="rs-big" id="lookOk">これで けってい</button>`);
  };
  AFTER.look = function () {
    const prev = () => hero(doc.getElementById('rsLookHero'), save().job, 7, { look: { skin: M.SKIN[UI.look.skin], hair: M.HAIR_COLOR[UI.look.hairColor], face: UI.look.face, hairStyle: UI.look.hair } }); prev();
    const nm = doc.getElementById('rsName'); nm.oninput = () => { UI.name = nm.value; };
    app().querySelectorAll('[data-lk]').forEach(b => b.onclick = () => { UI.look[b.dataset.lk] = +b.dataset.v; rerender(); });
    doc.getElementById('lookOk').onclick = () => { const r = M.setLook(save(), UI.name, UI.look); UI.msg = r.ok ? 'けっていしました。' : r.err; if (r.ok) commit(); rerender(); };
  };

  // ---------- 図鑑 ----------
  VIEWS.codex = function () {
    const s = save(), cs = M.codexSummary(s), tabs = [['enemy', `てき ${cs.enemies.seen}/${cs.enemies.total}`], ['item', `そうび ${cs.items.got}/${cs.items.total}`]].map(([id, nm]) => `<button class="rs-tab2${UI.codexTab === id ? ' on' : ''}" data-ct="${id}">${nm}</button>`).join('');
    let body = '';
    if (UI.codexTab === 'enemy') {
      body = D.REGIONS.map(r => `<div class="rs-h2">${esc(r.name)}</div><div class="rs-cgrid">${r.enemies.concat([r.boss]).map(e => { const c = s.codex.enemies[e.id], seen = !!(c && c.seen); return `<div class="rs-cell${seen ? '' : ' un'}">${seen ? `<canvas data-en="${e.id}" data-boss="${e === r.boss ? 1 : 0}" aria-hidden="true"></canvas>` : '<div class="rs-q">？</div>'}<b>${seen ? esc(e.name) : '？？？'}</b><small>${seen ? `たおした ${c.kills}かい${e.weak ? '　よわてん：' + esc(D.EL_NAME[e.weak]) : ''}` : 'まだ であっていない'}</small></div>`; }).join('')}</div>`).join('');
      const regIds = D.REGIONS.map(r => r.id), ex = {}; Object.values(D.ENEMIES).forEach(e => { if (!regIds.includes(e.region)) (ex[e.region] = ex[e.region] || []).push(e); });
      body += Object.keys(ex).map(bg => `<div class="rs-h2">${esc(W.BG_NAMES[bg] || bg)}（クリアごなど）</div><div class="rs-cgrid">${ex[bg].map(e => { const c = s.codex.enemies[e.id], seen = !!(c && c.seen); return `<div class="rs-cell${seen ? '' : ' un'}">${seen ? `<canvas data-en="${e.id}" data-boss="${e.boss ? 1 : 0}" aria-hidden="true"></canvas>` : '<div class="rs-q">？</div>'}<b>${seen ? esc(e.name) : '？？？'}</b><small>${seen ? `たおした ${c.kills}かい` : 'まだ であっていない'}</small></div>`; }).join('')}</div>`).join('');
    } else {
      body = ['weapon', 'armor', 'acc'].map(sl => `<div class="rs-h2">${M.SLOT_NAME[sl]}</div><div class="rs-list">${Object.values(D.ITEMS).filter(i => i.slot === sl && i.id !== 'w_start' && (i.rank <= C.maxRank(s) || i.relic) && (!i.unique || i.relic || /_1$/.test(i.id))).map(i => { const got = M.codexHas(s, i.id); return `<div class="rs-item${got ? '' : ' ng'}"><div><b>${got ? esc(i.name) : '？？？'}</b>${got ? rankTag(i) + rareTag(i) : ''}</div></div>`; }).join('')}</div>`).join('') + '<p class="rs-p">うりだされていない ランクの そうびは、ひらくと 図鑑に のります。</p>';
    }
    return frame('ずかん', `<div class="rs-tabs2">${tabs}</div>${body}`);
  };
  AFTER.codex = function () {
    app().querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { UI.codexTab = b.dataset.ct; rerender(); });
    app().querySelectorAll('canvas[data-en]').forEach(c => enemyCv(c, c.dataset.en, c.dataset.boss === '1', 3));
  };

  // ---------- 実績 ----------
  VIEWS.ach = function () {
    const list = M.achievements(save()), n = list.filter(a => a.done).length;
    return frame('じっせき', `<div class="rs-panel c"><b>${n} / ${list.length}</b> たっせい<p class="rs-p">じっせきに ごほうびは ありません。あそびの きろくです。</p></div><div class="rs-list">${list.map(a => `<div class="rs-item${a.done ? ' on' : ''}"><div><b>${a.done ? '✓ ' : ''}${esc(a.name)}</b></div><small>${esc(a.desc)}</small>${a.done ? '' : bar(a.now, a.need) + `<small>${a.now} / ${a.need}</small>`}</div>`).join('')}</div>`);
  };

  // ---------- ゲームのデータ（バックアップ） ----------
  VIEWS.data = function () { return frame('ゲームのデータ', `<div class="rs-panel rs-data">${RPG.homeHtml()}</div>`); };
  AFTER.data = function () { const d = app().querySelector('.rpg-bk'); if (d) d.open = true; RPG.bindHome(); };

  // ===================== 第3段 =====================
  // ---------- おはなし（区間ごとの短い会話。スキップ・読み返しできる） ----------
  const storyKey = r => r.quest ? `q:${r.quest}:${r.step}` : `g:${r.g}`;
  function startStory(route, back) { UI.story = { pages: ST.pagesFor(route), i: 0, key: storyKey(route), back: back || 'adv' }; go('story', {}); }
  VIEWS.story = function () {
    const S = UI.story || { pages: [{ who: null, text: '' }], i: 0 }, p = S.pages[S.i], last = S.i >= S.pages.length - 1;
    return frame('おはなし', `<div class="rs-panel rs-story"><div class="rs-story-who">${p.who ? esc(p.who) : '　'}</div><p class="rs-story-text">${esc(p.text)}</p><div class="rs-story-n">${S.i + 1} / ${S.pages.length}</div></div>
      <div class="rs-row2"><button class="rs-btn" id="stSkip">とばす</button><button class="rs-big" id="stNext">${last ? 'おわり' : 'つぎへ'}</button></div>`);
  };
  AFTER.story = function () {
    const S = UI.story, done = () => { save().seen[S.key] = 1; commit(); go(S.back || 'adv'); };
    doc.getElementById('stNext').onclick = () => { if (S.i >= S.pages.length - 1) done(); else { S.i++; rerender(); } };
    doc.getElementById('stSkip').onclick = done;
  };
  VIEWS.storylist = function () {
    const s = save(), st = s.progress.step, grp = [];
    D.REGIONS.forEach((r, ri) => {
      const st0 = D.REGION_START[ri]; if (st0 > st) return; const nn = r.points.length * 3, b = [`<button class="rs-chip" data-sg="${st0}">はじまり</button>`];
      r.points.forEach((p, pi) => { if (pi > 0 && st0 + pi * 3 <= st) b.push(`<button class="rs-chip" data-sg="${st0 + pi * 3}">${esc(p)}</button>`); });
      if (st0 + nn <= st) b.push(`<button class="rs-chip" data-sg="${st0 + nn}">ボスの まえ</button>`);
      grp.push(`<div class="rs-h2">${esc(r.name)}</div><div class="rs-chips">${b.join('')}</div>`);
    });
    const qs = W.QUEST_ORDER.filter(id => W.QUESTS[id].kind !== 'rematch' && ((s.quests[id] || {}).step > 0 || (s.quests[id] || {}).cleared)).map(id => `<button class="rs-chip" data-sq="${id}">${esc(W.QUESTS[id].name)}</button>`).join('');
    return frame('おはなしを よみかえす', `<div class="rs-panel">${grp.join('') || '<p class="rs-p">まだ ありません。</p>'}${qs ? `<div class="rs-h2">クリアごの ぼうけん</div><div class="rs-chips">${qs}</div>` : ''}</div>`);
  };
  AFTER.storylist = function () {
    app().querySelectorAll('[data-sg]').forEach(b => b.onclick = () => startStory(D.ROUTE[+b.dataset.sg], 'storylist'));
    app().querySelectorAll('[data-sq]').forEach(b => b.onclick = () => startStory(W.QUESTS[b.dataset.sq].segs[0], 'storylist'));
  };

  // ---------- ぼうけんの えらびかた（ほんぺん・さいせん・しれん・秘境・孤島） ----------
  function questPanel(s) {
    const L = M.questList(s), by = k => L.filter(q => q.kind === k);
    const btn = q => {
      const st = q.locked && !q.cleared ? q.locked : q.cleared ? 'クリアずみ' : q.kind === 'rematch' ? `やった回数 ${q.count}` : q.step > 0 ? `${q.step} / ${q.total}（つづき）` : `ぜんぶで ${q.total}くかん`;
      const nm = q.kind === 'rematch' ? q.boss ? '' : '' : '';
      return `<button class="rs-qbtn${q.current ? ' on' : ''}${q.locked ? ' lock' : ''}" data-q="${q.id}" ${q.locked ? 'aria-disabled="true"' : ''} aria-pressed="${q.current}"><b>${q.current ? '✓ ' : ''}${esc(q.kind === 'rematch' ? q.name : q.name)}</b><small>${esc(st)}</small></button>${nm}`;
    };
    const re = by('rematch').filter(q => !q.locked);
    const mainDone = M.mainCleared(s);
    return `<div class="rs-panel"><div class="rs-h2">ほかの ぼうけん</div>
      <button class="rs-qbtn${!s.progress.quest ? ' on' : ''}" data-q="" aria-pressed="${!s.progress.quest}"><b>${!s.progress.quest ? '✓ ' : ''}ほんぺん</b><small>${mainDone ? 'ぜんぶ クリア（さいごの ボスと さいせん）' : '18の ちいきを すすむ'}</small></button>
      <details class="rs-det"><summary>さいせん（たおした ボスと もういちど）${re.length ? ' ' + re.length : ''}</summary><p class="rs-p">ボスの ざいりょうが ふえます。ざいりょう3こで 固有そうびが つくれます（かじや）。</p>${re.map(btn).join('') || '<small>まだ ありません。ボスを たおすと ひらきます。</small>'}</details>
      <div class="rs-h3">しれん（最上級職への てんしょく）</div>${by('trial').map(btn).join('')}
      <div class="rs-h3">6つの ひきょう（ほんぺんクリアご）</div>${by('secret').map(btn).join('')}
      <div class="rs-h3">夜明けの 孤島</div>${by('island').map(btn).join('')}
      ${s.active ? '<div class="rs-note">ぼうけんの 途中は えらびなおせません。</div>' : ''}</div>`;
  }

  // ---------- エンディング・記念 ----------
  VIEWS.ending = function () {
    const s = save(), i = UI.endI || 0, E = ST.ENDING, N = 4;
    const regs = D.REGIONS.filter(r => r.ch === 3).concat(D.REGIONS.filter(r => r.ch === 2)).slice(0, 12).map(r => esc(r.name)).join('・');
    const jl = C.jobLevels(s), jobs = D.JOB_IDS.filter(j => jl[j] > 1).map(j => `${esc(D.JOBS[j].name)} Lv${jl[j]}`).join('／') || '（これから）';
    const memos = D.REGIONS.filter(r => (s.inv.mats['bm_' + r.id] || 0) > 0 || s.progress.bossKills[r.boss.id]).map(r => esc(r.mat)).join('、') || '（ボスの ざいりょう）';
    const p = [
      `<canvas class="rs-herocv" id="rsEndHero" aria-hidden="true"></canvas><div class="rs-hc-name">${esc(s.name || 'ぼうけん者')}</div><div class="rs-hc-sub">${esc(D.JOBS[s.job].name)} Lv${jl[s.job]}</div><p class="rs-story-text">${esc(E[0][1])}</p>`,
      `<p class="rs-story-text">${esc(E[1][1])}</p><div class="rs-h2">たすけた ちいき</div><p class="rs-p">${regs}</p>`,
      `<div class="rs-h2">そだてた しるし</div><p class="rs-p">${jobs}</p><div class="rs-h2">きねんひん</div><p class="rs-p">${memos}</p>`,
      `<p class="rs-story-text">${esc(E[2][1])}</p><p class="rs-story-text">${esc(E[3][1])}</p><p class="rs-p">ほんぺんは クリア！ ぼうけんの ちずから 「6つの ひきょう」に ちょうせんできます。</p>`
    ];
    const last = i >= N - 1;
    return frame('エンディング', `<div class="rs-panel rs-story c">${p[i]}<div class="rs-story-n">${i + 1} / ${N}</div></div><div class="rs-row2"><button class="rs-btn" id="enSkip">とばす</button><button class="rs-big" id="enNext">${last ? 'おわり' : 'つぎへ'}</button></div><p class="rs-p c">この ぎゃめんは がぞうが まだ「仮」です。</p>`);
  };
  AFTER.ending = function () {
    const c = doc.getElementById('rsEndHero'); if (c) hero(c, save().job, 6, { bg: 'crown' });
    const done = () => { const s = save(); s.ending.seen = true; commit(); UI.endI = 0; if (UI.params && UI.params.from === 'result') root.home(); else go('adv'); };
    doc.getElementById('enNext').onclick = () => { if ((UI.endI || 0) >= 3) done(); else { UI.endI = (UI.endI || 0) + 1; rerender(); } };
    doc.getElementById('enSkip').onclick = done;
  };
  VIEWS.memorial = function () {
    const s = save(); return frame('きねんえ', `<div class="rs-panel c"><canvas id="rsMemo" class="rs-memo" aria-label="夜明けの きねんえ（仮の絵）"></canvas><p class="rs-p">「${esc((s.rewards.titles.includes('空の果てを見た者')) ? '空の果てを見た者' : 'まだ ありません')}」　${s.rewards.lamp ? '夜明けの灯を ともした。' : ''}</p><p class="rs-p">これは コードで かいた 仮の絵です。</p></div>`);
  };
  AFTER.memorial = function () {
    const c = doc.getElementById('rsMemo'), s = save(), w = 100, h = 66, k = Math.max(2, Math.floor(Math.min(360, c.parentNode.clientWidth - 24) / w));
    c.width = w; c.height = h; c.style.width = (w * k) + 'px'; c.style.height = (h * k) + 'px'; const g = c.getContext('2d');
    SP.drawBackground(g, w, h, 'dawnisle'); g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(70, 24, 9, 0, 7); g.fill();
    g.save(); g.scale(2, 2); SP.drawHero(g, s.job, 12, 32, { look: look(), outfit: M.costumeColor(s) }); SP.drawEnemy(g, 'xb_dawndragon', true, 28, 30, { lift: 2 }); g.restore();
  };

  // ---------- せってい（音・振動。どちらも初期オフ） ----------
  VIEWS.settings = function () {
    const st = save().settings;
    return frame('せってい', `<div class="rs-panel"><div class="rs-h2">おと</div><p class="rs-p">ぼうけん中の 小さな 音（せいかい・こうげき・ごほうびなど）。BGMは ありません。はじめは オフです。</p>
      <div class="rs-chips"><button class="rs-chip${st.sound ? ' on' : ''}" id="snOn" aria-pressed="${!!st.sound}">オン</button><button class="rs-chip${!st.sound ? ' on' : ''}" id="snOff" aria-pressed="${!st.sound}">オフ</button><button class="rs-chip" id="snTest">おとを ならす</button></div>
      <div class="rs-h2">しんどう</div><p class="rs-p">ごほうびの ときに ふるえます（たんまつが たいおうしている ときだけ）。はじめは オフです。</p>
      <div class="rs-chips"><button class="rs-chip${st.vibrate ? ' on' : ''}" id="vbOn" aria-pressed="${!!st.vibrate}">オン</button><button class="rs-chip${!st.vibrate ? ' on' : ''}" id="vbOff" aria-pressed="${!st.vibrate}">オフ</button></div></div>`);
  };
  AFTER.settings = function () {
    const st = save().settings, set = (k, v) => { st[k] = v; commit(); if (k === 'sound' && v && RPG.sound) RPG.sound.unlock(); rerender(); };
    doc.getElementById('snOn').onclick = () => set('sound', true); doc.getElementById('snOff').onclick = () => set('sound', false);
    doc.getElementById('vbOn').onclick = () => set('vibrate', true); doc.getElementById('vbOff').onclick = () => set('vibrate', false);
    doc.getElementById('snTest').onclick = () => { if (RPG.sound) { RPG.sound.unlock(); RPG.sound.play('reward'); } };
  };

  // しょうごう・いしょう（クリア後の ごほうび）
  function rewardsPanel(s) {
    const R = s.rewards, cs = M.allCostumes().filter(c => R.costumes.includes(c.id));
    if (!R.titles.length && !cs.length) return '';
    const t = R.titles.map(x => `<button class="rs-chip${s.title === x ? ' on' : ''}" data-title="${esc(x)}" aria-pressed="${s.title === x}">${esc(x)}</button>`).join('');
    const o = cs.map(c => `<button class="rs-chip${s.look.outfit === c.id ? ' on' : ''}" data-outfit="${c.id}" aria-pressed="${s.look.outfit === c.id}"><span class="rs-dotc" style="background:${c.color}"></span>${esc(c.name)}</button>`).join('');
    return `<div class="rs-panel"><div class="rs-h2">しょうごう・いしょう</div>${t ? `<div class="rs-chips">${t}</div>` : ''}${o ? `<div class="rs-h3">いしょう</div><div class="rs-chips"><button class="rs-chip${!s.look.outfit ? ' on' : ''}" data-outfit="">しょくぎょうの いろ</button>${o}</div>` : ''}${R.lamp ? '<button class="rs-btn" data-go="memorial">きねんえを みる</button>' : ''}</div>`;
  }

  // ---------- かじや：固有そうび ----------
  function uniquePanel(s) {
    const rows = W.UNIQ.map(u => {
      const i = M.uniqueInfo(s, u.key), reg = u.region.name;
      const act = i.owned
        ? (i.reErr ? `<small class="rs-why">${esc(i.reErr)}</small>` : `<small>さいたんぞう：ランク${D.RANK_NAME[i.rank - 1]} → ${D.RANK_NAME[i.target - 1]}（${i.reCoin}コイン ＋ ${esc(C.oreName(i.target))} ×${i.reOre}）</small>`) + `<button class="rs-btn sm" data-reforge="${u.key}" ${i.reErr ? 'disabled' : ''}>さいたんぞうする</button>`
        : `<small>${esc(u.matName)} ${i.have} / ${i.need}（${esc(reg)}のボス）</small><button class="rs-btn sm" data-craft="${u.key}" ${i.err ? 'disabled' : ''}>つくる</button>${i.err ? `<small class="rs-why">${esc(i.err)}</small>` : ''}`;
      return `<div class="rs-item"><div><b>${esc(u.name)}</b><i class="rs-rare">固有</i>${i.owned ? rankTag(D.ITEMS[i.owned]) : ''}<i class="rs-prov">だい${u.ch}章</i></div><small>${esc(i.text)}</small>${act}</div>`;
    }).join('');
    const n = W.UNIQ.filter(u => M.ownedUnique(s, u.key)).length;
    return `<details class="rs-det rs-panel"><summary>固有そうび（${n} / ${W.UNIQ.length}）</summary><p class="rs-p">ボスの ざいりょう3こで つくれます。ざいりょうは ぼうけんの ちずの「さいせん」で あつまります。さいたんぞうで ランクが あがっても、効果・きょうかは そのままです。</p><div class="rs-list">${rows}</div></details>`;
  }
  const oldForge = VIEWS.forge, oldForgeAfter = AFTER.forge;
  VIEWS.forge = function () {
    let h = oldForge.apply(this, arguments);
    h = h.replace('<p class="rs-p">ボスの そざいで つくる 固有そうびは、まだ つくれません（じっそうまえ）。</p>', '').replace('<div class="rs-list">', uniquePanel(save()) + '<div class="rs-list">');
    return h;
  };
  AFTER.forge = function () {
    oldForgeAfter.apply(this, arguments);
    app().querySelectorAll('[data-craft]').forEach(b => b.onclick = () => { const r = M.craftUnique(save(), b.dataset.craft); UI.msg = r.ok ? `${D.ITEMS[r.id].name} を つくりました！` : r.err; if (r.ok) { commit(); RPG.sound && RPG.sound.play('chest'); } rerender(); });
    app().querySelectorAll('[data-reforge]').forEach(b => b.onclick = () => { const r = M.reforgeUnique(save(), b.dataset.reforge); UI.msg = r.ok ? `ランク${D.RANK_NAME[r.to - 1]} に さいたんぞうしました！` : r.err; if (r.ok) commit(); rerender(); });
  };

  // ---------- 追加の導線（ぼうけん・じぶん・ずかん） ----------
  const oldAdv = VIEWS.adv, oldAdvAfter = AFTER.adv;
  VIEWS.adv = function () {
    const s = save(), r = A.currentRoute(s), q = r.quest ? W.QUESTS[r.quest] : null;
    let h = oldAdv.apply(this, arguments);
    const seen = !!s.seen[storyKey(r)], ending = M.mainCleared(s);
    const st = `<div class="rs-panel"><div class="rs-h2">おはなし</div><p class="rs-p">${seen ? 'この くかんの おはなしは よみました。' : '<b class="rs-new">あたらしい おはなしが あります。</b>'}</p><div class="rs-row2"><button class="rs-btn" id="rsStory">${seen ? 'もういちど よむ' : 'おはなしを よむ'}</button><button class="rs-btn" data-go="storylist">よみかえす</button></div>${ending ? '<button class="rs-btn" data-go="ending">エンディングを みる</button>' : ''}</div>`;
    h = h.replace('<div class="rs-panel"><div class="rs-h2">わざと さくせん</div>', st + questPanel(s) + '<div class="rs-panel"><div class="rs-h2">わざと さくせん</div>');
    return h;
  };
  AFTER.adv = function () {
    oldAdvAfter.apply(this, arguments);
    const s = save(), r = A.currentRoute(s), sb = doc.getElementById('rsStory'); if (sb) sb.onclick = () => startStory(r, 'adv');
    app().querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const id = b.dataset.q || null, e = M.selectQuest(s, id);
      if (!e.ok) { UI.msg = e.err; rerender(); return; }
      commit(); UI.msg = id ? `「${W.QUESTS[id].name}」を えらびました。` : 'ほんぺんに もどしました。'; rerender();
    });
  };
  const oldMe = VIEWS.me, oldMeAfter = AFTER.me;
  VIEWS.me = function () {
    const s = save(); let h = oldMe.apply(this, arguments);
    h = h.replace('<div class="rs-hc-job">', (s.title ? `<div class="rs-hc-sub">「${esc(s.title)}」</div>` : '') + '<div class="rs-hc-job">');
    h = h.replace('<div class="rs-panel rs-links">', rewardsPanel(s) + '<div class="rs-panel rs-links">').replace('<button class="rs-btn" data-go="data">ゲームのデータ</button>', '<button class="rs-btn" data-go="settings">せってい（おと・しんどう）</button><button class="rs-btn" data-go="data">ゲームのデータ</button>');
    return h;
  };
  AFTER.me = function () {
    oldMeAfter.apply(this, arguments); const s = save();
    app().querySelectorAll('[data-title]').forEach(b => b.onclick = () => { M.setTitle(s, s.title === b.dataset.title ? null : b.dataset.title); commit(); rerender(); });
    app().querySelectorAll('[data-outfit]').forEach(b => b.onclick = () => { M.setOutfit(s, b.dataset.outfit || null); commit(); rerender(); });
  };
  PARENT.story = 'adv'; PARENT.storylist = 'adv'; PARENT.ending = 'adv'; PARENT.memorial = 'me'; PARENT.settings = 'me';
  ROOT_OF.story = 'adv'; ROOT_OF.storylist = 'adv'; ROOT_OF.ending = 'adv'; ROOT_OF.memorial = 'me'; ROOT_OF.settings = 'me';

  // 学習を止めないための保険：画面側の例外は RPG を止めて、学習ホームに戻す
  ['open', 'homeTop', 'bindHomeTop', 'navHtml'].forEach(k => {
    const f = RPG[k];
    RPG[k] = function () { try { return f.apply(RPG, arguments); } catch (e) { RPG.ok = false; RPG.err = 'crash'; if (root.console) console.error('RPG', k, e); return k === 'homeTop' || k === 'navHtml' ? '' : false; } };
  });
  RPG.go = go;
})(typeof self !== 'undefined' ? self : this);
