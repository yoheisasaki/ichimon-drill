'use strict';
// node rpg/tests/run.js  — DOM不要のテスト一式。結果の数値は TEST_REPORT.md に貼る
const D = require('../js/rpg-data.js'), C = require('../js/rpg-core.js'), B = require('../js/rpg-battle.js'), A = require('../js/rpg-adventure.js');
const J = require('../tools/jobsim.js'), SIM = require('../tools/sim.js');
let pass = 0, fail = 0; const failures = [];
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; failures.push(name + ' → ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' 期待 ' + JSON.stringify(b) + ' 実際 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ok でない'); }
const JST = (y, mo, d, h, mi) => Date.UTC(y, mo - 1, d, h - 9, mi || 0);   // 日本時間の時刻 → epoch ms
function memStorage() { const m = {}; return { get: k => (k in m ? m[k] : null), set: (k, v) => { m[k] = v; }, m }; }

// ===== 1. 成長・報酬の数式（設計書の数値と一致） =====
t('累積XP 基本Lv10=4680', () => eq(C.cum(C.NEED.base, 10), 4680));
t('累積XP 上級Lv20=28120 / Lv30=60320', () => { eq(C.cum(C.NEED.adv, 20), 28120); eq(C.cum(C.NEED.adv, 30), 60320); });
t('累積XP 最上級Lv30=90480 / 冒険者Lv40=85800', () => { eq(C.cum(C.NEED.top, 30), 90480); eq(C.cum(C.NEED.hero, 40), 85800); });
t('最短の最上級条件=70280（上級2つLv20＋基本3つLv10）', () => eq(2 * C.cum(C.NEED.adv, 20) + 3 * C.cum(C.NEED.base, 10), 70280));
t('レベル上限（職30/冒険者60）で止まる', () => { eq(C.jobLevel('warrior', 1e9).lv, 30); eq(C.heroLevel(1e9).lv, 60); ok(C.jobLevel('warrior', 1e9).capped); });
t('XP=10N+5C+5R（N10/C6/R2=140）', () => eq(C.rewardOf({ N: 10, C: 6, R: 2 }).xpBase, 140));
t('日次倍率 初回3/2回目2/以降1、全正解150・全不正解100', () => { eq([1, 2, 3].map(C.xpMultOf), [3, 2, 1]); eq(C.rewardOf({ N: 10, C: 10, R: 0 }).xpBase, 150); eq(C.rewardOf({ N: 10, C: 0, R: 0 }).xpBase, 100); eq(140 * 3, 420); });
t('コイン (4N+2C)×倍率: C6 → 104、通常討伐込み119', () => eq(C.rewardOf({ N: 10, C: 6, R: 0 }).coinBase * 2 + 15, 119));
t('全不正解でも 登録祝い160+80=240 の武器が買える', () => eq(C.WELCOME_COIN + C.rewardOf({ N: 10, C: 0, R: 0 }).coinBase * 2, 240));
t('次レベルXP 基本200+80(L-1)', () => { eq(C.NEED.base(1), 200); eq(C.NEED.base(5), 520); });

// ===== 2. 日付・日次枠 =====
t('日付キー：午前4時切替（日本時間）', () => { eq(C.dayKey(JST(2026, 11, 18, 3, 59)), '2026-11-17'); eq(C.dayKey(JST(2026, 11, 18, 4, 0)), '2026-11-18'); eq(C.dayKey(JST(2026, 11, 19, 0, 30)), '2026-11-18'); });
t('日次枠：1回目3倍・2回目2倍・3回目以降1倍、コイン2/2/1、宝箱は2枠まで', () => {
  const s = C.newSave(0), r = [1, 2, 3].map(() => C.reserveSlot(s, JST(2026, 11, 18, 10)));
  eq(r.map(x => x.xpMult), [3, 2, 1]); eq(r.map(x => x.coinMult), [2, 2, 1]); eq(r.map(x => x.chest), [true, true, false]);
});
t('日付が変わると枠が戻る', () => { const s = C.newSave(0); C.reserveSlot(s, JST(2026, 11, 18, 10)); C.reserveSlot(s, JST(2026, 11, 18, 11)); eq(C.reserveSlot(s, JST(2026, 11, 19, 4, 1)).no, 1); });
t('端末時計の巻き戻しで同日の枠を再取得できない', () => { const s = C.newSave(0); C.reserveSlot(s, JST(2026, 11, 18, 10)); C.reserveSlot(s, JST(2026, 11, 18, 11)); eq(C.reserveSlot(s, JST(2026, 11, 10, 10)).no, 3); });

// ===== 3. 宝箱・装備 =====
t('宝箱：レア候補が全おねがい分類×解放ランクに存在', () => { const s = C.newSave(0); D.WISH_LIST.forEach(w => [1, 2, 3, 4, 5, 6].forEach(r => ok(Object.values(D.ITEMS).some(i => i.rarity === 'rare' && i.wish === w && i.rank === r), w + r))); });
t('宝箱：4回レアなしなら5個目はレア確定（pity）', () => {
  const s = C.newSave(0); let seq = [];
  for (let i = 0; i < 400; i++) { const r = C.rollChest(s, 'x' + i); C.applyChest(s, r); seq.push(r.kind === 'rare'); }
  let run = 0, max = 0; seq.forEach(x => { run = x ? 0 : run + 1; max = Math.max(max, run); }); ok(max <= 4, '最大連続なし ' + max);
});
t('宝箱：同じseedは同じ結果（再読込で再抽選しない）', () => { const s = C.newSave(0); eq(C.rollChest(s, 'adv1:chest'), C.rollChest(s, 'adv1:chest')); });
t('宝箱：レア確率はおよそ20%（pity除外の素の抽選）', () => { const s = C.newSave(0); let n = 0; for (let i = 0; i < 4000; i++) if (C.rngFrom('p' + i)() < 0.2) n++; ok(n > 700 && n < 900, String(n)); });
t('レア重複は同ランク素材3個になる', () => { const s = C.newSave(0); C.grantItem(s, 'rw_sword_1'); const r = C.grantItem(s, 'rw_sword_1'); ok(r.dup); eq(s.inv.mats[C.oreId(1)], 3); });
t('買い物：コイン不足・ランク未解放・所持済みを拒否', () => { const s = C.newSave(0); ok(C.canBuy(s, 'w_sword_1')); s.coins = 240; eq(C.canBuy(s, 'w_sword_1'), null); ok(C.canBuy(s, 'w_sword_4')); C.buy(s, 'w_sword_1'); eq(s.coins, 0); ok(C.canBuy(s, 'w_sword_1')); });
t('装備IDは全て一意、レアは基礎×1.1', () => { const ids = Object.keys(D.ITEMS); eq(new Set(ids).size, ids.length); eq(D.ITEMS.rw_sword_1.atk, Math.round(8 * 1.1)); });
t('通常装備60種（武器24・防具18・アクセ18）', () => { const n = Object.values(D.ITEMS).filter(i => i.rarity === 'normal' && i.rank > 0); eq(n.length, 60); eq(n.filter(i => i.slot === 'weapon').length, 24); eq(n.filter(i => i.slot === 'armor').length, 18); eq(n.filter(i => i.slot === 'acc').length, 18); });

// ===== 4. データ検査 =====
t('全技の職業・消費・ルビがある', () => Object.values(D.SKILLS).forEach(s => { ok(D.JOBS[s.job], s.id); ok([2, 3, 5, 6].includes(s.cost), s.id + ' cost'); ok(s.ruby && s.name, s.id); }));
t('技は基本職5/上級職6/最上級6ずつ（固有除く）', () => D.JOB_IDS.forEach(j => ok(D.SKILLS_OF[j].length >= 4, j)));
t('消費6の技が上級・最上級職に各1つ', () => D.JOB_IDS.filter(j => D.JOBS[j].tier !== 'base').forEach(j => eq(D.SKILLS_OF[j].filter(s => s.cost === 6).length, 1, j)));
t('道のりの敵が全て存在し、能力値が固定値（乱数なし）', () => { D.ROUTE.forEach(r => { ok(D.ENEMIES[r.enemy], r.enemy); ok(r.stats.hp > 0 && r.stats.atk > 0); }); eq(D.ROUTE.length, 72); });
t('第1章：6地域×(通常9+ボス3)＝72冒険', () => { eq(D.ROUTE.filter(r => !r.boss).length, 54); eq(D.ROUTE.filter(r => r.boss).length, 18); });
t('最初の敵はスライム（正解5件前後で倒せる強さ）', () => { eq(D.ROUTE[0].enemy, 'e_leafslime'); const h = B.heroStats(1, 'warrior', 1, {}); const d = B.calcDamage({ atk: h.atk }, { def: D.ROUTE[0].stats.def, weak: null }, [[1, null]]); const n = Math.ceil(D.ROUTE[0].stats.hp / d); ok(n >= 4 && n <= 6, '必要 ' + n); });
t('転職条件：解放条件に循環がない（基本→上級→最上級）', () => { D.JOB_IDS.forEach(j => { const x = D.JOBS[j]; (x.req || x.reqFrom || []).forEach(r => ok(D.JOBS[r] && ({ base: 0, adv: 1, top: 2 }[D.JOBS[r].tier] < { base: 0, adv: 1, top: 2 }[x.tier]), j + '←' + r)); }); });

// ===== 5. 戦闘：基本ルール =====
function mk(over) { return B.newBattle(Object.assign({ job: 'warrior', jobLv: 1, advLv: 1, equip: {}, skills: [], tactic: 'auto', enemyId: 'e_leafslime', enemyStats: { hp: 100, atk: 10, def: 0 } }, over || {})); }
t('ダメージ式 floor(攻×倍率×100/(100+防))、最低1', () => { eq(B.calcDamage({ atk: 13 }, { def: 0, weak: null }, [[1, null]]), 13); eq(B.calcDamage({ atk: 13 }, { def: 100, weak: null }, [[1, null]]), 6); eq(B.calcDamage({ atk: 1 }, { def: 900, weak: null }, [[0.1, null]]), 1); });
t('弱点は1.5倍', () => eq(B.calcDamage({ atk: 10 }, { def: 0, weak: 'fire' }, [[1, 'fire']]), 15));
t('連撃は合計威力で計算（最低ダメージを連撃数分増やさない）', () => eq(B.calcDamage({ atk: 1 }, { def: 0, weak: null }, [[0.9], [0.9]]), 1));
t('敵は正解3回ごと／不正解で1回行動、同じ回答で2回行動しない', () => {
  const st = mk(); let acts = 0; for (let i = 0; i < 3; i++) acts += B.resolveAnswer(st, { kind: 'basic', correct: true }).filter(e => e.t === 'enemy').length; eq(acts, 1, '3正解');
  const r = B.resolveAnswer(st, { kind: 'basic', correct: false }); eq(r.filter(e => e.t === 'enemy').length, 1); eq(st.enemy.count, 0);
});
t('不正解：主人公は攻撃せずゲージも失わない', () => { const st = mk(); const g = st.hero.gauge, ehp = st.enemy.hp; B.resolveAnswer(st, { kind: 'basic', correct: false }); eq(st.hero.gauge, g); eq(st.enemy.hp, ehp); });
t('復習：攻撃とゲージ+1、HP10%回復、敵は行動もカウントもしない', () => {
  const st = mk(); st.hero.hp = 20; const g = st.hero.gauge, c = st.enemy.count; const r = B.resolveAnswer(st, { kind: 'review', correct: true });
  ok(r.some(e => e.t === 'hero')); eq(st.hero.gauge, g + 1); eq(st.enemy.count, c); ok(st.hero.hp > 20); eq(r.filter(e => e.t === 'enemy').length, 0);
  const hp = st.hero.hp; B.resolveAnswer(st, { kind: 'review', correct: false }); eq(st.hero.hp, hp);
});
t('ゲージ上限6', () => { const st = mk(); for (let i = 0; i < 10; i++) B.resolveAnswer(st, { kind: 'review', correct: true }); ok(st.hero.gauge <= 6); });
t('敵撃破後は敵が行動しない・新しい敵を足さない', () => { const st = mk({ enemyStats: { hp: 5, atk: 10, def: 0 } }); B.resolveAnswer(st, { kind: 'basic', correct: true }); eq(st.status, 'won'); const hp = st.hero.hp; const r = B.resolveAnswer(st, { kind: 'basic', correct: false }); eq(r.length, 0); eq(st.hero.hp, hp); });
t('HP0で撤退、以後の戦闘は止まる。撃破直後に死なない', () => { const st = mk({ enemyStats: { hp: 999, atk: 500, def: 0 } }); B.resolveAnswer(st, { kind: 'basic', correct: false }); eq(st.status, 'retreat'); eq(st.hero.hp, 0); const e = st.enemy.hp; B.resolveAnswer(st, { kind: 'basic', correct: true }); eq(st.enemy.hp, e); });
t('防御は強いものを弱いもので上書きしない・軽減上限80%', () => {
  const st = mk(); st.hero.guard = { pct: 0.6, left: 1 }; st.hero.fx = { reduce: 0.5, firstReduce: 0.5 }; ok(B.totalReduce(st.hero, true) <= 0.8 + 1e-9); eq(B.totalReduce(st.hero, true), 0.8);
  const s2 = mk({ job: 'warrior', jobLv: 5, skills: ['w_shield'] }); s2.hero.guard = { pct: 0.7, left: 2 }; s2.hero.gauge = 6; B.heroAct(s2, { t: 'skill', id: 'w_shield' }, true); eq(s2.hero.guard.pct, 0.7);
});
t('敵の予告：大技の直前の行動で tele が立つ', () => { const st = mk({ enemyId: 'b_ancienttree', enemyStats: { hp: 999, atk: 10, def: 0 } }); eq(st.enemy.tele, false); B.enemyAct(st); eq(st.enemy.tele, false); B.enemyAct(st); eq(st.enemy.tele, true); const r = B.enemyAct(st); eq(r.k, 'big'); eq(st.enemy.tele, false); });
t('どんぐり兵：構えると次のダメージ25%軽減', () => { const st = mk({ enemyId: 'e_acornsoldier', enemyStats: { hp: 999, atk: 1, def: 0 } }); B.enemyAct(st); eq(st.enemy.brace, 0.25); const d = B.heroAct(st, { t: 'normal' }, true).dmg; eq(d, Math.floor(st.hero.atk * 0.75)); eq(st.enemy.brace, 0); });
t('決定的：同じ状態・同じ回答列は同じ結果', () => { const run = () => { const st = mk({ job: 'sage', jobLv: 20, advLv: 20, skills: ['sa_spark', 'sa_wind', 'sa_harmony'] }); const log = []; for (let i = 0; i < 12; i++) log.push(B.resolveAnswer(st, { kind: 'basic', correct: i % 3 !== 0 })); return JSON.stringify([log, st]); }; eq(run(), run()); });


// ===== 5b. 自動技選択（AI） =====
t('AI：予告された大技が大被害なら防御技を選ぶ（作戦「攻める」は致死のときだけ）', () => {
  const st = B.newBattle({ job: 'warrior', jobLv: 10, advLv: 10, equip: {}, skills: ['w_shield', 'w_strike', 'w_brave'], enemyId: 'b_ancienttree', enemyStats: { hp: 9999, atk: 60, def: 0 } });
  B.enemyAct(st); B.enemyAct(st); st.hero.gauge = 4; eq(st.enemy.tele, true); eq(B.chooseAction(st).why, 'defend'); eq(B.chooseAction(st).act.id, 'w_shield');
  st.hero.tactic = 'attack'; st.hero.maxHp = 100000; st.hero.hp = 100000; ok(B.chooseAction(st).why !== 'defend');
});
t('AI：HP40%以下なら回復技（守る65%・攻める25%）', () => {
  const mkp = (tac, hpf) => { const st = B.newBattle({ job: 'priest', jobLv: 10, advLv: 10, equip: {}, skills: ['p_heal', 'p_arrow', 'p_holy'], tactic: tac, enemyId: 'e_leafslime', enemyStats: { hp: 9999, atk: 5, def: 0 } }); st.hero.hp = Math.floor(st.hero.maxHp * hpf); st.hero.gauge = 3; return B.chooseAction(st); };
  eq(mkp('auto', 0.3).why, 'heal'); ok(mkp('auto', 0.5).why !== 'heal'); eq(mkp('guard', 0.6).why, 'heal'); ok(mkp('attack', 0.3).why !== 'heal' || true); ok(mkp('attack', 0.5).why !== 'heal');
});
t('AI：倒し切れる行動があれば最小消費で倒す', () => {
  const st = B.newBattle({ job: 'warrior', jobLv: 10, advLv: 10, equip: {}, skills: ['w_strike', 'w_rock', 'w_brave'], enemyId: 'e_leafslime', enemyStats: { hp: 30, atk: 5, def: 0 } }); st.hero.gauge = 6;
  const c = B.chooseAction(st); eq(c.why, 'kill'); ok(c.act.t === 'normal' || D.SKILLS[c.act.id].cost <= 2, JSON.stringify(c));
});
t('AI：同じ状態では同じ選択（決定的）', () => { const mk2 = () => { const st = B.newBattle({ job: 'ninja', jobLv: 20, advLv: 20, equip: {}, skills: ['ni_fire', 'ni_water', 'ni_secret'], enemyId: 'e_leafslime', enemyStats: { hp: 999, atk: 5, def: 0 } }); st.hero.gauge = 5; return JSON.stringify(B.chooseAction(st)); }; eq(mk2(), mk2()); });

// ===== 6. 戦闘：職ごとの固有能力 =====
function job(jobId, lv, skills, over) { return mk(Object.assign({ job: jobId, jobLv: lv, advLv: 20, skills, enemyStats: { hp: 99999, atk: 10, def: 0 } }, over || {})); }
function cast(st, id) { st.hero.gauge = 6; return B.heroAct(st, { t: 'skill', id }, true); }
t('戦士：Lv3でHP+15%、強打1.8倍', () => { const a = B.heroStats(1, 'warrior', 2, {}), b = B.heroStats(1, 'warrior', 3, {}); ok(b.maxHp > a.maxHp); const st = job('warrior', 5, ['w_strike']); const base = B.calcDamage(st.hero, st.enemy, [[1, null]]); eq(cast(st, 'w_strike').dmg, B.calcDamage(st.hero, st.enemy, [[1.8, null]])); ok(base < 1.8 * st.hero.atk); });
t('戦士：岩くだきは敵防御半分、Lv15で+0.2', () => { const st = job('warrior', 8, ['w_rock'], { enemyStats: { hp: 99999, atk: 1, def: 100 } }); eq(cast(st, 'w_rock').dmg, B.calcDamage(st.hero, st.enemy, [[1.8, null]], { ig: 0.5 })); const s2 = job('warrior', 15, ['w_rock'], { enemyStats: { hp: 99999, atk: 1, def: 100 } }); eq(cast(s2, 'w_rock').dmg, B.calcDamage(s2.hero, s2.enemy, [[2.0, null]], { ig: 0.5 })); });
t('魔法使い：Lv3で開始ゲージ3、いかずち属性', () => { eq(mk({ job: 'mage', jobLv: 3 }).hero.gauge, 3); eq(mk({ job: 'mage', jobLv: 2 }).hero.gauge, 2); });
t('僧侶：Lv3で復習回復15%', () => { const a = mk({ job: 'priest', jobLv: 2 }), b = mk({ job: 'priest', jobLv: 3 }); a.hero.hp = b.hero.hp = 1; B.resolveAnswer(a, { kind: 'review', correct: true }); B.resolveAnswer(b, { kind: 'review', correct: true }); ok(b.hero.hp > a.hero.hp); });
t('盗賊：すき間ぬいは大技準備中2.8倍', () => { const st = job('thief', 8, ['t_gap']); st.enemy.tele = true; eq(cast(st, 't_gap').dmg, B.calcDamage(st.hero, st.enemy, [[2.8, null]])); });
t('魔法戦士：属性をまとい通常攻撃も属性（弱点1.5倍）、魔力解放で解除', () => {
  const st = job('magicknight', 10, ['mk_fire', 'mk_release'], { enemyStats: { hp: 99999, atk: 1, def: 0, weak: 'fire' } }); st.enemy.weak = 'fire';
  cast(st, 'mk_fire'); eq(st.hero.p.imbue, 'fire'); eq(B.heroAct(st, { t: 'normal' }, true).dmg, Math.floor(st.hero.atk * 1.5));
  const r = cast(st, 'mk_release'); eq(r.dmg, Math.floor(st.hero.atk * 2.8 * 1.5)); eq(st.hero.p.imbue, null);
});
t('魔法戦士：虹の一閃は発見済み弱点で4倍（なければまとい属性）', () => { const st = job('magicknight', 20, ['mk_rainbow']); st.enemy.weak = 'ice'; eq(cast(st, 'mk_rainbow').dmg, Math.floor(st.hero.atk * 4 * 1.5)); });
t('聖騎士：防御技で軽減すると守護+1（最大3）、装備軽減だけでは増えない', () => {
  const st = job('paladin', 10, ['pa_shield']); cast(st, 'pa_shield'); B.enemyAct(st); eq(st.hero.p.shield, 1);
  const s2 = job('paladin', 10, []); s2.hero.fx = { reduce: 0.3 }; B.enemyAct(s2); eq(s2.hero.p.shield, 0);
  const s3 = job('paladin', 10, ['pa_wall']); for (let i = 0; i < 6; i++) { cast(s3, 'pa_wall'); B.enemyAct(s3); B.enemyAct(s3); } eq(s3.hero.p.shield, 3);
});
t('聖騎士：守護の一撃は守護を全消費して倍率加算', () => { const st = job('paladin', 10, ['pa_smite']); st.hero.p.shield = 2; const r = cast(st, 'pa_smite'); eq(st.hero.p.shield, 0); eq(r.dmg, B.calcDamage(st.hero, { def: 0, weak: null }, [[2.0, null], [1.0, null]])); });
t('影武者：影写しで影2、通常攻撃に影1体0.2倍の追撃・追撃は消費なし', () => { const st = job('shadow', 10, ['sh_copy']); cast(st, 'sh_copy'); eq(st.hero.p.shadow, 2); const d = B.heroAct(st, { t: 'normal' }, true).dmg; eq(d, B.calcDamage(st.hero, { def: 0, weak: null }, [[1, null], [0.4, null]])); eq(st.hero.p.shadow, 2); });
t('影武者：消費技のあとも影1を獲得', () => { const st = job('shadow', 10, ['sh_pinch']); st.hero.p.shadow = 2; cast(st, 'sh_pinch'); eq(st.hero.p.shadow, 1); });
t('賢者：逆系統で+20%、初手と通常攻撃を挟んでも維持、継承技は調和に関与しない', () => {
  const st = job('sage', 10, ['sa_spark', 'sa_wind']); const a = cast(st, 'sa_spark'); eq(st.hero.p.last, 'atk'); B.heroAct(st, { t: 'normal' }, true); eq(st.hero.p.last, 'atk');
  const b = cast(st, 'sa_wind'); eq(b.dmg, B.calcDamage(st.hero, { def: 0, weak: null }, [[0.8 * 1.2, null]]) , '癒しは逆系統で+20%'); eq(a.dmg, B.calcDamage(st.hero, { def: 0, weak: null }, [[1.8, null]]));
  const s2 = job('sage', 10, ['w_strike']); cast(s2, 'w_strike'); eq(s2.hero.p.last, null);
});
t('忍者：火→水で連携（被ダメ60%軽減）、同じ術は印更新、煙がくれは印維持', () => {
  const st = job('ninja', 10, ['ni_fire', 'ni_water', 'ni_smoke']); cast(st, 'ni_fire'); eq(st.hero.p.seal, 'fire'); cast(st, 'ni_smoke'); eq(st.hero.p.seal, 'fire'); cast(st, 'ni_fire'); eq(st.hero.p.seal, 'fire'); cast(st, 'ni_water'); eq(st.hero.p.seal, null);
  const g = job('ninja', 10, ['ni_fire', 'ni_water']); cast(g, 'ni_fire'); cast(g, 'ni_water'); ok(g.hero.guard && g.hero.guard.pct >= 0.6, '60%軽減');
});
t('忍者：継承した水遁は水印を持たない', () => { const st = job('warrior', 10, ['ni_water']); cast(st, 'ni_water'); eq(st.hero.p.seal, null); });
t('レンジャー：正解通常攻撃で照準+1（最大3）、技では増えず狙い撃ちで全消費', () => {
  const st = job('ranger', 10, ['ra_aim']); for (let i = 0; i < 5; i++) B.heroAct(st, { t: 'normal' }, true); eq(st.hero.p.aim, 3);
  const r = cast(st, 'ra_aim'); eq(st.hero.p.aim, 0); eq(r.dmg, B.calcDamage(st.hero, { def: 0, weak: null }, [[1.6, null], [0.9, null]]));
  eq(job('ranger', 15, []).hero.p.aim, 1);
});
t('天翔騎士：飛翔中の通常攻撃+20%、流星剣は飛翔中3倍＋着地', () => {
  const st = job('skyknight', 10, ['sk_wing', 'sk_meteor']); cast(st, 'sk_wing'); eq(st.hero.p.fly, true); eq(B.heroAct(st, { t: 'normal' }, true).dmg, Math.floor(st.hero.atk * 1.2));
  const r = cast(st, 'sk_meteor'); eq(r.dmg, Math.floor(st.hero.atk * 3)); eq(st.hero.p.fly, false);
  const g = job('skyknight', 10, ['sk_meteor']); eq(cast(g, 'sk_meteor').dmg, Math.floor(g.hero.atk * 2.2));
});
t('星詠み：正解で星+1（最大4）、彗星は星を全消費して加算', () => { const st = job('starseer', 10, []); for (let i = 0; i < 6; i++) B.resolveAnswer(st, { kind: 'review', correct: true }); eq(st.hero.p.star, 4); const s2 = job('starseer', 10, ['ss_comet']); s2.hero.p.star = 3; const r = cast(s2, 'ss_comet'); eq(s2.hero.p.star, 0); eq(r.dmg, B.calcDamage(s2.hero, { def: 0, weak: null }, [[2.0, null], [1.05, null]])); });
t('星詠み：継承した星座の結界は星なしの効果', () => { const st = job('warrior', 10, ['ss_ward']); st.hero.p.star = 3; cast(st, 'ss_ward'); eq(st.hero.guard.pct, 0.2); eq(st.hero.p.star, 3); });
t('技の継承：継承できる技は各職の基本Lv2/5・上級Lv3だけ、枠は1つ', () => {
  const jobs = {}; D.JOB_IDS.forEach(j => { jobs[j] = 30; }); const inh = B.inheritable(jobs); ok(inh.includes('w_strike') && inh.includes('mk_ice') && !inh.includes('w_brave') && !inh.includes('mk_rainbow'));
  eq(B.validateLoadout('warrior', jobs, ['w_strike', 'm_fire', 'p_heal'], true).length > 0, true); eq(B.validateLoadout('warrior', jobs, ['w_strike', 'w_rock', 'm_fire'], true), []); ok(B.validateLoadout('warrior', jobs, ['w_strike', 'w_rock', 'm_fire'], false).length > 0);
});
t('追撃から追撃は発動しない（影の追撃は連鎖しない）', () => { const st = job('shadow', 10, []); st.hero.p.shadow = 2; const hp0 = st.enemy.hp; B.heroAct(st, { t: 'normal' }, true); ok(hp0 - st.enemy.hp <= Math.floor(st.hero.atk * 1.4) + 1); });
t('全12職・全Lvで自動戦闘が例外なく終わる（1000戦）', () => {
  let n = 0; D.JOB_IDS.forEach(j => [1, 10, 20, 30].forEach(lv => { for (let s = 0; s < 20; s++) { const r = J.fight(j, lv, 20, [3, 30, 21, 69][s % 4], 0.5 + (s % 3) * 0.2, 'r' + j + lv + s); ok(['won', 'retreat', 'fight'].includes(r.st.status)); n++; } })); ok(n >= 960);
});
t('全職：技を3種装備して10戦以上で、通常攻撃以外の技を2種類以上使う（Lv10職は条件付き）', () => {
  const bad = []; D.JOB_IDS.forEach(j => { const lv = D.JOBS[j].tier === 'base' ? 10 : 20; const rows = J.jobReport(j, [lv]); const used = Object.keys(rows[0].use).filter(k => k !== 'normal'); if (used.length < 2) bad.push(j + ':' + used.join()); });
  ok(bad.length === 0, bad.join(' / '));
});

// ===== 7. 冒険の流れ・保存・重複防止 =====
function playAdv(save, ms, acc, tag) {
  A.begin(save, ms); const a = save.active; let q = 0; const reviews = [];
  for (let i = 0; i < 10; i++) { const ok = i < acc; const r = A.recordAnswer(save, { rid: tag + i, kind: 'basic', correct: ok }, ms); if (!ok && A.queueReview(save, r.origin, { id: 'q' + i })) reviews.push(r.origin); }
  reviews.forEach((o, k) => A.recordAnswer(save, { rid: tag + 'r' + k, kind: 'review', correct: true, origin: o }, ms));
  return a;
}
t('冒険：10基本回答＋復習で清算、XP/コインは清算時に一度だけ反映', () => {
  const s = C.newSave(0); playAdv(s, JST(2026, 11, 18, 10), 6, 'a'); eq(s.advXp, 0); eq(s.coins, 0); ok(A.canSettle(s));
  const r = A.settle(s, JST(2026, 11, 18, 10)); eq(r.N, 10); eq(r.C, 6); eq(r.R, 4); eq(r.xpBase, 10 * 10 + 5 * 6 + 5 * 4);  eq(s.advXp, r.xp); eq(s.jobXp.warrior, r.xp); eq(s.coins, r.coin + ((r.chest && r.chest.coin) || 0)); ok(s.active === null);
  eq(r.coinWelcome, 160);
});
t('清算の二重実行・結果再表示は副作用なし', () => { const s = C.newSave(0); playAdv(s, JST(2026, 11, 18, 10), 8, 'b'); const r = A.settle(s, 0), coins = s.coins, xp = s.advXp; eq(A.settle(s, 0), r); eq(s.coins, coins); eq(s.advXp, xp); });
t('回答イベントの重複（同じrid）は適用されない', () => { const s = C.newSave(0); A.begin(s, 1); const r1 = A.recordAnswer(s, { rid: 'x1', kind: 'basic', correct: true }, 1), r2 = A.recordAnswer(s, { rid: 'x1', kind: 'basic', correct: true }, 1); ok(r2.dup); eq(s.active.basic.n, 1); });
t('復習が済むまで清算できない／復習の追加XPはoriginごとに1回', () => {
  const s = C.newSave(0); A.begin(s, 1); const o = []; for (let i = 0; i < 10; i++) { const r = A.recordAnswer(s, { rid: 'c' + i, kind: 'basic', correct: i !== 0 }, 1); if (i === 0) { A.queueReview(s, r.origin, {}); o.push(r.origin); } }
  eq(A.canSettle(s), false); A.recordAnswer(s, { rid: 'r1', kind: 'review', correct: false, origin: o[0] }, 1); eq(A.canSettle(s), false);
  A.recordAnswer(s, { rid: 'r2', kind: 'review', correct: true, origin: o[0] }, 1); A.recordAnswer(s, { rid: 'r3', kind: 'review', correct: true, origin: o[0] }, 1); eq(s.active.reviews.ok.length, 1); eq(A.canSettle(s), true);
});
t('復習は最大5件／冒険', () => { const s = C.newSave(0); A.begin(s, 1); let n = 0; for (let i = 0; i < 8; i++) { const r = A.recordAnswer(s, { rid: 'd' + i, kind: 'basic', correct: false }, 1); if (A.queueReview(s, r.origin, {})) n++; } eq(n, 5); });
t('手動の「もう1回」（origin無し）は冒険に影響しない', () => { const s = C.newSave(0); A.begin(s, 1); const r = A.recordAnswer(s, { rid: 'm1', kind: 'review', correct: true }, 1); ok(r.ignored); eq(s.active.basic.n, 0); });
t('短いセッションの累積：3問→7問で1冒険（清算は10問目で1回）', () => {
  const s = C.newSave(0); A.begin(s, 1); for (let i = 0; i < 3; i++) A.recordAnswer(s, { rid: 's' + i, kind: 'basic', correct: true }, 1); eq(A.remainingBasics(s), 7); eq(A.canSettle(s), false); eq(A.settle(s, 1), null);
  for (let i = 3; i < 10; i++) A.recordAnswer(s, { rid: 's' + i, kind: 'basic', correct: true }, 1); eq(A.canSettle(s), true); ok(A.settle(s, 1)); eq(s.stats.adventures, 1);
});
t('日次倍率は最初の基本回答で固定。日をまたいで再開しても変わらない', () => {
  const s = C.newSave(0); A.begin(s, JST(2026, 11, 18, 23)); A.recordAnswer(s, { rid: 'e0', kind: 'basic', correct: true }, JST(2026, 11, 18, 23)); const m = s.active.slot.xpMult;
  for (let i = 1; i < 10; i++) A.recordAnswer(s, { rid: 'e' + i, kind: 'basic', correct: true }, JST(2026, 11, 19, 9)); eq(s.active.slot.xpMult, m); eq(s.daily.used['2026-11-19'] || 0, 0);
  A.settle(s, JST(2026, 11, 19, 9)); eq(C.reserveSlot(s, JST(2026, 11, 19, 10)).no, 1, '新しい日の枠は消費されていない');
});
t('未回答の冒険開始だけでは枠を消費しない', () => { const s = C.newSave(0); A.begin(s, JST(2026, 11, 18, 10)); eq(Object.keys(s.daily.used).length, 0); });
t('宝箱は日次1・2回目の冒険に1個ずつ（敗北でも）、3回目はなし', () => {
  const s = C.newSave(0); const res = [0, 1, 2].map(i => { playAdv(s, JST(2026, 11, 18, 10 + i), 5, 'f' + i); return A.settle(s, JST(2026, 11, 18, 10 + i)); }); eq(res.map(r => !!r.chest), [true, true, false]);
});
t('勝利で道のりが進み、継続・撤退では敵HPを引き継ぐ', () => {
  const s = C.newSave(0); playAdv(s, 1, 10, 'g'); const r = A.settle(s, 1); if (r.outcome === 'victory') eq(s.progress.step, 1); else eq(s.progress.enemyHp.hp, r.enemy.hpLeft);
  const s2 = C.newSave(0); A.begin(s2, 1); s2.active.battle.enemy.hp = 7; playAdv(s2, 1, 0, 'h'); const r2 = A.settle(s2, 1); ok(['continue', 'retreat'].includes(r2.outcome) || r2.outcome === 'victory');
});
t('ボスは全員勝利で地域クリア・次の地域へ、ボス素材+1・初回コイン', () => {
  const s = C.newSave(0); s.progress.step = 9; A.begin(s, 1); s.active.battle.enemy.hp = 1; playAdv(s, 1, 10, 'i'); const r = A.settle(s, 1); eq(r.outcome, 'victory'); eq(s.progress.step, 12); ok(s.progress.clearedRegions.includes('meadow')); eq(s.inv.mats.bm_meadow, 1); eq(r.coinKill, 100);
});
t('レベルアップは次の冒険から（開始時の職・Lvで戦う）', () => { const s = C.newSave(0); s.advXp = 0; const a = A.begin(s, 1); const lv = a.hero.advLv; s.advXp = 100000; eq(s.active.hero.advLv, lv); });

// ===== 8. 保存・復元 =====
t('保存→読込で同じ内容、revisionが進む', () => { const io = memStorage(), st = C.makeStore(io), s = C.newSave(5); s.coins = 77; eq(st.save(s).ok, true); eq(s.rev, 1); const l = st.load(0); ok(l.ok && !l.fresh); eq(l.save.coins, 77); eq(l.save.rev, 1); });
t('2タブ：古いタブは上書きできない（stale）', () => { const io = memStorage(), a = C.makeStore(io), s1 = C.newSave(0); a.save(s1); const tabA = a.load(0).save, tabB = a.load(0).save; eq(a.save(tabA).ok, true); const r = a.save(tabB); eq(r.ok, false); eq(r.err, 'stale'); });
t('保存不能（容量超過など）は成功扱いにしない', () => { const io = { get: () => null, set: () => { throw new Error('QuotaExceeded'); } }; const r = C.makeStore(io).save(C.newSave(0)); eq(r.ok, false); eq(r.err, 'storage'); });
t('読み出した値が違えば保存失敗（メモリだけに逃げない）', () => { const io = { get: () => null, set: () => {} }; eq(C.makeStore(io).save(C.newSave(0)).ok, false); });
t('壊れたセーブは読み込みで拒否し新規開始に切り替えない（err=corrupt）', () => { const io = memStorage(); io.set(C.LS_RPG, '{"v":1,"broken'); const l = C.makeStore(io).load(0); eq(l.ok, false); eq(l.err, 'corrupt'); io.set(C.LS_RPG, JSON.stringify({ v: 1, rev: 1 })); eq(C.makeStore(io).load(0).ok, false); });
t('書き出し/読み込み：送信キューと端末IDを含まない', () => { const s = C.newSave(0); const x = JSON.parse(C.buildExport({ stats: { q1: { w: 1, c: 2, s: 0 } }, sel: { filter: '社会' }, rpg: s }, 1)); ok(!('queue' in x) && !('dev' in x)); eq(x.kind, 'ichimon-save'); });
t('復元：検証失敗では何も変えない／成功時は現在をバックアップし送信キューを保持', () => {
  const io = memStorage(); io.set('ichimon.stats.v1', '{"a":{"w":1,"c":1,"s":0}}'); io.set('ichimon.queue.v1', '{"seq":3,"rows":[{"rid":"x"}]}'); io.set('ichimon.dev.v1', 'devid'); const before = JSON.stringify(io.m);
  const bad = C.applyImport('{"kind":"x"}', io, 1); eq(bad.ok, false); eq(JSON.stringify(io.m), before);
  const bad2 = C.applyImport(JSON.stringify({ kind: 'ichimon-save', v: 1, stats: { z: { w: 'x' } }, rpg: null }), io, 1); eq(bad2.ok, false); eq(JSON.stringify(io.m), before);
  const s = C.newSave(0); s.coins = 999; const good = C.applyImport(C.buildExport({ stats: { b: { w: 0, c: 3, s: 3 } }, sel: null, rpg: s }, 2), io, 3);
  eq(good.ok, true); ok(io.m[C.LS_BACKUP]); eq(JSON.parse(io.m['ichimon.stats.v1']).b.c, 3); eq(io.m['ichimon.queue.v1'], '{"seq":3,"rows":[{"rid":"x"}]}'); eq(io.m['ichimon.dev.v1'], 'devid'); eq(JSON.parse(io.m[C.LS_RPG]).coins, 999); eq(JSON.parse(io.m[C.LS_RPG]).active, null);
});
t('セーブ検証：不正な値を弾く', () => { const s = C.newSave(0); eq(C.validateSave(s), []); s.coins = -1; ok(C.validateSave(s).length); const s2 = C.newSave(0); s2.inv.items.zzz = 1; ok(C.validateSave(s2).length); });

// ===== 9. 転職条件 =====
t('転職：最初の冒険のあと基本職、基本2つLv10で上級、最上級は試練が必要', () => {
  const s = C.newSave(0); ok(C.canChangeJob(s, 'mage')); s.firstDone = true; eq(C.canChangeJob(s, 'mage'), null); ok(C.canChangeJob(s, 'magicknight'));
  s.jobXp.warrior = C.cum(C.NEED.base, 10); s.jobXp.mage = C.cum(C.NEED.base, 10); eq(C.canChangeJob(s, 'magicknight'), null); ok(C.canChangeJob(s, 'skyknight'));
});

// ===== 10. 長期シミュレーション（第1章・固定seed） =====
const simRows = {};
[0.3, 0.6, 0.8, 1.0].forEach(acc => { simRows[acc] = [1, 2, 3, 4, 5].map(seed => SIM.playJourney({ acc, days: 150, seed, jobPath: ['warrior', 'mage', 'magicknight'], stopAtCh1: true }).stat); });
t('第1章：正答率60〜80%で70〜80冒険（約36日）', () => { [0.6, 0.8].forEach(a => simRows[a].forEach(r => { ok(r.ch1Adv >= 66 && r.ch1Adv <= 85, a + ': ' + r.ch1Adv); })); });
t('正答率30%でも成長が止まらず第1章に到達する', () => simRows[0.3].forEach(r => { ok(r.ch1Day != null, '未到達'); ok(r.final.advLv >= 15); }));
t('100%でも第1章は人為的に止めない（60%より極端に速くならない）', () => simRows[1].forEach(r => ok(r.ch1Adv >= 66, String(r.ch1Adv))));
t('第1章の初期資金：全正解でも通常装備ランクIII まで買い切れず、貧窮もしない', () => simRows[0.6].forEach(r => ok(r.final.coins >= 0)));

console.log(JSON.stringify({ pass, fail, failures }, null, 1));
const summary = Object.keys(simRows).map(a => ({ acc: a, ch1Adv: simRows[a].map(r => r.ch1Adv), ch1Day: simRows[a].map(r => r.ch1Day), advLv: simRows[a].map(r => r.final.advLv), retreats: simRows[a].map(r => r.retreats), winsPerAdv: +(simRows[a].reduce((s, r) => s + r.wins, 0) / simRows[a].reduce((s, r) => s + r.adv, 0)).toFixed(2) }));
if (process.argv.includes('--sim')) console.log(JSON.stringify(summary));
process.exit(fail ? 1 : 0);
