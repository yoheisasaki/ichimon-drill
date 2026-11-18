'use strict';
// 自動戦闘（DOM非依存・乱数なし・同じ状態なら同じ結果）。
// 回答ごとに resolveAnswer(state, {kind, correct}) を呼ぶと、状態を直接更新して出来事の配列を返す。
(function (root, factory) {
  const m = factory(typeof module === 'object' && module.exports ? require('./rpg-data.js') : root.RPGData);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.RPGBattle = m;
})(typeof self !== 'undefined' ? self : this, function (D) {
  const GAUGE_MAX = 6, START_GAUGE = 2, ACT_EVERY = 3, REDUCE_CAP = 0.8;
  const clone = o => JSON.parse(JSON.stringify(o));
  const ATTACK_TACTICS = ['auto', 'attack', 'guard'];

  // ---------- 能力値 ----------
  function baseStats(advLv, job) {
    const L = Math.max(1, advLv), m = D.JOBS[job].mod;
    return { hp: (50 + 5 * (L - 1)) * m[0], atk: (10 + 2 * (L - 1)) * m[1], def: (4 + Math.floor((L - 1) / 2)) * m[2] };
  }
  // equip: {weapon, armor, acc} はアイテムID。職業パッシブ・装備効果の合算も返す
  function heroStats(advLv, job, jobLv, equip) {
    const b = baseStats(advLv, job), it = id => (id && D.ITEMS[id]) || null;
    const w = it(equip && equip.weapon) || D.START_WEAPON, a = it(equip && equip.armor), x = it(equip && equip.acc);
    const fx = {};
    [a, x, w].forEach(i => { if (i && i.fx) Object.keys(i.fx).forEach(k => { fx[k] = k === 'elemAdd' ? i.fx[k] : (fx[k] || 0) + i.fx[k]; }); });
    let hpPct = fx.hpPct || 0;
    if (job === 'warrior' && jobLv >= 3) hpPct += 0.15;
    if (D.JOBS[job].tier === 'base' && jobLv >= 20) hpPct += 0.05;
    const maxHp = Math.floor(b.hp * (1 + hpPct));
    return { maxHp, atk: Math.floor(b.atk) + (w.atk || 0), def: Math.floor(b.def) + (a ? a.def || 0 : 0), fx };
  }

  // ---------- 技の有効値（職業レベルによる強化） ----------
  function eff(sk, jobLv) {
    if (!sk.up) return sk;
    const o = clone(sk);
    sk.up.forEach(u => {
      if (jobLv < u[0]) return;
      if (u[1] === 'mset') { o.m = u[2]; }
      else if (u[1] === 'madd') {
        if (o.hits) { const per = u[2] / o.hits.length; o.hits = o.hits.map(h => [h[0] + per, h[1]]); }
        else { o.m = (o.m || 0) + u[2]; if (o.prep) o.prep += u[2]; }
      }
    });
    return o;
  }
  // 使える技（その職の習得済み＋継承）。jobs: {jobId: lv}
  function inheritable(jobs) {
    const out = [];
    D.JOB_IDS.forEach(j => { (jobs[j] || 0) >= 1 && D.SKILLS_OF[j].forEach(s => { if (s.inh && (jobs[j] || 0) >= s.lv) out.push(s.id); }); });
    return out;
  }
  function recommendLoadout(job, jobs) {
    const lv = jobs[job] || 1, own = D.SKILLS_OF[job].filter(s => s.lv <= lv);
    const pickBest = pred => { const c = own.filter(pred); return c.sort((a, b) => ((b.m || 1) - (a.m || 1)) || b.lv - a.lv)[0]; };
    const picks = [pickBest(s => s.cost <= 2), pickBest(s => s.cost === 3), pickBest(s => s.cost >= 5)].filter(Boolean);
    const rest = own.filter(s => !picks.includes(s)).sort((a, b) => b.lv - a.lv);
    while (picks.length < 3 && rest.length) picks.push(rest.shift());
    // 守り・回復の技が1つも入っていなければ、いちばん弱い攻撃技と入れ替える
    const def = s => s.guard || s.heal;
    if (picks.length === 3 && !picks.some(def)) { const d = own.filter(def).sort((a, b) => b.lv - a.lv)[0]; if (d) { picks.sort((a, b) => (a.m || 1) - (b.m || 1) || a.cost - b.cost); picks[0] = d; } }
    return picks.map(s => s.id);
  }
  function validateLoadout(job, jobs, skills, advInherit) {
    const lv = jobs[job] || 1, errs = [], inh = inheritable(jobs);
    if (skills.length > 3) errs.push('技は3つまで');
    if (new Set(skills).size !== skills.length) errs.push('同じ技は重ねられない');
    let nInh = 0;
    skills.forEach(id => {
      const s = D.SKILLS[id]; if (!s) return errs.push('不明な技 ' + id);
      if (s.job === job) { if (s.lv > lv) errs.push(s.name + 'はまだ使えない'); }
      else { nInh++; if (!inh.includes(id)) errs.push(s.name + 'は継承できない'); if (!advInherit) errs.push('継承枠はまだ開いていない'); }
    });
    if (nInh > 1) errs.push('継承できるのは1つまで');
    return errs;
  }

  // ---------- 戦闘の初期状態 ----------
  function newBattle(o) {
    // o: {job, jobLv, advLv, equip, skills:[id], tactic, enemyId, enemyHp?}
    const hs = heroStats(o.advLv, o.job, o.jobLv, o.equip), ed0 = D.ENEMIES[o.enemyId], ed = Object.assign({}, ed0, o.enemyStats || D.statsAt(ed0, 0));
    let gauge = START_GAUGE; if (o.job === 'mage' && o.jobLv >= 3) gauge += 1;
    const p = { imbue: null, shield: 0, shadow: 0, last: null, seal: null, aim: 0, fly: false, star: 0 };
    if (o.job === 'ranger' && o.jobLv >= 15) p.aim = 1;
    if (o.job === 'starseer' && o.jobLv >= 15) p.star = 1;
    const e = { id: ed.id, name: ed.name, boss: ed.boss, maxHp: ed.hp, hp: o.enemyHp == null ? ed.hp : Math.max(1, o.enemyHp), atk: ed.atk, def: ed.def, weak: ed.weak, pattern: ed.pattern, pi: 0, count: 0, guarded: false, brace: 0, atkDown: null, tele: false };
    e.tele = e.pattern[0].k === 'big';
    return {
      v: 1, status: 'fight', turn: 0, used: {}, cast: {},
      hero: { job: o.job, jobLv: o.jobLv, advLv: o.advLv, maxHp: hs.maxHp, hp: hs.maxHp, atk: hs.atk, def: hs.def, fx: hs.fx, gauge, skills: (o.skills || []).slice(0, 3), tactic: ATTACK_TACTICS.includes(o.tactic) ? o.tactic : 'auto', p, guard: null, flags: {} },
      enemy: e
    };
  }

  // ---------- ダメージ ----------
  function elemMult(e, el) { return el && e.weak === el ? 1.5 : 1; }
  function calcDamage(h, e, hits, o) {
    o = o || {};
    let raw = 0;
    hits.forEach(x => { raw += h.atk * x[0] * elemMult(e, x[1]); });
    const ig = o.ig || 0, def = e.def * (1 - ig);
    let v = raw * (o.temp || 1) * 100 / (100 + def);
    if (e.guarded && !o.igTG) v *= 0.6;
    if (e.brace) v *= 1 - e.brace;
    return Math.max(1, Math.floor(v));
  }
  function applyGuard(h, pct, n) {
    if (!h.guard || pct > h.guard.pct) h.guard = { pct, left: n };
    else if (pct === h.guard.pct) h.guard.left = Math.max(h.guard.left, n);
  }
  function healHero(h, frac, mult) {
    const want = Math.floor(h.maxHp * frac * (mult || 1)), real = Math.min(want, h.maxHp - h.hp);
    h.hp += real; return Math.max(0, real);
  }

  // 主人公の1行動（通常攻撃 or 技）。ゲージ消費・固有能力まで。+1ゲージ/敵行動は呼び出し側
  function heroAct(st, act, isCorrectNormal) {
    const h = st.hero, e = st.enemy, p = h.p, job = h.job, ev = { t: 'hero', act: act.t === 'skill' ? act.id : 'normal', dmg: 0, heal: 0 };
    const hx = h.fx || {};
    const mark = (cond, k) => { if (cond && !st.used[k]) { st.used[k] = 1; return true; } return false; };
    let hits, el = null, temp = 1, ig = 0, igTG = false, healFrac = 0, harmonized = false;
    if (act.t === 'normal') {
      el = job === 'magicknight' ? p.imbue : null;
      hits = [[1, el]];
      if (job === 'magicknight' && p.imbue && h.jobLv >= 15) temp *= 1.10;
      if (job === 'skyknight' && p.fly) temp *= (h.jobLv >= 15 ? 1.25 : 1.20);
      let follow = 0;
      if (job === 'shadow') follow = p.shadow * (h.jobLv >= 15 ? 0.25 : 0.2);
      if (follow) hits.push([follow, null]);
      ev.dmg = calcDamage(h, e, hits, { temp });
      e.hp = Math.max(0, e.hp - ev.dmg); e.brace = 0;
      if (job === 'shadow') p.shadow = Math.min(2, p.shadow + 1);
      if (job === 'ranger' && isCorrectNormal) p.aim = Math.min(3, p.aim + 1);
      ev.el = el;
    } else {
      const sk0 = D.SKILLS[act.id], own = sk0.job === job, sk = own ? eff(sk0, h.jobLv) : sk0;
      h.gauge -= sk.cost; st.cast[act.id] = (st.cast[act.id] || 0) + 1;
      const fx = own ? (sk.fx || []) : [], stack = own ? sk.stack : null;
      hits = sk.hits ? sk.hits.map(x => x.slice()) : [[sk.m, sk.el || null]];
      let guard = sk.guard ? sk.guard.slice() : null, heal = sk.heal || 0, atkDown = sk.atkDown || 0;
      ig = sk.ig || 0; igTG = !!sk.igTG;
      if (sk.prep && e.tele) hits = [[sk.prep, sk.el || null]];
      // 職固有（その職の技のときだけ）
      if (fx.includes('release')) { hits = [[sk.m, p.imbue]]; p.imbue = null; }
      if (fx.includes('rainbow')) hits = [[sk.m, e.weak || p.imbue || null]];
      if (fx.includes('weakEl3')) hits = [[sk.m, ['fire', 'ice', 'thunder'].includes(e.weak) ? e.weak : null]];
      if (fx.includes('meteor') && p.fly) { hits = [[3.0, null]]; p.fly = false; }
      else if (fx.includes('descend') && p.fly) { hits = [[4.8, null]]; guard = [0.4, 1]; p.fly = false; }
      const sc = stack ? p[stack.k] : 0;
      if (stack && stack.per && sc) hits.push([stack.per * sc, sk.el || null]);
      if (own && sk.igPerAim) ig = Math.min(1, sk.igPerAim * p.aim);
      if (fx.includes('starGuard')) guard = [0.20 + 0.10 * p.star, 1];
      if (fx.includes('starHeal')) heal = 0.20 + 0.05 * p.star;
      if (own && sk.sys) {
        const trig = fx.includes('harmonyAlways') ? true : (p.last && (p.last === '*' || p.last !== sk.sys));
        if (trig) { harmonized = true; temp *= (h.jobLv >= 15 ? 1.25 : 1.20); }
        p.last = sk.sys;
      }
      if (fx.includes('harmonyAlways')) { harmonized = true; if (temp === 1) temp *= (h.jobLv >= 15 ? 1.25 : 1.20); p.last = '*'; }
      // 忍術連携
      let comboHit = 0;
      const seal = (fx.find(f => f.startsWith('seal:')) || '').slice(5);
      if (seal && own) {
        if (p.seal && p.seal !== seal) {
          const pair = [p.seal, seal].sort().join('+');
          if (pair === 'fire+water') { if (!guard || guard[0] < 0.6) guard = [0.6, 1]; }
          else if (pair === 'thunder+water') comboHit = 0.6; else if (pair === 'fire+thunder') comboHit = 0.8;
          p.seal = null; if (h.jobLv >= 15) { ev.heal += healHero(h, 0.10, 1); }
        } else p.seal = seal;
      }
      if (fx.includes('sealBonus') && p.seal) { hits.push([0.8, null]); p.seal = null; }
      if (comboHit) hits.push([comboHit, null]);
      // 装備効果
      if (hx.elemAdd) hits.push([hx.elemAdd[1], hx.elemAdd[0]]);
      if (hx.firstSkill && hits.length && mark(true, 'firstSkill')) temp *= 1 + hx.firstSkill;
      if (hx.firstMulti && hits.length > 1 && mark(true, 'firstMulti')) temp *= 1 + hx.firstMulti;
      const dmgSkill = hits.some(x => x[0] > 0);
      if (dmgSkill) { ev.dmg = calcDamage(h, e, hits, { temp, ig, igTG }); e.hp = Math.max(0, e.hp - ev.dmg); e.brace = 0; }
      ev.hits = hits.length; ev.el = sk.el || null;
      if (heal) { ev.heal += healHero(h, heal, (1 + (hx.healBonus || 0)) * (harmonized && sk.sys ? (h.jobLv >= 15 ? 1.25 : 1.2) : 1)); }
      if (hx.firstHeal && dmgSkill && mark(true, 'firstHeal')) ev.heal += healHero(h, hx.firstHeal, 1);
      if (guard) applyGuard(h, guard[0], guard[1]);
      if (atkDown && (!e.atkDown || atkDown > e.atkDown.pct)) e.atkDown = { pct: atkDown, left: 1 };
      if (fx.some(f => f.startsWith('imbue:'))) p.imbue = fx.find(f => f.startsWith('imbue:')).slice(6);
      if (fx.includes('fly')) p.fly = true;
      if (fx.includes('meteor') || fx.includes('descend')) { /* 飛翔中なら上で着地済み。地上ならそのまま */ }
      if (stack && stack.use === 'all') p[stack.k] = 0;
      if (fx.includes('shadow2')) p.shadow = 2; else if (job === 'shadow') p.shadow = Math.min(2, p.shadow + 1);
    }
    if (hx.halfHeal && h.hp > 0 && h.hp <= h.maxHp / 2 && mark(true, 'halfHeal')) ev.heal += healHero(h, hx.halfHeal, 1);
    if (e.hp <= 0) { st.status = 'won'; ev.kill = true; }
    return ev;
  }

  // ---------- 敵の行動 ----------
  function enemyAction(e) { return e.pattern[e.pi % e.pattern.length]; }
  function incoming(h, e, a) {
    if (!a || (a.k !== 'atk' && a.k !== 'big')) return 0;
    const down = e.atkDown ? 1 - e.atkDown.pct : 1;
    return Math.max(1, Math.floor(e.atk * a.m * down * 100 / (100 + h.def)));
  }
  function totalReduce(h, firstUse) {
    const hx = h.fx || {};
    let keep = 1;
    if (h.guard && h.guard.left > 0) keep *= 1 - h.guard.pct;
    if (hx.reduce) keep *= 1 - hx.reduce;
    if (firstUse && hx.firstReduce) keep *= 1 - hx.firstReduce;
    return Math.min(REDUCE_CAP, 1 - keep);
  }
  function enemyAct(st) {
    const h = st.hero, e = st.enemy, a = enemyAction(e), ev = { t: 'enemy', k: a.k, name: a.n || null, dmg: 0 };
    e.pi++; e.count = 0; e.guarded = false;
    if (a.k === 'atk' || a.k === 'big') {
      const base = incoming(h, e, a), first = !st.used.firstHit; st.used.firstHit = 1;
      const red = totalReduce(h, first), gActive = h.guard && h.guard.left > 0;
      ev.dmg = Math.max(1, Math.floor(base * (1 - red))); ev.reduced = base - ev.dmg;
      if (e.atkDown) { e.atkDown.left--; if (e.atkDown.left <= 0) e.atkDown = null; }
      if (gActive) {
        h.guard.left--; if (h.guard.left <= 0) h.guard = null;
        if (h.job === 'paladin') { const was = h.p.shield; h.p.shield = Math.min(3, h.p.shield + 1); if (h.p.shield > was && h.jobLv >= 15) healHero(h, 0.05, 1); }
      }
      h.hp -= ev.dmg;
      if (h.hp <= 0) { h.hp = 0; st.status = 'retreat'; ev.down = true; }
    } else if (a.k === 'guard') e.guarded = true;
    else if (a.k === 'brace') e.brace = 0.25;
    e.tele = enemyAction(e).k === 'big';
    return ev;
  }

  // ---------- 自動技選択 ----------
  const TACTIC = { auto: { heal: 0.40, soft: 0.70, bigFrac: 0.40, pow: 1.0 }, attack: { heal: 0.25, soft: 0.50, bigFrac: 99, pow: 0.8 }, guard: { heal: 0.65, soft: 0.85, bigFrac: 0.25, pow: 1.0 } };
  function stackValue(h) {
    const p = h.p; return p.aim * 0.3 + p.shadow * 0.25 + p.shield * 0.4 + p.star * 0.3 + (p.seal ? 0.3 : 0) + (p.imbue ? 0.15 : 0) + (p.fly ? 0.2 : 0);
  }
  function preview(st, act, forceGauge) {
    const c = clone(st); if (forceGauge) c.hero.gauge = Math.max(c.hero.gauge, forceGauge);
    const ev = heroAct(c, act, true);
    return { st: c, ev };
  }
  function candidates(st) {
    const h = st.hero, list = [{ t: 'normal' }];
    h.skills.forEach(id => { const s = D.SKILLS[id]; if (s && s.cost <= h.gauge) list.push({ t: 'skill', id }); });
    return list;
  }
  // 返す: {act, why}。同じ状態では同じ結果。内部情報（未知の弱点）は使わない
  function chooseAction(st) {
    const h = st.hero, e = st.enemy, T = TACTIC[h.tactic] || TACTIC.auto, cands = candidates(st);
    const pv = cands.map(a => Object.assign({ act: a }, preview(st, a)));
    const costOf = x => x.act.t === 'skill' ? D.SKILLS[x.act.id].cost : 0;
    // 1. 倒し切れる最小消費
    const kills = pv.filter(x => x.ev.dmg >= e.hp);
    if (kills.length) { kills.sort((a, b) => costOf(a) - costOf(b) || b.ev.dmg - a.ev.dmg); return { act: kills[0].act, why: 'kill' }; }
    // 2. 予告された大技への防御
    if (e.tele) {
      const inc = incoming(h, e, enemyAction(e)), cur = totalReduce(h, !st.used.firstHit);
      if (inc * (1 - cur) >= h.hp || inc * (1 - cur) >= T.bigFrac * h.maxHp) {
        const gs = pv.filter(x => x.act.t === 'skill' && totalReduce(x.st.hero, !st.used.firstHit) > cur + 0.001).map(x => ({ x, r: totalReduce(x.st.hero, !st.used.firstHit) }));
        if (gs.length) { gs.sort((a, b) => b.r - a.r || b.x.ev.dmg - a.x.ev.dmg || costOf(a.x) - costOf(b.x)); return { act: gs[0].x.act, why: 'defend' }; }
      }
    }
    // 3. 回復
    if (h.hp / h.maxHp <= T.heal) {
      const hs = pv.filter(x => x.ev.heal > 0);
      if (hs.length) { hs.sort((a, b) => (b.ev.heal + b.ev.dmg * 0.3) - (a.ev.heal + a.ev.dmg * 0.3)); return { act: hs[0].act, why: 'heal' }; }
    }
    // 3b. 回復量を無駄にしない範囲での早めの回復（僧侶などが回復技・守り技を使わないままになるのを防ぐ。HPが soft 以下で、技が最大HPの15%以上を実際に回復できるとき）
    if (h.hp / h.maxHp <= T.soft) {
      const hs = pv.filter(x => x.act.t === 'skill' && x.ev.heal >= 0.15 * h.maxHp);
      if (hs.length) { hs.sort((a, b) => (b.ev.heal + b.ev.dmg * 0.3) - (a.ev.heal + a.ev.dmg * 0.3)); return { act: hs[0].act, why: 'heal-early' }; }
    }
    // 4. 攻撃（ゲージ1あたりの上乗せが大きいもの。連携・蓄積も価値に含める）
    const unit = Math.max(1, h.atk * 100 / (100 + e.def)), base = pv[0];
    const val = x => x.ev.dmg + stackValue(x.st.hero) * unit + x.ev.heal * 0.8 + guardValue(h, e, x.st.hero, unit);
    const baseV = val(base);
    if (h.gauge >= GAUGE_MAX) {  // ゲージが満タンなら、上乗せ分が最大のものを使う（取りこぼし防止）
      let top = null; pv.slice(1).forEach(x => { const g = val(x) - baseV; if (g > 0 && (!top || g > top.g)) top = { x, g }; });
      if (top) return { act: top.x.act, why: 'overflow' };
    }
    // 装備している技すべてを評価（まだゲージが足りない技も、足りたと仮定して）。ゲージ1あたりの上乗せ×わずかな大技ボーナス
    const rated = [];
    h.skills.forEach(id => {
      const sk = D.SKILLS[id]; if (!sk) return;
      const x = pv.find(q => q.act.id === id) || Object.assign({ act: { t: 'skill', id } }, preview(st, { t: 'skill', id }, sk.cost));
      const gain = val(x) - baseV; if (gain <= 0) return;
      rated.push({ id, cost: sk.cost, x, score: gain / Math.pow(sk.cost, T.pow) * (1 + 0.02 * sk.cost), afford: sk.cost <= h.gauge });
    });
    if (!rated.length) return { act: { t: 'normal' }, why: 'normal' };
    const top = Math.max(...rated.map(r => r.score));
    // 効率が近いものは、この戦闘で使った回数が少ない順（同数なら高コスト）に回す。同じ技の連打で他の技・固有能力が死なないようにする
    const pool = rated.filter(r => r.score >= top * 0.8).sort((a, b) => (st.cast[a.id] || 0) - (st.cast[b.id] || 0) || b.cost - a.cost || (a.id < b.id ? -1 : 1));
    const want = pool[0];
    if (want.afford) return { act: want.x.act, why: 'attack' };
    if (want.cost - h.gauge <= 4) return { act: { t: 'normal' }, why: 'save' };   // 大きな技のためにゲージをためる
    const aff = rated.filter(r => r.afford).sort((a, b) => b.score - a.score)[0];
    return aff ? { act: aff.x.act, why: 'attack' } : { act: { t: 'normal' }, why: 'normal' };
  }
  function guardValue(h0, e, h1, unit) {
    const g0 = h0.guard ? h0.guard.pct * h0.guard.left : 0, g1 = h1.guard ? h1.guard.pct * h1.guard.left : 0;
    const per = e.atk * 100 / (100 + h0.def);
    return Math.max(0, g1 - g0) * per * 0.9;
  }

  // ---------- 回答1つ分の進行 ----------
  function postCorrect(st, usedNormal) {
    const h = st.hero;
    h.gauge = Math.min(GAUGE_MAX, h.gauge + 1);
    if (h.job === 'starseer') h.p.star = Math.min(4, h.p.star + 1);
  }
  // ev: {kind:'basic'|'review', correct:boolean}。返り値: 出来事の配列
  function resolveAnswer(st, ev) {
    const out = [], h = st.hero, e = st.enemy;
    st.turn++;
    if (st.status === 'retreat') return out;
    if (st.status === 'won') { if (ev.correct) out.push({ t: 'explore' }); return out; }
    if (ev.correct) {
      const ch = chooseAction(st), a = heroAct(st, ch.act, true);
      a.why = ch.why; out.push(a);
      if (ev.kind === 'review') { const r = healHero(h, h.job === 'priest' && h.jobLv >= 3 ? 0.15 : 0.10, 1); if (r) { out.push({ t: 'heal', heal: r }); } }
      postCorrect(st, ch.act.t === 'normal');
      if (st.status === 'fight' && ev.kind === 'basic') {
        e.count++;
        if (e.count >= ACT_EVERY) { const x = enemyAct(st); out.push(x); }
      }
    } else if (ev.kind === 'basic') {
      const x = enemyAct(st); out.push(x);
    }
    return out;
  }
  function outcome(st) { return st.status === 'won' ? 'victory' : st.status === 'retreat' ? 'retreat' : 'continue'; }

  return { GAUGE_MAX, START_GAUGE, ACT_EVERY, REDUCE_CAP, baseStats, heroStats, eff, inheritable, recommendLoadout, validateLoadout, newBattle, calcDamage, heroAct, enemyAct, enemyAction, incoming, totalReduce, chooseAction, resolveAnswer, outcome, clone };
});
