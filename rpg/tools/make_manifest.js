'use strict';
// 素材台帳 rpg/ASSET_MANIFEST.json を作る。node rpg/tools/make_manifest.js
// 正式素材を入れたら該当行の status を '正式'、path を画像に変える（実行時に rpg-ui.js が読む。再生成すると上書きされるので、正式化後は手で編集する）
const fs = require('fs'), path = require('path'), D = require('../js/rpg-data.js'), W = require('../js/rpg-world.js');
const A = [];
const base = { transparent: true, ref: 'references/approved-answer-reward.png（見本）', prompt: null, inspect: '未検品（仮絵。完成扱いにしない）' };
D.JOB_IDS.forEach(j => A.push(Object.assign({ id: 'hero_' + j, use: `主人公 ${D.JOBS[j].name}（帯・報酬で共用の仮ドット絵。1ポーズ）`, path: 'code:rpg-sprites.js#HERO', src: '14x14', display: '28px(帯)/84px(報酬)', anchor: '足元中央', status: '仮' }, base)));
Object.keys(D.ENEMIES).forEach(e => A.push(Object.assign({ id: 'enemy_' + e, use: `敵 ${D.ENEMIES[e].name}（形4種＋色替えの仮絵）`, path: 'code:rpg-sprites.js#SHAPES', src: '14x14', display: '28px(帯)/84px(報酬)', anchor: '足元中央', status: '仮' }, base)));
D.REGIONS.forEach(r => A.push(Object.assign({ id: 'bg_' + r.id, use: `背景（帯・報酬） ${r.name}（色と丘・木のコード描画）`, path: 'code:rpg-sprites.js#REGION_COLOR', src: 'コード描画', display: '帯 幅×44px / 報酬 幅×約220px', anchor: '-', status: '仮' }, base)));
W.BGS.forEach(b => A.push(Object.assign({ id: 'bg_' + b, use: `背景 ${W.BG_NAMES[b]}（試練・秘境・孤島。色味のコード描画）`, path: 'code:rpg-sprites.js#REGION_COLOR', src: 'コード描画', display: '帯 幅×44px / 報酬 幅×約220px', anchor: '-', status: '仮' }, base)));
A.push(Object.assign({ id: 'sound_original', use: '音（WebAudio合成の短い8種。外部素材なし。初期オフ）', path: 'code:rpg-sound.js', src: '合成', display: '-', anchor: '-', status: '仮' }, base));
A.push(Object.assign({ id: 'memorial_picture', use: '夜明けの記念絵（コード描画の仮）', path: 'code:rpg-screens.js#VIEWS.memorial', src: '100x66', display: '約360px', anchor: '-', status: '仮' }, base));
A.push(Object.assign({ id: 'chest_open', use: '宝箱（開）報酬画面', path: 'code:rpg-sprites.js#CHEST_OPEN', src: '12x8', display: '72px', anchor: '足元中央', status: '仮' }, base));
A.push(Object.assign({ id: 'chest_closed', use: '宝箱（閉）', path: 'code:rpg-sprites.js#CHEST', src: '12x8', display: '72px', anchor: '足元中央', status: '仮' }, base));
// 第2段で増えた仮絵（画面は全てコード/CSS描画。ホーム・街・装備・転職の「本格的な絵」は未制作）
A.push(Object.assign({ id: 'hero_look_variants', use: '外見（顔4・髪6・肌5・髪色6）の仮ドット絵。ホーム・じぶん・装備・転職・外見画面', path: 'code:rpg-sprites.js#heroRows', src: '14x14', display: '28〜112px', anchor: '足元中央', status: '仮' }, base));
A.push(Object.assign({ id: 'town_overview', use: '風待ちの町の俯瞰図（6施設のタップ領域つき）', path: 'code:rpg-screens.css#.rs-town', src: 'CSS描画', display: '幅いっぱい×380px', anchor: '-', status: '仮' }, base));
A.push(Object.assign({ id: 'job_intro_pose', use: '転職の演出・職業カード・職業詳細（12職の姿。現在は衣装色だけ違う仮絵）', path: 'code:rpg-sprites.js#drawHero', src: '14x14', display: '84〜112px', anchor: '足元中央', status: '仮' }, base));
A.push(Object.assign({ id: 'screen_frames', use: '画面の金枠・ボタン・ナビ（濃紺＋金。CSSのみ。採用見本のドット枠は未制作）', path: 'code:rpg-screens.css', src: 'CSS', display: '-', anchor: '-', status: '仮' }, base));
// 未着手の分類（03_画像制作仕様の表）。数量は設計書のとおり
const PLAN = [
  ['hero_base_poses', '主人公 基本職業衣装 12職×5ポーズ（待機/構え/攻撃/被弾/勝利）', 60], ['hero_master_poses', '主人公 マスター衣装 12×5', 60], ['hero_adv_extra', '上級職追加衣装 6×5', 30],
  ['face_hair', '顔4・髪6（正面寄り/戦闘向き、肌・髪色マスク）', 20], ['strip_sprites', '回答帯用小型キャラ 12職×(待機/歩行/攻撃/被弾)', 48], ['job_emblem_intro', '職業しるし/紹介絵 各12', 24],
  ['hero_overlay', '主人公特殊状態（翼/影/魔法剣/星等）透明重ね', 8], ['enemy_normal', '通常敵 66体（帯用縮小版つき。現在は仮絵36体分）', 66], ['enemy_boss', '本編ボス 18体＋形態差分（仮絵は第1章6体）', 18], ['enemy_extra', '試練2/秘境6/隠し1', 9],
  ['bg_battle_reward', '戦闘/報酬背景 本編18＋秘境6＋孤島1＋試練2＝27（仮は第1章6）', 27], ['town', '街 基本1＋進行差分パーツ', 8], ['rooms', '施設室内 ギルド/店/鍛冶屋/神殿/自室', 5], ['world_map', '世界地図（地点・線は別レイヤー）', 1],
  ['explore_maps', '探索地図 本編18＋秘境6＋孤島1', 25], ['icons_normal', '通常装備アイコン 60', 60], ['icons_rare_unique', 'レア/固有アイコン（レア60＋固有18）', 78], ['weapon_inhand', '手持ち武器（装備可能武器の全種）', 24],
  ['materials_furniture', '素材/家具/記念品', 40], ['chests', '宝箱 通常/朝星/ボス×閉/開=6（仮は2）', 6], ['skill_fx', '技効果（斬撃/炎/氷/雷/水/光/回復/盾/煙/星＋専用大技）', 20], ['npc', '主要NPC ミラ/トト/ルカ/黒鎧の騎士（立ち絵＋表情）', 4], ['memorial', '記念絵 章1/章2/本編/孤島', 4]
];
PLAN.forEach(([id, use, n]) => A.push({ id: 'planned_' + id, use, count: n, path: null, transparent: null, src: null, display: null, anchor: null, status: '予定', ref: 'references/', prompt: null, inspect: '未制作（画像生成の手段がこの環境に無い）' }));
const out = { note: '状態: 予定=未制作 / 仮=コード描画の仮絵（完成扱いにしない）/ 正式=制作済み・組み込み済み。画像生成の手段が無く、正式素材は0件。', updated: '2026-11-18', counts: {}, assets: A };
A.forEach(a => { out.counts[a.status] = (out.counts[a.status] || 0) + 1; });
fs.writeFileSync(path.join(__dirname, '..', 'ASSET_MANIFEST.json'), JSON.stringify(out, null, 1));
console.log(out.counts);
