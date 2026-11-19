'use strict';
// 街・装備・店・鍛冶・転職・技設定・外見・図鑑・実績のロジック（DOM非依存。セーブデータを直接更新する）
(function (root, factory) {
  const isN = typeof module === 'object' && module.exports;
  const m = factory(isN ? require('./rpg-data.js') : root.RPGData, isN ? require('./rpg-core.js') : root.RPGCore, isN ? require('./rpg-battle.js') : root.RPGBattle, isN ? require('./rpg-world.js') : root.RPGWorld);
  if (isN) module.exports = m; else root.RPGMeta = m;
})(typeof self !== 'undefined' ? self : this, function (D, C, B, W) {
  const SELL_RATE = 0.25, ENH_COST_RATE = [0.20, 0.35, 0.50], ENH_ORE = [2, 4, 6];
  const NAME_MAX = 8;

  // 古い保存データに足りない欄を補う（v1 のまま追加。既存の値は変えない）
  function ensure(s) {
    s.inv = s.inv || { items: {}, mats: {}, enhance: {} };
    s.inv.enhance = s.inv.enhance || {}; s.inv.fresh = s.inv.fresh || {}; s.inv.mats = s.inv.mats || {};
    s.codex = s.codex || { enemies: {}, items: {} }; s.codex.enemies = s.codex.enemies || {}; s.codex.items = s.codex.items || {};
    Object.keys(s.inv.items).forEach(id => { s.codex.items[id] = 1; });
    s.goal = s.goal || null; s.trials = s.trials || {}; s.seen = s.seen || {};
    C.migrateSave(s); s.look = { outfit: (s.look && s.look.outfit) || null };
    s.settings = s.settings || { sound: false, vibrate: false };
    s.quests = s.quests || {}; s.progress.quest = s.progress.quest || null;
    s.rewards = s.rewards || { titles: [], costumes: [], relics: [], lamp: false }; s.rewards.titles = s.rewards.titles || []; s.rewards.costumes = s.rewards.costumes || []; s.rewards.relics = s.rewards.relics || []; s.title = s.title || null;
    s.ending = s.ending || { seen: false }; s.chestView = s.chestView || {};
    C.migrateChests(s);
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
    if (fx.hpPct) t.push('最大HP+' + pct(fx.hpPct));
    if (fx.reduce) t.push('受けるダメージ-' + pct(fx.reduce));
    if (fx.firstReduce) t.push('最初に受けるダメージ-' + pct(fx.firstReduce));
    if (fx.firstSkill) t.push('最初の攻撃技+' + pct(fx.firstSkill));
    if (fx.elemAdd) t.push('技のとき ' + D.EL_NAME[fx.elemAdd[0]] + '属性の追加ダメージ（' + fx.elemAdd[1] + '倍）');
    if (fx.healBonus) t.push('技の回復量+' + pct(fx.healBonus));
    if (fx.firstMulti) t.push('最初の連撃の合計+' + pct(fx.firstMulti));
    if (fx.firstHeal) t.push('最初の攻撃技でHP' + pct(fx.firstHeal) + '回復');
    if (fx.halfHeal) t.push('HPが半分以下になると1回だけHP' + pct(fx.halfHeal) + '回復');
    const P = (k, f) => { if (fx[k]) t.push(f(pct(fx[k]))); };
    P('reviewHeal', v => '復習で正解した時の回復+' + v); P('guardNormal', v => '防御技のあとの通常攻撃+' + v);
    P('bigReduce', v => '予告された大技のダメージ-' + v); P('switchBonus', v => '攻撃⇔回復をつづけて使うと +' + v);
    P('lowGuard', v => 'HPが40%以下で1回だけダメージ-' + Math.round(fx.lowGuard * 100 + 10) + '%'); P('teleBonus', v => '敵が大技を準備中の技+' + v);
    P('diffSkill', v => 'ちがう技をつづけると +' + v); P('switchGuard', v => '攻撃⇔防御をつづけると +' + v);
    P('elemReduce', v => '属性攻撃のダメージ-' + v); P('skillAdd', v => '技のとき追加ダメージ（' + fx.skillAdd + '倍）');
    P('weakHeal', v => '弱点をつくと HP' + v + '回復'); P('guardBoost', v => '防御技の軽減+' + v);
    P('stackBoost', v => 'ためる技の上乗せ+' + v); P('teleGuard', v => '大技の準備中の防御技軽減+' + v);
    P('inhBoost', v => '継承した技の効果+' + v); P('afterBig', v => '大技をうけたあと HP' + v + '回復');
    return t.join('、');
  }
  const effectText = id => { const it = D.ITEMS[id]; if (!it) return ''; return it.fx ? fxText(it.fx) : (id === 'w_start' ? 'どの職業でも使える' : ''); };
  // 効果の短い説明（最初に見る画面用）。数値の細目は fxText（「効果を詳しく」）
  const FX_SHORT = { hpPct: '体力がふえる', reduce: '受けるダメージが減る', firstReduce: '最初の一撃を受けにくい', firstSkill: '最初の技が強くなる', healBonus: '回復の技が強くなる', firstMulti: '最初の連続攻撃が強くなる', firstHeal: '最初の技でHPが回復する', halfHeal: 'ピンチで一度だけ回復する', reviewHeal: '復習の正解で回復する', guardNormal: '守ったあとの攻撃が強い', bigReduce: '大技のダメージが減る', switchBonus: '攻撃と回復を交互に使うと強い', lowGuard: 'HPが少ないと一度だけ守られる', teleBonus: '敵の大技の準備中に強い', diffSkill: 'ちがう技を続けると強い', switchGuard: '攻撃と防御を交互に使うと強い', elemReduce: '属性攻撃を受けにくい', skillAdd: '技に追加ダメージ', weakHeal: '弱点をつくと回復する', guardBoost: '防御技の守りが強くなる', stackBoost: 'ためる技が強くなる', teleGuard: '大技の準備中の守りが強い', inhBoost: '受けついだ技が強くなる', afterBig: '大技を受けたあと回復する' };
  const WEAPON_WORD = { sword: '剣', staff: '杖', dagger: '短剣', bow: '弓' };
  function effectShort(id) {
    const it = D.ITEMS[id]; if (!it) return ''; if (!it.fx) return id === 'w_start' ? 'どの職業でも使える' : '';
    const t = [], fx = it.fx;
    if (fx.elemAdd) t.push(D.EL_NAME[fx.elemAdd[0]] + 'をまとった' + (WEAPON_WORD[it.cat] || '武器') + 'で攻撃');
    Object.keys(FX_SHORT).forEach(k => { if (fx[k]) t.push(FX_SHORT[k]); });
    return t.join('・');
  }
  const CAT_NAME = { relic: '秘境のたから', sword: '剣', staff: '杖', dagger: '短剣', bow: '弓', heavy: '重装', light: '軽装', robe: 'ローブ', charm: 'お守り', shieldorn: '盾飾り', ring: '指輪', any: 'どれでも' };
  const SLOT_NAME = { weapon: '武器', armor: '防具', acc: 'アクセサリー' };

  // ---------- 装備 ----------
  function canEquip(save, id, job) {
    const it = D.ITEMS[id]; if (!it) return '不明な装備';
    if (!save.inv.items[id]) return '持っていない';
    if (it.slot === 'weapon' && it.cat !== 'any' && !D.JOBS[job || save.job].weapons.includes(it.cat)) return 'この職業では使えない';
    return null;
  }
  // 装備の確定。冒険の途中は変えない
  function setEquip(save, eq) {
    if (save.active) return { ok: false, err: '冒険の途中は変えられない' };
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
    if (isEquipped(save, id)) return '装備中';
    if (it.rarity === 'unique') return '売れない（大切な装備）';
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
    if (save.active && Object.values(save.active.hero.equip).includes(id)) return { ok: false, err: '冒険中は返品できない' };
    const g = save.inv.fresh[id]; Object.keys(save.equip).forEach(s => { if (save.equip[s] === id) save.equip[s] = null; });
    delete save.inv.items[id]; delete save.inv.fresh[id]; save.coins += g;
    return { ok: true, coin: g };
  }
  // 冒険を始めるとき：装備していたものは「つかった」ことになり、返品できなくなる
  function onBegin(save) { ensure(save); Object.values(save.equip).forEach(id => { if (id) delete save.inv.fresh[id]; }); const e = save.active && D.ENEMIES[save.active.enemyId]; if (e) seeEnemy(save, e.id); }

  // ---------- 鍛冶（強化） ----------
  function enhanceInfo(save, id) {
    const it = D.ITEMS[id], lv = enhLv(save, id); const o = { lv, max: D.ENH_MAX };
    if (!it || !save.inv.items[id] || !it.rank || id === 'w_start') { o.err = '強化できない'; return o; }
    if (lv >= D.ENH_MAX) { o.err = 'これ以上強化できない'; return o; }
    o.coin = Math.round(it.price * ENH_COST_RATE[lv]); o.ore = ENH_ORE[lv]; o.oreId = C.oreId(it.rank); o.have = save.inv.mats[o.oreId] || 0;
    const nx = lv + 1; o.after = it.atk != null ? it.atk + D.enhBonus(it, nx) : it.def != null ? it.def + D.enhBonus(it, nx) : null;
    if (save.active) o.err = '冒険の途中はできない';
    else if (save.coins < o.coin) o.err = 'コインが足りない';
    else if (o.have < o.ore) o.err = '鉱石が足りない';
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
      rows.push({ text: (j.trial === 'wing' ? '翼' : '星') + 'の試練（第2章をクリアしてから冒険の地図で挑戦）', now: save.trials && save.trials[j.trial] ? 1 : 0, need: 1, done: !!(save.trials && save.trials[j.trial]) });
    }
    return rows;
  }
  function changeJob(save, job) {
    const e = C.canChangeJob(save, job); if (e) return { ok: false, err: e };
    if (save.job === job) return { ok: false, err: '今その職業です' };
    save.job = job; save.loadout.skills = null; const gifts = [];
    D.JOBS[job].weapons.forEach(cat => {   // 未所有の武器系統の支給（ランクI・通常品、無料）
      if (!Object.keys(save.inv.items).some(i => D.ITEMS[i].slot === 'weapon' && D.ITEMS[i].cat === cat)) { const id = `w_${cat}_1`; save.inv.items[id] = 1; save.codex.items[id] = 1; gifts.push(id); }
    });
    // 武器：いま持っているものが新しい職業で使えるなら、そのまま（はじまりの武器だけは、より強い適合品があれば替える）。使えないときは、持っている適合武器（無ければ上の無料支給品）に替える
    const prevW = save.equip.weapon || null; let swapped = null;
    if (!prevW || prevW === 'w_start' || canEquip(save, prevW, job)) { const w = C.bestOwned(save, 'weapon', job); if (w && w !== prevW) { save.equip.weapon = w; swapped = { from: prevW, to: w }; } }
    if (save.goal && save.goal.job === job) save.goal = null;
    return { ok: true, gifts, swapped };
  }
  function setGoal(save, job) { save.goal = job ? { job } : null; }
  function setLoadout(save, skills, tactic) {
    const jobs = C.jobLevels(save), e = B.validateLoadout(save.job, jobs, skills, advInherit(save));
    if (e.length) return { ok: false, err: e[0] };
    if (!['auto', 'attack', 'guard'].includes(tactic)) return { ok: false, err: '作戦が不正' };
    if (save.active) return { ok: false, err: '冒険の途中は変えられない' };
    save.loadout = { skills: skills.slice(), tactic }; return { ok: true };
  }
  function currentSkills(save) { const jobs = C.jobLevels(save); const s = save.loadout.skills; return s && !B.validateLoadout(save.job, jobs, s, advInherit(save)).length ? s : B.recommendLoadout(save.job, jobs); }
  function skillText(sk, lvl) {
    const s = B.eff(sk, lvl || 99), t = [];
    if (s.hits) t.push(s.hits.map(h => h[0].toFixed(1).replace(/\.0$/, '')).join('+') + '倍の連続攻撃'); else if (s.m) t.push(String(Math.round(s.m * 10) / 10) + '倍の攻撃');
    if (s.el) t.push(D.EL_NAME[s.el] + '属性');
    if (s.heal) t.push('HP' + Math.round(s.heal * 100) + '%回復');
    if (s.guard) t.push('次の' + (s.guard[1] > 1 ? s.guard[1] + '回' : '') + '被ダメージ-' + Math.round(s.guard[0] * 100) + '%');
    if (s.atkDown) t.push('敵の攻撃-' + Math.round(s.atkDown * 100) + '%');
    if (s.ig) t.push('敵の防御を半分無視');
    if (s.prep) t.push('敵が準備中は ' + s.prep + '倍');
    if (s.stack) t.push('たまった力を全部使う');
    return t.join('／');
  }

  // ---------- 外見 ----------
  function setProfile(save, name, outfitIn) {   // 名前と衣装（外見の選択は廃止）
    const nm = String(name == null ? '' : name).replace(/[ -<>&"']/g, '').trim().slice(0, NAME_MAX);
    const o = outfitIn === 'master' ? (masterOwned(save, save.job) ? 'master' : null) : outfitIn === 'alt1' ? (altOwned(save, save.job) ? 'alt1' : null) : (outfitIn === undefined ? save.look.outfit : (outfitIn && (save.rewards.costumes || []).includes(outfitIn) ? outfitIn : null));
    save.name = nm; save.look = { outfit: o || null }; return { ok: true };
  }
  function setWish(save, w) { if (!D.WISH_LIST.includes(w)) return false; save.wish = w; return true; }

  // ---------- 図鑑 ----------
  function seeEnemy(save, id) { ensure(save); const c = save.codex.enemies[id] || (save.codex.enemies[id] = { seen: 0, kills: 0 }); c.seen = 1; }
  function killEnemy(save, id) { ensure(save); seeEnemy(save, id); save.codex.enemies[id].kills++; }
  function codexHas(save, id) { const it = D.ITEMS[id]; if (it && it.unique && !it.relic) return Object.keys(save.codex.items).some(k => D.ITEMS[k] && D.ITEMS[k].unique === it.unique); return !!save.codex.items[id]; }
  // 図鑑の分母（実際に集められる対象から数える）
  //  敵：基本種＝強化版（variantOf を持つ敵）を除いたもの。強化版は元の基本種の中で数える（enemies.variants）。
  //  装備：支給品（はじまりの武器）と、再鍛造で変わるだけの固有装備のランク違い（_2〜）は数えない。通常品・レア・固有装備（基本の1つ）・秘境のたから。
  const baseEnemyIds = () => Object.keys(D.ENEMIES).filter(i => !D.ENEMIES[i].variantOf);
  const variantIdsOf = id => Object.keys(D.ENEMIES).filter(i => D.ENEMIES[i].variantOf === id);
  const codexItemIds = () => Object.keys(D.ITEMS).filter(i => i !== 'w_start' && (!D.ITEMS[i].unique || /^u_.+_1$/.test(i) || D.ITEMS[i].relic));
  function codexSummary(save) {
    ensure(save); const seenOf = i => !!(save.codex.enemies[i] && save.codex.enemies[i].seen), base = baseEnemyIds(), vars = Object.keys(D.ENEMIES).filter(i => D.ENEMIES[i].variantOf);
    const items = codexItemIds(), got = items.filter(i => codexHas(save, i)).length;
    return { enemies: { seen: base.filter(seenOf).length, total: base.length, variants: { seen: vars.filter(seenOf).length, total: vars.length } }, items: { got, total: items.length } };
  }

  // ---------- 実績（保存済みの値から毎回計算。報酬なし） ----------
  function achievements(save) {
    ensure(save); const lv = C.jobLevels(save), maxJob = Math.max(...D.JOB_IDS.map(j => lv[j])), hero = C.heroLevel(save.advXp).lv;
    const cleared = save.progress.clearedRegions, adv = save.stats.adventures || 0, kills = Object.values(save.codex.enemies).reduce((a, e) => a + e.kills, 0);
    const base4 = ['warrior', 'mage', 'priest', 'thief'], advJobs = D.JOB_IDS.filter(j => D.JOBS[j].tier === 'adv');
    const own = Object.keys(save.inv.items);
    const A = (id, name, desc, now, need) => ({ id, name, desc, now: Math.min(now, need), need, done: now >= need });
    const l = [
      A('first', '最初の一歩', '最初の冒険を終える', adv, 1),
      A('adv10', '冒険に慣れた', '冒険を10回終える', adv, 10),
      A('adv30', '冒険 30回', '冒険を30回終える', adv, 30),
      A('adv72', '冒険 72回', '冒険を72回終える', adv, 72),
      A('adv150', '冒険 150回', '冒険を150回終える', adv, 150),
      A('adv300', '冒険 300回', '冒険を300回終える', adv, 300),
      A('kill1', '初めての討伐', '敵を倒す', kills, 1),
      A('kill20', '敵を20体', '敵を20回倒す', kills, 20),
      A('boss1', 'ボスを倒した', 'ボスを倒す', Object.keys(save.progress.bossKills).length, 1),
      A('region3', '3つの地域', '地域を 3つ突破', cleared.length, 3),
      A('region6', '第1章の旅', '第1章の 6地域を突破', D.REGIONS.filter(r => r.ch === 1 && cleared.includes(r.id)).length, 6),
      A('region12', '第2章の旅', '第2章の 6地域を突破', D.REGIONS.filter(r => r.ch === 2 && cleared.includes(r.id)).length, 6),
      A('region18', '十二のしるし', '第3章の 6地域を突破', D.REGIONS.filter(r => r.ch === 3 && cleared.includes(r.id)).length, 6),
      A('hero10', '冒険者 Lv10', '冒険者 Lv10', hero, 10),
      A('hero20', '冒険者 Lv20', '冒険者 Lv20', hero, 20),
      A('job5', '職業 Lv5', 'どれかの職業をLv5に', maxJob, 5),
      A('job10', '職業 Lv10', 'どれかの職業をLv10に', maxJob, 10),
      A('job20', '職業 Lv20', 'どれかの職業をLv20に', maxJob, 20),
      A('job30', '職業 Lv30', 'どれかの職業をLv30に', maxJob, 30),
      A('base4', '4つの基本職', '基本職4つをLv5に', base4.filter(j => lv[j] >= 5).length, 4),
      A('advjob', '上級職になる', '上級職に転職する', advJobs.filter(j => save.jobXp[j] > 0).length, 1),
      A('rare1', '初めてのレア', 'レア装備を手に入れる', own.filter(i => D.ITEMS[i].rarity === 'rare').length, 1),
      A('rare5', 'レア 5こ', 'レア装備を5個持つ', own.filter(i => D.ITEMS[i].rarity === 'rare').length, 5),
      A('enh3', '+3まで鍛える', '装備を +3に強化', Math.max(0, ...Object.values(save.inv.enhance)), 3),
      A('codex', '図鑑 10体', '敵の図鑑を10体うめる', Object.values(save.codex.enemies).filter(e => e.seen).length, 10),
      A('name', '自分の名前', '名前をつける', save.name ? 1 : 0, 1)
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

  // ---------- 第3段：冒険の道（クエスト）・固有装備・報酬 ----------
  const mainCleared = save => D.REGIONS.every(r => save.progress.clearedRegions.includes(r.id));
  const ch2Cleared = save => D.REGIONS.filter(r => r.ch === 2).every(r => save.progress.clearedRegions.includes(r.id));
  function questState(save, id) { ensure(save); return save.quests[id] || (save.quests[id] = { step: 0, enemyHp: null, count: 0, cleared: false }); }
  // 挑戦できるなら null、できないなら理由
  function questLocked(save, id) {
    ensure(save); const q = W.QUESTS[id]; if (!q) return '不明な道';
    const qs = save.quests[id] || {};
    if (q.kind !== 'rematch' && qs.cleared) return 'クリア済み';
    if (q.kind === 'rematch') return save.progress.clearedRegions.includes(q.region) ? null : q.short + 'のボスを倒すと開く';
    if (q.kind === 'trial') {
      const lv = C.jobLevels(save), j = D.JOBS[q.job];
      if (!ch2Cleared(save)) return '第2章をクリアすると開く';
      const n = j.reqFrom.filter(r => lv[r] >= 20).length; if (n < 2) return '上級職2つが Lv20で開く（いま ' + n + ' / 2）';
      return null;
    }
    if (q.kind === 'secret') return mainCleared(save) ? null : '本編をクリアすると開く';
    if (q.kind === 'island') { const n = W.SECRET_IDS.filter(i => (save.quests[i] || {}).cleared).length; return n >= 6 ? null : '6つの秘境をクリアすると開く（いま ' + n + ' / 6）'; }
    return null;
  }
  function selectQuest(save, id) {
    ensure(save);
    if (save.active) return { ok: false, err: '冒険の途中は変えられない' };
    if (id) { const e = questLocked(save, id); if (e) return { ok: false, err: e }; }
    save.progress.quest = id || null; return { ok: true };
  }
  // クリア報酬（称号・衣装・秘境装備・夜明けの灯）
  function applyQuestClear(save, q) {
    ensure(save); const rep = { title: null, costume: null, item: null, lamp: false, trial: null }, R = save.rewards;
    const add = (arr, v) => { if (!arr.includes(v)) arr.push(v); };
    if (q.title) { add(R.titles, q.title); rep.title = q.title; if (!save.title) save.title = q.title; }
    if (q.costume) { add(R.costumes, q.costume.id); rep.costume = q.costume.name; }
    if (q.kind === 'trial') { save.trials[q.trial] = 1; rep.trial = q.trial; }
    if (q.kind === 'secret') { const d = q.def; if (!save.inv.items[d.item.id]) { save.inv.items[d.item.id] = 1; save.codex.items[d.item.id] = 1; } add(R.relics, d.item.id); rep.item = d.item.id; }
    if (q.kind === 'island') { R.lamp = true; rep.lamp = true; }
    return rep;
  }
  // マスター衣装：その職業を Lv30 にすると獲得（設計書 02）。絵は職業ごと（hero_<職>_master）。
  const masterOwned = (save, job) => C.jobLevel(job, save.jobXp[job] || 0).lv >= 30;
  // 画面に出す衣装（'master' か null）。選んでいて、いまの職業のマスター衣装を獲得済みのときだけ
  // 追加衣装(alt1)：上級職6職だけが持つ。氷下火山(第2章)をクリアすると「上級職の衣装依頼」(rpg-data.js REGIONS.icevolcano.item)として解放。選ぶ場所はマスター衣装と同じ（外見画面）
  const ALT_JOBS = ['magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger'];
  const altOwned = (save, job) => ALT_JOBS.includes(job) && (save.progress.clearedRegions || []).includes('icevolcano');
  const costumeOf = (save, job) => { ensure(save); const o = save.look.outfit, j = job || save.job; return o === 'master' && masterOwned(save, j) ? 'master' : o === 'alt1' && altOwned(save, j) ? 'alt1' : null; };
  // 武器の絵に使うアイテムID。はじまりの武器・アイコンの無い物は、職業の最初の武器系統のランクIで描く
  const startArtOf = job => { const c = D.JOBS[job].weapons[0]; return c === 'sword' ? 'w_start' : 'w_start_' + c; };   // はじまりの武器の絵：その職の最初の武器種別の素朴な木製（剣=w_start・杖/短剣/弓=w_start_<種別>）。強さ・IDは w_start のまま
  const artWeapon = (job, id) => { const it = id && D.ITEMS[id]; if (it && it.slot === 'weapon' && it.cat !== 'any') return id; if (id === 'w_start') return startArtOf(job); return 'w_' + D.JOBS[job].weapons[0] + '_1'; };
  const costumeColor = save => { ensure(save); const o = save.look.outfit; if (!o) return null; for (const q of Object.values(W.QUESTS)) if (q.costume && q.costume.id === o && save.rewards.costumes.includes(o)) return q.costume.color; return null; };
  const allCostumes = () => Object.values(W.QUESTS).filter(q => q.costume).map(q => ({ id: q.costume.id, name: q.costume.name, color: q.costume.color, from: q.name }));
  function setOutfit(save, id) { ensure(save); if (id === 'alt1') { if (!altOwned(save, save.job)) return false; save.look.outfit = 'alt1'; return true; } if (id === 'master') { if (!masterOwned(save, save.job)) return false; save.look.outfit = 'master'; return true; } if (id && !save.rewards.costumes.includes(id)) return false; save.look.outfit = id || null; return true; }
  function setTitle(save, t) { ensure(save); if (t && !save.rewards.titles.includes(t)) return false; save.title = t || null; return true; }

  // 固有装備（18）。製作：ボス素材3個。再鍛造：解放済みの最高ランクまで（外見・効果・強化値を保持）
  function ownedUnique(save, key) { return Object.keys(save.inv.items).find(i => D.ITEMS[i] && D.ITEMS[i].unique === key && !D.ITEMS[i].relic) || null; }
  function uniqueInfo(save, key) {
    ensure(save); const u = W.UNIQ_BY_KEY[key], own = ownedUnique(save, key), have = save.inv.mats[u.mat] || 0;
    const o = { key, name: u.name, need: u.need, have, mat: u.mat, matName: u.matName, owned: own, rank: own ? W.uniqRank(own) : 0, text: fxText(W.scaleFx(u.fx, 1)) };
    const maxR = Math.min(6, C.maxRank(save));
    if (!own) { o.craftRank = Math.max(1, Math.min(maxR, u.chCap)); o.err = have >= u.need ? (save.active ? '冒険の途中はできない' : null) : 'ボス素材が足りない'; return o; }
    o.target = maxR;
    if (!save.progress.clearedRegions.includes('rootwood')) o.reErr = '再鍛造は地底樹海をクリアすると開く';
    else if (o.rank >= maxR) o.reErr = o.rank >= 6 ? 'これ以上上げられない' : '今開いている一番上のランク';
    else {
      const pr = r => D.ITEMS[W.uniqId(key, r)].price; o.reCoin = Math.round(0.5 * (pr(maxR) - pr(o.rank))); o.reOre = 3 * (maxR - o.rank); o.reOreId = C.oreId(maxR); o.reHave = save.inv.mats[o.reOreId] || 0;
      if (save.active) o.reErr = '冒険の途中はできない'; else if (save.coins < o.reCoin) o.reErr = 'コインが足りない'; else if (o.reHave < o.reOre) o.reErr = '鉱石が足りない';
    }
    return o;
  }
  function craftUnique(save, key) {
    const i = uniqueInfo(save, key); if (i.owned || i.err) return { ok: false, err: i.owned ? 'もう持っている' : i.err };
    save.inv.mats[i.mat] -= i.need; const id = W.uniqId(key, i.craftRank); save.inv.items[id] = 1; save.codex.items[id] = 1; return { ok: true, id };
  }
  function reforgeUnique(save, key) {
    const i = uniqueInfo(save, key); if (!i.owned) return { ok: false, err: 'まだ持っていない' }; if (i.reErr) return { ok: false, err: i.reErr };
    const old = i.owned, id = W.uniqId(key, i.target);
    save.coins -= i.reCoin; save.inv.mats[i.reOreId] -= i.reOre;
    delete save.inv.items[old]; save.inv.items[id] = 1; save.codex.items[id] = 1;
    if (save.inv.enhance[old]) { save.inv.enhance[id] = save.inv.enhance[old]; delete save.inv.enhance[old]; }
    delete save.inv.fresh[old];
    Object.keys(save.equip).forEach(sl => { if (save.equip[sl] === old) save.equip[sl] = id; });
    return { ok: true, id, from: i.rank, to: i.target };
  }
  // 一覧用：クエストごとの表示情報
  function questList(save) {
    ensure(save);
    return W.QUEST_ORDER.map(id => { const q = W.QUESTS[id], qs = save.quests[id] || {}; return { id, kind: q.kind, name: q.name, short: q.short || null, locked: questLocked(save, id), cleared: !!qs.cleared && q.kind !== 'rematch', count: qs.count || 0, step: qs.step || 0, total: q.segs.length, boss: q.boss || null, current: save.progress.quest === id }; });
  }

  return { baseEnemyIds, variantIdsOf, codexItemIds, effectShort, masterOwned, altOwned, ALT_JOBS, costumeOf, artWeapon, startArtOf, mainCleared, ch2Cleared, questState, questLocked, selectQuest, applyQuestClear, costumeColor, allCostumes, setOutfit, setTitle, ownedUnique, uniqueInfo, craftUnique, reforgeUnique, questList, codexHas, NAME_MAX, SELL_RATE, ENH_COST_RATE, ENH_ORE, CAT_NAME, SLOT_NAME, ensure, enhLv, statOf, fxText, effectText, canEquip, setEquip, recommendEquip, statsWith, sellPrice, isEquipped, buyChecked, canSell, sell, canRefund, refund, onBegin, enhanceInfo, enhance, advInherit, jobProgress, changeJob, setGoal, setLoadout, currentSkills, skillText, setProfile, setWish, seeEnemy, killEnemy, codexSummary, achievements, mapInfo };
});
