'use strict';
// 試験用セーブ6つを作る（決定的シミュレーション。正答率70%・毎日2回・seed 1）。node rpg/tools/make_saves.js
// 初日／14日／第1章末／第2章末／本編末／クリア後（試練・秘境6・孤島まで）。tests/saves/*.json と、確認用の数値 baseline/saves_report_20261118.json
const fs = require('fs'), path = require('path');
const D = require('../js/rpg-data.js'), W = require('../js/rpg-world.js'), C = require('../js/rpg-core.js'), M = require('../js/rpg-meta.js'), SIM = require('./sim.js');
const PATH = ['warrior', 'mage', 'priest', 'magicknight', 'paladin', 'skyknight'];
const specs = {
  day01: { days: 1 }, day14: { days: 14 }, ch1end: { days: 300, stopAtCh1: true }, ch2end: { days: 400, stopAtCh2: true },
  maingoal: { days: 500, stopAtEnd: true }, postgame: { days: 700, post: true }
};
const dir = path.join(__dirname, '..', 'tests', 'saves'); fs.mkdirSync(dir, { recursive: true });
const report = {};
Object.keys(specs).forEach(name => {
  const r = SIM.playJourney(Object.assign({ acc: 0.7, seed: 1, jobPath: PATH }, specs[name])), s = M.ensure(r.save), st = r.stat;
  s.active = null; s.name = ''; s.lastResult = null;
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(s));
  const jl = C.jobLevels(s);
  report[name] = {
    days: st.days, adventures: s.stats.adventures, heroLv: C.heroLevel(s.advXp).lv, advXp: s.advXp, job: s.job,
    jobLv: Object.fromEntries(D.JOB_IDS.filter(j => jl[j] > 1).map(j => [j, jl[j]])), coins: s.coins, maxRank: C.maxRank(s), clearedRegions: s.progress.clearedRegions.length,
    kills: Object.values(s.codex.enemies).reduce((a, e) => a + e.kills, 0), items: Object.keys(s.inv.items).length, rare: Object.keys(s.inv.items).filter(i => D.ITEMS[i].rarity === 'rare').length,
    quests: Object.fromEntries(Object.keys(s.quests).filter(k => s.quests[k].cleared).map(k => [k, 1])), trials: s.trials, retreats: st.retreats, questAdv: st.questAdv || null
  };
});
fs.writeFileSync(path.join(__dirname, '..', 'baseline', 'saves_report_20261118.json'), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
