'use strict';
// 第3段：固有装備18・秘境装備6・クリア後の冒険（再戦・試練・秘境6・孤島・隠しボス）の定義。DOM非依存。
// rpg-data.js の D.ITEMS / D.ENEMIES を拡張する（rpg-data.js の直後に読み込む）。ここの敵能力値と装備効果は補完値（DECISIONS D-28〜D-33）。
(function (root, factory) {
  const m = factory(typeof module === 'object' && module.exports ? require('./rpg-data.js') : root.RPGData);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.RPGWorld = m;
})(typeof self !== 'undefined' ? self : this, function (D) {
  if (D.WORLD) return D.WORLD;
  const ATK = { k: 'atk', m: 1 };

  // ---------- 敵の行動に属性を付ける（白銀の胸当てが軽減する対象） ----------
  const EL_BY_NAME = { 'ブレス': 'water', '大波': 'water', '砂の大波': 'water', '氷息': 'ice', '氷の息': 'ice', '極光のブレス': 'ice', '熔岩の一撃': 'fire', '熱風': 'fire', '雷磁砲': 'thunder', '集光砲': 'light', '虚空の光': 'light', '水門ぱんち': 'water', 'うずまきの舞': 'water', '葉の嵐': 'water' };
  Object.keys(D.ENEMIES).forEach(id => D.ENEMIES[id].pattern.forEach(a => { if (a.n && EL_BY_NAME[a.n] && !a.el) a.el = EL_BY_NAME[a.n]; }));

  // ---------- 固有装備（本編18）：地域×章。ボス素材3個で製作、再鍛造でランクを上げる ----------
  // ch/ri＝章と、その章の何番目の地域か。素材はその地域のボス素材 bm_<地域id>
  const RANKS = [1, 2, 3, 4, 5, 6];
  const UNIQ = [
    { key: 'kojunotate', name: '古樹の盾飾り', ch: 1, ri: 0, slot: 'acc', cat: 'shieldorn', fx: { firstReduce: 0.25 } },
    { key: 'konponoyubiwa', name: '根源の指輪', ch: 2, ri: 0, slot: 'acc', cat: 'ring', fx: { reviewHeal: 0.05 } },
    { key: 'suitennomanto', name: '翠天のマント', ch: 3, ri: 0, slot: 'acc', cat: 'charm', fx: { guardNormal: 0.12 } },
    { key: 'suishonomamori', name: '水晶のまもり', ch: 1, ri: 1, slot: 'acc', cat: 'charm', fx: { bigReduce: 0.15 } },
    { key: 'chionnotsue', name: '潮音の杖', ch: 2, ri: 1, slot: 'weapon', cat: 'staff', fx: { switchBonus: 0.12 } },
    { key: 'shinpekinogofu', name: '深碧の護符', ch: 3, ri: 1, slot: 'acc', cat: 'charm', fx: { lowGuard: 0.40 } },
    { key: 'tokisunanotanken', name: '時砂の短剣', ch: 1, ri: 2, slot: 'weapon', cat: 'dagger', fx: { teleBonus: 0.15 } },
    { key: 'somenoyubiwa', name: '双面の指輪', ch: 2, ri: 2, slot: 'acc', cat: 'ring', fx: { diffSkill: 0.10 } },
    { key: 'tenbinnotsurugi', name: '天秤のつるぎ', ch: 3, ri: 2, slot: 'weapon', cat: 'sword', fx: { switchGuard: 0.12 } },
    { key: 'hakuginnomunaate', name: '白銀の胸当て', ch: 1, ri: 3, slot: 'armor', cat: 'heavy', fx: { elemReduce: 0.20 } },
    { key: 'yoshonobukikazari', name: '熔晶の武器飾り', ch: 2, ri: 3, slot: 'acc', cat: 'ring', fx: { skillAdd: 0.15 } },
    { key: 'kyokkonokoromo', name: '極光の衣', ch: 3, ri: 3, slot: 'armor', cat: 'robe', fx: { weakHeal: 0.06 } },
    { key: 'kurogane', name: '黒鋼の盾飾り', ch: 1, ri: 4, slot: 'acc', cat: 'shieldorn', fx: { guardBoost: 0.08 } },
    { key: 'kyoheinoyumi', name: '巨兵の弓', ch: 2, ri: 4, slot: 'weapon', cat: 'bow', fx: { stackBoost: 0.20 } },
    { key: 'josainoyoroi', name: '城塞の鎧', ch: 3, ri: 4, slot: 'armor', cat: 'heavy', fx: { teleGuard: 0.15 } },
    { key: 'kijinnoyubiwa', name: '機神の指輪', ch: 1, ri: 5, slot: 'acc', cat: 'ring', fx: { firstSkill: 0.12 } },
    { key: 'kiokunogofu', name: '記憶の護符', ch: 2, ri: 5, slot: 'acc', cat: 'charm', fx: { inhBoost: 0.12 } },
    { key: 'okannohoshi', name: '王冠の星飾り', ch: 3, ri: 5, slot: 'acc', cat: 'shieldorn', fx: { afterBig: 0.08 } }
  ];
  const FX_SCALE = r => 1 + 0.04 * (r - 1);   // 再鍛造：ランクごとに効果量+4%（ランクVIで+20%まで。上限つき）
  const scaleFx = (fx, r) => { const o = {}; Object.keys(fx).forEach(k => { o[k] = Math.round(fx[k] * FX_SCALE(r) * 1000) / 1000; }); return o; };
  UNIQ.forEach(u => {
    u.region = D.REGIONS.filter(r => r.ch === u.ch)[u.ri];
    u.mat = 'bm_' + u.region.id; u.matName = u.region.mat; u.need = 3;
    u.chCap = u.ch === 1 ? 3 : u.ch === 2 ? 5 : 6;   // 製作時のランク上限（そのとき解放済みの最高ランク。章ごとの上限）
    RANKS.forEach(r => {
      const base = u.slot === 'weapon' ? D.ITEMS[`w_${u.cat}_${r}`] : u.slot === 'armor' ? D.ITEMS[`a_${u.cat}_${r}`] : D.ITEMS[`x_${u.cat}_${r}`];
      const it = { id: `u_${u.key}_${r}`, slot: u.slot, cat: u.cat, wish: 'unique', rank: r, rarity: 'unique', unique: u.key, name: u.name, price: base.price, fx: scaleFx(u.fx, r) };
      if (u.slot === 'weapon') it.atk = Math.round(base.atk * 1.05); else if (u.slot === 'armor') it.def = Math.round(base.def * 1.05);
      D.ITEMS[it.id] = it;
    });
  });
  const UNIQ_BY_KEY = {}; UNIQ.forEach(u => { UNIQ_BY_KEY[u.key] = u; });
  const uniqId = (key, rank) => `u_${key}_${rank}`;
  const uniqRank = id => { const m = /^u_.+_(\d)$/.exec(id); return m ? +m[1] : 0; };

  // ---------- 試練・秘境・孤島（クリア後など）の背景id ----------
  // 秘境装備（各1。ランクVI相当の固定。再鍛造なし）
  const SECRET_DEFS = [
    { id: 'garden', name: '眠らずの花園', point: ['ねむらぬ花畑', 'ひかる蜜の道', '花冠の回廊', '女王の間の前'], boss: '花冠の女王', title: '花園の友', costume: { id: 'garden', name: '花園のころも', color: '#d86a9a' },
      item: { id: 'relic_garden', name: '花冠のしずく', fx: { healBonus: 0.15, hpPct: 0.05 }, text: '回復の技が よくきく' }, ptn: [ATK, { k: 'guard', n: '花びらのまもり' }, ATK, { k: 'big', m: 1.6, n: '花粉のあらし' }], bp: [ATK, { k: 'guard', n: '花びらのまもり' }, { k: 'big', m: 1.8, n: 'いばらのむち' }, ATK, { k: 'guard', n: 'つぼみにこもる' }, { k: 'big', m: 2.0, n: '花冠のあらし' }] },
    { id: 'pearl', name: '真珠の迷宮', point: ['うす青の入口', 'まがる貝殻の道', '光るうずの間', '大王イカの巣'], boss: '真珠の大王イカ', title: '迷宮のぬし', costume: { id: 'pearl', name: '真珠のころも', color: '#9ad0e8' },
      item: { id: 'relic_pearl', name: '真珠のまもり', fx: { reduce: 0.08, firstReduce: 0.15 }, text: '受けるダメージが へる' }, ptn: [{ k: 'charge', n: 'うずをつくる' }, { k: 'big', m: 1.5, n: '真珠のなみ' }, ATK, { k: 'big', m: 1.5, n: 'しおのかべ' }], bp: [{ k: 'charge', n: 'すみをためる' }, { k: 'big', m: 1.6, n: 'すみのあらし' }, { k: 'charge', n: 'うずをつくる' }, { k: 'big', m: 1.6, n: '大うず' }, ATK] },
    { id: 'nightcity', name: '夜歩きの都市', point: ['ねむらぬ大通り', 'ちいさな路地', '月のかげの広場', '見はりの塔'], boss: '月蝕のジャッカル', title: '夜の旅人', costume: { id: 'nightcity', name: '夜のマント', color: '#3a3a6a' },
      item: { id: 'relic_night', name: '月蝕のかげ飾り', fx: { firstMulti: 0.25 }, text: '連続こうげきが つよい' }, ptn: [ATK, { k: 'big', m: 2.0, n: '月のかげ' }, { k: 'idle', n: 'すきだらけ' }, ATK], bp: [ATK, { k: 'big', m: 2.2, n: '月蝕のきば' }, { k: 'idle', n: '息をととのえる' }, ATK, { k: 'big', m: 2.2, n: '月蝕のきば' }, { k: 'idle', n: 'すきだらけ' }] },
    { id: 'dragonvalley', name: '竜の眠る谷', point: ['ほねの谷口', 'こおる川底', 'うろこの岩場', '古竜のねどこ'], boss: '古竜フロストホーン', title: '谷をこえた人', costume: { id: 'dragon', name: '古竜のころも', color: '#6fa8d8' },
      item: { id: 'relic_dragon', name: '古竜のうろこ', fx: { elemAdd: ['ice', 0.2] }, text: '技に 氷のダメージが のる' }, ptn: [ATK, ATK, { k: 'charge', n: 'ねむりからさめる' }, { k: 'big', m: 2.2, n: 'こおりのいき' }], bp: [ATK, ATK, { k: 'guard', n: 'つのでまもる' }, ATK, { k: 'charge', n: '大きく息をすう' }, { k: 'big', m: 2.3, n: 'ぜっぴょうのいき' }] },
    { id: 'lab0', name: '零号研究所', point: ['しずかな入口', '部品のたな', '実験ホール', '試作機の間'], boss: '試作機ゼロ', title: '零号の見習い', costume: { id: 'lab', name: '機工のころも', color: '#8a96a8' },
      item: { id: 'relic_lab', name: '零号の補助コア', fx: { firstSkill: 0.15, inhBoost: 0.10 }, text: '技の たすけになる' }, ptn: [{ k: 'brace', n: 'ぶんれつ' }, ATK, { k: 'guard', n: 'ほごモード' }, { k: 'charge', n: 'じゅうでん' }, { k: 'big', m: 2.0, n: 'ほうしゃ' }], bp: [{ k: 'guard', n: 'シールド' }, ATK, { k: 'brace', n: 'かまえる' }, { k: 'charge', n: 'じゅうでん' }, { k: 'big', m: 2.1, n: 'ほうしゃ' }, { k: 'idle', n: 'れいきゃく' }] },
    { id: 'orchard', name: '星の果樹園', point: ['ほし色の小道', 'ひかる実の木立', '星のいけ', '星喰いの根かた'], boss: '星喰いの獣', title: '星をつむ人', costume: { id: 'orchard', name: '星のころも', color: '#c0b0f0' },
      item: { id: 'relic_orchard', name: '星果の首かざり', fx: { stackBoost: 0.25, afterBig: 0.05 }, text: 'ためた力が つよくなる' }, ptn: [{ k: 'charge', n: 'ほしをためる' }, ATK, { k: 'charge', n: 'ほしをためる' }, { k: 'big', m: 2.4, n: 'ほしのあらし' }], bp: [{ k: 'charge', n: 'ほしをのみこむ' }, ATK, { k: 'charge', n: 'ほしをのみこむ' }, { k: 'big', m: 2.5, n: '星喰いのほえ声' }, { k: 'idle', n: 'ふらつく' }] }
  ];
  SECRET_DEFS.forEach(s => {
    D.ITEMS[s.item.id] = { id: s.item.id, slot: 'acc', cat: 'relic', wish: 'unique', rank: 6, rarity: 'unique', relic: true, name: s.item.name, price: 1250, fx: s.item.fx, note: s.item.text };
  });

  // ---------- 冒険の道（クエスト）の組み立て ----------
  const BGS = ['trial_wing', 'trial_star', 'garden', 'pearl', 'nightcity', 'dragonvalley', 'lab0', 'orchard', 'dawnisle'];
  let enemyN = 0;
  function mkEnemy(id, name, o) {
    const e = { id, name, hp: o.hp, atk: o.atk, def: o.def, weak: o.weak || null, pattern: o.pattern, region: o.bg, boss: !!o.boss };
    D.ENEMIES[id] = e; enemyN++; return e;
  }
  const entry = (q, i, e, g, point, seg, boss, extra) => Object.assign({ g, region: -1, step: i, point, seg, enemy: e.id, boss, stats: D.statsAt(e, g), bg: q.bg, quest: q.id }, extra || {});
  const QUESTS = {}, QUEST_ORDER = [];
  function addQuest(q) { QUESTS[q.id] = q; QUEST_ORDER.push(q.id); return q; }

  // 再戦：クリア済みのボス（18）。素材 bm_<地域> と コイン30 を得る。HPは1冒険ごとに続き、倒すと満タンから
  D.REGIONS.forEach((r, ri) => {
    const bi = D.REGION_START[ri + 1] - 1, be = D.ROUTE[bi];
    const q = { id: 'rematch_' + r.id, kind: 'rematch', name: r.boss.name + 'との さいせん', short: r.name, bg: r.id, region: r.id, ri, loop: true, coinFirst: 0 };
    q.segs = [Object.assign({}, be, { step: 0, quest: q.id, bg: r.id, point: r.name + 'のボス', seg: 1 })];
    addQuest(q);
  });

  // 試練（最上級職）：3つの短い戦い＋ボス（3冒険）
  const TRIALS = [
    { id: 'trial_wing', trial: 'wing', job: 'skyknight', name: 'つばさの しれん', bg: 'trial_wing', boss: '暁翼の騎士', title: '暁の翼', costume: { id: 'wing', name: '暁翼のころも', color: '#f0c860' },
      shorts: [['こうげきの間', '試しの石像', { hp: 1.1, atk: 0.8, def: 1.3, pattern: [ATK] }], ['ぼうぎょの間', '試しの剣士', { hp: 1.0, atk: 1.2, def: 0.7, pattern: [ATK, { k: 'big', m: 1.8, n: '重い一閃' }] }], ['はんげきの間', '試しの影', { hp: 1.0, atk: 1.0, def: 0.8, pattern: [{ k: 'brace', n: 'かまえる' }, ATK, { k: 'guard', n: 'みをまもる' }, { k: 'big', m: 1.8, n: 'はんげき' }] }]],
      bossPat: [ATK, { k: 'guard', n: 'つばさで まもる' }, { k: 'big', m: 2.3, n: '暁の急降下' }, ATK], bossWeak: 'light' },
    { id: 'trial_star', trial: 'star', job: 'starseer', name: 'ほしの しれん', bg: 'trial_star', boss: '星環の導師', title: '星環の弟子', costume: { id: 'star', name: '星環のころも', color: '#4a4fb0' },
      shorts: [['こうげきの間', '試しの星影', { hp: 1.1, atk: 0.8, def: 1.2, pattern: [ATK] }], ['かいふくの間', '試しの小星', { hp: 1.0, atk: 1.0, def: 0.7, pattern: [ATK, ATK, { k: 'big', m: 1.6, n: '星のたば' }] }], ['ちくせきの間', '試しの星守', { hp: 1.0, atk: 1.0, def: 0.8, pattern: [{ k: 'charge', n: 'ひかりを ためる' }, ATK, { k: 'big', m: 2.0, n: '星の光' }] }]],
      bossPat: [{ k: 'charge', n: '星を めぐらせる' }, ATK, { k: 'big', m: 2.3, n: '星環の光' }, { k: 'guard', n: '星の かべ' }], bossWeak: null }
  ];
  const TG = 240;   // 試練の敵は道のり240〜250の強さ
  TRIALS.forEach(t => {
    const q = addQuest({ id: t.id, kind: 'trial', trial: t.trial, job: t.job, name: t.name, bg: t.bg, boss: t.boss, coinFirst: 300, title: t.title, costume: t.costume, mat: { id: 'trial_' + t.trial, name: t.trial === 'wing' ? '暁の羽根' : '星環のかけら' } });
    q.segs = []; let i = 0;
    t.shorts.forEach((s, k) => { const e = mkEnemy('t_' + t.trial + k, s[1], { bg: t.bg, hp: s[2].hp, atk: s[2].atk, def: s[2].def, pattern: s[2].pattern }); q.segs.push(entry(q, i++, e, TG + k * 2, s[0], 1, false)); });
    const be = mkEnemy('tb_' + t.trial, t.boss, { bg: t.bg, boss: true, hp: 3.6, atk: 1.05, def: 1.1, weak: t.bossWeak, pattern: t.bossPat });
    for (let k = 0; k < 3; k++) q.segs.push(entry(q, i++, be, TG + 8 + k, 'しれんの ひろま', k + 1, true));
  });

  // 秘境6：通常12区間（4地点×3）＋ボス4。既存の強化個体（行動を変えたもの）
  const SG = { start: 232, per: 1.7, boss: 256 };   // 道のりに相当する強さ（調整値）
  SECRET_DEFS.forEach((s, si) => {
    const q = addQuest({ id: 'secret_' + s.id, kind: 'secret', name: s.name, bg: s.id, boss: s.boss, idx: si, coinFirst: 300, title: s.title, costume: s.costume, def: s, mat: { id: 'dawn_' + si, name: '夜明けのかけら' } });
    const base = D.REGIONS[12 + si].enemies.concat(D.REGIONS[6 + si].enemies).slice(0, 5), pre = { garden: '花園の', pearl: '真珠の', nightcity: '夜の', dragonvalley: '谷の', lab0: '零号の', orchard: '果樹園の' }[s.id];
    const vars = base.map((b, k) => mkEnemy(`x_${s.id}_${k}`, pre + b.name, { bg: s.id, hp: b.hp * 1.15, atk: b.atk * 1.05, def: b.def, weak: b.weak, pattern: s.ptn }));
    q.segs = []; let i = 0;
    for (let k = 0; k < 12; k++) q.segs.push(entry(q, i++, vars[k % 5], Math.round(SG.start + k * SG.per + si), s.point[Math.floor(k / 3)], (k % 3) + 1, false));
    const be = mkEnemy('xb_' + s.id, s.boss, { bg: s.id, boss: true, hp: 3.0, atk: 1.12, def: 1.1, weak: base[0].weak, pattern: s.bp });
    for (let k = 0; k < 4; k++) q.segs.push(entry(q, i++, be, Math.round(SG.boss + si), s.name + 'のボス', k + 1, true));
  });

  // 夜明けの孤島：通常30（6地点×5）＋ボス6（暁の竜＝隠しボス）
  (function () {
    const q = addQuest({ id: 'island', kind: 'island', name: '夜明けの孤島', bg: 'dawnisle', boss: '暁の竜', coinFirst: 500, title: '空の果てを見た者', costume: { id: 'dawn', name: '夜明けのころも', color: '#f6c88a' }, mat: { id: 'dawn_dragon', name: '暁の竜のうろこ' } });
    const pts = ['夜明けの浜辺', 'しずかな岩場', '星のわき水', '古い灯台のあと', '雲海の丘', '竜の巣の入口'];
    const pool = []; SECRET_DEFS.forEach(s => { for (let k = 0; k < 5; k++) pool.push(D.ENEMIES[`x_${s.id}_${k}`]); });
    const pats = [[ATK, { k: 'big', m: 1.8, n: 'あかつきの光' }], [{ k: 'charge', n: 'ひかりをためる' }, { k: 'big', m: 2.0, n: 'あかつきの光' }, ATK], [ATK, { k: 'guard', n: 'みをまもる' }, ATK, { k: 'big', m: 1.9, n: 'あかつきの光' }]];
    q.segs = []; let i = 0;
    for (let k = 0; k < 30; k++) {
      const b = pool[(k * 7) % pool.length];
      const e = mkEnemy(`xi_${k}`, '夜明けの' + b.name.replace(/^[^の]*の/, ''), { bg: 'dawnisle', hp: b.hp * 0.95, atk: b.atk * 0.98, def: b.def, weak: b.weak, pattern: pats[k % 3] });
      q.segs.push(entry(q, i++, e, 236 + Math.round(k * 0.6), pts[Math.floor(k / 5)], (k % 5) + 1, false));
    }
    const be = mkEnemy('xb_dawndragon', '暁の竜', { bg: 'dawnisle', boss: true, hp: 2.5, atk: 1.15, def: 1.15, weak: 'light', pattern: [ATK, { k: 'guard', n: 'つばさで まもる' }, { k: 'charge', n: '夜明けを よぶ' }, { k: 'big', m: 2.6, n: '暁のブレス' }, { k: 'idle', n: '息をつく' }] });
    for (let k = 0; k < 6; k++) q.segs.push(entry(q, i++, be, 276 + k, '暁の竜のねどこ', k + 1, true));
  })();

  const SECRET_IDS = SECRET_DEFS.map(s => 'secret_' + s.id);
  const BG_NAMES = { trial_wing: 'つばさの しれん', trial_star: 'ほしの しれん', garden: '眠らずの花園', pearl: '真珠の迷宮', nightcity: '夜歩きの都市', dragonvalley: '竜の眠る谷', lab0: '零号研究所', orchard: '星の果樹園', dawnisle: '夜明けの孤島' };
  D.WORLD = { UNIQ, UNIQ_BY_KEY, uniqId, uniqRank, scaleFx, FX_SCALE, RANKS, SECRET_DEFS, SECRET_IDS, QUESTS, QUEST_ORDER, TRIALS, BGS, BG_NAMES, EL_BY_NAME, enemyN };
  return D.WORLD;
});
