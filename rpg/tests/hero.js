'use strict';
// node rpg/tests/hero.js — 主人公の描画の純粋な部分（色の列・色の置換・武器の置き場）と、台帳・外見・衣装・転職の武器の決まり
const fs = require('fs'), path = require('path');
const D = require('../js/rpg-data.js'), C = require('../js/rpg-core.js'), M = require('../js/rpg-meta.js'), SP = require('../js/rpg-sprites.js');
let pass = 0, fail = 0; const failures = [];
function t(name, fn) { try { fn(); pass++; } catch (e) { fail++; failures.push(name + ' → ' + e.message); } }
function eq(a, b, m) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || '') + ' 期待 ' + JSON.stringify(b) + ' 実際 ' + JSON.stringify(a)); }
function ok(c, m) { if (!c) throw new Error(m || 'ok でない'); }
const ROOT = path.join(__dirname, '..', '..');
const man = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ASSET_MANIFEST.json'), 'utf8'));
const fresh = () => { const s = M.ensure(C.newSave(0)); s.firstDone = true; return s; };

t('色の列：部品の色数nごとの位置に base、明→暗の順、長さ n（4色なら2番目＝部品側の「基本色」の位置）', () => {
  const lum = h => { const n = parseInt(h.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; };
  [[3, 1], [4, 1], [5, 2], [2, 0]].forEach(([n, bi]) => { const r = SP.buildRamp('#f0c39a', n); eq(r.length, n); eq(r[bi], '#f0c39a', 'n=' + n); for (let i = 1; i < n; i++) ok(lum(r[i - 1]) > lum(r[i]), '明→暗でない n=' + n + ' i=' + i); });
  eq(SP.buildRamp('#123456', 1), ['#123456']);
});
t('色の置換：完全一致の色だけ変わり、他の色と透明は変わらない', () => {
  const d = new Uint8ClampedArray([255, 214, 176, 255, 232, 176, 136, 255, 1, 2, 3, 255, 255, 214, 176, 0]);
  SP.recolorData(d, [['#ffd6b0', '#112233'], ['#e8b088', '#445566']]);
  eq(Array.from(d), [0x11, 0x22, 0x33, 255, 0x44, 0x55, 0x66, 255, 1, 2, 3, 255, 255, 214, 176, 0]);
});
t('色の置換：肌の列（SKIN 5色）×部品の色列(4色)で、全員ちがう並びになる', () => {
  const seen = new Set(M.SKIN.map(c => SP.buildRamp(c, 4).join()));
  eq(seen.size, M.SKIN.length); const hs = new Set(M.HAIR_COLOR.map(c => SP.buildRamp(c, 4).join())); eq(hs.size, M.HAIR_COLOR.length);
});
t('武器の置き場：握りを身体の握り手に合わせ、(gripAngle − tipAngle) だけ回す', () => {
  const p = SP.weaponPlacement({ grip: [30, 40], gripAngle: 90, weaponScale: 1.5 }, { grip: [5, 27], tipAngle: 45 }, 32, 32);
  eq(p.pivot, [30, 40]); eq(p.origin, [5, 27]); eq(p.angle, 45); eq(p.scale, 1.5);
  const q = SP.weaponPlacement({ grip: [1, 2] }, null, 32, 32); eq(q.angle, 0, '既定 45−45'); eq(q.origin, [6, 26]);
});
t('正式な1枚絵：12職×(待機・構え・攻撃・被弾・勝利・帯の待機/攻撃/被弾/歩行・マスター)が台帳にあり、ファイルもある', () => {
  const ids = new Set(man.assets.filter(a => a.status === '正式').map(a => a.id));
  D.JOB_IDS.forEach(j => ['', '_ready', '_attack', '_hit', '_win', '_master', '_master_win', '_strip', '_strip_attack', '_strip_hit', '_strip_walk', '_strip_master'].forEach(s => {
    const id = 'hero_' + j + s; ok(ids.has(id), id + ' が台帳に無い'); ok(fs.existsSync(path.join(ROOT, man.assets.find(a => a.id === id).path)), id + ' のファイルが無い');
  }));
});
t('台帳：全行に connected（接続の有無）が制作状態とは別にある。正式な画像で未接続は素材アイコン・未使用宝箱・部品のみ', () => {
  ok(man.assets.every(a => a.connected && a.connectedWhere), 'connected が無い行');
  const ng = man.assets.filter(a => a.status === '正式' && a.connected === '未接続').map(a => a.id);
  ok(ng.every(id => /^(icon_(bm_|ore_|job_|dawn|trial_)|chest_(normal|boss)_)/.test(id)), '想定外の未接続：' + ng.filter(id => !/^(icon_(bm_|ore_|job_|dawn|trial_)|chest_(normal|boss)_)/.test(id)).join());
});
t('台帳：第1章ボス6体と帯用の画像は全て「正式」で、ファイルがある', () => {
  const st = k => (man.assets.find(a => a.id === k) || {}).status;
  ['ancienttree', 'crystalturtle', 'silverdragon', 'hourglass', 'blackknight', 'machinegod'].forEach(k => { eq(st('enemy_b_' + k), '正式', k); eq(st('enemy_b_' + k + '_strip'), '正式', k + ' strip'); ok(fs.existsSync(path.join(ROOT, 'rpg/assets/chars/enemy_b_' + k + '.png')) && fs.existsSync(path.join(ROOT, 'rpg/assets/chars/enemy_b_' + k + '_strip.png')), k); });
});
t('武器の絵：はじまりの武器・他系統は、職業の最初の武器系統のランクIで描く（二重武器を作らない）', () => {
  eq(M.artWeapon('priest', 'w_start'), 'w_staff_1'); eq(M.artWeapon('warrior', 'w_start'), 'w_start'); eq(M.artWeapon('thief', null), 'w_dagger_1'); eq(M.artWeapon('ranger', 'w_bow_3'), 'w_bow_3'); eq(M.artWeapon('warrior', 'rw_sword_2'), 'rw_sword_2');
});
t('マスター衣装：その職業を Lv30 にすると獲得。未獲得は選べず、選べても別の職業では出ない', () => {
  const s = fresh(); eq(M.setOutfit(s, 'master'), false); ok(!M.masterOwned(s, 'warrior'));
  s.jobXp.warrior = C.cum(C.NEED.base, 29) + 1e6; ok(M.masterOwned(s, 'warrior')); eq(M.setOutfit(s, 'master'), true); eq(M.costumeOf(s, 'warrior'), 'master'); eq(M.costumeOf(s, 'mage'), null);
  eq(M.setOutfit(s, null), true); eq(M.costumeOf(s, 'warrior'), null);
});
t('外見の保存：衣装(outfit)を消さない。未獲得のマスター衣装は保存されない', () => {
  const s = fresh(); s.jobXp.warrior = 1e7; M.setOutfit(s, 'master');
  ok(M.setLook(s, 'a', { face: 1, hair: 2, skin: 3, hairColor: 4, outfit: 'master' }).ok); eq(s.look.outfit, 'master');
  ok(M.setLook(s, 'a', { face: 0, hair: 0, skin: 0, hairColor: 0 }).ok); eq(s.look.outfit, 'master', 'outfit 未指定なら据え置き');
  const n = fresh(); M.setLook(n, 'a', { face: 0, hair: 0, skin: 0, hairColor: 0, outfit: 'master' }); eq(n.look.outfit, null);
});
t('転職：いまの武器が使えなければ適合武器へ（swapped に前後が入る）。使えるなら据え置き', () => {
  const s = fresh(); C.grantItem(s, 'w_sword_3'); C.grantItem(s, 'w_dagger_2'); s.equip.weapon = 'w_sword_3'; s.jobXp.mage = 0;
  let r = M.changeJob(s, 'thief'); ok(r.ok); eq(s.equip.weapon, 'w_dagger_2'); eq(r.swapped, { from: 'w_sword_3', to: 'w_dagger_2' });
  s.jobXp.warrior = 1e6; r = M.changeJob(s, 'warrior'); eq(s.equip.weapon, 'w_sword_3'); eq(r.swapped.to, 'w_sword_3');
  C.grantItem(s, 'w_sword_5'); s.equip.weapon = 'w_sword_3'; s.jobXp.mage = 1e6; s.jobXp.warrior = 1e6; r = M.changeJob(s, 'magicknight'); ok(r.ok); eq(s.equip.weapon, 'w_sword_3', '使える武器は据え置き'); eq(r.swapped, null);
});
t('転職：無料支給品に替える（適合武器を持っていないとき）', () => {
  const s = fresh(); s.equip.weapon = 'w_start'; const r = M.changeJob(s, 'mage'); ok(r.ok); eq(r.gifts, ['w_staff_1']); eq(s.equip.weapon, 'w_staff_1'); eq(r.swapped, { from: 'w_start', to: 'w_staff_1' });
});
t('新比率：全12職の通常・マスター（と追加衣装6職）×L6ポーズ×S8ポーズの部品がそろい、旧ポーズ代用（POSE_FALLBACK）に落ちない。身体は全て heads v2・全高96前後・頭部高40で 2.3〜2.5頭身', () => {
  const PJ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'parts', 'parts.json'), 'utf8')), PD = path.join(__dirname, '..', 'assets', 'parts');
  const L = ['idle', 'ready', 'attack', 'guard', 'win', 'hit'], S = ['idle', 'walk', 'walk2', 'windup', 'attack', 'guard', 'win', 'hit'], ALT = ['magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger'];
  const miss = [], bad = [];
  D.JOB_IDS.forEach(j => [null, 'master'].concat(ALT.includes(j) ? ['alt1'] : []).forEach(c => [['L', L], ['S', S]].forEach(([z, ps]) => ps.forEach(p => {
    const k = j + (c ? '_' + c : '') + '_' + p + '_' + z, b = PJ.body[k];
    if (!b) { miss.push(k); return; }
    if (b.heads !== 'v2') bad.push(k + ' heads');
    if (!fs.existsSync(path.join(PD, 'body_' + k + '.png'))) miss.push(k + '.png');
    if (b.hand && !fs.existsSync(path.join(PD, b.hand))) miss.push(b.hand);
    const full = z === 'L' ? [85, 104] : [26, 30]; if (b.h < full[0] || b.h > full[1]) bad.push(k + ' 高さ' + b.h);
  }))));
  eq(miss, [], '部品なし'); eq(bad, [], '不正');
  const hd = PJ.head['head_v2_f0_h0_L']; ok(hd && hd.h >= 38 && hd.h <= 44 && hd.w / 96 >= 0.35 && hd.w / 96 <= 0.42, '頭の大きさ');
  for (let f = 0; f < M.FACE_N; f++) for (let h = 0; h < M.HAIR_N; h++) ['', '_attack', '_win'].forEach(e => ok(PJ.head['head_v2_f' + f + '_h' + h + '_L' + e], '頭なし f' + f + ' h' + h + e));
  for (let h = 0; h < M.HAIR_N; h++) ok(PJ.head['head_v2_h' + h + '_S'], 'S頭なし h' + h);
  D.JOB_IDS.forEach(j => ok(PJ.weapon[PJ.jobWeapon[j]] && PJ.weapon[PJ.jobWeapon[j]].held, j + ' の基本武器の手持ち絵'));
});
t('全武器(装備できる49種)の手持ち絵(held)が部品にあり、握り位置が絵の内側。各職の装備可能武器の種別も全て held を持つ（代用なし）', () => {
  const PJ = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'parts', 'parts.json'), 'utf8')), PD = path.join(__dirname, '..', 'assets', 'parts');
  const ws = Object.values(D.ITEMS).filter(i => i.slot === 'weapon'), bad = [];
  ws.forEach(i => { const fid = i.id.replace(/^(u_.+)_\d$/, '$1'), e = PJ.weapon[fid + '.png']; if (!e || !e.held || !e.heldGrip || !e.grip) { bad.push(i.id + ' 登録なし'); return; } if (!fs.existsSync(path.join(PD, e.held))) bad.push(i.id + ' 画像なし'); const n = (i.cat === 'dagger') ? 34 : 42; if (e.heldGrip[0] < 0 || e.heldGrip[0] >= n || e.heldGrip[1] < 0 || e.heldGrip[1] >= n) bad.push(i.id + ' 握り'); });
  eq(bad, []); ok(ws.length >= 49, '武器数 ' + ws.length);
  D.JOB_IDS.forEach(j => D.JOBS[j].weapons.forEach(c => { const id = 'w_' + c + '_1'; ok(PJ.weapon[id + '.png'] && PJ.weapon[id + '.png'].held, j + '/' + id); eq(M.artWeapon(j, id), id); }));
});
t('追加衣装(alt1)：上級職6職だけ。氷下火山クリアで解放、外見で選べて costumeOf が alt1 を返す。解放前・他職では通常', () => {
  const s = fresh(); s.job = 'paladin'; ok(!M.altOwned(s, 'paladin')); eq(M.setOutfit(s, 'alt1'), false);
  s.progress.clearedRegions.push('icevolcano'); ok(M.altOwned(s, 'paladin')); ok(!M.altOwned(s, 'warrior'));
  eq(M.setOutfit(s, 'alt1'), true); eq(M.costumeOf(s), 'alt1'); eq(M.costumeOf(s, 'warrior'), null);
  s.job = 'warrior'; eq(M.setOutfit(s, 'alt1'), false); s.job = 'sage'; eq(M.setLook(s, 'テスト', { face: 1, hair: 2, skin: 0, hairColor: 0, outfit: 'alt1' }).ok, true); eq(s.look.outfit, 'alt1'); eq(M.costumeOf(s), 'alt1');
  eq(M.ALT_JOBS.slice().sort(), ['magicknight', 'ninja', 'paladin', 'ranger', 'sage', 'shadow']);
});
console.log(JSON.stringify({ pass, fail, failures }, null, 1)); process.exit(fail ? 1 : 0);
