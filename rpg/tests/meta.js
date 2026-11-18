'use strict';
// node rpg/tests/meta.js — 第2段（街・店・鍛冶・転職・技設定・外見・図鑑・実績）のDOM不要テスト
const D = require('../js/rpg-data.js'), C = require('../js/rpg-core.js'), B = require('../js/rpg-battle.js'), M = require('../js/rpg-meta.js'), A = require('../js/rpg-adventure.js');
let pass = 0, fail = 0; const failures = [];
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; failures.push(name + ' → ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' 期待 ' + JSON.stringify(b) + ' 実際 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ok でない'); }
const fresh2 = () => { const s = M.ensure(C.newSave(0)); s.firstDone = true; s.coins = 5000; return s; };

t('店：買う→返品は同額（未使用のみ）、冒険に装備して出ると返品できない', () => {
  const s = fresh2(), c0 = s.coins; ok(M.buyChecked(s, 'w_sword_1').ok); eq(s.coins, c0 - 240); ok(M.canRefund(s, 'w_sword_1'));
  eq(M.refund(s, 'w_sword_1').coin, 240); eq(s.coins, c0); ok(!s.inv.items.w_sword_1);
  M.buyChecked(s, 'w_sword_1'); M.setEquip(s, { weapon: 'w_sword_1' }); A.begin(s, 1000); ok(!M.canRefund(s, 'w_sword_1'), '冒険に出たら返品不可');
});
t('店：ランク解放前・所持済み・コイン不足は買えない', () => { const s = fresh2(); ok(!M.buyChecked(s, 'w_sword_2').ok); M.buyChecked(s, 'w_sword_1'); ok(!M.buyChecked(s, 'w_sword_1').ok); s.coins = 10; ok(!M.buyChecked(s, 'a_heavy_1').ok); });
t('店：売却は店価の25%、装備中・初期武器は売れない', () => {
  const s = fresh2(); M.buyChecked(s, 'a_heavy_1'); M.setEquip(s, { armor: 'a_heavy_1' }); eq(M.canSell(s, 'a_heavy_1'), 'そうびちゅう'); eq(M.canSell(s, 'w_start'), '売れない');
  M.setEquip(s, { armor: null }); const c = s.coins; eq(M.sell(s, 'a_heavy_1').coin, 45); eq(s.coins, c + 45);
});
t('鍛冶：+3まで、費用は店価20/35/50%・素材2/4/6、必ず成功、基準値の+5%ずつ', () => {
  const s = fresh2(); M.buyChecked(s, 'w_sword_1'); s.inv.mats.ore_1 = 12; const c0 = s.coins;
  eq(M.enhanceInfo(s, 'w_sword_1').coin, 48); ok(M.enhance(s, 'w_sword_1').ok);
  ok(M.enhance(s, 'w_sword_1').ok); ok(M.enhance(s, 'w_sword_1').ok); eq(M.enhLv(s, 'w_sword_1'), 3);
  eq(s.coins, c0 - 48 - 84 - 120); eq(s.inv.mats.ore_1, 12 - 12); ok(!M.enhance(s, 'w_sword_1').ok);
  const w = fresh2(); w.inv.items.w_sword_3 = 1; w.inv.enhance.w_sword_3 = 3; eq(M.statOf(w, 'w_sword_3').atk, 22 + Math.round(22 * 0.15));
});
t('鍛冶：レアは基準値(通常品)の +10% に強化+5%ずつを足す（+3で1.25倍）', () => {
  const s = fresh2(); s.inv.items.rw_sword_3 = 1; s.inv.enhance.rw_sword_3 = 3; eq(M.statOf(s, 'rw_sword_3').atk, Math.round(22 * 1.1) + Math.round(22 * 0.15));
  eq(D.enhBonus(D.ITEMS.rw_sword_3, 3), Math.round(22 * 0.15));
});
t('強化は戦闘の能力値に反映される（武器・防具は数値、アクセサリーは効果量）', () => {
  const a = B.heroStats(10, 'warrior', 5, { weapon: 'w_sword_3', armor: 'a_heavy_3', acc: 'x_charm_3' }), b = B.heroStats(10, 'warrior', 5, { weapon: 'w_sword_3', armor: 'a_heavy_3', acc: 'x_charm_3', enh: { weapon: 3, armor: 3, acc: 3 } });
  ok(b.atk > a.atk && b.def > a.def && b.maxHp > a.maxHp);
});
t('鍛冶：冒険の途中は強化できない／初期武器は強化できない', () => { const s = fresh2(); M.buyChecked(s, 'w_sword_1'); s.inv.mats.ore_1 = 5; ok(!M.enhanceInfo(s, 'w_sword_1').err); ok(M.enhanceInfo(s, 'w_start').err); A.begin(s, 1); ok(M.enhanceInfo(s, 'w_sword_1').err); });
t('装備：使えない系統の武器は装着できない／確定するまでセーブは変わらない／冒険中は変更不可', () => {
  const s = fresh2(); M.buyChecked(s, 'w_staff_1'); ok(M.canEquip(s, 'w_staff_1', 'warrior')); eq(M.canEquip(s, 'w_staff_1', 'mage'), null);
  const before = JSON.stringify(s.equip); M.statsWith(s, { weapon: 'w_staff_1' }); eq(JSON.stringify(s.equip), before);
  ok(!M.setEquip(s, { weapon: 'w_staff_1' }).ok); M.buyChecked(s, 'w_sword_1'); ok(M.setEquip(s, { weapon: 'w_sword_1' }).ok); A.begin(s, 1); ok(!M.setEquip(s, { weapon: null }).ok);
});
t('装備：性能差の計算（おすすめ＝いちばん強い使える装備）', () => {
  const s = fresh2(); M.buyChecked(s, 'w_sword_1'); M.buyChecked(s, 'a_heavy_1'); const r = M.recommendEquip(s); eq(r.weapon, 'w_sword_1'); eq(r.armor, 'a_heavy_1');
  ok(M.statsWith(s, r).atk > M.statsWith(s, { weapon: 'w_start' }).atk);
});
t('転職：最初の冒険前は不可、基本職は無料で変更、未所有系統の武器が支給される、冒険中は不可', () => {
  const n = M.ensure(C.newSave(0)); ok(M.changeJob(n, 'mage').err); const s = fresh2(); const r = M.changeJob(s, 'mage'); ok(r.ok); eq(s.job, 'mage'); eq(r.gifts, ['w_staff_1']); eq(s.equip.weapon, 'w_staff_1');
  ok(!M.changeJob(s, 'mage').ok); A.begin(s, 1); ok(M.changeJob(s, 'thief').err);
});
t('転職：上級職はLv条件、最上級は試練前は不可。12職すべてに条件文がある', () => {
  const s = fresh2(); ok(M.changeJob(s, 'magicknight').err); s.jobXp.warrior = s.jobXp.mage = C.cum(C.NEED.base, 10); ok(M.changeJob(s, 'magicknight').ok);
  eq(M.jobProgress(s, 'magicknight').every(r => r.done), true); ok(M.changeJob(s, 'skyknight').err); eq(D.JOB_IDS.length, 12);
  D.JOB_IDS.forEach(j => { ok(D.JOBS[j].tier === 'base' || M.jobProgress(s, j).length > 0, j); });
});
t('技設定：3枠＋継承1枠、継承枠はLv5から、検証に通らない組は保存しない', () => {
  const s = fresh2(); s.jobXp.warrior = C.cum(C.NEED.base, 8); s.jobXp.mage = C.cum(C.NEED.base, 5);
  ok(M.setLoadout(s, ['w_strike', 'w_shield', 'w_rock'], 'guard').ok); eq(s.loadout.tactic, 'guard');
  ok(M.setLoadout(s, ['w_strike', 'w_rock', 'm_fire'], 'auto').ok);
  ok(!M.setLoadout(s, ['w_strike', 'w_rock', 'w_brave'], 'auto').ok);
  ok(!M.setLoadout(s, ['m_fire', 'm_ice', 'w_strike'], 'auto').ok);
  ok(!M.setLoadout(s, ['w_strike'], 'xx').ok); eq(s.loadout.tactic, 'auto');
});
t('技設定：冒険の開始時に固定され、途中で変えられない', () => { const s = fresh2(); s.jobXp.warrior = C.cum(C.NEED.base, 8); M.setLoadout(s, ['w_strike', 'w_shield', 'w_rock'], 'attack'); const a = A.begin(s, 1); eq(a.hero.skills, ['w_strike', 'w_shield', 'w_rock']); eq(a.hero.tactic, 'attack'); ok(!M.setLoadout(s, ['w_strike'], 'auto').ok); });
t('外見：名前は8字まで・記号除去、範囲外は拒否、職業や装備に影響しない', () => {
  const s = fresh2(); ok(M.setLook(s, '<b>あいうえおかきくけこ</b>', { face: 2, hair: 5, skin: 4, hairColor: 5 }).ok); eq(s.name.length, 8); ok(!s.name.includes('<')); eq(s.look.hair, 5);
  ok(!M.setLook(s, 'x', { face: 4, hair: 0, skin: 0, hairColor: 0 }).ok); ok(!M.setLook(s, 'x', { face: 0, hair: 0, skin: 9, hairColor: 0 }).ok); eq(s.job, 'warrior');
});
t('図鑑：冒険の開始で出会い、討伐で撃破数が増える／宝箱・購入で装備が載る', () => {
  const s = fresh2(); A.begin(s, 1); ok(s.codex.enemies.e_leafslime.seen); eq(M.codexSummary(s).enemies.seen, 1);
  M.buyChecked(s, 'a_light_1'); ok(s.codex.items.a_light_1); C.grantItem(s, 'rw_sword_1'); ok(s.codex.items.rw_sword_1);
});
t('実績：保存値から計算され、報酬を持たない（進捗が増えるだけ）', () => {
  const s = fresh2(); const a0 = M.achievements(s); ok(a0.length >= 20 && a0.every(x => x.need > 0)); eq(a0.filter(x => x.done).length, 0);
  s.stats.adventures = 10; s.jobXp.warrior = C.cum(C.NEED.base, 5); s.name = 'ゆう'; const a1 = M.achievements(s); ok(a1.find(x => x.id === 'adv10').done && a1.find(x => x.id === 'job5').done && a1.find(x => x.id === 'name').done);
});
t('古いセーブ（codex等なし）を ensure で読み込める', () => { const s = C.newSave(0); delete s.codex; delete s.goal; delete s.inv.fresh; M.ensure(s); ok(s.codex && s.inv.fresh && s.goal === null); eq(C.validateSave(s), []); });
t('冒険地図：進み具合と現在地', () => { const s = fresh2(); s.progress.step = 14; s.progress.clearedRegions.push('meadow'); const m = M.mapInfo(s); ok(m[0].cleared && m[1].current && !m[2].current && m[2].locked && m[1].inRegion === 2); ok(M.mapInfo(s)[0].cleared); });
t('全装備の効果文・全技の説明文が空にならない', () => {
  Object.values(D.ITEMS).filter(i => i.fx).forEach(i => ok(M.fxText(i.fx), i.id));
  Object.values(D.SKILLS).forEach(k => ok(M.skillText(k, 30), k.id));
});

console.log(JSON.stringify({ pass, fail, failures }, null, 1));
process.exit(fail ? 1 : 0);
