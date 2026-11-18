'use strict';
// 全3章（300冒険）の決定的シミュレーション。node rpg/tools/sim_full.js [正答率...]  毎日2回・戦士→魔法使い→魔法戦士・買い物は店売りの最上位（強化・レア装備は使わない＝保守的）
const D = require('../js/rpg-data.js'), SIM = require('./sim.js');
const accs = process.argv.slice(2).map(Number).filter(Boolean); if (!accs.length) accs.push(0.3, 0.6, 0.8, 1.0);
const med = v => { v = v.filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
const out = [];
accs.forEach(acc => {
  const runs = [1, 2, 3, 4, 5].map(seed => SIM.playJourney({ acc, days: 500, seed, jobPath: ['warrior', 'mage', 'magicknight'], stopAtEnd: true }).stat);
  const perReg = D.REGIONS.map(r => { const v = runs.map(x => x.reg[r.name]).filter(Boolean); const avg = f => v.length ? +(v.reduce((s, g) => s + f(g), 0) / v.length).toFixed(1) : null; return { name: r.name, norm: avg(g => g.norm), boss: avg(g => g.boss), kills: avg(g => g.normKills) }; });
  out.push({ acc, done: runs.filter(r => r.endDay).length + '/5', ch1Adv: med(runs.map(r => r.ch1Adv)), ch2Adv: med(runs.map(r => r.ch2Adv)), endAdv: med(runs.map(r => r.endAdv)), endDay: med(runs.map(r => r.endDay)), retreat: +(runs.reduce((s, r) => s + r.retreats, 0) / runs.reduce((s, r) => s + r.adv, 0)).toFixed(3), advLv: runs.map(r => r.final.advLv), perReg });
});
console.log(JSON.stringify(out.map(o => Object.assign({}, o, { perReg: undefined })), null, 1));
if (process.argv.includes('--regions') || true) out.forEach(o => { console.log('acc', o.acc, o.perReg.map(r => `${r.name}:${r.norm}+${r.boss}`).join(' ')); });
