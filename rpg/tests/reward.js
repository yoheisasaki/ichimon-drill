'use strict';
// node rpg/tests/reward.js — 報酬と宝箱（07 確認票 D03/D04/D06/D07/D08/D09）のDOM不要テスト
const D = require('../js/rpg-data.js'), C = require('../js/rpg-core.js'), M = require('../js/rpg-meta.js'), A = require('../js/rpg-adventure.js');
let pass = 0, fail = 0; const failures = [];
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; failures.push(name + ' → ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' 期待 ' + JSON.stringify(b) + ' 実際 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ok でない'); }
const JST = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 9, mi || 0);
function memStorage() { const m = {}; const st = { get: k => (k in m ? m[k] : null), set: (k, v) => { if (st.opt && st.opt.failSet) throw new Error('quota'); m[k] = v; }, m, opt: null }; return st; }
const fresh = () => { const s = M.ensure(C.newSave(0)); s.welcomeDone = true; return s; };
function playAdv(save, ms, acc, tag) {
  A.begin(save, ms); let n = 0; const reviews = [];
  for (let i = 0; i < 10; i++) { const ok = i < acc; const r = A.recordAnswer(save, { rid: tag + i, kind: 'basic', correct: ok }, ms); if (!ok && A.queueReview(save, r.origin, { id: 'q' + i })) reviews.push(r.origin); }
  reviews.forEach((o, k) => A.recordAnswer(save, { rid: tag + 'r' + k, kind: 'review', correct: true, origin: o }, ms));
}
const settleAt = (s, ms, acc, tag) => { playAdv(s, ms, acc, tag); return A.settle(s, ms); };
const setRoll = (s, id, roll) => { C.chestById(s, id).roll = roll; };
const RARE = { kind: 'rare', rank: 1, wish: 'sword', pityBefore: 0, item: 'rw_sword_1' };
const COIN = { kind: 'coinmat', rank: 1, wish: 'sword', pityBefore: 0, coin: 40, mats: { ore_1: 2 } };
const MAT = { kind: 'mat', rank: 1, wish: 'sword', pityBefore: 0, mats: { ore_1: 4 } };

// ===== D03 開封前：合計＝学習＋討伐。箱の分は残高にも合計にも入らない =====
[10, 7, 3, 0].forEach(acc => t('D03 開封前の合計＝学習＋討伐（正解' + acc + '／10）', () => {
  const s = fresh(), c0 = s.coins, r = settleAt(s, JST(2026, 11, 18, 10), acc, 'a');
  const tot = C.rewardTotals(r, C.chestById(s, r.chestId));
  eq(tot.total, r.coinAnswers + r.coinKill + r.coinWelcome, '合計');
  eq(tot.chestCoin, 0); eq(tot.opened, false); eq(s.coins, c0 + tot.total, '残高');
  ok(!/宝箱/.test(tot.text), '開封前の表示に箱の分が出ない: ' + tot.text);
  eq(C.chestById(s, r.chestId).status, 'sealed'); eq(C.chestById(s, r.chestId).result, null, '中身は未公開');
}));
t('D03 初回のお祝いコインも内訳に含めて合計が一致', () => {
  const s = M.ensure(C.newSave(0)), r = settleAt(s, JST(2026, 11, 18, 10), 10, 'w');
  eq(r.coinWelcome, 160); eq(C.rewardTotals(r, C.chestById(s, r.chestId)).total, r.coinAnswers + r.coinKill + 160); eq(s.coins, r.coin);
});
t('D03 3回目の冒険は箱なし（chestId なし・箱の保存なし）', () => {
  const s = fresh(); const rs = [0, 1, 2].map(i => settleAt(s, JST(2026, 11, 18, 10 + i), 9, 'g' + i));
  eq(rs.map(r => !!r.chestId), [true, true, false]); eq(s.chests.length, 2);
});

// ===== D04 開封後：増分・内訳・最終残高が一致（複数ケース） =====
t('D04 例：全正解・通常敵 135 ＋ 箱40 ＝ 175、残高も一致', () => {
  const s = fresh(), r = settleAt(s, JST(2026, 11, 18, 10), 10, 'x');
  eq(r.coin, 135); eq(r.xp, 450); setRoll(s, r.chestId, COIN);
  const before = s.coins, o = C.openChest(s, r.chestId), tot = C.rewardTotals(r, o.chest);
  eq(tot.text, '学習・討伐135＋宝箱40＝合計175'); eq(s.coins, before + 40); eq(s.coins, 175);
});
[['コイン箱', COIN, 40, 2], ['素材箱', MAT, 0, 4], ['レア箱', RARE, 0, 0]].forEach(([nm, roll, cc, ore]) => [10, 6, 0].forEach(acc => t('D04 ' + nm + '・正解' + acc + '：増分と残高が一致', () => {
  const s = fresh(), r = settleAt(s, JST(2026, 11, 18, 10), acc, 'y'); setRoll(s, r.chestId, roll);
  const coin0 = s.coins, ore0 = s.inv.mats.ore_1 || 0, o = C.openChest(s, r.chestId), tot = C.rewardTotals(r, o.chest);
  eq(tot.chestCoin, cc); eq(tot.total, tot.base + cc); eq(s.coins, coin0 + cc); eq(s.coins, r.coin + cc);
  eq((s.inv.mats.ore_1 || 0) - ore0, ore); if (roll.kind === 'rare') ok(s.inv.items.rw_sword_1);
  eq(tot.text, '学習・討伐' + r.coin + '＋宝箱' + cc + '＝合計' + (r.coin + cc));
})));
t('D04 重複レア：交換素材3個（同ランク）、レア自体は増えない', () => {
  const s = fresh(); s.inv.items.rw_sword_1 = 1; const r = settleAt(s, JST(2026, 11, 18, 10), 10, 'd'); setRoll(s, r.chestId, RARE);
  const o = C.openChest(s, r.chestId); ok(o.result.dup); eq(o.result.ore, 3); eq(s.inv.mats.ore_1, 3);
});
t('D04 pity は箱の獲得時に一度だけ進む（開封では動かない）', () => {
  const s = fresh(); const p0 = s.chest.pity, r = settleAt(s, JST(2026, 11, 18, 10), 10, 'p');
  const kind = C.chestById(s, r.chestId).roll.kind; eq(s.chest.pity, kind === 'rare' ? 0 : p0 + 1);
  const p1 = s.chest.pity; C.openChest(s, r.chestId); C.openChest(s, r.chestId); eq(s.chest.pity, p1);
  A.settle(s, 0); eq(s.chest.pity, p1, '清算の再実行で進まない');
});

// ===== D06 未開封で終了→再読込→後日開封。同じ内容を1度だけ =====
t('D06 未開封で保存→再読込→後日（別の日）に開封、2回目は付与なし', () => {
  const st = memStorage(), store = C.makeStore(st); const s = fresh(); store.save(s);
  const r = settleAt(s, JST(2026, 11, 18, 10), 10, 'h'); ok(store.save(s).ok);
  const l = store.load(JST(2026, 11, 25, 10)); ok(l.ok); const s2 = M.ensure(l.save);
  eq(C.sealedChests(s2).map(c => c.id), [r.chestId], '再読込後も未開封');
  const roll = JSON.stringify(C.chestById(s2, r.chestId).roll), coin0 = s2.coins;
  const o = C.openChestPersist(s2, store, r.chestId, JST(2026, 11, 25, 10)); ok(o.ok && !o.already);
  const l2 = store.load(0), s3 = M.ensure(l2.save);
  eq(C.chestById(s3, r.chestId).status, 'opened'); eq(JSON.stringify(C.chestById(s3, r.chestId).roll), roll, '再抽選なし');
  const after = JSON.stringify({ c: s3.coins, i: s3.inv });
  const o2 = C.openChestPersist(s3, store, r.chestId, 0); ok(o2.ok && o2.already); eq(JSON.stringify({ c: s3.coins, i: s3.inv }), after);
  ok(s3.coins >= coin0);
});
t('D06 未開封の古い箱が、新しい冒険の「今回の箱」に混ざらない（chestId が別）', () => {
  const s = fresh(); const r1 = settleAt(s, JST(2026, 11, 18, 10), 10, 'm1'), r2 = settleAt(s, JST(2026, 11, 18, 11), 10, 'm2'), r3 = settleAt(s, JST(2026, 11, 18, 12), 10, 'm3');
  ok(r1.chestId && r2.chestId && r1.chestId !== r2.chestId); eq(r3.chestId, null); eq(C.sealedChests(s).length, 2);
  C.openChest(s, r1.chestId); eq(C.sealedChests(s).map(c => c.id), [r2.chestId]);
});

// ===== D07 連打・演出中の再読込・2タブ・保存失敗 =====
t('D07 開封の連打：付与は1回', () => {
  const st = memStorage(), store = C.makeStore(st), s = fresh(); store.save(s); const r = settleAt(s, JST(2026, 11, 18, 10), 10, 'k'); store.save(s); setRoll(s, r.chestId, COIN); store.save(s);
  const c0 = s.coins; for (let i = 0; i < 5; i++) C.openChestPersist(s, store, r.chestId, 0); eq(s.coins, c0 + 40); eq(s.inv.mats.ore_1, 2);
});
t('D07 演出の途中で再読込しても、保存済みなので取りこぼし・再付与なし', () => {
  const st = memStorage(), store = C.makeStore(st), s = fresh(); store.save(s); const r = settleAt(s, JST(2026, 11, 18, 10), 10, 'n'); store.save(s); setRoll(s, r.chestId, COIN); store.save(s);
  const c0 = s.coins; C.openChestPersist(s, store, r.chestId, 0);   // ここで保存が済み、その後に演出が走る。演出中に再読込:
  const s2 = M.ensure(store.load(0).save); eq(s2.coins, c0 + 40, '付与は保存済み'); eq(C.chestById(s2, r.chestId).status, 'opened');
  C.openChestPersist(s2, store, r.chestId, 0); eq(s2.coins, c0 + 40);
});
t('D07 2タブ：先に開けたタブだけが付与。後のタブは読み直して開封済みを表示', () => {
  const st = memStorage(), store = C.makeStore(st), s = fresh(); store.save(s); const r = settleAt(s, JST(2026, 11, 18, 10), 10, 'z'); store.save(s); setRoll(s, r.chestId, COIN); store.save(s);
  const a = M.ensure(store.load(0).save), b = M.ensure(store.load(0).save), c0 = a.coins;
  const oa = C.openChestPersist(a, store, r.chestId, 0); ok(oa.ok && !oa.already);
  const ob = C.openChestPersist(b, store, r.chestId, 0); ok(ob.ok && ob.already && ob.reloaded, JSON.stringify(ob));
  eq(a.coins, c0 + 40); eq(b.coins, c0 + 40); eq(M.ensure(store.load(0).save).coins, c0 + 40, '保存上も1回分');
});
t('D07 保存失敗：付与されず sealed のまま。回復後に1回だけ付与', () => {
  const st = memStorage(), store = C.makeStore(st), s = fresh(); store.save(s); const r = settleAt(s, JST(2026, 11, 18, 10), 10, 'f'); store.save(s); setRoll(s, r.chestId, COIN); store.save(s);
  const c0 = s.coins, inv0 = JSON.stringify(s.inv); st.opt = { failSet: true };
  const o = C.openChestPersist(s, store, r.chestId, 0); eq(o.ok, false); eq(s.coins, c0); eq(JSON.stringify(s.inv), inv0); eq(C.chestById(s, r.chestId).status, 'sealed');
  st.opt = null; const o2 = C.openChestPersist(s, store, r.chestId, 0); ok(o2.ok && !o2.already); eq(s.coins, c0 + 40);
  eq(M.ensure(store.load(0).save).coins, c0 + 40);
});

// ===== D08 旧セーブ移行：付与済みの箱は受取済み。再加算・減算なし =====
function oldSave(chest) {   // 旧仕様：抽選と同時に残高へ付与済みで lastResult.chest に入る
  const s = C.newSave(0); s.firstDone = true; s.coins = 500; s.inv.mats.ore_1 = 2;
  s.lastResult = { id: 'adv9', outcome: 'victory', coin: 135, xp: 450, chest }; s.seen = { lastChest: 'adv9' };
  return s;
}
t('D08 旧セーブ（付与済みのコイン箱）：受取済みで表示、残高は変わらない', () => {
  const s = oldSave({ kind: 'coinmat', rank: 1, coin: 40, mats: { ore_1: 2 } }), snap = JSON.stringify({ c: s.coins, m: s.inv.mats, i: s.inv.items });
  M.ensure(s); eq(JSON.stringify({ c: s.coins, m: s.inv.mats, i: s.inv.items }), snap, '移行で残高が動かない');
  const c = C.chestById(s, 'adv9:chest'); eq(c.status, 'opened'); ok(c.legacy); eq(c.result.coin, 40); eq(s.lastResult.chestId, 'adv9:chest');
  const o = C.openChest(s, 'adv9:chest'); ok(o.already); eq(s.coins, 500); eq(C.sealedChests(s).length, 0);
  M.ensure(s); M.ensure(s); eq(s.chests.length, 1, '何度 ensure しても1件'); eq(C.validateSave(s), []);
  eq(C.rewardTotals(s.lastResult, c).text, '学習・討伐135＋宝箱40＝合計175');
});
t('D08 旧セーブ（付与済みのレア箱）：所持品はそのまま、重複扱いで素材を足さない', () => {
  const s = oldSave({ kind: 'rare', rank: 1, item: 'rw_sword_1', dup: false }); s.inv.items.rw_sword_1 = 1; const mats0 = JSON.stringify(s.inv.mats);
  M.ensure(s); C.openChest(s, 'adv9:chest'); eq(JSON.stringify(s.inv.mats), mats0); eq(s.inv.items.rw_sword_1, 1); eq(s.coins, 500);
});
t('D08 判断できない旧状態（箱の記録なし）は推測で付与せず、箱も作らない', () => {
  const s = C.newSave(0); s.seen = { lastChest: 'advX' }; s.lastResult = { id: 'advX', outcome: 'victory', coin: 100, xp: 100 };
  const snap = JSON.stringify({ c: s.coins, i: s.inv }); M.ensure(s); eq(s.chests, []); eq(JSON.stringify({ c: s.coins, i: s.inv }), snap);
  const s2 = C.newSave(0); s2.lastResult = null; M.ensure(s2); eq(s2.chests, []);
});
t('D08 新旧が混在：新しい未開封箱は移行の影響を受けず sealed のまま', () => {
  const s = oldSave({ kind: 'mat', rank: 1, mats: { ore_1: 4 } }); M.ensure(s);
  s.firstDone = true; const r = settleAt(s, JST(2026, 11, 18, 10), 10, 'q'); M.ensure(s);
  eq(C.sealedChests(s).map(c => c.id), [r.chestId]); eq(s.chests.length, 2);
});

// ===== D09 4時境界・未完冒険の再開で日次枠が増えない =====
t('D09 午前4時境界：3:59までは前日の枠、4:00で新しい日の枠（箱も新しく1個目）', () => {
  const s = fresh(); const r1 = settleAt(s, JST(2026, 11, 18, 3, 30), 10, 'b1'), r2 = settleAt(s, JST(2026, 11, 18, 3, 59), 10, 'b2'), r3 = settleAt(s, JST(2026, 11, 18, 4, 0), 10, 'b3');
  eq([r1.slot.no, r2.slot.no, r3.slot.no], [1, 2, 1]); eq([r1.slot.key, r3.slot.key], ['2026-11-17', '2026-11-18']); ok(r3.chestId);
});
t('D09 未完の冒険を再読込して再開：枠は1回分、清算を重ねても箱・XP・コインは1回', () => {
  const s = fresh(); A.begin(s, JST(2026, 11, 18, 10)); for (let i = 0; i < 4; i++) A.recordAnswer(s, { rid: 'u' + i, kind: 'basic', correct: true }, JST(2026, 11, 18, 10));
  let s2 = M.ensure(JSON.parse(JSON.stringify(s))); A.begin(s2, JST(2026, 11, 18, 22));   // 再読込→再開
  for (let i = 4; i < 10; i++) A.recordAnswer(s2, { rid: 'u' + i, kind: 'basic', correct: true }, JST(2026, 11, 18, 22));
  const r = A.settle(s2, JST(2026, 11, 18, 22)); eq(s2.daily.used['2026-11-18'], 1); eq(r.slot.no, 1); eq(s2.chests.length, 1);
  const xp = s2.advXp, coins = s2.coins, pity = s2.chest.pity; A.settle(s2, 0); const s3 = M.ensure(JSON.parse(JSON.stringify(s2))); A.settle(s3, 0);
  eq([s2.chests.length, s2.advXp, s2.coins, s2.chest.pity], [1, xp, coins, pity]); eq([s3.chests.length, s3.advXp, s3.coins], [1, xp, coins]);
});
t('D09 復習XPはoriginごとに1回（成功を重ねても加算されない）', () => {
  const s = fresh(); A.begin(s, 1); const r0 = A.recordAnswer(s, { rid: 'a0', kind: 'basic', correct: false }, 1); A.queueReview(s, r0.origin, {});
  for (let i = 1; i < 10; i++) A.recordAnswer(s, { rid: 'a' + i, kind: 'basic', correct: true }, 1);
  A.recordAnswer(s, { rid: 'rv1', kind: 'review', correct: true, origin: r0.origin }, 1); A.recordAnswer(s, { rid: 'rv2', kind: 'review', correct: true, origin: r0.origin }, 1);
  eq(s.active.reviews.ok.length, 1); const r = A.settle(s, 1); eq(r.R, 1); eq(r.xpBase, 10 * 10 + 5 * 9 + 5);
});

console.log(JSON.stringify({ pass, fail, failures }, null, 1));
process.exit(fail ? 1 : 0);
