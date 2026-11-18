'use strict';
// 画面側：下端の冒険帯・結果（報酬）画面・保存の失敗表示・バックアップ。app.js から window.RPG 経由で呼ばれる
(function (root) {
  const D = root.RPGData, C = root.RPGCore, A = root.RPGAdv, M = root.RPGMeta, SP = root.RPGSprites, FXL = root.RPGFX;
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const rb = s => (typeof root.ruby === 'function' ? root.ruby(s) : esc(s.replace(/\{([^|{}]+)\|([^{}]+)\}/g, '$1')));
  const reduceMotion = () => { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const PARAMS = new URLSearchParams(root.location ? root.location.search : '');
  const NOW = () => (root.__RPG_NOW ? root.__RPG_NOW() : Date.now());

  const RPG = { ok: false, save: null, store: null, err: null, errDetail: null, deferred: [], scene: { walk: 0 }, assets: {} };
  root.RPG = RPG;

  // ---------- 起動 ----------
  RPG.init = function () {
    if (PARAMS.get('rpg') === '0') { RPG.err = 'off'; return; }   // 動作確認用：RPG を切って学習だけ動かす
    const io = { get: k => root.localStorage.getItem(k), set: (k, v) => root.localStorage.setItem(k, v) };
    RPG.io = io; RPG.store = C.makeStore(io);
    const r = RPG.store.load(NOW());
    RPG.save = M.ensure(r.save);
    if (!r.ok) { RPG.err = r.err; RPG.errDetail = r.detail || null; RPG.ok = false; return; }
    RPG.ok = true;
    try { if (FXL) setTimeout(() => FXL.load(), 400); } catch (e) {}   // 技の動くエフェクトは後から読む（失敗しても静止画・コード描画で動く）
    if (r.fresh) { const w = RPG.store.save(RPG.save); if (!w.ok) { RPG.ok = false; RPG.err = w.err; } }
    fetch('rpg/ASSET_MANIFEST.json', { cache: 'no-cache' }).then(x => x.json()).then(m => { (m.assets || []).forEach(a => { if (a.status === '正式' && a.path) RPG.assets[a.id] = a; }); SP.loadImages(RPG.assets, () => { try { if (ctx) drawStrip(); } catch (e) {} }); }).catch(() => {});
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
      storage: 'この端末では ぼうけんの きろくを ほぞんできません。<b>がくしゅうは そのまま つかえます</b>。「ゲームのデータ」から かきだして のこしてね。',
      corrupt: 'ぼうけんの データが よみこめません（がくしゅうは つかえます）。',
      stale: 'ほかの 画面で ぼうけんが すすんでいます。この 画面を よみこみなおしてね。'
    }[RPG.err] || '';
    return m ? `<div class="rpg-notice" role="alert">${m}</div>` : '';
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
    const hero = r.events.filter(e => e.t !== 'enemy'), enemy = r.events.filter(e => e.t === 'enemy');
    RPG.deferred = RPG.deferred.concat(enemy);
    if (hero.length) RPG.play(hero);
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
  const SCALE = 2;   // 論理1ドット = CSS 2px
  RPG.stripHtml = function (S) { return S && S.rpg && RPG.ok ? '<div class="rpg-strip" aria-hidden="true"><canvas></canvas></div>' : ''; };
  let cv = null, ctx = null, W = 0, H = 0, raf = 0, anim = null;
  function sceneInfo() {
    const a = RPG.save.active; if (!a) return null;
    const b = a.battle, ed = D.ENEMIES[a.enemyId];
    return { job: b.hero.job, region: a.route.bg || D.REGIONS[a.route.region].id, outfit: M.costumeColor(RPG.save), enemyId: ed.id, boss: ed.boss, status: b.status, guard: !!(b.hero.guard && b.hero.guard.left > 0) };
  }
  const REWARD_FXS = 2;   // 報酬画面：エフェクト1ドット＝canvas 2px（主人公画像のドットと同程度）。整数倍・補間なし
  const STRIP_FXS = 1, STRIP_DS = 2;   // 帯：2×2ドットを1つにまとめ、1ドット＝canvas 1px（帯の主人公のドットと同じ）。整数倍・補間なし   // 帯：エフェクト1ドット＝帯の0.3ドット（小さく控えめ）。報酬画面は REWARD_FXS
  const fxLive = [];
  // 画像が枠（CSS px）に収まらないとき、縮小率を返す（収まるなら1）。192pxボスの帯・報酬画面用
  function fitScale(im, maxW, maxH) { if (!im) return 1; return Math.min(1, maxW ? maxW / im.width : 1, maxH ? maxH / im.height : 1); }
  function drawStrip(o) {
    if (!ctx) return; o = o || {};
    const si = sceneInfo(); if (!si) return;
    ctx.clearRect(0, 0, W, H); SP.drawBackground(ctx, W, H, si.region, 'strip');
    const gy = H - 2, hx = 8 + Math.min(RPG.scene.walk, 8) * 6 + (o.heroDx || 0), ex = W - 26 + (o.enemyDx || 0);
    const heroTint = si.status === 'retreat' ? '#8a90a8' : (o.heroFlash ? '#ff9aa0' : null);
    SP.drawHero(ctx, si.job, hx, gy, { img: 'strip', pose: o.heroFlash ? 'hit' : o.heroPose, tint: heroTint, guard: o.guard || si.guard, outfit: si.outfit });
    if (si.status !== 'won') SP.drawEnemy(ctx, si.enemyId, si.boss, ex, gy, { img: 'strip', tint: o.enemyFlash ? '#fff' : null, scale: fitScale(SP.IMGS['enemy_' + si.enemyId + '_strip'], 0, 40) });
    if (o.still) { const im = SP.IMGS['fx_' + o.still.kind + '_strip']; if (im) { ctx.save(); ctx.globalAlpha = 0.9; ctx.imageSmoothingEnabled = false; const k = ctx.getTransform().a || 1, w = im.width / k, h = im.height / k, cx = o.still.hero ? hx + 7 : ex + 7; ctx.drawImage(im, cx - w / 2, gy - h - 2, w, h); ctx.restore(); } }
    fxLive.forEach(f => { if (f.started()) f.blit(ctx, f.at === 'hero' ? hx + 7 : f.at === 'melee' ? ex - 10 : ex + 7, f.at === 'enemy' ? gy - 6 : gy, STRIP_FXS, 1, STRIP_DS); });
    if (o.slash) { SP.px(ctx, hx + 16, gy - 12, '#fff', 2); SP.px(ctx, hx + 18, gy - 10, '#ffe27a', 2); SP.px(ctx, hx + 20, gy - 8, '#fff', 2); }
    if (o.heal) { SP.px(ctx, hx + 5, gy - 18, '#5be08a', 1); SP.px(ctx, hx + 4, gy - 17, '#5be08a', 3); SP.px(ctx, hx + 5, gy - 16, '#5be08a', 1); }
  }
  RPG.mount = function () {
    cv = root.document.querySelector('.rpg-strip canvas'); ctx = null; if (!cv) return;
    const box = cv.parentNode; const cssW = Math.max(100, cv.clientWidth || box.clientWidth);
    W = Math.ceil(cssW / SCALE); H = Math.round((cv.clientHeight || 44) / SCALE) || 22;
    cv.width = W * SCALE; cv.height = H * SCALE; ctx = cv.getContext('2d'); ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    drawStrip();
    const inp = root.document.getElementById('ans');   // 入力問題：キーボード表示中は帯を隠す
    if (inp) { inp.addEventListener('focus', () => { box.hidden = true; }); inp.addEventListener('blur', () => { box.hidden = false; }); }
    if (RPG.deferred.length) { const d = RPG.deferred; RPG.deferred = []; setTimeout(() => RPG.play(d), 120); }
  };
  RPG.unmount = function () { cancelAnimationFrame(raf); cv = ctx = null; anim = null; fxLive.length = 0; };
  // 出来事を短く再生。演出は計算結果に影響しない（省略しても同じ）
  const snd = n => { try { if (RPG.sound) RPG.sound.play(n); } catch (e) {} };
  RPG.play = function (events) {
    events.forEach(e => { if (e.t === 'hero') snd(e.act === 'normal' ? 'attack' : 'skill'); else if (e.t === 'enemy' && e.dmg > 0) snd('hit'); });
    if (!ctx || !events.length) { if (events.some(e => e.t === 'explore')) RPG.scene.walk++; return; }
    const steps = [];
    events.forEach(e => {
      if (e.t === 'hero') {
        const key = e.act !== 'normal' && FXL ? FXL.keyFor(e.act) : null, job = RPG.save && RPG.save.active ? RPG.save.active.battle.hero.job : null;
        const st = { d: 360, key, f: p => {
          const r = { heroDx: p < .3 ? p / .3 * 8 : p < .6 ? 8 : (1 - (p - .6) / .4) * 8, enemyFlash: p > .3 && p < .6 && e.dmg > 0, heroPose: p > .2 && p < .7 ? 'attack' : null };
          if (!key) { r.slash = p > .25 && p < .55; r.heal = e.heal > 0 && p > .5; }
          else if (!st.played && p > .2 && p < .6) { const kind = FXL.stillOf(key), hero = (FXL.AT[key] === 'hero'); if (kind && SP.IMGS['fx_' + kind + '_strip']) r.still = { kind, hero }; else { r.slash = !hero; r.heal = hero && e.heal > 0; } }
          return r;
        } };
        st.spawn = () => {   // 帯では hit stop・画面ゆれは出さない（弱めるのではなく切る）
          const inst = FXL.spawn(key, { jobColor: job ? SP.JOB_COLOR[job] : null, cap: 0.9, delay: 0.08, light: 1 });
          if (inst) { st.played = true; fxLive.push(inst); }
        };
        steps.push(st);
      }
      else if (e.t === 'heal') steps.push({ d: 280, f: p => ({ heal: true }) });
      else if (e.t === 'enemy' && e.dmg > 0) steps.push({ d: 360, f: p => ({ enemyDx: p < .3 ? -p / .3 * 8 : p < .6 ? -8 : -(1 - (p - .6) / .4) * 8, heroFlash: p > .3 && p < .6, guard: e.reduced > 0 && p > .2 && p < .7 }) });
      else if (e.t === 'explore') {   // 回答の合間に冒険帯で歩く：前の位置から6px進みながら歩行ポーズ（8歩目以降はその場歩き）
        const adv = RPG.scene.walk < 8 ? 6 : 0; RPG.scene.walk++;
        steps.push({ d: 420, f: p => ({ heroDx: -adv * (1 - p), heroPose: 'walk' }) });
      }
    });
    if (reduceMotion() || !steps.length) { drawStrip(); return; }
    const t0 = performance.now(); let i = 0, start = t0, last = t0; cancelAnimationFrame(raf);
    const tick = now => {
      if (!ctx) return;
      const dt = Math.max(0, (now - last) / 1000); last = now;
      fxLive.forEach(f => f.update(dt)); for (let j = fxLive.length - 1; j >= 0; j--) if (fxLive[j].started() && fxLive[j].done()) fxLive.splice(j, 1);
      const st = steps[i];
      if (!st) { drawStrip(); if (fxLive.length) raf = requestAnimationFrame(tick); return; }
      if (!st.s) { st.s = 1; if (st.spawn) st.spawn(); }
      const p = Math.min(1, (now - start) / st.d); drawStrip(st.f(p));
      if (p >= 1) { i++; start = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  // ---------- 結果（報酬）画面 ----------
  function itemName(id) { const it = D.ITEMS[id]; return it ? it.name : id; }
  // 朝星の宝箱のカード（報酬画面とホームで共通）。中身は開封するまでDOMに出さない
  function chestContentHtml(c) {
    const r = c.result; if (!r) return '';
    let line = '';
    if (r.kind === 'rare') {
      const fx = M.effectText(r.item);
      line = r.dup ? `<b>${esc(itemName(r.item))}</b> が出た！<br><small>もう持っていたので ${esc(C.oreName(r.rank))} ×${r.ore} に交換</small>` : `<b>${esc(itemName(r.item))}</b> を手に入れた！${fx ? `<br><small>${esc(fx)}</small>` : ''}`;
    }
    else if (r.kind === 'mat') line = `${esc(C.oreName(r.rank))} ×${Object.values(r.mats)[0]} を手に入れた！`;
    else line = `コイン +${r.coin} と ${esc(C.oreName(r.rank))} ×${Object.values(r.mats)[0]} を手に入れた！`;
    return line;
  }
  function chestCardHtml(c) {
    const open = c.status === 'opened';
    return `<div class="rw-drop" id="rwDrop" data-chest="${esc(c.id)}"><div class="rw-chest">${rb('{朝星|あさぼし}の{宝箱|たからばこ}')}${c.legacy ? '（受取済み）' : ''}</div><canvas id="rwChestCv" class="rw-chestcv" aria-hidden="true"></canvas>${open ? '' : `<button class="rw-open" id="rwOpen">${rb('{宝箱|たからばこ}を{開|あ}ける')}</button>`}<div class="rw-dropline" id="rwChestLine" ${open ? '' : 'hidden'}>${open ? chestContentHtml(c) : ''}</div><div class="rw-chestmsg" id="rwChestMsg" role="status"></div></div>`;
  }
  // card 内の開封ボタンを動かす。保存（付与と opened を同時）が成功してから演出する。onDone(chest) は結果表示後
  function bindChestCard(card, onDone) {
    if (!card) return;
    const id = card.dataset.chest, ob = card.querySelector('#rwOpen'), cc = card.querySelector('#rwChestCv'), ln = card.querySelector('#rwChestLine'), msg = card.querySelector('#rwChestMsg');
    if (cc) { const hasImg = !!SP.IMGS.chest_morning_closed; cc.width = hasImg ? 64 : 24; cc.height = hasImg ? 52 : 14; cc.style.width = hasImg ? '128px' : '144px'; cc.style.height = hasImg ? '104px' : '84px'; drawChestCv(cc, !ob, 0); }
    if (!ob) return;
    ob.onclick = () => {
      if (ob.disabled) return; ob.disabled = true;
      if (!RPG.ok) { msg.textContent = 'いま ほぞんできないので あけられません。'; ob.disabled = false; return; }
      const r = C.openChestPersist(RPG.save, RPG.store, id, NOW());
      if (!r.ok) { RPG.err = r.err === 'stale' ? 'stale' : RPG.err; msg.textContent = 'ほぞんできなかったので あけていません。もういちど ためしてね。'; ob.disabled = false; return; }
      const fin = () => { drawChestCv(cc, true, 1); ln.innerHTML = chestContentHtml(r.chest); ln.hidden = false; ob.remove(); snd('chest'); onDone && onDone(r.chest); };
      if (reduceMotion() || !cc) { fin(); return; }
      const t0 = performance.now(); const tick = now => { const p = (now - t0) / 700; if (p >= 1) { fin(); return; } drawChestCv(cc, p > 0.45, p); requestAnimationFrame(tick); }; requestAnimationFrame(tick);
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
    if (c.trial) L.push('<b>しれん クリア！</b> ' + (c.trial === 'wing' ? '天翔騎士' : '星詠み') + 'に てんしょくできる ように なった');
    else L.push('<b>' + esc(res.quest.name) + ' クリア！</b>');
    if (c.title) L.push('しょうごう「' + esc(c.title) + '」');
    if (c.costume) L.push('いしょう「' + esc(c.costume) + '」');
    if (c.item) L.push('ひきょうの たから「' + esc(itemName(c.item)) + '」');
    if (c.lamp) L.push('夜明けの 灯 を てにいれた');
    return '<div class="rw-clear">' + L.map(x => '<div>' + x + '</div>').join('') + '</div>';
  }
  RPG.rewardHtml = function (res, S, wrongHtml, hasWrong) {
    const e = res.enemy, chest = res.chestId ? C.chestById(RPG.save, res.chestId) : null, tot = C.rewardTotals(res, chest);
    const cap = res.outcome === 'victory' ? rb(`${e.name}を{倒|たお}した！`) : res.outcome === 'continue' ? rb('{今日|きょう}はここまで。{続|つづ}きから{挑|いど}めます') : rb('{街|まち}に{戻|もど}りました。{取|と}り{組|く}んだ{分|ぶん}の{報酬|ほうしゅう}を{受|う}け{取|と}ろう');
    const badge = res.slot.no === 1 ? '初回ボーナス ×3' : res.slot.no === 2 ? '2回目ボーナス ×2' : '';
    const jd = D.JOBS[res.job.id], jl = C.jobLevel(res.job.id, RPG.save.jobXp[res.job.id]), nx = res.job.next;
    const pct = jl.capped ? 100 : Math.round(jl.into / jl.need * 100);
    const lvTxt = res.job.lvTo > res.job.lvFrom ? `${esc(jd.name)} Lv${res.job.lvFrom} → <b>Lv${res.job.lvTo}</b>` : `${esc(jd.name)} Lv${res.job.lvTo}`;
    const newSk = res.newSkills.length ? `<div class="rw-new">${rb('{新|あたら}しい{技|わざ}')}：${res.newSkills.map(id => rb(D.SKILLS[id].ruby)).join('、')}</div>` : '';
    const adv = res.adv.lvTo > res.adv.lvFrom ? `<div class="rw-row sm">${rb('{冒険者|ぼうけんしゃ}')} Lv${res.adv.lvFrom} → <b>Lv${res.adv.lvTo}</b></div>` : '';
    const coinNote = [res.coinAnswers ? `学習 ${res.coinAnswers}` : '', res.coinKill ? `討伐 ${res.coinKill}` : '', res.coinWelcome ? `はじめのお祝い ${res.coinWelcome}` : ''].filter(Boolean).join(' ＋ ');
    return `
    <div class="rw" id="rwRoot" data-outcome="${res.outcome}">
      <div class="rw-title">${rb('{冒険|ぼうけん}の{成果|せいか}')}</div>
      <div class="rw-place">${esc(res.region)}・${esc(res.route.point)}</div>
      <div class="rw-scene"><canvas id="rwCanvas"></canvas><div class="rw-cap" id="rwCap">${cap}</div></div>
      <div class="rw-panel">
        <div class="rw-score">${rb('{正解|せいかい}')} <b>${res.C} / ${res.N}</b></div>
        <div class="rw-sub">${rb('{復習|ふくしゅう}')}成功 ${res.R}件</div>
        ${hasWrong ? `<button class="rw-link" id="rwWrong" aria-expanded="false">▶ ${rb('{間違|まちが}えた{問題|もんだい}を{見|み}る')}</button><div id="rwWrongBox" hidden>${wrongHtml}</div>` : ''}
        <div class="rw-row"><span>★ ${rb('{経験値|けいけんち}')}</span><b>+${res.xp}</b>${badge ? `<i class="rw-badge">${badge}</i>` : ''}</div>
        <div class="rw-row"><span>● コイン（学習・討伐）</span><b id="rwCoinBase">+${tot.base}</b></div>
        <div class="rw-note">${esc(coinNote)}</div>
        <div class="rw-row rw-total"><span>今回のコイン</span><b id="rwTotal">${esc(tot.text)}</b></div>
        <div class="rw-job"><div class="rw-jobt"><span>${lvTxt}</span><span>${jl.capped ? 'Lv上限' : nx ? `次の${rb('{技|わざ}')}まで あと ${Math.max(0, nx.remain)}` : '全て覚えた'}</span></div><div class="rw-bar"><i style="width:${pct}%"></i></div></div>
        ${newSk}${adv}
        ${res.drops.map(d => `<div class="rw-row sm">${esc(d.name)} ×${d.n}${d.thief ? '（宝の気配）' : ''}${res.firstClear ? '（初回報酬）' : ''}</div>`).join('')}
      </div>
      ${chest ? chestCardHtml(chest) : ''}
      ${clearHtml(res)}
      ${RPG.noticeHtml()}
      <div class="rw-btns"><button class="rw-btn" id="end">おわる</button><button class="rw-btn" id="more">${rb('{次|つぎ}の10{問|もん}')}</button></div>
      <button class="rw-link" id="rwEquip">${rb('{装備|そうび}を{見|み}る')}</button>
      ${res.mainClear ? '<button class="rw-link" id="rwEnding">エンディングを みる</button>' : ''}
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
    bindChestCard(root.document.getElementById('rwDrop'), c => {
      const t = C.rewardTotals(res, c), el = root.document.getElementById('rwTotal'); if (el) el.textContent = t.text;
    });
    const eqb = root.document.getElementById('rwEquip'); if (eqb) eqb.onclick = () => { if (RPG.open) RPG.open('equip', { from: 'result' }); };
    const w = root.document.getElementById('rwWrong'), box = root.document.getElementById('rwWrongBox');
    if (w) w.onclick = () => { const o = box.hidden; box.hidden = !o; w.setAttribute('aria-expanded', String(o)); w.innerHTML = (o ? '▼ ' : '▶ ') + rb('{間違|まちが}えた{問題|もんだい}を{見|み}る'); };
    const c = root.document.getElementById('rwCanvas'); if (!c) return;
    // 上部は背景と主人公だけ。継続のときだけ生きている敵が並ぶ（攻撃演出・宝箱は置かない）
    const cssW = c.parentNode.clientWidth, k = 3; c.width = Math.ceil(cssW / k) * k; c.height = Math.round(c.width * 0.66 / k) * k;
    const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); const lw = c.width / k, lh = c.height / k;
    const rg = res.bg || D.ENEMIES[res.enemy.id].region;
    const gy2 = Math.round(lh * 0.88 / 2), cx = Math.round(lw / 4), cont = res.outcome === 'continue';
    SP.drawBackground(g, lw, lh, rg, 'reward');
    g.save(); g.scale(2, 2);
    SP.drawHero(g, res.job.id, cont ? cx - 20 : cx - 7, gy2, { img: 'reward', pose: res.outcome === 'victory' ? 'win' : 'ready', outfit: M.costumeColor(RPG.save) });
    if (cont) {
      const eim = SP.IMGS['enemy_' + res.enemy.id], k6 = 6; let ex2 = cx + 8, sc = 1;
      if (eim && eim.width > 0) { const room = c.width - 8 - 143; sc = fitScale(eim, room, 0); const half = eim.width * sc / 2; ex2 = Math.min(ex2, (c.width - 8 - half) / k6 - 7); }
      SP.drawEnemy(g, res.enemy.id, res.enemy.boss, ex2, gy2, { img: 'reward', scale: sc });
    }
    g.restore();
  };

  // ---------- ホームの「ゲームのデータ」 ----------
  RPG.homeHtml = function () {
    const note = RPG.progressNote();
    return `${note ? `<div class="rpg-note">ぼうけん ${note.n} / ${note.unit} もん（つづきから）</div>` : ''}
    <details class="rpg-bk"><summary>ゲームのデータ（バックアップ）</summary>
      <p>かきだすと、がくしゅうの きろく・えらんだ設定・ぼうけんの すすみ を 1つの ファイルにできます。<b>おくる じゅんびの きろく（そうしんキュー）と たんまつの IDは ふくみません。</b>クラウドには ほぞんされません。ほかの たんまつとの 自動どうきは ありません。</p>
      <div class="rpg-bkb"><button id="rpgExport">かきだす</button><label class="rpg-file">よみこむ<input id="rpgImport" type="file" accept=".json,application/json"></label></div>
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
        root.document.body.appendChild(a); a.click(); a.remove(); msg.textContent = 'かきだしました（ダウンロードを みてね）。';
      } catch (e) { msg.textContent = 'かきだせませんでした。'; }
    };
    im.onchange = () => {
      const f = im.files && im.files[0]; if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        const p = C.parseImport(String(r.result));
        if (!p.ok) { msg.textContent = 'よみこめません：' + p.err[0] + '（なにも かえていません）'; return; }
        if (!root.confirm('いまの きろくを バックアップしてから、ファイルの 内容に 入れかえます。よいですか？')) { msg.textContent = 'キャンセルしました。'; return; }
        const res = C.applyImport(String(r.result), RPG.io || { get: k => root.localStorage.getItem(k), set: (k, v) => root.localStorage.setItem(k, v) }, NOW());
        if (!res.ok) { msg.textContent = 'うまく いきませんでした（なにも かえていません）。'; return; }
        msg.textContent = 'よみこみました。ページを よみこみなおします。'; setTimeout(() => root.location.reload(), 600);
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
