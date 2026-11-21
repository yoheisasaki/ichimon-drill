# 学習履歴API（スマホと iPad で履歴を共通にする）

## 目的
いまは「正解・不正解・初めて解いたか・復習の状況」が端末の localStorage（`ichimon.stats.v1`）にだけある。スマホで解いた問題が iPad では「初めて」に見え、iPad で間違えた問題がスマホの復習に出てこない。
アプリは記録を学習ボード（Apps Script）に送っている（app.js の `post()`）。その全端末ぶんの記録を読み返す API を足した。アプリ側でこれを読んで合わせれば、どの端末でも同じ状態で続きができる。

## URL と呼び方
- URL は common.js の `SEND_URL`（記録の送信先・ママの設定 `?api=ichimon_conf` と同じ）。
- 呼び方（GET、合言葉なし、JSON。CORS は ichimon_conf と同じ）:
```js
const r = await fetch((SEND_OVERRIDE || SEND_URL) + '?api=ichimon_history', { cache: 'no-cache' });
const h = await r.json(); // h.ok が true なら h.questions を使う
```
- 差分だけ欲しいとき: `?api=ichimon_history&since=<ISO日時>`。前回の応答の `generatedAt` を `since` に渡す。「since のあとにサーバーが受け取った行がある問題」だけが、attempts は全部入りで返る（`partial:true`）。マージは問題IDごとに丸ごと置き換えればよい。
- 応答時間は実測で約1〜3秒（333行・200問のとき）。起動時に待たせず、裏で取得して来たら反映する作りにする。

## 返る JSON
```json
{
  "ok": true, "ver": 1, "generatedAt": "2026-01-01T00:00:00.000Z", "partial": false,
  "total": 5, "devices": ["devAAAA1111", "devBBBB2222"],
  "questions": {
    "ri-0001": {
      "n": 4, "correct": 2, "wrong": 1, "unknown": 1,
      "first": { "at": "2026-01-01T19:00:00+09:00", "result": "wrong", "device": "devAAAA1111" },
      "last":  { "at": "2026-01-05T19:10:00+09:00", "result": "correct", "device": "devBBBB2222" },
      "streak": 2,
      "attempts": [
        ["2026-01-01T19:00:00+09:00", "w", "devAAAA1111", "devAAAA1111-1"],
        ["2026-01-02T19:00:00+09:00", "u", "devBBBB2222", "devBBBB2222-1"],
        ["2026-01-04T19:00:00+09:00", "c", "devAAAA1111", "devAAAA1111-5"],
        ["2026-01-05T19:10:00+09:00", "c", "devBBBB2222", "devBBBB2222-4"]
      ],
      "summary": { "w": 2, "c": 2, "s": 2, "l": "o", "t": "2026-01-05T19:10:00+09:00", "verified": false, "due": "", "k": 1 }
    }
  }
}
```
（値はすべて架空の例）

| 項目 | 意味 |
|---|---|
| `n` / `correct` / `wrong` / `unknown` | 全端末の合計。`n = correct + wrong + unknown`。`wrong` は「わかんない」を**含まない**不正解 |
| `first` | 全端末を通して最初の1回（`result`: correct / wrong / unknown）。「初めて解いたか」はこれで決める |
| `last` | 全端末を通して最後の1回 |
| `streak` | 直近の連続正解数（不正解・わかんないで0に戻る） |
| `attempts` | 古い順の `[日時, 'c'正解｜'w'不正解｜'u'わかんない, 端末ID, rid]`。**復習の計算の入力はこれ**。rid は端末内の送信ID（`端末ID-連番`）で、端末の localStorage の送信待ち `ichimon.queue.v1` の `rid` と同じ。重複の判定に使う |
| `summary` | 参考値。app.js の `record()` と同じ計算（連続3回正解→3日後の確認→復習完了）を全端末の attempts で再生した、`stats` と同じ形 `{w,c,s,l,t,verified,due,k}`。**`w` は不正解＋わかんない**（アプリの `w` と同じ）。正はアプリ側の計算。 |
| `devices` / `total` | 端末ID一覧／重複を除いた総回数 |

並びは端末の時刻（`t`）順。重複は rid で除いてある。

### 形をこうした理由
- app.js の `stats` は問題IDごとに `{w,c,s,l,t,verified,due,k}` を持つだけで、履歴そのものを持たない。`verified`/`due` は「連続3回正解した日」「その3日後」から決まるので、順番に並んだ attempts があれば全端末ぶんを合わせて再計算できる。そのため attempts を主役にした。
- `isPending`/`isDue`/`isMaster`/`isHard` は `stats` の値だけを見るので、`summary` を `stats[qid]` にそのまま入れれば既存の判定が動く。

## アプリ側でやってほしいこと（提案）
1. 起動時と、ホームに戻ったときに `?api=ichimon_history` を取得する（失敗しても何も出さない。電波がなければ端末の履歴だけで動く）。
2. サーバーの `attempts` に、端末にまだ送れていない記録（`queue.rows`。`rid`・`t`・`ok`・`skip` から c/w/u を作る）を足す。**rid が同じものは1つにする**（送信済みの自分の記録がサーバーにも端末にも出るため）。
3. 問題IDごとに attempts を時刻順に並べ、`record()` と同じ計算で `stats[qid]` を作り直す（`summary` と同じ。送信待ちを足した分だけ summary と違ってよい）。作り直した `stats` を localStorage に保存する。
4. 「初めての問題」は `first` があるか（または attempts が空でないか）で決める。
5. ママ用画面（mama.html / `MAMA`）は記録を送らず保存キーも別なので、この取得はしない。
6. 復習の判定は `localDay()`（端末の日付）で行う。attempts の日付は各端末の時刻の先頭10文字（`t.slice(0,10)`）を使う。

## 注意
- サーバー側は180秒キャッシュ。ただし記録が追記されると捨てるので、送った直後に取得すれば自分の分も入る。
- 古い記録は消えない。全問題ぶんが毎回返る（今は小さい）。大きくなったら `since` を使う。
- これは「ママの設定」（`?api=ichimon_conf`。今回のテスト対策・今回は出さない・問題の直し）とは別物。
- テスト用の端末ID（例：`test0000test0000`）や父の確認用の端末の行も混ざる。サーバーでは除外していない。アプリ側で除外する必要は今のところない（ほぼ影響なし）。
- 子どもの解答データはこのリポに置かない（この文書の例は架空）。

## 追加した Apps Script のコード（学習ボード Code.gs の追加分）
`doGet` に次の分岐を足し、`ichimonPost_` の追記後に `CacheService.getScriptCache().remove('rec:ichimon_history')` を足した。`cacheGet_`/`cachePut_`（`cachePut_` に有効秒数 `sec` を足した）は既存のキャッシュ関数。

```js
if (e && e.parameter && e.parameter.api === 'ichimon_history') {
  try { return json_(ichimonHistory_(e.parameter.since)); } catch (err) { return json_({ ok: false, error: '読めませんでした' }); }
}
```

```js
/* ---------- 一問一答：学習履歴API（?api=ichimon_history）。スマホと iPad で正誤・初回・復習を共通にする。説明書：ichimon-drill/docs/学習履歴API.md ----------
   シート「一問一答_記録」の全行を問題IDごとにまとめて返す。読むだけ（書かない）。結果は ScriptCache に180秒。記録が追記されたら ichimonPost_ が捨てる。
   attempts は古い順の [日時, 'c'正解|'w'不正解|'u'わかんない, 端末, rid]。summary はアプリの record()（app.js）と同じ計算を全端末ぶんの attempts で再生した参考値。 */
const ICHIMON_HIST_VER = 1, ICHIMON_HIST_CACHE_SEC = 180;
const ICHIMON_HIST_MASTER = 3, ICHIMON_HIST_CHECK_DAYS = 3;

function ichimonPlusDays_(day, n) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day || '')) return '';
  const p = day.split('-').map(Number);
  return Utilities.formatDate(new Date(Date.UTC(p[0], p[1] - 1, p[2] + n)), 'UTC', 'yyyy-MM-dd');
}

// attempts（古い順）→ アプリの stats と同じ形 {w,c,s,l,t,verified,due,k}。w は不正解＋わかんない（アプリと同じ）
function ichimonReplay_(atts) {
  const x = { w: 0, c: 0, s: 0, l: '', t: '', verified: false, due: '', k: 0 };
  atts.forEach(a => {
    const day = String(a[0]).slice(0, 10);
    const chk = x.due || ichimonPlusDays_(x.t.slice(0, 10), ICHIMON_HIST_CHECK_DAYS);
    if (a[1] === 'c') {
      const verifying = x.w > 0 && x.s >= ICHIMON_HIST_MASTER && !x.verified && !!chk && day >= chk;
      x.c++; x.s++; x.l = 'o';
      if (verifying) { x.verified = true; x.due = ''; }
      else if (x.w > 0 && x.s === ICHIMON_HIST_MASTER && !x.verified) x.due = ichimonPlusDays_(day, ICHIMON_HIST_CHECK_DAYS);
    } else {
      x.w++; x.s = 0; x.l = 'x'; x.verified = false; x.due = '';
      if (a[1] === 'u') x.k++;
    }
    x.t = String(a[0]);
  });
  return x;
}

function ichimonHistoryBuild_() {
  const sh = ichimonSheet_('ICHIMON_LOG_ID', ICHIMON_LOG_NAME, ICHIMON_LOG_HEAD, false);
  const out = { ok: true, ver: ICHIMON_HIST_VER, generatedAt: new Date().toISOString(), devices: [], total: 0, questions: {} };
  if (!sh || sh.getLastRow() < 2) return out;
  const vals = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  const es = [], seen = {}, devs = {};
  vals.forEach((r, i) => {
    const qid = String(r[5] || ''), rid = String(r[2] || '');
    if (!qid || !rid || seen[rid]) return; // rid で重複を除く
    seen[rid] = true;
    const raw = r[3] instanceof Date ? Utilities.formatDate(r[3], TZ, "yyyy-MM-dd'T'HH:mm:ssXXX") : String(r[3]);
    const rec = r[0] instanceof Date ? Utilities.formatDate(r[0], TZ, 'yyyy-MM-dd HH:mm:ss') : String(r[0]);
    const skip = String(r[8] == null ? '' : r[8]) === '1';
    const ok = String(r[6]) === '○';
    es.push({ qid: qid, rid: rid, dev: String(r[1]), t: raw, ts: Date.parse(raw) || 0, rc: Date.parse(rec.replace(' ', 'T') + '+09:00') || 0, res: ok ? 'c' : (skip ? 'u' : 'w'), i: i });
    devs[String(r[1])] = true;
  });
  es.sort((x, y) => x.ts - y.ts || x.i - y.i);
  const q = out.questions;
  es.forEach(e => {
    const o = q[e.qid] || (q[e.qid] = { n: 0, correct: 0, wrong: 0, unknown: 0, first: null, last: null, streak: 0, attempts: [], received: 0 });
    o.n++;
    if (e.res === 'c') { o.correct++; o.streak++; } else { o.streak = 0; if (e.res === 'u') o.unknown++; else o.wrong++; }
    const mark = { at: e.t, result: e.res === 'c' ? 'correct' : (e.res === 'u' ? 'unknown' : 'wrong'), device: e.dev };
    if (!o.first) o.first = mark;
    o.last = mark;
    o.attempts.push([e.t, e.res, e.dev, e.rid]);
    if (e.rc > o.received) o.received = e.rc; // 受信が最も新しい時刻（差分取得 since の判定用。返す前に消す）
  });
  Object.keys(q).forEach(k => { q[k].summary = ichimonReplay_(q[k].attempts); });
  out.devices = Object.keys(devs).sort();
  out.total = es.length;
  return out;
}

// ?api=ichimon_history[&since=ISO]。since を付けると、そのあとに受信した行がある問題だけを（attempts は全部入りで）返す
function ichimonHistory_(since) {
  let full = NOCACHE_ ? undefined : cacheGet_('ichimon_history');
  if (full === undefined) { full = ichimonHistoryBuild_(); cachePut_('ichimon_history', full, ICHIMON_HIST_CACHE_SEC); }
  const sinceMs = since ? Date.parse(since) : NaN;
  const res = { ok: true, ver: full.ver, generatedAt: full.generatedAt, devices: full.devices, total: full.total, partial: !isNaN(sinceMs), questions: {} };
  Object.keys(full.questions).forEach(k => {
    const o = full.questions[k];
    if (!isNaN(sinceMs) && !(o.received > sinceMs)) return;
    const c = Object.assign({}, o); delete c.received;
    res.questions[k] = c;
  });
  return res;
}
```
