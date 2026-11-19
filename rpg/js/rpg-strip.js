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
    heal: 240, guard: 200, enemy: 260, defeat: 780, defeatFade: 200, walk: 400,
    TEXT_MS: 650, FAST: 0.6, MAX_PENDING: 2
  };
  const sum = a => a.reduce((x, y) => x + y, 0);
  // ポーズ名→部品の対応表（1か所）。主人公の新しい部品（idle/walk 2コマ/windup/attack/guard/win）が来たら、右側を差し替えるだけ。
  // 今ある小型絵（S）のポーズは idle / attack / hit / walk の4つ。値が配列なら交互に使う（歩行の2コマ）
  const HERO_POSE_MAP = { idle: 'idle', windup: 'idle', attack: 'attack', guard: 'hit', hurt: 'hit', win: 'idle', walk: ['walk', 'idle'] };
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
    return segs;
  }
  // 不正解・わからない：まず小さく守る。その後ろに敵の反撃（実際にあった場合）
  function planWrong(events) {
    const segs = [{ k: 'guard', d: T.guard }];
    (events || []).forEach(e => { if (e.t === 'enemy') segs.push({ k: 'enemy', d: T.enemy, dmg: e.dmg || 0, reduced: e.reduced || 0, name: e.name || null }); });
    return segs;
  }
  const total = segs => sum((segs || []).map(s => s.d));
  // 連続回答で追いつけないとき：区間を短くし、回復の小演出は省く（結果は変えない）
  function shorten(segs) { return segs.filter(s => s.k !== 'heal').map(s => Object.assign({}, s, { d: Math.max(60, Math.round(s.d * T.FAST)), fast: true })); }
  // 待ち行列に足す。待ちが MAX_PENDING を超えたら古いほうから捨てる（捨てても、最後に確定状態へ追いつく）
  function enqueue(queue, group, running) {
    const q = queue.slice(), g = running || q.length ? shorten(group) : group; q.push(g);
    let dropped = 0; while (q.length > T.MAX_PENDING) { q.shift(); dropped++; }
    return { queue: q, dropped };
  }
  return { T, HERO_POSE_MAP, poseOf, rangedOf, plan, planWrong, total, shorten, enqueue };
});
