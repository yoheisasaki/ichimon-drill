'use strict';
// 第3段のシミュレーション：本編→クリア後（試練・秘境6・孤島）。node rpg/tools/sim_post.js [正答率...]
// 職業経路：戦士→魔法使い→僧侶（基本Lv10）→魔法戦士・聖騎士（Lv20）→天翔騎士（試練後）。毎日2回。買い物は店売りの最上位のみ（強化・レア・固有は使わない＝保守的）
const D = require('../js/rpg-data.js'), W = require('../js/rpg-world.js'), SIM = require('./sim.js');
const accs = process.argv.slice(2).map(Number).filter(Boolean); if (!accs.length) accs.push(0.3, 0.6, 0.8, 1.0);
const path = ['warrior', 'mage', 'priest', 'magicknight', 'paladin', 'skyknight'];
const med = v => { v = v.filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : null; };
const rows = [];
accs.forEach(acc => {
  const runs = [1, 2, 3, 4, 5].map(seed => SIM.playJourney({ acc, days: 700, seed, jobPath: path, post: true }));
  const st = runs.map(r => r.stat);
  const q = id => med(st.map(s => s.questAdv && s.questAdv[id]));
  rows.push({
    acc, endAdv: med(st.map(s => s.endAdv)), endDay: med(st.map(s => s.endDay)),
    trialDay: med(st.map(s => s.trialDay && (s.trialDay.trial_wing || s.trialDay.trial_star))), trialAdv: q('trial_wing') || q('trial_star'),
    secretAdv: W.SECRET_IDS.map(id => q(id)).join('/'), islandAdv: q('island'), islandDay: med(st.map(s => s.questDone && s.questDone.island && s.questDone.island.day)),
    topLv: med(st.map(s => s.final.jobs.skyknight)), advLv: med(st.map(s => s.final.advLv)), coins: med(st.map(s => s.final.coins)), retreat: +(st.reduce((a, s) => a + s.retreats, 0) / st.reduce((a, s) => a + s.adv, 0)).toFixed(3),
    done: runs.filter(r => r.stat.questDone && r.stat.questDone.island).length + '/5'
  });
});
console.log(JSON.stringify(rows, null, 1));
