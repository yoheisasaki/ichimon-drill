'use strict';
// 冒険帯の演出の計画（DOM不要・状態を変えない純粋な関数）。回答の出来事（events）→ 見た目の区間（segments）に直すだけ。
// 戦闘計算・経験値・報酬は rpg-adventure.js が回答処理で一度だけ確定する。ここと rpg-ui.js の描画は、それを読んで見せるだけ。
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.RPGStrip = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // 区間の長さ（ms）。08指示書 4章：通常攻撃 450〜550／技 最大650／守り 150〜250／撃破 最大800／復習の「できた！」最大650
  const T = {
    attack: [90, 110, 90, 190],        // 予備動作・踏み込み・命中・戻り（合計480）
    skill: [100, 110, 120, 220],       // 技：同じ流れで少し長く（合計550）。技名は TEXT_MS まで出す
    support: 450,                      // 回復・守りの技：その場で効果
    heal: 240, guard: 200, enemy: 260, defeat: 780, defeatFade: 200, walk: 400, retreat: 320, FINAL_MAX: 480,
    TEXT_MS: 650, FAST: 0.6, MAX_PENDING: 2
  };
  const sum = a => a.reduce((x, y) => x + y, 0);
  // ポーズ名→部品の対応表（1か所）。主人公の新しい部品（idle/walk 2コマ/windup/attack/guard/win）が来たら、右側を差し替えるだけ。
  // 小型絵（S）のポーズ：idle / walk / walk2 / windup / attack / guard / win / hit（部品の無い職は rpg-sprites.js の POSE_FALLBACK で旧ポーズに代用される）。値が配列なら交互に使う（歩行の2コマ）
  const HERO_POSE_MAP = { idle: 'idle', windup: 'windup', attack: 'attack', guard: 'guard', hurt: 'hit', win: 'win', walk: ['walk', 'walk2'] };
  const poseOf = (name, step) => { const v = HERO_POSE_MAP[name] || 'idle'; return Array.isArray(v) ? v[(step || 0) % v.length] : v; };

  const rangedOf = (job, weaponId) => /^w_(staff|bow)/.test(weaponId || '') || job === 'mage' || job === 'priest' || job === 'sage' || job === 'starseer';

  // events: recordAnswer が返した出来事。o: { review, killed, ranged, fx:(skillId)→効果キーまたはnull, at:(key)→'hero'|'melee'|'enemy', name:(skillId)→技名 }
  // 返り値: 区間の配列 [{k, d, ...}]。入力の events は書き換えない
  function plan(events, o) {
    o = o || {}; const segs = [];
    (events || []).forEach(e => {
      if (e.t === 'hero') {
        const skill = e.act !== 'normal' ? e.act : null, key = skill && o.fx ? o.fx(skill) : null, at = key && o.at ? o.at(key) : null;
        const name = skill && o.name ? o.name(skill) : null;
        const support = !!skill && !(e.dmg > 0) && at === 'hero';
        const ph = support ? [T.support] : (skill ? T.skill : T.attack);
        segs.push({ k: support ? 'support' : (skill ? 'skill' : 'attack'), d: sum(ph), ph, hitAt: support ? 120 : ph[0] + ph[1], dmg: e.dmg || 0, heal: e.heal || 0, skill, key, at, ranged: !!o.ranged && !support, text: name || (o.review ? 'できた！' : null) });
      } else if (e.t === 'heal') segs.push({ k: 'heal', d: T.heal });
      else if (e.t === 'enemy') segs.push({ k: 'enemy', d: T.enemy, dmg: e.dmg || 0, reduced: e.reduced || 0, name: e.name || null });
      else if (e.t === 'explore') segs.push({ k: 'walk', d: T.walk });
    });
    if (o.killed) segs.push({ k: 'defeat', d: T.defeat, fade: T.defeatFade });
    if (o.retreated) segs.push({ k: 'retreat', d: T.retreat });
    return o.final ? fit(segs, T.FINAL_MAX) : segs;
  }
  // 不正解・わからない：まず小さく守る。その後ろに敵の反撃（実際にあった場合）
  function planWrong(events, o) {
    const segs = [{ k: 'guard', d: T.guard }];
    (events || []).forEach(e => { if (e.t === 'enemy') segs.push({ k: 'enemy', d: T.enemy, dmg: e.dmg || 0, reduced: e.reduced || 0, name: e.name || null }); });
    if (o && o.retreated) segs.push({ k: 'retreat', d: T.retreat });
    return o && o.final ? fit(segs, T.FINAL_MAX) : segs;
  }
  const total = segs => sum((segs || []).map(s => s.d));
  // 連続回答で追いつけないとき：区間を短くし、回復の小演出は省く（結果は変えない）
  // 区間を k 倍の長さにする（各段階・命中の時刻も同じ割合）
  const scaleSeg = (s, k) => Object.assign({}, s, { d: Math.max(60, Math.round(s.d * k)), ph: s.ph ? s.ph.map(x => Math.round(x * k)) : s.ph, hitAt: s.hitAt != null ? Math.round(s.hitAt * k) : s.hitAt, fade: s.fade != null ? Math.round(s.fade * k) : s.fade });
  function shorten(segs) { return segs.filter(s => s.k !== 'heal').map(s => Object.assign(scaleSeg(s, T.FAST), { fast: true })); }
  // 最終回答：結果画面へ移る前に見せる演出は max ms 以内に収める（撃破は敵が消えて勝ちの構え、撤退は引く動作。歩く・背景移動は省く）
  function fit(segs, max) {
    segs = segs.map(s => s.k === 'defeat' ? Object.assign({}, s, { d: s.fade, final: true }) : s);
    const tot = total(segs); if (tot <= max) return segs;
    const k = max / tot; return segs.map(s => Object.assign(scaleSeg(s, k), { final: s.final, fast: true }));
  }
  // 待ち行列に足す。待ちが MAX_PENDING を超えたら古いほうから捨てる（捨てても、最後に確定状態へ追いつく）
  function enqueue(queue, group, running) {
    const q = queue.slice(), g = running || q.length ? shorten(group) : group; q.push(g);
    let dropped = 0; while (q.length > T.MAX_PENDING) { q.shift(); dropped++; }
    return { queue: q, dropped };
  }
  return { T, HERO_POSE_MAP, poseOf, rangedOf, plan, planWrong, total, shorten, fit, enqueue };
});
