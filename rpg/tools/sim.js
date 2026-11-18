'use strict';
// 決定的シミュレーション。使い方: node rpg/tools/sim.js [--json]
// 正答率ごとに「毎日2回・基本10問」を固定seedで回し、成長・資金・討伐・クリア回数を集計する（第1章のみ）
const D = require('../js/rpg-data.js'), C = require('../js/rpg-core.js'), A = require('../js/rpg-adventure.js'), B = require('../js/rpg-battle.js');

const DAY = 86400e3, T0 = Date.UTC(2026, 10, 18, -9 + 9, 0, 0);  // 日本時間 2026-11-18 09:00 相当
function buyPolicy(save, jobOrder) {
  const job = save.job, wt = D.JOBS[job].weapons;
  const tryBuy = (slot, ids) => {
    // ランクの高い順に買えるものを買って装着
    for (const id of ids) { if (!save.inv.items[id] && !C.canBuy(save, id)) { C.buy(save, id); break; } }
  };
  const r = C.maxRank(save);
  const ranks = []; for (let k = r; k >= 1; k--) ranks.push(k);
  const wcat = wt[0];
  tryBuy('weapon', ranks.map(k => `w_${wcat}_${k}`));
  tryBuy('armor', ranks.map(k => `a_heavy_${k}`));
  tryBuy('acc', ranks.map(k => `x_charm_${k}`));
  ['weapon', 'armor', 'acc'].forEach(s => { const b = C.bestOwned(save, s, job); if (b) save.equip[s] = b; });
}
function chooseJob(save, order) {
  const lv = C.jobLevels(save);
  for (const j of order) { if (lv[j] < 10 || D.JOBS[j].tier !== 'base') { if (!C.canChangeJob(save, j) || j === save.job) return j; } }
  return save.job;
}
// opts: {acc, days, seed, jobPath:[...]}
function playJourney(opts) {
  const rng = C.rngFrom('sim:' + opts.seed + ':' + opts.acc), save = C.newSave(T0);
  const stat = { step: {}, reg: {}, days: 0, adv: 0, wins: 0, retreats: 0, continues: 0, coinsEarned: 0, ch1Day: null, regionDay: {}, bossAdv: {}, killAdv: [], skillUse: {}, whyCount: {}, minHpFrac: 1, firstEnemyAdvs: null };
  const path = opts.jobPath;
  let qn = 0;
  for (let d = 0; d < opts.days; d++) {
    const dayMs = T0 + d * DAY;
    for (let s = 0; s < 2; s++) {
      const ms = dayMs + s * 3600e3;
      if (!save.active) {
        // 転職（冒険の合間）
        const want = chooseJob(save, path); if (want !== save.job && !C.canChangeJob(save, want)) { save.job = want; save.loadout.skills = null; }
        buyPolicy(save, path);
      }
      const a = A.begin(save, ms);
      const enemyAtStart = a.enemyId;
      let queue = [], killC = null; // 復習待ち
      for (let i = 0; i < 10; i++) {
        const ok = rng() < opts.acc; qn++;
        const r = A.recordAnswer(save, { rid: 'q' + qn, kind: 'basic', correct: ok, qid: 'q' }, ms);
        r.events.forEach(ev => { if (ev.t === 'hero') { const rg0 = (stat.reg[D.REGIONS[a.route.region].name] = stat.reg[D.REGIONS[a.route.region].name] || { norm: 0, boss: 0, normKills: 0, cAtKill: [], dmg: 0, acts: 0, hp: 0, def: 0, atk: 0, n: 0 }); rg0.dmg += ev.dmg; rg0.acts++; { const st0 = stat.step[a.step] = stat.step[a.step] || { d: 0, n: 0, hp: 0, atk: 0, def: 0, m: 0 }; st0.d += ev.dmg; st0.n++; st0.hp += a.battle.hero.maxHp; st0.atk += a.battle.hero.atk; st0.def += a.battle.hero.def; st0.m++; } stat.skillUse[a.hero.job + ':' + ev.act] = (stat.skillUse[a.hero.job + ':' + ev.act] || 0) + 1; } if (ev.why) stat.whyCount[ev.why] = (stat.whyCount[ev.why] || 0) + 1; if (ev.kill && killC == null) killC = a.basic.c; });
        const hf = a.battle.hero.hp / a.battle.hero.maxHp; if (hf < stat.minHpFrac) stat.minHpFrac = hf;
        if (!ok && A.queueReview(save, r.origin, null)) queue.push(r.origin);
      }
      // 復習（成功率は少し高い）
      let guard = 0;
      while (queue.length && guard++ < 50) {
        const o = queue.shift(), ok = rng() < Math.min(0.95, opts.acc + 0.25); qn++;
        { const rr = A.recordAnswer(save, { rid: 'q' + qn, kind: 'review', correct: ok, origin: o }, ms); rr.events.forEach(ev => { if (ev.kill && killC == null) killC = a.basic.c + a.reviews.ok.length; }); }
        if (!ok && A.queueReview(save, o, null)) queue.push(o);
        else if (!ok) { save.active.reviews.pending = save.active.reviews.pending.filter(p => p.origin !== o); }
      }
      const res = A.settle(save, ms);
      { const rg = stat.reg[res.region] = stat.reg[res.region] || { norm: 0, boss: 0, normKills: 0, cAtKill: [], dmg: 0, acts: 0, hp: 0, def: 0, atk: 0, n: 0 };
        if (res.enemy.boss) rg.boss++; else { rg.norm++; if (res.outcome === 'victory') { rg.normKills++; rg.cAtKill.push(killC); } } }
      stat.adv++; stat.coinsEarned += res.coin;
      if (res.outcome === 'victory') { stat.wins++; stat.killAdv.push(stat.adv); if (res.enemy.boss) { stat.regionDay[res.region] = d + 1; } }
      else if (res.outcome === 'retreat') stat.retreats++; else stat.continues++;
      if (save.progress.step >= D.ROUTE.length && stat.ch1Day == null) { stat.ch1Day = d + 1; stat.ch1Adv = stat.adv; }
    }
    stat.days = d + 1;
    if (opts.stopAtCh1 && save.progress.step >= D.ROUTE.length) break;
  }
  stat.final = { advLv: C.heroLevel(save.advXp).lv, advXp: save.advXp, jobs: C.jobLevels(save), coins: save.coins, job: save.job, step: save.progress.step, rank: C.maxRank(save), items: Object.keys(save.inv.items).length, pity: save.chest.pity };
  return { stat, save };
}
module.exports = { playJourney, T0, DAY };

if (require.main === module) {
  const path = ['warrior', 'mage', 'magicknight'];
  const out = [];
  for (const acc of [0.3, 0.6, 0.8, 1.0]) {
    const runs = [1, 2, 3, 4, 5].map(seed => playJourney({ acc, days: 150, seed, jobPath: path, stopAtCh1: true }).stat);
    const med = f => { const v = runs.map(f).filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
    const row = { acc, ch1Done: runs.filter(r => r.ch1Day).length + '/5', ch1AdvMed: med(r => r.ch1Adv), ch1DayMed: med(r => r.ch1Day), winsPerAdv: +(runs.reduce((s, r) => s + r.wins, 0) / runs.reduce((s, r) => s + r.adv, 0)).toFixed(2), retreatRate: +(runs.reduce((s, r) => s + r.retreats, 0) / runs.reduce((s, r) => s + r.adv, 0)).toFixed(2), advLv: med(r => r.final.advLv), coins: med(r => r.final.coins), minHp: +Math.min(...runs.map(r => r.minHpFrac)).toFixed(2) };
    out.push(row);
  }
  console.log(JSON.stringify(out, null, 1));
}

if (require.main === module && process.argv.includes('--regions')) {
  const acc = +(process.argv[process.argv.indexOf('--regions') + 1] || 0.7);
  const runs = [1, 2, 3, 4, 5, 6, 7, 8].map(seed => playJourney({ acc, days: 150, seed, jobPath: ['warrior', 'mage', 'magicknight'], stopAtCh1: true }).stat);
  const names = D.REGIONS.map(r => r.name);
  console.log('acc', acc, '地域 | 道中の冒険数(平均/9体) | ボス冒険数(平均) | 道中討伐までの正解数(中央値)');
  names.forEach(n => {
    const avg = f => (runs.reduce((s, r) => s + (r.reg[n] ? f(r.reg[n]) : 0), 0) / runs.length).toFixed(1);
    const all = [].concat(...runs.map(r => r.reg[n] ? r.reg[n].cAtKill : [])).sort((a, b) => a - b);
    console.log(n, '|', avg(g => g.norm), '|', avg(g => g.boss), '|', all[Math.floor(all.length / 2)], '| 1行動あたり与ダメ', avg(g => g.acts ? g.dmg / g.acts : 0), '主人公HP/攻/防', avg(g => g.n ? g.hp / g.n : 0), avg(g => g.n ? g.atk / g.n : 0), avg(g => g.n ? g.def / g.n : 0));
  });
  console.log('合計冒険数(平均)', (runs.reduce((s, r) => s + r.adv, 0) / runs.length).toFixed(1), 'レベル', runs.map(r => r.final.advLv).join(','));
}

if (require.main === module && process.argv.includes('--steps')) {
  const acc = +(process.argv[process.argv.indexOf('--steps') + 1] || 0.7);
  const runs = [1, 2, 3, 4, 5, 6].map(seed => playJourney({ acc, days: 150, seed, jobPath: ['warrior', 'mage', 'magicknight'], stopAtCh1: true }).stat);
  const rows = [];
  for (let st = 0; st < 72; st++) {
    let d = 0, n = 0, hp = 0, atk = 0, def = 0, m = 0;
    runs.forEach(r => { const x = r.step[st]; if (x) { d += x.d; n += x.n; hp += x.hp; atk += x.atk; def += x.def; m += x.m; } });
    rows.push([st, n ? +(d / n).toFixed(1) : null, m ? Math.round(hp / m) : null, m ? Math.round(atk / m) : null, m ? +(def / m).toFixed(1) : null]);
  }
  console.log('step,avgDmgPerAction,heroHp,heroAtk,heroDef'); rows.forEach(r => console.log(r.join(',')));
}
