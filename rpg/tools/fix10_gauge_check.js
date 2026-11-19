'use strict';
// 成長ゲージの表示値を、成長式（C.cum）から独立に計算し直して照合する。node rpg/tools/fix10_gauge_check.js
const fs = require('fs'), path = require('path'), C = require('../js/rpg-core.js');
const rows = [];
let bad = 0;
const kanji = s => (s || '').replace(/[\u3040-\u309f]+(?=[^\u3040-\u309f]|$)/g, m => m);   // ルビ読みつきの文字列はそのまま比較しない
for (const eng of ['chromium', 'webkit']) {
  const d = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'shots', 'fix10_reward', `fix10_${eng}_result.json`), 'utf8'));
  for (const vp of Object.keys(d.gauge)) for (const st of Object.keys(d.gauge[vp])) {
    const g = d.gauge[vp][st], xp = g.setup.xp, fn = C.NEED.base;
    const lv = C.jobLevel('warrior', xp), cap = lv.capped;
    const expLv = lv.lv, T = C.cum(fn, expLv), Tn = C.cum(fn, expLv + 1);
    const expRemain = cap ? null : Tn - xp, expPct = cap ? null : Math.round((xp - T) / (Tn - T) * 10000) / 100;
    const gotRemain = cap ? null : +((g.jobR.match(/あと\s*(\d+)/) || [])[1]);
    const errs = [];
    if (expLv !== g.setup.lvTo) errs.push(`Lv 期待${expLv} 設定${g.setup.lvTo}`);
    if (cap) { if (g.barShown !== false) errs.push('上限なのにゲージ表示'); if (!/上限/.test(g.jobR)) errs.push('上限表示なし'); }
    else {
      if (gotRemain !== expRemain) errs.push(`残り 期待${expRemain} 表示${gotRemain}`);
      if (Math.abs(g.barPct - expPct) > 0.01) errs.push(`幅 期待${expPct} 表示${g.barPct}`);
      if (!g.barShown) errs.push('ゲージ非表示');
    }
    if (errs.length) bad++;
    rows.push(`|${eng}|${vp}|${st}|${xp}|Lv${expLv}（T=${T}${cap ? '・上限' : '、次T=' + Tn}）|${cap ? '—' : expRemain}|${cap ? '—' : gotRemain}|${cap ? '非表示' : expPct + '%'}|${cap ? (g.barShown ? '表示' : '非表示') : g.barPct + '%'}|${errs.length ? 'NG ' + errs.join('／') : '一致'}|`);
  }
}
console.log('|エンジン|領域|状態|経験値E|到達Lv（累積T）|残り（式）|残り（画面）|幅（式）|幅（画面）|判定|\n|---|---|---|---|---|---|---|---|---|---|\n' + rows.join('\n'));
console.log(`\n不一致 ${bad} / ${rows.length}`);
process.exit(bad ? 1 : 0);
