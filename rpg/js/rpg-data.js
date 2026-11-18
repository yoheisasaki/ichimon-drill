'use strict';
// 職業・技・敵・装備のデータ（問題データとは別。DOM非依存。node でもブラウザでも読める）
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.RPGData = m;
})(typeof self !== 'undefined' ? self : this, function () {
  const ELEMENTS = ['fire', 'ice', 'thunder', 'water', 'light'];
  const EL_NAME = { fire: '炎', ice: '氷', thunder: '雷', water: '水', light: '光' };

  // ---------- 職業 ----------
  // mod = HP/攻撃/防御 の職業補正（基本職のみ。上級・最上級は 1/1/1）
  const JOBS = {
    warrior: { name: '戦士', ruby: '{戦士|せんし}', tier: 'base', weapons: ['sword'], mod: [1.10, 1.05, 1.05] },
    mage: { name: '魔法使い', ruby: '{魔法使|まほうつか}い', tier: 'base', weapons: ['staff'], mod: [0.95, 1.10, 0.95] },
    priest: { name: '僧侶', ruby: '{僧侶|そうりょ}', tier: 'base', weapons: ['staff'], mod: [1.05, 1.00, 1.05] },
    thief: { name: '盗賊', ruby: '{盗賊|とうぞく}', tier: 'base', weapons: ['dagger'], mod: [1.00, 1.05, 1.00] },
    magicknight: { name: '魔法戦士', ruby: '{魔法戦士|まほうせんし}', tier: 'adv', req: ['warrior', 'mage'], weapons: ['sword', 'staff'], mod: [1, 1, 1] },
    paladin: { name: '聖騎士', ruby: '{聖騎士|せいきし}', tier: 'adv', req: ['warrior', 'priest'], weapons: ['sword', 'staff'], mod: [1, 1, 1] },
    shadow: { name: '影武者', ruby: '{影武者|かげむしゃ}', tier: 'adv', req: ['warrior', 'thief'], weapons: ['sword', 'dagger'], mod: [1, 1, 1] },
    sage: { name: '賢者', ruby: '{賢者|けんじゃ}', tier: 'adv', req: ['mage', 'priest'], weapons: ['staff'], mod: [1, 1, 1] },
    ninja: { name: '忍者', ruby: '{忍者|にんじゃ}', tier: 'adv', req: ['mage', 'thief'], weapons: ['dagger'], mod: [1, 1, 1] },
    ranger: { name: 'レンジャー', ruby: 'レンジャー', tier: 'adv', req: ['priest', 'thief'], weapons: ['bow', 'dagger'], mod: [1, 1, 1] },
    skyknight: { name: '天翔騎士', ruby: '{天翔騎士|てんしょうきし}', tier: 'top', reqFrom: ['magicknight', 'paladin', 'shadow'], trial: 'wing', weapons: ['sword'], mod: [1, 1, 1] },
    starseer: { name: '星詠み', ruby: '{星詠|ほしよ}み', tier: 'top', reqFrom: ['sage', 'ninja', 'ranger'], trial: 'star', weapons: ['staff'], mod: [1, 1, 1] }
  };
  const JOB_IDS = Object.keys(JOBS);
  const FIRST_JOB = 'warrior';

  // ---------- 技 ----------
  // m: 倍率 / hits: [[倍率,属性],...] / el: 属性 / heal: 最大HP割合 / guard:[軽減率,敵攻撃回数] / atkDown: 敵攻撃力低下率
  // ig: 敵防御の無視割合 / igTG: 敵の一時防御を無視 / prep: 敵が大技を準備中の倍率 / stack: {k,per,use}
  // fx: 職固有の効果キー（battle.js が解釈。継承したときは元職の固有能力を発動させない）
  // inh: 他職へ継承できる / up: [[Lv,'madd',値]] 職業レベルでの強化
  const SK = [];
  function S(id, job, lv, name, ruby, cost, o) { SK.push(Object.assign({ id, job, lv, name, ruby, cost }, o || {})); }
  // 戦士
  S('w_strike', 'warrior', 2, '強打', '{強打|きょうだ}', 2, { m: 1.8, inh: true, up: [[25, 'madd', 0.3]] });
  S('w_shield', 'warrior', 5, '盾うち', '{盾|たて}うち', 2, { m: 1.2, guard: [0.5, 1], inh: true });
  S('w_rock', 'warrior', 8, '岩くだき', '{岩|いわ}くだき', 3, { m: 1.8, ig: 0.5, up: [[15, 'madd', 0.2]] });
  S('w_brave', 'warrior', 10, '勇猛の一撃', '{勇猛|ゆうもう}の{一撃|いちげき}', 5, { m: 3.0 });
  // 魔法使い
  S('m_fire', 'mage', 2, '火の玉', '{火|ひ}の{玉|たま}', 2, { m: 1.8, el: 'fire', inh: true, up: [[25, 'madd', 0.3]] });
  S('m_ice', 'mage', 5, '氷の矢', '{氷|こおり}の{矢|や}', 2, { m: 1.5, el: 'ice', atkDown: 0.25, inh: true });
  S('m_thunder', 'mage', 8, 'いかずち', 'いかずち', 3, { m: 2.2, el: 'thunder', up: [[15, 'madd', 0.2]] });
  S('m_rain', 'mage', 10, '星の雨', '{星|ほし}の{雨|あめ}', 5, { hits: [[0.8], [0.8], [0.8], [0.8]] });
  // 僧侶
  S('p_heal', 'priest', 2, 'いやしの光', 'いやしの{光|ひかり}', 2, { m: 0.8, heal: 0.25, inh: true, up: [[25, 'madd', 0.3]] });
  S('p_arrow', 'priest', 5, '光の矢', '{光|ひかり}の{矢|や}', 2, { m: 1.8, el: 'light', inh: true });
  S('p_barrier', 'priest', 8, '守りの結界', '{守|まも}りの{結界|けっかい}', 3, { m: 1.2, guard: [0.4, 2], up: [[15, 'madd', 0.2]] });
  S('p_holy', 'priest', 10, '聖なる光', '{聖|せい}なる{光|ひかり}', 5, { m: 2.0, heal: 0.4 });
  // 盗賊
  S('t_twin', 'thief', 2, '二連斬り', '{二連斬|にれんぎ}り', 2, { hits: [[0.9], [0.9]], inh: true, up: [[25, 'madd', 0.3]] });
  S('t_parry', 'thief', 5, '見切り斬り', '{見切|みき}り{斬|ぎ}り', 2, { m: 1.2, guard: [0.5, 1], inh: true });
  S('t_gap', 'thief', 8, 'すき間ぬい', 'すき{間|ま}ぬい', 3, { m: 2.0, prep: 2.8, up: [[15, 'madd', 0.2]] });
  S('t_gale', 'thief', 10, '疾風四連', '{疾風四連|しっぷうよんれん}', 5, { hits: [[0.8], [0.8], [0.8], [0.8]] });
  // 魔法戦士
  S('mk_fire', 'magicknight', 1, '炎の剣', '{炎|ほのお}の{剣|けん}', 2, { m: 1.8, el: 'fire', fx: ['imbue:fire'], up: [[25, 'madd', 0.3]] });
  S('mk_ice', 'magicknight', 3, '氷の構え', '{氷|こおり}の{構|かま}え', 2, { m: 1.4, el: 'ice', guard: [0.35, 1], fx: ['imbue:ice'], inh: true });
  S('mk_thunder', 'magicknight', 5, '雷光斬', '{雷光斬|らいこうざん}', 3, { m: 2.3, el: 'thunder', fx: ['imbue:thunder'] });
  S('mk_release', 'magicknight', 8, '魔力解放', '{魔力解放|まりょくかいほう}', 3, { m: 2.8, fx: ['release'] });
  S('mk_dance', 'magicknight', 10, '三色の剣舞', '{三色|さんしょく}の{剣舞|けんぶ}', 5, { hits: [[1, 'fire'], [1, 'ice'], [1, 'thunder']], fx: ['imbue:thunder'] });
  S('mk_rainbow', 'magicknight', 20, '虹の一閃', '{虹|にじ}の{一閃|いっせん}', 6, { m: 4.0, fx: ['rainbow'] });
  // 聖騎士
  S('pa_shield', 'paladin', 1, '聖なる盾', '{聖|せい}なる{盾|たて}', 2, { m: 1.2, guard: [0.6, 1], up: [[25, 'mset', 1.5]] });
  S('pa_sword', 'paladin', 3, 'いやしの剣', 'いやしの{剣|けん}', 2, { m: 1.0, heal: 0.2, inh: true });
  S('pa_smite', 'paladin', 5, '守護の一撃', '{守護|しゅご}の{一撃|いちげき}', 3, { m: 2.0, stack: { k: 'shield', per: 0.5, use: 'all' } });
  S('pa_wall', 'paladin', 8, '不落の構え', '{不落|ふらく}の{構|かま}え', 3, { m: 1.0, guard: [0.5, 2] });
  S('pa_light', 'paladin', 10, '光の一閃', '{光|ひかり}の{一閃|いっせん}', 5, { m: 3.0, el: 'light', heal: 0.2 });
  S('pa_dawn', 'paladin', 20, '暁の裁き', '{暁|あかつき}の{裁|さば}き', 6, { m: 3.5, el: 'light', stack: { k: 'shield', per: 0.5, use: 'all' } });
  // 影武者
  S('sh_copy', 'shadow', 1, '影写し', '{影写|かげうつ}し', 2, { m: 1.5, fx: ['shadow2'], up: [[25, 'mset', 1.8]] });
  S('sh_after', 'shadow', 3, '残像斬り', '{残像斬|ざんぞうぎ}り', 2, { m: 1.3, guard: [0.4, 1], inh: true });
  S('sh_pinch', 'shadow', 5, '挟み撃ち', '{挟|はさ}み{撃|う}ち', 3, { m: 2.0, stack: { k: 'shadow', per: 0.6, use: 'all' } });
  S('sh_pass', 'shadow', 8, '影渡り', '{影渡|かげわた}り', 3, { m: 2.2, igTG: true });
  S('sh_three', 'shadow', 10, '疾風三連', '{疾風三連|しっぷうさんれん}', 5, { hits: [[1.1], [1.1], [1.1]] });
  S('sh_dance', 'shadow', 20, '百影の舞', '{百影|ひゃくえい}の{舞|まい}', 6, { m: 3.5, stack: { k: 'shadow', per: 0.7, use: 'all' } });
  // 賢者
  S('sa_spark', 'sage', 1, '星火', '{星火|せいか}', 2, { m: 1.8, sys: 'atk', up: [[25, 'mset', 2.1]] });
  S('sa_wind', 'sage', 3, '癒しの風', '{癒|いや}しの{風|かぜ}', 2, { m: 0.8, heal: 0.25, sys: 'heal', inh: true });
  S('sa_elem', 'sage', 5, '三元素の術', '{三元素|さんげんそ}の{術|じゅつ}', 3, { m: 2.2, sys: 'atk', fx: ['weakEl3'] });
  S('sa_ward', 'sage', 8, '安らぎの結界', '{安|やす}らぎの{結界|けっかい}', 3, { m: 1.0, heal: 0.15, guard: [0.4, 1], sys: 'heal' });
  S('sa_flow', 'sage', 10, '星の奔流', '{星|ほし}の{奔流|ほんりゅう}', 5, { m: 3.4, sys: 'atk' });
  S('sa_harmony', 'sage', 20, '天地の調和', '{天地|てんち}の{調和|ちょうわ}', 6, { m: 3.2, heal: 0.35, fx: ['harmonyAlways'] });
  // 忍者
  S('ni_fire', 'ninja', 1, '火遁', '{火遁|かとん}', 2, { m: 1.7, el: 'fire', fx: ['seal:fire'], up: [[25, 'mset', 2.0]] });
  S('ni_water', 'ninja', 3, '水遁', '{水遁|すいとん}', 2, { m: 1.3, el: 'water', guard: [0.25, 1], fx: ['seal:water'], inh: true });
  S('ni_thunder', 'ninja', 5, '雷の手裏剣', '{雷|かみなり}の{手裏剣|しゅりけん}', 3, { m: 2.1, el: 'thunder', fx: ['seal:thunder'] });
  S('ni_smoke', 'ninja', 8, '煙がくれ', '{煙|けむり}がくれ', 2, { m: 1.0, guard: [0.7, 1] });
  S('ni_three', 'ninja', 10, '三影手裏剣', '{三影手裏剣|さんかげしゅりけん}', 5, { hits: [[1.1], [1.1], [1.1]] });
  S('ni_secret', 'ninja', 20, '秘術・雷火', '{秘術|ひじゅつ}・{雷火|らいか}', 6, { hits: [[1.8, 'fire'], [1.8, 'thunder']], fx: ['sealBonus'] });
  // レンジャー
  S('ra_aim', 'ranger', 1, '狙い撃ち', '{狙|ねら}い{撃|う}ち', 2, { m: 1.6, stack: { k: 'aim', per: 0.3, use: 'all' }, up: [[25, 'mset', 1.9]] });
  S('ra_grace', 'ranger', 3, '森の加護', '{森|もり}の{加護|かご}', 2, { m: 1.0, heal: 0.2, inh: true });
  S('ra_stop', 'ranger', 5, '足止めの矢', '{足止|あしど}めの{矢|や}', 3, { m: 1.8, atkDown: 0.4 });
  S('ra_wind', 'ranger', 8, '風抜きの矢', '{風抜|かぜぬ}きの{矢|や}', 3, { m: 2.0, igPerAim: 0.2, stack: { k: 'aim', per: 0, use: 'all' } });
  S('ra_star', 'ranger', 10, '流星の矢', '{流星|りゅうせい}の{矢|や}', 5, { m: 2.8, stack: { k: 'aim', per: 0.4, use: 'all' } });
  S('ra_tree', 'ranger', 20, '世界樹の一矢', '{世界樹|せかいじゅ}の{一矢|ひとや}', 6, { m: 3.2, heal: 0.2, stack: { k: 'aim', per: 0.5, use: 'all' } });
  // 天翔騎士
  S('sk_wing', 'skyknight', 1, '翼の斬撃', '{翼|つばさ}の{斬撃|ざんげき}', 2, { m: 1.8, fx: ['fly'], up: [[25, 'mset', 2.1]] });
  S('sk_guard', 'skyknight', 3, '天の守り', '{天|てん}の{守|まも}り', 2, { m: 1.2, guard: [0.5, 1], inh: true });
  S('sk_meteor', 'skyknight', 5, '流星剣', '{流星剣|りゅうせいけん}', 3, { m: 2.2, fx: ['meteor'] });
  S('sk_blade', 'skyknight', 8, '光翼の剣', '{光翼|こうよく}の{剣|けん}', 3, { m: 2.0, el: 'light', heal: 0.2, fx: ['fly'] });
  S('sk_slash', 'skyknight', 10, '天翔連斬', '{天翔連斬|てんしょうれんざん}', 5, { hits: [[1.2], [1.2], [1.1]] });
  S('sk_dawn', 'skyknight', 20, '暁の降臨', '{暁|あかつき}の{降臨|こうりん}', 6, { m: 3.8, fx: ['descend'] });
  // 星詠み
  S('ss_arrow', 'starseer', 1, '星の矢', '{星|ほし}の{矢|や}', 2, { m: 1.8, up: [[25, 'mset', 2.1]] });
  S('ss_ward', 'starseer', 3, '星座の結界', '{星座|せいざ}の{結界|けっかい}', 2, { m: 1.0, guard: [0.2, 1], fx: ['starGuard'], stack: { k: 'star', per: 0, use: 'all' }, inh: true });
  S('ss_comet', 'starseer', 5, '彗星', '{彗星|すいせい}', 3, { m: 2.0, stack: { k: 'star', per: 0.35, use: 'all' } });
  S('ss_drop', 'starseer', 8, '月のしずく', '{月|つき}のしずく', 3, { m: 1.2, heal: 0.2, fx: ['starHeal'], stack: { k: 'star', per: 0, use: 'all' } });
  S('ss_night', 'starseer', 10, '星降る夜', '{星降|ほしふ}る{夜|よる}', 5, { m: 3.4 });
  S('ss_create', 'starseer', 20, '創星', '{創星|そうせい}', 6, { m: 3.2, heal: 0.2, stack: { k: 'star', per: 0.4, use: 'all' } });
  const SKILLS = {}; SK.forEach(s => { SKILLS[s.id] = s; });
  const SKILLS_OF = {}; JOB_IDS.forEach(j => { SKILLS_OF[j] = SK.filter(s => s.job === j); });

  // 固有能力・パッシブ（職業Lvで解放）の説明（表示用。効果の実装は battle.js）
  const PASSIVES = {
    warrior: [[3, 'たくましさ', '最大HP+15%']], mage: [[3, '魔力のめぐり', '開始ゲージ+1']],
    priest: [[3, '安らぎ', '復習正解の回復 10→15%']], thief: [[3, '宝の気配', '通常敵を倒すと20%で追加素材']],
    magicknight: [[1, '魔法剣', '属性を付けた後は通常攻撃もその属性']], paladin: [[1, '守護', '防御技で軽減すると+1（最大3）']],
    shadow: [[1, '影', '攻撃のあと影+1（最大2）。通常攻撃に追撃']], sage: [[1, '調和', '前と逆系統の技の効果+20%']],
    ninja: [[1, '忍術連携', '別の基本忍術を続けて組合せ発動']], ranger: [[1, '照準', '通常攻撃の正解で+1（最大3）']],
    skyknight: [[1, '飛翔', '飛翔中の通常攻撃+20%']], starseer: [[1, '星座', '正解で星+1（最大4）']]
  };

  // ---------- 敵・地域（第1章。第2・3章は未実装） ----------
  // pattern の要素: atk(m) 通常 / big(m) 大技（直前の行動で予告される）/ guard 自分の防御 / charge 溜め（行動なし）
  //               / brace 次に受けるダメージ軽減 / idle 隙
  // 能力値は region の hp/atk/def 基準 × 敵ごとの係数。主人公の育ち方から calibrate（rpg/tools/sim.js で検証）
  const ATK = { k: 'atk', m: 1 };
  const REGIONS = [
    {
      id: 'meadow', name: '草原', ruby: '{草原|そうげん}', ch: 1, points: ['風車の小道', '木漏れ日の森', '古樹の参道'], coin: 100, mat: '古樹のかけら', item: '若葉の灯',
      enemies: [
        { id: 'e_leafslime', name: 'はっぱスライム', hp: 0.85, atk: 0.85, def: 0.0, pattern: [ATK] },
        { id: 'e_nutbat', name: '木の実コウモリ', hp: 0.9, atk: 1.0, def: 0.0, pattern: [ATK] },
        { id: 'e_acornsoldier', name: 'どんぐり兵', hp: 1.0, atk: 1.0, def: 0.5, pattern: [{ k: 'brace', n: 'かまえる' }, ATK] },
        { id: 'e_mushroom', name: 'いたずらキノコ', hp: 1.0, atk: 1.0, def: 0.5, weak: 'fire', pattern: [ATK] },
        { id: 'e_mossarmor', name: '苔よろい', hp: 1.1, atk: 1.0, def: 1.5, pattern: [ATK] }
      ],
      boss: { id: 'b_ancienttree', name: '古樹の番人', hp: 3.0, atk: 1.1, def: 1.0, weak: 'fire', pattern: [{ k: 'atk', m: 1, n: '枝攻撃' }, { k: 'guard', n: '根を張る' }, { k: 'big', m: 2.0, n: '大地のうねり' }] }
    },
    {
      id: 'waterland', name: '水郷', ruby: '{水郷|すいごう}', ch: 1, points: ['水車の川辺', 'あおい洞穴', '水晶の湖'], coin: 100, mat: '水晶のかけら', item: '水車の模型',
      enemies: [
        { id: 'e_jelly', name: 'あわクラゲ', hp: 0.9, atk: 0.9, def: 0.0, weak: 'thunder', pattern: [ATK] },
        { id: 'e_crab', name: 'よろいガニ', hp: 1.0, atk: 1.0, def: 1.6, pattern: [ATK] },
        { id: 'e_lizard', name: 'しずくトカゲ', hp: 1.0, atk: 1.0, def: 0.5, pattern: [ATK, { k: 'big', m: 1.8, n: 'ブレス' }] },
        { id: 'e_hermit', name: '水晶ヤドカリ', hp: 1.1, atk: 1.0, def: 0.8, pattern: [{ k: 'guard', n: 'からにこもる' }, ATK] },
        { id: 'e_mistspirit', name: '川霧の精', hp: 0.9, atk: 1.1, def: 0.0, weak: 'light', pattern: [ATK] }
      ],
      boss: { id: 'b_crystalturtle', name: '水晶ガメ', hp: 3.0, atk: 1.1, def: 1.2, weak: 'thunder', pattern: [{ k: 'guard', n: '防御' }, ATK, { k: 'charge', n: '吸水' }, { k: 'big', m: 2.0, n: '大波' }] }
    },
    {
      id: 'sandsea', name: '砂海', ruby: '{砂海|さかい}', ch: 1, points: ['砂風の道', '埋もれた市場', '砂時計の回廊'], coin: 150, mat: '時砂のかけら', item: '遺跡の鍵',
      enemies: [
        { id: 'e_sandlizard', name: '砂トカゲ', hp: 1.0, atk: 1.0, def: 0.4, pattern: [ATK] },
        { id: 'e_jarmonster', name: 'つぼの魔物', hp: 1.0, atk: 1.0, def: 0.8, pattern: [ATK] },
        { id: 'e_cactus', name: '針サボテン', hp: 1.0, atk: 1.1, def: 0.6, weak: 'water', pattern: [ATK] },
        { id: 'e_condor', name: '砂羽コンドル', hp: 0.9, atk: 1.1, def: 0.2, pattern: [ATK] },
        { id: 'e_ruinsoldier', name: '遺跡の小兵', hp: 1.1, atk: 1.0, def: 1.0, pattern: [ATK] }
      ],
      boss: { id: 'b_hourglass', name: '砂時計の巨人', hp: 3.0, atk: 1.1, def: 1.0, pattern: [ATK, ATK, { k: 'charge', n: '砂が落ちていく' }, { k: 'big', m: 2.2, n: '砂の大波' }] }
    },
    {
      id: 'mountain', name: '山脈', ruby: '{山脈|さんみゃく}', ch: 1, points: ['雪灯の道', '氷の城門', '白銀の回廊'], coin: 150, mat: '白銀のうろこ', item: '雪結晶',
      enemies: [
        { id: 'e_snowrabbit', name: '雪ウサギ', hp: 0.9, atk: 0.9, def: 0.0, weak: 'fire', pattern: [ATK] },
        { id: 'e_icearmor', name: '氷のよろい', hp: 1.1, atk: 1.0, def: 1.4, weak: 'fire', pattern: [ATK] },
        { id: 'e_frostwolf', name: '霜オオカミ', hp: 1.0, atk: 1.1, def: 0.4, weak: 'fire', pattern: [ATK] },
        { id: 'e_lampspirit', name: '雪灯の精', hp: 0.9, atk: 1.0, def: 0.0, pattern: [ATK] },
        { id: 'e_icicle', name: 'つららコウモリ', hp: 0.9, atk: 1.1, def: 0.2, weak: 'fire', pattern: [ATK] }
      ],
      boss: { id: 'b_silverdragon', name: '白銀の竜', hp: 3.0, atk: 1.1, def: 1.0, weak: 'fire', pattern: [{ k: 'big', m: 1.8, n: '氷息' }, { k: 'guard', n: '翼で防御' }, ATK, { k: 'charge', n: '息を吸う' }, { k: 'big', m: 2.0, n: '氷息' }] }
    },
    {
      id: 'gearcity', name: '機工都市', ruby: '{機工都市|きこうとし}', ch: 1, points: ['配管街', '歯車橋', '騎士の砦'], coin: 200, mat: '黒鋼のかけら', item: '騎士の記録',
      enemies: [
        { id: 'e_screwbird', name: 'ねじ鳥', hp: 0.9, atk: 1.0, def: 0.2, weak: 'thunder', pattern: [ATK] },
        { id: 'e_steamsoldier', name: '蒸気兵', hp: 1.1, atk: 1.0, def: 1.0, weak: 'water', pattern: [ATK] },
        { id: 'e_gearspider', name: '歯車グモ', hp: 1.0, atk: 1.1, def: 0.6, pattern: [ATK] },
        { id: 'e_pipeslime', name: '配管スライム', hp: 1.0, atk: 1.0, def: 0.3, pattern: [ATK] },
        { id: 'e_magnetgolem', name: '磁石ゴーレム', hp: 1.2, atk: 1.0, def: 1.4, weak: 'thunder', pattern: [ATK] }
      ],
      boss: { id: 'b_blackknight', name: '黒鎧の騎士', hp: 3.0, atk: 1.2, def: 1.2, pattern: [ATK, { k: 'guard', n: '構えを変える' }, { k: 'charge', n: '剣を掲げる' }, { k: 'big', m: 2.2, n: '黒鎧の一閃' }, { k: 'idle', n: '隙' }] }
    },
    {
      id: 'skycastle', name: '空城', ruby: '{空城|くうじょう}', ch: 1, points: ['雲の庭', '鏡の回廊', '機神の門'], coin: 300, mat: '機神の核片', item: '灯の冒険者衣装',
      enemies: [
        { id: 'e_starjelly', name: '星くらげ', hp: 0.9, atk: 1.0, def: 0.2, weak: 'thunder', pattern: [ATK] },
        { id: 'e_castleguard', name: '空城の守衛', hp: 1.1, atk: 1.0, def: 1.0, pattern: [ATK] },
        { id: 'e_cloudlion', name: '雲獅子', hp: 1.0, atk: 1.1, def: 0.5, pattern: [ATK] },
        { id: 'e_mirrormage', name: '鏡の使い', hp: 0.9, atk: 1.1, def: 0.2, weak: 'light', pattern: [ATK] },
        { id: 'e_floatdevice', name: '浮遊の魔導器', hp: 1.1, atk: 1.0, def: 0.8, pattern: [ATK] }
      ],
      boss: { id: 'b_machinegod', name: '天蓋の機神', hp: 3.2, atk: 1.2, def: 1.2, pattern: [{ k: 'charge', n: '光を集める' }, { k: 'big', m: 2.4, n: '集光砲' }, { k: 'guard', n: '装置を切替' }, ATK] }
    }
  ];
  // 区間：道中は 3地点×3区間=9体、ボスは標準3冒険（HP継続）。1章=12冒険×6地域=72
  const NORMAL_STEPS = 9, BOSS_STEPS = 3, STEPS_PER_REGION = NORMAL_STEPS + BOSS_STEPS;
  // 敵の基準能力値は「道のり番号 g」の曲線。主人公の育ち方（rpg/tools/sim.js --steps）から作成し、プレイ中は変えない
  const CURVE = { hp: g => g <= 0 ? 64 : 221 + 5.85 * g, atk: g => 1.3 * (5 + 0.19 * g), def: g => 2 + 0.35 * g };
  function statsAt(e, g) { return { hp: Math.round(CURVE.hp(g) * e.hp), atk: Math.max(1, Math.round(CURVE.atk(g) * e.atk)), def: Math.round(CURVE.def(g) * (e.def > 0 ? e.def : 0.5)) }; }
  const ENEMIES = {};
  REGIONS.forEach((r, i) => {
    r.idx = i;
    r.enemies.forEach(e => { ENEMIES[e.id] = Object.assign({}, e, { region: r.id, boss: false, weak: e.weak || null }); });
    ENEMIES[r.boss.id] = Object.assign({}, r.boss, { region: r.id, boss: true, weak: r.boss.weak || null });
  });
  // 冒険の道のり（第1章）。各区間に、その敵の固定能力値 stats を持たせる
  const ROUTE = [];
  REGIONS.forEach((r, ri) => {
    for (let s = 0; s < NORMAL_STEPS; s++) { const e = r.enemies[s % 5], g = ri * STEPS_PER_REGION + s; ROUTE.push({ g, region: ri, step: s, point: r.points[Math.floor(s / 3)], seg: (s % 3) + 1, enemy: e.id, boss: false, stats: statsAt(e, g) }); }
    for (let s = 0; s < BOSS_STEPS; s++) { const g = ri * STEPS_PER_REGION + NORMAL_STEPS; ROUTE.push({ g: ri * STEPS_PER_REGION + NORMAL_STEPS + s, region: ri, step: NORMAL_STEPS + s, point: r.name + 'のボス', seg: s + 1, enemy: r.boss.id, boss: true, stats: statsAt(r.boss, g) }); }
  });

  // ---------- 装備 ----------
  const RANK_NAME = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const WPRICE = [240, 480, 800, 1200, 1600, 2000], APRICE = [180, 360, 600, 900, 1200, 1500], XPRICE = [150, 300, 500, 750, 1000, 1250];
  const WATK = [8, 14, 22, 32, 44, 58], ADEF = [6, 10, 15, 21, 28, 36];
  const WNAMES = {
    sword: ['青銅のつるぎ', '鉄のつるぎ', '銀のつるぎ', '鋼のつるぎ', '星鉄のつるぎ', '天空のつるぎ'],
    staff: ['旅人の杖', '樫の杖', '銀月の杖', '水晶の杖', '星屑の杖', '天球の杖'],
    dagger: ['銅の短剣', '鉄の短剣', '銀の短剣', '影鋼の短剣', '星鉄の短剣', '夜明けの短剣'],
    bow: ['若木の弓', '樫の弓', '銀枝の弓', '風鳴りの弓', '星枝の弓', '天翔の弓']
  };
  const ANAMES = {
    heavy: ['旅人の胸当て', '鉄の胸当て', '銀の胸当て', '鋼の鎧', '星鉄の鎧', '天空の鎧'],
    light: ['風のベスト', '革のベスト', '銀糸のベスト', '疾風のベスト', '星糸のベスト', '天翔のベスト'],
    robe: ['見習いのローブ', '麻のローブ', '銀月のローブ', '水晶のローブ', '星屑のローブ', '天球のローブ']
  };
  const XNAMES = {
    charm: ['木の実のお守り', '琥珀のお守り', '銀のお守り', '翠玉のお守り', '星のお守り', '暁のお守り'],
    shieldorn: ['小さな盾飾り', '鉄の盾飾り', '銀の盾飾り', '鋼の盾飾り', '星鉄の盾飾り', '天空の盾飾り'],
    ring: ['灯石の指輪', '琥珀の指輪', '銀の指輪', '翠玉の指輪', '星の指輪', '暁の指輪']
  };
  const ITEMS = {};
  function add(it) { ITEMS[it.id] = it; }
  for (let r = 0; r < 6; r++) {
    Object.keys(WNAMES).forEach(c => add({ id: `w_${c}_${r + 1}`, slot: 'weapon', cat: c, wish: c, rank: r + 1, rarity: 'normal', name: WNAMES[c][r], atk: WATK[r], price: WPRICE[r] }));
    Object.keys(ANAMES).forEach(c => add({ id: `a_${c}_${r + 1}`, slot: 'armor', cat: c, wish: 'armor', rank: r + 1, rarity: 'normal', name: ANAMES[c][r], def: ADEF[r], price: APRICE[r], fx: c === 'heavy' ? { hpPct: 0.05 } : c === 'light' ? { firstReduce: 0.10 } : { healBonus: 0.10 } }));
    add({ id: `x_charm_${r + 1}`, slot: 'acc', cat: 'charm', wish: 'acc', rank: r + 1, rarity: 'normal', name: XNAMES.charm[r], price: XPRICE[r], fx: { hpPct: 0.10 + 0.02 * r } });
    add({ id: `x_shieldorn_${r + 1}`, slot: 'acc', cat: 'shieldorn', wish: 'acc', rank: r + 1, rarity: 'normal', name: XNAMES.shieldorn[r], price: XPRICE[r], fx: { reduce: 0.05 + 0.01 * r } });
    add({ id: `x_ring_${r + 1}`, slot: 'acc', cat: 'ring', wish: 'acc', rank: r + 1, rarity: 'normal', name: XNAMES.ring[r], price: XPRICE[r], fx: { firstSkill: 0.10 + 0.02 * r } });
  }
  // レア（基礎値×1.1＋固定効果1つ）。ランクI の名前・効果は設計書、II〜VI は仮名（補完 D-08）
  const RARE_PREFIX = ['', '琥珀', '月影', '氷晶', '星河', '暁光'];
  const RARE_I = { sword: ['火花のつるぎ', { elemAdd: ['fire', 0.15] }], staff: ['しずくの杖', { healBonus: 0.10 }], dagger: ['こだまの短剣', { firstMulti: 0.15 }], bow: ['若葉の弓', { firstHeal: 0.10 }] };
  const RARE_NOUN = { sword: 'つるぎ', staff: '杖', dagger: '短剣', bow: '弓', heavy: '胸当て', light: 'ベスト', robe: 'ローブ', charm: 'お守り', shieldorn: '盾飾り', ring: '指輪' };
  const RARE_FX = { sword: r => ({ elemAdd: [['fire', 'ice', 'thunder', 'fire', 'ice', 'thunder'][r], 0.15] }), staff: r => ({ healBonus: 0.10 + 0.02 * r }), dagger: r => ({ firstMulti: 0.15 + 0.02 * r }), bow: r => ({ firstHeal: 0.10 }), heavy: r => ({ hpPct: 0.10 }), light: r => ({ firstReduce: 0.20 }), robe: r => ({ halfHeal: 0.10 }), charm: r => ({ hpPct: 0.15 + 0.02 * r }), shieldorn: r => ({ reduce: 0.08 + 0.01 * r }), ring: r => ({ firstSkill: 0.15 + 0.02 * r }) };
  for (let r = 0; r < 6; r++) {
    ['sword', 'staff', 'dagger', 'bow'].forEach(c => {
      const base = ITEMS[`w_${c}_${r + 1}`];
      add({ id: `rw_${c}_${r + 1}`, slot: 'weapon', cat: c, wish: c, rank: r + 1, rarity: 'rare', name: r === 0 ? RARE_I[c][0] : RARE_PREFIX[r] + 'の' + RARE_NOUN[c], atk: Math.round(base.atk * 1.1), price: base.price, fx: r === 0 ? RARE_I[c][1] : RARE_FX[c](r), provisional: r > 0 });
    });
    ['heavy', 'light', 'robe'].forEach(c => {
      const base = ITEMS[`a_${c}_${r + 1}`];
      add({ id: `ra_${c}_${r + 1}`, slot: 'armor', cat: c, wish: 'armor', rank: r + 1, rarity: 'rare', name: r === 0 && c === 'robe' ? '朝露のローブ' : (r === 0 ? '旅立ちの' : RARE_PREFIX[r] + 'の') + RARE_NOUN[c], def: Math.round(base.def * 1.1), price: base.price, fx: RARE_FX[c](r), provisional: !(r === 0 && c === 'robe') });
    });
    ['charm', 'shieldorn', 'ring'].forEach(c => {
      const base = ITEMS[`x_${c}_${r + 1}`];
      add({ id: `rx_${c}_${r + 1}`, slot: 'acc', cat: c, wish: 'acc', rank: r + 1, rarity: 'rare', name: (r === 0 ? '朝焼け' : RARE_PREFIX[r]) + 'の' + RARE_NOUN[c], price: base.price, fx: RARE_FX[c](r), provisional: true });
    });
  }
  const START_WEAPON = { id: 'w_start', slot: 'weapon', cat: 'any', wish: 'sword', rank: 0, rarity: 'normal', name: 'はじまりの武器', atk: 3, price: 0 };
  ITEMS.w_start = START_WEAPON;
  // 強化：+1ごとに基準性能+5%（最大+3。必ず成功）。レア補正（約+10%）は店売りの基準値に加算。基準値＝同ランク・同系統の通常品
  const ENH_MAX = 3, ENH_STEP = 0.05;
  function enhBase(it) { const n = it.rarity === 'rare' ? ITEMS[it.id.replace(/^r/, '')] : it; return n || it; }
  function enhBonus(it, lv) {   // 武器の攻撃・防具の防御に加える値
    if (!it || !lv || !it.rank) return 0; const b = enhBase(it);
    return Math.round((b.atk || b.def || 0) * ENH_STEP * lv);
  }
  const WISH_LIST = ['sword', 'staff', 'dagger', 'bow', 'armor', 'acc'];
  const WISH_NAME = { sword: 'つるぎ', staff: 'つえ', dagger: 'たんけん', bow: 'ゆみ', armor: 'ぼうぐ', acc: 'アクセサリー' };

  return { ELEMENTS, EL_NAME, JOBS, JOB_IDS, FIRST_JOB, SKILLS, SKILLS_OF, PASSIVES, REGIONS, ENEMIES, ROUTE, NORMAL_STEPS, BOSS_STEPS, STEPS_PER_REGION, CURVE, statsAt, ITEMS, ENH_MAX, ENH_STEP, enhBonus, RANK_NAME, WISH_LIST, WISH_NAME, START_WEAPON };
});
