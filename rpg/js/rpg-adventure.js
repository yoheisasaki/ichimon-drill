'use strict';
// 冒険（10基本回答＋復習）の進行。セーブデータを直接更新する。回答イベントは rid で重複を弾く
(function (root, factory) {
  const isN = typeof module === 'object' && module.exports;
  const m = factory(isN ? require('./rpg-data.js') : root.RPGData, isN ? require('./rpg-core.js') : root.RPGCore, isN ? require('./rpg-battle.js') : root.RPGBattle, isN ? require('./rpg-meta.js') : root.RPGMeta);
  if (isN) module.exports = m; else root.RPGAdv = m;
})(typeof self !== 'undefined' ? self : this, function (D, C, B, M) {
  const UNIT = C.ADV_UNIT, EVENT_KEEP = 80;

  function routeAt(step) { return D.ROUTE[Math.min(step, D.ROUTE.length - 1)]; }
  function currentRoute(save) { const r = routeAt(save.progress.step); return Object.assign({ rematch: save.progress.step >= D.ROUTE.length }, r); }

  // 戦闘に使う職・装備・技・作戦（冒険の開始時に固定）
  function heroSnapshot(save) {
    const advLv = C.heroLevel(save.advXp).lv, jobs = C.jobLevels(save), job = save.job, jobLv = jobs[job];
    let skills = save.loadout.skills;
    if (!skills || B.validateLoadout(job, jobs, skills, jobs.warrior >= 5 || jobs.mage >= 5 || jobs.priest >= 5 || jobs.thief >= 5).length) skills = B.recommendLoadout(job, jobs);
    return { job, jobLv, advLv, equip: Object.assign({}, save.equip, { enh: { weapon: M.enhLv(save, save.equip.weapon), armor: M.enhLv(save, save.equip.armor), acc: M.enhLv(save, save.equip.acc) } }), skills, tactic: save.loadout.tactic };
  }
  function begin(save, ms) {
    if (save.active) return save.active;
    const r = currentRoute(save), snap = heroSnapshot(save), ed = D.ENEMIES[r.enemy];
    const hp = save.progress.enemyHp && save.progress.enemyHp.id === r.enemy ? save.progress.enemyHp.hp : null;
    const n = (save.stats.adventures || 0) + 1;
    save.active = {
      id: 'adv' + n + '-' + (ms || 0).toString(36), no: n, started: ms || 0, step: save.progress.step, route: { region: r.region, point: r.point, seg: r.seg, boss: r.boss, rematch: r.rematch },
      enemyId: r.enemy, hero: snap, slot: null, basic: { n: 0, c: 0 }, reviews: { ok: [], pending: [], used: 0 }, seq: 0, events: {},
      battle: B.newBattle(Object.assign({ enemyId: r.enemy, enemyStats: r.stats, enemyHp: hp }, snap))
    };
    M.onBegin(save);
    return save.active;
  }
  const remainingBasics = save => save.active ? Math.max(0, UNIT - save.active.basic.n) : UNIT;
  const canSettle = save => !!save.active && save.active.basic.n >= UNIT && save.active.reviews.pending.length === 0;

  // 回答を1つ適用。ev: {rid, kind:'basic'|'review', correct, origin?, qid}
  // 返り値: {events, origin, dup?, ignored?}
  function recordAnswer(save, ev, ms) {
    const a = begin(save, ms);
    if (ev.rid && a.events[ev.rid]) return { dup: true, events: [] };
    if (ev.kind === 'basic') {
      if (a.basic.n >= UNIT) return { ignored: true, events: [] };
      if (!a.slot) a.slot = C.reserveSlot(save, ms);
      a.basic.n++; if (ev.correct) a.basic.c++;
      var origin = a.id + ':b' + a.basic.n;
    } else {
      if (!ev.origin || !ev.origin.startsWith(a.id + ':')) return { ignored: true, events: [] };   // 手動の「もう1回」など：冒険に影響しない
      origin = ev.origin;
      if (ev.correct) { if (!a.reviews.ok.includes(origin)) a.reviews.ok.push(origin); a.reviews.pending = a.reviews.pending.filter(p => p.origin !== origin); }
    }
    const events = B.resolveAnswer(a.battle, { kind: ev.kind, correct: !!ev.correct });
    if (ev.rid) { a.events[ev.rid] = 1; const k = Object.keys(a.events); if (k.length > EVENT_KEEP) delete a.events[k[0]]; }
    a.seq++;
    return { events, origin, n: a.basic.n };
  }
  // 間違えた基本回答の復習を予約（最大5件／冒険）。許可されれば true
  function queueReview(save, origin, snap) {
    const a = save.active; if (!a || !origin.startsWith(a.id + ':')) return false;
    if (a.reviews.used >= C.REVIEW_MAX) return false;
    a.reviews.used++;
    if (!a.reviews.pending.some(p => p.origin === origin)) a.reviews.pending.push({ origin, snap });
    return true;
  }

  // 清算：一度だけ報酬を残高へ反映
  function settle(save, ms) {
    const a = save.active; if (!a) return save.lastResult || null;
    if (!canSettle(save)) return null;
    if (save.ledger.settled[a.id]) { save.active = null; return save.lastResult; }
    const N = a.basic.n, Cc = a.basic.c, R = a.reviews.ok.length, slot = a.slot;
    const { xpBase, coinBase } = C.rewardOf({ N, C: Cc, R });
    const xp = xpBase * slot.xpMult, coinAns = coinBase * slot.coinMult;
    const advBefore = C.heroLevel(save.advXp), jobBefore = C.jobLevel(a.hero.job, save.jobXp[a.hero.job]);
    if (!advBefore.capped) save.advXp += xp;
    if (!jobBefore.capped) save.jobXp[a.hero.job] += xp;
    const advAfter = C.heroLevel(save.advXp), jobAfter = C.jobLevel(a.hero.job, save.jobXp[a.hero.job]);
    const b = a.battle, outcome = B.outcome(b), ed = D.ENEMIES[a.enemyId], region = D.REGIONS.find(r => r.id === ed.region);
    let coin = coinAns, coinKill = 0, coinWelcome = 0; const drops = [];
    if (!save.welcomeDone) { save.welcomeDone = true; coinWelcome = C.WELCOME_COIN; coin += coinWelcome; }
    if (outcome === 'victory') {
      const first = ed.boss && !save.progress.bossKills[ed.id];
      coinKill = ed.boss ? (first ? region.coin : 30) : 15; coin += coinKill;
      if (ed.boss) { C.addMat(save, 'bm_' + region.id, 1); drops.push({ mat: 'bm_' + region.id, name: region.mat, n: 1 }); save.progress.bossKills[ed.id] = (save.progress.bossKills[ed.id] || 0) + 1; }
      else if (a.hero.job === 'thief' && a.hero.jobLv >= 3 && C.rngFrom(a.id + ':treasure')() < 0.2) { const r = C.maxRank(save); C.addMat(save, C.oreId(r), 1); drops.push({ mat: C.oreId(r), name: C.oreName(r), n: 1, thief: true }); }
    }
    save.coins += coin;
    if (outcome === 'victory') M.killEnemy(save, ed.id);
    // 道のり
    const route = D.ROUTE[Math.min(a.step, D.ROUTE.length - 1)];
    if (outcome === 'victory') {
      save.progress.enemyHp = null;
      if (a.step < D.ROUTE.length) {
        if (ed.boss) { if (!save.progress.clearedRegions.includes(region.id)) save.progress.clearedRegions.push(region.id); save.progress.step = D.REGION_START[route.region + 1]; }
        else save.progress.step = a.step + 1;
      }
    } else save.progress.enemyHp = { id: a.enemyId, hp: b.enemy.hp };
    // 宝箱（日次1・2枠。敗北でも付与）
    let chest = null;
    if (slot.chest) { const roll = C.rollChest(save, a.id + ':chest'); chest = C.applyChest(save, roll); chest.roll = roll; }
    const result = {
      id: a.id, outcome, enemy: { id: ed.id, name: ed.name, boss: ed.boss, hpLeft: b.enemy.hp, hpMax: b.enemy.maxHp }, region: region.name, route: a.route,
      N, C: Cc, R, xpBase, xpMult: slot.xpMult, xp, slot: { no: slot.no, key: slot.key }, coinAnswers: coinAns, coinKill, coinWelcome, coin,
      adv: { lvFrom: advBefore.lv, lvTo: advAfter.lv }, job: { id: a.hero.job, lvFrom: jobBefore.lv, lvTo: jobAfter.lv, next: C.nextSkill(a.hero.job, save.jobXp[a.hero.job]) },
      newSkills: D.SKILLS_OF[a.hero.job].filter(s => s.lv > jobBefore.lv && s.lv <= jobAfter.lv).map(s => s.id),
      drops, chest, hero: { hp: b.hero.hp, maxHp: b.hero.maxHp }, coinsAfter: save.coins, firstClear: outcome === 'victory' && ed.boss && save.progress.bossKills[ed.id] === 1
    };
    save.ledger.settled[a.id] = { xp, coin }; const ks = Object.keys(save.ledger.settled); while (ks.length > 30) delete save.ledger.settled[ks.shift()];
    save.lastResult = result; save.firstDone = true; save.stats.adventures = (save.stats.adventures || 0) + 1; save.active = null;
    return result;
  }
  return { UNIT, routeAt, currentRoute, heroSnapshot, begin, remainingBasics, canSettle, recordAnswer, queueReview, settle };
});
