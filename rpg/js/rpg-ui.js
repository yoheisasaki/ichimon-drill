'use strict';
// 画面側：下端の冒険帯・結果（報酬）画面・保存の失敗表示・バックアップ。app.js から window.RPG 経由で呼ばれる
(function (root) {
  const D = root.RPGData, C = root.RPGCore, A = root.RPGAdv, M = root.RPGMeta, SP = root.RPGSprites, FXL = root.RPGFX;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const RU = root.RPGRuby, rb = RU.render;   // ルビは rpg-ruby.js（{漢字|よみ} と辞書）
  const reduceMotion = () => { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const PARAMS = new URLSearchParams(root.location ? root.location.search : '');
  const NOW = () => (root.__RPG_NOW ? root.__RPG_NOW() : Date.now());

  const RPG = { ok: false, save: null, store: null, err: null, errDetail: null, deferred: [], scene: { walk: 0 }, assets: {} };
  root.RPG = RPG;

  // ---------- 起動 ----------
  RPG.init = function () {
    try { Object.values(D.JOBS).forEach(j => RU.registerNote(j.name, j.ruby)); Object.values(D.SKILLS).forEach(s => RU.registerNote(s.name, s.ruby)); D.REGIONS.forEach(r => RU.registerNote(r.name, r.ruby)); RU.init(); if (root.document && root.document.body) RU.observe(root.document); else root.addEventListener('DOMContentLoaded', () => RU.observe(root.document)); } catch (e) { if (root.console) console.error('ruby init', e); }
    if (PARAMS.get('rpg') === '0') { RPG.err = 'off'; return; }   // 動作確認用：RPG を切って学習だけ動かす
    const io = { get: k => root.localStorage.getItem(k), set: (k, v) => root.localStorage.setItem(k, v) };
    RPG.io = io; RPG.store = C.makeStore(io);
    const r = RPG.store.load(NOW());
    RPG.save = M.ensure(r.save);
    if (!r.ok) { RPG.err = r.err; RPG.errDetail = r.detail || null; RPG.ok = false; return; }
    RPG.ok = true;
    try { if (FXL) setTimeout(() => FXL.load(), 400); } catch (e) {}   // 技の動くエフェクトは後から読む（失敗しても静止画・コード描画で動く）
    if (r.fresh) { const w = RPG.store.save(RPG.save); if (!w.ok) { RPG.ok = false; RPG.err = w.err; } }
    const dev = PARAMS.get('devcheck') === '1'; RPG.devcheck = dev;
    fetch('rpg/ASSET_MANIFEST.json', { cache: 'no-cache' }).then(x => x.json()).then(m => {
      (m.assets || []).forEach(a => { if (a.status === '正式' && a.path) RPG.assets[a.id] = a; });
      // 主人公の部品（parts.json）。台帳の parts_json が「正式」のときだけ読む（開発用検査は ?partsdir= で差し替え可）
      const pj = RPG.assets.parts_json, pd = dev && PARAMS.get('partsdir');
      if (pd) SP.loadParts(pd.replace(/\/?$/, '/')); else if (pj) SP.loadParts(pj.path.replace(/[^/]+$/, '')); else SP.noParts();
      delete RPG.assets.parts_json;
      SP.loadImages(RPG.assets, () => { try { if (ctx) drawStrip(); } catch (e) {} });
    }).catch(() => { SP.noParts(); SP.loadImages({}); });
  };
  RPG.persist = function () {
    if (!RPG.ok) return false;
    const r = RPG.store.save(RPG.save);
    if (r.ok) return true;
    RPG.err = r.err; if (r.err === 'stale') RPG.ok = false;
    return false;
  };
  // 画面に出す案内（保存できない・壊れている・別画面で進んだ）
  RPG.noticeHtml = function () {
    if (!RPG.err || RPG.err === 'off') return '';
    const m = {
      storage: 'この端末では冒険の記録を保存できません。<b>学習はそのまま使えます</b>。「ゲームのデータ」から書き出して残してね。',
      corrupt: '冒険のデータが読み込めません（学習は使えます）。',
      stale: '他の画面で冒険が進んでいます。この画面を読み込みなおしてね。'
    }[RPG.err] || '';
    return m ? `<div class="rpg-notice" role="alert">${m}</div>` : '';
  };


  RPG.studyMilestones = function (stats) {
    const total = Object.values(stats || {}).reduce((n, x) => n + (Number(x.c) || 0) + (Number(x.w) || 0), 0);
    if (!RPG.ok) return { total, next: (Math.floor(total / 100) + 1) * 100 };
    const s = RPG.save; M.ensure(s); s.stats = s.stats || {};
    const prev = s.stats.studyMilestones || { max: 0, claimed: [] };
    const next = { max: Math.max(prev.max || 0, total), claimed: (prev.claimed || []).slice() };
    for (let target = 100; target <= next.max; target += 100) {
      if (next.claimed.includes(target)) continue;
      if (target === 200) {
        s.inv.items.x_study_cloak = 1;
        s.codex.items.x_study_cloak = 1;
      } else {
        const id = 'study-milestone-' + target;
        if (!C.chestById(s, id)) {
          const rank = C.maxRank(s), all = Object.values(D.ITEMS).filter(it => it.rarity === 'rare' && it.rank === rank && it.id !== 'x_study_cloak');
          const wanted = all.filter(it => it.wish === s.wish && !s.inv.items[it.id]), fresh = all.filter(it => !s.inv.items[it.id]);
          const pool = wanted.length ? wanted : fresh.length ? fresh : all;
          if (pool.length) {
            const item = pool[Math.floor(C.rngFrom(id)() * pool.length)];
            C.addSealedChest(s, id, { kind: 'rare', item: item.id, rank, wish: s.wish, pityBefore: s.chest.pity }, { milestone: target, got: C.dayKey(NOW()) });
          }
        }
      }
      if (target === 300 && !s.rewards.titles.includes('三百問の探究者')) s.rewards.titles.push('三百問の探究者');
      next.claimed.push(target);
    }
    if (!s.stats.studyMilestones || next.max !== prev.max || next.claimed.length !== prev.claimed.length) {
      s.stats.studyMilestones = next;
      if (!RPG.persist()) return { total, next: (Math.floor(total / 100) + 1) * 100, error: true };
    }
    return { total: next.max, next: (Math.floor(next.max / 100) + 1) * 100 };
  };

  // 毎日30問に到達したら1回だけ宝箱を作る。
  RPG.dailyStudyReward = function (day, solved) {
    if (!RPG.ok || !/^\d{4}-\d{2}-\d{2}$/.test(day) || solved < 30) return false;
    const s = RPG.save, id = 'daily-study-30-' + day;
    if (C.chestById(s, id)) return false;
    C.addSealedChest(s, id, C.rollChest(s, id), { dailyGoal: 30, got: day });
    return RPG.persist();
  };
  // ---------- 学習セッションとの接続 ----------
  function snapOf(q) { return { id: q.id, q: q.q, a: q.a, choices: q.choices, type: q.type, accept: q.accept, map: q.map, unit: q.unit, subject: q.subject, test: q.test }; }
  RPG.beforeStart = function (list) {
    if (!RPG.ok) return { list, reviews: [], reask: 0, rpg: false };
    const a = A.begin(RPG.save, NOW());
    const reviews = a.reviews.pending.map(p => { const w = Object.create(p.snap); w._rv = { origin: p.origin }; return w; });
    RPG.persist();
    return { list: list.slice(0, A.remainingBasics(RPG.save)), reviews, reask: a.reviews.used, rpg: true };
  };
  RPG.onAnswer = function (q, ok, rid, S) {
    if (!S || !S.rpg || !RPG.ok) return;
    const rv = q._rv, r = A.recordAnswer(RPG.save, { rid, kind: rv ? 'review' : 'basic', correct: !!ok, origin: rv && rv.origin, qid: q.id }, NOW());
    if (r.dup || r.ignored) return;
    if (!rv) S.lastOrigin = r.origin;
    RPG.persist();
    const st = RPG.save.active && RPG.save.active.battle.status;
    const final = !!ok && S.idx === S.queue.length - 1;   // 最後の問題の正解：結果画面へ移る前の短い最終演出（0.5秒以内）
    RPG.play(r.events, { correct: !!ok, review: !!rv, killed: !!ok && st === 'won' && r.events.some(e => e.t === 'hero'), retreated: st === 'retreat' && r.events.some(e => e.t === 'enemy'), final });
  };
  RPG.queueReview = function (q, S) {
    if (!S || !S.rpg || !RPG.ok) return true;
    const origin = q._rv ? q._rv.origin : S.lastOrigin;
    if (!origin) return false;
    const ok = A.queueReview(RPG.save, origin, snapOf(q));
    if (ok) { RPG.persist(); return origin; }
    return false;
  };
  RPG.afterSession = function (S) {
    if (!S || !S.rpg || !RPG.ok) return null;
    if (A.canSettle(RPG.save)) { const res = A.settle(RPG.save, NOW()); RPG.persist(); return { settled: true, res }; }
    const a = RPG.save.active; return { settled: false, n: a ? a.basic.n : 0, unit: A.UNIT };
  };
  RPG.progressNote = function () { const a = RPG.ok && RPG.save.active; return a && a.basic.n > 0 && a.basic.n < A.UNIT ? { n: a.basic.n, unit: A.UNIT } : null; };

  // ---------- 下端の冒険帯 ----------
  // 見るだけの小さな舞台。状態（戦闘・経験値・報酬）は回答処理（RPG.onAnswer→A.recordAnswer）が一度だけ確定する。ここは確定済みの結果を絵にするだけで、
  // 演出の途中や終了で何も加算しない。演出を省いても（キューを捨てても）、最後は確定状態（syncView）へ戻る。計画は rpg-strip.js（純関数）
  const SCALE = 2;   // 論理1ドット = CSS 2px（帯の高さは CSS 44px = 22ドット）
  const STRIP_FXS = 1, STRIP_DS = 2;   // 帯：2×2ドットを1つにまとめ、1ドット＝canvas 1px。整数倍・補間なし
  const REWARD_FXS = 2;   // 報酬画面：エフェクト1ドット＝canvas 2px
  const ST = root.RPGStrip, TT = ST.T;
  const fxLive = [];
  const LAB_MAX = 72, REACH = 13, PAIR_GAP = 15;   // 地域名の最大幅(CSS px)／踏み込み量(ドット)／主人公と敵の中心の半距離(ドット。中心距離＝30ドット＝60CSS px)
  // 画像が枠（CSS px）に収まらないとき、縮小率を返す（収まるなら1）。192pxボスの帯・報酬画面用
  function fitScale(im, maxW, maxH) { if (!im) return 1; return Math.min(1, maxW ? maxW / im.width : 1, maxH ? maxH / im.height : 1); }
  RPG.deferred = [];   // 旧仕様の名残（敵の反撃は回答と同時に再生する。常に空）
  RPG.stripLog = [];   // 計測用：{k, ms, plan}（演出の実時間）
  RPG.stripHtml = function (S) { return S && S.rpg && RPG.ok ? '<div class="rpg-strip" aria-hidden="true"></div>' : ''; };
  // 帯の canvas は学習中ずっと同じものを使い回す（次問でも作り直さない。mount で新しい枠へ付け替えるだけ）
  let cv = null, ctx = null, W = 0, H = 0, raf = 0, animating = false, breath = 0, breathT = 0, textT = 0, bgCache = null, queue = [], running = null, layout = null;
  const view = { ready: false, eHp: 0, eMax: 1, gone: false, retreat: false, bgOff: 0, text: null, textEnd: 0 };   // いま見えている状態（確定状態に追いつく）
  const nowMs = () => (root.performance ? root.performance.now() : Date.now());
  // 見た目だけの「次の敵」：本物の敵を倒したあと（戦闘は確定済み）、同じ地域の敵が右から歩いてきて、答えるたびに主人公が殴る。
  // 報酬・経験値・記録・保存には一切つながらない（RPG.save も触らない）。cosm＝いま帯にいる敵、cp＝待ち行列に積んだ分まで進めた予定
  let cosm = null, cp = null;
  const COSM_HITS = 3;
  function pickCosm(si, avoid) {
    const ids = Object.keys(D.ENEMIES).filter(id => D.ENEMIES[id].region === si.region && !D.ENEMIES[id].boss && SP.IMGS['enemy_' + id + '_strip']);
    const pool = ids.length > 1 ? ids.filter(id => id !== avoid) : ids; if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  function ensureCosm() {   // 帯を出し直したとき・待機に戻ったとき：倒したあとなのに敵がいなければ、その場に1体置く
    if (!view.gone || cosm) return; const si = sceneInfo(); if (!si) return;
    const id = pickCosm(si, si.enemyId); if (id) cosm = { id, hp: COSM_HITS, max: COSM_HITS };
  }
  function planCosm(si, segs, final) {   // 本物の撃破のあとに「次の敵が歩いてくる」、倒したあとの正解は「次の敵を殴る」に置き換える
    if (final) return segs;
    if (segs.some(s => s.k === 'defeat')) {
      const id = pickCosm(si, si.enemyId); if (!id) return segs;
      cp = { id, hp: COSM_HITS, max: COSM_HITS };
      return segs.concat([{ k: 'spawn', d: 650, cosm: true, id, max: COSM_HITS }]);
    }
    if (si.status === 'won' && segs.length && segs.every(s => s.k === 'walk')) {
      const live = (queue.length || running) ? (cp || cosm) : cosm; let base = live ? { id: live.id, hp: live.hp, max: live.max } : null, out = [];
      if (!base || base.hp <= 0) { const id = pickCosm(si, base ? base.id : si.enemyId); if (!id) return segs; base = { id, hp: COSM_HITS, max: COSM_HITS }; out.push({ k: 'spawn', d: 650, cosm: true, id, max: COSM_HITS }); }
      const hit = ST.plan([{ t: 'hero', act: 'normal', dmg: 1 }], { ranged: ST.rangedOf(si.job, si.weaponId) })[0];
      hit.cosm = true; hit.cid = base.id; hit.cmax = base.max; base.hp = Math.max(0, base.hp - 1); out.push(hit);
      if (base.hp <= 0) out.push({ k: 'defeat', d: ST.T.defeat, fade: ST.T.defeatFade, cosm: true }), out.push({ k: 'spawn', d: 650, cosm: true, id: pickCosm(si, base.id) || base.id, max: COSM_HITS }), base = null;
      cp = base; return out;
    }
    return segs;
  }
  function sceneInfo() {
    const a = RPG.save && RPG.save.active; if (!a) return null;
    const b = a.battle, ed = D.ENEMIES[a.enemyId];
    const h = a.hero || {}, wid = (h.equip && h.equip.weapon) || RPG.save.equip.weapon, rid = a.route.bg || D.REGIONS[a.route.region].id, rg = D.REGIONS.find(r => r.id === rid);
    return { job: b.hero.job, costume: M.costumeOf(RPG.save, b.hero.job), weaponId: M.artWeapon(b.hero.job, wid), region: rid, regionName: rg ? rg.name : '', enemyId: ed.id, boss: ed.boss, status: b.status, guard: !!(b.hero.guard && b.hero.guard.left > 0), ehp: b.enemy.hp, emax: b.enemy.maxHp };
  }
  // 確定状態に合わせる（敵のHP・倒した／撤退）。演出が終わったとき、捨てたとき、帯を出したときに呼ぶ
  function syncView() { const si = sceneInfo(); if (!si) return; if (si.status !== 'won') { cosm = null; cp = null; } view.eHp = si.ehp; view.eMax = Math.max(1, si.emax); view.gone = si.status === 'won'; view.retreat = si.status === 'retreat'; view.ready = true; }
  function bgTiles(si) {   // 背景は1回だけ描いて使い回す。通常と左右反転を並べて、移動しても継ぎ目が出ない
    const has = !!SP.IMGS['bg_' + si.region + '_strip'], key = si.region + '|' + W + '|' + H + '|' + has;
    if (bgCache && bgCache.key === key) return bgCache;
    const A = root.document.createElement('canvas'); A.width = W * SCALE; A.height = H * SCALE; const g = A.getContext('2d');
    g.fillStyle = (SP.REGION_COLOR[si.region] || SP.REGION_COLOR.meadow).sky[0]; g.fillRect(0, 0, A.width, A.height);
    g.setTransform(SCALE, 0, 0, SCALE, 0, 0); SP.drawBackground(g, W, H, si.region, 'strip'); g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = 'rgba(226,232,248,.36)'; g.fillRect(0, 0, A.width, A.height);   // 背景のコントラストを落とし、主人公と敵を読みやすくする
    const B = root.document.createElement('canvas'); B.width = A.width; B.height = A.height; const gb = B.getContext('2d'); gb.translate(B.width, 0); gb.scale(-1, 1); gb.drawImage(A, 0, 0);
    return (bgCache = { key, a: A, b: B });
  }
  function css(fn) { ctx.save(); ctx.scale(1 / SCALE, 1 / SCALE); fn(); ctx.restore(); }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  const FONT = '400 12px "DotGothic16","Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif';   // 帯の左上の札もドット文字（rpg-font.css と同じ）。読み込み後に描き直す
  try { if (root.document && root.document.fonts && root.document.fonts.load) root.document.fonts.load('12px "DotGothic16"', '山脈技').then(() => { try { if (ctx) drawStrip(); } catch (e) {} }, () => {}); } catch (e) {}
  function drawStrip(o) {
    if (!ctx) return; o = o || {};
    const si = sceneInfo(); if (!si) return;
    if (!view.ready) syncView();
    const wc = W * SCALE, t = bgTiles(si), per = wc * 2, off = ((view.bgOff % per) + per) % per;
    ctx.clearRect(0, 0, W, H);
    css(() => { for (let i = 0; i < 3; i++) { const x = -off + i * wc, k = (Math.floor(off / wc) + i) % 2; ctx.drawImage(k ? t.b : t.a, Math.round(x), 0); } });
    // 主人公と敵は帯の中央で向かい合う（中心距離60CSS px）。足元の高さは同じ。攻撃のときだけ踏み込む
    const cx = W / 2 + 6, gy = H - 2, hx = cx - PAIR_GAP + (o.hdx || 0), ec = cx + PAIR_GAP + (o.edx || 0), bo = breath && !animating ? 0.5 : 0;
    const shadow = (x, w) => { ctx.fillStyle = 'rgba(20,28,60,.32)'; ctx.beginPath(); ctx.ellipse(x, gy + 0.5, w, 1.6, 0, 0, 7); ctx.fill(); };
    shadow(hx, 9);
    const ce = cosm && view.gone ? cosm : null;
    const ho = { job: si.job, costume: si.costume, weaponId: si.weaponId, use: 'strip', pose: ST.poseOf(o.pose || (view.gone && !ce ? 'win' : 'idle'), o.step), x: hx, groundY: gy - bo, tint: view.retreat ? '#8a90a8' : null, guard: o.guard || si.guard, outline: '#141a3c' };
    if (SP.drawHeroLayered(ctx, ho) === 'wait' && ho.pose !== 'idle') SP.drawHeroLayered(ctx, Object.assign({}, ho, { pose: 'idle' }));   // 読込中のポーズがあっても主人公を消さない（待機の絵で代用）
    layout = { bar: null, enemyH: 0 };
    if (!view.gone || o.ealpha > 0 || ce) {
      const eid = ce ? ce.id : si.enemyId, eboss = ce ? false : si.boss, ehp = ce ? ce.hp : view.eHp, emax = ce ? ce.max : view.eMax;
      const im = SP.IMGS['enemy_' + eid + '_strip'], fs = fitScale(im, 0, 32), eh = im ? Math.round(im.height * fs) : 24;
      ctx.save(); if (o.ealpha != null) ctx.globalAlpha = Math.max(0, o.ealpha);
      shadow(ec, 11); SP.drawEnemy(ctx, eid, eboss, ec - 7, gy - (breath && !animating ? 0 : 0.5), { img: 'strip', tint: o.eflash ? '#fff' : null, outline: '#141a3c', scale: fs });
      ctx.restore();
      // 敵の頭上の体力バー：幅30×高さ3（CSS px）。残りは長さで分かる（色だけに頼らない）
      const frac = Math.max(0, Math.min(1, ehp / emax)), fill = ehp <= 0 ? 0 : ehp >= emax ? 30 : Math.min(29, Math.max(1, Math.round(30 * frac))), bx = Math.round(ec * SCALE - 15), by = Math.max(3, gy * SCALE - eh - 7);
      css(() => { if (o.ealpha != null) ctx.globalAlpha = Math.max(0, o.ealpha); ctx.fillStyle = '#141a3c'; ctx.fillRect(bx - 1, by - 1, 32, 5); ctx.fillStyle = '#eceaf6'; ctx.fillRect(bx, by, 30, 3); ctx.fillStyle = frac > .5 ? '#2fb85a' : frac > .25 ? '#f0b429' : '#e5484d'; ctx.fillRect(bx, by, fill, 3); });
      layout = { bar: { x: bx, y: by, w: 30, h: 3, fill, outer: [32, 5] }, enemyH: eh };
    }
    if (o.proj) { const x = hx + 9 + (ec - 6 - hx - 9) * o.proj.p; SP.px(ctx, x, gy - 10, o.proj.col, 2); SP.px(ctx, x - 2, gy - 10, 'rgba(255,255,255,.7)', 1); }
    if (o.still) { const im = SP.IMGS['fx_' + o.still.kind + '_strip']; if (im) { ctx.save(); ctx.globalAlpha = 0.9; ctx.imageSmoothingEnabled = false; const k = ctx.getTransform().a || 1, w = im.width / k, h = im.height / k, cc = o.still.hero ? hx : ec; ctx.drawImage(im, cc - w / 2, gy - h - 2, w, h); ctx.restore(); } }
    fxLive.forEach(f => { if (f.started()) f.blit(ctx, f.at === 'hero' ? hx : f.at === 'melee' ? ec - 17 : ec, f.at === 'enemy' ? gy - 6 : gy, STRIP_FXS, 1, STRIP_DS); });
    if (o.trail) {   // 命中の斬撃の軌跡：敵の体の上に1〜2コマ（剣が下向きでも当たったことが分かる）
      const c = o.trail.col, pts = o.trail.f === 0 ? [[-6, -14], [-4, -12], [-2, -10], [0, -8], [2, -6], [4, -4]] : [[-3, -11], [-1, -9], [1, -7]];
      pts.forEach(([x, y], i) => SP.px(ctx, ec + x, gy + y, i % 2 ? c[1] : c[0], 2));
    }
    if (o.glint) { for (let i = 0; i < 4; i++) SP.px(ctx, hx + 9, gy - 14 + i * 1.5, '#fff', 1.5); SP.px(ctx, hx + 10.5, gy - 12.5, '#bfe6ff', 1.5); }   // 守りの盾の縁が一瞬光る（1回）
    if (o.heal) { SP.px(ctx, hx - 2, gy - 18, '#5be08a', 1); SP.px(ctx, hx - 3, gy - 17, '#5be08a', 3); SP.px(ctx, hx - 2, gy - 16, '#5be08a', 1); }
    // 左端の短い表示：ふだんは地域名。技名・「できた！」・立て直し中は短時間これに置き換える（高さは増やさない）
    const live = view.text && nowMs() < view.textEnd, txt = live ? view.text : (view.retreat ? '立て直し中' : si.regionName);
    css(() => {
      ctx.font = FONT; ctx.textBaseline = 'middle'; let s = txt || '';
      if (ctx.measureText(s).width > LAB_MAX) { while (s.length > 1 && ctx.measureText(s + '…').width > LAB_MAX) s = s.slice(0, -1); s += '…'; }
      const w = Math.ceil(ctx.measureText(s).width) + 10;
      ctx.fillStyle = live ? 'rgba(20,26,60,.82)' : 'rgba(20,26,60,.58)'; rrect(4, 4, w, 18, 6); ctx.fill();
      ctx.fillStyle = live ? '#ffe27a' : '#fff'; ctx.fillText(s, 9, 13.5);
      layout.label = { text: s, w, live };
    });
    layout.hx = hx * SCALE; layout.ex = ec * SCALE; layout.W = W * SCALE; layout.H = H * SCALE;
  }
  RPG.stripSync = function () { syncView(); drawStrip(); };   // 確定状態へ合わせて描き直す（検査用。帯を出し直したときと同じ）
  RPG.stripInfo = function () {   // 計測用：直前に描いたときの実寸（CSS px）
    if (!layout) return null; return Object.assign({ dist: Math.round(layout.ex - layout.hx), animating, pending: queue.length, running: !!running, view: Object.assign({}, view) }, layout);
  };
  let warmKey = '';
  function warmPoses() {   // 使うポーズの部品を先に読み込んでおく（初めて攻撃したとき主人公が一瞬消えないように）
    const si = sceneInfo(); if (!si) return; const k = [si.job, si.costume, si.weaponId, ''].join('|'); if (k === warmKey) return; warmKey = k;
    try { const c = root.document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); SP.POSES.S.forEach(pose => SP.drawHeroLayered(g, { job: si.job, costume: si.costume, weaponId: si.weaponId, use: 'strip', pose, x: 32, groundY: 60 })); } catch (e) {}
  }
  RPG.mount = function () {
    const box = root.document.querySelector('.rpg-strip'); if (!box) return;
    if (!cv) { cv = root.document.createElement('canvas'); ctx = null; }
    box.appendChild(cv);
    const bs = root.getComputedStyle(box), inner = box.clientWidth - (parseFloat(bs.paddingLeft) || 0) - (parseFloat(bs.paddingRight) || 0), w = Math.ceil(Math.max(100, inner) / SCALE), h = 22;
    if (!ctx || w !== W || h !== H) { W = w; H = h; cv.width = W * SCALE; cv.height = H * SCALE; ctx = cv.getContext('2d'); ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0); bgCache = null; }
    if (!view.ready) syncView();
    ensureCosm();
    warmPoses();
    drawStrip();
    clearInterval(breathT); if (!reduceMotion()) breathT = setInterval(() => { if (!ctx || animating || !cv) return; breath ^= 1; drawStrip(); }, 900);   // 待機中は小さく呼吸するだけ（戦闘や報酬は進まない）
    const inp = root.document.getElementById('ans');   // 入力問題：キーボード表示中は帯を隠し、閉じたら最新状態で出す
    if (inp) { inp.addEventListener('focus', () => { box.hidden = true; }); inp.addEventListener('blur', () => { box.hidden = false; if (!running) syncView(); drawStrip(); }); }
  };
  RPG.unmount = function () { cancelAnimationFrame(raf); clearInterval(breathT); clearTimeout(textT); animating = false; rewardRedraw = null; cv = ctx = null; queue = []; running = null; fxLive.length = 0; view.ready = false; view.bgOff = 0; view.text = null; bgCache = null; layout = null; cosm = null; cp = null; };
  // 出来事を短く再生。演出は計算結果に影響しない（省略しても同じ）
  const snd = n => { try { if (RPG.sound) RPG.sound.play(n); } catch (e) {} };
  // 区間の時刻 t(ms) での見た目。reduce-motion(rm)では踏み込み・背景移動・弾道を省き、構え（ポーズ）の差と体力バーだけにする
  function frameOf(sg, t, st, rm) {
    const dx = v => (rm ? 0 : v), p = Math.min(1, t / sg.d);
    if (sg.k === 'attack' || sg.k === 'skill') {
      const [a, b, c, d] = sg.ph, e1 = a, e2 = a + b, e3 = a + b + c, r = {};
      if (t < e1) { r.hdx = dx(-1 * t / a); r.pose = 'windup'; }
      else if (t < e2) { const q = (t - e1) / b; r.hdx = sg.ranged ? 0 : dx(-1 + (REACH + 1) * q); r.pose = 'attack'; if (sg.ranged && !rm) r.proj = { p: q, col: sg.col || '#fff6c0' }; }
      else if (t < e3) { r.hdx = sg.ranged ? 0 : dx(REACH); r.pose = 'attack'; r.edx = dx(1.5); r.eflash = sg.dmg > 0 && t < e2 + c * 0.4; if (sg.dmg > 0) r.trail = { f: t < e2 + c * 0.5 ? 0 : 1, col: sg.k === 'skill' ? ['#9ad8ff', '#fff'] : ['#fff', '#ffe27a'] }; if (sg.key) r.stillKey = true; }
      else { const q = Math.min(1, (t - e3) / d); r.hdx = dx(sg.ranged ? 0 : REACH * (1 - q)); r.edx = dx(1.5 * (1 - q)); r.pose = 'idle'; }
      return r;
    }
    if (sg.k === 'support') return { pose: t < 140 ? 'windup' : 'attack', heal: !sg.key && sg.heal > 0 && t > 140, stillKey: t > 140 };
    if (sg.k === 'heal') return { heal: true, pose: 'idle' };
    if (sg.k === 'guard') return { pose: 'guard', guard: true, hdx: dx(-1.5 * Math.min(1, t / 60)), glint: t >= 30 && t < 110 };
    if (sg.k === 'retreat') return { pose: t < 110 ? 'hurt' : 'walk', step: Math.floor(t / 100), hdx: dx(-8 * p), retreat: t >= 110 };
    if (sg.k === 'enemy') {
      const r = { guard: sg.reduced > 0 };
      if (t < 100) r.edx = dx(-6 * t / 100);
      else if (t < 160) { r.edx = dx(-6); if (sg.dmg > 0) { r.pose = 'hurt'; r.hdx = dx(-1.5); } }
      else { const q = (t - 160) / (sg.d - 160); r.edx = dx(-6 * (1 - q)); if (sg.dmg > 0 && q < .5) { r.pose = 'hurt'; r.hdx = dx(-1.5 * (1 - q * 2)); } }
      return r;
    }
    if (sg.k === 'spawn') { const e0 = W + 12 - (W / 2 + 6 + PAIR_GAP); st.bg = dx(14 * p); return { pose: 'walk', step: Math.floor(t / 100), edx: dx(e0 * (1 - (1 - Math.pow(1 - p, 2)))), gone: false }; }
    if (sg.k === 'walk') { st.bg = dx(10 * p); return { pose: 'walk', step: Math.floor(t / 100) }; }
    if (sg.k === 'defeat') {
      if (sg.final || t < sg.fade) return { ealpha: Math.max(0, 1 - t / sg.fade), edx: dx(2 * Math.min(1, t / sg.fade)), pose: sg.final ? 'win' : 'idle' };
      const q = (t - sg.fade) / (sg.d - sg.fade); st.bg = dx(30 * q); return { ealpha: 0, pose: 'walk', step: Math.floor((t - sg.fade) / 130), gone: true };
    }
    return {};
  }
  function segStart(sg, now, st, rm) {
    st.bg0 = view.bgOff; st.hit = false;
    if (sg.k === 'spawn') cosm = { id: sg.id, hp: sg.max, max: sg.max };
    else if (sg.cosm && sg.k === 'attack' && !cosm) cosm = { id: sg.cid, hp: sg.cmax, max: sg.cmax };
    if (sg.text) { view.text = sg.text; view.textEnd = now + TT.TEXT_MS; }
    if ((sg.k === 'skill' || sg.k === 'support') && sg.key && FXL && !rm) {
      const job = RPG.save && RPG.save.active ? RPG.save.active.battle.hero.job : null;
      const inst = FXL.spawn(sg.key, { jobColor: job ? SP.JOB_COLOR[job] : null, cap: 0.9, delay: Math.max(0.02, (sg.hitAt - 70) / 1000), light: 1 });   // 帯では hit stop・画面ゆれは出さない
      if (inst) { st.fxOk = true; fxLive.push(inst); }
    }
    if ((sg.k === 'skill' || sg.k === 'support') && sg.key && FXL) st.kind = FXL.stillOf(sg.key);
  }
  RPG.play = function (events, opt) {
    opt = opt || {};
    events.forEach(e => { if (e.t === 'hero') snd(e.act === 'normal' ? 'attack' : 'skill'); else if (e.t === 'enemy' && e.dmg > 0) snd('hit'); });
    if (!ctx) return;
    const si = sceneInfo(); if (!si) return;
    const fx = FXL ? (id => FXL.keyFor(id)) : null, at = FXL ? (k => FXL.AT[k]) : null, nameOf = id => (D.SKILLS[id] ? D.SKILLS[id].name : null);
    let segs = opt.correct === false ? (si.status === 'fight' || opt.retreated ? ST.planWrong(events, { final: !!opt.final, retreated: !!opt.retreated }) : []) : ST.plan(events, { review: !!opt.review, killed: !!opt.killed, retreated: !!opt.retreated, final: !!opt.final, ranged: ST.rangedOf(si.job, si.weaponId), fx, at, name: nameOf });
    segs.forEach(s => { if (s.k === 'skill' || s.k === 'support') s.col = SP.JOB_COLOR[si.job] || '#ffd24a'; });
    if (!segs.length) return;
    if (opt.correct !== false) { segs = planCosm(si, segs, !!opt.final); if (segs.some(s => s.cosm && s.k === 'attack')) snd('attack'); }
    const r = ST.enqueue(queue, segs, !!running); queue = r.queue;
    RPG.stripLog.push({ k: 'enqueue', n: segs.map(s => s.k).join('+'), planMs: ST.total(segs), dropped: r.dropped, pending: queue.length }); if (RPG.stripLog.length > 200) RPG.stripLog.shift();
    if (!animating) { animating = true; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
  };
  function tick(now) {
    if (!ctx) return;
    const rm = reduceMotion();
    fxLive.forEach(f => f.update(0.016)); for (let j = fxLive.length - 1; j >= 0; j--) if (fxLive[j].started() && fxLive[j].done()) fxLive.splice(j, 1);
    if (!running) {
      if (!queue.length) {
        syncView(); ensureCosm(); view.bgOff = Math.round(view.bgOff); drawStrip();
        if (fxLive.length) { raf = requestAnimationFrame(tick); return; }
        animating = false; const rest = view.textEnd - nowMs();
        if (view.text && rest > 0) { clearTimeout(textT); textT = setTimeout(() => { if (ctx && !animating) drawStrip(); }, rest + 20); }
        return;
      }
      running = { segs: queue.shift(), i: 0, start: now, st: {}, begun: false, t0: now };
    }
    const sg = running.segs[running.i], st = running.st;
    if (!running.begun) { running.begun = true; segStart(sg, nowMs(), st, rm); }
    const t = Math.max(0, now - running.start), f = frameOf(sg, Math.min(t, sg.d), st, rm);
    // 命中の瞬間に敵の体力バーが減る（見た目だけ。確定値は回答処理で済んでいる）
    if (!st.hit && (sg.k === 'attack' || sg.k === 'skill' || sg.k === 'support') && t >= sg.hitAt) { st.hit = true; if (sg.cosm) { if (cosm) cosm.hp = Math.max(0, cosm.hp - 1); } else if (sg.dmg > 0) view.eHp = Math.max(0, view.eHp - sg.dmg); }
    if (sg.k === 'defeat' && sg.cosm) { if (f.gone) cosm = null; }
    else if (sg.k === 'defeat' && (f.gone || (sg.final && t >= sg.d))) { view.gone = true; view.eHp = 0; }
    if (f.retreat) view.retreat = true;
    if (st.bg != null) view.bgOff = st.bg0 + st.bg;
    let still = null; if (f.stillKey && sg.key && !st.fxOk && st.kind && SP.IMGS['fx_' + st.kind + '_strip']) still = { kind: st.kind, hero: FXL.AT[sg.key] === 'hero' };
    drawStrip({ hdx: f.hdx, edx: f.edx, pose: f.pose, step: f.step, guard: f.guard, eflash: f.eflash, ealpha: f.ealpha, proj: f.proj, heal: f.heal, glint: f.glint, trail: f.trail, still });
    if (t >= sg.d) {
      if (!st.hit && sg.cosm) { if (cosm && sg.k === 'attack') cosm.hp = Math.max(0, cosm.hp - 1); }
      else if (!st.hit && sg.dmg > 0) view.eHp = Math.max(0, view.eHp - sg.dmg);
      RPG.stripLog.push({ k: sg.k, ms: Math.round(t), plan: sg.d }); if (RPG.stripLog.length > 200) RPG.stripLog.shift();
      running.i++; running.start += sg.d; running.begun = false; running.st = {};
      if (running.i >= running.segs.length) { RPG.stripLog.push({ k: 'group', ms: Math.round(now - running.t0) }); running = null; }
    }
    raf = requestAnimationFrame(tick);
  }

  // ---------- 結果（報酬）画面 ----------
  function itemName(id) { const it = D.ITEMS[id]; return it ? it.name : id; }
  // 朝星の宝箱のカード（報酬画面とホームで共通）。中身は開封するまでDOMに出さない。開封後は同じ枠で「獲得物が主役」
  function giftIconSrc(g) {
    if (g.kind === 'coin') return 'rpg/assets/items/coin.png';
    const a = root.RPG && RPG.assets && RPG.assets['icon_' + g.id]; return a && a.path ? a.path : '';
  }
  function giftIcon(g, px) {
    const src = giftIconSrc(g);
    return src ? `<img class="rw-gimg" src="${src}" width="${px}" height="${px}" alt="" aria-hidden="true">` : `<span class="rw-gimg rw-gnone" aria-hidden="true">?</span>`;
  }
  function giftName(g) { return g.kind === 'coin' ? `コイン ＋${g.qty}` : g.kind === 'item' ? esc(g.name) : `<span class="rw-nw">${esc(g.name)}</span> ×${g.qty}`; }
  function chestMore(v) {
    if (!v) return '';
    if (v.extras.length) return `<button class="rw-more" id="rwChestMore" aria-haspopup="dialog">${rb('ほか')}${v.extras.length}${rb('{件|けん}')}${v.extras.length === 1 ? '：' + (v.extras[0].kind === 'coin' ? 'コイン ＋' + v.extras[0].qty : esc(v.extras[0].name) + ' ×' + v.extras[0].qty) : ''}</button>`;
    if (v.dupOf || v.primary.kind === 'item') return `<button class="rw-more" id="rwChestMore" aria-haspopup="dialog">${rb('{詳|くわ}しく')}</button>`;
    return '';
  }
  function chestSheetHtml(v) {
    const row = g => `<div class="rw-grow">${giftIcon(g, 40)}<span><b>${giftName(g)}</b><br><small>${rb(g.use)}</small></span></div>`;
    let h = v.items.map(row).join('');
    if (v.dupOf) h += `<p class="rw-note">${rb('{持|も}っている{装備|そうび}')}「${esc(v.dupOf.name)}」${rb('が{出|で}たので、{素材|そざい}に{交換|こうかん}しました。')}</p>`;
    if (v.primary && v.primary.kind === 'item') { const fx = M.effectText(v.primary.id); if (fx) h += `<p class="rw-note">${esc(fx)}</p>`; }
    return h;
  }
  function chestContentHtml(c) {
    const r = c.result; if (!r) return '';
    const v = C.chestView(r, RPG.save && RPG.save.job), g = v.primary; if (!g) return '';
    let l2 = rb(g.use);
    if (v.dupOf) l2 = rb('{持|も}っている{装備|そうび}だったので{交換|こうかん}しました');
    else if (g.kind === 'item') l2 = rb('{新|あたら}しい{装備|そうび}を{手|て}に{入|い}れた！') + (v.fit.ok ? '' : `<br><small class="rw-warn">${esc(v.fit.job)}${rb('では{使|つか}えません')}</small>`);
    return `<b class="rw-gname">${giftName(g)}</b><span class="rw-guse">${l2}</span>`;
  }
  function chestLeadHtml(c) {
    const v = c.status === 'opened' && c.result ? C.chestView(c.result, RPG.save && RPG.save.job) : null;
    return v && v.primary ? `<div class="rw-lead rw-gi" id="rwLead">${giftIcon(v.primary, 48)}</div>` : '<div class="rw-lead" id="rwLead"><canvas id="rwChestCv" class="rw-chestcv" aria-hidden="true"></canvas></div>';
  }
  function isRareChest(c) { return !!(c.roll && c.roll.kind === 'rare') || !!(c.result && c.result.kind === 'rare'); }
  function chestCardHtml(c, compact) {
    const open = c.status === 'opened' && !!c.result, got = open ? C.chestView(c.result, RPG.save && RPG.save.job) : null;
    const lab = `<div class="rw-chest">${rb('{朝星|あさぼし}の{宝箱|たからばこ}')}${c.legacy ? '（受取済み）' : ''}</div>`;
    const btn = open ? '' : `<button class="rw-open" id="rwOpen">${rb('{宝箱|たからばこ}を{開|あ}ける')}</button>`, line = `<div class="rw-dropline" id="rwChestLine" ${open ? '' : 'hidden'}>${open ? chestContentHtml(c) : ''}</div><span id="rwMoreSlot">${open ? chestMore(got) : ''}</span><div class="rw-chestmsg" id="rwChestMsg" role="status"></div>`;
    const cls = 'rw-drop rw-compact' + (open ? ' rw-got' : '') + (isRareChest(c) ? ' rw-rare' : '');
    return `<div class="${cls}" id="rwDrop" data-chest="${esc(c.id)}">${chestLeadHtml(c)}<div class="rw-dtx">${lab}${btn}${line}</div></div>`;
  }
  // 開封後、獲得物の枠が下の操作帯に隠れないよう中スクロールを動かす（すでに見えていれば動かさない）
  function revealChestLine(card) {
    const body = card.closest && card.closest('.rw-body'); if (!body || !card) return;
    const go = () => {
      const br = body.getBoundingClientRect(), lr = card.getBoundingClientRect(), pad = 8;
      const over = lr.bottom + pad - br.bottom; if (over > 0) body.scrollTo({ top: body.scrollTop + Math.min(over, Math.max(0, lr.top - br.top - pad)), behavior: reduceMotion() ? 'auto' : 'smooth' });
    };
    go(); requestAnimationFrame(go);
  }
  function bindChestMore(card, c) {
    const mb = card.querySelector('#rwChestMore'); if (!mb) return;
    mb.onclick = () => { const v = C.chestView(c.result, RPG.save.job); if (RPG.openSheet) RPG.openSheet(rb('{宝箱|たからばこ}の{中身|なかみ}'), chestSheetHtml(v), 'rwchest'); };
  }
  // card 内の開封ボタンを動かす。保存（付与と opened を同時）が成功してから演出する。onDone(chest) は結果表示後
  function bindChestCard(card, onDone) {
    if (!card) return;
    const id = card.dataset.chest, ob = card.querySelector('#rwOpen'), lead = card.querySelector('#rwLead'), ln = card.querySelector('#rwChestLine'), msg = card.querySelector('#rwChestMsg');
    const cc = card.querySelector('#rwChestCv');
    if (!ob) { const c0 = C.chestById(RPG.save, id); if (c0) bindChestMore(card, c0); }
    if (cc) { const hasImg = !!SP.IMGS.chest_morning_closed; cc.width = hasImg ? 64 : 24; cc.height = hasImg ? 52 : 14; cc.style.width = hasImg ? '64px' : '72px'; cc.style.height = hasImg ? '52px' : '42px'; drawChestCv(cc, !ob, 0); }
    if (!ob) return;
    ob.onclick = () => {
      if (ob.disabled) return; ob.disabled = true;
      if (!RPG.ok) { msg.textContent = 'いま保存できないので開けられません。'; ob.disabled = false; return; }
      const r = C.openChestPersist(RPG.save, RPG.store, id, NOW());
      if (!r.ok) { RPG.err = r.err === 'stale' ? 'stale' : RPG.err; msg.textContent = '保存できなかったので開けていません。もう一度試してね。'; ob.disabled = false; return; }
      const rare = !!(r.chest.result && r.chest.result.kind === 'rare'), calm = reduceMotion(), dur = rare ? 640 : 560;
      let done = false;
      const fin = () => {   // 保存はすでに済んでいる。ここは表示だけ（演出の完了を加算条件にしない）
        if (done) return; done = true;
        const v = C.chestView(r.chest.result, RPG.save.job);
        if (lead && v.primary) { lead.className = 'rw-lead rw-gi'; lead.innerHTML = giftIcon(v.primary, 48); }
        ln.innerHTML = chestContentHtml(r.chest); ln.hidden = false; ob.remove();
        card.classList.add('rw-got'); if (rare) card.classList.add('rw-rare'); if (!calm) card.classList.add('rw-anim');
        const ms = card.querySelector('#rwMoreSlot'); if (ms) { ms.innerHTML = chestMore(v); bindChestMore(card, r.chest); }
        snd('chest'); onDone && onDone(r.chest); revealChestLine(card);
      };
      if (calm || !cc) { fin(); return; }
      const t0 = performance.now(); const tick = now => { const p = (now - t0) / dur; if (p >= 1) { fin(); return; } drawChestCv(cc, p > 0.45, p); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    };
  }
  // ホームの小さい入口：開けていない箱があるときだけ。複数あっても1個ずつ
  RPG.homeChestHtml = function () {
    if (!RPG.ok) return '';
    const list = C.sealedChests(RPG.save); if (!list.length) return '';
    return `<details class="rs-chestbox" id="rsChestBox"><summary>${rb('受け取った{宝箱|たからばこ}')}（${list.length}）</summary><div id="rsChestSlot">${chestCardHtml(list[0])}</div></details>`;
  };
  RPG.bindHomeChests = function () {
    const box = root.document.getElementById('rsChestBox'); if (!box) return;
    const slot = box.querySelector('#rsChestSlot');
    const bind = () => bindChestCard(slot.querySelector('#rwDrop'), () => {
      const left = C.sealedChests(RPG.save), sm = box.querySelector('summary');
      sm.innerHTML = rb('受け取った{宝箱|たからばこ}') + '（' + left.length + '）';
      if (left.length) { const nb = root.document.createElement('button'); nb.className = 'rw-open'; nb.id = 'rsChestNext'; nb.textContent = '次の宝箱へ'; nb.onclick = () => { slot.innerHTML = chestCardHtml(left[0]); bind(); }; slot.appendChild(nb); }
    });
    bind();
  };
  function clearHtml(res) {
    const c = res.clear; if (!c) return '';
    const L = [];
    if (c.trial) L.push('<b>試練クリア！</b> ' + (c.trial === 'wing' ? '天翔騎士' : '星詠み') + 'に転職できるようになった');
    else L.push('<b>' + esc(res.quest.name) + ' クリア！</b>');
    if (c.title) L.push('称号「' + esc(c.title) + '」');
    if (c.costume) L.push('衣装「' + esc(c.costume) + '」');
    if (c.item) L.push('秘境のたから「' + esc(itemName(c.item)) + '」');
    if (c.lamp) L.push('夜明けの灯を手に入れた');
    return '<div class="rw-clear">' + L.map(x => '<div>' + x + '</div>').join('') + '</div>';
  }
  RPG.rewardHtml = function (res, S, wrongHtml, hasWrong) {
    const e = res.enemy, chest = res.chestId ? C.chestById(RPG.save, res.chestId) : null, tot = C.rewardTotals(res, chest);
    const cap = res.outcome === 'victory' ? rb(`${e.name}を{倒|たお}した！`) : res.outcome === 'continue' ? rb('{今日|きょう}はここまで。{続|つづ}きから{挑|いど}めます') : rb('{街|まち}に{戻|もど}りました。{取|と}り{組|く}んだ{分|ぶん}の{報酬|ほうしゅう}を{受|う}け{取|と}ろう');
    const badge = res.slot.no === 1 ? '初回ボーナス ×3' : res.slot.no === 2 ? '2回目ボーナス ×2' : '';
    const jd = D.JOBS[res.job.id], gv = C.growthView(res.job.id, RPG.save.jobXp[res.job.id], { lvFrom: res.job.lvFrom, advFrom: res.adv.lvFrom, advTo: res.adv.lvTo });
    const lvTxt = gv.up ? `${esc(jd.name)} Lv${gv.lvFrom} → <b>Lv${gv.lv}</b>` : `${esc(jd.name)} Lv${gv.lv}`;
    const gRight = gv.capped ? rb('レベル{上限|じょうげん}') : `Lv${gv.nextLv}${rb('まで')}　${rb('あと')} ${gv.remain} EXP`;
    const gSub = gv.sub ? (gv.sub.type === 'next' ? `Lv${gv.sub.lv}${rb('で')} ${rb(D.SKILLS[gv.sub.skill].ruby)}${rb('を{覚|おぼ}える')}` : rb('この{職業|しょくぎょう}の{技|わざ}をすべて{習得|しゅうとく}！')) : '';
    const gauge = gv.capped ? '' : `<div class="rw-bar" id="rwBar" role="progressbar" aria-label="${esc(jd.name)} Lv${gv.nextLv}まで" aria-valuemin="0" aria-valuemax="${gv.need}" aria-valuenow="${gv.into}"><i style="width:${(gv.ratio * 100).toFixed(2)}%"></i></div>`;
    const advUp = gv.advUp ? `<div class="rw-advup">${rb('{冒険者|ぼうけんしゃ}')} Lv${gv.advUp.from} → <b>Lv${gv.advUp.to}</b></div>` : '';
    const newSk = res.newSkills.length ? `<div class="rw-new"><span>${rb('{新|あたら}しい{技|わざ}')}：${res.newSkills.map(id => rb(D.SKILLS[id].ruby)).join('、')}</span><button class="rw-mini" id="rwSkill">${rb('{技|わざ}を{見|み}る')}</button></div>` : '';
    const sc = `<div class="rw-sc"><small>${rb('{基本|きほん}')}</small><b>${res.C} / ${res.N}</b></div>` + (res.R > 0 ? `<div class="rw-sc rv"><small>${rb('{追加復習|ついかふくしゅう}')}</small><b>${rb('{成功|せいこう}')} ${res.R}${rb('{件|けん}')}</b></div>` : '');
    return `
    <div class="rw rw3" id="rwRoot" data-outcome="${res.outcome}">
      <header class="rw-head"><div class="rw-title">${rb('10{問|もん}おつかれさま！')}</div></header>
      <div class="rw-stage"><div class="rw-scene"><canvas id="rwCanvas"></canvas><div class="rw-cap" id="rwCap">${cap}</div></div></div>
      <main class="rw-body" id="rwBody">
      <div class="rw-panel">
        <div class="rw-score2" aria-label="正解数">${sc}</div>
        <div class="rw-row"><span>★ ${rb('{経験値|けいけんち}')}</span><b>+${res.xp}</b>${badge ? `<i class="rw-badge">${badge}</i>` : ''}</div>
        <div class="rw-row"><span>● ${rb('コイン{合計|ごうけい}')}</span><b id="rwTotal">+${tot.total}</b></div><div class="rw-coinnote" id="rwCoinNote" ${tot.chestCoin ? '' : 'hidden'}>${tot.chestCoin ? `（${rb('{宝箱|たからばこ}')}のコイン +${tot.chestCoin} を${rb('{含|ふく}')}む）` : ''}</div>
        <div class="rw-job" id="rwJob"><div class="rw-jobt"><span id="rwJobL">${lvTxt}</span><span id="rwJobR">${gRight}</span></div>${gauge}${gSub ? `<div class="rw-jobsub" id="rwJobSub">${gSub}</div>` : ''}${advUp}</div>
        ${newSk}
        ${res.drops.map(d => `<div class="rw-row sm"><span>${esc(d.name)} ×${d.n}${d.thief ? '（宝の気配）' : ''}${res.firstClear ? '（初回報酬）' : ''}</span></div>`).join('')}
      </div>
      <div class="rw-more3"><button class="rw-mini" id="rwDetail">${rb('{内訳|うちわけ}')}</button>${hasWrong ? `<button class="rw-mini" id="rwWrong" aria-haspopup="dialog">${rb('{間違|まちが}えた{問題|もんだい}')}</button>` : ''}<button class="rw-mini" id="rwEquip">${rb('{装備|そうび}を{見|み}る')}</button></div>
      ${chest ? chestCardHtml(chest, true) : ''}
      ${clearHtml(res)}
      ${RPG.noticeHtml()}
      ${res.mainClear ? '<button class="rw-link" id="rwEnding">エンディングを見る</button>' : ''}
      <div id="rwWrongSrc" hidden>${wrongHtml}</div>
      </main>
      <footer class="rw-foot"><div class="rw-btns"><button class="rw-btn" id="end">おわる</button><button class="rw-btn" id="more">${rb('{次|つぎ}の10{問|もん}')}</button></div></footer>
    </div>`;
  };
  function drawChestCv(cv, open, p) {   // 開封の演出：ゆれる→ふたがひらく→光
    const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height);
    const dx = !open && p ? Math.round(Math.sin(p * 40) * 1) : 0;
    const img = SP.IMGS['chest_morning_' + (open ? 'open' : 'closed')];
    if (img) SP.drawChest(g, cv.width / 2 - 6 + dx, cv.height - 2, !!open, 'morning'); else SP.drawChest(g, 6 + dx, 13, !!open);
    if (open && !img) { g.fillStyle = '#fff3a0'; [[3, 2], [20, 3], [11, 0], [16, 1], [7, 1]].forEach(a => { if (p === 1 || ((a[0] * 7 + Math.floor(p * 10)) % 3)) g.fillRect(a[0], a[1], 1, 1); }); }
  }
  RPG.bindReward = function (res) {
    snd(res.adv.lvTo > res.adv.lvFrom || res.job.lvTo > res.job.lvFrom ? 'level' : 'reward');
    const enb = root.document.getElementById('rwEnding'); if (enb) enb.onclick = () => { if (RPG.open) RPG.open('ending', { from: 'result' }); };
    bindChestCard(root.document.getElementById('rwDrop'), c => {   // 開けたら、コイン行を合算の1行に更新（開封前は箱のコインを足さない）
      const t = C.rewardTotals(res, c), el = root.document.getElementById('rwTotal'), nt = root.document.getElementById('rwCoinNote');
      if (el) el.textContent = '+' + t.total; if (nt && t.chestCoin) { nt.innerHTML = '（' + rb('{宝箱|たからばこ}') + 'のコイン +' + t.chestCoin + ' を' + rb('{含|ふく}') + 'む）'; nt.hidden = false; }
    });
    const eqb = root.document.getElementById('rwEquip'); if (eqb) eqb.onclick = () => { if (RPG.open) RPG.open('equip', { from: 'result' }); };
    const sheet = (title, html, name) => RPG.openSheet ? RPG.openSheet(title, html, name) : null;
    const det = root.document.getElementById('rwDetail'); if (det) det.onclick = () => {
      const ch = res.chestId ? C.chestById(RPG.save, res.chestId) : null, t = C.rewardTotals(res, ch);
      const L = [['学習', res.coinAnswers], ['討伐', res.coinKill], ['最初のお祝い', res.coinWelcome]].filter(x => x[1]).map(x => `<div class="rw-row sm"><span>${x[0]}</span><b>+${x[1]}</b></div>`).join('');
      sheet(rb('{内訳|うちわけ}'), `<div class="rw-h">● コイン +${t.total}</div>${L}${t.chestCoin ? `<div class="rw-row sm"><span>${rb('{宝箱|たからばこ}')}</span><b>+${t.chestCoin}</b></div>` : ''}<div class="rw-row sm"><span>★ ${rb('{経験値|けいけんち}')}</span><b>+${res.xp}</b></div><p class="rw-note">${res.xpMult > 1 ? `${rb('{経験値|けいけんち}')} ${res.xpBase} × ${res.xpMult}` : ''}</p>${res.drops.map(d => `<div class="rw-row sm"><span>${esc(d.name)}</span><b>×${d.n}</b></div>`).join('')}`, 'rwdetail');
    };
    const sk = root.document.getElementById('rwSkill'); if (sk) sk.onclick = () => {
      const lv = res.job.lvTo, L = res.newSkills.map(id => { const k = D.SKILLS[id]; return `<div class="rw-row sm"><span><b>${rb(k.ruby || k.name)}</b><br><small>${esc(M.skillText(k, lv))}</small></span></div>`; }).join('');
      sheet(rb('{新|あたら}しい{技|わざ}'), L, 'rwskill');
    };
    const w = root.document.getElementById('rwWrong'), src = root.document.getElementById('rwWrongSrc');
    if (w && src) w.onclick = () => {
      const b = sheet(rb('{間違|まちが}えた{問題|もんだい}'), src.innerHTML, 'rwwrong'); if (!b) return;
      const ag = b.querySelector('#again'); if (ag) ag.onclick = () => { if (root.__again) root.__again(); };
    };
    const c = root.document.getElementById('rwCanvas'); if (!c) return;
    // 上部は背景と主人公だけ。継続のときだけ生きている敵が並ぶ（攻撃演出・宝箱は置かない）
    const paint = () => {
      const cssW = c.parentNode.clientWidth, k = 3; c.width = Math.ceil(cssW / k) * k; c.height = 150;
      const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); const lw = c.width / k, lh = c.height / k;
      const rg = res.bg || D.ENEMIES[res.enemy.id].region;
      const gy2 = Math.round(lh * 0.88 / 2), cx = Math.round(lw / 4), cont = res.outcome === 'continue';
      SP.drawBackground(g, lw, lh, rg, 'reward');
      g.save(); g.scale(2, 2);
      const sv = RPG.save, job = res.job.id;
      SP.drawHeroLayered(g, { job, costume: M.costumeOf(sv, job), weaponId: M.artWeapon(job, sv.equip.weapon), use: 'reward', pose: res.outcome === 'victory' ? 'win' : 'ready', x: cont ? cx - 13 : cx, groundY: gy2 });
      if (cont) {
        const eim = SP.IMGS['enemy_' + res.enemy.id], k6 = 6; let ex2 = cx + 8, sc = 1;
        if (eim && eim.width > 0) { const room = c.width - 8 - 143; sc = fitScale(eim, room, 0); const half = eim.width * sc / 2; ex2 = Math.min(ex2, (c.width - 8 - half) / k6 - 7); }
        SP.drawEnemy(g, res.enemy.id, res.enemy.boss, ex2, gy2, { img: 'reward', scale: sc });
      }
      g.restore();
    };
    paint(); rewardRedraw = paint;
  };
  let rewardRedraw = null;
  SP.onUpdate(() => { try { if (rewardRedraw) rewardRedraw(); if (ctx) drawStrip(); } catch (e) {} });

  // ---------- ホームの「ゲームのデータ」 ----------
  RPG.homeHtml = function () {
    const note = RPG.progressNote();
    return `${note ? `<div class="rpg-note">冒険 ${note.n} / ${note.unit} 問（続きから）</div>` : ''}
    <details class="rpg-bk"><summary>ゲームのデータ（バックアップ）</summary>
      <p>書き出すと、学習の記録・選んだ設定・冒険の進みを 1つのファイルにできます。<b>送る準備の記録（送信キュー）と端末の IDは含みません。</b>クラウドには保存されません。他の端末との自動同期はありません。</p>
      <div class="rpg-bkb"><button id="rpgExport">書き出す</button><label class="rpg-file">読み込む<input id="rpgImport" type="file" accept=".json,application/json"></label></div>
      <div id="rpgBkMsg" role="status"></div>
    </details>`;
  };
  RPG.bindHome = function () {
    const ex = root.document.getElementById('rpgExport'), im = root.document.getElementById('rpgImport'), msg = root.document.getElementById('rpgBkMsg');
    if (!ex) return;
    ex.onclick = () => {
      try {
        const get = k => { try { return JSON.parse(root.localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
        const txt = C.buildExport({ stats: get('ichimon.stats.v1') || {}, sel: get('ichimon.sel.v1'), rpg: RPG.ok ? RPG.save : get(C.LS_RPG) }, NOW());
        const a = root.document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = 'ichimon-save-' + new Date().toISOString().slice(0, 10) + '.json';
        root.document.body.appendChild(a); a.click(); a.remove(); msg.textContent = '書き出しました（ダウンロードを見てね）。';
      } catch (e) { msg.textContent = '書き出せませんでした。'; }
    };
    im.onchange = () => {
      const f = im.files && im.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const p = C.parseImport(String(r.result));
        if (!p.ok) { msg.textContent = '読み込めません：' + p.err[0] + '（何も変えていません）'; return; }
        if (!root.confirm('今の記録をバックアップしてから、ファイルの内容に入れ替えます。よいですか？')) { msg.textContent = 'キャンセルしました。'; return; }
        const res = C.applyImport(String(r.result), RPG.io || { get: k => root.localStorage.getItem(k), set: (k, v) => root.localStorage.setItem(k, v) }, NOW());
        if (!res.ok) { msg.textContent = 'うまくいきませんでした（何も変えていません）。'; return; }
        msg.textContent = '読み込みました。ページを読み込みなおします。'; setTimeout(() => root.location.reload(), 600);
      };
      r.readAsText(f);
    };
  };

  // 学習を止めないための保険：RPG側で例外が出たら RPG を止め、学習はそのまま続ける
  const FALL = { beforeStart: l => ({ list: l, reviews: [], reask: 0, rpg: false }), stripHtml: () => '', homeHtml: () => '', afterSession: () => null, queueReview: () => true };
  Object.keys(FALL).concat(['onAnswer', 'mount', 'unmount', 'bindHome', 'bindReward', 'play', 'rewardHtml']).forEach(k => {
    const f = RPG[k];
    RPG[k] = function () { try { return f.apply(RPG, arguments); } catch (e) { RPG.ok = false; RPG.err = 'crash'; if (root.console) console.error('RPG', k, e); return FALL[k] ? FALL[k].apply(null, arguments) : undefined; } };
  });
  RPG.init();
})(typeof self !== 'undefined' ? self : this);
