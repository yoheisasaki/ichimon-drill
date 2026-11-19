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

// ===== 追加修正10 3章：宝箱の表示用データ（実データと一致・全件を出す）=====
t('T01 素材：素材IDどおりの名称・数量・用途（ランク別）／6ランクの絵は別物', () => {
  [1, 2, 3, 4, 5, 6].forEach(r => { const v = C.chestView({ kind: 'mat', rank: r, mats: { ['ore_' + r]: 4 } }, 'warrior'); eq(v.primary.id, 'ore_' + r); eq(v.primary.name, C.oreName(r)); eq(v.primary.qty, 4); eq(v.primary.use, '装備を強くする素材'); eq(v.extras, []); });
  const ids = new Set(); [1, 2, 3, 4, 5, 6].forEach(r => { const f = require('fs').readFileSync(require('path').join(__dirname, '..', 'assets', 'icons', 'ore_' + r + '.png')); ids.add(require('crypto').createHash('md5').update(f).digest('hex')); }); eq(ids.size, 6, '6ランクの鉱石絵はすべて別');
});
t('T02 装備：実物の名称・新装備の文言、使えない職では fit.ok=false', () => {
  const v = C.chestView({ kind: 'rare', rank: 1, item: 'rw_sword_1', dup: false }, 'warrior');
  eq(v.primary.kind, 'item'); eq(v.primary.id, 'rw_sword_1'); eq(v.primary.name, D.ITEMS.rw_sword_1.name); eq(v.primary.use, '新しい装備を手に入れた！'); ok(v.fit.ok);
  const u = C.chestView({ kind: 'rare', rank: 1, item: 'rw_staff_1', dup: false }, 'warrior'); eq(u.fit.ok, false); eq(u.fit.job, D.JOBS.warrior.name);
  ok(C.chestView({ kind: 'rare', rank: 1, item: 'ra_heavy_1', dup: false }, 'mage').fit.ok, '防具は職を問わない');
});
t('T03 コインのみ／重複変換／複数品：受取内容と一致し、全件が items に入る', () => {
  const c = C.chestView({ kind: 'coin', rank: 1, coin: 40 }, 'warrior'); eq(c.primary.kind, 'coin'); eq(c.primary.qty, 40); eq(c.extras, []);
  const m = C.chestView({ kind: 'coinmat', rank: 1, coin: 40, mats: { ore_1: 2 } }, 'warrior'); eq(m.items.length, 2); eq(m.primary.id, 'ore_1'); eq(m.extras.map(x => x.kind), ['coin']); eq(m.coin, 40);
  const s = C.newSave(0); s.inv.items.rw_sword_1 = 1; C.addSealedChest(s, 'd1', { kind: 'rare', rank: 1, item: 'rw_sword_1', pityBefore: 0 }, {}); const o = C.openChest(s, 'd1');
  const d = C.chestView(o.result, 'warrior'); eq(d.primary.id, 'ore_1'); eq(d.primary.qty, 3); eq(d.dupOf.id, 'rw_sword_1'); eq(d.dupOf.name, D.ITEMS.rw_sword_1.name); eq(s.inv.mats.ore_1, 3, '表示の数量＝実際に増えた数量');
});
t('T03 主役の規則は一定（装備 > 素材 > コイン）、実抽選300件で表示の合計が受取と一致', () => {
  for (let i = 0; i < 300; i++) {
    const s = C.newSave(0); s.coins = 0; const roll = C.rollChest(s, 'p' + i); C.addSealedChest(s, 'c', roll, {}); const o = C.openChest(s, 'c'), v = C.chestView(o.result, 'warrior');
    const order = { item: 0, mat: 1, coin: 2 }; for (let k = 1; k < v.items.length; k++) ok(order[v.items[k - 1].kind] <= order[v.items[k].kind], '順序');
    eq(v.items.filter(x => x.kind === 'coin').reduce((a, x) => a + x.qty, 0), s.coins, 'コイン一致');
    v.items.filter(x => x.kind === 'mat').forEach(x => eq(s.inv.mats[x.id], x.qty, '素材一致'));
  }
});
t('T07 装備・コイン・素材の箱も、二重開封で再付与なし・表示は同じ（再抽選なし）', () => {
  [{ kind: 'rare', rank: 1, item: 'rw_sword_1', pityBefore: 0 }, { kind: 'coin', rank: 1, coin: 40, pityBefore: 0 }, { kind: 'mat', rank: 2, mats: { ore_2: 4 }, pityBefore: 0 }].forEach((roll, k) => {
    const st = memStorage(), store = C.makeStore(st), s = fresh(); store.save(s); s.coins = 100; C.addSealedChest(s, 'x' + k, roll, {}); store.save(s);
    const a = C.openChestPersist(s, store, 'x' + k, 0); const snap = JSON.stringify({ c: s.coins, i: s.inv }); const b = C.openChestPersist(s, store, 'x' + k, 0);
    ok(a.ok && !a.already && b.already); eq(JSON.stringify({ c: s.coins, i: s.inv }), snap); eq(JSON.stringify(C.chestView(a.result, 'warrior')), JSON.stringify(C.chestView(b.result, 'warrior')));
  });
});
// ===== 追加修正10 4章：成長ゲージ（既存の成長式 levelOf をそのまま使う）=====
const NEEDJ = j => C.NEED[D.JOBS[j].tier];
t('G01 進捗＝(E−T(L))/(T(L+1)−T(L))、残り＝T(L+1)−E（累積式と一致、全職×境界値）', () => {
  D.JOB_IDS.forEach(j => [0, 1, 199, 200, 201, 4679, 4680, 12345, 28120, 60319, 60320].forEach(E => {
    const v = C.growthView(j, E), fn = NEEDJ(j), L = v.lv;
    if (v.capped) return; const T0 = C.cum(fn, L), T1 = C.cum(fn, L + 1);
    ok(Math.abs(v.ratio - (E - T0) / (T1 - T0)) < 1e-12, j + ' E=' + E); eq(v.remain, T1 - E); ok(v.ratio >= 0 && v.ratio < 1, '0以上1未満（丸めで隠さない）'); eq(v.nextLv, L + 1);
  }));
});
t('G01 境界：Lvちょうどは進捗0・残り＝そのLvの必要量、1 EXP 手前は前のLvでほぼ満タン', () => {
  const fn = NEEDJ('warrior'), E = C.cum(fn, 9), v = C.growthView('warrior', E), w = C.growthView('warrior', E - 1);
  eq(v.lv, 9); eq(v.ratio, 0); eq(v.remain, fn(9)); eq(w.lv, 8); eq(w.remain, 1); ok(w.ratio > 0.99 && w.ratio < 1);
});
t('G03 レベルアップ（1回・複数回）：到達Lv後の進捗と残り。lvFrom を保持し up=true', () => {
  const fn = NEEDJ('warrior'), E = C.cum(fn, 9) + 60, v = C.growthView('warrior', E, { lvFrom: 8 }); eq(v.lv, 9); ok(v.up); eq(v.lvFrom, 8); eq(v.remain, fn(9) - 60); ok(Math.abs(v.ratio - 60 / fn(9)) < 1e-12);
  const m = C.growthView('warrior', C.cum(fn, 9) + 10, { lvFrom: 6 }); eq([m.lvFrom, m.lv, m.up], [6, 9, true]);
  eq(C.growthView('warrior', 5000, { lvFrom: 7 }).up, true); eq(C.growthView('warrior', 5000).up, false);
});
t('G02 全技習得後もレベルが上がるあいだは残りを維持し、補助行は「全習得」。技が残る間は「次の技」', () => {
  D.JOB_IDS.forEach(j => { const last = Math.max(...D.SKILLS_OF[j].map(k => k.lv)); if (last >= C.CAP.job - 1) return; const v = C.growthView(j, C.cum(NEEDJ(j), last + 1) + 5); ok(!v.capped); eq(v.sub.type, 'all'); ok(v.remain > 0); ok(v.ratio > 0); });
  const v = C.growthView('warrior', C.cum(NEEDJ('warrior'), 8) + 1); eq(v.sub.type, 'next'); ok(v.sub.lv > v.lv);
});
t('G04 最大Lv：capped・ゲージなし（ratio=null）・残り0・補助行なし、ゼロ除算なし', () => {
  D.JOB_IDS.forEach(j => { const E = C.cum(NEEDJ(j), C.CAP.job); [E, E + 1, 1e9].forEach(x => { const v = C.growthView(j, x); ok(v.capped); eq(v.ratio, null); eq(v.remain, 0); eq(v.sub, null); eq(v.nextLv, null); }); });
  const c = C.growthView('warrior', C.cum(NEEDJ('warrior'), 30), { lvFrom: 29 }); ok(c.up && c.capped);
});
t('G01 転職後の保存値：職業ごとの jobXp でその職のLvが決まる（他職の経験値が混ざらない）', () => {
  const s = C.newSave(0); s.jobXp.warrior = 9000; s.jobXp.mage = 100; const w = C.growthView('warrior', s.jobXp.warrior), m = C.growthView('mage', s.jobXp.mage);
  eq(w.lv, C.jobLevel('warrior', 9000).lv); eq(m.lv, 1); eq(m.remain, NEEDJ('mage')(1) - 100);
});
t('G05 冒険者Lv上昇は advUp の補助情報で、職業ゲージの値に影響しない', () => {
  const a = C.growthView('warrior', 3000, { advFrom: 1, advTo: 2 }), b = C.growthView('warrior', 3000);
  eq(a.advUp, { from: 1, to: 2 }); eq(b.advUp, null); eq([a.ratio, a.remain, a.lv], [b.ratio, b.remain, b.lv]);
});

console.log(JSON.stringify({ pass, fail, failures }, null, 1));
process.exit(fail ? 1 : 0);
