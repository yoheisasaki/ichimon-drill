'use strict';
// 送信先（SEND_URL）・PARAMS・SEND_OVERRIDE・ママの設定の読み込みは common.js
const MAMA = PARAMS.get('mama') === '1' || /mama\.html$/.test(location.pathname); // ママモード：送信せず、保存キーも別名
const NOSEND = PARAMS.get('nosend') === '1' || MAMA;
const ROUND = 10, MASTER = 3, REASK_GAP = 3, REASK_MAX = 5, BATCH = 200;
const SUBJECTS = ['国語', '算数', '理科', '社会', '国語・語彙'];
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
// 塾配布の第5回対策で扱われた音の基本（振動・音の高低・コップ・雷）を先にする。
const SOUND_BASIC_FIRST_IDS = ["ri-0074","ri-0073","ri-0075","ri-0076","ri-0077","ri-0078","ri-0079","ri-0080"];
// 波形の数やマス目の計算は削除せず発展扱いにし、通常の10問では頻度を落とす。
const SOUND_ADVANCED_IDS = new Set(["ri-0081","ri-0082","ri-0083"]);
SOUND_BASIC_FIRST_IDS.forEach(id => FOCUS_IDS.add(id));
SOUND_ADVANCED_IDS.forEach(id => FOCUS_IDS.add(id));
["ri-0085"].forEach(id => FOCUS_IDS.add(id));
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
["map-0241","pref-20261124-02","pref-20261124-03","pref-20261124-04","pref-20261124-05","pref-20261124-06","pref-20261124-07","pref-20261124-08","pref-20261124-09","pref-20261124-10","pref-20261124-11","pref-20261124-12","map-0078","pref-20261124-14","pref-20261124-15","pref-20261124-16","pref-20261124-17","map-0234","sha-0208","pref-20261124-20","pref-20261124-21","pref-20261124-22","map-0240","pref-20261124-24","pref-20261124-25","pref-20261124-26","sha-0313","pref-20261124-28","pref-20261124-29","pref-20261124-30","pref-20261124-31","sha-0317","pref-20261124-33","sha-0202","pref-20261124-35","pref-20261124-36","pref-20261124-37","pref-20261124-38","pref-20261124-39","pref-20261124-40"].forEach(id => FOCUS_IDS.add(id));
FOCUS_IDS.add('map-0233');
function qs() { return DATA.questions.filter(q => (q.subject === '国語・語彙' || q.test === current.id) && q.id !== 'ri-0084' && !OFF.has(q.id) && (q.subject === '国語・語彙' || SHOW_ALL || FOCUS_IDS.has(q.id))); } // off（今回は出さない）は対象から外す
function pickPool() { const ids = new Set(CONF.pick); return pool().filter(q => ids.has(q.id)); } // 今回のテスト対策
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
      if (window.RPG && RPG.studyMilestones) RPG.studyMilestones(stats);
              // 端末間で同じ解答を二重に数えず、今日の解答数に反映。
       const byId = new Map();
       for (const [qid, info] of Object.entries(h.questions)) {
         const remote = Array.isArray(info && info.attempts) ? info.attempts : [];
         for (const a of mergeKidAttempts(remote, pending.get(qid) || [])) byId.set(String(a[3]), a);
       }
       for (const [qid, attempts] of pending) {
         if (h.questions[qid]) continue;
         for (const a of mergeKidAttempts([], attempts)) byId.set(String(a[3]), a);
       }
       const dayCounts = {};
       byId.forEach(a => { const d = String(a[0] || '').slice(0,10); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) dayCounts[d] = (dayCounts[d] || 0) + 1; });
       const daily = load(LS_DAILY, {});
       Object.entries(dayCounts).forEach(([d,n]) => { daily[d] = Math.max(Number(daily[d] || 0), n); });
       save(LS_DAILY, daily);
       if (window.RPG && RPG.dailyStudyReward) RPG.dailyStudyReward(now().slice(0, 10), todaySolved());
       if (window.RPG && RPG.lifeSync) RPG.lifeSync(stats, now().slice(0,10),todaySolved());
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
// 直前の10問を記録。次の学習回はまず別の問題を選ぶ。
const LS_RECENT_ROUND = 'ichimon.recent-round.v1' + LS_SFX;
function avoidPreviousRound(list) {
  const recent = new Set(load(LS_RECENT_ROUND, []));
  const different = list.filter(q => !recent.has(q.id));
  // 候補がある分だけ直前の問題を避ける。足りない場合だけ再利用する。
  return different;
}
function rememberRound(list) {
  save(LS_RECENT_ROUND, [...new Set(list.map(q => q.id))]);
}
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
  // 苦手問題は復習から外さないが、間違い回数だけで同じ問題を押しつけない。
  // 最終回答が古いものを優先し、回数は同じ日時のときだけ参考にする。
  weak.sort((a, b) => {
    const x = st(a.id), y = st(b.id);
    const pa = (isDue(a.id) ? 15 : 0) + x.w * 10 - x.s * 4;
    const pb = (isDue(b.id) ? 15 : 0) + y.w * 10 - y.s * 4;
    return (x.t || '').localeCompare(y.t || '') || pb - pa;
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
  // 通常10問の目安は苦手2・初見5・定着3。新しい問題を十分に混ぜる。
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
  take(weak, Math.floor(n * 0.2));
  take(fresh, Math.ceil(n * 0.5), ['ri-0086','sha-0504','ri-0087','sha-0505',...SOUND_BASIC_FIRST_IDS,'ri-0088','sha-0506','ri-0089','sha-0507',...SOUND_WEAK_IDS,...SOCIAL_VIDEO_IDS]);
  take(old, n - selected.length);
  // 各カテゴリが不足した場合の補充。確認待ちは最後の最後に限る。
  if (selected.length < n) take(fresh, n - selected.length);
  if (selected.length < n) take(old, n - selected.length);
  if (selected.length < n) take(weak, n - selected.length);
  if (selected.length < n) take(pending, n - selected.length);
  // 優先順位による選定は保ち、実際の出題順だけ交互にする。
  return spread(selected, n);
}
// 通常の10問は苦手4・初見4・定着2を目安にし、理科の直近の弱点と社会第8回を新規枠で優先。
// 同じ問題の連続・復習完了判定・ユーザーの教科絞り込みは既存機構を使う。
// 「次の10問」は通常スタートよりも復習を軽くする。
// 直前の問題・今日解いた問題を避け、未出題6・定着3・苦手最大1を目安にする。
// 候補が少ないときだけ段階的に補充し、苦手の押し付けを防ぐ。
// 県名暗記：社会を選んだ場合は最大5問、全教科では最大2問を新規優先枠にする。
function prefecturePriority(candidates, n) {
  const socialOnly = candidates.length > 0 && candidates.every(q => q.subject === '社会');
  const limit = Math.ceil(n * (socialOnly ? 0.5 : 0.2));
  const high = ['sha-0329','pref-20261124-35','pref-20261124-20','map-0233','pref-20261124-30','pref-20261124-08','pref-20261124-11','pref-20261124-24','pref-20261124-14','sha-0313','map-0234','sha-0208'];
  const emblem = q => q.id.startsWith('sha-emblem-20261125-');
  const eligible = candidates.filter(q => emblem(q) && (st(q.id).w + st(q.id).c === 0 || (isHard(q.id) && !(isPending(q.id) && !isDue(q.id))))).sort((a,b) => Number(st(a.id).w + st(a.id).c > 0) - Number(st(b.id).w + st(b.id).c > 0) || (st(a.id).t || '').localeCompare(st(b.id).t || ''));
  const emblemFirst = eligible.slice(0, Math.min(limit, socialOnly ? 3 : 1));
  return emblemFirst.concat(candidates.filter(q => !emblem(q)).filter(q => (q.prefExplain && st(q.id).w + st(q.id).c === 0) || (['sha-0329','pref-20261124-35','pref-20261124-20','map-0233'].includes(q.id) && !isMaster(q.id) && !(isPending(q.id) && !isDue(q.id))))
    .sort((a,b) => (high.includes(a.id)?high.indexOf(a.id):999)-(high.includes(b.id)?high.indexOf(b.id):999))
    .slice(0,Math.max(0,limit-emblemFirst.length)));
}
function pickVocabulary(list, n) {
  const fresh = list.filter(q => !st(q.id).c && !st(q.id).w);
  const review = list.filter(q => st(q.id).c || st(q.id).w).sort((a,b) => Number(isHard(b.id))-Number(isHard(a.id)) || (st(a.id).t||'').localeCompare(st(b.id).t||''));
  const chosen = review.slice(0, Math.min(3, Math.max(0,n-fresh.length), review.length));
  if (fresh.length && review.length && chosen.length < 3) chosen.push(...review.slice(chosen.length, Math.min(3,review.length)));
  chosen.push(...fresh.slice(0,n-chosen.length));
  chosen.push(...review.filter(q=>!chosen.includes(q)).slice(0,n-chosen.length));
  return shuffle(chosen).slice(0,n);
}
function pickNextNormal(candidates, previousIds, n) {
  if (filter === '国語・語彙') return pickVocabulary(candidates, n);
  const unique = [...new Map(candidates.map(q => [q.id, q])).values()];
  const today = localDay();
  const notPrevious = unique.filter(q => !previousIds.has(q.id));
  const otherDay = notPrevious.filter(q => !String(st(q.id).t || '').startsWith(today));
  const source = otherDay.length >= n ? otherDay : notPrevious;
  const fresh = source.filter(q => { const x = st(q.id); return x.w + x.c === 0; });
  const old = source.filter(q => { const x = st(q.id); return x.w + x.c > 0 && !isHard(q.id) && !(isPending(q.id) && !isDue(q.id)); });
  const weak = source.filter(q => isHard(q.id));
  const selected = [];
  const used = new Set();
  function add(list, count) {
    for (const q of list) {
      if (selected.length >= n || count <= 0) break;
      if (used.has(q.id)) continue;
      selected.push(q); used.add(q.id); count--;
    }
  }
  add(prefecturePriority(source, n), Math.ceil(n * 0.6));
  add(pick(fresh.filter(q => !used.has(q.id)), n), Math.max(0, Math.ceil(n * 0.6) - selected.length));
  add(pick(old, n), Math.ceil(n * 0.3));
  add(pick(weak, n), Math.min(1, n));
  // 補充も未出題・定着を優先。未消化の候補がある限り当日回答済みは使わない。
  add(pick(fresh.filter(q => !used.has(q.id)), n), n);
  add(pick(old.filter(q => !used.has(q.id)), n), n);
  if (selected.length < n) add(pick(weak.filter(q => !used.has(q.id)), n), Math.max(0, 2 - selected.filter(q => isHard(q.id)).length));
  if (selected.length < n) add(pick(notPrevious.filter(q => !used.has(q.id)), n), n);
  if (selected.length < n) add(pick(unique.filter(q => !used.has(q.id)), n), n);
  return selected.slice(0, n);
}
function pickStart(list, n) {
  if (filter === '国語・語彙') return pickVocabulary(list, n);
  const originalList = list;
  // 通常学習では本日すでに答えた問題を後回しにする。候補不足時のみ再利用する。
  const today = localDay();
  const notToday = list.filter(q => !String(st(q.id).t || '').startsWith(today));
  const dayFirst = notToday.length >= n ? notToday : notToday.concat(list.filter(q => String(st(q.id).t || '').startsWith(today)));
  list = avoidPreviousRound(dayFirst);
  if (list.length < n) list = list.concat(dayFirst.filter(q => !list.some(x => x.id === q.id)));
  // 候補数が多いときは本日回答済み問題を候補から除外する。
  const eligible = list.filter(q => !String(st(q.id).t || '').startsWith(today));
  if (eligible.length >= n) list = eligible;
  // 基本優先。波形の発展4問は通常スタート4回に1回だけ、最大1問。
  // 「まちがえた問題」「復習が必要」などの専用ボタンでは制限しない。
  const soundCountKey = 'ichimon.sound.advanced.turn.v1' + LS_SFX;
  const turn = Number(lsGet(soundCountKey) || 0) + 1;
  lsSet(soundCountKey, String(turn));
  const basic = list.filter(q => !SOUND_ADVANCED_IDS.has(q.id));
  const advanced = list.filter(q => SOUND_ADVANCED_IDS.has(q.id));
  const allowAdvanced = turn % 4 === 0 && advanced.length > 0 && basic.length >= n - 1;
  const normalCount = Math.max(0, n - (allowAdvanced ? 1 : 0));
  // 工芸品の新規・苦手は大切だが、同じ分野が連続しないよう10問に最大2問まで。
  // ほかの教科・単元の問題と混ぜ、工芸品は3問目・8問目を目安に配置する。
  // すでに正解した問題は通常の復習選定に任せ、最初に押し付けない。
  const craftIds = new Set(CRAFT_READING_FIRST_IDS);
  const craftPool = list.filter(q => craftIds.has(q.id));
  const priority = CRAFT_READING_FIRST_IDS
    .map(id => craftPool.find(q => q.id === id))
    .filter(q => q && (st(q.id).w + st(q.id).c === 0 || isHard(q.id)))
    .slice(0, Math.min(2, Math.max(1, Math.floor(n / 5))));
  const prefPriority = prefecturePriority(basic.filter(q => !priority.some(p => p.id === q.id)), n).slice(0, Math.max(0, normalCount - priority.length));
  const reserved = new Set(prefPriority.map(q => q.id));
  const chosen = prefPriority.concat(pick(basic.filter(q => !craftIds.has(q.id) && !reserved.has(q.id)), Math.max(0, normalCount - priority.length - prefPriority.length)));
  // 発展は多くても1問。未出題を優先し、あれば復習も残す。
  if (allowAdvanced) chosen.push(...pick(advanced, 1));
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
    for (const q of pick(basic.filter(q => !used.has(q.id)), n - mixed.length)) {
      if (mixed.length >= n) break;
      mixed.push(q);
    }
  }
  return mixed.slice(0, n);
}

function pool() {
  const sel = (units[filter] || []);
  return qs().filter(q => (filter === '全部' && q.subject !== '国語・語彙') || (filter === 'ちず' ? !!q.map : filter === 'かく' ? q.type === 'input' : q.subject === filter && (!sel.length || sel.includes(groupOf(q)))));
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
  'ri-0079': { src: 'images/sound-wave-amplitude-compare-ab.svg', alt: 'AとBは4回ずつ振動し、Bの振れ幅はAの2倍である波形' },
  'ri-0080': { src: 'images/sound-wave-amplitude.svg', alt: '中央線から山の頂上までが振れ幅であることを示す波形' },
  'ri-0081': { src: 'images/sound-wave-two-cycles.svg', alt: '同じ時間に2回振動する波形' },
  'ri-0082': { src: 'images/sound-wave-grid-two.svg', alt: '中央線から山までが2マスの波形' },
  'ri-0083': { src: 'images/sound-wave-change.svg', alt: '波の数を半分にして振れ幅を2倍にした波形の比較' },
  'ri-0085': { src: 'images/sound-wave-change.svg', alt: '低くて大きい音の波形と元の波形の比較図' }
};
// 鳥の分類は文章の連結ではなく、種類ごとのカードで読みやすく整理する。
function birdCategoryHtml(q) {
  if(q.subject!=='理科'||q.unit!=='鳥のなかま')return null;
  const raw=expText(q)||'';
  const ix=raw.indexOf('　【{鳥|とり}の4つの{分|わ}け{方|かた}】');
  const first=ix>=0?raw.slice(0,ix):raw;
  const main=first.replace(/　+$/,'');
  const rows=[
    ['{漂鳥|ひょうちょう}','{夏|なつ}は{山地|さんち}、{冬|ふゆ}は{平地|へいち}へ{移動|いどう}','ウグイス・ヒヨドリ'],
    ['{夏鳥|なつどり}','{春|はる}に{南|みなみ}から{日本|にほん}へ{来|く}る','ツバメ・カッコウ'],
    ['{冬鳥|ふゆどり}','{秋|あき}に{北|きた}から{日本|にほん}へ{来|く}る','ツグミ・マガモ'],
    ['{留鳥|りゅうちょう}','{一年中|いちねんじゅう}、{同|おな}じ{地域|ちいき}でくらす','スズメ']
  ];
  const cards=rows.map(([name,desc,examples])=>
    '<div class="bird-kind"><div class="bird-kind-name">'+ruby(name)+'</div><div class="bird-kind-desc">'+ruby(desc)+'</div><div class="bird-kind-ex">例：'+examples+'</div></div>'
  ).join('');
  return '<div class="exp bird-explain">'+
    (main?'<p class="bird-answer-point">'+ruby(main)+'</p>':'')+
    '<div class="bird-kind-title">🐦 鳥の4つの分け方</div>'+
    '<div class="bird-kind-grid">'+cards+'</div>'+
    '<p class="bird-kind-note"><b>覚えるポイント</b>　漂鳥は山地と平地を移動。夏鳥は南から、冬鳥は北から日本に来る。</p>'+
    '</div>';
}
function expHtml(q) {
  const bird=birdCategoryHtml(q);
  if(bird!==null)return bird;
  const t = expText(q);
  const im = EXPLANATION_IMAGES[q.id];
  // 音の問題：正解・不正解のあとに「高さ」と「大きさ」を毎回見比べられる。
  // 同じ時間に並ぶ波の数は音の高さ、中央線から山・谷までの振れ幅は音の大きさ。
  const soundGuide = q.subject === '理科' && ['音の高さ', '音の大きさ', '波形の読み方'].includes(q.unit) && q.id !== 'ri-0073'
    ? '<section class="sound-wave-guide" aria-label="音の波形の見方" style="margin-top:12px;padding:12px;background:#f4faff;border:2px solid #9dc6e7;border-radius:14px;line-height:1.6;color:#1d3653">' +
      '<strong style="display:block;font-size:19px;margin-bottom:8px">図を見ながら音をくらべよう</strong>' +
      '<div style="background:white;padding:10px;border-radius:12px;margin-bottom:12px">' +
        '<strong style="font-size:17px">① 音の高さ ＝ <mark style="background:#bceaff;border-radius:4px;padding:1px 4px"><b>横に並ぶ波の数</b></mark></strong>' +
        '<img src="images/sound-wave-count.svg?v=guide-diagram-2" loading="eager" alt="Aは同じ時間に波が4個、Bは8個の波形。Bのほうが音が高い" style="display:block;width:100%;height:auto;margin:8px auto">' +
        '<p style="margin:6px 0;font-weight:bold">図のA：4個 → <mark style="background:#bceaff;padding:1px 4px"><b>低い音</b></mark><br>図のB：8個 → <mark style="background:#bceaff;padding:1px 4px"><b>高い音</b></mark></p>' +
        '<p style="margin:6px 0"><b><u>同じ時間</u></b>なら、<mark style="background:#bceaff"><b>波が多いほど高い音</b></mark>。山から次の山までの横幅がせまくなるよ。</p>' +
      '</div>' +
      '<div style="background:white;padding:10px;border-radius:12px;margin-bottom:12px">' +
        '<strong style="font-size:17px">② 音の大きさ ＝ <mark style="background:#ffe69a;border-radius:4px;padding:1px 4px"><b>縦の振れ幅（ふれはば）</b></mark></strong>' +
        '<img src="images/sound-wave-amplitude-compare-ab.svg?v=guide-diagram-2" loading="eager" alt="同じ波の数でAは振れ幅1、Bは振れ幅2。縦の大きさだけが違う" style="display:block;width:100%;height:auto;margin:8px auto">' +
        '<p style="margin:6px 0;font-weight:bold">図のA：振れ幅1 → <mark style="background:#ffe69a;padding:1px 4px"><b>小さい音</b></mark><br>図のB：振れ幅2 → <mark style="background:#ffe69a;padding:1px 4px"><b>大きい音</b></mark></p>' +
        '<p style="margin:6px 0">オレンジの印を見てね。<b><u>中央の線から山のてっぺんまで</u></b>が振れ幅。<mark style="background:#ffe69a"><b>振れ幅が大きいほど大きい音</b></mark>。波の数が同じなら音の高さは変わらないよ。</p>' +
      '</div>' +
      '<div style="background:white;padding:10px;border-radius:12px;margin-bottom:12px">' +
        '<strong style="font-size:17px">③ 振れ幅はどこ？</strong>' +
        '<img src="images/sound-wave-amplitude.svg?v=guide-diagram-2" loading="eager" alt="中央線から山までを示す矢印。山から谷まで全部ではない" style="display:block;width:100%;height:auto;margin:8px auto">' +
        '<p style="margin:6px 0">中央線から山までが1つの振れ幅。山から谷まで全部の長さは、振れ幅の<b>2倍</b>になるよ。</p>' +
      '</div>' +
      '<div style="background:#fff2cb;padding:10px;border-radius:12px">' +
        '<strong style="font-size:17px">④ 波形をかくとき</strong>' +
        '<img src="images/sound-wave-change.svg?v=guide-diagram-2" loading="eager" alt="波が4個で振れ幅2マスの波を、波が2個で振れ幅4マスに変えた図" style="display:block;width:100%;height:auto;margin:8px auto;background:white;border-radius:8px">' +
        '<p style="margin:6px 0">上の波：4個・振れ幅2マス。下の波：2個・振れ幅4マス。<b>波の数が半分→音は低くなる／振れ幅が2倍→音は大きくなる。</b></p>' +
      '</div>' +
      '<p style="margin:10px 2px 0;font-weight:900;text-align:center"><span style="display:block;background:#bceaff;border-radius:7px;padding:5px">横の波の数 → 音の高さ</span><span style="display:block;background:#ffe69a;border-radius:7px;padding:5px;margin-top:6px">縦の振れ幅 → 音の大きさ</span></p>' +
    '</section>' : '';
  // 結城紬の写真は「解答後の解説」にも載せる。建物や機織り機ではなく、織物そのもの。
  if (q.id === 'sha-0067') {
    return '<div class="exp"><b>結城紬（ゆうきつむぎ）</b>は、茨城県の結城市などで作られる伝統的な絹織物だよ。<br>写真は結城紬の亀甲柄（きっこうがら）の布だよ。' +
      '<figure style="margin:12px auto;max-width:400px;text-align:center">' +
      '<img src="https://upload.wikimedia.org/wikipedia/commons/2/25/Yuki-kikko.JPG" alt="結城紬の亀甲柄の絹織物の写真" loading="eager" referrerpolicy="no-referrer" style="width:100%;height:auto;border-radius:10px;background:white">' +
      '<figcaption style="font-size:12px;line-height:1.6">結城紬の織物そのもの（撮影：Moraykaita／CC BY-SA 3.0）<br><a target="_blank" rel="noopener noreferrer" href="https://commons.wikimedia.org/wiki/File:Yuki-kikko.JPG">写真を大きく見る</a></figcaption></figure></div>';
  }
  // 九谷焼：答え合わせ後にも九谷焼そのものの写真と短い説明を見せる。
  if (q.id === 'sha-0042' || q.id === 'sha-0337' || q.id === 'sha-0523') {
    const filename='Clevelandart 1960.174.jpg';
    const photoUrl='https://commons.wikimedia.org/wiki/Special:Redirect/file/'+encodeURIComponent(filename)+'?width=580';
    const detailUrl='https://commons.wikimedia.org/wiki/File:Clevelandart_1960.174.jpg';
    return '<div class="exp kutani-exp"><p>'+qr(t,q)+'</p>'+
      '<figure style="margin:12px auto;max-width:390px;text-align:center">'+
      '<img src="'+photoUrl+'" alt="九谷焼の色あざやかな絵付けの皿" loading="eager" referrerpolicy="no-referrer" style="display:block;width:100%;height:auto;max-height:310px;object-fit:contain;background:#fff;border-radius:10px">'+
      '<figcaption style="font-size:12px;line-height:1.6">九谷焼の色絵皿（クリーブランド美術館／CC0）<br>'+
      '<a href="'+detailUrl+'" target="_blank" rel="noopener noreferrer">写真を大きく見る</a></figcaption></figure></div>';
  }
  if (!t && !im && !soundGuide) return '';
  const fig = im ? '<figure style="margin:12px 0 4px"><img src="' + im.src + '?v=20261120-1" alt="' + im.alt + '" loading="eager" style="display:block;width:100%;max-width:560px;height:auto;margin:0 auto;border-radius:12px;background:#fff"><figcaption style="text-align:center;font-size:13px;color:#555;margin-top:5px">図で位置を確認してみよう</figcaption></figure>' : '';
  return '<div class="exp">' + (t ? qr(t, q) : '') + fig + soundGuide + '</div>';
}
// 音の波の図：答えを先に示さないものだけ問題中にも表示する。
const QUESTION_WAVE_IMAGES = {
  'ri-0073': 'images/glass-water-a-b.svg',
  'ri-0076': 'images/glass-water-a-b.svg',
  'ri-0078': 'images/sound-wave-count.svg',
  'ri-0079': 'images/sound-wave-amplitude-compare-ab.svg',
  'ri-0081': 'images/sound-wave-two-cycles.svg',
  'ri-0082': 'images/sound-wave-grid-two.svg',
  'ri-0083': 'images/sound-wave-original-4-amp2.svg',
  'ri-0092': 'images/bottle-blow-water-a-b.svg'
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
  if (!['社会', '理科'].includes(q.subject) || !q.photo || (!q.photo.file && !q.photo.url)) return '';
  const filename = q.photo.file || '';
  const fileUrl = q.photo.sourceUrl || ('https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(filename));
  const imgUrl = q.photo.url || (filename === 'Yuki-kikko.JPG' ? 'https://upload.wikimedia.org/wikipedia/commons/2/25/Yuki-kikko.JPG' : 'https://commons.wikimedia.org/wiki/Special:Redirect/file/' + encodeURIComponent(filename) + '?width=580');
  const sourceName = q.photo.sourceName || 'Wikimedia Commons';
  return '<figure style="max-width:460px;margin:10px auto 14px;text-align:center">' +
    '<img src="' + imgUrl + '" alt="問題の参考写真" loading="eager" referrerpolicy="no-referrer" ' +
    'style="display:block;max-width:100%;width:100%;max-height:275px;object-fit:contain;border-radius:12px;background:#f6f6f6" ' +
    'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
    '<div style="display:none;padding:14px;font-size:13px">写真を表示できませんでした。下の「写真のページ」から写真を見てね。</div>' +
    '<figcaption style="font-size:12px;line-height:1.7;color:#666">出典：' + esc(sourceName) + '　' +
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

// 答え合わせは画面下への追記ではなく、全画面で結果から先に見せる。
function closeFeedbackScreen() {
  const old = document.getElementById('quiz-feedback-screen');
  if (old) old.remove();
}
// 冒険表示は保存処理の状態に左右されず、正誤画面で必ず知らせる。
// RPG処理が停止したときに成功したように見せず、エラーを見える形で伝える。
function quizRpgFeedbackHtml() {
  if (!S || !S.rpg) return '';
  const r = window.RPG;
  const alive = !!(r && r.ok && r.save && r.save.active);
  const base = alive && typeof r.answerProgressHtml === 'function' ? r.answerProgressHtml(S) : '';
  if (base) return base;
  const n = alive ? Math.max(0, Number(r.save.active.basic.n) || 0) : Math.min(10, S.idx + 1);
  return '<div class="quiz-rpg-progress" role="status" style="margin:12px 0;padding:12px;border:2px solid #d7b66c;background:#1f3157;color:#fff;border-radius:14px;text-align:center;font-weight:800;line-height:1.6">' +
    '⚔️ 冒険 ' + n + ' / 10問' +
    (!alive ? '<div style="font-size:13px">RPGの進行状態を確認できません。学習履歴は別に保存されています。アプリを更新して確認してください。</div>' : '') +
    '</div>';
}
function showAnswerFeedback(q, ok, skipped) {
  if (!S) return;
  S.explanationViewed = false;
  closeFeedbackScreen();
  const heading = ok ? '○ せいかい！' : skipped ? '？ わかんない' : '× ざんねん！';
  const subtitle = ok ? 'やったね！' : '答えと解説を確認しよう';
  const screen = document.createElement('section');
  screen.id = 'quiz-feedback-screen';
  screen.className = 'quiz-feedback-screen ' + (ok ? 'is-correct' : 'is-incorrect');
  screen.setAttribute('role', 'dialog');
  screen.setAttribute('aria-modal', 'true');
  screen.setAttribute('aria-label', ok ? 'せいかい' : skipped ? 'わかんない' : 'ざんねん');
  screen.innerHTML = '<div class="quiz-feedback-inner" id="quiz-feedback-inner">'+
    '<div class="quiz-feedback-verdict" id="quiz-feedback-verdict">'+
    '<div class="quiz-feedback-symbol">'+(ok ? '○' : skipped ? '？' : '×')+'</div>'+
    '<h2 class="quiz-feedback-title">'+heading+'</h2>'+
    '<p class="quiz-feedback-subtitle">'+subtitle+'</p>'+
    (!ok && !skipped && S.rpg ? '<div class="quiz-hit-stage" aria-label="敵から攻撃を受けた戦闘場面"><div class="quiz-hit-caption">⚔️ 敵の攻撃！</div>' + (window.RPG && RPG.stripHtml ? RPG.stripHtml(S) : '') + '<span class="quiz-hit-slash" aria-hidden="true"></span><span class="quiz-hit-impact" aria-hidden="true">ビシュッ！</span></div>' : (window.RPG && RPG.stripHtml ? RPG.stripHtml(S) : ''))+
    quizRpgFeedbackHtml()+
    '<button type="button" class="quiz-feedback-action" id="quiz-show-explanation">答えと解説を見る ▶</button>'+
    '</div></div>';
  document.body.appendChild(screen);
  if (window.RPG && S.rpg && RPG.ok && RPG.mount) RPG.mount();
  screen.scrollTop = 0;
  const show = document.getElementById('quiz-show-explanation');
  show.onclick = () => {
    if (show.disabled) return;
    show.disabled = true;
    const detail = document.getElementById('quiz-feedback-inner');
    if (!detail) return;
    const explanation = expHtml(q);
    detail.innerHTML = '<div class="quiz-feedback-detail">'+
      '<h2 class="quiz-feedback-detail-title">'+heading+'</h2>'+
      '<div class="feedback-answer"><span>正しい答え</span><strong>'+ruby(q.a)+'</strong></div>'+
      (explanation || '<div class="exp">答えを確認できたね！</div>')+
      (window.RPG && RPG.stripHtml ? RPG.stripHtml(S) : '')+
      quizRpgFeedbackHtml()+
      '<button type="button" class="quiz-feedback-action" id="quiz-next-question">つぎの問題へ ▶</button>'+
      '</div>';
    if (q.prefExplain) {
      const mapBox = document.createElement('div');
      mapBox.style.cssText = 'background:white;border-radius:12px;padding:10px;margin:12px 0;color:#222;text-align:center';
      const label = document.createElement('strong');
      label.textContent = q.prefExplain + 'の位置（関東・中部の地図）';
      mapBox.appendChild(label);
      const drawing = document.createElement('div');
      mapBox.appendChild(drawing);
      detail.querySelector('.quiz-feedback-detail').insertBefore(mapBox, detail.querySelector('#quiz-next-question'));
      loadMaps().then(([md,ft]) => {
        if (!mapBox.isConnected) return;
        renderMap(drawing, md, ft, {hl:q.prefExplain}, {aspect:1.7, overview:true});
      }).catch(() => {drawing.textContent='地図を読み込めませんでした。';});
    }
    S.explanationViewed = true;
    if (window.RPG && S.rpg && RPG.ok && RPG.mount) RPG.mount();
    screen.scrollTop = 0;
    const next = document.getElementById('quiz-next-question');
    next.onclick = () => {
      if (next.disabled || !S || !S.explanationViewed) return;
      next.disabled = true;
      closeFeedbackScreen();
      advance();
    };
  };
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
  if (!MAMA && window.RPG && RPG.dailyStudyReward) RPG.dailyStudyReward(day, daily[day]);
}
// 途中終了しても残る回答数を表示する（進行データそのものは毎問保存済み）。
function totalSolved() {
  return Object.values(stats).reduce((sum, v) => sum + (Number(v.c) || 0) + (Number(v.w) || 0), 0);
}
function answeredProgressHtml() {
  const active = window.RPG && RPG.ok && RPG.save && RPG.save.active;
  const adventure = active ? ' ／ 冒険 ' + active.basic.n + ' / 10問' : '';
  return '📘 今日 ' + todaySolved() + '問 ／ 累計 ' + totalSolved() + '問' + adventure + '<small style="display:block;font-size:12px;font-weight:600">途中でやめても、解いた数は保存されます</small>';
}
function refreshAnsweredProgress() {
  const el = document.getElementById('answered-progress');
  if (el) el.innerHTML = answeredProgressHtml();
}
// ---------- 画面：最初 ----------
function home() {
  window.__ichimonQuizRunning = false;
  if (!MAMA && window.RPG && RPG.cloud && RPG.cloud.autoCheck) RPG.cloud.autoCheck(true);
  if (window.RPG && RPG.sound) RPG.sound.setScene(false);
  app.className = ''; if (window.RPG) RPG.unmount();
  if (!MAMA && window.RPG && RPG.dailyStudyReward) RPG.dailyStudyReward(now().slice(0, 10), todaySolved());
  if (!MAMA && window.RPG && RPG.visitBonus) RPG.visitBonus(now().slice(0,10));
  if (!MAMA && window.RPG && RPG.lifeSync) RPG.lifeSync(stats,now().slice(0,10),todaySolved());
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
  const savedQuiz = pausedQuiz();
  const rangeOpen = !!window.__rangeOpen;
  const subjectsHtml = `<div class="subjects">${card(rpgOn ? ruby('{全部|ぜんぶ}') : 'ぜんぶ', all.filter(q => q.subject !== '国語・語彙'), 'all', '全部')}${subs.map(s => card(s, all.filter(q => q.subject === s), '', s)).join('')}${all.some(q => q.map) ? card(rpgOn ? ruby('{地図|ちず}') : 'ちず', all.filter(q => q.map), '', 'ちず') : ''}${all.some(q => q.type === 'input') ? card(rpgOn ? ruby('{書|か}いて{答|こた}える') : 'かいて こたえる', all.filter(q => q.type === 'input'), '', 'かく') : ''}</div>
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
  const continueHtml = savedQuiz ? '<button class="big go" id="resume-paused">▶ 保存した問題の続きから（' + (savedQuiz.idx + 1) + '問目）</button>' : '';
  const startHtml = continueHtml + goHtml + testHtml + hardHtml + pendingHtml + wrongHtml;
  const unitN = (units[filter] || []).length;
  const rangeName = (filter === '全部' ? ruby('{全部|ぜんぶ}') : esc(filter)) + (unitN ? `（${unitN}${ruby('{単元|たんげん}')}）` : '');
  const activeRangeHtml = '<div class="kid-current-range" data-noruby style="padding:10px 14px;margin:8px 10px;background:#e8f5ff;border:2px solid #7db4e3;border-radius:12px;color:#164773;font-weight:800;line-height:1.6">📚 今の学習範囲：' +
    esc(filter === '全部' ? '全教科' : filter === 'ちず' ? '地図問題' : filter === 'かく' ? '書いて答える問題' : filter) +
    ((filter !== '全部' && filter !== 'ちず' && filter !== 'かく') ? (unitN ? '（' + units[filter].map(x => esc(x)).join('・') + '）' : '（全単元）') : '') +
    '<br>出題対象：' + p.length + '問</div>';
  const pointBalance = rpgOn && window.RPGLife && RPG.save
    ? RPGLife.ensure(RPG.save).foodPoints || 0 : 0;
  const pointBalanceHtml = rpgOn
    ? '<div class="home-point-balance" data-noruby aria-label="現在の買い物ポイント" style="margin:8px 10px;padding:11px 14px;border-radius:12px;border:2px solid #d6b35c;background:#fff8df;color:#5d430b;font-size:18px;font-weight:900;text-align:center">⭐ 現在のポイント：' + pointBalance + 'ポイント <span style="font-size:12px;display:block;margin-top:4px;font-weight:600">1問正解で1ポイント　｜　マイワールドで使えるよ</span></div>'
    : '';
  const testName = `${esc(current.name)}${current.date ? '（' + esc(current.date.slice(5).replace('-', '/')) + '）' : ''}`;
  app.innerHTML = rpgOn ? `
    <div class="rs rs3 rs-homewrap" id="rsRoot" data-rb><main class="rs-body rs-homebody" id="rsBody">
    
    ${MAMA ? '' : '<div class="kid-refresh-lead"><button type="button" class="kid-refresh-btn kid-refresh-primary" id="kid-refresh" aria-label="最新版に更新する"><span class="kid-refresh-main">↻ アプリを更新</span></button></div>'}
    ${activeRangeHtml}
    ${pointBalanceHtml}
    <div class="rs-topbar"><span class="rs-testname">${testName}</span><button class="rs-rangebtn" id="rsRangeBtn">${ruby('{範囲|はんい}を{変|か}える')}</button></div>
    ${RPG.homeTop()}
    <div class="rs-daily-count" style="text-align:center;padding:8px 12px;font-weight:bold;font-size:16px;color:#49416e" data-noruby>📘 きょう解いた問題：${todaySolved()}問</div>
    ${!MAMA && RPG.studyMilestones ? (() => { const m = RPG.studyMilestones(stats); return `<div class="rs-daily-count" style="text-align:center;padding:7px 12px;font-weight:bold;color:#49416e" data-noruby>🏆 累計 ${m.total}問 ／ 次のごほうび ${m.next}問まで あと${m.next-m.total}問（100問ごと）</div>`; })() : ''}
    ${!MAMA ? (() => { const n = todaySolved(),done=n>=30; return `<section class="rs-30reward ${done ? "done" : ""}" aria-label="今日の30問チャレンジ" data-noruby><div class="rs-30reward-head"><strong>${done ? "🎉 30問達成！" : "🎁 今日の30問チャレンジ"}</strong><span>${Math.min(n,30)}/30問</span></div><div class="rs-30reward-track" role="progressbar" aria-label="今日の30問" aria-valuemin="0" aria-valuemax="30" aria-valuenow="${Math.min(n,30)}"><span style="width:${Math.min(100,Math.max(0,n/30*100))}%"></span></div><p>${done ? "ごほうびをゲット！ 宝箱は下の「未開封の宝箱」から開けられるよ。" : "30問解くと 🎁 宝箱 ＋ 🗺️ 地図のかけら ＋ 🧱 建築素材 がもらえるよ！"}</p>${done ? "<small>地図のかけらと素材はマイワールドに追加済み！</small>" : `<small>ごほうびまで、あと${30-n}問！</small>`}</section>`; })() : ""}
    ${!MAMA && RPG.visitInfo ? (() => { const v=RPG.visitInfo(); if(!v)return ''; const r=v.lastReward,idx=(v.total-1)%7,slots=v.rewards.map((x,i)=>`<span class="rs-visit-dot ${i<=idx?'got':''}" title="${i+1}回目：${x.name}">${i<=idx?'✓':i+1}</span>`).join(''); return `<section class="rs-visit-reward" data-noruby aria-label="訪問ボーナス"><div class="rs-visit-title"><strong>🎁 冒険のごほうび</strong><b>${v.total?((v.total-1)%7+1):0}/7回</b></div><p>${r&&r.day===now().slice(0,10)?'今日のプレゼント：'+r.emoji+' '+r.name+' をゲット！':'アプリを開くと1日1回プレゼント！'}</p><div class="rs-visit-steps" aria-label="7回訪問の進み具合">${slots}</div><small>${v.total%7===0?'🎉 7回目の特別な宝箱をゲット！ 宝箱から開けよう！':'あと'+(7-v.total%7)+'回の訪問で 🎁 特別な宝箱！'}　休んでも進み具合はそのまま。</small></section>`; })() : ''}
    ${RPG.homeBonus()}
    ${continueHtml}${goHtml}${testHtml}
    <div class="rs-pair"><details class="rs-range"${rangeOpen ? ' open' : ''}><summary class="rs-rangerow">${ruby('{範囲|はんい}')}：<b>${rangeName}</b><span class="rs-chg">${ruby('{変更|へんこう}')}</span></summary>
      <div class="rs-sheetbg" id="rsRangeBg"><div class="rs-sheet" role="dialog" aria-modal="true" aria-label="学習範囲の変更"><div class="rs-sheet-h"><b>${ruby('{学習範囲|がくしゅうはんい}の{変更|へんこう}')}</b><button class="rs-sheet-x" id="rsRangeX">とじる</button></div><div class="rs-sheet-b">${subjectsHtml}</div></div></div></details>
      ${hardHtml}${pendingHtml}${wrongHtml}</div>
    <div class="credit" data-noruby>地図：国土数値情報（行政区域データ）を加工して作成</div>
    </main><footer class="rs-foot">${RPG.navHtml('home')}</footer></div>` : `
    
    <h1>一問一答</h1>
    ${activeRangeHtml}
    ${pointBalanceHtml}
    ${MAMA ? '' : '<div class="kid-refresh-lead"><button type="button" class="kid-refresh-btn kid-refresh-primary" id="kid-refresh" aria-label="最新版に更新する"><span class="kid-refresh-main">↻ アプリを更新</span></button></div>'}
    ${MAMA ? '<div class="mama"><b>ママ用</b>（風助の記録とは別）<a href="list.html">問題の一覧を見る</a>　<a href="history.html">風助の解答履歴を見る</a><button type="button" class="big test" id="mama-rpg-retry" style="margin-top:12px">🎮 冒険を起動する</button><div id="mama-rpg-status" style="font-size:13px;margin-top:8px">冒険の状態：' + (window.RPG ? (RPG.ok ? '起動中' : '準備できていません（' + (RPG.err || '原因確認中') + '）') : '読み込みができていません') + '</div></div>' : ''}
    <div class="sub">${esc(current.name)}${current.date ? '（' + esc(current.date.slice(5).replace('-', '/')) + '）' : ''}</div>
    ${window.RPG ? RPG.homeTop() : ''}
    ${subjectsHtml}
    <div style="text-align:center;padding:8px 12px;font-weight:bold" data-noruby>📘 きょう解いた問題：${todaySolved()}問</div>
    ${startHtml}
    ${window.RPG ? RPG.homeHtml() : ''}
    <div class="credit" data-noruby>地図：国土数値情報（行政区域データ）を加工して作成</div>
    ${window.RPG ? RPG.navHtml('home') : ''}`;
  if (MAMA && !rpgOn) {
    const btn = document.getElementById('mama-rpg-retry');
    if (btn) btn.onclick = () => {
      btn.disabled = true;
      const status = document.getElementById('mama-rpg-status');
      try {
        if (!window.RPG || typeof RPG.init !== 'function') throw new Error('RPGスクリプト未読込');
        RPG.init();
        if (!RPG.ok) throw new Error('起動できません：' + (RPG.err || '初期化エラー'));
        home();
      } catch (e) {
        if (status) status.textContent = '冒険を起動できませんでした：' + (e.message || String(e));
        btn.disabled = false;
      }
    };
  }
  { const refresh = document.getElementById('kid-refresh'); if (refresh) refresh.onclick = refreshKidApp; }
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
  const resumeButton = document.getElementById('resume-paused');
  if (resumeButton) resumeButton.onclick = () => restorePausedQuiz();
  document.getElementById('go').onclick = e => beginKidSession(() => pickStart(pool(), ROUND), '', e.currentTarget);
  document.getElementById('hard').onclick = e => beginKidSession(() => pick(pool().filter(q => isHard(q.id)), ROUND), 'hard', e.currentTarget);
  document.getElementById('everwrong').onclick = e => beginKidSession(() => pick(pool().filter(q => wasWrong(q.id)), ROUND), 'everwrong', e.currentTarget);
  const tb = document.getElementById('testp');
  if (tb) tb.onclick = e => beginKidSession(() => pick(pickPool(), ROUND), 'pick', e.currentTarget);
}

// 解きかけの問題はRPGのセーブに同梱して、3台で引き継ぐ。
// クイズの解答履歴（stats）は従来どおり別の仕組みで管理する。
function pausedQuiz() {
  if (!MAMA && window.RPG && RPG.ok) return RPG.save.quizResume || null;
  return load('ichimon.quiz.paused.v1' + LS_SFX, null);
}
function packQuestion(q) {
  return { id: q.id, rv: q._rv ? JSON.parse(JSON.stringify(q._rv)) : null };
}
function snapshotQuiz() {
  return {
    v: 1, from: S.from, sess: S.sess, idx: S.idx, total: S.total,
    reask: S.reask, rpg: S.rpg, correct: S.correct, skips: S.skips,
    queue: S.queue.map(packQuestion), wrong: S.wrong.map(q => q.id),
    wrongIds: [...S.wrongIds], seen: [...S.seen],
    reaskedIds: [...S.reaskedIds], lastOrigin: S.lastOrigin || null,
    at: Date.now()
  };
}
function clearPausedQuiz() {
  if (!MAMA && window.RPG && RPG.ok) {
    if (RPG.save.quizResume) {
      RPG.save.quizResume = null;
      RPG.persist();
    }
  } else {
    lsSet('ichimon.quiz.paused.v1' + LS_SFX, '');
  }
}
function restorePausedQuiz() {
  const saved = pausedQuiz();
  if (!saved || saved.v !== 1 || !Array.isArray(saved.queue) ||
      !Number.isInteger(saved.idx) || saved.idx < 0 || saved.idx >= saved.queue.length) return false;
  const available = new Map(DATA.questions.map(q => [q.id,q]));
  const restored = saved.queue.map(k => {
    const base = available.get(k.id);
    if(!base)return null;
    if(!k.rv)return base;
    const item = Object.create(base);
    item._rv = k.rv;
    return item;
  });
  if(restored.some(q => !q)) { alert('保存した問題が更新されました。今回は再開できません。'); return false; }
  S = {
    from: saved.from || '', sess: saved.sess || (dev.slice(0,4) + '-' + Date.now().toString(36)),
    queue: restored, idx: saved.idx, total: saved.total, reask: saved.reask || 0,
    rpg: !!saved.rpg, correct: saved.correct || 0,
    wrong: (saved.wrong || []).map(id => available.get(id)).filter(Boolean),
    wrongIds: new Set(saved.wrongIds || []), skips: saved.skips || 0,
    seen: new Set(saved.seen || []), reaskedIds: new Set(saved.reaskedIds || []),
    lastOrigin: saved.lastOrigin || null, locked: false, timer: null
  };
  question();
  return true;
}
async function pauseAndSaveQuiz() {
  if (!S) return;
  const button = document.getElementById('pauseSave');
  if(button){button.disabled=true;button.textContent='保存中…';}
  // 答えを表示済みの場合は次の問題から再開し、採点・報酬の二重計上を防ぐ。
  if (S.locked) {
    if (S.idx + 1 >= S.queue.length) { result(); return; }
    S.idx++;
    S.locked = false;
  }
  const state=snapshotQuiz();
  window.__ichimonQuizRunning = false;
  let savedLocally = false;
  if (!MAMA && window.RPG && RPG.ok) {
    RPG.save.quizResume = state;
    savedLocally = RPG.persist();
  } else {
    const key='ichimon.quiz.paused.v1' + LS_SFX;
    try { const txt=JSON.stringify(state); localStorage.setItem(key,txt); savedLocally=localStorage.getItem(key)===txt; } catch(e){}
  }
  if (!savedLocally) {
    if(button){button.disabled=false;button.textContent='ここまで保存してやめる';}
    alert('保存できませんでした。アプリを閉じずにもう一度試してください。');
    return;
  }
  let shared=false, reason='';
  if (!MAMA && window.RPG && RPG.cloud) {
    try {
      const result=await RPG.cloud.push(false,true);
      shared=!!result.ready && result.status === '同期済み';
      reason=result.status||'';
    } catch(e){reason='クラウドに接続できません';}
  }
  clearTimeout(S.timer);
  app.onclick=null;
  S=null;
  home();
  alert(shared
    ? 'ここまで保存しました！ ほかの端末でも「最新を確認」してから続きから再開できます。'
    : 'この端末に保存しました。'+(reason?'\nクラウド共有：'+reason+'\n':'\n')+'ほかの端末ではまだ再開できません。');
}
// ---------- 回 ----------
function start(list, from, opts) {
  if (pausedQuiz()) clearPausedQuiz();
  if (window.RPG && RPG.sound) RPG.sound.setScene(false);
  // opts.manual：手動の「まちがえたのだけ もう1回」。ぼうけん（RPG）には影響しない
  let pre = { list, reviews: [], reask: 0, rpg: false };
  if (!(opts && opts.manual) && window.RPG) pre = RPG.beforeStart(list, new Set(pool().map(q => q.id)));
  list = pre.list;
  if (!(opts && opts.manual) && !from) rememberRound(list);
  if (!list.length && !pre.reviews.length) return home();
  S = { from: from || '', sess: dev.slice(0, 4) + '-' + Date.now().toString(36), queue: pre.reviews.concat(list), idx: 0, total: list.length, reask: pre.reask, rpg: pre.rpg, correct: 0, wrong: [], wrongIds: new Set(pre.reviews.map(r => r.id)), skips: 0, seen: new Set(), reaskedIds: new Set(), locked: false, timer: null };
  question();
}
// 間違えた問題を3問あとにもう一度（1回の延長は最大5問）。ぼうけん中は冒険単位で数える
function reask(q) {
  // 通常スタートでは間違えた直後の再出題をしない。復習専用/手動では従来どおり。
  if (!S.from) return;
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
  window.__ichimonQuizRunning = true;
  closeFeedbackScreen();
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
    <button type="button" id="pauseSave" aria-label="いまの問題の途中までを保存してやめる" style="display:block;position:relative;z-index:2;width:calc(100% - 8px);margin:4px 4px 14px;min-height:56px;background:#fff2c1;color:#533800;border:3px solid #d6a72b;border-radius:14px;font-size:17px;font-weight:900;box-shadow:0 3px 0 #bb9330">💾 途中まで保存してやめる</button>
    <div class="bar"><i style="width:${(S.idx / S.queue.length) * 100}%"></i></div>
    ${window.RPG ? RPG.stripHtml(S) : ''}
    <div id="answered-progress" aria-live="polite" style="text-align:center;background:#edf6ff;border:2px solid #b9d7f6;border-radius:12px;padding:7px 8px;color:#244777;font-size:15px;font-weight:800;margin-bottom:12px">${answeredProgressHtml()}</div>
    ${isIn ? '' : '<div class="skipw skipw-top"><span class="skip-location-label">こたえが わからないとき</span><button type="button" class="skip" id="skipc">？ わかんない</button></div>'}
    <div class="quiz-layout-version" style="text-align:right;font-size:11px;opacity:.7;margin:0 4px 4px;color:#d6e3f4">画面配置：新しい版 B2</div>
    <div class="card${q.map ? ' withmap' : ''}${waveQuestionHtml(q) || birdPhotoHtml(q) || socialPhotoHtml(q) ? ' withillustration' : ''}" style="display:flex;flex-direction:column;align-items:stretch;gap:12px"><div class="qt" style="width:100%;min-width:0;max-width:100%;flex:none;white-space:normal;overflow-wrap:break-word;text-align:center">${qr(q.q, q)}</div>${waveQuestionHtml(q)}${birdPhotoHtml(q)}${socialPhotoHtml(q)}</div>
    ${q.map ? '<div class="map' + (isIn ? ' small' : '') + '" id="map"></div>' : ''}
    ${isIn ? `<div class="inbox"><input id="ans" class="ans" type="text" inputmode="text" lang="ja" placeholder="ひらがなで かいてね" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="done"><button class="big go" id="submit" disabled>こたえる</button><button class="skip" id="skip">わかんない</button></div>` : ''}
    <div class="choices">${opts.map((o, i) => `<button class="choice" data-i="${i}"><span class="dot"></span><span>${qr(o, q)}</span></button>`).join('')}</div>
    ${isIn ? '' : '<div class="decidew" id="decidew" hidden><button class="big go" id="decide">✓ これで けってい</button></div>'}

    <div class="next" id="next"></div>
    <div class="score">せいかい ${S.correct}こ</div>
    `;
  app.className = S.rpg ? 'inq' : '';
  if (window.RPG) RPG.mount();
  document.getElementById('pauseSave').onclick = pauseAndSaveQuiz;
  document.getElementById('quit').onclick = () => { clearTimeout(S.timer); app.onclick = null; flush(); home(); }; // 問題数・冒険進行は解答時に保存済み
  app.querySelectorAll('.choice').forEach(b => b.onclick = () => pickChoice(+b.dataset.i));
  const dec = document.getElementById('decide'); if (dec) dec.onclick = () => { if (S.locked || S.sel < 0) return; answer(S.sel); };
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
  if (ok) sfx('correct', 60);
  inp.blur(); inp.readOnly = true;
  document.getElementById('submit').disabled = true;
  document.getElementById('skip').disabled = true;
  if (skipped) S.skips++;
  record(q, ok, skipped ? 'わかんない' : String(text).trim(), skipped);
  if (ok) {
    if (!S.seen.has(q.id)) S.correct++;
    S.seen.add(q.id);
    inp.classList.add('ok');
    document.querySelector('.score').textContent = 'せいかい ' + S.correct + 'こ';
  } else {
    S.seen.add(q.id);
    if (!S.wrongIds.has(q.id)) { S.wrongIds.add(q.id); S.wrong.push(q); }
    inp.classList.add('ng');
    reask(q);
  }
  showAnswerFeedback(q, ok, skipped);
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
  btns.forEach(b => { b.classList.remove('sel'); b.disabled = true; });
  const dw = document.getElementById('decidew'); if (dw) dw.hidden = true;
  const skipBtn = document.getElementById('skipc'); if (skipBtn) skipBtn.disabled = true;
  if (ok) sfx('correct', 140);
  if (skipped) S.skips++;
  record(q, ok, picked, skipped);
  if (ok) {
    if (!S.seen.has(q.id)) S.correct++;
    S.seen.add(q.id);
    btns[i].classList.add('ok'); btns[i].querySelector('.dot').textContent = '○';
    document.querySelector('.score').textContent = 'せいかい ' + S.correct + 'こ';
  } else {
    S.seen.add(q.id);
    if (!S.wrongIds.has(q.id)) { S.wrongIds.add(q.id); S.wrong.push(q); }
    if (!skipped) { btns[i].classList.add('ng'); btns[i].querySelector('.dot').textContent = '×'; }
    btns.forEach((b, j) => { if (S.opts[j] === q.a) b.classList.add('glow'); else if (j !== i) b.classList.add('dim'); });
    reask(q);
  }
  showAnswerFeedback(q, ok, skipped);
}
function advance() {
  // 解説を確認するまでは、別の操作から呼ばれても次へ進めない。
  if (!S || !S.explanationViewed) return;
  S.explanationViewed = false;
  clearTimeout(S.timer); app.onclick = null;
  S.idx++;
  if (S.idx >= S.queue.length) return result();
  question();
}

// ---------- 画面：おわり ----------
function result() {
  window.__ichimonQuizRunning = false;
  closeFeedbackScreen();
  clearPausedQuiz();
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
    if (!S.from) {
      // 「次の10問」は専用配分。誤答が多い問題を通常学習に大量投入しない。
      start(pickNextNormal(p, done, ROUND), '');
      return;
    }
    const next = pick(fresh, ROUND);
    if (next.length < ROUND) next.push(...pick(p.filter(q => !done.has(q.id) && !next.some(n => n.id === q.id)), ROUND - next.length));
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
  if (!MAMA && window.RPG && RPG.studyMilestones) RPG.studyMilestones(stats);
  queue.seq++;
  const row = { rid: dev + '-' + queue.seq, t, test: q.test, qid: q.id, ok, pick: plain(picked), sess: S.sess };
  if (skipped) row.skip = 1;
  queue.rows.push(row);
  save(LS_Q, queue);
  addTodaySolved(day);
  if (!MAMA && window.RPG && RPG.lifeSync) RPG.lifeSync(stats,day,todaySolved());
  // ママ・風助とも、正解した1問につきペットのエサ購入ポイントを1付与。
  if (ok && window.RPG && RPG.earnFoodPoint) RPG.earnFoodPoint(row.rid);
  if (window.RPG) RPG.onAnswer(q, ok, row.rid, S);
  refreshAnsweredProgress();
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
Promise.all([fetch(PARAMS.get('data') || 'data/questions.json?v=vocabulary-20261125c', { cache: 'no-cache' }).then(r => r.json()), loadConf()]).then(([d, conf]) => {
  CONF = conf; OFF = new Set(conf.off);
  DATA = d; DATA.questions = applyEdits(d.questions, conf); current = d.tests.find(t => t.current) || d.tests[0];
  home(); flush();
}).catch(() => { app.innerHTML = '<div class="empty">もんだいを よみこめませんでした。<br>ネットを つないで もう一度ひらいてね。</div>'; });
