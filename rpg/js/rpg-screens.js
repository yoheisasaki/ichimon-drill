'use strict';
// 画面（第2段）：ホームの上部・下部ナビ・ぼうけん（地図）・まち・じぶん・装備・店・鍛冶・転職・技設定・外見・図鑑・実績
// 主人公は heroCv→drawHeroLayered、敵は enemyCv。ロジックは rpg-meta.js。ここはDOMだけ。
(function (root) {
  const RPG = root.RPG; if (!RPG) return;
  const D = root.RPGData, C = root.RPGCore, B = root.RPGBattle, M = root.RPGMeta, SP = root.RPGSprites, A = root.RPGAdv, W = root.RPGWorld, ST = root.RPGStory;
  const doc = root.document, app = () => doc.getElementById('app');
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const NOW = () => (root.__RPG_NOW ? root.__RPG_NOW() : Date.now());
  const reduceMotion = () => { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const save = () => RPG.save;
  const UI = { shopAll: false, screen: 'home', params: {}, eq: null, slot: 'weapon', shopTab: 'weapon', confirm: null, tier: 'base', sel: null, tactic: null, look: null, name: '', codexTab: 'enemy', msg: '' };
  const TABS = [['home', 'ホーム'], ['adv', '{冒険|ぼうけん}'], ['town', '{街|まち}'], ['me', '{自分|じぶん}']];
  const ROOT_OF = { adv: 'adv', town: 'town', me: 'me', place: 'town', equip: 'me', shop: 'town', forge: 'town', jobs: 'town', jobdetail: 'town', loadout: 'adv', look: 'me', codex: 'me', ach: 'town', data: 'me' };
  const PARENT = { place: 'town', equip: 'me', shop: 'place', forge: 'place', jobs: 'place', jobdetail: 'jobs', loadout: 'adv', look: 'me', codex: 'me', ach: 'place', data: 'me' };
  const TACTICS = [['auto', 'おまかせ', '様子を見て自動で選ぶ'], ['attack', '攻める', '攻撃を主に。回復は HPが低い時だけ'], ['guard', '守る', '予告された大技にそなえ、回復も早め']];

  // ---------- 小さな部品 ----------
  function look() { return M.lookOf(save()); }
  const RuRb = root.RPGRuby, rb = RuRb.render;   // {漢字|よみ} → <ruby>（共通の安全なレンダラー）
  const jobRb = j => rb(D.JOBS[j].ruby || D.JOBS[j].name), skRb = id => rb(D.SKILLS[id].ruby || D.SKILLS[id].name);
  const PARAMS = new URLSearchParams(root.location ? root.location.search : '');
  // 主人公の絵は全て heroCv（canvas＋data-hero）→ paintHeroes → SP.drawHeroLayered。画像の読込が終わると SP.onUpdate で描き直す
  // 舞台（背景）：用途ごとの背景画像・大きさ（canvas の1px＝CSSの1px。主人公は整数倍）
  const STAGE = {
    home: { bg: 'bg_town', h: 262, k: 2, pose: 'idle', at: 0.5, gy: 46 }, self: { bg: 'bg_room_room', w: 128, h: 120, k: 1, pose: 'idle', at: 0.5 },
    equip: { bg: 'bg_room_shop', w: 168, h: 208, k: 2, pose: 'idle', at: 0.5 }, job: { bg: 'bg_room_temple', h: 224, k: 2, pose: 'idle', at: 0.5 },
    jobcard: { bg: 'bg_room_temple', w: 120, h: 112, k: 1, pose: 'idle', at: 0.5 }, look: { bg: 'bg_room_room', h: 208, k: 2, pose: 'idle', at: 0.5 },
    ending: { bg: 'bg_crown', h: 232, k: 2, pose: 'win', at: 0.5 }, fx: { bg: 'bg_room_temple', w: 240, h: 232, k: 2, pose: 'idle', at: 0.5 }, mini: { w: 44, h: 36, k: 1, pose: 'idle', at: 0.5, plain: true, strip: true }
  };
  function heroOpts(use, o) {
    const s = save(), job = (o && o.job) || s.job, a = Object.assign({ use, job }, o || {});
    if (a.weaponId === undefined) a.weaponId = job === s.job ? M.artWeapon(job, s.equip.weapon) : M.artWeapon(job, C.bestOwned(s, 'weapon', job));
    else a.weaponId = M.artWeapon(job, a.weaponId);
    if (a.costume === undefined) a.costume = M.costumeOf(s, job);
    return a;
  }
  const heroCv = (use, o) => `<canvas class="rs-hcv rs-hcv-${use}" data-hero="${esc(JSON.stringify(heroOpts(use, o)))}" aria-hidden="true"></canvas>`;
  function paintHero(c) {
    const a = JSON.parse(c.dataset.hero), st = STAGE[a.use] || STAGE.self;
    const W = st.w || Math.max(200, Math.round(c.parentNode.clientWidth || 300)), H = st.h; if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    c.style.width = st.w ? W + 'px' : '100%'; c.style.height = H + 'px';
    const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.imageSmoothingEnabled = false;
    const bg = st.bg && SP.IMGS[st.bg];
    if (bg) { const sc = Math.max(W / bg.width, H / bg.height), dw = bg.width * sc, dh = bg.height * sc; g.drawImage(bg, (W - dw) / 2, (H - dh) * (a.use === 'home' ? 0.62 : 1), dw, dh); }
    else if (st.bg) { g.fillStyle = '#16244d'; g.fillRect(0, 0, W, H); }
    if (a.use !== 'mini') { g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(W * st.at, H - (st.gy || 8), 30 * st.k, 5 * st.k, 0, 0, 7); g.fill(); }
    const look0 = a.look || look();
    const r = SP.drawHeroLayered(g, { job: a.job, costume: a.costume, weaponId: a.weaponId, pose: a.pose || st.pose, use: st.strip ? 'strip' : a.use, look: look0, x: Math.round(W * st.at), groundY: H - (st.gy || 8), scale: st.k, outline: st.strip ? '#0d1630' : null });
    c.dataset.drawn = r;
  }
  function paintHeroes(rootEl) { (rootEl || doc).querySelectorAll('canvas[data-hero]').forEach(c => { try { paintHero(c); } catch (e) { if (root.console) console.error('paintHero', e); } }); }
  function enemyCv(canvas, id, boss, box) {   // 敵：正式画像を枠(box)に収めて描く。無ければ暫定絵（開発用検査に出る）
    const bw = box || 96, bh = Math.round(bw * 0.84); canvas.width = bw; canvas.height = bh; canvas.style.width = bw + 'px'; canvas.style.height = bh + 'px';
    const g = canvas.getContext('2d'), im = SP.IMGS['enemy_' + id], sc = im ? Math.min(1, (bw - 4) / im.width, (bh - 2) / im.height) : 1;
    g.clearRect(0, 0, bw, bh); SP.drawEnemy(g, id, boss, Math.round(bw / 2) - 7, bh - 1, { img: 'full', scale: sc });
  }
  const paintEnemies = rootEl => (rootEl || app()).querySelectorAll('canvas[data-en]').forEach(c => enemyCv(c, c.dataset.en, c.dataset.boss === '1', +c.dataset.box || 96));
  SP.onUpdate(() => { if (!RPG.ok) return; const A_ = app(); paintHeroes(doc); if (A_) paintEnemies(A_); if (UI.screen === 'memorial' && AFTER.memorial && A_ && A_.querySelector('canvas[data-m],#rsMemo')) AFTER.memorial(); devPanel(); });
  function devPanel() {   // ?devcheck=1：1枚絵で描いている主人公・正式画像の無い敵を一覧に出す
    if (!RPG.devcheck) return; root.__rpgDev = SP.devReport(); if (PARAMS.get('devpanel') !== '1') return; let d = doc.getElementById('rsDev');
    if (!d) { d = doc.createElement('div'); d.id = 'rsDev'; d.style.cssText = 'position:fixed;left:4px;top:4px;z-index:99;max-width:70vw;max-height:40vh;overflow:auto;background:#000c;color:#9ff;font:11px/1.4 monospace;padding:4px 6px;border-radius:6px;pointer-events:none'; doc.body.appendChild(d); }
    const r = SP.devReport(); root.__rpgDev = r;
    d.textContent = `devcheck parts=${r.parts} 部品:${r.layered.length} 1枚絵:${r.whole.length} 無し:${r.missing.length} 敵絵なし:${r.enemyMissing.length}\n` + r.whole.map(e => '1枚絵 ' + e.key + ' ' + e.reason).concat(r.missing.map(e => '無し ' + e.key)).concat(r.enemyMissing.map(e => '敵 ' + e)).join('\n');
  }
  root.RPG.devReport = () => SP.devReport();
  const outfitNow = () => M.costumeOf(save());
  function jobSprites() { paintHeroes(app()); }
  const bar = (v, max) => `<div class="rs-bar"><i style="width:${max ? Math.min(100, Math.round(v / max * 100)) : 100}%"></i></div>`;
  const coinHtml = () => `<span class="rs-coin">● ${save().coins}</span>`;
  const itemLine = id => { const it = D.ITEMS[id]; return it ? it.name : '（なし）'; };
  function statLine(id) {
    const st = M.statOf(save(), id), it = D.ITEMS[id]; if (!it) return '';
    return st.atk != null ? `攻撃 ${st.atk}` : st.def != null ? `防御 ${st.def}` : '';
  }
  const iconOf = (id, px) => { const a = RPG.assets && (RPG.assets['icon_' + id] || RPG.assets['icon_' + id.replace(/^(u_.+)_\d$/, '$1')]); px = px || 32; return a && a.path ? `<img class="rs-ic" src="${a.path}" width="${px}" height="${px}" style="width:${px}px;height:${px}px" alt="" aria-hidden="true">` : ''; };
  // ルビは rpg-ruby.js の render（{漢字|よみ} と辞書）。画面ごとにタグを外して漢字だけに戻す経路は作らない
  const kr = RuRb.render;
  // 技の短い説明（最初の画面用。詳しい倍率は折りたたみの中）
  function skillBlurb(sk) {
    if (!sk) return '';
    const e = D.EL_NAME && sk.el ? D.EL_NAME[sk.el] : null;
    if (sk.heal) return 'HPを回復する';
    if (sk.guard) return '次の攻撃を軽くする';
    if (sk.atkDown) return '敵の攻撃を弱める';
    if (sk.hits) return '連続で攻撃する';
    if (sk.stack) return 'ためた力で攻撃する';
    return e ? e + 'の力で攻撃する' : '強く攻撃する';
  }
  const rankTag = it => it.rank ? `<i class="rs-rank">ランク${D.RANK_NAME[it.rank - 1]}</i>` : '';
  const rareTag = it => (it.rarity === 'rare' ? '<i class="rs-rare">レア</i>' : it.relic ? '<i class="rs-rare">秘境</i>' : it.rarity === 'unique' ? '<i class="rs-rare">固有</i>' : '') + '';
  const tierName = t => ({ base: '基本職', adv: '上級職', top: '最上級職' })[t];
  const noticeBox = () => RPG.noticeHtml();
  function commit() { const ok = RPG.persist(); if (!ok) UI.msg = RPG.err === 'stale' ? '他の画面で進んでいます。読み込みなおしてね。' : '保存できませんでした（「ゲームのデータ」で書き出してね）。'; return ok; }

  // ---------- 下部ナビ ----------
  RPG.navHtml = function (active) {
    return `<div class="rs-navspace"></div><nav class="rs-nav" aria-label="メニュー">${TABS.map(([id, nm]) => `<button class="rs-tab${id === active ? ' on' : ''}" data-tab="${id}"${id === active ? ' aria-current="page"' : ''}>${rb(nm)}</button>`).join('')}</nav>`;
  };
  function bindNav() {
    app().querySelectorAll('.rs-tab').forEach(b => b.onclick = () => { const id = b.dataset.tab; if (id === 'home') { root.home(); } else go(id); });
  }

  // ---------- ホーム（学習ホームの上：主人公のいる情景・職業と次の技。開始ボタンは app.js が直後に置く） ----------
  RPG.homeTop = function () {
    if (!RPG.ok) return RPG.noticeHtml();
    const s = save(), job = s.job, jl = C.jobLevel(job, s.jobXp[job]), hl = C.heroLevel(s.advXp), nx = C.nextSkill(job, s.jobXp[job]);
    const a = s.active, resume = a && a.basic.n > 0 && a.basic.n < C.ADV_UNIT;
    return `${noticeBox()}<section class="rs-home" aria-label="冒険者の様子">
      <div class="rs-hc-meta"><span>${kr('冒険者')} Lv${hl.lv}</span>${coinHtml()}${resume ? `<span class="rs-resume-note">${kr('冒険')}の途中 ${a.basic.n} / ${C.ADV_UNIT}</span>` : ''}</div>
      <div class="rs-stage">${heroCv('home')}<div class="rs-stage-name"><b>${esc(s.name || '冒険者')}</b><span>${jobRb(job)} Lv${jl.lv}</span></div></div></section>`;
  };
  // 開始ボタンの下の「続き：地域名」（今の冒険の場所）
  RPG.homeNow = function () {
    if (!RPG.ok) return '';
    try { const r = A.currentRoute(save()), q = r.quest ? W.QUESTS[r.quest] : null; return esc(q ? q.name : D.REGIONS[r.region >= 0 ? r.region : D.REGIONS.length - 1].name); } catch (e) { return ''; }
  };
  // 次の技（1行のカード）
  RPG.homeNext = function () {
    if (!RPG.ok) return '';
    const s = save(), job = s.job, nx = C.nextSkill(job, s.jobXp[job]);
    return `<div class="rs-nextskill">${nx ? `<span>${kr('次の技')}</span><b>${skRb(nx.skill.id)}</b><i>あと ${Math.max(0, nx.remain)}</i>` : `<span>${kr('この職業の技は、全部覚えた')}</span>`}</div>`;
  };
  // 日次ボーナス・目標・受け取った宝箱（開始ボタンの下）
  RPG.homeBonus = function () {
    if (!RPG.ok) return '';
    const s = save(), key = C.todayKey(s, NOW()), used = s.daily.used[key] || 0, g = s.goal && D.JOBS[s.goal.job] ? s.goal.job : null;
    const chip = (n, label) => `<div class="rs-bonus${used >= n ? ' used' : ''}"><span class="rs-bicon" aria-hidden="true">★</span><b>${label}</b><small>${used >= n ? '使った' : 'まだ使える'}</small></div>`;
    let goalTxt = ''; if (g) { const left = M.jobProgress(s, g).filter(r => !r.pending && !r.done); goalTxt = `<div class="rs-hc-line">${kr('目標')}：${jobRb(g)}${left.length ? '' : '（もうなれる！）'}</div>`.replace('目標', '目標'); }
    return `<section class="rs-homecard" aria-label="今日のボーナス"><div class="rs-hc-b"><span>${rb('{今日|きょう}の{冒険|ぼうけん}ボーナス')}</span><div class="rs-bonuses">${chip(1, rb('{経験値|けいけんち} ×3'))}${chip(2, rb('{経験値|けいけんち} ×2'))}</div></div>${goalTxt}${RPG.homeChestHtml ? RPG.homeChestHtml() : ''}</section>`;
  };
  RPG.bindHomeTop = function () {
    paintHeroes(app());
    if (RPG.bindHomeChests) RPG.bindHomeChests();
    bindNav();
  };

  // ---------- 画面の骨組み ----------
  function frame(title, body, opt) {
    opt = opt || {}; const back = opt.back !== false;
    return `<div class="rs" id="rsRoot"><div class="rs-head">${back ? '<button class="rs-back" id="rsBack" aria-label="もどる">‹ もどる</button>' : '<span class="rs-back sp"></span>'}<h1 class="rs-title">${title}</h1>${opt.right || '<span class="rs-back sp"></span>'}</div>${UI.msg ? `<div class="rs-msg" role="status">${esc(UI.msg)}</div>` : ''}${noticeBox()}${body}</div>${RPG.navHtml(ROOT_OF[UI.screen] || 'me')}`;
  }
  function go(name, params) {
    UI.screen = name; UI.params = params || {}; UI.msg = '';
    if (name === 'equip') { UI.eq = Object.assign({}, save().equip); UI.slot = 'weapon'; const ti = params && params.tryItem && D.ITEMS[params.tryItem]; if (ti) { UI.slot = ti.slot; UI.eq[ti.slot] = ti.id; } }
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
    bindNav(); jobSprites(); paintEnemies(A);
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
    const nowKey = r.quest ? (W.QUESTS[r.quest].kind === 'rematch' ? W.QUESTS[r.quest].region : (W.QUESTS[r.quest].kind === 'trial' ? null : r.quest)) : (r.region >= 0 ? D.REGIONS[r.region].id : null);
    const nodeHtml = (x, i) => `<li class="rs-node ${x.cleared ? 'clear' : x.current ? 'cur' : 'lock'}"><span class="rs-dot">${x.cleared ? '✓' : i + 1}</span><div><b>${esc(x.name)}</b><small>${x.cleared ? '突破済み' : x.current ? (x.atBoss ? `ボスの戦い　${x.inRegion - x.nNormal + 1} / ${x.total - x.nNormal}` : `${esc(x.points[Math.min(x.points.length - 1, Math.floor(x.inRegion / 3))])}　${x.inRegion + 1} / ${x.total}`) : 'まだここまで来ていない'}</small>${x.current ? `<small>${esc(x.story)}</small>` : ''}${x.current || x.cleared ? `<small>ボス：${esc(x.boss)}</small>` : ''}</div><button class="rs-mapbtn" data-go="regionmap" data-p='{"id":"${x.id}"}' aria-label="${esc(x.name)}の地図を開く">地図</button></li>`;
    const chapters = [1, 2, 3].map(c => `<div class="rs-h2">${CH[c]}</div><ol class="rs-map">${info.map((x, i) => x.ch === c ? nodeHtml(x, i - info.findIndex(y => y.ch === c)) : '').join('')}</ol>`).join('');
    const wish = D.WISH_LIST.map(w => `<button class="rs-chip${s.wish === w ? ' on' : ''}" data-wish="${w}" aria-pressed="${s.wish === w}">${esc(D.WISH_NAME[w])}</button>`).join('');
    const a = s.active, nOver = !q && s.progress.step >= D.ROUTE.length;
    return frame('冒険', `
      <div class="rs-panel"><div class="rs-h2">今の冒険</div>
        <div class="rs-now"><canvas class="rs-ecv" id="rsEnemy" data-en="${r.enemy}" data-boss="${ed.boss ? 1 : 0}" data-box="96" aria-hidden="true"></canvas><div><b>${esc(ed.name)}</b>${ed.boss ? '<i class="rs-rare">ボス</i>' : ''}<small>${esc(q ? (q.kind === 'rematch' ? q.name : q.name + '・' + r.point) : D.REGIONS[r.region].name + '・' + r.point)}${nOver ? '（全部クリア！最後のボスと再戦）' : ''}</small>${ed.weak ? `<small>弱点：${esc(D.EL_NAME[ed.weak])}</small>` : ''}${hpKeep < 100 ? `<small>残りHP ${hpKeep}%（続きの戦い）</small>` : ''}</div></div>
        ${a && a.basic.n > 0 ? `<div class="rs-note">冒険 ${a.basic.n} / ${C.ADV_UNIT}問（続きから）</div>` : ''}
        <button class="rs-big" id="rsStart">学習を選んでスタート</button>${nowKey ? `<button class="rs-btn" data-go="regionmap" data-p='{"id":"${nowKey}"}'>今の地図を開く</button>` : ''}</div>
      <div class="rs-panel"><div class="rs-h2">技と作戦</div><p class="rs-p">${sk.map(esc).join('・')}／作戦：${esc(tac)}</p><button class="rs-btn" data-go="loadout">技・作戦を変える</button></div>
      <div class="rs-panel"><div class="rs-h2">宝箱のお願い</div><p class="rs-p">朝星の宝箱からレアが出るとき、この種類から選ばれます。</p><div class="rs-chips" role="group">${wish}</div></div>
      <div class="rs-panel">${imgOf('bg_worldmap') ? `<div class="rs-h2">世界地図（浮島世界ルミナリア）</div><p class="rs-p">地域の「地図」を押すと、その地域の探検地図が開きます。</p><img class="rs-wmap" alt="浮島世界ルミナリアの地図" src="${imgOf('bg_worldmap').src}">` : ''}${chapters}</div>`, { back: false });
  };
  AFTER.adv = function () {
    doc.getElementById('rsStart').onclick = () => root.home();
    app().querySelectorAll('[data-wish]').forEach(b => b.onclick = () => { M.setWish(save(), b.dataset.wish); commit(); rerender(); });
  };

  // ---------- まち ----------
  const PLACES = {
    guild: { name: 'ギルド', desc: 'ギルド長ミラが冒険の様子を聞いてくれる。', links: [['jobs', '転職'], ['ach', '実績']] },
    shop: { name: '装備屋', desc: '武器・防具・アクセサリーを買う・売る・返す。', links: [['shop', '店（買う・売る）'], ['equip', '装備を変える']] },
    forge: { name: '鍛冶屋', desc: '鍛冶師トトが装備を鍛えてくれる。', links: [['forge', '強化']] },
    temple: { name: '神殿', desc: 'しるしの力を整える。冒険の前に技を選ぶ。', links: [['loadout', '技・作戦']] },
    room: { name: '自室', desc: '自分の部屋。', links: [['look', '名前・見た目'], ['codex', '図鑑'], ['data', 'ゲームのデータ']] },
    ship: { name: '空船', desc: '見習い船長ルカの船。冒険の地図を開く。', links: [['adv', '冒険の地図']] }
  };
  const mainCleared = s => !!(s.ending && s.ending.seen) || s.progress.step >= D.ROUTE.length;
  const chCleared = (s, ch) => D.REGIONS.filter(x => x.ch === ch).every(x => (s.progress.clearedRegions || []).includes(x.id));
  const imgOf = id => (SP.IMGS && SP.IMGS[id]) || null;
  const roomImg = id => { const im = imgOf('bg_room_' + id); return im ? `<div class="rs-room" role="img" aria-label="${esc((PLACES[id] || {}).name || '')}のなか" style="background-image:url(${im.src})"></div>` : ''; };
  const NPC_OF = { guild: 'mira', forge: 'toto', ship: 'luca' };
  const npcImg = (id, alt) => { const k = NPC_OF[id], im = k && (alt && imgOf('npc_' + k + '_alt') || imgOf('npc_' + k)), a2 = k && imgOf('npc_' + k + '_alt'); return im ? `<img class="rs-npc" alt="" src="${im.src}"${a2 ? ` data-alt="${a2.src}" data-base="${imgOf('npc_' + k).src}"` : ''}>` : ''; };
  const NPC_WHO = { 'ミラ': 'mira', 'トト': 'toto', 'ルカ': 'luca', '黒鎧の騎士': 'knight' };
  const TOWN_PARTS = [['town_windmill', 'meadow', 74, 57], ['town_fountain', 'waterland', 35, 72], ['town_airship', null, 46, 1], ['town_monument', 'main', 41, 28]];
  VIEWS.town = function () {
    const spots = [['guild', 'ギルド', 5, 36], ['shop', '装備屋', 37, 45], ['forge', '鍛冶屋', 67, 34], ['temple', '神殿', 8, 8], ['room', '自室', 66, 4], ['ship', '空船', 38, 0]];
    const bg = imgOf('bg_town'), s = save(), cl = s.progress.clearedRegions || [], main = mainCleared(s);
    const parts = bg ? TOWN_PARTS.filter(([id, need]) => imgOf(id) && (!need || (need === 'main' ? main : cl.includes(need)))).map(([id, , x, y]) => { const im = imgOf(id); return `<img class="rs-tpart" alt="" src="${im.src}" style="left:${x}%;top:${y}%;width:${(im.width / 240 * 100).toFixed(1)}%">`; }).join('') : '';
    return frame('風待ちの町', `<p class="rs-p c">行きたい場所をタップ</p>
      <div class="rs-town${bg ? ' img' : ''}" role="group" aria-label="まちの地図"${bg ? ` style="background-image:url(${bg.src})"` : ''}>${parts}${spots.map(([id, nm, x, y]) => `<button class="rs-spot s-${id}" style="left:${x}%;top:${y}%" data-place="${id}"><span class="rs-bld"></span><b>${nm}</b></button>`).join('')}${bg ? '' : '<div class="rs-sea"></div>'}</div>`, { back: false });
  };
  AFTER.town = function () {
    app().querySelectorAll('[data-place]').forEach(b => b.onclick = () => { const id = b.dataset.place; if (id === 'ship') go('adv'); else go('place', { id }); });
  };
  VIEWS.place = function (p) {
    const pl = PLACES[p.id] || PLACES.guild;
    return frame(pl.name, `${roomImg(p.id)}${npcImg(p.id)}<p class="rs-p c">${esc(pl.desc)}</p><div class="rs-list">${pl.links.map(([to, nm]) => `<button class="rs-big alt" data-go="${to}" data-p='${JSON.stringify({ place: p.id })}'>${nm}</button>`).join('')}</div>`);
  };

  AFTER.place = function () {
    const n = app().querySelector('.rs-npc[data-alt]'); if (n) n.onclick = () => { n.src = n.src === n.dataset.alt ? n.dataset.base : n.dataset.alt; };
  };

  // ---------- じぶん ----------
  VIEWS.me = function () {
    const s = save(), jl = C.jobLevels(s), hl = C.heroLevel(s.advXp), st = M.statsWith(s, s.equip), jd = D.JOBS[s.job];
    const jobs = D.JOB_IDS.map(j => { const lv = C.jobLevel(j, s.jobXp[j]); return `<div class="rs-jl${j === s.job ? ' me' : ''}"><span>${esc(D.JOBS[j].name)}</span><b>Lv${lv.lv}</b></div>`; }).join('');
    const cs = M.codexSummary(s);
    return frame('自分', `
      <div class="rs-panel rs-me">${heroCv('self')}<div><div class="rs-hc-name">${esc(s.name || '冒険者')}</div><div class="rs-hc-job">${esc(jd.name)} Lv${jl[s.job]}</div><div class="rs-hc-sub">冒険者 Lv${hl.lv}</div>${bar(hl.into, hl.need)}<div class="rs-hc-sub">${coinHtml()}</div></div></div>
      <div class="rs-panel"><div class="rs-h2">強さ</div><div class="rs-stats"><div>HP <b>${st.maxHp}</b></div><div>攻撃 <b>${st.atk}</b></div><div>防御 <b>${st.def}</b></div></div></div>
      <div class="rs-panel"><div class="rs-h2">今の装備</div>
        ${['weapon', 'armor', 'acc'].map(sl => `<div class="rs-eqrow"><small>${M.SLOT_NAME[sl]}</small><b>${esc(itemLine(s.equip[sl]))}${s.equip[sl] && M.enhLv(s, s.equip[sl]) ? ' +' + M.enhLv(s, s.equip[sl]) : ''}</b></div>`).join('')}
        <button class="rs-btn" data-go="equip" data-p='{"back":"me"}'>装備を見る・変える</button></div>
      <div class="rs-panel"><div class="rs-h2">職業レベル</div><div class="rs-jls">${jobs}</div><button class="rs-btn" data-go="jobs" data-p='{"back":"me"}'>転職</button></div>
      <div class="rs-panel rs-links"><button class="rs-btn" data-go="look">名前・見た目</button><button class="rs-btn" data-go="codex">図鑑（敵 ${cs.enemies.seen}/${cs.enemies.total}・装備 ${cs.items.got}/${cs.items.total}）</button><button class="rs-btn" data-go="ach">実績</button><button class="rs-btn" data-go="settings">設定（音・バックアップ）</button></div>`, { back: false });
  };
  AFTER.me = function () {};

  // ---------- 装備（上：大きな主人公・武器・変更前後。試着→「これを装備する」で保存） ----------
  const eqDiff = (a, b) => b === a ? '<i class="rs-same">±0</i>' : b > a ? `<i class="rs-up">+${b - a}</i>` : `<i class="rs-down">${b - a}</i>`;
  function eqRow(s, it) {
    const err = M.canEquip(s, it.id), on = UI.eq[UI.slot] === it.id, lv = M.enhLv(s, it.id), now = s.equip[UI.slot] === it.id;
    const label = now ? `<i class="rs-now2">${kr('装備')}中</i>` : on ? `<i class="rs-try">${kr('試着')}中</i>` : '';
    return `<button class="rs-item rs-eqitem${on ? ' on' : ''}${err ? ' ng' : ''}" data-eq="${it.id}" aria-pressed="${on}" ${err ? 'aria-disabled="true"' : ''}>${iconOf(it.id, 40)}<span class="rs-it-t"><b>${esc(it.name)}${lv ? ' +' + lv : ''}</b>${label}<small>${esc(statLine(it.id))}${err ? '　' + esc(err) : ''}</small></span></button>`;
  }
  const fitsJob = (job, it) => it.slot !== 'weapon' || it.cat === 'any' || D.JOBS[job].weapons.includes(it.cat);
  VIEWS.equip = function (p) {
    const s = save(), cur = M.statsWith(s, s.equip), tr = M.statsWith(s, UI.eq), changed = ['weapon', 'armor', 'acc'].some(k => (UI.eq[k] || null) !== (s.equip[k] || null));
    const slots = ['weapon', 'armor', 'acc'].map(sl => `<button class="rs-tab2${UI.slot === sl ? ' on' : ''}" data-slot="${sl}">${kr(M.SLOT_NAME[sl])}</button>`).join('');
    const owned = Object.keys(s.inv.items).map(i => D.ITEMS[i]).filter(i => i.slot === UI.slot).sort((a, b) => (b.rank - a.rank) || (a.rarity < b.rarity ? 1 : -1));
    const usable = owned.filter(i => !M.canEquip(s, i.id)), other = owned.filter(i => M.canEquip(s, i.id));
    const sel = UI.eq[UI.slot] ? D.ITEMS[UI.eq[UI.slot]] : null, selOwned = sel && s.inv.items[sel.id], selNow = sel && s.equip[UI.slot] === sel.id;
    const eff = sel ? M.effectText(sel.id) : '';
    const list = usable.map(it => eqRow(s, it)).join('') + (UI.slot !== 'weapon' ? `<button class="rs-item rs-eqitem${!UI.eq[UI.slot] ? ' on' : ''}" data-eq=""><span class="rs-it-t"><b>外す</b></span></button>` : '') || '<p class="rs-p">まだ持っていません。</p>';
    return frame(rb('{装備|そうび}'), `
      <div class="rs-panel rs-eqtop"><div class="rs-eqrow1"><div class="rs-stage rs-stage-eq">${heroCv('equip', { weaponId: UI.eq.weapon || null })}</div>
        <div class="rs-eqweapon">${sel ? `${iconOf(sel.id, 64)}<b>${esc(sel.name)}</b><small class="rs-effshort">${esc(M.effectShort(sel.id))}</small>${selNow ? `<i class="rs-now2">${kr('装備')}中</i>` : selOwned ? `<i class="rs-try">${kr('試着')}中</i>` : `<i class="rs-try">${kr('試着')}中（${kr('店')}で買える）</i>`}` : '<b>武器なし</b>'}</div></div>
        <table class="rs-cmp"><tr><th></th><th>${kr('現在')}</th><th>${kr('試着')}</th><th></th></tr>
          <tr><td>HP</td><td>${cur.maxHp}</td><td>${tr.maxHp}</td><td>${eqDiff(cur.maxHp, tr.maxHp)}</td></tr>
          <tr><td>${kr('攻撃')}</td><td>${cur.atk}</td><td>${tr.atk}</td><td>${eqDiff(cur.atk, tr.atk)}</td></tr>
          <tr><td>${kr('防御')}</td><td>${cur.def}</td><td>${tr.def}</td><td>${eqDiff(cur.def, tr.def)}</td></tr></table>
        ${sel ? `<details class="rs-det"><summary>${kr('効果')}を${kr('詳')}しく</summary><p class="rs-p">${esc(statLine(sel.id))}${sel.rank ? '　' + kr('種類') + '：' + esc(M.CAT_NAME[sel.cat] || '') + '　ランク' + D.RANK_NAME[sel.rank - 1] : ''}</p><p class="rs-p">${eff ? esc(eff) : 'とくべつな効果はありません。'}</p></details>` : ''}</div>
      <div class="rs-tabs2" role="tablist">${slots}</div>
      <div class="rs-list">${list}</div>
      ${other.length ? `<details class="rs-det rs-panel"><summary>${kr('別')}の${kr('職業')}用（${other.length}）</summary><div class="rs-list">${other.map(it => eqRow(s, it)).join('')}</div></details>` : ''}
      ${s.active ? `<div class="rs-note">${kr('冒険')}の${kr('途中')}は ${kr('装備')}を変えられません。</div>` : ''}
      <button class="rs-big" id="eqOk" ${changed && !s.active && (!sel || selOwned) ? '' : 'disabled'}>${rb('これを{装備|そうび}する')}</button>
      <div class="rs-row2"><button class="rs-btn" id="eqReset" ${changed ? '' : 'disabled'}>${rb('{取|と}り{消|け}し')}</button><button class="rs-btn" id="eqRec">おすすめ</button></div>
      <p class="rs-p c">${rb('「これを{装備|そうび}する」を{押|お}すまで、{保存|ほぞん}されません。')}</p>`, { back: true });
  };
  AFTER.equip = function () {
    const s = save();
    app().querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { UI.slot = b.dataset.slot; rerender(); });
    app().querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const id = b.dataset.eq; if (id && M.canEquip(s, id)) { UI.msg = M.canEquip(s, id); rerender(); UI.msg = ''; return; } UI.eq[UI.slot] = id || null; UI.msg = ''; rerender(); });
    doc.getElementById('eqRec').onclick = () => { UI.eq = M.recommendEquip(s); UI.msg = 'おすすめを試しています。決まったら「これを装備する」。'; rerender(); UI.msg = ''; };
    doc.getElementById('eqReset').onclick = () => { UI.eq = Object.assign({}, s.equip); UI.msg = ''; rerender(); };
    doc.getElementById('eqOk').onclick = () => { const r = M.setEquip(s, UI.eq); if (!r.ok) { UI.msg = r.err; rerender(); return; } commit(); UI.msg = UI.msg || '装備を変えました。'; UI.eq = Object.assign({}, s.equip); rerender(); };
  };

  // ---------- 店（買う・試着・売る。全商品にアイコン。いまの職業で使える武器を先に） ----------
  VIEWS.shop = function () {
    const s = save(), rank = C.maxRank(s), tabs = [['weapon', '武器'], ['armor', '防具'], ['acc', 'アクセ'], ['sell', '売る・返す']].map(([id, nm]) => `<button class="rs-tab2${UI.shopTab === id ? ' on' : ''}" data-st="${id}">${kr(nm)}</button>`).join('');
    let body;
    if (UI.shopTab === 'sell') {
      const own = Object.keys(s.inv.items).filter(i => i !== 'w_start').map(i => D.ITEMS[i]);
      body = own.length ? own.map(it => {
        const ref = M.canRefund(s, it.id), eqd = M.isEquipped(s, it.id), conf = UI.confirm === it.id;
        const act = eqd ? `<span class="rs-small">${kr('装備')}中</span>` : ref ? `<button class="rs-btn sm" data-refund="${it.id}">${conf ? '本当に返す' : `返す +${s.inv.fresh[it.id]}`}</button>` : `<button class="rs-btn sm" data-sell="${it.id}">${conf ? '本当に売る' : `売る +${M.sellPrice(it.id)}`}</button>`;
        return `<div class="rs-item rs-shopitem">${iconOf(it.id, 40)}<span class="rs-it-t"><b>${esc(it.name)}${M.enhLv(s, it.id) ? ' +' + M.enhLv(s, it.id) : ''}</b>${rankTag(it)}${rareTag(it)}<small>${esc(statLine(it.id))}${ref ? '　まだ使っていない：同じ値段で返せる' : '　店の値段の 25%で売れる'}</small>${act}</span></div>`;
      }).join('') : '<p class="rs-p">売れるものがありません。</p>';
    } else {
      let items = Object.values(D.ITEMS).filter(i => i.slot === UI.shopTab && i.rarity === 'normal' && i.rank && i.rank <= rank), hidden = 0;
      if (UI.shopTab === 'weapon') {   // いまの職業で使える武器を先に。別職用は「すべて」で見られる
        const fits = i => fitsJob(s.job, i);
        const f = items.filter(fits), o = items.filter(i => !fits(i));
        if (UI.shopAll) items = f.concat(o); else { items = f; hidden = o.length; }
      }
      const toggle = UI.shopTab === 'weapon' ? `<div class="rs-chips" role="group"><button class="rs-chip${!UI.shopAll ? ' on' : ''}" data-shopall="0" aria-pressed="${!UI.shopAll}">${kr('現在')}の${kr('職業')}で${kr('使')}える</button><button class="rs-chip${UI.shopAll ? ' on' : ''}" data-shopall="1" aria-pressed="${!!UI.shopAll}">${kr('全て')}</button></div>` : '';
      body = toggle + items.map(it => {
        const have = !!s.inv.items[it.id], can = C.canBuy(s, it.id), eff = M.effectShort(it.id), eqd = M.isEquipped(s, it.id), notFit = !fitsJob(s.job, it);
        return `<div class="rs-item rs-shopitem">${iconOf(it.id, 48)}<span class="rs-it-t"><b>${esc(it.name)}</b>${eqd ? `<i class="rs-now2">${kr('装備')}中</i>` : have ? '<i class="rs-have">持っている</i>' : ''}${rankTag(it)}<small>${esc(statLine(it.id))}${eff ? '　' + esc(eff) : ''}${notFit ? '　（' + kr('別') + 'の' + kr('職業') + '用）' : ''}</small>
          <span class="rs-shopbtns">${have ? '' : `<button class="rs-btn sm" data-buy="${it.id}" ${can ? 'disabled' : ''}>${it.price} コインで ${kr('購入')}</button>`}<button class="rs-btn sm" data-try="${it.id}">${kr('試着')}</button></span>${!have && can ? `<small class="rs-why">${esc(can)}</small>` : ''}</span></div>`;
      }).join('') + (hidden ? `<p class="rs-p">${kr('別')}の${kr('職業')}用の ${kr('武器')}が ${hidden}個あります（「${kr('全て')}」で ${kr('見')}られます）。</p>` : '') + `<p class="rs-p">${['ランクIIは砂海を突破すると売り出されます。', 'ランクIIIは第1章をクリアすると売り出されます。', 'ランクIVは逆さ遺跡を突破すると売り出されます。', 'ランクVは第2章をクリアすると売り出されます。', 'ランクVIは天測の塔を突破すると売り出されます。', ''][rank - 1]}</p>`;
    }
    return frame('装備屋', `<div class="rs-panel c">${coinHtml()}</div><div class="rs-tabs2">${tabs}</div><div class="rs-list">${body}</div>`);
  };
  AFTER.shop = function () {
    const s = save();
    app().querySelectorAll('[data-st]').forEach(b => b.onclick = () => { UI.shopTab = b.dataset.st; UI.confirm = null; rerender(); });
    app().querySelectorAll('[data-shopall]').forEach(b => b.onclick = () => { UI.shopAll = b.dataset.shopall === '1'; rerender(); });
    app().querySelectorAll('[data-try]').forEach(b => b.onclick = () => go('equip', { back: 'shop', tryItem: b.dataset.try }));
    app().querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const r = M.buyChecked(s, b.dataset.buy); UI.msg = r.ok ? `${D.ITEMS[b.dataset.buy].name} を買いました。` : r.err; if (r.ok) commit(); rerender(); });
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
      const st = statLine(it.id), after = i.after != null && lv < D.ENH_MAX ? `→ ${it.atk != null ? '攻撃' : '防御'} ${i.after}` : '';
      return `<div class="rs-item"><div><b>${esc(it.name)}${lv ? ' +' + lv : ''}</b>${rankTag(it)}${rareTag(it)}</div><small>${esc(st)} ${esc(after)}${it.slot === 'acc' ? '　（効果の量が +5%ずつ）' : ''}</small>
        ${lv >= D.ENH_MAX ? '<span class="rs-small">最大（+3）</span>' : `<small>費用 ${i.coin}コイン ＋ ${esc(C.oreName(it.rank))} ×${i.ore}（持ち ${i.have}）</small><button class="rs-btn sm" data-enh="${it.id}" ${i.err ? 'disabled' : ''}>+${lv + 1}に強化</button>${i.err ? `<small class="rs-why">${esc(i.err)}</small>` : ''}`}</div>`;
    }).join('') || '<p class="rs-p">鍛えられる装備がありません。</p>';
    const mats = Object.keys(s.inv.mats).filter(k => s.inv.mats[k] > 0).map(k => {
      let nm = k; if (k.startsWith('ore_')) nm = C.oreName(+k.slice(4)); else if (k.startsWith('bm_')) { const r = D.REGIONS.find(x => 'bm_' + x.id === k); nm = r ? r.mat : k; }
      return `<span class="rs-mat">${esc(nm)} ×${s.inv.mats[k]}</span>`;
    }).join('') || '<small>まだありません</small>';
    return frame('鍛冶屋', `<div class="rs-panel c">${coinHtml()}<p class="rs-p">強化は +3まで。必ず成功します。1回ごとに基準の性能が +5%。</p></div>
      <div class="rs-panel"><div class="rs-h2">素材</div><div class="rs-mats">${mats}</div><p class="rs-p">ボスの素材で作る固有装備は、まだ作れません。</p></div><div class="rs-list">${rows}</div>`);
  };
  AFTER.forge = function () {
    app().querySelectorAll('[data-enh]').forEach(b => b.onclick = () => { const r = M.enhance(save(), b.dataset.enh); UI.msg = r.ok ? `+${r.lv} になりました！` : r.err; if (r.ok) commit(); rerender(); });
  };

  // ---------- 転職（姿→特徴→条件✓→「この職業になる」を先に。技・強さは折りたたみ） ----------
  const JOB_BLURB = {
    warrior: '剣で正面から戦う', mage: '魔法で敵の弱点をつく', priest: '回復と守りで長く戦う', thief: 'すばやい連続攻撃で戦う',
    magicknight: '属性をまとった剣で戦う', paladin: '守りと回復をあやつる騎士', shadow: '影にまぎれて連続で攻める', sage: '魔法と回復をあやつる賢者',
    ninja: 'すばやい動きで敵をまどわす', ranger: '弓で遠くから狙う', skyknight: '翼で空をかける騎士', starseer: '星の力で未来を読む'
  };
  VIEWS.jobs = function () {
    const s = save(), tabs = ['base', 'adv', 'top'].map(t => `<button class="rs-tab2${UI.tier === t ? ' on' : ''}" data-tier="${t}">${rb(tierRb(t))}</button>`).join('');
    const cards = D.JOB_IDS.filter(j => D.JOBS[j].tier === UI.tier).map(j => {
      const lv = C.jobLevel(j, s.jobXp[j]).lv, e = C.canChangeJob(s, j), me = s.job === j, goal = s.goal && s.goal.job === j;
      return `<button class="rs-jobcard${me ? ' me' : ''}${e && !me ? ' lock' : ''}" data-go="jobdetail" data-p='${JSON.stringify({ job: j })}'>${heroCv('jobcard', { job: j })}<div><b>${jobRb(j)}</b><small>Lv${lv}${me ? '（' + kr('現在') + 'の' + kr('職業') + '）' : e ? '' : '（なれる）'}${goal ? '　★' + kr('目標') : ''}</small></div></button>`;
    }).join('');
    return frame(rb('{転職|てんしょく}'), `<div class="rs-tabs2" role="tablist">${tabs}</div><div class="rs-jobgrid">${cards}</div><p class="rs-p c">${rb('{転職|てんしょく}は{無料|むりょう}です。{職業|しょくぎょう}ごとのレベルはそのまま{残|のこ}ります。')}</p>`);
  };
  const tierRb = t => ({ base: '{基本職|きほんしょく}', adv: '{上級職|じょうきゅうしょく}', top: '{最上級職|さいじょうきゅうしょく}' })[t];
  AFTER.jobs = function () { app().querySelectorAll('[data-tier]').forEach(b => b.onclick = () => { UI.tier = b.dataset.tier; rerender(); }); };
  VIEWS.jobdetail = function (p) {
    const s = save(), j = p.job || s.job, jd = D.JOBS[j], jl = C.jobLevel(j, s.jobXp[j]), e = C.canChangeJob(s, j), me = s.job === j, goal = s.goal && s.goal.job === j;
    UI.params = p;
    const sk = D.SKILLS_OF[j].map(k => `<div class="rs-sk${k.lv > jl.lv ? ' lock' : ''}"><div><b>${skRb(k.id)}</b><i class="rs-cost">ゲージ${k.cost}</i><i class="rs-lv">Lv${k.lv}</i>${k.inh ? `<i class="rs-rare">${rb('{引|ひ}き{継|つ}げる{技|わざ}')}</i>` : ''}</div><small>${kr(skillBlurb(k))}　${esc(M.skillText(k, jl.lv))}</small></div>`).join('');
    const ps = (D.PASSIVES[j] || []).map(x => `<div class="rs-sk${x[0] > jl.lv ? ' lock' : ''}"><div><b>${esc(x[1])}</b><i class="rs-lv">Lv${x[0]}</i></div><small>${esc(x[2])}</small></div>`).join('');
    const prog = M.jobProgress(s, j);
    const reqs = jd.tier === 'adv' ? jd.req.map(r => { const lv = C.jobLevel(r, s.jobXp[r]).lv, ok = lv >= 10; return `<div class="rs-req${ok ? ' ok' : ''}"><span>${ok ? '✓' : '・'}</span>${jobRb(r)} Lv10　（${lv} / 10）</div>`; }).join('')
      : prog.map(r => `<div class="rs-req${r.done ? ' ok' : ''}"><span>${r.done ? '✓' : '・'}</span>${esc(r.text)}${r.pending ? '' : `　（${r.now}${r.unit || ''} / ${r.need}${r.unit || ''}）`}</div>`).join('');
    const cats = jd.weapons.map(c => M.CAT_NAME[c]).join('・');
    return frame(jobRb(j), `
      <div class="rs-panel rs-jobtop"><div class="rs-stage">${heroCv('job', { job: j })}</div>
        <div class="rs-jobname"><b>${jobRb(j)}</b><i class="rs-rank">${rb(tierRb(jd.tier))}</i>${me ? `<i class="rs-now2">${kr('現在')}</i>` : ''}</div>
        <p class="rs-blurb">${rb(JOB_BLURB[j] || '')}</p></div>
      ${reqs ? `<div class="rs-panel"><div class="rs-h2">${rb('{転職|てんしょく}{条件|じょうけん}')}</div>${reqs}</div>` : ''}
      <div class="rs-note" id="jobNote">${me ? kr('現在') + 'の' + kr('職業') + 'です。' : e ? esc(e) : 'この' + kr('職業') + 'になれます！'}</div>
      <button class="rs-big gold" id="jobDo" ${e || me ? 'disabled' : ''}>${rb('この{職業|しょくぎょう}になる')}</button>
      <div class="rs-row2"><button class="rs-btn" id="jobPlay">${rb('{動|うご}きを{見|み}る')}</button>${jd.tier !== 'base' ? `<button class="rs-btn" id="jobGoal">${goal ? rb('{目標|もくひょう}をやめる') : rb('{目標|もくひょう}にする')}</button>` : ''}</div>
      <details class="rs-det rs-panel"><summary>${rb('{覚|おぼ}える{技|わざ}')}</summary>${sk}</details>
      <details class="rs-det rs-panel"><summary>${rb('{詳|くわ}しい{強|つよ}さ')}</summary><p class="rs-p">${kr('使')}える${kr('武器')}：${esc(cats)}　Lv${jl.lv}${jl.capped ? '（上限）' : ''}</p>${bar(jl.into, jl.need)}${ps}</details>`);
  };
  AFTER.jobdetail = function (p) {
    const s = save(), j = p.job;
    const d = doc.getElementById('jobDo'); if (d) d.onclick = () => {
      const prev = s.job, first = !s.seen['job_' + j], r = M.changeJob(s, j); if (!r.ok) { UI.msg = r.err; rerender(); return; }
      s.seen['job_' + j] = 1; commit();
      const sw = r.swapped && r.swapped.to ? `${D.ITEMS[r.swapped.to].name} に武器を変えました（${D.JOBS[j].name}は ${r.swapped.from ? D.ITEMS[r.swapped.from].name : '今の武器'}を使えないため）。` : '';
      showJobFx(j, first, r.gifts, msg => { go('me'); UI.msg = msg; rerender(); }, prev, sw);
    };
    const g = doc.getElementById('jobGoal'); if (g) g.onclick = () => { M.setGoal(s, s.goal && s.goal.job === j ? null : j); commit(); rerender(); };
    const pl = doc.getElementById('jobPlay'); if (pl) pl.onclick = () => {   // 短い試演。セーブには触らない
      const cv = app().querySelector('canvas[data-hero]'), a = JSON.parse(cv.dataset.hero), seq = reduceMotion() ? [['attack', 0], ['idle', 900]] : [['ready', 0], ['attack', 350], ['attack', 700], ['idle', 1100]];
      pl.disabled = true; seq.forEach(([pose, t]) => setTimeout(() => { if (!cv.isConnected) return; cv.dataset.hero = JSON.stringify(Object.assign({}, a, { pose })); paintHero(cv); if (pose === 'idle') pl.disabled = false; }, t));
    };
  };
  // 転職の演出（初回のみ。旧姿→しるしの光→新しい姿。宝箱・NPCには何も当てない。とばせる。動きが苦手な設定では静止）
  function showJobFx(j, first, gifts, done, prev, extra) {
    const gift = gifts && gifts.length ? `<div class="rs-fx-gift">${gifts.map(g => esc(D.ITEMS[g].name)).join('、')} をもらった！</div>` : '', ex = extra ? `<div class="rs-fx-gift">${esc(extra)}</div>` : '';
    if (!first) return done(`${D.JOBS[j].name} になりました。${extra ? ' ' + extra : ''}`);
    const still = reduceMotion(), o = doc.createElement('div'); o.className = 'rs-fx' + (still ? ' still' : ''); o.setAttribute('role', 'dialog'); o.setAttribute('aria-label', '転職');
    o.innerHTML = `<div class="rs-fx-in"><div class="rs-fx-stage" id="fxStage">${heroCv('fx', { job: still ? j : (prev || j), pose: still ? 'win' : 'idle' })}<div class="rs-fx-glow"></div></div><div class="rs-fx-t" id="fxT">${still ? jobRb(j) + ' になった！' : jobRb(prev || j)}</div><div id="fxExtra"${still ? '' : ' hidden'}>${gift}${ex}</div><button class="rs-big" id="fxSkip">${still ? 'とじる' : 'とばす'}</button></div>`;
    doc.body.appendChild(o); paintHeroes(o);
    let closed = false; const close = () => { if (closed) return; closed = true; o.remove(); done(`${D.JOBS[j].name} になりました。${extra ? ' ' + extra : ''}`); };
    o.querySelector('#fxSkip').onclick = close;
    if (still) return;
    const cv = o.querySelector('canvas[data-hero]'), t = o.querySelector('#fxT'), a = JSON.parse(cv.dataset.hero), at = (ms, f) => setTimeout(() => { if (!closed && o.isConnected) f(); }, ms);
    at(700, () => { o.querySelector('#fxStage').classList.add('glow'); t.textContent = 'しるしが輝く…'; });
    at(1500, () => { cv.dataset.hero = JSON.stringify(heroOpts('fx', { job: j, pose: 'attack' })); paintHero(cv); t.innerHTML = jobRb(j) + ' になった！'; o.querySelector('#fxExtra').hidden = false; o.querySelector('#fxSkip').textContent = 'とじる'; });
    at(2100, () => { const b = heroOpts('fx', { job: j, pose: 'win' }); cv.dataset.hero = JSON.stringify(b); paintHero(cv); });
    at(4500, close);
  }

  // ---------- 技設定 ----------
  VIEWS.loadout = function () {
    const s = save(), jobs = C.jobLevels(s), job = s.job, lv = jobs[job], inhOn = M.advInherit(s);
    const own = D.SKILLS_OF[job].filter(k => k.lv <= lv), inh = inhOn ? B.inheritable(jobs).filter(id => D.SKILLS[id].job !== job).map(id => D.SKILLS[id]) : [];
    const sel = UI.sel, errs = B.validateLoadout(job, jobs, sel, inhOn);
    const chip = k => { const on = sel.includes(k.id); return `<button class="rs-sk btn${on ? ' on' : ''}" data-sk="${k.id}" aria-pressed="${on}"><div><b>${esc(k.name)}</b><i class="rs-cost">ゲージ${k.cost}</i>${k.job !== job ? `<i class="rs-rare">${esc(D.JOBS[k.job].name)}の技</i>` : ''}</div><small>${esc(M.skillText(k, k.job === job ? lv : 1))}</small></button>`; };
    return frame('技・作戦', `
      <div class="rs-panel"><div class="rs-h2">${esc(D.JOBS[job].name)}の技（3つまで）</div><p class="rs-p">選んだ技は、答えにあわせて自動で使われます。冒険をはじめると、途中では変えられません。</p><div class="rs-list">${own.map(chip).join('')}</div></div>
      <div class="rs-panel"><div class="rs-h2">他の職業の技（1つだけ）</div>${inhOn ? (inh.length ? `<div class="rs-list">${inh.map(chip).join('')}</div>` : '<p class="rs-p">継承できる技がまだありません。</p>') : '<p class="rs-p">基本職のどれかが Lv5になると使えます。</p>'}</div>
      <div class="rs-panel"><div class="rs-h2">作戦</div><div class="rs-list">${TACTICS.map(([id, nm, ds]) => `<button class="rs-sk btn${UI.tactic === id ? ' on' : ''}" data-tac="${id}" aria-pressed="${UI.tactic === id}"><div><b>${nm}</b></div><small>${esc(ds)}</small></button>`).join('')}</div></div>
      ${errs.length ? `<div class="rs-note">${esc(errs[0])}</div>` : ''}${s.active ? '<div class="rs-note">冒険の途中は変えられません。</div>' : ''}
      <div class="rs-row2"><button class="rs-btn" id="lkRec">おすすめにする</button></div>
      <button class="rs-big" id="lkOk" ${errs.length || s.active ? 'disabled' : ''}>これで決定</button>`);
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
    doc.getElementById('lkOk').onclick = () => { const r = M.setLoadout(s, UI.sel, UI.tactic); UI.msg = r.ok ? '決定しました。次の冒険から使われます。' : r.err; if (r.ok) commit(); rerender(); };
  };

  // ---------- 外見 ----------
  const lookPrev = () => ({ skin: M.SKIN[UI.look.skin], hair: M.HAIR_COLOR[UI.look.hairColor], face: UI.look.face, hairStyle: UI.look.hair });
  const lookCostume = () => (UI.look.outfit === 'master' && M.masterOwned(save(), save().job) ? 'master' : null);
  VIEWS.look = function () {
    const L = UI.look, s = save(), sw = (key, arr) => arr.map((c, i) => `<button class="rs-sw${L[key] === i ? ' on' : ''}" style="background:${c}" data-lk="${key}" data-v="${i}" aria-label="${i + 1}ばん" aria-pressed="${L[key] === i}"></button>`).join('');
    const num = (key, n) => Array.from({ length: n }, (_, i) => `<button class="rs-chip${L[key] === i ? ' on' : ''}" data-lk="${key}" data-v="${i}" aria-pressed="${L[key] === i}">${i + 1}</button>`).join('');
    const mo = M.masterOwned(s, s.job), outfits = `<button class="rs-chip${!L.outfit || L.outfit !== 'master' ? ' on' : ''}" data-outfit="" aria-pressed="${L.outfit !== 'master'}">${kr('通常')}</button><button class="rs-chip${L.outfit === 'master' && mo ? ' on' : ''}" data-outfit="master" aria-pressed="${L.outfit === 'master' && mo}" ${mo ? '' : 'aria-disabled="true" disabled'}>マスター${kr('衣装')}</button>`;
    return frame(rb('{名前|なまえ}・{見|み}た{目|め}'), `
      <div class="rs-panel c"><div class="rs-stage">${heroCv('look', { look: lookPrev(), costume: lookCostume() })}</div></div>
      <div class="rs-panel"><label class="rs-h2" for="rsName">${rb('{名前|なまえ}（8{文字|もじ}まで）')}</label><input id="rsName" class="rs-input" maxlength="8" value="${esc(UI.name)}" autocomplete="off" placeholder="冒険者"><p class="rs-p">${rb('{名前|なまえ}はこの{端末|たんまつ}の{中|なか}だけに{残|のこ}ります。')}</p></div>
      <div class="rs-panel"><div class="rs-h2">${kr('顔')}</div><div class="rs-chips">${num('face', M.FACE_N)}</div><div class="rs-h2">${kr('髪型')}</div><div class="rs-chips">${num('hair', M.HAIR_N)}</div>
        <div class="rs-h2">${kr('肌')}の${kr('色')}</div><div class="rs-chips">${sw('skin', M.SKIN)}</div><div class="rs-h2">${kr('髪')}の${kr('色')}</div><div class="rs-chips">${sw('hairColor', M.HAIR_COLOR)}</div>
        <div class="rs-h2">${kr('衣装')}</div><div class="rs-chips">${outfits}</div>${mo ? '' : `<p class="rs-p">マスター${kr('衣装')}は、${jobRb(s.job)}を Lv30にすると ${kr('解放')}されます。</p>`}
        <p class="rs-p" id="lookNote">${rb('{見|み}た{目|め}を{変|か}えても、{強|つよ}さや{覚|おぼ}えた{技|わざ}は{変|か}わりません。')}</p></div>
      <button class="rs-big" id="lookOk">${rb('{決定|けってい}')}</button>`);
  };
  AFTER.look = function () {
    const nm = doc.getElementById('rsName'); nm.oninput = () => { UI.name = nm.value; };
    app().querySelectorAll('[data-lk]').forEach(b => b.onclick = () => { UI.look[b.dataset.lk] = +b.dataset.v; rerender(); });
    app().querySelectorAll('[data-outfit]').forEach(b => b.onclick = () => { if (b.disabled) return; UI.look.outfit = b.dataset.outfit || null; rerender(); });
    doc.getElementById('lookOk').onclick = () => { const r = M.setLook(save(), UI.name, UI.look); UI.msg = r.ok ? '決定しました。' : r.err; if (r.ok) commit(); rerender(); };
  };

  // ---------- 図鑑 ----------
  VIEWS.codex = function () {
    const s = save(), cs = M.codexSummary(s), tabs = [['enemy', `敵 ${cs.enemies.seen}/${cs.enemies.total}`], ['item', `装備 ${cs.items.got}/${cs.items.total}`]].map(([id, nm]) => `<button class="rs-tab2${UI.codexTab === id ? ' on' : ''}" data-ct="${id}">${nm}</button>`).join('');
    let body = '';
    const seenOf = id => { const c = s.codex.enemies[id]; return !!(c && c.seen); };
    const varLine = id => { const v = M.variantIdsOf(id); return v.length ? `<small>強化版 ${v.filter(seenOf).length}/${v.length}</small>` : ''; };   // 強化版は基本種の中で数える
    const cell = (e, boss, wk) => { const c = s.codex.enemies[e.id], seen = !!(c && c.seen); return `<div class="rs-cell${seen ? '' : ' un'}">${seen ? `<canvas data-en="${e.id}" data-boss="${boss ? 1 : 0}" aria-hidden="true"></canvas>` : '<div class="rs-q">？</div>'}<b>${seen ? esc(e.name) : '？？？'}</b><small>${seen ? `倒した ${c.kills}回${wk && e.weak ? '　弱点：' + esc(D.EL_NAME[e.weak]) : ''}` : 'まだ出会っていない'}</small>${varLine(e.id)}</div>`; };
    if (UI.codexTab === 'enemy') {
      body = `<p class="rs-p">基本の敵を数えます。強化版は、元の敵の「強化版」の欄にまとめています（例：強化版 1/2）。</p>` + D.REGIONS.map(r => `<div class="rs-h2">${esc(r.name)}</div><div class="rs-cgrid">${r.enemies.concat([r.boss]).map(e => cell(e, e === r.boss, true)).join('')}</div>`).join('');
      const regIds = D.REGIONS.map(r => r.id), ex = {}; Object.values(D.ENEMIES).forEach(e => { if (!regIds.includes(e.region) && !e.variantOf) (ex[e.region] = ex[e.region] || []).push(e); });
      body += Object.keys(ex).map(bg => `<div class="rs-h2">${esc(W.BG_NAMES[bg] || bg)}（クリア後など）</div><div class="rs-cgrid">${ex[bg].map(e => cell(e, e.boss, false)).join('')}</div>`).join('');
    } else {
      const ids = M.codexItemIds();
      body = '<p class="rs-p">集められる装備を数えます（はじまりの武器と、再鍛造でランクだけが変わる固有装備は、数えません）。</p>' + ['weapon', 'armor', 'acc'].map(sl => { const list = ids.filter(i => D.ITEMS[i].slot === sl); return `<div class="rs-h2">${M.SLOT_NAME[sl]}　${list.filter(i => M.codexHas(s, i)).length}/${list.length}</div><div class="rs-list">${list.map(id => { const i = D.ITEMS[id], got = M.codexHas(s, i.id); const eff = got ? M.effectShort(i.id) : ''; return `<div class="rs-item rs-eqitem${got ? '' : ' ng'}" data-item="${i.id}">${got ? iconOf(i.id, 40) : ''}<span class="rs-it-t"><b>${got ? esc(i.name) : '？？？'}</b>${got ? rankTag(i) + rareTag(i) : ''}${got ? `<small>${esc(statLine(i.id))}${eff ? '　' + esc(eff) : ''}</small>` : `<small>${i.rank ? 'ランク' + D.RANK_NAME[i.rank - 1] : ''}</small>`}</span></div>`; }).join('')}</div>`; }).join('');
    }
    return frame('図鑑', `<div class="rs-tabs2">${tabs}</div>${body}`);
  };
  AFTER.codex = function () {
    app().querySelectorAll('[data-ct]').forEach(b => b.onclick = () => { UI.codexTab = b.dataset.ct; rerender(); });
  };

  // ---------- 実績 ----------
  VIEWS.ach = function () {
    const list = M.achievements(save()), n = list.filter(a => a.done).length;
    return frame('実績', `<div class="rs-panel c"><b>${n} / ${list.length}</b> 達成<p class="rs-p">実績に報酬はありません。あそびの記録です。</p></div><div class="rs-list">${list.map(a => `<div class="rs-item${a.done ? ' on' : ''}"><div><b>${a.done ? '✓ ' : ''}${esc(a.name)}</b></div><small>${esc(a.desc)}</small>${a.done ? '' : bar(a.now, a.need) + `<small>${a.now} / ${a.need}</small>`}</div>`).join('')}</div>`);
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
    const nk = p.who && NPC_WHO[p.who], nim = nk && (/[！？]/.test(p.text) && imgOf('npc_' + nk + '_alt') || imgOf('npc_' + nk));
    return frame('お話', `<div class="rs-panel rs-story">${nim ? `<img class="rs-npc story" alt="" src="${nim.src}">` : ''}<div class="rs-story-who">${p.who ? esc(p.who) : '　'}</div><p class="rs-story-text">${esc(p.text)}</p><div class="rs-story-n">${S.i + 1} / ${S.pages.length}</div></div>
      <div class="rs-row2"><button class="rs-btn" id="stSkip">とばす</button><button class="rs-big" id="stNext">${last ? 'おわり' : '次へ'}</button></div>`);
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
      if (st0 + nn <= st) b.push(`<button class="rs-chip" data-sg="${st0 + nn}">ボスの前</button>`);
      grp.push(`<div class="rs-h2">${esc(r.name)}</div><div class="rs-chips">${b.join('')}</div>`);
    });
    const qs = W.QUEST_ORDER.filter(id => W.QUESTS[id].kind !== 'rematch' && ((s.quests[id] || {}).step > 0 || (s.quests[id] || {}).cleared)).map(id => `<button class="rs-chip" data-sq="${id}">${esc(W.QUESTS[id].name)}</button>`).join('');
    return frame('お話を読み返す', `<div class="rs-panel">${grp.join('') || '<p class="rs-p">まだありません。</p>'}${qs ? `<div class="rs-h2">クリア後の冒険</div><div class="rs-chips">${qs}</div>` : ''}</div>`);
  };
  AFTER.storylist = function () {
    app().querySelectorAll('[data-sg]').forEach(b => b.onclick = () => startStory(D.ROUTE[+b.dataset.sg], 'storylist'));
    app().querySelectorAll('[data-sq]').forEach(b => b.onclick = () => startStory(W.QUESTS[b.dataset.sq].segs[0], 'storylist'));
  };

  // ---------- ぼうけんの えらびかた（ほんぺん・さいせん・しれん・秘境・孤島） ----------
  const mapBtn = id => `<button class="rs-btn rs-mini" data-go="regionmap" data-p='{"id":"${id}"}' aria-label="${esc(W.QUESTS[id].name)}の地図を開く">地図をみる</button>`;
  function questPanel(s) {
    const L = M.questList(s), by = k => L.filter(q => q.kind === k);
    const btn = q => {
      const st = q.locked && !q.cleared ? q.locked : q.cleared ? 'クリア済み' : q.kind === 'rematch' ? `やった回数 ${q.count}` : q.step > 0 ? `${q.step} / ${q.total}（続き）` : `全部で ${q.total}区間`;
      const nm = q.kind === 'rematch' ? q.boss ? '' : '' : '';
      return `<button class="rs-qbtn${q.current ? ' on' : ''}${q.locked ? ' lock' : ''}" data-q="${q.id}" ${q.locked ? 'aria-disabled="true"' : ''} aria-pressed="${q.current}"><b>${q.current ? '✓ ' : ''}${esc(q.kind === 'rematch' ? q.name : q.name)}</b><small>${esc(st)}</small></button>${nm}`;
    };
    const re = by('rematch').filter(q => !q.locked);
    const mainDone = M.mainCleared(s);
    return `<div class="rs-panel"><div class="rs-h2">他の冒険</div>
      <button class="rs-qbtn${!s.progress.quest ? ' on' : ''}" data-q="" aria-pressed="${!s.progress.quest}"><b>${!s.progress.quest ? '✓ ' : ''}本編</b><small>${mainDone ? '全部クリア（最後のボスと再戦）' : '18の地域を進む'}</small></button>
      <details class="rs-det"><summary>再戦（倒したボスともう一度）${re.length ? ' ' + re.length : ''}</summary><p class="rs-p">ボスの素材が増えます。素材3個で固有装備が作れます（鍛冶屋）。</p>${re.map(btn).join('') || '<small>まだありません。ボスを倒すと開きます。</small>'}</details>
      <div class="rs-h3">試練（最上級職への転職）</div>${by('trial').map(btn).join('')}
      <div class="rs-h3">6つの秘境（本編クリア後）</div>${by('secret').map(q => btn(q) + mapBtn(q.id)).join('')}
      <div class="rs-h3">夜明けの孤島</div>${by('island').map(q => btn(q) + mapBtn(q.id)).join('')}
      ${s.active ? '<div class="rs-note">冒険の途中は選び直せません。</div>' : ''}</div>`;
  }

  // ---------- エンディング・記念 ----------
  VIEWS.ending = function () {
    const s = save(), i = UI.endI || 0, E = ST.ENDING, N = 4;
    const regs = D.REGIONS.filter(r => r.ch === 3).concat(D.REGIONS.filter(r => r.ch === 2)).slice(0, 12).map(r => esc(r.name)).join('・');
    const jl = C.jobLevels(s), jobs = D.JOB_IDS.filter(j => jl[j] > 1).map(j => `${esc(D.JOBS[j].name)} Lv${jl[j]}`).join('／') || '（これから）';
    const memos = D.REGIONS.filter(r => (s.inv.mats['bm_' + r.id] || 0) > 0 || s.progress.bossKills[r.boss.id]).map(r => esc(r.mat)).join('、') || '（ボスの素材）';
    const p = [
      `<div class="rs-stage">${heroCv('ending')}</div><div class="rs-hc-name">${esc(s.name || '冒険者')}</div><div class="rs-hc-sub">${esc(D.JOBS[s.job].name)} Lv${jl[s.job]}</div><p class="rs-story-text">${esc(E[0][1])}</p>`,
      `<p class="rs-story-text">${esc(E[1][1])}</p><div class="rs-h2">助けた地域</div><p class="rs-p">${regs}</p>`,
      `<div class="rs-h2">育てたしるし</div><p class="rs-p">${jobs}</p><div class="rs-h2">記念品</div><p class="rs-p">${memos}</p>`,
      `<p class="rs-story-text">${esc(E[2][1])}</p><p class="rs-story-text">${esc(E[3][1])}</p><p class="rs-p">本編はクリア！冒険の地図から「6つの秘境」に挑戦できます。</p>`
    ];
    const last = i >= N - 1;
    return frame('エンディング', `<div class="rs-panel rs-story c">${p[i]}<div class="rs-story-n">${i + 1} / ${N}</div></div><div class="rs-row2"><button class="rs-btn" id="enSkip">とばす</button><button class="rs-big" id="enNext">${last ? 'おわり' : '次へ'}</button></div>`);
  };
  AFTER.ending = function () {
    const done = () => { const s = save(); s.ending.seen = true; commit(); UI.endI = 0; if (UI.params && UI.params.from === 'result') root.home(); else go('adv'); };
    doc.getElementById('enNext').onclick = () => { if ((UI.endI || 0) >= 3) done(); else { UI.endI = (UI.endI || 0) + 1; rerender(); } };
    doc.getElementById('enSkip').onclick = done;
  };
  const MEMOS = [['ch1', '第1章', s => chCleared(s, 1)], ['ch2', '第2章', s => chCleared(s, 2)], ['main', '本編', s => mainCleared(s)], ['dawnisle', '夜明けの孤島', () => true]];
  const memoImg = id => imgOf('bg_memorial_' + id);
  VIEWS.memorial = function () {
    const s = save(), title = (s.rewards.titles.includes('空の果てを見た者')) ? '空の果てを見た者' : 'まだありません';
    if (!memoImg('dawnisle')) return frame('記念絵', `<div class="rs-panel c"><canvas id="rsMemo" class="rs-memo" aria-label="夜明けの記念絵"></canvas><p class="rs-p">「${esc(title)}」　${s.rewards.lamp ? '夜明けの灯をともした。' : ''}</p></div>`);
    const list = MEMOS.filter(m => memoImg(m[0]) && m[2](s));
    return frame('記念絵', list.map(m => `<div class="rs-panel c"><div class="rs-h3">${esc(m[1])}の記念絵</div><canvas ${m[0] === 'dawnisle' ? 'id="rsMemo" ' : ''}class="rs-memo" data-m="${m[0]}" aria-label="${esc(m[1])}の記念絵"></canvas></div>`).join('') + `<div class="rs-panel c"><p class="rs-p">「${esc(title)}」　${s.rewards.lamp ? '夜明けの灯をともした。' : ''}</p></div>`);
  };
  AFTER.memorial = function () {
    const s = save();
    if (memoImg('dawnisle')) {
      app().querySelectorAll('canvas[data-m]').forEach(c => {
        const im = memoImg(c.dataset.m), w = im.width, h = im.height; c.width = w; c.height = h; c.style.width = '100%'; c.style.maxWidth = (w * 1.2) + 'px'; c.style.height = 'auto';
        const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 0, 0);
        SP.drawHeroLayered(g, { job: s.job, costume: M.costumeOf(s), weaponId: M.artWeapon(s.job, s.equip.weapon), look: look(), pose: 'win', use: 'reward', x: Math.round(w * 0.34), groundY: h - 14, scale: 1 });
      });
      return;
    }
    const c = doc.getElementById('rsMemo'), w = 100, h = 66, k = Math.max(2, Math.floor(Math.min(360, c.parentNode.clientWidth - 24) / w));
    c.width = w; c.height = h; c.style.width = (w * k) + 'px'; c.style.height = (h * k) + 'px'; const g = c.getContext('2d');
    SP.drawBackground(g, w, h, 'dawnisle'); g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(70, 24, 9, 0, 7); g.fill();
    SP.drawHeroLayered(g, { job: s.job, costume: M.costumeOf(s), weaponId: M.artWeapon(s.job, s.equip.weapon), look: look(), pose: 'win', use: 'reward', x: 36, groundY: 62, scale: 1 }); g.save(); g.scale(2, 2); SP.drawEnemy(g, 'xb_dawndragon', true, 28, 30, { lift: 2, img: 'full' }); g.restore();
  };

  // ---------- せってい（音・振動。どちらも初期オフ） ----------
  VIEWS.settings = function () {
    const st = save().settings, rbOn = RuRb.isOn();
    return frame('設定', `<div class="rs-panel"><div class="rs-h2">ふりがな</div><p class="rs-p">漢字の上に読みがなを出します。はじめはオンです。</p>
      <div class="rs-chips"><button class="rs-chip${rbOn ? ' on' : ''}" id="rbOn" aria-pressed="${rbOn}">オン</button><button class="rs-chip${!rbOn ? ' on' : ''}" id="rbOff" aria-pressed="${!rbOn}">オフ</button></div></div>
      <div class="rs-panel"><div class="rs-h2">音</div><p class="rs-p">冒険中の小さな音（正解・攻撃・報酬など）。BGMはありません。はじめはオフです。</p>
      <div class="rs-chips"><button class="rs-chip${st.sound ? ' on' : ''}" id="snOn" aria-pressed="${!!st.sound}">オン</button><button class="rs-chip${!st.sound ? ' on' : ''}" id="snOff" aria-pressed="${!st.sound}">オフ</button><button class="rs-chip" id="snTest">音を鳴らす</button></div>
      <div class="rs-h2">振動</div><p class="rs-p">報酬のときに震えます（端末が対応しているときだけ）。はじめはオフです。</p>
      <div class="rs-chips"><button class="rs-chip${st.vibrate ? ' on' : ''}" id="vbOn" aria-pressed="${!!st.vibrate}">オン</button><button class="rs-chip${!st.vibrate ? ' on' : ''}" id="vbOff" aria-pressed="${!st.vibrate}">オフ</button></div></div><div class="rs-panel rs-data">${RPG.homeHtml()}</div>`);
  };
  AFTER.settings = function () {
    const st = save().settings, set = (k, v) => { st[k] = v; commit(); if (k === 'sound' && v && RPG.sound) RPG.sound.unlock(); rerender(); };
    doc.getElementById('rbOn').onclick = () => { RuRb.setOn(true); rerender(); }; doc.getElementById('rbOff').onclick = () => { RuRb.setOn(false); rerender(); };
    doc.getElementById('snOn').onclick = () => set('sound', true); doc.getElementById('snOff').onclick = () => set('sound', false);
    doc.getElementById('vbOn').onclick = () => set('vibrate', true); doc.getElementById('vbOff').onclick = () => set('vibrate', false);
    doc.getElementById('snTest').onclick = () => { if (RPG.sound) { RPG.sound.unlock(); RPG.sound.play('reward'); } };
    const bk = app().querySelector('.rpg-bk'); if (bk) bk.open = true; RPG.bindHome();
  };

  // しょうごう・いしょう（クリア後の ごほうび）
  function rewardsPanel(s) {
    const R = s.rewards, cs = M.allCostumes().filter(c => R.costumes.includes(c.id));
    if (!R.titles.length && !R.lamp) return '';
    const t = R.titles.map(x => `<button class="rs-chip${s.title === x ? ' on' : ''}" data-title="${esc(x)}" aria-pressed="${s.title === x}">${esc(x)}</button>`).join('');
    const o = '';   // 色だけの衣装は選べない（専用の絵ができるまで。IMPLEMENTATION_STATUS 参照）
    return `<div class="rs-panel"><div class="rs-h2">称号・衣装</div>${t ? `<div class="rs-chips">${t}</div>` : ''}${o ? `<div class="rs-h3">衣装</div><div class="rs-chips"><button class="rs-chip${!s.look.outfit ? ' on' : ''}" data-outfit="">職業の色</button>${o}</div>` : ''}${R.lamp ? '<button class="rs-btn" data-go="memorial">記念絵を見る</button>' : ''}</div>`;
  }

  // ---------- 鍛冶屋：固有装備 ----------
  function uniquePanel(s) {
    const rows = W.UNIQ.map(u => {
      const i = M.uniqueInfo(s, u.key), reg = u.region.name;
      const act = i.owned
        ? (i.reErr ? `<small class="rs-why">${esc(i.reErr)}</small>` : `<small>再鍛造：ランク${D.RANK_NAME[i.rank - 1]} → ${D.RANK_NAME[i.target - 1]}（${i.reCoin}コイン ＋ ${esc(C.oreName(i.target))} ×${i.reOre}）</small>`) + `<button class="rs-btn sm" data-reforge="${u.key}" ${i.reErr ? 'disabled' : ''}>再鍛造する</button>`
        : `<small>${esc(u.matName)} ${i.have} / ${i.need}（${esc(reg)}のボス）</small><button class="rs-btn sm" data-craft="${u.key}" ${i.err ? 'disabled' : ''}>作る</button>${i.err ? `<small class="rs-why">${esc(i.err)}</small>` : ''}`;
      return `<div class="rs-item"><div><b>${esc(u.name)}</b><i class="rs-rare">固有</i>${i.owned ? rankTag(D.ITEMS[i.owned]) : ''}<i class="rs-prov">第${u.ch}章</i></div><small>${esc(i.text)}</small>${act}</div>`;
    }).join('');
    const n = W.UNIQ.filter(u => M.ownedUnique(s, u.key)).length;
    return `<details class="rs-det rs-panel"><summary>固有装備（${n} / ${W.UNIQ.length}）</summary><p class="rs-p">ボスの素材3個で作れます。素材は冒険の地図の「再戦」で集まります。再鍛造でランクがあがっても、効果・強化はそのままです。</p><div class="rs-list">${rows}</div></details>`;
  }
  const oldForge = VIEWS.forge, oldForgeAfter = AFTER.forge;
  VIEWS.forge = function () {
    let h = oldForge.apply(this, arguments);
    h = h.replace('<p class="rs-p">ボスの素材で作る固有装備は、まだ作れません。</p>', '').replace('<div class="rs-list">', uniquePanel(save()) + '<div class="rs-list">');
    return h;
  };
  AFTER.forge = function () {
    oldForgeAfter.apply(this, arguments);
    app().querySelectorAll('[data-craft]').forEach(b => b.onclick = () => { const r = M.craftUnique(save(), b.dataset.craft); UI.msg = r.ok ? `${D.ITEMS[r.id].name} を作りました！` : r.err; if (r.ok) { commit(); RPG.sound && RPG.sound.play('chest'); } rerender(); });
    app().querySelectorAll('[data-reforge]').forEach(b => b.onclick = () => { const r = M.reforgeUnique(save(), b.dataset.reforge); UI.msg = r.ok ? `ランク${D.RANK_NAME[r.to - 1]} に再鍛造しました！` : r.err; if (r.ok) commit(); rerender(); });
  };

  // ---------- 追加の導線（ぼうけん・じぶん・ずかん） ----------
  const oldAdv = VIEWS.adv, oldAdvAfter = AFTER.adv;
  VIEWS.adv = function () {
    const s = save(), r = A.currentRoute(s), q = r.quest ? W.QUESTS[r.quest] : null;
    let h = oldAdv.apply(this, arguments);
    const ev = ST.hasEvent(r), seen = !!s.seen[storyKey(r)], ending = M.mainCleared(s);   // 会話があるのは出来事のある区間だけ
    const st = `<div class="rs-panel"><div class="rs-h2">お話</div>${ev ? `<p class="rs-p">${seen ? 'この区間のお話は読みました。' : '<b class="rs-new">新しいお話があります。</b>'}</p>` : '<p class="rs-p">この区間に新しいお話はありません。</p>'}<div class="rs-row2">${ev ? `<button class="rs-btn" id="rsStory">${seen ? 'もう一度読む' : 'お話を読む'}</button>` : ''}<button class="rs-btn" data-go="storylist">読み返す</button></div>${ending ? '<button class="rs-btn" data-go="ending">エンディングを見る</button>' : ''}</div>`;
    h = h.replace('<div class="rs-panel"><div class="rs-h2">技と作戦</div>', st + questPanel(s) + '<div class="rs-panel"><div class="rs-h2">技と作戦</div>');
    return h;
  };
  AFTER.adv = function () {
    oldAdvAfter.apply(this, arguments);
    const s = save(), r = A.currentRoute(s), sb = doc.getElementById('rsStory'); if (sb) sb.onclick = () => startStory(r, 'adv');
    app().querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
      const id = b.dataset.q || null, e = M.selectQuest(s, id);
      if (!e.ok) { UI.msg = e.err; rerender(); return; }
      commit(); UI.msg = id ? `「${W.QUESTS[id].name}」を選びました。` : '本編にもどしました。'; rerender();
    });
  };
  const oldMe = VIEWS.me, oldMeAfter = AFTER.me;
  VIEWS.me = function () {
    const s = save(); let h = oldMe.apply(this, arguments);
    h = h.replace('<div class="rs-hc-job">', (s.title ? `<div class="rs-hc-sub">「${esc(s.title)}」</div>` : '') + '<div class="rs-hc-job">');
    h = h.replace('<div class="rs-panel rs-links">', rewardsPanel(s) + '<div class="rs-panel rs-links">');
    return h;
  };
  AFTER.me = function () {
    oldMeAfter.apply(this, arguments); const s = save();
    app().querySelectorAll('[data-title]').forEach(b => b.onclick = () => { M.setTitle(s, s.title === b.dataset.title ? null : b.dataset.title); commit(); rerender(); });
    app().querySelectorAll('[data-outfit]').forEach(b => b.onclick = () => { M.setOutfit(s, b.dataset.outfit || null); commit(); rerender(); });
  };
  PARENT.story = 'adv'; PARENT.storylist = 'adv'; PARENT.ending = 'adv'; PARENT.memorial = 'me'; PARENT.settings = 'me';
  ROOT_OF.story = 'adv'; ROOT_OF.storylist = 'adv'; ROOT_OF.ending = 'adv'; ROOT_OF.memorial = 'me'; ROOT_OF.settings = 'me';


  // ---------- 探索地図（絵の上に 地点・道・今いる場所・宝箱を重ねる。D-40） ----------
  // 絵は bg_map_<id>（240x240、道は入口(下)から奥(上)）。座標は rpg-mapdata.js（地域ごと）。進み具合は保存データから毎回計算する。
  const MAPD = (root.RPGMapData && root.RPGMapData.MAPS) || {};
  // key＝本編の地域id、または冒険の道id（secret_*／island）。試練は地図が無い（再戦は元の地域のキーで開く）
  function mapDesc(s, key) {
    const q = W.QUESTS[key];
    let o;
    if (!q) {
      const ri = D.REGIONS.findIndex(r => r.id === key); if (ri < 0) return null;
      const r = D.REGIONS[ri], inf = M.mapInfo(s)[ri], rem = s.progress.quest === 'rematch_' + key;
      o = { key, mapId: key, name: r.name, sub: `第${r.ch}章`, pts: r.points.map(n => ({ name: n, n: 3 })), boss: { name: r.boss.name, n: inf.total - inf.nNormal }, done: inf.cleared ? inf.total : inf.inRegion, cleared: inf.cleared, lock: inf.locked ? 'まだここまで来ていない' : null, story: r.story || '', here: rem || (!s.progress.quest && inf.current), atBoss: rem, rematch: rem };
    } else if (q.kind === 'secret' || q.kind === 'island') {
      const segs = q.segs.filter(g => !g.boss), pts = [];
      segs.forEach(g => { const l = pts[pts.length - 1]; if (l && l.name === g.point) l.n++; else pts.push({ name: g.point, n: 1 }); });
      const qs = M.questState(s, key), lk = M.questLocked(s, key), cleared = !!qs.cleared;
      o = { key, mapId: q.bg, name: q.name, sub: q.kind === 'island' ? 'クリア後の冒険' : '秘境', pts, boss: { name: q.boss, n: q.segs.length - segs.length }, done: cleared ? q.segs.length : (qs.step || 0), cleared, lock: lk && !cleared ? lk : null, story: '', here: s.progress.quest === key && !cleared };
    } else return null;
    // 各地点（最後はボス）の済んだ区間数と状態
    o.nodes = o.pts.map(p => Object.assign({}, p)).concat([Object.assign({ boss: true }, o.boss)]);
    let cum = 0, cur = -1;
    o.nodes.forEach((n, i) => { n.done = Math.max(0, Math.min(n.n, o.done - cum)); cum += n.n; n.state = o.lock ? 'lock' : n.done >= n.n ? 'done' : (cur < 0 ? (cur = i, 'cur') : 'lock'); });
    o.cur = o.atBoss ? o.nodes.length - 1 : cur;
    if (o.atBoss) o.nodes[o.cur].state = 'cur';
    o.total = o.nodes.reduce((a, n) => a + n.n, 0);
    o.chestOpen = o.cleared;
    return o;
  }
  // 道の折れ線上の位置。地点は最も近い道の点に投影して並びを取る
  function pathArc(path) { const d = [0]; for (let i = 1; i < path.length; i++) d.push(d[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])); return d; }
  function arcOf(path, d, p) {
    let best = 1e9, at = 0;
    for (let i = 1; i < path.length; i++) {
      const ax = path[i - 1][0], ay = path[i - 1][1], vx = path[i][0] - ax, vy = path[i][1] - ay, L = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((p[0] - ax) * vx + (p[1] - ay) * vy) / L)), dx = ax + vx * t - p[0], dy = ay + vy * t - p[1], e = dx * dx + dy * dy;
      if (e < best) { best = e; at = d[i - 1] + (d[i] - d[i - 1]) * t; }
    }
    return at;
  }
  function pathUpTo(path, d, len) {
    const o = [path[0]];
    for (let i = 1; i < path.length; i++) { if (d[i] <= len) o.push(path[i]); else { const t = (len - d[i - 1]) / ((d[i] - d[i - 1]) || 1); o.push([path[i - 1][0] + (path[i][0] - path[i - 1][0]) * t, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * t]); break; } }
    return o;
  }
  const pts2 = a => a.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  VIEWS.regionmap = function (prm) {
    const s = save(), key = (prm && prm.id) || (UI.params && UI.params.id), o = mapDesc(s, key), md = o && MAPD[o.mapId];
    if (!o) return frame('探検地図', '<div class="rs-panel"><p class="rs-p">この地域の地図はありません。</p></div>');
    const ok = !!(md && md.nodes && md.nodes.length === o.nodes.length);
    const sel = UI.mapSel != null && UI.mapKey === key && UI.mapSel < o.nodes.length ? UI.mapSel : (o.cur >= 0 ? o.cur : (o.cleared ? o.nodes.length - 1 : 0));
    UI.mapSel = sel; UI.mapKey = key;
    const stTxt = n => n.state === 'done' ? '突破済み' : n.state === 'cur' ? (n.boss ? 'ボスの戦い' : '今ここ') : 'まだここまで来ていない';
    const pips = n => `<span class="rs-pips" aria-hidden="true">${Array.from({ length: n.n }, (_, i) => `<i${i < n.done ? ' class="on"' : ''}></i>`).join('')}</span>`;
    const nm = (n, i) => n.boss ? (n.state === 'lock' && !o.cleared ? 'ボス' : n.name) : (n.state === 'lock' ? '地点 ' + (i + 1) : n.name);
    let over = '';
    if (ok) {
      const d = pathArc(md.path), tot = d[d.length - 1], arcs = md.nodes.map(p => arcOf(md.path, d, p));
      const upTo = o.cleared ? tot : o.lock ? 0 : (o.cur >= 0 ? arcs[o.cur] : 0);
      over += `<svg class="rs-mapsvg" viewBox="0 0 240 240" aria-hidden="true" focusable="false"><polyline class="rs-ml0" points="${pts2(md.path)}"/><polyline class="rs-ml1" points="${pts2(md.path)}"/>${upTo > 0 ? `<polyline class="rs-ml2" points="${pts2(pathUpTo(md.path, d, upTo))}"/>` : ''}</svg>`;
      over += `<span class="rs-mstart" style="left:${(md.path[0][0] / 2.4).toFixed(2)}%;top:${(md.path[0][1] / 2.4).toFixed(2)}%" aria-hidden="true">入口</span>`;
      o.nodes.forEach((n, i) => {
        const p = md.nodes[i], pos = `left:${(p[0] / 2.4).toFixed(2)}%;top:${(p[1] / 2.4).toFixed(2)}%`;
        over += `<button class="rs-mn ${n.state}${n.boss ? ' boss' : ''}${i === sel ? ' sel' : ''}" style="${pos}" data-mn="${i}" aria-pressed="${i === sel}" aria-label="${n.boss ? 'ボス' : '地点' + (i + 1)}：${esc(nm(n, i))}（${stTxt(n)}）"><span class="rs-mn-c">${n.state === 'done' ? '✓' : n.boss ? '★' : i + 1}</span></button>`;
        if (n.state === 'cur' && o.here) over += `<canvas class="rs-mhero rs-hcv rs-hcv-mini" id="rsMapHero" data-hero="${esc(JSON.stringify(heroOpts('mini', {})))}" aria-hidden="true" style="${pos}"></canvas>`;
        if (n.boss) over += `<span class="rs-mboss${o.chestOpen ? ' open' : ''}" id="rsMapBoss" aria-hidden="true" style="${pos}">初回報酬${o.chestOpen ? '✓' : ''}</span>`;
      });
    }
    const n = o.nodes[sel];
    const detail = `<div class="rs-mdet" id="rsMapDet" aria-live="polite"><b>${n.boss ? 'ボス：' : ''}${esc(nm(n, sel))}</b>${pips(n)}<small>${stTxt(n)}${n.state !== 'lock' || o.cleared ? `　${n.done} / ${n.n}` : ''}</small>${n.boss ? `<small>初回報酬：${o.chestOpen ? '受け取り済み（コインと素材）' : 'まだ（初めて倒すとコインと素材がもらえる）'}</small>` : ''}${n.state === 'cur' && o.story ? `<small>${esc(o.story)}</small>` : ''}${o.rematch && n.boss ? '<small>再戦中（本編は進みません）</small>' : ''}</div>`;
    const list = o.nodes.map((x, i) => `<li><button class="rs-mrow ${x.state}${i === sel ? ' sel' : ''}" data-mn="${i}" aria-pressed="${i === sel}"><span class="rs-dot">${x.state === 'done' ? '✓' : x.boss ? '★' : i + 1}</span><span class="rs-mrow-t"><b>${esc(nm(x, i))}</b><small>${stTxt(x)}</small></span>${pips(x)}</button></li>`).join('');
    const prog = o.cleared ? '全部突破！' : o.lock ? o.lock : `${o.done} / ${o.total} 区間`;
    return frame('探検地図', `<div class="rs-panel rs-mp"><div class="rs-mp-h"><b>${esc(o.name)}</b><small>${esc(o.sub)}　${esc(prog)}</small></div>
      <div class="rs-mapbox${o.lock ? ' lock' : ''}" id="rsMapBox"><img class="rs-mapimg" src="rpg/assets/bg/bg_map_${esc(o.mapId)}.png" alt="${esc(o.name)}の探検地図" width="240" height="240">${over}</div>
      ${detail}${ok ? '' : '<p class="rs-p">この地図の座標がありません。</p>'}</div>
      <div class="rs-panel"><div class="rs-h2">地点の一覧</div><ol class="rs-mplist">${list}</ol></div>`);
  };
  AFTER.regionmap = function (prm) {
    const s = save(), key = (prm && prm.id) || (UI.params && UI.params.id);
    app().querySelectorAll('[data-mn]').forEach(b => b.onclick = () => { UI.mapSel = +b.dataset.mn; UI.mapKey = key; rerender(); });
  };
  PARENT.regionmap = 'adv'; ROOT_OF.regionmap = 'adv';


  // 学習を止めないための保険：画面側の例外は RPG を止めて、学習ホームに戻す
  ['open', 'homeTop', 'bindHomeTop', 'navHtml'].forEach(k => {
    const f = RPG[k];
    RPG[k] = function () { try { return f.apply(RPG, arguments); } catch (e) { RPG.ok = false; RPG.err = 'crash'; if (root.console) console.error('RPG', k, e); return k === 'homeTop' || k === 'navHtml' ? '' : false; } };
  });
  RPG.go = go;
})(typeof self !== 'undefined' ? self : this);
