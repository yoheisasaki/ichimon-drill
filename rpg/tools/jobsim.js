'use strict';
// 全12職の自動戦闘を固定seedで回し、技の使用頻度・討伐速度・生存を集計する。node rpg/tools/jobsim.js [--json]
const D = require('../js/rpg-data.js'), C = require('../js/rpg-core.js'), B = require('../js/rpg-battle.js');

const WEAPON_CAT = job => D.JOBS[job].weapons[0];
// 職ごとの代表装備（ランク r の武器・防具）。r: 1..3
function equipFor(job, r) { return { weapon: `w_${WEAPON_CAT(job)}_${r}`, armor: `a_heavy_${r}`, acc: `x_charm_${r}` }; }
// 職業レベル lv で他の基本職は 10、上級職は 20 として継承・解放を満たした想定
function jobsAt(job, lv) { const o = {}; D.JOB_IDS.forEach(j => { o[j] = D.JOBS[j].tier === 'base' ? 10 : 1; }); o[job] = lv; return o; }
const LEVEL_OF = { base: 10, adv: 20, top: 20 };

function fight(job, jobLv, advLv, g, acc, seed, tactic, skills) {
  const rng = C.rngFrom(seed), route = D.ROUTE[g], jobs = jobsAt(job, jobLv);
  const rank = g < 24 ? 1 : g < 48 ? 2 : 3;
  const st = B.newBattle({ job, jobLv, advLv, equip: equipFor(job, rank), skills: skills || B.recommendLoadout(job, jobs), tactic: tactic || 'auto', enemyId: route.enemy, enemyStats: route.stats });
  const use = {}, why = {}; let nCorrect = 0, answers = 0, dmgTaken = 0, pendingRev = 0;
  for (let i = 0; i < 10; i++) {
    const ok = rng() < acc; answers++;
    const ev = B.resolveAnswer(st, { kind: 'basic', correct: ok });
    ev.forEach(e => { if (e.t === 'hero') { use[e.act] = (use[e.act] || 0) + 1; why[e.why] = (why[e.why] || 0) + 1; nCorrect++; } });
    if (!ok) pendingRev++;
  }
  for (let i = 0; i < Math.min(5, pendingRev); i++) { const ev = B.resolveAnswer(st, { kind: 'review', correct: rng() < Math.min(.95, acc + .25) }); ev.forEach(e => { if (e.t === 'hero') { use[e.act] = (use[e.act] || 0) + 1; why[e.why] = (why[e.why] || 0) + 1; } }); }
  return { st, use, why, win: st.status === 'won', retreat: st.status === 'retreat', hpLeft: st.hero.hp / st.hero.maxHp, enemyLeft: st.enemy.hp / st.enemy.maxHp };
}
function jobReport(job, lvls, opts) {
  opts = opts || {};
  const rows = [];
  for (const jobLv of lvls) {
    const agg = { use: {}, win: 0, retreat: 0, n: 0, hp: 0, why: {}, enemyLeft: 0 };
    const advLv = Math.max(5, Math.min(40, Math.round(jobLv * 0.9 + 8)));
    [24, 36, 50, 62, 21, 45, 69].forEach(g => {
      for (let seed = 1; seed <= 25; seed++) {
        const r = fight(job, jobLv, advLv, g, opts.acc || (seed % 2 ? 0.5 : 0.8), `${job}:${jobLv}:${g}:${seed}`, opts.tactic, opts.skills);
        agg.n++; agg.win += r.win; agg.retreat += r.retreat; agg.hp += r.hpLeft; agg.enemyLeft += r.enemyLeft;
        Object.keys(r.use).forEach(k => { agg.use[k] = (agg.use[k] || 0) + r.use[k]; });
        Object.keys(r.why).forEach(k => { agg.why[k] = (agg.why[k] || 0) + r.why[k]; });
      }
    });
    rows.push({ job, jobLv, win: +(agg.win / agg.n).toFixed(2), retreat: +(agg.retreat / agg.n).toFixed(2), hpLeft: +(agg.hp / agg.n).toFixed(2), use: agg.use, why: agg.why });
  }
  return rows;
}
module.exports = { fight, jobReport, equipFor, jobsAt, LEVEL_OF };

if (require.main === module) {
  const all = [];
  D.JOB_IDS.forEach(j => { const t = D.JOBS[j].tier, lvls = t === 'base' ? [5, 10, 20, 30] : [10, 20, 30]; jobReport(j, lvls).forEach(r => all.push(r)); });
  if (process.argv.includes('--json')) console.log(JSON.stringify(all));
  else all.forEach(r => {
    const tot = Object.values(r.use).reduce((a, b) => a + b, 0) || 1;
    const u = Object.entries(r.use).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k === 'normal' ? '通常' : D.SKILLS[k].name}${Math.round(v / tot * 100)}%`).join(' ');
    console.log(`${D.JOBS[r.job].name} Lv${r.jobLv} 勝${r.win} 撤${r.retreat} HP残${r.hpLeft} | ${u}`);
  });
}
