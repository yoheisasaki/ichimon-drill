'use strict';
// node rpg/tests/stage3.js — 第3段（固有装備・再鍛造・再戦・試練・秘境・孤島・おはなし・音・データ検査）のDOM不要テスト
const D = require('../js/rpg-data.js'), W = require('../js/rpg-world.js'), ST = require('../js/rpg-story.js'), C = require('../js/rpg-core.js'), B = require('../js/rpg-battle.js'), M = require('../js/rpg-meta.js'), A = require('../js/rpg-adventure.js');
let pass = 0, fail = 0; const failures = [];
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; failures.push(name + ' → ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' 期待 ' + JSON.stringify(b) + ' 実際 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ok でない'); }
const fresh = () => { const s = M.ensure(C.newSave(0)); s.firstDone = true; s.coins = 99999; return s; };
const allRegions = s => { s.progress.clearedRegions = D.REGIONS.map(r => r.id); s.progress.step = D.ROUTE.length; };
const strong = s => { s.advXp = C.cum(C.NEED.hero, 60); D.JOB_IDS.forEach(j => { s.jobXp[j] = C.cum(C.NEED[D.JOBS[j].tier], 30); }); s.inv.items = Object.assign({ w_start: 1 }, { w_sword_6: 1, a_heavy_6: 1, x_charm_6: 1, w_staff_6: 1, w_dagger_6: 1, w_bow_6: 1 }); s.equip = { weapon: 'w_sword_6', armor: 'a_heavy_6', acc: 'x_charm_6' }; };

// ---------- 固有装備の効果（18＋秘境6）。同じ状態で 効果あり/なし を比べる ----------
function mk(fx, o) {
  o = o || {};
  const st = B.newBattle({ job: o.job || 'warrior', jobLv: o.jobLv || 20, advLv: 30, equip: { weapon: 'w_sword_3' }, skills: o.skills || ['w_strike', 'w_shield', 'w_rock'], tactic: 'auto', enemyId: o.enemy || 'e_leafslime' });
  st.hero.fx = Object.assign({}, fx); st.hero.gauge = 6; st.enemy.hp = st.enemy.maxHp = 99999; st.enemy.def = 10; st.enemy.weak = o.weak || null;
  if (o.setup) o.setup(st); return st;
}
const skill = (st, id) => B.heroAct(st, { t: 'skill', id }, true);
t('固有：双面の指輪（違う技の連続 +）／同じ技なら変わらない', () => {
  const a = skill(mk({}, { setup: s => { s.hero.p.lastSkill = 'w_rock'; } }), 'w_strike').dmg, b = skill(mk({ diffSkill: 0.1 }, { setup: s => { s.hero.p.lastSkill = 'w_rock'; } }), 'w_strike').dmg, c = skill(mk({ diffSkill: 0.1 }, { setup: s => { s.hero.p.lastSkill = 'w_strike'; } }), 'w_strike').dmg;
  ok(b > a, '違う技で増える'); eq(c, a, '同じ技は変わらない');
});
t('固有：時砂の短剣（敵が大技を準備中の技 +）', () => {
  const a = skill(mk({}, { setup: s => { s.enemy.tele = true; } }), 'w_strike').dmg, b = skill(mk({ teleBonus: 0.15 }, { setup: s => { s.enemy.tele = true; } }), 'w_strike').dmg, c = skill(mk({ teleBonus: 0.15 }), 'w_strike').dmg;
  ok(b > a); eq(c, a);
});
t('固有：天秤のつるぎ（攻撃⇔防御の切替で +）／潮音の杖（攻撃⇔回復で +）', () => {
  const base = skill(mk({}), 'w_strike').dmg, g = skill(mk({ switchGuard: 0.12 }, { setup: s => { s.hero.p.lastKind = 'guard'; } }), 'w_strike').dmg, same = skill(mk({ switchGuard: 0.12 }, { setup: s => { s.hero.p.lastKind = 'atk'; } }), 'w_strike').dmg;
  ok(g > base); eq(same, base);
  const h = skill(mk({ switchBonus: 0.12 }, { setup: s => { s.hero.p.lastKind = 'heal'; } }), 'w_strike').dmg; ok(h > base);
  const noSwitch = skill(mk({ switchBonus: 0.12 }, { setup: s => { s.hero.p.lastKind = 'guard'; } }), 'w_strike').dmg; eq(noSwitch, base, '防御⇔攻撃は潮音の対象外');
});
t('固有：記憶の護符（継承技の効果 +）。元の職の技には効かない', () => {
  const a = skill(mk({}), 'm_fire').dmg, b = skill(mk({ inhBoost: 0.12 }), 'm_fire').dmg, c = skill(mk({}), 'w_strike').dmg, d = skill(mk({ inhBoost: 0.12 }), 'w_strike').dmg;
  ok(b > a); eq(d, c);
});
t('固有：熔晶の武器飾り（技の追加ダメージ）。通常攻撃には付かない', () => {
  ok(skill(mk({ skillAdd: 0.15 }), 'w_strike').dmg > skill(mk({}), 'w_strike').dmg);
  const n0 = B.heroAct(mk({}), { t: 'normal' }, true).dmg, n1 = B.heroAct(mk({ skillAdd: 0.15 }), { t: 'normal' }, true).dmg; eq(n1, n0);
});
t('固有：黒鋼の盾飾り／城塞の鎧（防御技の軽減 +。城塞は敵の大技準備中のみ）', () => {
  const g0 = mk({}); skill(g0, 'w_shield'); const g1 = mk({ guardBoost: 0.08 }); skill(g1, 'w_shield');
  ok(g1.hero.guard.pct > g0.hero.guard.pct, '黒鋼');
  const t0 = mk({ teleGuard: 0.15 }); skill(t0, 'w_shield'); const t1 = mk({ teleGuard: 0.15 }, { setup: s => { s.enemy.tele = true; } }); skill(t1, 'w_shield');
  eq(t0.hero.guard.pct, g0.hero.guard.pct, '準備中でなければ変わらない'); ok(t1.hero.guard.pct > g0.hero.guard.pct, '準備中は上がる'); ok(t1.hero.guard.pct <= B.REDUCE_CAP);
});
t('固有：翠天のマント（防御技のあとの通常攻撃 +）', () => {
  const a = B.heroAct(mk({}, { setup: s => { s.hero.guard = { pct: 0.5, left: 1 }; } }), { t: 'normal' }, true).dmg, b = B.heroAct(mk({ guardNormal: 0.12 }, { setup: s => { s.hero.guard = { pct: 0.5, left: 1 }; } }), { t: 'normal' }, true).dmg, c = B.heroAct(mk({ guardNormal: 0.12 }), { t: 'normal' }, true).dmg;
  ok(b > a); eq(c, a);
});
t('固有：巨兵の弓（ためる技の上乗せ +）', () => {
  const sk = D.SKILLS_OF.ranger.find(s => s.stack && s.stack.per), o = { job: 'ranger', jobLv: 20, skills: [sk.id], setup: s => { s.hero.p.aim = 3; } };
  ok(skill(mk({ stackBoost: 0.2 }, o), sk.id).dmg > skill(mk({}, o), sk.id).dmg);
});
t('固有：極光の衣（弱点を突くと小回復）。弱点でなければ回復しない', () => {
  const o = { job: 'mage', skills: ['m_fire'], weak: 'fire', setup: s => { s.hero.hp = 50; } };
  eq(skill(mk({}, o), 'm_fire').heal, 0); ok(skill(mk({ weakHeal: 0.06 }, o), 'm_fire').heal > 0);
  eq(skill(mk({ weakHeal: 0.06 }, Object.assign({}, o, { weak: 'ice' })), 'm_fire').heal, 0);
});
const enemyHit = (fx, act, setup) => { const st = mk(fx, { setup: s => { s.enemy.pattern = [act]; s.enemy.pi = 0; s.enemy.atk = 80; if (setup) setup(s); } }); return { st, ev: B.enemyAct(st) }; };
t('固有：古樹の盾飾り（最初の被ダメ）／水晶のまもり（予告大技）／白銀の胸当て（属性攻撃）', () => {
  const big = { k: 'big', m: 2, n: 'x' }, el = { k: 'big', m: 2, n: 'y', el: 'ice' };
  const d0 = enemyHit({}, big).ev.dmg; ok(enemyHit({ firstReduce: 0.25 }, big).ev.dmg < d0, '最初の被ダメ');
  ok(enemyHit({ bigReduce: 0.15 }, big).ev.dmg < d0, '大技'); eq(enemyHit({ bigReduce: 0.15 }, { k: 'atk', m: 2 }).ev.dmg, enemyHit({}, { k: 'atk', m: 2 }).ev.dmg, '通常攻撃には効かない');
  ok(enemyHit({ elemReduce: 0.2 }, el).ev.dmg < enemyHit({}, el).ev.dmg, '属性'); eq(enemyHit({ elemReduce: 0.2 }, big).ev.dmg, d0, '無属性には効かない');
});
t('固有：深碧の護符（低HPで1回だけ軽減）', () => {
  const act = { k: 'atk', m: 2 }, low = s => { s.hero.hp = Math.floor(s.hero.maxHp * 0.3); };
  const r = enemyHit({ lowGuard: 0.4 }, act, low), plain = enemyHit({}, act, low);
  ok(r.ev.dmg < plain.ev.dmg && r.ev.lowGuard, '1回目'); r.st.hero.hp = Math.floor(r.st.hero.maxHp * 0.3); r.st.enemy.pi = 0; const second = B.enemyAct(r.st); ok(!second.lowGuard, '2回目は発動しない');
  const hi = enemyHit({ lowGuard: 0.4 }, act); eq(hi.ev.dmg, enemyHit({}, act).ev.dmg, 'HPが高いときは発動しない');
});
t('固有：王冠の星飾り（大技のあとHP回復）／根源の指輪（復習回復 +）', () => {
  const r = enemyHit({ afterBig: 0.08 }, { k: 'big', m: 1.2, n: 'z' }), p = enemyHit({}, { k: 'big', m: 1.2, n: 'z' });
  ok(r.st.hero.hp > p.st.hero.hp, '大技のあと回復');
  const rv = fx => { const st = mk(fx, { setup: s => { s.hero.hp = Math.floor(s.hero.maxHp / 2); s.enemy.hp = 99999; } }); const h0 = st.hero.hp; B.resolveAnswer(st, { kind: 'review', correct: true }); return st.hero.hp - h0; };
  ok(rv({ reviewHeal: 0.05 }) > rv({}), '復習回復');
});
t('固有：ランク1〜6の全18装備が定義され、効果量はランクで最大+20%、上限（軽減80%）を超えない', () => {
  eq(W.UNIQ.length, 18); eq(Object.values(D.ITEMS).filter(i => i.rarity === 'unique' && !i.relic).length, 18 * 6);
  W.UNIQ.forEach(u => { const a = D.ITEMS[W.uniqId(u.key, 1)], b = D.ITEMS[W.uniqId(u.key, 6)]; Object.keys(u.fx).forEach(k => { ok(b.fx[k] <= u.fx[k] * 1.2 + 1e-9, u.key + k); ok(b.fx[k] >= a.fx[k]); ok(b.fx[k] <= 0.5, '効果量の上限'); }); });
});
t('固有：効果の文章が全ての新しいキーにある（表示漏れなし）', () => {
  Object.values(D.ITEMS).filter(i => i.rarity === 'unique').forEach(i => ok(M.fxText(i.fx).length > 0, i.id));
});

// ---------- 製作・再鍛造 ----------
t('製作：ボス素材3個で作れる／足りなければ作れない／同じ装備は2つ作れない', () => {
  const s = fresh(); s.inv.mats.bm_meadow = 2; ok(M.uniqueInfo(s, 'kojunotate').err); ok(!M.craftUnique(s, 'kojunotate').ok);
  s.inv.mats.bm_meadow = 3; const r = M.craftUnique(s, 'kojunotate'); ok(r.ok); eq(s.inv.mats.bm_meadow, 0); ok(s.inv.items[r.id]); eq(D.ITEMS[r.id].name, '古樹の盾飾り');
  s.inv.mats.bm_meadow = 3; ok(!M.craftUnique(s, 'kojunotate').ok, '2つ目は作れない');
});
t('製作：作るランクは そのとき解放済みの最高ランク（章ごとの上限あり）', () => {
  const s = fresh(); s.inv.mats.bm_meadow = 3; eq(W.uniqRank(M.craftUnique(s, 'kojunotate').id), 1);
  const s2 = fresh(); allRegions(s2); s2.inv.mats.bm_meadow = 3; eq(W.uniqRank(M.craftUnique(s2, 'kojunotate').id), 3, '第1章の装備はIIIまで');
  s2.inv.mats.bm_worldtree = 3; eq(W.uniqRank(M.craftUnique(s2, 'suitennomanto').id), 6);
});
t('再鍛造：外見・効果・強化値を保持してランクだけ上がる。装備中でも装着は保たれる。素材とコインを消費', () => {
  const s = fresh(); s.progress.clearedRegions = ['meadow', 'waterland', 'sandsea']; s.inv.mats.bm_meadow = 3; const id1 = M.craftUnique(s, 'kojunotate').id; eq(W.uniqRank(id1), 2);
  ok(M.uniqueInfo(s, 'kojunotate').reErr, '地底樹海を倒すまで再鍛造は開かない');
  allRegions(s); s.equip.acc = id1; s.inv.enhance[id1] = 2; s.inv.mats.ore_6 = 99;
  const i = M.uniqueInfo(s, 'kojunotate'); ok(!i.reErr, i.reErr); const c0 = s.coins, o0 = s.inv.mats.ore_6; const r = M.reforgeUnique(s, 'kojunotate');
  ok(r.ok); eq(r.to, 6); eq(s.coins, c0 - i.reCoin); eq(s.inv.mats.ore_6, o0 - i.reOre); ok(!s.inv.items[id1]); ok(s.inv.items[r.id]); eq(s.equip.acc, r.id); eq(s.inv.enhance[r.id], 2); eq(D.ITEMS[r.id].name, D.ITEMS[id1].name);
  ok(D.ITEMS[r.id].fx.firstReduce > D.ITEMS[id1].fx.firstReduce); ok(!M.reforgeUnique(s, 'kojunotate').ok, '最高ランクなら、これ以上は上がらない');
});
t('固有：売れない／返品できない。冒険中は作れない・再鍛造できない', () => {
  const s = fresh(); s.inv.mats.bm_meadow = 3; const id = M.craftUnique(s, 'kojunotate').id; ok(M.canSell(s, id)); ok(!M.canRefund(s, id));
  s.inv.mats.bm_waterland = 3; A.begin(s, 1000); ok(M.uniqueInfo(s, 'suishonomamori').err); ok(!M.craftUnique(s, 'suishonomamori').ok);
});
t('固有：図鑑は18種を1つずつ数える（ランクごとに増えない）', () => {
  const s = fresh(); const n0 = M.codexSummary(s).items.total; s.inv.mats.bm_meadow = 3; M.craftUnique(s, 'kojunotate'); const c = M.codexSummary(s); eq(c.items.total, n0); eq(c.items.got, 1 + 0 + (M.codexSummary(fresh()).items.got));
  ok(n0 >= 60 + 18 + 6, '通常60＋レア＋固有18＋秘境6');
});

// ---------- クエスト（再戦・試練・秘境・孤島・隠しボス） ----------
function runQuest(s, id, maxAdv, accOk) {
  let n = 0, ms = 1e12; const seen = [];
  while (s.progress.quest === id && n < maxAdv) {
    n++; ms += 3 * 3600e3;   // 日付をまたいで枠を使い切らない
    A.begin(s, ms); for (let i = 0; i < 10; i++) A.recordAnswer(s, { rid: 'r' + n + '_' + i, kind: 'basic', correct: accOk !== false, qid: 'q' }, ms);
    const r = A.settle(s, ms); seen.push(r);
  }
  return { n, seen };
}
t('クエスト構成：再戦18／試練2（3短編＋ボス）／秘境6（通常12＋ボス4）／孤島（通常30＋ボス6）', () => {
  eq(W.QUEST_ORDER.filter(i => W.QUESTS[i].kind === 'rematch').length, 18);
  ['trial_wing', 'trial_star'].forEach(i => { const q = W.QUESTS[i]; eq(q.segs.length, 6); eq(q.segs.filter(x => x.boss).length, 3); });
  W.SECRET_IDS.forEach(i => { const q = W.QUESTS[i]; eq(q.segs.length, 16); eq(q.segs.filter(x => x.boss).length, 4); });
  const isl = W.QUESTS.island; eq(isl.segs.length, 36); eq(isl.segs.filter(x => x.boss).length, 6); eq(isl.segs[35].enemy, 'xb_dawndragon');
});
t('敵の総数：通常66＋ボス18（本編）／試練ボス2／秘境ボス6／隠しボス1', () => {
  const main = Object.values(D.ENEMIES).filter(e => D.REGIONS.some(r => r.id === e.region));
  eq(main.filter(e => !e.boss).length, 66); eq(main.filter(e => e.boss).length, 18);
  eq(['tb_wing', 'tb_star'].filter(i => D.ENEMIES[i]).length, 2); eq(Object.keys(D.ENEMIES).filter(i => /^xb_/.test(i) && i !== 'xb_dawndragon').length, 6); ok(D.ENEMIES.xb_dawndragon.boss);
});
t('再戦：倒したボスだけ選べる。1勝でボス素材+1、コイン30、本編は動かない', () => {
  const s = fresh(); ok(M.questLocked(s, 'rematch_meadow')); ok(!M.selectQuest(s, 'rematch_meadow').ok);
  s.progress.clearedRegions = ['meadow']; strong(s); ok(!M.questLocked(s, 'rematch_meadow')); ok(M.selectQuest(s, 'rematch_meadow').ok);
  const step0 = s.progress.step, r = runQuest(s, 'rematch_meadow', 1); const x = r.seen[0];
  eq(s.progress.step, step0, '本編の進行は変わらない'); ok(x.outcome === 'victory', '強い主人公は1冒険で勝つ'); eq(x.coinKill, 30); eq(s.inv.mats.bm_meadow, 1); eq(M.questState(s, 'rematch_meadow').count, 1);
  eq(s.progress.quest, 'rematch_meadow', '再戦は選んだまま繰り返せる'); eq(M.questState(s, 'rematch_meadow').enemyHp, null, '倒したあとはHP満タンから');
});
t('試練：第2章クリアと上級2職Lv20が必要。クリアで最上級職に転職できる。クリア済みは再選択できない', () => {
  const s = fresh(); ok(M.questLocked(s, 'trial_wing'));
  strong(s); ok(M.questLocked(s, 'trial_wing'), '第2章を終えていない');
  D.REGIONS.filter(r => r.ch <= 2).forEach(r => s.progress.clearedRegions.push(r.id)); s.progress.step = D.REGION_START[12];
  ok(C.canChangeJob(s, 'skyknight'), '試練前は転職できない'); eq(M.questLocked(s, 'trial_wing'), null);
  const low = fresh(); D.REGIONS.filter(r => r.ch <= 2).forEach(r => low.progress.clearedRegions.push(r.id)); ok(M.questLocked(low, 'trial_wing'), 'Lv不足');
  ok(M.selectQuest(s, 'trial_wing').ok); const r = runQuest(s, 'trial_wing', 40); ok(s.quests.trial_wing.cleared, '40冒険以内にクリア（強い主人公）');
  const last = r.seen[r.seen.length - 1]; ok(last.clear && last.clear.trial === 'wing' && last.clear.title); eq(s.trials.wing, 1); eq(C.canChangeJob(s, 'skyknight'), null);
  ok(C.canChangeJob(s, 'starseer'), '星の試練は別'); ok(M.questLocked(s, 'trial_wing') === 'クリアずみ'); ok(!M.selectQuest(s, 'trial_wing').ok); eq(s.progress.quest, null);
  const sum = M.changeJob(s, 'skyknight'); ok(sum.ok); eq(s.job, 'skyknight');
});
t('試練：敗退や継続でも途中の状態（突破した短編・敵のHP）が保存される', () => {
  const s = fresh(); strong(s); allRegions(s); s.trials = {}; s.quests = {}; M.selectQuest(s, 'trial_wing'); const q = W.QUESTS.trial_wing;
  runQuest(s, 'trial_wing', 2); ok(s.quests.trial_wing.step >= 1 && s.quests.trial_wing.step <= 6, '短編をいくつか突破'); const step = s.quests.trial_wing.step;
  const s2 = JSON.parse(JSON.stringify(s)); M.ensure(s2); eq(M.questState(s2, 'trial_wing').step, step, '再読込しても戻らない'); eq(A.currentRoute(s2).step, step);
});
t('秘境：本編クリアで開く。クリアで秘境装備・称号・衣装・夜明けのかけら。孤島は6つで開く', () => {
  const s = fresh(); strong(s); ok(M.questLocked(s, 'secret_garden')); allRegions(s); eq(M.questLocked(s, 'secret_garden'), null);
  ok(M.questLocked(s, 'island')); const got = [];
  W.SECRET_IDS.forEach((id, i) => { ok(M.selectQuest(s, id).ok, id); const r = runQuest(s, id, 60); const q = W.QUESTS[id]; ok(s.quests[id].cleared, id + ' 60冒険以内'); const c = r.seen[r.seen.length - 1].clear; ok(c.item && c.title && c.costume, id); got.push(c.item); ok(s.inv.items[c.item]); eq(s.inv.mats['dawn_' + i], 1); if (i < 5) ok(M.questLocked(s, 'island')); });
  eq(new Set(got).size, 6); eq(M.questLocked(s, 'island'), null);
  ok(M.selectQuest(s, 'island').ok); const r = runQuest(s, 'island', 120); ok(s.quests.island.cleared, '孤島クリア'); const c = r.seen[r.seen.length - 1].clear; ok(c.lamp && c.title === '空の果てを見た者'); ok(s.rewards.lamp); ok(s.rewards.titles.includes('空の果てを見た者'));
  ok(M.setOutfit(s, 'dawn') && s.look.outfit === 'dawn'); ok(!M.setOutfit(fresh(), 'dawn'), '持っていない衣装は選べない'); ok(M.costumeColor(s));
});
t('クエストの清算は一度だけ（再清算・再実行で報酬が二重にならない）', () => {
  const s = fresh(); strong(s); allRegions(s); M.selectQuest(s, 'secret_garden'); runQuest(s, 'secret_garden', 60); const before = JSON.stringify([s.coins, s.advXp, s.inv.mats, s.rewards]);
  A.settle(s, 1e12 + 1); eq(JSON.stringify([s.coins, s.advXp, s.inv.mats, s.rewards]), before);
});
t('クエスト：冒険の途中は選び直せない。秘境の宝箱・日次枠は本編と同じ扱い', () => {
  const s = fresh(); strong(s); allRegions(s); A.begin(s, 1000); ok(!M.selectQuest(s, 'secret_garden').ok); s.active = null;
  M.selectQuest(s, 'secret_garden'); A.begin(s, 1e12); for (let i = 0; i < 10; i++) A.recordAnswer(s, { rid: 'z' + i, kind: 'basic', correct: true, qid: 'q' }, 1e12); const r = A.settle(s, 1e12); eq(r.slot.no, 1); ok(r.chest, '1回目の枠は宝箱あり'); eq(r.bg, 'garden');
});
t('本編クリア時に mainClear が立つ（エンディングへの導線）。クリア後の再戦は mainClear にならない', () => {
  const s = fresh(); strong(s); s.progress.clearedRegions = D.REGIONS.slice(0, 17).map(r => r.id); s.progress.step = D.REGION_START[17]; let last = null;
  for (let n = 0; n < 40 && !s.progress.clearedRegions.includes('crown'); n++) { A.begin(s, 1e12 + n * 3600e3 * 3); for (let i = 0; i < 10; i++) A.recordAnswer(s, { rid: 'm' + n + i, kind: 'basic', correct: true, qid: 'q' }, 1e12 + n * 1e7); last = A.settle(s, 1e12 + n * 1e7); }
  ok(s.progress.clearedRegions.includes('crown')); ok(last.mainClear); eq(s.progress.step, D.ROUTE.length); ok(M.mainCleared(s));
});

// ---------- おはなし ----------
t('おはなし：全300区間＋全クエストの区間に 1〜3画面。空の文章なし。第3章の全地点名が出る', () => {
  let n = 0; const chk = r => { const p = ST.pagesFor(r); n++; ok(p.length >= 1 && p.length <= 3, 'ページ数 ' + p.length + ' ' + r.point); p.forEach(x => ok(x.text && x.text.length > 3 && x.text.length <= 60)); };
  D.ROUTE.forEach(chk); Object.values(W.QUESTS).forEach(q => q.segs.forEach(chk));
  D.REGIONS.filter(r => r.ch === 3).forEach(r => r.points.forEach((pt, i) => { const route = D.ROUTE[D.REGION_START[r.idx] + i * 3 + (i === 0 ? 1 : 0)]; ok(ST.pagesFor(route).some(x => x.text.includes(pt)) || i === 0, pt); }));
  ok(n > 450);
});
t('おはなし：ボス戦の最初の区間に ボスの前の会話。悪い結末なし（敗退でも文章は同じ）', () => {
  const be = D.ROUTE.find(r => r.boss && r.seg === 1 && r.region === 0), p = ST.pagesFor(be); ok(p.length >= 2); eq(ST.pagesFor(be), p);
});

// ---------- 音 ----------
t('音：初期はオフ。オフのときは AudioContext を作らない。オン＋操作後だけ鳴る。使えなくても例外なし', () => {
  let made = 0, played = 0;
  class FakeAC { constructor() { made++; this.currentTime = 0; this.state = 'running'; this.destination = {}; } createOscillator() { return { frequency: {}, connect() {}, start() { played++; }, stop() {} }; } createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } }
  const save = M.ensure(C.newSave(0)); eq(save.settings.sound, false, '初期はオフ');
  global.self = { RPG: { ok: true, save }, addEventListener() {}, AudioContext: FakeAC }; delete require.cache[require.resolve('../js/rpg-sound.js')]; require('../js/rpg-sound.js'); const S = global.self.RPG.sound;
  S.unlock(); S.play('reward'); eq(made, 0, 'オフでは作らない'); eq(played, 0);
  save.settings.sound = true; S.play('reward'); eq(played, 0, '操作前は鳴らない'); S.unlock(); eq(made, 1); S.play('reward'); ok(played >= 4); const p0 = played; S.play('nope'); eq(played, p0);
  save.settings.sound = false; S.play('level'); eq(played, p0, 'オフに戻すと鳴らない');
  global.self = { RPG: { ok: true, save: Object.assign({}, save, { settings: { sound: true } }) }, addEventListener() {} }; delete require.cache[require.resolve('../js/rpg-sound.js')]; require('../js/rpg-sound.js'); global.self.RPG.sound.unlock(); global.self.RPG.sound.play('hit');
  Object.keys(S.SEQ).forEach(k => ok(S.SEQ[k].every(n => n[0] > 50 && n[0] < 4000 && n[1] < 0.5 && n[3] <= 0.1), k + ' 小さく短い'));
  delete global.self;
});

// ---------- データ検査 ----------
t('検査：全クエストの敵・装備・素材・解放条件の参照が揃い、循環しない', () => {
  Object.values(W.QUESTS).forEach(q => {
    ok(q.segs.length >= 1 && q.bg); q.segs.forEach((x, i) => { ok(D.ENEMIES[x.enemy], q.id + i); ok(x.stats.hp > 0 && x.stats.atk > 0 && x.stats.def >= 0); eq(x.quest, q.id); ok(x.step === i || q.kind === 'rematch'); });
    if (q.kind === 'secret') { ok(D.ITEMS[q.def.item.id], q.id); ok(M.fxText(D.ITEMS[q.def.item.id].fx)); }
    if (q.kind !== 'rematch') ok(q.coinFirst > 0 && q.mat && q.title && q.costume, q.id);
  });
  Object.values(D.ENEMIES).forEach(e => { ok(e.pattern.length >= 1 && e.pattern.every(p => ['atk', 'big', 'guard', 'charge', 'brace', 'idle'].includes(p.k)), e.id); ok(!e.weak || D.ELEMENTS.includes(e.weak), e.id); ok(e.pattern.some(p => p.k === 'atk'), e.id + '：攻撃を持つ'); });
  // 大技の予告は battle.js が毎回 tele を立てる（meta.js の既存検査も全敵を対象にする）
});
t('検査：全装備の入手経路（通常＝店／レア＝宝箱／固有＝ボス素材／秘境装備＝秘境クリア）。入手不能な装備なし', () => {
  const ways = {}; Object.values(D.ITEMS).forEach(i => { if (i.id === 'w_start') return; ways[i.id] = i.rarity === 'normal' ? 'shop' : i.rarity === 'rare' ? 'chest' : i.relic ? 'secret' : 'boss'; });
  const secretItems = W.SECRET_DEFS.map(d => d.item.id); Object.keys(ways).forEach(id => { if (ways[id] === 'secret') ok(secretItems.includes(id), id); if (ways[id] === 'boss') ok(W.UNIQ_BY_KEY[D.ITEMS[id].unique], id); });
  W.UNIQ.forEach(u => { ok(D.REGIONS.some(r => 'bm_' + r.id === u.mat), u.key); ok(u.region.boss.id); });
  const s = fresh(); allRegions(s); D.WISH_LIST.forEach(w => { for (let r = 1; r <= 6; r++) ok(Object.values(D.ITEMS).some(i => i.rarity === 'rare' && i.wish === w && i.rank === r), w + r); });
});
t('検査：固有装備の地域・章の対応が設計書の表どおり（18＝6地域×3章）', () => {
  const tbl = { meadow: ['古樹の盾飾り', '根源の指輪', '翠天のマント'], waterland: ['水晶のまもり', '潮音の杖', '深碧の護符'], sandsea: ['時砂の短剣', '双面の指輪', '天秤のつるぎ'], mountain: ['白銀の胸当て', '熔晶の武器飾り', '極光の衣'], gearcity: ['黒鋼の盾飾り', '巨兵の弓', '城塞の鎧'], skycastle: ['機神の指輪', '記憶の護符', '王冠の星飾り'] };
  Object.keys(tbl).forEach((k, ri) => tbl[k].forEach((nm, ci) => { const u = W.UNIQ.find(x => x.name === nm); ok(u, nm); eq(u.ch, ci + 1, nm); eq(u.ri, ri, nm); }));
});
t('検査：古いセーブ（第3段の欄なし）を読み込んでも壊れない。書き出し・読み込みでクエスト進行が残る', () => {
  const old = C.newSave(0); delete old.quests; delete old.rewards; old.progress = { step: 5, enemyHp: null, clearedRegions: [], bossKills: {} };
  ok(C.validateSave(old).length === 0); const e = M.ensure(JSON.parse(JSON.stringify(old))); ok(e.quests && e.rewards && e.progress.quest === null && e.settings.sound === false);
  const s = fresh(); strong(s); allRegions(s); M.selectQuest(s, 'secret_pearl'); runQuest(s, 'secret_pearl', 3); const txt = C.buildExport({ stats: { a: { w: 0, c: 1, s: 1 } }, rpg: s }, 1), p = C.parseImport(txt); ok(p.ok);
  eq(M.ensure(p.data.rpg).quests.secret_pearl.step, s.quests.secret_pearl.step);
});
t('検査：試験用セーブ6つ（tests/saves）が検証を通り、読み込める', () => {
  const fs = require('fs'), path = require('path'), dir = path.join(__dirname, 'saves'); if (!fs.existsSync(dir)) return;
  const names = ['day01', 'day14', 'ch1end', 'ch2end', 'maingoal', 'postgame'];
  names.forEach(n => { const f = path.join(dir, n + '.json'); ok(fs.existsSync(f), n + ' が無い'); const o = JSON.parse(fs.readFileSync(f, 'utf8')); eq(C.validateSave(o), [], n); const s = M.ensure(o); ok(C.heroLevel(s.advXp).lv >= 1); });
});

console.log(JSON.stringify({ pass, fail, failures }, null, 1));
process.exit(fail ? 1 : 0);
