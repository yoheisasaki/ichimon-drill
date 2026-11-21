// 習っていない漢字のルビの抜け検査。node tools/kanji_ruby_audit.js [--dict]
//  対象：息子用の問題画面の社会・理科（国語は付けない）。表示される文字（問題・選択肢・解説・単元・地図の見出し）に、{漢字|よみ} の外で辞書に無い「習っていない漢字」が残っていないかを出す。
//  --dict：辞書の全語（表記→読み）を並べる（目で確かめる用）
const fs = require('fs'), path = require('path');
const KR = require('../kanji-ruby.js');
const root = path.join(__dirname, '..');
const d = JSON.parse(fs.readFileSync(path.join(root, 'data', 'questions.json'), 'utf8'));
if (process.argv.includes('--dict')) { KR.DICT.forEach(([k, r]) => console.log(k + '\t' + r)); console.log('語数', KR.DICT.length); }
console.log('1〜3年の漢字', KR.KNOWN.size, '字');
const miss = {};
d.questions.filter(q => q.subject !== '国語').forEach(q => {
  const map = q.map ? ('地図：' + (q.map.hl && q.map.mark ? q.map.hl + 'の' + q.map.mark : (q.map.hl || q.map.mark || ''))) : '';
  const fields = [q.q, q.exp, q.unit, map].concat(q.choices || []).concat(q.type === 'input' ? [] : [q.a]);
  fields.filter(Boolean).forEach(f => KR.uncovered(f).forEach(c => { (miss[c] = miss[c] || new Set()).add(q.id); }));
});
const ks = Object.keys(miss);
console.log('辞書に無い習っていない漢字', ks.length, '字');
ks.forEach(c => console.log('  ' + c + '  ' + Array.from(miss[c]).slice(0, 5).join(',')));
process.exit(ks.length ? 1 : 0);
