'use strict';
// 台帳 rpg/ASSET_MANIFEST.json に「画面に接続したか」（connected / connectedWhere）を足す。素材の制作状態（status）とは別の欄。
// node rpg/tools/annotate_manifest.js  （何度実行しても同じ結果）。接続の根拠は rpg/js の参照箇所（下の規則に書いた画面）
const fs = require('fs'), path = require('path');
const P = path.join(__dirname, '..', 'ASSET_MANIFEST.json');
const m = JSON.parse(fs.readFileSync(P, 'utf8'));
const OK = '接続済み', NG = '未接続';
const J = '主人公1枚絵（drawHeroLayered。部品が無い組合せの描き方）';
const RULES = [
  [/^parts_json$/, NG, '主人公の部品（rpg/assets/parts/）。status を「正式」にすると rpg-ui.js が読む。届くまで1枚絵で描く'],
  [/^hero_[a-z]+_strip(_attack|_hit|_walk|_master)?$/, OK, '回答帯（drawHeroLayered use=strip）／探索地図の現在地'],
  [/^hero_[a-z]+_(master_win|master)$/, OK, 'ホーム・自分・装備・転職・外見・エンディング・報酬（マスター衣装を選び、獲得済みのとき）'],
  [/^hero_[a-z]+(_ready|_attack|_hit|_win)?$/, OK, 'ホーム・自分・装備・転職・外見・エンディング・報酬・記念絵（' + J + '）'],
  [/^icon_(w|a|x|rw|ra|rx)_[a-z]+_\d$/, OK, '装備・店・図鑑（iconOf）。試着の武器は部品があるとき主人公の手にも重ねる'],
  [/^icon_u_/, OK, '装備・店・図鑑（固有装備。iconOf）'],
  [/^icon_(bm_|ore_|job_|dawn|trial_)/, NG, '素材・職業・称号のアイコン。どの画面にも出していない'],
  [/^enemy_.*_strip$/, OK, '回答帯'],
  [/^enemy_/, OK, '報酬（継続）・ぼうけん・図鑑・記念絵（enemyCv／drawEnemy）'],
  [/^bg_map_/, OK, '探索地図'],
  [/^bg_memorial_/, OK, '記念絵'],
  [/^bg_worldmap$/, OK, 'ぼうけん（世界地図）'],
  [/^bg_town$/, OK, 'ホーム（主人公の舞台）・街'],
  [/^bg_room_(room|shop|temple)$/, OK, '施設の室内・自分／装備／転職／外見の舞台'],
  [/^bg_room_(guild|forge)$/, OK, '施設の室内（街）'],
  [/^bg_crown/, OK, 'エンディング（主人公の舞台）・帯・報酬'],
  [/^bg_.*_strip$/, OK, '回答帯'],
  [/^bg_/, OK, '報酬画面の背景'],
  [/^chest_morning_/, OK, '報酬・ホーム（朝星の宝箱）'],
  [/^chest_(normal|boss)_/, NG, '未使用の資産として保管（06 5章：開封操作は朝星の宝箱のみ）'],
  [/^fx_/, OK, '技エフェクト（帯・報酬の静止画フォールバック）'],
  [/^npc_/, OK, '街の施設・おはなし'],
  [/^town_(windmill|fountain|airship|monument)$/, OK, '街'],
  [/^(town_overview|job_intro_pose|hero_look_variants|screen_frames|memorial_picture|sound_original)$/, '対象外', 'コード/CSS描画の台帳行（画像素材ではない）。仮の行は画面から外した'],
  [/^planned_/, '対象外', '未制作の分類行（画像なし）']
];
// 第1章ボス6体：画像ファイルがあるのに台帳が「仮」のままだった行を「正式」にする（目視確認済み 2026-11-18）。画像が無いものは「仮」のまま（開発用検査に出る）
['ancienttree', 'crystalturtle', 'hourglass', 'silverdragon', 'blackknight', 'machinegod'].forEach(k => ['', '_strip'].forEach(suf => {
  const id = 'enemy_b_' + k + suf, rel = 'rpg/assets/chars/' + id + '.png', has = fs.existsSync(path.join(__dirname, '..', '..', rel));
  let a = m.assets.find(x => x.id === id);
  if (!has) { if (a) a.inspect = '画像ファイルなし（' + rel + '）。仮絵のまま＝試遊不可の残件'; return; }
  if (!a) { a = { id, use: '敵 ' + k + (suf ? '（帯用）' : ''), src: null, display: null, anchor: '足元中央', transparent: true, ref: 'references/approved-answer-reward.png', prompt: null }; m.assets.push(a); }
  a.path = rel; a.status = '正式'; a.inspect = '目視確認済み（2026-11-18）。台帳の状態が「仮」のため読まれていなかったのを修正';
}));
let n = { [OK]: 0, [NG]: 0, 対象外: 0 };
m.assets.forEach(a => {
  const r = RULES.find(([re]) => re.test(a.id));
  if (!r) { a.connected = NG; a.connectedWhere = '規則なし（要確認）'; n[NG]++; return; }
  a.connected = r[1]; a.connectedWhere = r[2]; n[r[1]]++;
});
// 主人公の部品：台帳に行を足す（届くまで「予定」。「正式」にすると画面が読む）
if (!m.assets.some(a => a.id === 'parts_json')) m.assets.push({ id: 'parts_json', use: '主人公の部品の基準点・パレット（rpg/assets/parts/parts.json。HERO_PARTS_SPEC.md）', path: 'rpg/assets/parts/parts.json', src: null, display: null, anchor: null, status: '予定', transparent: null, ref: 'rpg/assets/HERO_PARTS_SPEC.md', prompt: null, inspect: '部品が届いたら status を「正式」にする（画面側は接続済み）', connected: NG, connectedWhere: '主人公の部品（rpg/assets/parts/）。status を「正式」にすると rpg-ui.js が読む。届くまで1枚絵で描く' });
m.connectedCounts = n; m.counts = {}; m.assets.forEach(a => { m.counts[a.status] = (m.counts[a.status] || 0) + 1; });
m.note = m.note.replace(/画像生成の手段が無く.*$/, '').replace(/「connected」は.*$/, '') + '「connected」は制作状態（status）とは別の欄：画面（rpg/js）が実際に読んでいるか。';
fs.writeFileSync(P, JSON.stringify(m, null, 1) + '\n');
console.log(JSON.stringify(n), 'parts_json:', m.assets.find(a => a.id === 'parts_json').status);
