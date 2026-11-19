'use strict';
// app.js と list.js の共通部分（送信先・ママの設定・まとまり・ふりがな）
// 送信先（学習ボードの Apps Script Webアプリ）
const SEND_URL = 'https://script.google.com/macros/s/AKfycbwR6PPGrKn5HL1yJ8-xc_sjV-kaEDY2dv0jD_e7XyRSjQUd2E_2_Pq-rGE6tWxHRj3QFg/exec';
const PARAMS = new URLSearchParams(location.search);
const SEND_OVERRIDE = PARAMS.get('send'); // テスト用：送信先を差し替え
const CONF_OVERRIDE = PARAMS.get('conf'); // テスト用：ママの設定（conf）の読み先を差し替え（JSONを返すURL）
// 「まとまり」：unit → まとまり名。ここに無い unit は unit 名のまま（「地図：◯県」は「◯県」）
const GROUP_OF = {
  '地図：栃木県': '栃木・群馬', '地図：群馬県': '栃木・群馬',
  '地図：茨城県': '茨城・千葉', '地図：千葉県': '茨城・千葉',
  '地図：東京都': '東京・神奈川', '地図：神奈川県': '東京・神奈川',
  '地図：山梨県': '山梨・静岡・埼玉', '地図：静岡県': '山梨・静岡・埼玉', '地図：埼玉県': '山梨・静岡・埼玉',
  '地図：石川県': '石川・福井', '地図：福井県': '石川・福井'
};
// まとまり名のふりがな（無いものはそのまま）
const GROUP_RUBY = {
  '漢字': '{漢字|かんじ}', '漢字の読み': '{漢字|かんじ}の{読|よ}み', '熟語': '{熟語|じゅくご}', '対義語': '{対義語|たいぎご}', '物語文': '{物語文|ものがたりぶん}',
  '慣用句': '{慣用句|かんようく}', '四字熟語': '{四字熟語|よじじゅくご}',
  '鳥のなかま': '{鳥|とり}のなかま', '動物のなかま分け': '{動物|どうぶつ}のなかま{分|わ}け', '光と鏡': '{光|ひかり}と{鏡|かがみ}',
  '人のからだ': '{人|ひと}のからだ', '季節の植物': '{季節|きせつ}の{植物|しょくぶつ}',
  '栃木・群馬': '{栃木|とちぎ}・{群馬|ぐんま}', '茨城・千葉': '{茨城|いばらき}・{千葉|ちば}',
  '東京・神奈川': '{東京|とうきょう}・{神奈川|かながわ}', '山梨・静岡・埼玉': '{山梨|やまなし}・{静岡|しずおか}・{埼玉|さいたま}',
  '石川・福井': '{石川|いしかわ}・{福井|ふくい}', '県庁所在地': '{県庁所在地|けんちょうしょざいち}',
  '栃木県': '{栃木|とちぎ}{県|けん}', '群馬県': '{群馬|ぐんま}{県|けん}', '茨城県': '{茨城|いばらき}{県|けん}', '千葉県': '{千葉|ちば}{県|けん}',
  '東京都': '{東京|とうきょう}{都|と}', '神奈川県': '{神奈川|かながわ}{県|けん}', '山梨県': '{山梨|やまなし}{県|けん}', '静岡県': '{静岡|しずおか}{県|けん}',
  '埼玉県': '{埼玉|さいたま}{県|けん}', '石川県': '{石川|いしかわ}{県|けん}', '福井県': '{福井|ふくい}{県|けん}'
};
function groupOf(q) {
  const u = q.unit || '';
  return GROUP_OF[u] || u.replace(/^地図：/, '') || 'そのほか';
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function ruby(s) { return esc(s).replace(/\{([^|{}]+)\|([^{}]+)\}/g, '<ruby>$1<rt>$2</rt></ruby>'); }
function plain(s) { return String(s).replace(/\{([^|{}]+)\|([^{}]+)\}/g, '$1'); }


// ---------- ママの設定（今回のテスト対策・今回は出さない・問題の直し） ----------
// 保存先は学習ボード。読めたら localStorage に写しておき、読めないときはその写しを使う。
const CONF_LS = 'ichimon.conf.v1', CONF_WAIT = 5000;
function emptyConf() { return { pick: [], off: [], edit: {} }; }
function cleanConf(c) {
  const o = emptyConf();
  if (!c || typeof c !== 'object') return o;
  if (Array.isArray(c.pick)) o.pick = c.pick.map(String);
  if (Array.isArray(c.off)) o.off = c.off.map(String);
  if (c.edit && typeof c.edit === 'object' && !Array.isArray(c.edit)) Object.keys(c.edit).forEach(id => { const e = c.edit[id]; if (e && typeof e.q === 'string' && typeof e.a === 'string') o.edit[id] = e; });
  return o;
}
function confCacheGet() { try { const v = localStorage.getItem(CONF_LS); return v ? cleanConf(JSON.parse(v)) : null; } catch (e) { return null; } }
function confCachePut(c) { try { localStorage.setItem(CONF_LS, JSON.stringify(c)); } catch (e) {} }
// 5秒待っても来なければあきらめて前回の写し（無ければ空）。必ず解決する（失敗しない）
function loadConf() {
  const url = CONF_OVERRIDE || (SEND_OVERRIDE || SEND_URL) + '?api=ichimon_conf';
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = setTimeout(() => { if (ctl) ctl.abort(); }, CONF_WAIT);
  const fallback = () => confCacheGet() || emptyConf();
  const get = fetch(url, ctl ? { cache: 'no-cache', signal: ctl.signal } : { cache: 'no-cache' }).then(r => r.json()).then(j => {
    if (!j || !j.ok || !j.conf) throw new Error('conf');
    const c = cleanConf(j.conf); confCachePut(c); return c;
  }).catch(fallback);
  const limit = new Promise(res => setTimeout(() => res(fallback()), CONF_WAIT + 200));
  return Promise.race([get, limit]).then(c => { clearTimeout(timer); return c; });
}
// edit を重ねた問題の一覧を返す（元の配列・問題は書き換えない）。問題IDは変えない
function applyEdits(questions, conf) {
  return questions.map(q => {
    const e = conf.edit[q.id];
    if (!e) return q;
    const n = Object.assign({}, q, { q: e.q, a: e.a });
    if (q.type === 'input') n.accept = Array.isArray(e.accept) && e.accept.length ? e.accept.map(String) : [plain(e.a)];
    else n.choices = Array.isArray(e.choices) ? e.choices.map(String) : q.choices;
    return n;
  });
}
