'use strict';
// 街・装備・店・鍛冶・転職・技設定・外見・図鑑・実績のロジック（DOM非依存。セーブデータを直接更新する）
(function (root, factory) {
  const isN = typeof module === 'object' && module.exports;
  const m = factory(isN ? require('./rpg-data.js') : root.RPGData, isN ? require('./rpg-core.js') : root.RPGCore, isN ? require('./rpg-battle.js') : root.RPGBattle);
  if (isN) module.exports = m; else root.RPGMeta = m;
})(typeof self !== 'undefined' ? self : this, function (D, C, B) {
  const SELL_RATE = 0.25, ENH_COST_RATE = [0.20, 0.35, 0.50], ENH_ORE = [2, 4, 6];
  const SKIN = ['#f0c39a', '#f6d7b8', '#d9a77a', '#b97d56', '#8a5a3c'];
  const HAIR_COLOR = ['#7a4a2a', '#2a2a33', '#d9b04a', '#c9572e', '#6a8fd0', '#e8e8f0'];
  const FACE_N = 4, HAIR_N = 6, NAME_MAX = 8;

  // 古い保存データに足りない欄を補う（v1 のまま追加。既存の値は変えない）
  function ensure(s) {
    s.inv = s.inv || { items: {}, mats: {}, enhance: {} };
    s.inv.enhance = s.inv.enhance || {}; s.inv.fresh = s.inv.fresh || {}; s.inv.mats = s.inv.mats || {};
    s.codex = s.codex || { enemies: {}, items: {} }; s.codex.enemies = s.codex.enemies || {}; s.codex.items = s.codex.items || {};
    Object.keys(s.inv.items).forEach(id => { s.codex.items[id] = 1; });
    s.goal = s.goal || null; s.trials = s.trials || {}; s.seen = s.seen || {};
    s.look = s.look || { face: 0, hair: 0, skin: 0, hairColor: 0 };
    s.settings = s.settings || { sound: false, vibrate: false };
    return s;
  }

  // ---------- 装備の見た目の数値・効果文 ----------
  function enhLv(save, id) { return (save.inv.enhance && save.inv.enhance[id]) || 0; }
  function statOf(save, id) {   // 強化込みの攻撃/防御
    const it = D.ITEMS[id], lv = enhLv(save, id); if (!it) return {};
    return { atk: it.atk != null ? it.atk + D.enhBonus(it, lv) : undefined, def: it.def != null ? it.def + D.enhBonus(it, lv) : undefined, lv };
  }
  const pct = v => Math.round(v * 1000) / 10 + '%';
  function fxText(fx) {
    if (!fx) return '';
    const t = [];
    if (fx.hpPct) t.push('さいだいHP+' + pct(fx.hpPct));
    if (fx.reduce) t.push('受けるダメージ-' + pct(fx.reduce));
    if (fx.firstReduce) t.push('さいしょに受けるダメージ-' + pct(fx.firstReduce));
    if (fx.firstSkill) t.push('さいしょの攻撃技+' + pct(fx.firstSkill));
    if (fx.elemAdd) t.push('技のとき ' + D.EL_NAME[fx.elemAdd[0]] + '属性の追加ダメージ（' + fx.elemAdd[1] + '倍）');
    if (fx.healBonus) t.push('技の回復量+' + pct(fx.healBonus));
    if (fx.firstMulti) t.push('さいしょの連撃の合計+' + pct(fx.firstMulti));
    if (fx.firstHeal) t.push('さいしょの攻撃技でHP' + pct(fx.firstHeal) + '回復');
    if (fx.halfHeal) t.push('HPが半分いかになると 1回だけHP' + pct(fx.halfHeal) + '回復');
    return t.join('、');
  }
  const effectText = id => { const it = D.ITEMS[id]; if (!it) return ''; return it.fx ? fxText(it.fx) : (id === 'w_start' ? 'どの職業でも つかえる' : ''); };
  const CAT_NAME = { sword: 'つるぎ', staff: 'つえ', dagger: 'たんけん', bow: 'ゆみ', heavy: 'じゅうそう', light: 'けいそう', robe: 'ローブ', charm: 'おまもり', shieldorn: 'たてかざり', ring: 'ゆびわ', any: 'どれでも' };
  const SLOT_NAME = { weapon: 'ぶき', armor: 'ぼうぐ', acc: 'アクセサリー' };

  // ---------- 装備 ----------
  function canEquip(save, id, job) {
    const it = D.ITEMS[id]; if (!it) return '不明な装備';
    if (!save.inv.items[id]) return 'もっていない';
    if (it.slot === 'weapon' && it.cat !== 'any' && !D.JOBS[job || save.job].weapons.includes(it.cat)) return 'この職業では つかえない';
    return null;
  }
  // 装備の確定。冒険の途中は変えない
  function setEquip(save, eq) {
    if (save.active) return { ok: false, err: 'ぼうけんの途中は変えられない' };
    for (const slot of ['weapon', 'armor', 'acc']) {
      const id = eq[slot]; if (!id) continue;
      if (D.ITEMS[id].slot !== slot) return { ok: false, err: '場所がちがう' };
      const e = canEquip(save, id); if (e) return { ok: false, err: D.ITEMS[id].name + '：' + e };
    }
    ['weapon', 'armor', 'acc'].forEach(slot => { if (slot in eq) save.equip[slot] = eq[slot] || null; });
    return { ok: true };
  }
  function recommendEquip(save) { const o = {}; ['weapon', 'armor', 'acc'].forEach(s => { o[s] = C.bestOwned(save, s, save.job) || null; }); return o; }
  // 装備を比べた戦闘能力（表示用）。eq: {weapon,armor,acc}
  function statsWith(save, eq) {
    const enh = {}; ['weapon', 'armor', 'acc'].forEach(s => { enh[s] = eq[s] ? enhLv(save, eq[s]) : 0; });
    const jobs = C.jobLevels(save);
    return B.heroStats(C.heroLevel(save.advXp).lv, save.job, jobs[save.job], Object.assign({}, eq, { enh }));
  }

  // ---------- 店（買う・うる・かえす） ----------
  const sellPrice = id => Math.floor(D.ITEMS[id].price * SELL_RATE);
  function isEquipped(save, id) { return Object.values(save.equip).includes(id); }
  function buyChecked(save, id) {
    const r = C.buy(save, id); if (!r.ok) return r;
    save.inv.fresh[id] = D.ITEMS[id].price; save.codex.items[id] = 1; return r;
  }
  function canSell(save, id) {
    const it = D.ITEMS[id]; if (!it || !save.inv.items[id] || id === 'w_start') return '売れない';
    if (isEquipped(save, id)) return 'そうびちゅう';
    return null;
  }
  function sell(save, id) {
    const e = canSell(save, id); if (e) return { ok: false, err: e };
    const g = sellPrice(id); delete save.inv.items[id]; delete save.inv.fresh[id]; delete save.inv.enhance[id]; save.coins += g;
    return { ok: true, coin: g };
  }
  // 返品：買ってから、冒険に装備していない・強化していないものだけ。買った値段と同額
  function canRefund(save, id) { return !!(save.inv.fresh && save.inv.fresh[id] != null && save.inv.items[id] && !enhLv(save, id)); }
  function refund(save, id) {
    if (!canRefund(save, id)) return { ok: false, err: '返品できない' };
    if (save.active && Object.values(save.active.hero.equip).includes(id)) return { ok: false, err: 'ぼうけん中は返品できない' };
    const g = save.inv.fresh[id]; Object.keys(save.equip).forEach(s => { if (save.equip[s] === id) save.equip[s] = null; });
    delete save.inv.items[id]; delete save.inv.fresh[id]; save.coins += g;
    return { ok: true, coin: g };
  }
  // 冒険を始めるとき：装備していたものは「つかった」ことになり、返品できなくなる
  function onBegin(save) { ensure(save); Object.values(save.equip).forEach(id => { if (id) delete save.inv.fresh[id]; }); const e = save.active && D.ENEMIES[save.active.enemyId]; if (e) seeEnemy(save, e.id); }

  // ---------- 鍛冶（強化） ----------
  function enhanceInfo(save, id) {
    const it = D.ITEMS[id], lv = enhLv(save, id); const o = { lv, max: D.ENH_MAX };
    if (!it || !save.inv.items[id] || !it.rank || id === 'w_start') { o.err = 'きょうかできない'; return o; }
    if (lv >= D.ENH_MAX) { o.err = 'これいじょう きょうかできない'; return o; }
    o.coin = Math.round(it.price * ENH_COST_RATE[lv]); o.ore = ENH_ORE[lv]; o.oreId = C.oreId(it.rank); o.have = save.inv.mats[o.oreId] || 0;
    const nx = lv + 1; o.after = it.atk != null ? it.atk + D.enhBonus(it, nx) : it.def != null ? it.def + D.enhBonus(it, nx) : null;
    if (save.active) o.err = 'ぼうけんの途中は できない';
    else if (save.coins < o.coin) o.err = 'コインがたりない';
    else if (o.have < o.ore) o.err = 'こうせきがたりない';
    return o;
  }
  function enhance(save, id) {
    const i = enhanceInfo(save, id); if (i.err) return { ok: false, err: i.err };
    save.coins -= i.coin; save.inv.mats[i.oreId] -= i.ore; save.inv.enhance[id] = i.lv + 1; delete save.inv.fresh[id];
    return { ok: true, lv: i.lv + 1 };
  }

  // ---------- 転職・技設定 ----------
  function advInherit(save) { const j = C.jobLevels(save); return j.warrior >= 5 || j.mage >= 5 || j.priest >= 5 || j.thief >= 5; }
  function jobProgress(save, job) {
    const j = D.JOBS[job], lv = C.jobLevels(save), rows = [];
    if (j.tier === 'adv') j.req.forEach(r => rows.push({ text: D.JOBS[r].name + ' Lv10', now: lv[r], need: 10, done: lv[r] >= 10 }));
    else if (j.tier === 'top') {
      const have = j.reqFrom.filter(r => lv[r] >= 20).length;
      rows.push({ text: j.reqFrom.map(r => D.JOBS[r].name).join('・') + ' のうち2つが Lv20', now: have, need: 2, done: have >= 2, unit: 'つ' });
      rows.push({ text: (j.trial === 'wing' ? 'つばさ' : 'ほし') + 'のしれん（第2章のあとに ひらく予定。まだ ひらいていません）', now: 0, need: 1, done: !!(save.trials && save.trials[j.trial]), pending: true });
    }
    return rows;
  }
  function changeJob(save, job) {
    const e = C.canChangeJob(save, job); if (e) return { ok: false, err: e };
    if (save.job === job) return { ok: false, err: 'いま その職業です' };
    save.job = job; save.loadout.skills = null; const gifts = [];
    D.JOBS[job].weapons.forEach(cat => {   // 未所有の武器系統の支給（ランクI・通常品、無料）
      if (!Object.keys(save.inv.items).some(i => D.ITEMS[i].slot === 'weapon' && D.ITEMS[i].cat === cat)) { const id = `w_${cat}_1`; save.inv.items[id] = 1; save.codex.items[id] = 1; gifts.push(id); }
    });
    const w = C.bestOwned(save, 'weapon', job); if (w) save.equip.weapon = w;
    if (save.goal && save.goal.job === job) save.goal = null;
    return { ok: true, gifts };
  }
  function setGoal(save, job) { save.goal = job ? { job } : null; }
  function setLoadout(save, skills, tactic) {
    const jobs = C.jobLevels(save), e = B.validateLoadout(save.job, jobs, skills, advInherit(save));
    if (e.length) return { ok: false, err: e[0] };
    if (!['auto', 'attack', 'guard'].includes(tactic)) return { ok: false, err: '作戦が不正' };
    if (save.active) return { ok: false, err: 'ぼうけんの途中は変えられない' };
    save.loadout = { skills: skills.slice(), tactic }; return { ok: true };
  }
  function currentSkills(save) { const jobs = C.jobLevels(save); const s = save.loadout.skills; return s && !B.validateLoadout(save.job, jobs, s, advInherit(save)).length ? s : B.recommendLoadout(save.job, jobs); }
  function skillText(sk, lvl) {
    const s = B.eff(sk, lvl || 99), t = [];
    if (s.hits) t.push(s.hits.map(h => h[0].toFixed(1).replace(/\.0$/, '')).join('+') + '倍の連続こうげき'); else if (s.m) t.push(String(Math.round(s.m * 10) / 10) + '倍のこうげき');
    if (s.el) t.push(D.EL_NAME[s.el] + 'ぞくせい');
    if (s.heal) t.push('HP' + Math.round(s.heal * 100) + '%かいふく');
    if (s.guard) t.push('つぎの' + (s.guard[1] > 1 ? s.guard[1] + 'かい' : '') + '被ダメージ-' + Math.round(s.guard[0] * 100) + '%');
    if (s.atkDown) t.push('てきの こうげき-' + Math.round(s.atkDown * 100) + '%');
    if (s.ig) t.push('てきの ぼうぎょを はんぶん むし');
    if (s.prep) t.push('てきが じゅんびちゅうは ' + s.prep + '倍');
    if (s.stack) t.push('たまった力をぜんぶ つかう');
    return t.join('／');
  }

  // ---------- 外見 ----------
  function setLook(save, name, look) {
    const nm = String(name == null ? '' : name).replace(/[\u0000-\u001f<>&"']/g, '').trim().slice(0, NAME_MAX);
    const ok = Number.isInteger(look.face) && look.face >= 0 && look.face < FACE_N && Number.isInteger(look.hair) && look.hair >= 0 && look.hair < HAIR_N && Number.isInteger(look.skin) && look.skin >= 0 && look.skin < SKIN.length && Number.isInteger(look.hairColor) && look.hairColor >= 0 && look.hairColor < HAIR_COLOR.length;
    if (!ok) return { ok: false, err: '外見が不正' };
    save.name = nm; save.look = { face: look.face, hair: look.hair, skin: look.skin, hairColor: look.hairColor }; return { ok: true };
  }
  const lookOf = save => ({ skin: SKIN[save.look.skin], hair: HAIR_COLOR[save.look.hairColor], face: save.look.face, hairStyle: save.look.hair });
  function setWish(save, w) { if (!D.WISH_LIST.includes(w)) return false; save.wish = w; return true; }

  // ---------- 図鑑 ----------
  function seeEnemy(save, id) { ensure(save); const c = save.codex.enemies[id] || (save.codex.enemies[id] = { seen: 0, kills: 0 }); c.seen = 1; }
  function killEnemy(save, id) { ensure(save); seeEnemy(save, id); save.codex.enemies[id].kills++; }
  function codexSummary(save) {
    ensure(save); const ids = Object.keys(D.ENEMIES), seen = ids.filter(i => save.codex.enemies[i] && save.codex.enemies[i].seen).length;
    const items = Object.keys(D.ITEMS).filter(i => i !== 'w_start'), got = items.filter(i => save.codex.items[i]).length;
    return { enemies: { seen, total: ids.length }, items: { got, total: items.length } };
  }

  // ---------- 実績（保存済みの値から毎回計算。報酬なし） ----------
  function achievements(save) {
    ensure(save); const lv = C.jobLevels(save), maxJob = Math.max(...D.JOB_IDS.map(j => lv[j])), hero = C.heroLevel(save.advXp).lv;
    const cleared = save.progress.clearedRegions, adv = save.stats.adventures || 0, kills = Object.values(save.codex.enemies).reduce((a, e) => a + e.kills, 0);
    const base4 = ['warrior', 'mage', 'priest', 'thief'], advJobs = D.JOB_IDS.filter(j => D.JOBS[j].tier === 'adv');
    const own = Object.keys(save.inv.items);
    const A = (id, name, desc, now, need) => ({ id, name, desc, now: Math.min(now, need), need, done: now >= need });
    const l = [
      A('first', 'はじめの いっぽ', 'さいしょの ぼうけんを おえる', adv, 1),
      A('adv10', 'ぼうけんの なれ', 'ぼうけんを 10かい おえる', adv, 10),
      A('adv30', 'ぼうけん 30かい', 'ぼうけんを 30かい おえる', adv, 30),
      A('adv72', 'ぼうけん 72かい', 'ぼうけんを 72かい おえる', adv, 72),
      A('adv150', 'ぼうけん 150かい', 'ぼうけんを 150かい おえる', adv, 150),
      A('adv300', 'ぼうけん 300かい', 'ぼうけんを 300かい おえる', adv, 300),
      A('kill1', 'はじめての とうばつ', 'てきを たおす', kills, 1),
      A('kill20', 'てきを 20たい', 'てきを 20かい たおす', kills, 20),
      A('boss1', 'ボスを たおした', 'ボスを たおす', Object.keys(save.progress.bossKills).length, 1),
      A('region3', '3つの ちいき', 'ちいきを 3つ とっぱ', cleared.length, 3),
      A('region6', 'だいいっしょうの たび', 'だいいっしょうの 6ちいきを とっぱ', D.REGIONS.filter(r => r.ch === 1 && cleared.includes(r.id)).length, 6),
      A('region12', 'だいにしょうの たび', 'だいにしょうの 6ちいきを とっぱ', D.REGIONS.filter(r => r.ch === 2 && cleared.includes(r.id)).length, 6),
      A('region18', '十二のしるし', 'だいさんしょうの 6ちいきを とっぱ', D.REGIONS.filter(r => r.ch === 3 && cleared.includes(r.id)).length, 6),
      A('hero10', 'ぼうけん者 Lv10', 'ぼうけん者 Lv10', hero, 10),
      A('hero20', 'ぼうけん者 Lv20', 'ぼうけん者 Lv20', hero, 20),
      A('job5', '職業 Lv5', 'どれかの職業を Lv5に', maxJob, 5),
      A('job10', '職業 Lv10', 'どれかの職業を Lv10に', maxJob, 10),
      A('job20', '職業 Lv20', 'どれかの職業を Lv20に', maxJob, 20),
      A('job30', '職業 Lv30', 'どれかの職業を Lv30に', maxJob, 30),
      A('base4', '4つの きほん職', 'きほん職 4つを Lv5に', base4.filter(j => lv[j] >= 5).length, 4),
      A('advjob', '上級職に なる', '上級職に てんしょくする', advJobs.filter(j => save.jobXp[j] > 0).length, 1),
      A('rare1', 'はじめての レア', 'レアそうびを てにいれる', own.filter(i => D.ITEMS[i].rarity === 'rare').length, 1),
      A('rare5', 'レア 5こ', 'レアそうびを 5こ もつ', own.filter(i => D.ITEMS[i].rarity === 'rare').length, 5),
      A('enh3', '+3まで きたえる', 'そうびを +3に きょうか', Math.max(0, ...Object.values(save.inv.enhance)), 3),
      A('codex', 'ずかん 10たい', 'てきの ずかんを 10たい うめる', Object.values(save.codex.enemies).filter(e => e.seen).length, 10),
      A('name', 'じぶんの なまえ', 'なまえを つける', save.name ? 1 : 0, 1)
    ];
    return l;
  }

  // 冒険地図の表示用：地域ごとの進み具合
  function mapInfo(save) {
    const step = save.progress.step;
    return D.REGIONS.map((r, i) => {
      const st0 = D.REGION_START[i], total = D.STEPS_OF[i], cleared = save.progress.clearedRegions.includes(r.id), cur = step < D.ROUTE.length && step >= st0 && step < st0 + total;
      const inRegion = cur ? step - st0 : cleared ? total : 0, nNormal = r.points.length * 3;
      return { id: r.id, name: r.name, ruby: r.ruby, ch: r.ch, points: r.points, story: r.story || '', cleared, current: cur, locked: !cleared && !cur && step < st0, inRegion, total, nNormal, atBoss: cur && inRegion >= nNormal, boss: r.boss.name };
    });
  }

  return { SKIN, HAIR_COLOR, FACE_N, HAIR_N, NAME_MAX, SELL_RATE, ENH_COST_RATE, ENH_ORE, CAT_NAME, SLOT_NAME, ensure, enhLv, statOf, fxText, effectText, canEquip, setEquip, recommendEquip, statsWith, sellPrice, isEquipped, buyChecked, canSell, sell, canRefund, refund, onBegin, enhanceInfo, enhance, advInherit, jobProgress, changeJob, setGoal, setLoadout, currentSkills, skillText, setLook, lookOf, setWish, seeEnemy, killEnemy, codexSummary, achievements, mapInfo };
});
