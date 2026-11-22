'use strict';
// 送信先（SEND_URL）・PARAMS・SEND_OVERRIDE・ママの設定の読み込みは common.js
const MAMA = PARAMS.get('mama') === '1' || /mama\.html$/.test(location.pathname); // ママモード：送信せず、保存キーも別名
const NOSEND = PARAMS.get('nosend') === '1' || MAMA;
const ROUND = 10, MASTER = 3, REASK_GAP = 3, REASK_MAX = 5, BATCH = 200;
const SUBJECTS = ['国語', '算数', '理科', '社会'];
const LS_SFX = MAMA ? '.mama' : '';
const LS_DAILY = 'ichimon.daily.v1' + LS_SFX;
const LS_STATS = 'ichimon.stats.v1' + LS_SFX, LS_Q = 'ichimon.queue.v1' + LS_SFX, LS_DEV = 'ichimon.dev.v1' + LS_SFX, LS_SEL = 'ichimon.sel.v1' + LS_SFX;
// ---------- 保存（localStorage。使えなくても動く） ----------
const mem = {};
function lsGet(k) { try { const v = localStorage.getItem(k); return v === null ? (mem[k] ?? null) : v; } catch (e) { return mem[k] ?? null; } }
function lsSet(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} }
function load(k, d) { try { const v = lsGet(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function save(k, v) { lsSet(k, JSON.stringify(v)); }

let dev = lsGet(LS_DEV);
if (!dev) { dev = Array.from({ length: 16 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join(''); lsSet(LS_DEV, dev); }
let stats = load(LS_STATS, {});   // qid -> {w:まちがい回数, c:正解回数, s:続けて正解, l:最後の結果('o'|'x'), t:最後の日時}
let queue = load(LS_Q, { seq: 0, rows: [] });

// ---------- ふりがな ----------
// ---------- データ ----------
let DATA = null, current = null, filter = '全部', CONF = emptyConf(), OFF = new Set();
let units = {}; // 教科 -> 選んだまとまり（空＝ぜんぶまぜる）
(function () { const v = load(LS_SEL, null); if (v && typeof v === 'object') { if (typeof v.filter === 'string') filter = v.filter; if (v.units && typeof v.units === 'object') units = v.units; } })();
function saveSel() { save(LS_SEL, { filter, units }); }
function groupsOf(subject) {
  const seen = [];
  qs().filter(q => q.subject === subject).forEach(q => { const g = groupOf(q); if (!seen.includes(g)) seen.push(g); });
  return seen;
}
let S = null; // 回の状態
const app = document.getElementById('app');
// 子ども画面の「更新」。学習記録とRPGの保存データは消さずに最新版を読み込む。
// HTMLとapp.jsには更新時だけ新しいURLを使って、古いキャッシュを避ける。
async function refreshKidApp() {
  const btn = document.getElementById('kid-refresh');
  if (btn) { btn.disabled = true; btn.textContent = '更新中…'; }
  try { await flush(); } catch (e) { /* 未送信の記録は端末内のキューに残る */ }
  const url = new URL(location.href);
  url.searchParams.set('refresh', Date.now().toString());
  location.replace(url.toString());
}

// 11/28 マンスリー直前の重点問題。問題データ本体は削除しない。
// ?all=1 で全問題に戻せる（例: mama.html?all=1）。
const FOCUS_IDS = new Set(["ri-0004","ri-0018","ri-0019","ri-0033","ri-0036","ri-0042","ri-0061","ri-0062","ri-0063","ri-0064","ri-0065","sha-0020","sha-0023","sha-0029","sha-0035","sha-0040","sha-0054","sha-0055","sha-0056","sha-0057","sha-0059","sha-0060","sha-0063","sha-0064","sha-0066","sha-0067","sha-0201","sha-0202","koku-0014","koku-0015","koku-0042","koku-0057","koku-0061","koku-0201","koku-0202","koku-0205","map-0001","map-0009","map-0011","ri-0058","koku-0241","koku-0242","koku-0243","ri-0066","ri-0067","ri-0068","ri-0069","ri-0070","ri-0071","ri-0072","ri-0073","ri-0074","ri-0075","sha-0301","sha-0302","sha-0303","sha-0304","sha-0305","sha-0306","sha-0307","sha-0308","sha-0309","sha-0310","sha-0311","sha-0312","sha-0313","sha-0314","sha-0315","sha-0316","sha-0317","sha-0318","sha-0319","sha-0320","sha-0321","sha-0322","sha-0323","sha-0324","sha-0325","sha-0326","sha-0327","sha-0328","sha-0329","sha-0330","sha-0331","sha-0332","sha-0333","sha-0334","sha-0335","sha-0336","sha-0337","sha-0338","sha-0339","sha-0340","sha-0341","sha-0342","sha-0343","sha-0344","sha-0345","sha-0346","sha-0347","sha-0348","sha-0349","sha-0350","sha-0351","sha-0352","sha-0353","map-0015","map-0020","map-0021","map-0022","map-0029","map-0030","map-0032","map-0035","map-0036","map-0041","map-0042","map-0044","map-0045","map-0051","map-0052","map-0053","map-0059","map-0060","map-0062","map-0065","map-0012","map-0013","map-0014","map-0023","map-0024","map-0025","map-0027","map-0028","map-0031","map-0033","map-0038","map-0039","map-0040","map-0043","map-0047","map-0048","map-0050","map-0054","map-0056","map-0057","map-0058","map-0061","map-0064","map-0066","map-0016","map-0017","map-0026","map-0049","map-0055","map-0034","map-0063","map-0068","sha-0032"]);
// 最新の地図直し（群馬・山梨）を優先。既存の地図問題を再利用し、重複追加しない。
const MAP_REVIEW_FIRST_IDS = ["map-0009","map-0001"];
// 音の高さ・波形の新規10問も、通常出題の最初に一度ずつ優先する。
const SOUND_FIRST_IDS = ["ri-0076","ri-0077","ri-0078","ri-0079","ri-0080","ri-0081","ri-0082","ri-0083","ri-0084","ri-0085"];
SOUND_FIRST_IDS.forEach(id => FOCUS_IDS.add(id));
// p40で間違い・未回答だったところの復習8問（既存4問＋新規4問）。
const SOUND_WEAK_IDS = ["ri-0086","ri-0087","ri-0088","ri-0089","ri-0090","ri-0091","ri-0092","ri-0093"];
SOUND_WEAK_IDS.forEach(id => FOCUS_IDS.add(id));
// 社会・授業動画の追加14問は全問残す。直近の理科の間違いと社会第8回を先に出す。
const SOCIAL_VIDEO_IDS = ["sha-0501","sha-0502","sha-0503","sha-0504","sha-0505","sha-0506","sha-0507","sha-0508","sha-0509","sha-0510","sha-0511","sha-0512","sha-0513","sha-0514"];
const SOCIAL_HIGH_IDS = ["sha-0504","sha-0505","sha-0506","sha-0507"];
SOCIAL_VIDEO_IDS.forEach(id => FOCUS_IDS.add(id));
// 読めなかった工芸品の用語：絹織物・陶磁器・漆器の復習を出題対象に加える。
const CRAFT_READING_FIRST_IDS = ['sha-0521', 'sha-0523', 'sha-0525', 'sha-0522', 'sha-0524', 'sha-0526', 'sha-0067', 'sha-0377', 'sha-0395'];
CRAFT_READING_FIRST_IDS.forEach(id => FOCUS_IDS.add(id));
const SHOW_ALL = PARAMS.get('all') === '1';
// 息子用の社会・理科の画面：まだ習っていない漢字（1〜3年の外）に、表示するときふりがなを足す（kanji-ruby.js。国語・ママ用は対象外）
function KanjiRubyOn(q) { return !MAMA && q && (q.subject === '社会' || q.subject === '理科') && !!window.KanjiRuby; }
function qr(s, q) { return !MAMA && q && (q.subject === '社会' || q.subject === '理科') && window.KanjiRuby ? KanjiRuby.render(s) : ruby(s); }
function qs() { return DATA.questions.filter(q => q.test === current.id && !OFF.has(q.id) && (SHOW_ALL || FOCUS_IDS.has(q.id))); } // off（今回は出さない）は対象から外す
function pickPool() { const ids = new Set(CONF.pick); return qs().filter(q => ids.has(q.id)); } // 今回のテスト対策
function st(id) { return stats[id] || { w: 0, c: 0, s: 0, l: '', t: '' }; }
// 間違えた問題は連続3回正解した3日後にもう一度。日付は端末のローカル日付。
// 従来の記録（due/verified を持たないもの）も、最後の正解日から自動的に判定する。
const CHECK_AFTER_DAYS = 3;
function localDay() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function plusDays(day, n) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day || '')) return '';
  const [y,m,d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
}
function checkDay(x) {
  return x.due || plusDays((x.t || '').slice(0,10), CHECK_AFTER_DAYS);
}
function isPending(id) {
  const x = st(id);
  return x.w > 0 && x.s >= MASTER && !x.verified;
}
function isDue(id) {
  return isPending(id) && checkDay(st(id)) && checkDay(st(id)) <= localDay();
}
function isMaster(id) {
  const x = st(id);
  return x.w > 0 ? !!x.verified : x.s >= MASTER;
}
function isHard(id) {
  const x = st(id);
  return x.w > 0 && (x.s < MASTER || isDue(id));
}
// 「過去に間違えた問題」は履歴を消さず、いつでも取り出せる。
function wasWrong(id) { return st(id).w > 0; }

// ---------- 風助の学習履歴：スマホとiPadを1人分として同期 ----------
// 共通APIの全端末解答＋この端末の送信待ち（queue.rows）をridで重複排除し、
// record()と同じ規則でstatsを再計算する。ママ用は一切同期しない。
let historySyncPromise = null, historyLastSynced = 0, historyStartPending = false;
const HISTORY_TIMEOUT = 6500, HISTORY_REFRESH_GAP = 15000;
function replayKidAttempts(attempts) {
  const x = { w: 0, c: 0, s: 0, l: '', t: '', verified: false, due: '', k: 0 };
  for (const a of attempts) {
    const t = String(a[0] || ''), day = t.slice(0, 10);
    const chk = x.due || plusDays(x.t.slice(0, 10), CHECK_AFTER_DAYS);
    if (a[1] === 'c') {
      const verifying = x.w > 0 && x.s >= MASTER && !x.verified && !!chk && day >= chk;
      x.c++; x.s++; x.l = 'o';
      if (verifying) { x.verified = true; x.due = ''; }
      else if (x.w > 0 && x.s === MASTER && !x.verified) x.due = plusDays(day, CHECK_AFTER_DAYS);
    } else {
      x.w++; x.s = 0; x.l = 'x'; x.verified = false; x.due = '';
      if (a[1] === 'u') x.k++;
    }
    x.t = t;
  }
  return x;
}
function mergeKidAttempts(remote, local) {
  const unique = new Map();
  // サーバーのattemptsを先に読み、送信途中の同一ridは二重に数えない。
  for (const a of remote.concat(local)) {
    if (!Array.isArray(a) || a.length < 4 || !a[0] || !a[3]) continue;
    if (a[1] !== 'c' && a[1] !== 'w' && a[1] !== 'u') continue;
    if (!unique.has(String(a[3]))) unique.set(String(a[3]), a);
  }
  return [...unique.values()].sort((a, b) =>
    (Date.parse(a[0]) || 0) - (Date.parse(b[0]) || 0));
}
function pendingKidAttempts() {
  const p = new Map();
  for (const r of queue.rows) {
    if (!r.qid || !r.rid || !r.t) continue;
    if (!p.has(r.qid)) p.set(r.qid, []);
    p.get(r.qid).push([r.t, r.ok ? 'c' : (r.skip ? 'u' : 'w'), dev, r.rid]);
  }
  return p;
}
async function syncKidHistory(force = false) {
  if (MAMA || !DATA) return;
  if (historySyncPromise) return historySyncPromise;
  if (!force && Date.now() - historyLastSynced < HISTORY_REFRESH_GAP) return;
  historySyncPromise = (async () => {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, HISTORY_TIMEOUT);
    // 同期中に送信が完了してキューから消えても、回答の取りこぼしを防ぐ。
    const waitingAtStart = pendingKidAttempts();
    try {
      const url = (SEND_OVERRIDE || SEND_URL) + '?api=ichimon_history';
      const r = await fetch(url, ctl ? { cache: 'no-cache', signal: ctl.signal } : { cache: 'no-cache' });
      if (!r.ok) throw new Error('history HTTP error');
      const h = await r.json();
      if (!h || h.ok !== true || h.partial || !h.questions || typeof h.questions !== 'object' || Array.isArray(h.questions)) throw new Error('history format error');
      // フェッチ中に解答した分もここで最新のキューから集める。
      const pending = pendingKidAttempts();
      for (const [id, atts] of waitingAtStart) {
        if (!pending.has(id)) pending.set(id, []);
        pending.get(id).push(...atts);
      }
      const next = Object.assign({}, stats);
      const ids = new Set([...Object.keys(h.questions), ...pending.keys()]);
      for (const id of ids) {
        const remote = h.questions[id] && h.questions[id].attempts;
        // 不完全なAPI応答で従来の履歴を消さない。
        if (h.questions[id] && !Array.isArray(remote)) continue;
        const all = mergeKidAttempts(remote || [], pending.get(id) || []);
        if (all.length) next[id] = replayKidAttempts(all);
      }
      stats = next;
      save(LS_STATS, stats);
      historyLastSynced = Date.now();
      // 解答中は画面を切り替えない。ホームにいる時だけ表示数を更新。
      if (!historyStartPending && document.getElementById('go')) home();
    } catch (e) {
      // 電波がない時は今までどおり、この端末に残る履歴で学習する。
    } finally {
      clearTimeout(timer);
    }
  })();
  try { await historySyncPromise; } finally { historySyncPromise = null; }
}
async function beginKidSession(makeList, from, button) {
  if (!MAMA) {
    historyStartPending = true;
    if (button) { button.disabled = true; button.textContent = '履歴を確認中…'; }
    try { await syncKidHistory(true); } finally { historyStartPending = false; }
  }
  start(makeList(), from);
}

function counts(list) { return { hard: list.filter(q => isHard(q.id)).length, pending: list.filter(q => isPending(q.id) && !isDue(q.id)).length, due: list.filter(q => isDue(q.id)).length, ok: list.filter(q => isMaster(q.id)).length, all: list.length }; }
// 初めての問題を優先。解いた問題は最後に解いた日時が古い順に回す。
// 同じ10問に、できるだけ違う分野を混ぜる。
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(list, n) {
  // 苦手・新規・定着確認を混ぜる。復習完了の確認待ちは通常出題を控える。
  const unique = [...new Map(list.map(q => [q.id, q])).values()];
  const weak = [], fresh = [], old = [], pending = [];
  unique.forEach(q => {
    const x = st(q.id);
    if (isPending(q.id) && !isDue(q.id)) pending.push(q);
    else if (isHard(q.id)) weak.push(q);
    else if (x.w + x.c === 0) fresh.push(q);
    else old.push(q);
  });
  // 繰り返し間違える問題ほど上位。同程度なら最後に解いた日が古いものを優先。
  weak.sort((a, b) => {
    const x = st(a.id), y = st(b.id);
    const pa = (isDue(a.id) ? 15 : 0) + x.w * 10 - x.s * 4;
    const pb = (isDue(b.id) ? 15 : 0) + y.w * 10 - y.s * 4;
    return pb - pa || (x.t || '').localeCompare(y.t || '');
  });
  old.sort((a, b) => (st(a.id).t || '').localeCompare(st(b.id).t || ''));
  // 各分類内は、可能な限り異なる教科・単元を選んで偏りを防ぐ。
  function spread(questions, limit) {
    const buckets = new Map();
    questions.forEach(q => {
      const key = q.subject + ':' + groupOf(q);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(q);
    });
    const selected = [], groups = [...buckets.values()];
    while (selected.length < limit && groups.some(g => g.length)) {
      for (const group of groups) {
        if (selected.length >= limit) break;
        if (group.length) selected.push(group.shift());
      }
    }
    return selected;
  }
  // 10問なら苦手6・初見3・定着1が目安。候補不足時は空き枠を融通する。
  const selected = [];
  const used = new Set();
  function take(candidates, limit, priorityIds = []) {
    const available = candidates.filter(q => !used.has(q.id));
    const byId = new Map(available.map(q => [q.id, q]));
    const priority = priorityIds.map(id => byId.get(id)).filter(Boolean);
    const prioritySet = new Set(priority.map(q => q.id));
    const ordered = priority.concat(spread(available.filter(q => !prioritySet.has(q.id)), limit));
    for (const q of ordered.slice(0, limit)) {
      if (selected.length >= n) break;
      selected.push(q); used.add(q.id);
    }
  }
  take(weak, Math.ceil(n * 0.6));
  take(fresh, Math.ceil(n * 0.3), ['ri-0086','sha-0504','ri-0087','sha-0505','ri-0088','sha-0506','ri-0089','sha-0507',...SOUND_FIRST_IDS,...SOUND_WEAK_IDS,...SOCIAL_VIDEO_IDS]);
  take(old, n - selected.length);
  // 各カテゴリが不足した場合の補充。確認待ちは最後の最後に限る。
  if (selected.length < n) take(weak, n - selected.length);
  if (selected.length < n) take(fresh, n - selected.length);
  if (selected.length < n) take(old, n - selected.length);
  if (selected.length < n) take(pending, n - selected.length);
  // 優先順位による選定は保ち、実際の出題順だけ交互にする。
  return spread(selected, n);
}
// 通常の10問は苦手6・初見3・定着1を目安にし、理科の直近の弱点と社会第8回を新規枠で優先。
// 同じ問題の連続・復習完了判定・ユーザーの教科絞り込みは既存機構を使う。
function pickStart(list, n) {
  // 工芸品の新規・苦手は大切だが、同じ分野が連続しないよう10問に最大2問まで。
  // ほかの教科・単元の問題と混ぜ、工芸品は3問目・8問目を目安に配置する。
  // すでに正解した問題は通常の復習選定に任せ、最初に押し付けない。
  const craftIds = new Set(CRAFT_READING_FIRST_IDS);
  const craftPool = list.filter(q => craftIds.has(q.id));
  const priority = CRAFT_READING_FIRST_IDS
    .map(id => craftPool.find(q => q.id === id))
    .filter(q => q && (st(q.id).w + st(q.id).c === 0 || isHard(q.id)))
    .slice(0, Math.min(2, Math.max(1, Math.floor(n / 5))));
  const chosen = pick(list.filter(q => !craftIds.has(q.id)), n - priority.length);
  // 教科・単元が偏っていても、同じ教科が続きすぎないよう並べ直す。
  const mixed = [];
  const pending = chosen.slice();
  while (pending.length) {
    const last = mixed.length ? mixed[mixed.length - 1].subject : '';
    const next = pending.findIndex(q => q.subject !== last);
    mixed.push(pending.splice(next >= 0 ? next : 0, 1)[0]);
  }
  for (let i = 0; i < priority.length; i++) {
    const pos = Math.min(i === 0 ? 2 : 7, mixed.length);
    mixed.splice(pos, 0, priority[i]);
  }
  // 工芸品以外の候補が足りない場合のみ、残りの問題で埋める。
  if (mixed.length < n) {
    const used = new Set(mixed.map(q => q.id));
    for (const q of pick(list.filter(q => !used.has(q.id)), n - mixed.length)) {
      if (mixed.length >= n) break;
      mixed.push(q);
    }
  }
  return mixed.slice(0, n);
}

function pool() {
  const sel = (units[filter] || []);
  return qs().filter(q => filter === '全部' || (filter === 'ちず' ? !!q.map : filter === 'かく' ? q.type === 'input' : q.subject === filter && (!sel.length || sel.includes(groupOf(q)))));
}
// 地図は地図問題が初めて出るときに1回だけ読む
let mapsP = null;
function loadMaps() {
  if (!mapsP) mapsP = Promise.all([fetch('data/map_chubu_kanto.json').then(r => r.json()), fetch('data/features.json').then(r => r.json())]).catch(e => { mapsP = null; throw e; });
  return mapsP;
}
// 答えたあとの解説。exp があればそれ。無い地図問題は「◯◯県の問題です」（map.hl、無ければ unit の「地図：」を除いたもの）
function expText(q) {
  if (q.exp) return q.exp;
  if (!q.map) return '';
  const n = q.map.hl || (q.unit || '').replace(/^地図：/, '');
  return n ? (GROUP_RUBY[n] || n) + 'の問題です' : '';
}
// 図解は問題を解く前ではなく、答え合わせ後の解説だけに表示する。
const EXPLANATION_IMAGES = {
  'ri-0068': { src: 'images/medaka-fins.svg', alt: 'メダカのひれ5種類の位置。むなびれ、はらびれ、せびれ、しりびれ、おびれ。合計7枚。' },
  'ri-0070': { src: 'images/pancreas-location-v2.webp', alt: '胃の後ろ側にあるすい臓と、すい液を送る十二指腸の位置図。' },
  'ri-0078': { src: 'images/sound-wave-count.svg', alt: '同じ時間に波が4個あるAと8個あるBの波形' },
  'ri-0079': { src: 'images/sound-wave-amplitude.svg', alt: '中央線から山の頂上までが振れ幅であることを示す波形' },
  'ri-0080': { src: 'images/sound-wave-amplitude.svg', alt: '中央線から山の頂上までが振れ幅であることを示す波形' },
  'ri-0081': { src: 'images/sound-wave-count.svg', alt: '同じ時間の波の数を比べる図' },
  'ri-0082': { src: 'images/sound-wave-amplitude.svg', alt: '中央線から山の頂上までの振れ幅を示す波形' },
  'ri-0083': { src: 'images/sound-wave-change.svg', alt: '波の数を半分にして振れ幅を2倍にした波形の比較' },
  'ri-0084': { src: 'images/sound-wave-change.svg', alt: '振動回数が半分になると波の横幅が2倍になる比較図' },
  'ri-0085': { src: 'images/sound-wave-change.svg', alt: '低くて大きい音の波形と元の波形の比較図' }
};
function expHtml(q) {
  const t = expText(q);
  const im = EXPLANATION_IMAGES[q.id];
  if (!t && !im) return '';
  const fig = im ? '<figure style="margin:12px 0 4px"><img src="' + im.src + '?v=20261120-1" alt="' + im.alt + '" loading="eager" style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto;border-radius:12px;background:#fff"><figcaption style="text-align:center;font-size:13px;color:#555;margin-top:5px">図で位置を確認してみよう</figcaption></figure>' : '';
  return '<div class="exp">' + (t ? qr(t, q) : '') + fig + '</div>';
}
// 音の波の図：答えを先に示さないものだけ問題中にも表示する。
const QUESTION_WAVE_IMAGES = {
  'ri-0078': 'images/sound-wave-count.svg',
  'ri-0079': 'images/sound-wave-amplitude.svg',
  'ri-0080': 'images/sound-wave-amplitude.svg',
  'ri-0081': 'images/sound-wave-count.svg',
  'ri-0082': 'images/sound-wave-amplitude.svg'
};
function waveQuestionHtml(q) {
  const src = QUESTION_WAVE_IMAGES[q.id];
  return src ? '<img src="' + src + '?v=20261123" alt="音の波形を考えるための図" loading="eager" style="display:block;width:100%;max-width:620px;height:auto;margin:10px auto;border-radius:8px;background:#fff">' : '';
}
// 鳥の見た目を知るための参考写真。分類を写真から当てさせる問題にはしない。
// Wikimedia Commonsの各写真ページから撮影者と利用条件を確認できる。
const BIRD_PHOTOS = {
  'ヒヨドリ': 'Hypsipetes amaurotis.jpg',
  'ツグミ': 'Dusky Thrush (Turdus eunomus) (24142348640).jpg',
  'マガモ': 'Mallard (Anas platyrhynchos).jpg',
  'ホトトギス': 'Cuculus poliocephalus.jpg',
  'ツバメ': 'Barn Swallow (Hirundo rustica).jpg',
  'ウグイス': 'Japanese bush warbler（Horornis diphone）ウグイス.jpg'
};
// 社会・写真で見分ける問題。問題文では答えを隠し、写真は解答前に表示する。
function socialPhotoHtml(q) {
  if (q.subject !== '社会' || !q.photo || !q.photo.file) return '';
  const filename = q.photo.file;
  const fileUrl = 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(filename);
  const imgUrl = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' + encodeURIComponent(filename) + '?width=580';
  return '<figure style="max-width:460px;margin:10px auto 14px;text-align:center">' +
    '<img src="' + imgUrl + '" alt="問題の参考写真" loading="eager" referrerpolicy="no-referrer" ' +
    'style="display:block;max-width:100%;width:100%;max-height:275px;object-fit:contain;border-radius:12px;background:#f6f6f6" ' +
    'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
    '<div style="display:none;padding:14px;font-size:13px">写真を表示できませんでした。下のリンクから写真を開いてね。</div>' +
    '<figcaption style="font-size:12px;line-height:1.7;color:#666">出典：Wikimedia Commons　' +
    '<a href="' + fileUrl + '" target="_blank" rel="noopener noreferrer">写真のページ</a></figcaption></figure>';
}
function birdPhotoHtml(q) {
  if (q.subject !== '理科' || q.unit !== '鳥のなかま') return '';
  const questionText = plain(q.q);
  const name = Object.keys(BIRD_PHOTOS).find(n => questionText.includes(n));
  if (!name) return '';
  const filename = BIRD_PHOTOS[name];
  const fileUrl = 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(filename);
  const imgUrl = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' + encodeURIComponent(filename) + '?width=520';
  return '<figure style="max-width:360px;margin:10px auto 14px;text-align:center">' +
    '<img src="' + imgUrl + '" alt="' + name + 'の写真" loading="eager" referrerpolicy="no-referrer" ' +
    'style="display:block;max-width:100%;width:100%;max-height:230px;object-fit:contain;border-radius:12px;background:#f6f6f6" ' +
    'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
    '<div style="display:none;padding:18px;font-size:13px">写真を読み込めませんでした。下のリンクから鳥の姿を見ることができます。</div>' +
    '<figcaption style="font-size:13px;line-height:1.7;color:#555">' + name + 'の姿<br>' +
    '<a href="' + fileUrl + '" target="_blank" rel="noopener noreferrer">鳥の写真を見る（Wikimedia Commons）</a></figcaption></figure>';
}

// 解説・「つぎへ」が出たら、画面下の冒険帯の上に見えるところまでスクロールする（#next の scroll-margin-bottom が帯の高さを避ける）
function revealNext() { const n = document.getElementById('next'); if (n && n.scrollIntoView) n.scrollIntoView({ block: 'end', behavior: 'smooth' }); }
function waitTap() {
  document.getElementById('next').insertAdjacentHTML('beforeend', '<div class="tapnext">タップして つぎへ ▶</div>'); revealNext();
  app.onclick = e => { if (e.target.closest('#quit')) return; app.onclick = null; advance(); };
}
function mapLabel(q) {
  const m = q.map; if (!m) return '';
  return '地図：' + (m.hl && m.mark ? m.hl + 'の' + m.mark : (m.hl || m.mark || ''));
}

// 今日解いた回数。正解・不正解・わかんない・解き直しをそれぞれ1問として数える。
function todaySolved() {
  const day = now().slice(0, 10);
  const daily = load(LS_DAILY, {});
  return Number(daily[day] || 0);
}
function addTodaySolved(day) {
  const daily = load(LS_DAILY, {});
  daily[day] = Number(daily[day] || 0) + 1;
  // 保存量を抑えるため、最近90日分を残す。
  const keys = Object.keys(daily).sort();
  keys.slice(0, Math.max(0, keys.length - 90)).forEach(k => delete daily[k]);
  save(LS_DAILY, daily);
}
// ---------- 画面：最初 ----------
function home() {
  app.className = ''; if (window.RPG) RPG.unmount();
  const all = qs();
  const subs = SUBJECTS.filter(s => all.some(q => q.subject === s));
  if (filter !== '全部' && filter !== 'ちず' && filter !== 'かく' && !subs.includes(filter)) filter = '全部';
  let gs = [];
  if (subs.includes(filter)) {
    gs = groupsOf(filter);
    units[filter] = (units[filter] || []).filter(g => gs.includes(g));
  }
  const rpgOn = !!(window.RPG && RPG.ok);   // ぼうけんが動いているとき：主人公と開始ボタンを先に、教科カードは「学習範囲の変更」の中へ
  const card = (label, list, cls, key) => {
    const c = counts(list);
    return `<button class="subj ${cls} ${filter === key ? 'sel' : ''}" data-f="${key}">${label}<small>${rpgOn ? `${ruby('{復習|ふくしゅう}')} ${c.hard}${ruby('{個|こ}')} ／ ${ruby('{覚|おぼ}')}えた ${c.ok}${ruby('{個|こ}')}<br>${ruby('{全部|ぜんぶ}')} ${c.all}${ruby('{個|こ}')}` : `${ruby('{復習|ふくしゅう}')} ${c.hard}こ ／ おぼえた ${c.ok}こ<br>ぜんぶ ${c.all}こ`}</small></button>`;
  };
  const p = pool(), hard = p.filter(q => isHard(q.id)), everWrong = p.filter(q => wasWrong(q.id)), pending = p.filter(q => isPending(q.id) && !isDue(q.id)), tp = pickPool();
  const rangeOpen = !!window.__rangeOpen;
  const subjectsHtml = `<div class="subjects">${card(rpgOn ? ruby('{全部|ぜんぶ}') : 'ぜんぶ', all, 'all', '全部')}${subs.map(s => card(s, all.filter(q => q.subject === s), '', s)).join('')}${all.some(q => q.map) ? card(rpgOn ? ruby('{地図|ちず}') : 'ちず', all.filter(q => q.map), '', 'ちず') : ''}${all.some(q => q.type === 'input') ? card(rpgOn ? ruby('{書|か}いて{答|こた}える') : 'かいて こたえる', all.filter(q => q.type === 'input'), '', 'かく') : ''}</div>
    ${gs.length ? `<div class="chips"><button class="chip ${units[filter].length ? '' : 'sel'}" data-g="">${rpgOn ? ruby('{全部|ぜんぶ}まぜる') : 'ぜんぶまぜる'}<small>${all.filter(q => q.subject === filter).length}${rpgOn ? ruby('{個|こ}') : 'こ'}</small></button>${gs.map(g => { const l = all.filter(q => q.subject === filter && groupOf(q) === g), c = counts(l); return `<button class="chip ${units[filter].includes(g) ? 'sel' : ''}" data-g="${esc(g)}">${ruby(GROUP_RUBY[g] || g)}<small>${ruby('{復習|ふくしゅう}')} ${c.hard} ／ ${c.all}${rpgOn ? ruby('{個|こ}') : 'こ'}</small></button>`; }).join('')}</div>` : ''}`;
  const goLabel = `スタート（${Math.min(ROUND, p.length)}${rpgOn ? ruby('{問|もん}') : 'もん'}）`;
  const hardLabel = `${ruby('{復習|ふくしゅう}が{必要|ひつよう}なところ')}（${hard.length}${rpgOn ? ruby('{個|こ}') : 'こ'}）`;
  const nowTxt = rpgOn && RPG.homeNow ? RPG.homeNow() : '';
  const note = rpgOn && RPG.progressNote ? RPG.progressNote() : null;
  const goHtml = rpgOn ? `<button class="big go rs-startbtn" id="go"><span class="rs-sb1">${goLabel}</span></button>${nowTxt ? `<div class="rs-contline">${ruby('{続|つづ}き')}：${nowTxt}${note ? `　<span>${ruby('{冒険|ぼうけん}')}の${ruby('{途中|とちゅう}')} ${note.n} / ${note.unit}</span>` : ''}</div>` : ''}` : `<button class="big go" id="go">${goLabel}</button>`;
  const hardHtml = rpgOn ? `<button class="big hard rs-hardrow" id="hard" ${hard.length ? '' : 'disabled'}>${ruby('{復習|ふくしゅう}が{必要|ひつよう}')}：${hard.length}${ruby('{項目|こうもく}')}<span class="rs-chg">${ruby('{復習|ふくしゅう}する')}</span></button>` : `<button class="big hard" id="hard" ${hard.length ? '' : 'disabled'}>${hardLabel}</button>`;
  const wrongHtml = rpgOn ? `<button class="big hard rs-hardrow" id="everwrong" ${everWrong.length ? '' : 'disabled'}>${ruby('{過去|かこ}に{間違|まちが}えた{問題|もんだい}')}：${everWrong.length}${ruby('{問|もん}')}<span class="rs-chg">${ruby('{全部|ぜんぶ}の{履歴|りれき}')}</span></button>` : `<button class="big hard" id="everwrong" ${everWrong.length ? '' : 'disabled'}>過去に間違えた問題（全履歴 ${everWrong.length}問）</button>`;
  const pendingHtml = pending.length ? `<div style="font-size:13px;color:#575970;padding:5px 12px 9px">3回連続正解した問題：${pending.length}問は3日後の確認待ち（今日の復習には出ません）</div>` : '';
  const testHtml = tp.length ? (rpgOn ? `<button class="big test" id="testp">${ruby('{今回|こんかい}のテスト{対策|たいさく}')}（${tp.length}${ruby('{個|こ}')}）</button>` : `<button class="big test" id="testp">今回のテスト対策（${tp.length}こ）</button>`) : '';
  const startHtml = goHtml + testHtml + hardHtml + pendingHtml + wrongHtml;
  const unitN = (units[filter] || []).length;
  const rangeName = (filter === '全部' ? ruby('{全部|ぜんぶ}') : esc(filter)) + (unitN ? `（${unitN}${ruby('{単元|たんげん}')}）` : '');
  const testName = `${esc(current.name)}${current.date ? '（' + esc(current.date.slice(5).replace('-', '/')) + '）' : ''}`;
  app.innerHTML = rpgOn ? `
    <div class="rs rs3 rs-homewrap" id="rsRoot" data-rb><main class="rs-body rs-homebody" id="rsBody">
    <div class="rs-topbar"><span class="rs-testname">${testName}</span><button type="button" class="kid-refresh-btn" id="kid-refresh" aria-label="アプリを最新版に更新">↻ 更新</button><button class="rs-rangebtn" id="rsRangeBtn">${ruby('{範囲|はんい}を{変|か}える')}</button></div>
    ${RPG.homeTop()}
    <div class="rs-daily-count" style="text-align:center;padding:8px 12px;font-weight:bold;font-size:16px;color:#49416e" data-noruby>📘 きょう解いた問題：${todaySolved()}問</div>
    ${RPG.homeBonus()}
    ${goHtml}${testHtml}
    <div class="rs-pair"><details class="rs-range"${rangeOpen ? ' open' : ''}><summary class="rs-rangerow">${ruby('{範囲|はんい}')}：<b>${rangeName}</b><span class="rs-chg">${ruby('{変更|へんこう}')}</span></summary>
      <div class="rs-sheetbg" id="rsRangeBg"><div class="rs-sheet" role="dialog" aria-modal="true" aria-label="学習範囲の変更"><div class="rs-sheet-h"><b>${ruby('{学習範囲|がくしゅうはんい}の{変更|へんこう}')}</b><button class="rs-sheet-x" id="rsRangeX">とじる</button></div><div class="rs-sheet-b">${subjectsHtml}</div></div></div></details>
      ${hardHtml}${pendingHtml}${wrongHtml}</div>
    <div class="credit" data-noruby>地図：国土数値情報（行政区域データ）を加工して作成</div>
    </main><footer class="rs-foot">${RPG.navHtml('home')}</footer></div>` : `
    <h1>一問一答</h1>
    ${MAMA ? '' : '<div class="kid-refresh-row"><button type="button" class="kid-refresh-btn" id="kid-refresh">↻ 更新</button></div>'}
    ${MAMA ? '<div class="mama"><b>ママ用</b>（きろくは のこりません／むすこさんの記録とは べつ）<a href="list.html">問題の一覧を見る</a>　<a href="history.html">風助の解答履歴を見る</a></div>' : ''}
    <div class="sub">${esc(current.name)}${current.date ? '（' + esc(current.date.slice(5).replace('-', '/')) + '）' : ''}</div>
    ${window.RPG ? RPG.homeTop() : ''}
    ${subjectsHtml}
    <div style="text-align:center;padding:8px 12px;font-weight:bold" data-noruby>📘 きょう解いた問題：${todaySolved()}問</div>
    ${startHtml}
    ${window.RPG ? RPG.homeHtml() : ''}
    <div class="credit" data-noruby>地図：国土数値情報（行政区域データ）を加工して作成</div>
    ${window.RPG ? RPG.navHtml('home') : ''}`;
  if (!MAMA) { const refresh = document.getElementById('kid-refresh'); if (refresh) refresh.onclick = refreshKidApp; }
  if (window.RPG) { RPG.bindHome(); RPG.bindHomeTop(); }
  if (!MAMA) void syncKidHistory();
  app.querySelectorAll('.subj').forEach(b => b.onclick = () => { window.__rangeOpen = true; filter = b.dataset.f; saveSel(); home(); });
  app.querySelectorAll('.chip').forEach(b => b.onclick = () => {
    window.__rangeOpen = true; const g = b.dataset.g, cur = units[filter] || [];
    units[filter] = !g ? [] : cur.includes(g) ? cur.filter(x => x !== g) : cur.concat(g);
    saveSel(); home();
  });
  const rd = app.querySelector('.rs-range');
  if (rd) {   // 範囲の変更は詳細シート：「範囲を変える」「範囲：…変更」で開き、「とじる」・背景・Escで閉じる
    const setO = v => { rd.open = v; window.__rangeOpen = v; };
    rd.ontoggle = () => { window.__rangeOpen = rd.open; };
    const rb0 = document.getElementById('rsRangeBtn'); if (rb0) rb0.onclick = () => setO(true);
    const rx = document.getElementById('rsRangeX'); if (rx) rx.onclick = e => { e.preventDefault(); setO(false); };
    const bg = document.getElementById('rsRangeBg'); if (bg) bg.onclick = e => { if (e.target === bg) setO(false); };
  }
  document.getElementById('go').onclick = e => beginKidSession(() => pickStart(pool(), ROUND), '', e.currentTarget);
  document.getElementById('hard').onclick = e => beginKidSession(() => pick(pool().filter(q => isHard(q.id)), ROUND), 'hard', e.currentTarget);
  document.getElementById('everwrong').onclick = e => beginKidSession(() => pick(pool().filter(q => wasWrong(q.id)), ROUND), 'everwrong', e.currentTarget);
  const tb = document.getElementById('testp');
  if (tb) tb.onclick = e => beginKidSession(() => pick(pickPool(), ROUND), 'pick', e.currentTarget);
}

// ---------- 回 ----------
function start(list, from, opts) {
  // opts.manual：手動の「まちがえたのだけ もう1回」。ぼうけん（RPG）には影響しない
  let pre = { list, reviews: [], reask: 0, rpg: false };
  if (!(opts && opts.manual) && window.RPG) pre = RPG.beforeStart(list);
  list = pre.list;
  if (!list.length && !pre.reviews.length) return home();
  S = { from: from || '', sess: dev.slice(0, 4) + '-' + Date.now().toString(36), queue: pre.reviews.concat(list), idx: 0, total: list.length, reask: pre.reask, rpg: pre.rpg, correct: 0, wrong: [], wrongIds: new Set(pre.reviews.map(r => r.id)), skips: 0, seen: new Set(), reaskedIds: new Set(), locked: false, timer: null };
  question();
}
// 間違えた問題を3問あとにもう一度（1回の延長は最大5問）。ぼうけん中は冒険単位で数える
function reask(q) {
  // 間違えた直後の再確認は同じ問題につき1回まで。
  if (S.reask >= REASK_MAX || S.reaskedIds.has(q.id)) return;
  if (S.rpg && !RPG.queueReview(q, S)) return;
  S.reaskedIds.add(q.id);
  S.reask++;
  const at = Math.min(S.idx + REASK_GAP, S.queue.length);
  let w = q;
  if (S.rpg) { w = Object.create(q); w._rv = { origin: q._rv ? q._rv.origin : S.lastOrigin }; }
  S.queue.splice(at, 0, w);
}
function question() {
  const q = S.queue[S.idx];
  S.locked = false; S.cur = q; S.sel = -1;
  const isIn = q.type === 'input';
  const opts = isIn ? [] : shuffle([q.a, ...q.choices]);
  S.opts = opts;
  app.innerHTML = `
    <div class="top">
      <button class="btn-quit" id="quit">✕ やめる</button>
      <div class="dname">${ruby(q.subject)}<br>${q.subject === '社会' ? (q.map ? '地図問題' : '') : qr(q.unit || '', q)}</div>
      <div class="pill">${S.idx + 1} / ${S.queue.length}</div>
    </div>
    <div class="bar"><i style="width:${(S.idx / S.queue.length) * 100}%"></i></div>
    <div class="card${q.map ? ' withmap' : ''}"><div class="qt">${qr(q.q, q)}</div>${waveQuestionHtml(q)}${birdPhotoHtml(q)}${socialPhotoHtml(q)}</div>
    ${q.map ? '<div class="map' + (isIn ? ' small' : '') + '" id="map"></div>' : ''}
    ${isIn ? `<div class="inbox"><input id="ans" class="ans" type="text" inputmode="text" lang="ja" placeholder="ひらがなで かいてね" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"><button class="big go" id="submit" disabled>こたえる</button><button class="skip" id="skip">わかんない</button></div>` : ''}
    <div class="choices">${opts.map((o, i) => `<button class="choice" data-i="${i}"><span class="dot"></span><span>${qr(o, q)}</span></button>`).join('')}</div>
    ${isIn || MAMA ? '' : '<div class="decidew" id="decidew" hidden><button class="big go" id="decide">けってい</button></div>'}
    ${isIn ? '' : '<div class="skipw"><button class="skip" id="skipc">わかんない</button></div>'}
    <div class="next" id="next"></div>
    <div class="score">せいかい ${S.correct}こ</div>
    ${window.RPG ? RPG.stripHtml(S) : ''}`;
  app.className = S.rpg ? 'inq' : '';
  if (window.RPG) RPG.mount();
  document.getElementById('quit').onclick = () => { clearTimeout(S.timer); app.onclick = null; flush(); home(); };
  app.querySelectorAll('.choice').forEach(b => b.onclick = () => MAMA ? answer(+b.dataset.i) : pickChoice(+b.dataset.i));
  const dec = document.getElementById('decide'); if (dec) dec.onclick = () => { if (S.locked || S.sel < 0) return; sfx('decide'); answer(S.sel); };
  if (isIn) setupInput(q); else document.getElementById('skipc').onclick = () => answer(-1);
  if (q.map) loadMaps().then(([md, ft]) => { const c = document.getElementById('map'); if (c && S.cur === q) renderMap(c, md, ft, q.map, { aspect: isIn ? 2.4 : 1.7 }); }).catch(() => {});
}
// 入力問題：ひらがな・カタカナ・全角半角・空白・末尾の「。」をそろえて比べる
function norm(t) {
  return String(t).normalize('NFKC').replace(/\s+/g, '').replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[。.．]+$/, '');
}
function judge(q, text) { const n = norm(text); return !!n && q.accept.some(a => norm(a) === n); }
function setupInput(q) {
  const inp = document.getElementById('ans'), sub = document.getElementById('submit'), skip = document.getElementById('skip');
  const sync = () => { sub.disabled = !norm(inp.value); };
  inp.addEventListener('input', sync);
  inp.addEventListener('focus', () => setTimeout(() => sub.scrollIntoView({ block: 'end', behavior: 'smooth' }), 350));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && norm(inp.value)) { e.preventDefault(); answerInput(inp.value); } });
  sub.onclick = () => { if (norm(inp.value)) answerInput(inp.value); };
  skip.onclick = () => answerInput(null);
}
function answerInput(text) {
  if (S.locked) return; S.locked = true;
  const q = S.cur, skipped = text === null, ok = !skipped && judge(q, text);
  const inp = document.getElementById('ans');
  sfx(ok ? 'correct' : 'wrong', 60);
  inp.blur(); inp.readOnly = true;
  document.getElementById('submit').disabled = true;
  if (skipped) S.skips++;
  record(q, ok, skipped ? 'わかんない' : String(text).trim(), skipped);
  const nx = document.getElementById('next');
  if (ok) {
    if (!S.seen.has(q.id)) S.correct++;
    S.seen.add(q.id);
    inp.classList.add('ok');
    nx.innerHTML = '<span class="okmsg">○ せいかい！</span>' + expHtml(q);
    document.querySelector('.score').textContent = 'せいかい ' + S.correct + 'こ'; if (expText(q)) revealNext();
    S.timer = setTimeout(expText(q) ? waitTap : advance, expText(q) ? 600 : 800);
  } else {
    S.seen.add(q.id);
    if (!S.wrongIds.has(q.id)) { S.wrongIds.add(q.id); S.wrong.push(q); }
    inp.classList.add('ng');
    reask(q);
    nx.innerHTML = '<div class="correct">× こたえ：' + ruby(q.a) + '</div>' + expHtml(q); revealNext();
    S.timer = setTimeout(waitTap, 1100);
  }
}
// 効果音：rpg-sound.js の音（設定のオン・オフに従う）。鳴らせなくても答える操作は変えない
function sfx(n, wait) { try { if (!MAMA && window.RPG && RPG.sound) { if (wait) setTimeout(() => { try { RPG.sound.play(n); } catch (e) {} }, wait); else RPG.sound.play(n); } } catch (e) {} }
// 選択式：タップは「選ぶ」だけ（選び直せる）。「けってい」を押したら判定する
function pickChoice(i) {
  if (S.locked) return;
  S.sel = i;
  app.querySelectorAll('.choice').forEach((b, j) => { b.classList.toggle('sel', j === i); b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
  const dw = document.getElementById('decidew');
  if (dw) { dw.hidden = false; if (dw.scrollIntoView) dw.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
}
function answer(i) {
  if (S.locked) return; S.locked = true;
  const q = S.cur, skipped = i < 0, picked = skipped ? 'わかんない' : S.opts[i], ok = !skipped && picked === q.a;
  const btns = [...app.querySelectorAll('.choice')];
  btns.forEach(b => b.classList.remove('sel'));
  const dw = document.getElementById('decidew'); if (dw) dw.hidden = true;
  sfx(ok ? 'correct' : 'wrong', 140);
  if (skipped) { S.skips++; }
  record(q, ok, picked, skipped);
  if (ok) {
    if (!S.seen.has(q.id)) S.correct++;
    S.seen.add(q.id);
    btns[i].classList.add('ok'); btns[i].querySelector('.dot').textContent = '○';
    document.querySelector('.score').textContent = 'せいかい ' + S.correct + 'こ';
    if (expText(q)) { document.getElementById('next').innerHTML = expHtml(q); revealNext(); S.timer = setTimeout(waitTap, 600); }
    else S.timer = setTimeout(advance, 600);
  } else {
    S.seen.add(q.id);
    if (!S.wrongIds.has(q.id)) { S.wrongIds.add(q.id); S.wrong.push(q); }
    if (!skipped) { btns[i].classList.add('ng'); btns[i].querySelector('.dot').textContent = '×'; }
    btns.forEach((b, j) => { if (S.opts[j] === q.a) b.classList.add('glow'); else if (j !== i) b.classList.add('dim'); });
    reask(q);
    document.getElementById('next').innerHTML = expHtml(q); revealNext();
    S.timer = setTimeout(waitTap, 1100);
  }
}
function advance() {
  clearTimeout(S.timer); app.onclick = null;
  S.idx++;
  if (S.idx >= S.queue.length) return result();
  question();
}

// ---------- 画面：おわり ----------
function result() {
  flush();
  app.className = ''; if (window.RPG) RPG.unmount();
  const right = S.total - S.wrong.length;
  const wrongHtml = S.wrong.length ? `<div class="wrong-list"><h2>${S.rpg ? ruby('{間違|まちが}えた{問題|もんだい}') : 'まちがえた もんだい'}</h2>${S.wrong.map(q => `<div class="wi">${q.map ? `<span class="ml">${KanjiRubyOn(q) ? qr(mapLabel(q), q) : esc(mapLabel(q))}</span>` : ''}${qr(q.q, q)}<b>こたえ：${q.type === 'input' ? ruby(q.a) : qr(q.a, q)}</b>${q.exp ? `<span class="wexp">${qr(q.exp, q)}</span>` : ''}</div>`).join('')}</div>` : '';
  const rg = window.RPG ? RPG.afterSession(S) : null;
  const rh = rg && rg.settled ? RPG.rewardHtml(rg.res, S, wrongHtml + '<button class="rw-btn alt" id="again">' + ruby('{間違|まちが}えたのだけもう1回') + '</button>', S.wrong.length > 0) : null;
  if (rh) {
    app.innerHTML = rh;
    RPG.bindReward(rg.res);
    window.scrollTo(0, 0);
  } else {
    app.innerHTML = `
    <h1>おわり！</h1>
    <div class="res-score">${right}<small> / ${S.total} せいかい</small></div>
    ${rg && !rg.settled ? `<div class="rpg-note">${ruby('{今回|こんかい}')} ${S.total}${ruby('{問|もん}')} ／ ${ruby('{冒険|ぼうけん}')} ${rg.n} / ${rg.unit}（${ruby('{続|つづ}きは{次|つぎ}のスタートで')}）</div>` : ''}
    ${S.skips ? `<div class="skipcount">わかんない ${S.skips}こ</div>` : ''}
    ${S.wrong.length ? wrongHtml : '<div class="perfect">ぜんぶ せいかい！ すごい！</div>'}
    <button class="big hard" id="again" ${S.wrong.length ? '' : 'disabled'}>${S.rpg ? ruby('{間違|まちが}えたのだけもう1回') : 'まちがえたのだけ もう1回'}</button>
    <button class="big go" id="more">つぎの10もん</button>
    <button class="big plain" id="end">おわる</button>`;
  }
  window.__again = () => start(shuffle(S.wrong), S.from, { manual: true });
  const again = document.getElementById('again');
  if (again) again.onclick = () => start(shuffle(S.wrong), S.from, { manual: true });
  document.getElementById('more').onclick = () => {
    const p = S.from === 'pick' ? pickPool() : S.from === 'everwrong' ? pool().filter(q => wasWrong(q.id)) : S.from === 'hard' ? pool().filter(q => isHard(q.id)) : pool();
    const done = new Set(S.queue.map(q => q.id));
    const fresh = p.filter(q => !done.has(q.id));
    const next = pick(fresh, ROUND);
    if (next.length < ROUND) next.push(...pick(p.filter(q => !done.has(q.id) && !next.some(n => n.id === q.id)), ROUND - next.length));
    // 候補を一巡したときだけ、その回の問題を再度使う。
    if (next.length < ROUND) next.push(...pick(p.filter(q => !next.some(n => n.id === q.id)), ROUND - next.length));
    start(next, S.from);
  };
  document.getElementById('end').onclick = () => home();
}

// ---------- 記録と送信 ----------
function now() {
  const d = new Date(), p = n => String(n).padStart(2, '0'), o = -d.getTimezoneOffset(), a = Math.abs(o);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${o >= 0 ? '+' : '-'}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}
function record(q, ok, picked, skipped) {
  const t = now(), day = t.slice(0,10), x = Object.assign({ w: 0, c: 0, s: 0, l: '', t: '' }, stats[q.id]);
  // 後日確認の期限が来ていれば、今回の正解で「復習完了」。
  // 期限より前に何度正解しても確認済みとはしない。
  const verifying = x.w > 0 && x.s >= MASTER && !x.verified && !!checkDay(x) && day >= checkDay(x);
  if (ok) {
    x.c++; x.s++; x.l = 'o';
    if (verifying) { x.verified = true; x.due = ''; }
    else if (x.w > 0 && x.s === MASTER && !x.verified) x.due = plusDays(day, CHECK_AFTER_DAYS);
  } else {
    x.w++; x.s = 0; x.l = 'x'; x.verified = false; x.due = '';
    if (skipped) x.k = (x.k || 0) + 1;
  }
  x.t = t; stats[q.id] = x; save(LS_STATS, stats);
  queue.seq++;
  const row = { rid: dev + '-' + queue.seq, t, test: q.test, qid: q.id, ok, pick: plain(picked), sess: S.sess };
  if (skipped) row.skip = 1;
  queue.rows.push(row);
  save(LS_Q, queue);
  addTodaySolved(day);
  if (window.RPG) RPG.onAnswer(q, ok, row.rid, S);
}
let sending = false;
function post(rows, mode) {
  const opt = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ api: 'ichimon', dev, rows }) };
  if (mode) opt.mode = mode;
  return fetch(SEND_OVERRIDE || SEND_URL, opt);
}
// 方式：まず通常の fetch。応答が読めて ok:true なら、送れた分を消す。
// 応答が読めない（CORS等で例外）ときは mode:'no-cors' で同じ行をもう一度送り、
// 送信が成立（不透明な応答）したら消す。通信自体の失敗なら残して次回再送。
// 二重送信はサーバー側が rid で弾く。
async function flush() {
  if (NOSEND || sending || !queue.rows.length) return;
  sending = true;
  try {
    while (queue.rows.length) {
      const rows = queue.rows.slice(0, BATCH); let sent = false;
      try {
        const r = await post(rows);
        const j = await r.json();
        if (j && j.ok) sent = true; else break;
      } catch (e) {
        try { await post(rows, 'no-cors'); sent = true; } catch (e2) { break; }
      }
      if (!sent) break;
      const gone = new Set(rows.map(r => r.rid));
      queue.rows = queue.rows.filter(r => !gone.has(r.rid)); save(LS_Q, queue);
    }
  } finally { sending = false; }
}
window.addEventListener('online', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

// ---------- 起動 ----------
// questions.json と ママの設定を読む。設定は読めなくても（5秒で）あきらめて前回の写しで動く
Promise.all([fetch(PARAMS.get('data') || 'data/questions.json', { cache: 'no-cache' }).then(r => r.json()), loadConf()]).then(([d, conf]) => {
  CONF = conf; OFF = new Set(conf.off);
  DATA = d; DATA.questions = applyEdits(d.questions, conf); current = d.tests.find(t => t.current) || d.tests[0];
  home(); flush();
}).catch(() => { app.innerHTML = '<div class="empty">もんだいを よみこめませんでした。<br>ネットを つないで もう一度ひらいてね。</div>'; });
