'use strict';
// 成長・コイン・日次枠・抽選・保存/復元（DOM非依存。保存先は差し替え可能）
(function (root, factory) {
  const m = factory(typeof module === 'object' && module.exports ? require('./rpg-data.js') : root.RPGData);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.RPGCore = m;
})(typeof self !== 'undefined' ? self : this, function (D) {
  const LS_RPG = 'ichimon.rpg.v1', LS_BACKUP = 'ichimon.rpg.backup.v1';
  const SAVE_VERSION = 2, WELCOME_COIN = 160, ADV_UNIT = 10, REVIEW_MAX = 5;

  // ---------- 経験値・レベル ----------
  const NEED = {
    base: L => 200 + 80 * (L - 1), adv: L => 400 + 120 * (L - 1), top: L => 600 + 180 * (L - 1), hero: L => 300 + 100 * (L - 1)
  };
  const CAP = { job: 30, hero: 60 };
  function cum(fn, L) { let s = 0; for (let k = 1; k < L; k++) s += fn(k); return s; }       // Lv L に必要な累積XP
  function levelOf(fn, xp, cap) {
    let L = 1, rest = Math.max(0, xp);
    while (L < cap && rest >= fn(L)) { rest -= fn(L); L++; }
    return { lv: L, into: L >= cap ? 0 : rest, need: L >= cap ? 0 : fn(L), capped: L >= cap };
  }
  const jobLevel = (job, xp) => levelOf(NEED[D.JOBS[job].tier], xp, CAP.job);
  const heroLevel = xp => levelOf(NEED.hero, xp, CAP.hero);
  function jobLevels(save) { const o = {}; D.JOB_IDS.forEach(j => { o[j] = jobLevel(j, save.jobXp[j] || 0).lv; }); return o; }
  // 次に覚える技までの残りXP（表示用）
  function nextSkill(job, xp) {
    const lv = jobLevel(job, xp).lv, nx = D.SKILLS_OF[job].filter(s => s.lv > lv).sort((a, b) => a.lv - b.lv)[0];
    if (!nx) return null;
    return { skill: nx, remain: cum(NEED[D.JOBS[job].tier], nx.lv) - xp };
  }

  // ---------- 日付（日本時間・午前4時切替） ----------
  function dayKey(ms) { return new Date(ms + 9 * 3600e3 - 4 * 3600e3).toISOString().slice(0, 10); }
  const xpMultOf = n => n === 1 ? 3 : n === 2 ? 2 : 1;
  const coinMultOf = n => n <= 2 ? 2 : 1;
  // 今日のキー。端末時計が巻き戻っていても、これまでに見た最新の日より前にはしない
  function todayKey(save, ms) { const k = dayKey(ms); return save.daily.maxKey && k < save.daily.maxKey ? save.daily.maxKey : k; }
  function reserveSlot(save, ms) {
    const key = todayKey(save, ms), used = (save.daily.used[key] || 0) + 1;
    save.daily.used[key] = used; if (!save.daily.maxKey || key > save.daily.maxKey) save.daily.maxKey = key;
    const keys = Object.keys(save.daily.used).sort(); while (keys.length > 14) delete save.daily.used[keys.shift()];
    return { key, no: used, xpMult: xpMultOf(used), coinMult: coinMultOf(used), chest: used <= 3 };
  }

  // ---------- 報酬 ----------
  function rewardOf(o) { return { xpBase: 10 * o.N + 5 * o.C + 5 * o.R, coinBase: 4 * o.N + 2 * o.C }; }

  // 報酬画面の合計表示。開封前＝学習＋討伐（res.coin）、開封後＝箱の増分を足す
  function rewardTotals(res, chest) {
    const base = res.coin, opened = !!(chest && chest.status === 'opened'), cc = opened && chest.result && chest.result.coin ? chest.result.coin : 0;
    return { base, chestCoin: cc, total: base + cc, opened, text: opened ? '学習・討伐' + base + '＋宝箱' + cc + '＝合計' + (base + cc) : '合計 +' + base };
  }

  // ---------- 乱数（再現できる） ----------
  function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  function rngFrom(seed) { let a = hashStr(String(seed)) || 1; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ---------- 装備ランク解放・素材 ----------
  // I開始 / II 砂海クリア後 / III 第1章完了 / IV 逆さ遺跡クリア後 / V 第2章完了 / VI 天測の塔クリア後
  function maxRank(save) {
    const c = save.progress.clearedRegions, all = ch => D.REGIONS.filter(x => x.ch === ch).every(x => c.includes(x.id)); let r = 1;
    if (c.includes('sandsea')) r = 2;
    if (all(1)) r = 3;
    if (r === 3 && c.includes('invertedruins')) r = 4;
    if (r === 4 && all(2)) r = 5;
    if (r === 5 && c.includes('skytower')) r = 6;
    return r;
  }
  const oreId = r => 'ore_' + r, oreName = r => 'ランク' + D.RANK_NAME[r - 1] + 'の鉱石';
  function addMat(save, id, n) { save.inv.mats[id] = (save.inv.mats[id] || 0) + n; }
  function grantItem(save, id) {
    const it = D.ITEMS[id];
    if (save.inv.items[id]) { addMat(save, oreId(it.rank), 3); return { dup: true, ore: 3, item: id }; }   // レア重複 → 同ランク素材3
    save.inv.items[id] = 1; if (save.codex) save.codex.items[id] = 1; return { dup: false, item: id };
  }

  // ---------- 宝箱（開封前に結果を確定して保存） ----------
  function rollChest(save, seed) {
    const rng = rngFrom(seed), pity = save.chest.pity, rank = maxRank(save), wish = save.wish;
    let kind = pity >= 2 ? 'rare' : (x => x < 0.4 ? 'rare' : x < 0.7 ? 'mat' : 'coinmat')(rng());
    // お願いの種類を優先し、未所持の装備を選ぶ。同種類が全部そろっていたら
    // 同ランクの別種類から未所持品を探して、装備が増える機会を確保する。
    const rare = Object.values(D.ITEMS).filter(i => i.rarity === 'rare' && i.rank === rank);
    const preferred = rare.filter(i => i.wish === wish);
    const freshPreferred = preferred.filter(i => !save.inv.items[i.id]);
    const freshAny = rare.filter(i => !save.inv.items[i.id]);
    const cands = freshPreferred.length ? freshPreferred : freshAny.length ? freshAny : preferred;
    if (kind === 'rare' && !cands.length) kind = 'mat';
    const r = { kind, rank, wish, pityBefore: pity };
    if (kind === 'rare') r.item = cands[Math.floor(rng() * cands.length)].id;
    else if (kind === 'mat') r.mats = { [oreId(rank)]: 4 };
    else { r.coin = 40; r.mats = { [oreId(rank)]: 2 }; }
    return r;
  }
  // 旧：抽選と同時に付与していた（テスト・移行用に残す）。新しい流れは addSealedChest / openChest
  function applyChest(save, r) {
    const out = { kind: r.kind, rank: r.rank };
    if (r.kind === 'rare') { save.chest.pity = 0; Object.assign(out, grantItem(save, r.item)); }
    else { save.chest.pity = r.pityBefore + 1; }
    if (r.coin) { save.coins += r.coin; out.coin = r.coin; }
    if (r.mats) { Object.keys(r.mats).forEach(k => addMat(save, k, r.mats[k])); out.mats = r.mats; }
    return out;
  }
  // 朝星の宝箱：清算時に中身を抽選して sealed で保管（残高は変えない）。pity は箱IDごとに一度だけ進める
  function addSealedChest(save, id, roll, meta) {
    save.chests = save.chests || [];
    const ex = save.chests.find(c => c.id === id); if (ex) return ex;
    const c = Object.assign({ id, status: 'sealed', roll, result: null }, meta || {});
    save.chests.push(c);
    save.chest.pity = roll.kind === 'rare' ? 0 : roll.pityBefore + 1;
    return c;
  }
  function chestById(save, id) { return (save.chests || []).find(c => c.id === id) || null; }
  function sealedChests(save) { return (save.chests || []).filter(c => c.status === 'sealed'); }
  // 付与と opened を一度に確定する（メモリ上。保存は呼び出し側）。opened は何もしない
  function openChest(save, id) {
    const c = chestById(save, id); if (!c) return { ok: false, err: '宝箱が見つからない' };
    if (c.status === 'opened') return { ok: true, already: true, chest: c, result: c.result };
    const r = c.roll, out = { kind: r.kind, rank: r.rank };
    if (r.kind === 'rare') Object.assign(out, grantItem(save, r.item));
    if (r.coin) { save.coins += r.coin; out.coin = r.coin; }
    if (r.mats) { Object.keys(r.mats).forEach(k => addMat(save, k, r.mats[k])); out.mats = r.mats; }
    c.status = 'opened'; c.result = out;
    return { ok: true, already: false, chest: c, result: out };
  }
  const replaceContents = (dst, src) => { Object.keys(dst).forEach(k => { delete dst[k]; }); Object.assign(dst, src); };
  // 開封して保存まで。保存に失敗したら元に戻す（付与なし・sealed のまま）。別タブが先に進んでいたら読み直し、開封済みなら付与せず結果だけ返す
  function openChestPersist(save, store, id, ms) {
    const snap = JSON.stringify(save), r = openChest(save, id);
    if (!r.ok || r.already) return r;
    const w = store.save(save);
    if (w.ok) return r;
    replaceContents(save, JSON.parse(snap));
    if (w.err === 'stale') {
      const l = store.load(ms);
      if (l.ok && !l.fresh) { replaceContents(save, l.save); const c = chestById(save, id); if (c && c.status === 'opened') return { ok: true, already: true, chest: c, result: c.result, reloaded: true }; }
    }
    return { ok: false, err: w.err };
  }
  // 旧セーブ移行：旧処理は抽選と同時に残高へ付与していた。残っているのは直近の結果の箱だけ。付与済みなので受取済み(opened,legacy)にし、再加算しない
  function migrateChests(save) {
    save.chests = Array.isArray(save.chests) ? save.chests : [];
    const lr = save.lastResult;
    if (lr && lr.chest && lr.id && !lr.chestId) {
      const id = lr.id + ':chest';
      if (!chestById(save, id)) save.chests.push({ id, status: 'opened', legacy: true, roll: null, result: lr.chest });
      lr.chestId = id;
    }
    return save;
  }

  // ---------- 買い物・装備 ----------
  function canBuy(save, id) {
    const it = D.ITEMS[id]; if (!it || it.rarity !== 'normal' || !it.rank) return '買えない';
    if (it.rank > maxRank(save)) return 'まだ売っていない';
    if (save.inv.items[id]) return '持っている';
    if (save.coins < it.price) return 'コインが足りない';
    return null;
  }
  function buy(save, id) { const e = canBuy(save, id); if (e) return { ok: false, err: e }; save.coins -= D.ITEMS[id].price; save.inv.items[id] = 1; return { ok: true }; }
  function equip(save, slot, id) {
    if (id && (!save.inv.items[id] || D.ITEMS[id].slot !== slot)) return false;
    save.equip[slot] = id || null; return true;
  }
  function bestOwned(save, slot, job) {   // 自動装着の目安（性能が一番高いもの）
    const wt = D.JOBS[job].weapons;
    const own = Object.keys(save.inv.items).map(i => D.ITEMS[i]).filter(i => i.slot === slot && (slot !== 'weapon' || i.cat === 'any' || wt.includes(i.cat)));
    own.sort((a, b) => ((b.atk || b.def || 0) - (a.atk || a.def || 0)));
    return own[0] ? own[0].id : null;
  }

  // ---------- 転職 ----------
  function canChangeJob(save, job) {
    const j = D.JOBS[job]; if (!j) return '不明な職業';
    if (save.active) return '冒険の途中は変えられない';
    if (!save.firstDone) return '最初の冒険のあとに変えられる';
    const lv = jobLevels(save);
    if (j.tier === 'adv') { return j.req.every(r => lv[r] >= 10) ? null : '基本職2つがLv10になると解放'; }
    if (j.tier === 'top') {
      if (j.reqFrom.filter(r => lv[r] >= 20).length < 2) return '上級職2つがLv20になると解放';
      if (!save.trials || !save.trials[j.trial]) return '試練をクリアすると解放';
    }
    return null;
  }

  // ---------- セーブデータ ----------
  function newSave(ms) {
    const jobXp = {}; D.JOB_IDS.forEach(j => { jobXp[j] = 0; });
    return {
      v: SAVE_VERSION, rev: 0, created: ms || 0, name: '', look: { outfit: null },
      advXp: 0, job: D.FIRST_JOB, jobXp, coins: 0, welcomeDone: false, firstDone: false,
      inv: { items: { w_start: 1 }, mats: {}, enhance: {}, fresh: {} }, equip: { weapon: 'w_start', armor: null, acc: null },
      loadout: { skills: null, tactic: 'auto' }, wish: 'sword',
      progress: { step: 0, enemyHp: null, clearedRegions: [], bossKills: {} },
      daily: { maxKey: '', used: {} }, chest: { pity: 0 }, chests: [],
      codex: { enemies: {}, items: {} }, goal: null, seen: {}, active: null, lastResult: null, ledger: { settled: {} }, trials: {}, stats: { adventures: 0 }, settings: { sound: false, vibrate: false }
    };
  }
  // v1 → v2：外見選択の廃止（顔・髪型・肌・髪色を捨てる。衣装 outfit・職・装備・進行はそのまま）
  function migrateSave(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
    if (o.v === 1) o.v = SAVE_VERSION;
    if (o.v === SAVE_VERSION && o.look && typeof o.look === 'object') { const ou = o.look.outfit; o.look = { outfit: ou || null }; }
    return o;
  }
  function validateSave(o) {
    const err = [], isObj = x => x && typeof x === 'object' && !Array.isArray(x);
    if (!isObj(o)) return ['保存データが壊れている'];
    if (o.v !== SAVE_VERSION && o.v !== 1) err.push('バージョンが違う');   // v1 は migrateSave で v2 にしてから使う
    ['advXp', 'coins', 'rev'].forEach(k => { if (!Number.isFinite(o[k]) || o[k] < 0) err.push(k + 'が不正'); });
    if (!D.JOBS[o.job]) err.push('職業が不正');
    ['inv', 'equip', 'progress', 'daily', 'chest', 'ledger', 'jobXp', 'loadout'].forEach(k => { if (!isObj(o[k])) err.push(k + 'が不正'); });
    if (isObj(o.jobXp)) D.JOB_IDS.forEach(j => { if (!Number.isFinite(o.jobXp[j]) || o.jobXp[j] < 0) err.push('jobXp.' + j); });
    if (isObj(o.inv) && isObj(o.inv.items)) Object.keys(o.inv.items).forEach(i => { if (!D.ITEMS[i]) err.push('不明な装備 ' + i); });
    if (isObj(o.equip)) ['weapon', 'armor', 'acc'].forEach(s => { const i = o.equip[s]; if (i && !D.ITEMS[i]) err.push('不明な装備 ' + i); });
    if (isObj(o.progress) && !(Number.isInteger(o.progress.step) && o.progress.step >= 0)) err.push('progress.step');
    if (o.active != null && !(isObj(o.active) && o.active.id && o.active.battle)) err.push('冒険の途中データが不正');
    return err;
  }

  // ---------- 保存（revision による排他。失敗は成功扱いにしない） ----------
  // storage: {get(k), set(k,v)}（例外を投げうる）。メモリだけに逃がして成功扱いにはしない
  function makeStore(storage) {
    const readRaw = () => { try { return { ok: true, v: storage.get(LS_RPG) }; } catch (e) { return { ok: false, err: 'read' }; } };
    return {
      // {ok, save, fresh, err}
      load(ms) {
        const r = readRaw(); if (!r.ok) return { ok: false, err: 'storage', save: newSave(ms), fresh: true };
        if (!r.v) return { ok: true, save: newSave(ms), fresh: true };
        try { const o = migrateSave(JSON.parse(r.v)), e = validateSave(o); if (e.length) return { ok: false, err: 'corrupt', detail: e, save: newSave(ms), fresh: true }; return { ok: true, save: o, fresh: false }; }
        catch (e) { return { ok: false, err: 'corrupt', detail: ['JSONが読めない'], save: newSave(ms), fresh: true }; }
      },
      // 読み込み時の rev と保存先の rev が違えば、別のタブが先に進んでいる → 上書きしない
      save(save) {
        const r = readRaw(); if (!r.ok) return { ok: false, err: 'storage' };
        let curRev = -1; if (r.v) { try { curRev = JSON.parse(r.v).rev; } catch (e) { curRev = -2; } }
        if (curRev !== -1 && curRev !== save.rev) return { ok: false, err: 'stale' };
        const next = Object.assign({}, save, { rev: save.rev + 1 }), txt = JSON.stringify(next);
        try { storage.set(LS_RPG, txt); if (storage.get(LS_RPG) !== txt) return { ok: false, err: 'storage' }; } catch (e) { return { ok: false, err: 'storage' }; }
        save.rev = next.rev; return { ok: true };
      }
    };
  }

  // ---------- 書き出し・読み込み ----------
  // 対象：学習stats・選択設定・ゲーム進捗。送信キュー・端末IDは端末固有なので含めない
  function buildExport(parts, ms) {
    return JSON.stringify({ kind: 'ichimon-save', v: 1, at: ms, stats: parts.stats || {}, sel: parts.sel || null, rpg: parts.rpg || null });
  }
  function parseImport(text) {
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, err: ['JSONが読めない'] }; }
    if (!o || o.kind !== 'ichimon-save' || o.v !== 1) return { ok: false, err: ['このアプリのセーブではない'] };
    if (!o.stats || typeof o.stats !== 'object' || Array.isArray(o.stats)) return { ok: false, err: ['学習記録が不正'] };
    for (const k of Object.keys(o.stats)) { const x = o.stats[k]; if (!x || typeof x !== 'object' || !Number.isFinite(x.w) || !Number.isFinite(x.c) || !Number.isFinite(x.s)) return { ok: false, err: ['学習記録が不正: ' + k] }; }
    if (o.rpg) { migrateSave(o.rpg); const e = validateSave(o.rpg); if (e.length) return { ok: false, err: e }; }
    return { ok: true, data: o };
  }
  // 現在の状態をバックアップしてから反映。検証に失敗したときは何も変えない。送信キューは触らない
  function applyImport(text, io, ms) {
    const p = parseImport(text); if (!p.ok) return p;
    const backup = buildExport({ stats: JSON.parse(io.get('ichimon.stats.v1') || '{}'), sel: JSON.parse(io.get('ichimon.sel.v1') || 'null'), rpg: JSON.parse(io.get(LS_RPG) || 'null') }, ms);
    try {
      io.set(LS_BACKUP, backup);
      io.set('ichimon.stats.v1', JSON.stringify(p.data.stats));
      if (p.data.sel) io.set('ichimon.sel.v1', JSON.stringify(p.data.sel));
      if (p.data.rpg) { const cur = io.get(LS_RPG); let rev = 0; try { rev = cur ? JSON.parse(cur).rev : 0; } catch (e) {} io.set(LS_RPG, JSON.stringify(Object.assign({}, p.data.rpg, { rev: rev + 1, active: null }))); }
    } catch (e) { return { ok: false, err: ['保存に失敗した'] }; }
    return { ok: true, backup };
  }

  // ---------- 表示用の組み立て（DOM非依存。計算は既存の成長式 levelOf / nextSkill を使う） ----------
  // 宝箱の中身 → 表示項目。主役は「装備 > 素材 > コイン」の順で1品目、残りは extras（黙って省略しない）
  function chestView(r, job) {
    if (!r) return null;
    const items = [], mk = (kind, id, name, qty, use) => ({ kind, id, name, qty, use });
    let dupOf = null, fit = null;
    if (r.kind === 'rare' && r.item) {
      const it = D.ITEMS[r.item];
      if (r.dup) { dupOf = { id: r.item, name: it.name }; items.push(mk('mat', oreId(it.rank), oreName(it.rank), r.ore, '装備を強くする素材')); }
      else {
        items.push(mk('item', r.item, it.name, 1, '新しい装備を手に入れた！'));
        const j = job && D.JOBS[job];
        fit = !(it.slot === 'weapon' && j && it.cat !== 'any' && !j.weapons.includes(it.cat)) ? { ok: true } : { ok: false, job: j.name };
      }
    }
    if (r.kind !== 'rare' || !r.dup) Object.keys(r.mats || {}).forEach(k => items.push(mk('mat', k, oreName(+k.slice(4)), r.mats[k], '装備を強くする素材')));
    else Object.keys(r.mats || {}).forEach(k => { if (k !== items[0].id) items.push(mk('mat', k, oreName(+k.slice(4)), r.mats[k], '装備を強くする素材')); });
    if (r.coin) items.push(mk('coin', 'coin', 'コイン', r.coin, '街での買い物に使える'));
    const order = { item: 0, mat: 1, coin: 2 }; items.sort((a, b) => order[a.kind] - order[b.kind]);
    return { items, primary: items[0] || null, extras: items.slice(1), dupOf, fit, coin: r.coin || 0 };
  }
  // 成長ゲージ：現在の職業の「次のレベルまで」。levelOf の into/need をそのまま使う（丸めない）
  function growthView(job, xp, o) {
    o = o || {};
    const jl = jobLevel(job, xp), nx = nextSkill(job, xp);
    const v = { job, lv: jl.lv, lvFrom: o.lvFrom == null ? jl.lv : o.lvFrom, capped: jl.capped, into: jl.into, need: jl.need,
      remain: jl.capped ? 0 : jl.need - jl.into, ratio: jl.capped ? null : jl.into / jl.need, nextLv: jl.capped ? null : jl.lv + 1,
      sub: jl.capped ? null : nx ? { type: 'next', lv: nx.skill.lv, skill: nx.skill.id } : { type: 'all' } };
    v.up = v.lv > v.lvFrom; v.advUp = o.advFrom != null && o.advTo != null && o.advTo > o.advFrom ? { from: o.advFrom, to: o.advTo } : null;
    return v;
  }
  return { LS_RPG, LS_BACKUP, SAVE_VERSION, migrateSave, WELCOME_COIN, ADV_UNIT, REVIEW_MAX, NEED, CAP, cum, levelOf, jobLevel, heroLevel, jobLevels, nextSkill, dayKey, xpMultOf, coinMultOf, todayKey, reserveSlot, rewardOf, hashStr, rngFrom, maxRank, oreId, oreName, addMat, grantItem, rewardTotals, chestView, growthView, rollChest, applyChest, addSealedChest, chestById, sealedChests, openChest, openChestPersist, migrateChests, canBuy, buy, equip, bestOwned, canChangeJob, newSave, validateSave, makeStore, buildExport, parseImport, applyImport };
});
