'use strict';
// 画面側：下端の冒険帯・結果（報酬）画面・保存の失敗表示・バックアップ。app.js から window.RPG 経由で呼ばれる
(function (root) {
  const D = root.RPGData, C = root.RPGCore, A = root.RPGAdv, SP = root.RPGSprites;
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
    RPG.save = r.save;
    if (!r.ok) { RPG.err = r.err; RPG.errDetail = r.detail || null; RPG.ok = false; return; }
    RPG.ok = true;
    if (r.fresh) { const w = RPG.store.save(RPG.save); if (!w.ok) { RPG.ok = false; RPG.err = w.err; } }
    fetch('rpg/ASSET_MANIFEST.json', { cache: 'no-cache' }).then(x => x.json()).then(m => { (m.assets || []).forEach(a => { if (a.status === '正式' && a.path) RPG.assets[a.id] = a; }); }).catch(() => {});
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
    return { job: b.hero.job, region: D.REGIONS[a.route.region].id, enemyId: ed.id, boss: ed.boss, status: b.status, guard: !!(b.hero.guard && b.hero.guard.left > 0) };
  }
  function drawStrip(o) {
    if (!ctx) return; o = o || {};
    const si = sceneInfo(); if (!si) return;
    ctx.clearRect(0, 0, W, H); SP.drawBackground(ctx, W, H, si.region);
    const gy = H - 2, hx = 8 + Math.min(RPG.scene.walk, 8) * 6 + (o.heroDx || 0), ex = W - 26 + (o.enemyDx || 0);
    const heroTint = si.status === 'retreat' ? '#8a90a8' : (o.heroFlash ? '#ff9aa0' : null);
    SP.drawHero(ctx, si.job, hx, gy, { tint: heroTint, guard: o.guard || si.guard });
    if (si.status !== 'won') SP.drawEnemy(ctx, si.enemyId, si.boss, ex, gy, { tint: o.enemyFlash ? '#fff' : null });
    if (o.slash) { SP.px(ctx, hx + 16, gy - 12, '#fff', 2); SP.px(ctx, hx + 18, gy - 10, '#ffe27a', 2); SP.px(ctx, hx + 20, gy - 8, '#fff', 2); }
    if (o.heal) { SP.px(ctx, hx + 5, gy - 18, '#5be08a', 1); SP.px(ctx, hx + 4, gy - 17, '#5be08a', 3); SP.px(ctx, hx + 5, gy - 16, '#5be08a', 1); }
  }
  RPG.mount = function () {
    cv = root.document.querySelector('.rpg-strip canvas'); ctx = null; if (!cv) return;
    const box = cv.parentNode; const cssW = Math.max(100, cv.clientWidth || box.clientWidth);
    W = Math.ceil(cssW / SCALE); H = Math.round((cv.clientHeight || 44) / SCALE) || 22;
    cv.width = W; cv.height = H; ctx = cv.getContext('2d');
    drawStrip();
    const inp = root.document.getElementById('ans');   // 入力問題：キーボード表示中は帯を隠す
    if (inp) { inp.addEventListener('focus', () => { box.hidden = true; }); inp.addEventListener('blur', () => { box.hidden = false; }); }
    if (RPG.deferred.length) { const d = RPG.deferred; RPG.deferred = []; setTimeout(() => RPG.play(d), 120); }
  };
  RPG.unmount = function () { cancelAnimationFrame(raf); cv = ctx = null; anim = null; };
  // 出来事を短く再生。演出は計算結果に影響しない（省略しても同じ）
  RPG.play = function (events) {
    if (!ctx || !events.length) { if (events.some(e => e.t === 'explore')) RPG.scene.walk++; return; }
    const steps = [];
    events.forEach(e => {
      if (e.t === 'hero') steps.push({ d: 360, f: p => ({ heroDx: p < .3 ? p / .3 * 8 : p < .6 ? 8 : (1 - (p - .6) / .4) * 8, slash: p > .25 && p < .55, enemyFlash: p > .3 && p < .6 && e.dmg > 0, heal: e.heal > 0 && p > .5 }) });
      else if (e.t === 'heal') steps.push({ d: 280, f: p => ({ heal: true }) });
      else if (e.t === 'enemy' && e.dmg > 0) steps.push({ d: 360, f: p => ({ enemyDx: p < .3 ? -p / .3 * 8 : p < .6 ? -8 : -(1 - (p - .6) / .4) * 8, heroFlash: p > .3 && p < .6, guard: e.reduced > 0 && p > .2 && p < .7 }) });
      else if (e.t === 'explore') RPG.scene.walk++;
    });
    if (reduceMotion() || !steps.length) { drawStrip(); return; }
    const t0 = performance.now(); let i = 0, start = t0; cancelAnimationFrame(raf);
    const tick = now => {
      if (!ctx) return;
      const st = steps[i]; if (!st) { drawStrip(); return; }
      const p = Math.min(1, (now - start) / st.d); drawStrip(st.f(p));
      if (p >= 1) { i++; start = now; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  };

  // ---------- 結果（報酬）画面 ----------
  function itemName(id) { const it = D.ITEMS[id]; return it ? it.name : id; }
  function chestHtml(res) {
    const c = res.chest; if (!c) return '';
    let line = '';
    if (c.kind === 'rare') line = c.dup ? `${esc(itemName(c.item))} が でた！（もっていたので ${esc(C.oreName(c.rank))} ×${c.ore} に）` : `<b>${esc(itemName(c.item))}</b> 手に入れた！`;
    else if (c.kind === 'mat') line = `${esc(C.oreName(c.rank))} ×${Object.values(c.mats)[0]} を 手に入れた！`;
    else line = `コイン +${c.coin} と ${esc(C.oreName(c.rank))} ×${Object.values(c.mats)[0]} を 手に入れた！`;
    return `<div class="rw-drop"><div class="rw-chest">朝星の宝箱</div><div class="rw-dropline">${line}</div></div>`;
  }
  RPG.rewardHtml = function (res, S, wrongHtml, hasWrong) {
    const e = res.enemy, hpPct = Math.max(1, Math.round(e.hpLeft / e.hpMax * 100));
    const cap = res.outcome === 'victory' ? `${esc(e.name)}を たおした！` : res.outcome === 'continue' ? `${esc(e.name)}との たたかいは つづく（のこり ${hpPct}%）` : `いったん ひきあげた。${esc(e.name)}は また こんど！`;
    const badge = res.slot.no === 1 ? '初回ボーナス ×3' : res.slot.no === 2 ? '2回目ボーナス ×2' : '';
    const jd = D.JOBS[res.job.id], jl = C.jobLevel(res.job.id, RPG.save.jobXp[res.job.id]), nx = res.job.next;
    const pct = jl.capped ? 100 : Math.round(jl.into / jl.need * 100);
    const lvTxt = res.job.lvTo > res.job.lvFrom ? `${jd.name} Lv${res.job.lvFrom} → <b>Lv${res.job.lvTo}</b>` : `${jd.name} Lv${res.job.lvTo}`;
    const newSk = res.newSkills.length ? `<div class="rw-new">あたらしい技：${res.newSkills.map(id => rb(D.SKILLS[id].ruby)).join('、')}</div>` : '';
    const adv = res.adv.lvTo > res.adv.lvFrom ? `<div class="rw-row sm">ぼうけん者 Lv${res.adv.lvFrom} → <b>Lv${res.adv.lvTo}</b></div>` : '';
    const coinNote = [res.coinAnswers ? `こたえ ${res.coinAnswers}` : '', res.coinKill ? `とうばつ ${res.coinKill}` : '', res.coinWelcome ? `はじめのおいわい ${res.coinWelcome}` : ''].filter(Boolean).join(' ＋ ');
    return `
    <div class="rw" id="rwRoot">
      <div class="rw-title">ぼうけんの成果</div>
      <div class="rw-place">${esc(res.region)}・${esc(res.route.point)}</div>
      <div class="rw-scene"><canvas id="rwCanvas"></canvas><div class="rw-cap">${cap}</div></div>
      <div class="rw-panel">
        <div class="rw-h">${res.N}もん おつかれさま！</div>
        <div class="rw-score">せいかい <b>${res.C} / ${res.N}</b></div>
        <div class="rw-sub">${res.R ? `ふくしゅう せいこう ${res.R}こ` : 'ふくしゅう せいこう 0こ'}</div>
        ${hasWrong ? '<button class="rw-link" id="rwWrong" aria-expanded="false">▶ まちがえた問題をみる</button><div id="rwWrongBox" hidden>' + wrongHtml + '</div>' : ''}
        <div class="rw-row"><span>★ 経験値</span><b>+${res.xp}</b>${badge ? `<i class="rw-badge">${badge}</i>` : ''}</div>
        <div class="rw-row"><span>● コイン</span><b>+${res.coin + (res.chest && res.chest.coin ? res.chest.coin : 0)}</b></div>
        <div class="rw-note">${esc(coinNote)}</div>
        <div class="rw-job"><div class="rw-jobt"><span>${lvTxt}</span><span>${jl.capped ? 'Lv上限' : nx ? `つぎの技まで あと ${Math.max(0, nx.remain)}` : 'ぜんぶ おぼえた'}</span></div><div class="rw-bar"><i style="width:${pct}%"></i></div></div>
        ${newSk}${adv}
        ${chestHtml(res)}
        ${res.drops.map(d => `<div class="rw-row sm">${esc(d.name)} ×${d.n}${d.thief ? '（宝の気配）' : ''}</div>`).join('')}
      </div>
      ${RPG.noticeHtml()}
      <div class="rw-btns"><button class="rw-btn" id="end">おわる</button><button class="rw-btn" id="more">つぎの10もん</button></div>
    </div>`;
  };
  RPG.bindReward = function (res) {
    const w = root.document.getElementById('rwWrong'), box = root.document.getElementById('rwWrongBox');
    if (w) w.onclick = () => { const o = box.hidden; box.hidden = !o; w.setAttribute('aria-expanded', String(o)); w.textContent = (o ? '▼ ' : '▶ ') + 'まちがえた問題をみる'; };
    const c = root.document.getElementById('rwCanvas'); if (!c) return;
    const cssW = c.parentNode.clientWidth, k = 3; c.width = Math.ceil(cssW / k); c.height = Math.round(c.width * 0.66);
    const g = c.getContext('2d'), rg = D.ENEMIES[res.enemy.id].region;
    SP.drawBackground(g, c.width, c.height, rg);
    const gy2 = Math.round(c.height * 0.88 / 2), cx = Math.round(c.width / 4);
    g.save(); g.scale(2, 2);   // キャラは2倍（仮絵）
    SP.drawHero(g, res.job.id, cx - 20, gy2, { tint: res.outcome === 'retreat' ? '#8a90a8' : null });
    if (res.outcome === 'victory') SP.drawChest(g, cx + 4, gy2, true);
    else SP.drawEnemy(g, res.enemy.id, res.enemy.boss, cx + 8, gy2, {});
    g.restore();
  };

  // ---------- ホームの「ゲームのデータ」 ----------
  RPG.homeHtml = function () {
    const note = RPG.progressNote(), n = RPG.noticeHtml();
    return `${n}${note ? `<div class="rpg-note">ぼうけん ${note.n} / ${note.unit} もん（つづきから）</div>` : ''}
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
