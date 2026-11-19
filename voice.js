'use strict';
// 息子の意見（いけんボタン）と「おかしい！」ボタン。どの画面でも右上の細い帯から1タップ。
// 送り先は common.js の SEND_URL（学習ボードの Apps Script）。api:'ichimon_voice'。端末に溜めて、送れたら消す。
(function () {
  var VER = '3aad664+voice1';   // 土台のコミット＋この機能の版
  var LS_Q = 'ichimon.voice.v1', LS_DEV = 'ichimon.voicedev.v1';
  var TAGS = [['もじが ずれてる', 'もじが ずれてる'], ['かくれて {見|み}えない', 'かくれて 見えない'], ['こたえが おかしい', 'こたえが おかしい'], ['むずかしい', 'むずかしい'], ['たのしい', 'たのしい'], ['こうしてほしい', 'こうしてほしい']];
  var mem = {};
  function lsGet(k) { try { var v = localStorage.getItem(k); return v === null ? (mem[k] || null) : v; } catch (e) { return mem[k] || null; } }
  function lsSet(k, v) { mem[k] = v; try { localStorage.setItem(k, v); } catch (e) {} }

  // ---------- リングバッファ（起動時から） ----------
  var errs = [], acts = [], lastScreen = '';
  function hms() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
  function pushErr(k, m) { errs.push({ t: hms(), k: k, m: String(m).slice(0, 300) }); if (errs.length > 20) errs.shift(); }
  function pushAct(o) { o.t = hms(); acts.push(o); if (acts.length > 30) acts.shift(); }
  var ce = console.error;
  console.error = function () { try { pushErr('console.error', [].slice.call(arguments).map(function (x) { return x && x.message ? x.message : String(x); }).join(' ')); } catch (e) {} return ce.apply(console, arguments); };
  window.addEventListener('error', function (e) {
    if (e.target && e.target !== window && (e.target.src || e.target.href)) pushErr('load', e.target.src || e.target.href);
    else pushErr('uncaught', (e.message || '') + ' @' + String(e.filename || '').split('/').pop() + ':' + (e.lineno || 0));
  }, true);
  window.addEventListener('unhandledrejection', function (e) { pushErr('rejection', e.reason && e.reason.message ? e.reason.message : e.reason); });
  function descEl(el) {
    if (!el || !el.tagName) return '';
    var s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : '');
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 16);
    return t ? s + '「' + t + '」' : s;
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? (e.target.closest('button,a,[data-go],.choice,.subj,.chip,input,textarea') || e.target) : e.target;
    pushAct({ k: 'tap', e: descEl(el), x: Math.round(e.clientX), y: Math.round(e.clientY), s: screenName() });
  }, true);

  // ---------- 画面名・状態 ----------
  function screenName() {
    var d = document;
    if (d.querySelector('.rw3,.rw')) return '報酬';
    if (d.querySelector('#app .choices,#app .inbox')) return '問題';
    if (d.querySelector('#app .res-score')) return '結果';
    if (d.querySelector('.rs-homewrap')) return 'ホーム';
    if (d.querySelector('#app.rs-app,#app .rs3')) { try { return 'RPG:' + RPG.screenName(); } catch (e) { return 'RPG'; } }
    if (d.getElementById('go')) return 'ホーム(旧)';
    return '不明';
  }
  function state(sn) {
    var o = {};
    try { if (typeof filter !== 'undefined') o.filter = filter; } catch (e) {}
    try {
      if (sn === '問題' && typeof S !== 'undefined' && S && S.cur) {
        var q = S.cur;
        o.qid = q.id; o.subject = q.subject; o.unit = q.unit || ''; o.type = q.type || 'choice'; o.map = !!q.map;
        o.n = S.idx + 1; o.of = S.queue.length; o.answered = !!S.locked; o.expShown = !!document.querySelector('#next .exp'); o.rpgSession = !!S.rpg; o.correct = S.correct; o.from = S.from || '';
      }
    } catch (e) {}
    try {
      if (window.RPG && RPG.save) { var s = RPG.save; o.rpg = { screen: (document.querySelector('#app.rs-app') && RPG.screenName) ? RPG.screenName() : '', job: s.job, outfit: (s.look && s.look.outfit) || null, step: s.progress && s.progress.step }; }
    } catch (e) {}
    return o;
  }
  function stateLabel(st) { return st.rpg ? ('職:' + st.rpg.job + (st.rpg.outfit ? '/' + st.rpg.outfit : '')) : ''; }

  // ---------- 要素の位置と異常の自動検出 ----------
  var SELS = [['top', '.top'], ['dname', '.dname'], ['pill', '.pill'], ['bar', '.bar'], ['card', '.card'], ['qt', '.qt'], ['map', '.map'], ['ans', '.ans'], ['choice', '.choice'], ['skip', '.skip'], ['submit', '#submit'], ['exp', '.exp'], ['correct', '.correct'], ['next', '#next'], ['tapnext', '.tapnext'], ['score', '.score'], ['strip', '.rpg-strip'], ['rs-head', '.rs-head'], ['rs-title', '.rs-title'], ['rs-body', '#rsBody'], ['rs-foot', '.rs-foot'], ['rs-topbar', '.rs-topbar'], ['rs-nav', '.rs-nav'], ['rw-title', '.rw-title'], ['res-score', '.res-score'], ['wi', '.wi'], ['big', '.big'], ['rw-btn', '.rw-btn'], ['rs-btn', '.rs-btn'], ['rs-tab', '.rs-tab'], ['vbar', '#vbar']];
  var CHECK = { choice: 1, skip: 1, submit: 1, exp: 1, correct: 1, next: 1, tapnext: 1, score: 1, card: 1, map: 1, ans: 1, wi: 1, big: 1, 'rw-btn': 1, 'rs-btn': 1, 'res-score': 1, qt: 1, dname: 1, pill: 1, top: 1 };
  function rc(el) { var r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; }
  function shown(el) { if (!el.getClientRects().length) return false; var cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && el.getBoundingClientRect().width > 0; }
  function inter(a, b) { var w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y); return w > 0 && h > 0 ? w * h : 0; }
  function txt(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24); }
  function geometry() {
    var vw = innerWidth, vh = innerHeight, els = [], an = [];
    SELS.forEach(function (p) {
      var list = [].slice.call(document.querySelectorAll(p[1])).filter(shown).slice(0, 12);
      list.forEach(function (el) { var r = rc(el); els.push({ n: p[0], tx: txt(el), r: r, el: el, in: r.y < vh && r.y + r.h > 0 }); });
    });
    var strips = els.filter(function (o) { return o.n === 'strip'; });
    els.forEach(function (o) {
      if (!CHECK[o.n] || !o.in) return;
      var area = o.r.w * o.r.h; if (area <= 0) return;
      strips.forEach(function (s) { var a = inter(o.r, s.r); if (a / area > 0.05) { var can = (document.documentElement.scrollHeight - innerHeight - scrollY) >= (o.r.y + o.r.h - s.r.y); an.push({ k: 'hidden_by_strip', n: o.n, tx: o.tx, pct: Math.round(a / area * 100), scrollable: can }); } });
      var vis = { x: Math.max(0, o.r.x), y: Math.max(0, o.r.y), w: Math.min(vw, o.r.x + o.r.w) - Math.max(0, o.r.x), h: Math.min(vh, o.r.y + o.r.h) - Math.max(0, o.r.y) };
      if (vis.w <= 2 || vis.h <= 2) return;
      var hit = 0, by = '';
      [[.5, .5], [.2, .3], [.8, .3], [.2, .7], [.8, .7]].forEach(function (f) {
        var t = document.elementFromPoint(vis.x + vis.w * f[0], vis.y + vis.h * f[1]);
        if (t && !(o.el.contains(t) || t.contains(o.el))) { hit++; by = descEl(t); }
      });
      if (hit >= 3) an.push({ k: 'covered', n: o.n, tx: o.tx, by: by });
    });
    els.forEach(function (o) { if (o.n === 'rs-body' || o.n === 'rs-nav' || o.n === 'rs-foot') return; if (o.in && (o.r.x < -1 || o.r.x + o.r.w > vw + 1)) an.push({ k: 'off_x', n: o.n, tx: o.tx, x: o.r.x, w: o.r.w }); });
    var ck = els.filter(function (o) { return CHECK[o.n] && o.in && o.n !== 'top' && o.n !== 'card' && o.n !== 'qt'; });
    for (var i = 0; i < ck.length && an.length < 60; i++) for (var j = i + 1; j < ck.length; j++) {
      var A = ck[i], B = ck[j];
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
      var a = inter(A.r, B.r); if (a >= 20 && a / Math.min(A.r.w * A.r.h, B.r.w * B.r.h) > 0.1) an.push({ k: 'overlap', a: A.n + '「' + A.tx.slice(0, 8) + '」', b: B.n + '「' + B.tx.slice(0, 8) + '」', px: a });
    }
    var app = document.getElementById('app'), cnt = 0;
    if (app) {
      var all = app.querySelectorAll('*');
      for (var k = 0; k < all.length && k < 1500 && cnt < 15; k++) {
        var e = all[k]; if (!e.clientWidth || e.scrollWidth <= e.clientWidth + 1) continue;
        var cs = getComputedStyle(e); if (cs.display === 'inline' || /^(auto|scroll)$/.test(cs.overflowX) || /^(CANVAS|SVG|svg|RT|RUBY|HTML|BODY)$/.test(e.tagName)) continue;
        var bb = e.getBoundingClientRect(); if (bb.bottom < 0 || bb.top > vh) continue;
        cnt++; an.push({ k: 'text_overflow', sel: descEl(e).slice(0, 40), sw: e.scrollWidth, cw: e.clientWidth });
      }
    }
    return { els: els.map(function (o) { return { n: o.n, tx: o.tx, x: o.r.x, y: o.r.y, w: o.r.w, h: o.r.h, in: o.in }; }), an: an };
  }
  function summarize(an) {
    if (!an.length) return '自動検出：異常なし';
    var m = {};
    an.forEach(function (a) { var s = a.k === 'hidden_by_strip' ? '帯に隠れ:' + a.n + '(' + a.pct + '%' + (a.scrollable ? '・スクロールで見える' : '・スクロールしても隠れる') + ')' : a.k === 'covered' ? '覆われ:' + a.n + '←' + a.by : a.k === 'off_x' ? '横はみ出し:' + a.n : a.k === 'overlap' ? '重なり:' + a.a + '×' + a.b : '文字はみ出し:' + a.sel; m[s] = 1; });
    return '自動検出：' + Object.keys(m).slice(0, 8).join('／');
  }

  // ---------- DOM の写し（名前・スクリプト・画像を除き 60KB まで） ----------
  var DOM_MAX = 60000;
  function domSnap() {
    var app = document.getElementById('app'); if (!app) return '';
    var c = app.cloneNode(true);
    [].forEach.call(c.querySelectorAll('script,style,noscript,svg'), function (n) { n.remove(); });
    [].forEach.call(c.querySelectorAll('canvas'), function (n) { var p = document.createElement('canvas-ph'); p.setAttribute('w', n.getAttribute('width') || ''); p.setAttribute('h', n.getAttribute('height') || ''); n.replaceWith(p); });
    [].forEach.call(c.querySelectorAll('img'), function (n) { if (/^data:/.test(n.getAttribute('src') || '')) n.setAttribute('src', 'data:…'); });
    [].forEach.call(c.querySelectorAll('input,textarea'), function (n) { n.removeAttribute('value'); if (n.tagName === 'TEXTAREA') n.textContent = ''; });
    var h = c.outerHTML, nm = '';
    try { nm = (RPG.save && RPG.save.name) || ''; } catch (e) {}
    if (nm) h = h.split(nm).join('〔名前〕');
    return h.length > DOM_MAX ? h.slice(0, DOM_MAX) + '…[切り詰め ' + h.length + '字中]' : h;
  }
  function safeArea() {
    var p = document.createElement('div'); p.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(p); var cs = getComputedStyle(p), o = { top: cs.paddingTop, right: cs.paddingRight, bottom: cs.paddingBottom, left: cs.paddingLeft }; p.remove(); return o;
  }
  function lsSnap() {
    var o = {};
    try {
      var r = localStorage.getItem('ichimon.rpg.v1'); if (r) { var s = JSON.parse(r); delete s.name; o.rpg = s; }
      var st = localStorage.getItem('ichimon.stats.v1'); if (st) o.stats = JSON.parse(st);
      var sl = localStorage.getItem('ichimon.sel.v1'); if (sl) o.sel = JSON.parse(sl);
    } catch (e) {}
    if (JSON.stringify(o).length > 250000) { delete o.stats; }
    if (JSON.stringify(o).length > 250000) { delete o.rpg; }
    return o;
  }
  function env() {
    var d = document, rs = function (el) { return el ? getComputedStyle(el).fontSize : null; };
    var sc = {}; try { sc.win = [Math.round(scrollX), Math.round(scrollY)]; var b = d.getElementById('rsBody'); if (b) sc.rsBody = b.scrollTop; var r2 = d.querySelector('#rsBody .rs-scroll'); if (r2) sc.rsScroll = r2.scrollTop; sc.docH = d.documentElement.scrollHeight; } catch (e) {}
    var vv = window.visualViewport;
    return {
      w: innerWidth, h: innerHeight, vv: vv ? [Math.round(vv.width), Math.round(vv.height), +vv.scale.toFixed(2)] : null, dpr: devicePixelRatio, safe: safeArea(),
      rootFont: rs(d.documentElement), bodyFont: rs(d.body), qtFont: rs(d.querySelector('.qt')), choiceFont: rs(d.querySelector('.choice')),
      scroll: sc, ua: navigator.userAgent, standalone: !!navigator.standalone, lang: d.documentElement.lang, tz: new Date().getTimezoneOffset(), online: navigator.onLine,
      rubyOff: d.documentElement.classList.contains('rb-off')
    };
  }
  function stamp() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }, o = -d.getTimezoneOffset(), a = Math.abs(o);
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + (o >= 0 ? '+' : '-') + p(Math.floor(a / 60)) + ':' + p(a % 60);
  }
  function devId() {
    var d = lsGet(LS_DEV);
    if (!d) { d = Array.from({ length: 12 }, function () { return 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]; }).join(''); lsSet(LS_DEV, d); }
    return d;
  }
  function base(kind) {
    var sn = screenName(), st = state(sn);
    return { sn: sn, st: st, item: { rid: devId() + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kind: kind, t: stamp(), screen: sn, subject: st.subject || '', qid: st.qid || '', state: stateLabel(st), size: innerWidth + 'x' + innerHeight, ver: VER, tags: [], text: '' } };
  }
  function collect() {
    var b = base('oka'), g = geometry();
    b.item.summary = summarize(g.an);
    b.item.report = { v: 1, ver: VER, t: b.item.t, screen: b.sn, state: b.st, env: env(), anomalies: g.an, elements: g.els, console: errs.slice(), actions: acts.slice(), dom: domSnap(), ls: lsSnap() };
    return b.item;
  }

  // ---------- 端末の送信待ち・送信 ----------
  var queue = [];
  try { var q0 = lsGet(LS_Q); queue = q0 ? JSON.parse(q0) : []; if (!Array.isArray(queue)) queue = []; } catch (e) { queue = []; }
  function saveQ() { lsSet(LS_Q, JSON.stringify(queue)); }
  function noSend() { try { return !!NOSEND; } catch (e) { return false; } }
  var sending = false, again = false;
  function url() { try { return SEND_OVERRIDE || SEND_URL; } catch (e) { return ''; } }
  function post(items, mode) {
    var opt = { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ api: 'ichimon_voice', dev: devId(), items: items }) };
    if (mode) opt.mode = mode;
    var ctl = typeof AbortController === 'function' ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, 20000);   // 電波がなくて固まったままにならないよう20秒で切る
    if (ctl) opt.signal = ctl.signal;
    return fetch(url(), opt).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  // 1件ずつ送る（おかしい！は大きいので）。応答が読めて ok:true なら消す。読めないときは no-cors で再送し、成立したら消す。二重はサーバーが rid で弾く
  async function flush() {
    if (noSend() || !queue.length) return false;
    if (sending) { again = true; return false; }   // 送っている最中に新しい依頼（電波が戻った等）が来たら、終わってからもう一度回す
    sending = true; again = false;
    try {
      while (queue.length) {
        var it = queue[0], sent = false;
        try { var r = await post([it]); var j = await r.json(); if (j && (j.ok || j.bad)) sent = true; else break; }
        catch (e) { try { await post([it], 'no-cors'); sent = true; } catch (e2) { break; } }
        if (!sent) break;
        queue.shift(); saveQ();
      }
    } finally { sending = false; }
    if (again && queue.length) return flush();
    return !queue.length;
  }
  function enqueue(item) {
    queue.push(item);
    while (queue.length > 8) queue.shift();
    try { saveQ(); } catch (e) {}
    return flush();
  }
  window.addEventListener('online', function () { flush(); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flush(); });

  // ---------- 画面（右上の帯・いけん画面・ひとこと表示） ----------
  var bar, sheet, toastEl, toastT, lastOka = 0, ctx = null;
  function R(s) { return typeof ruby === 'function' ? ruby(s) : s; }
  function toast(t) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.id = 'vtoast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = t; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 2200);
  }
  function build() {
    if (document.getElementById('vbar')) return;
    bar = document.createElement('div'); bar.id = 'vbar';
    bar.innerHTML = '<button type="button" class="vb vb-oka" id="vOka" aria-label="おかしい！ いまの がめんの ようすを おくる">おかしい！</button><button type="button" class="vb vb-iken" id="vIken" aria-label="いけん"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="currentColor"/></svg><span>' + R('{意見|いけん}') + '</span></button>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById('vIken').onclick = openSheet;
    document.getElementById('vOka').onclick = function () {
      var n = Date.now(); if (n - lastOka < 2500) return; lastOka = n;
      var item; try { item = collect(); } catch (e) { item = base('oka').item; item.summary = '収集に失敗：' + e; item.report = { v: 1, error: String(e), console: errs.slice(), actions: acts.slice() }; }
      pushAct({ k: 'oka', s: item.screen });
      toast('おくったよ'); enqueue(item);
    };
    sheet = document.createElement('div'); sheet.id = 'vsheet'; sheet.hidden = true;
    sheet.innerHTML = '<div class="vs-p" role="dialog" aria-modal="true" aria-label="いけん"><div class="vs-h"><b>' + R('{意見|いけん}を おしえてね') + '</b><button type="button" class="vs-x" id="vsX">とじる</button></div>'
      + '<div class="vs-t">いまの きもちを えらんでね（いくつでも）</div><div class="vs-chips" id="vsChips">' + TAGS.map(function (t, i) { return '<button type="button" class="vs-chip" data-i="' + i + '" aria-pressed="false">' + R(t[0]) + '</button>'; }).join('') + '</div>'
      + '<textarea id="vsText" rows="3" maxlength="200" placeholder="かいても いいよ（かかなくても OK）" aria-label="ひとこと"></textarea>'
      + '<button type="button" class="vs-send" id="vsSend" disabled>おくる</button><div class="vs-done" id="vsDone" role="status"></div></div>';
    document.body.appendChild(sheet);
    sheet.onclick = function (e) { if (e.target === sheet) closeSheet(); };
    document.getElementById('vsX').onclick = closeSheet;
    var chips = document.getElementById('vsChips'), txtEl = document.getElementById('vsText'), snd = document.getElementById('vsSend');
    var sync = function () { snd.disabled = !chips.querySelector('.on') && !txtEl.value.trim(); };
    chips.onclick = function (e) { var b = e.target.closest('.vs-chip'); if (!b) return; var on = b.classList.toggle('on'); b.setAttribute('aria-pressed', on); sync(); };
    txtEl.addEventListener('input', sync);
    snd.onclick = function () {
      var tags = [].map.call(chips.querySelectorAll('.vs-chip.on'), function (b) { return TAGS[+b.dataset.i][1]; });
      var it = ctx.item; it.tags = tags; it.text = txtEl.value.trim().slice(0, 200);
      snd.disabled = true; var done = document.getElementById('vsDone'); done.textContent = 'おくっているよ…';
      var fin = false, finish = function (ok) { if (fin) return; fin = true; done.textContent = ok ? 'とどいたよ！ ありがとう' : 'うけとったよ！ あとで おくるね。ありがとう'; setTimeout(closeSheet, 1400); };
      enqueue(it).then(finish, function () { finish(false); }); setTimeout(function () { finish(false); }, 4000);
    };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) closeSheet(); });
  }
  function openSheet() {
    ctx = base('iken'); pushAct({ k: 'iken-open', s: ctx.sn });
    [].forEach.call(sheet.querySelectorAll('.vs-chip'), function (b) { b.classList.remove('on'); b.setAttribute('aria-pressed', 'false'); });
    document.getElementById('vsText').value = ''; document.getElementById('vsSend').disabled = true; document.getElementById('vsDone').textContent = '';
    sheet.hidden = false;
  }
  function closeSheet() { sheet.hidden = true; ctx = null; }

  function init() {
    try { if (typeof MAMA !== 'undefined' && MAMA) return; } catch (e) {}
    build();
    var app = document.getElementById('app');
    if (app && window.MutationObserver) new MutationObserver(function () { var s = screenName(); if (s !== lastScreen) { lastScreen = s; pushAct({ k: 'screen', s: s }); } }).observe(app, { childList: true });
    setTimeout(flush, 3000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.IchimonVoice = { collect: collect, screenName: screenName, flush: flush, queue: function () { return queue; }, VER: VER, open: function () { openSheet(); }, errs: errs, acts: acts };
})();
