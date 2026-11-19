# 「おかしい！」の JSON（02_記録 の おかしい_*.json）を読み、同じ画面サイズ・保存状態・問題を headless で開き直す。
#   python tools/replay_report.py <おかしい_*.json> [出力フォルダ]
# 画面：問題（state.qid。解答済みなら不正解を押して解説を出す）／RPG:<画面名>／ホーム。結果・報酬は再現できない（保存状態からは戻せない）。
# 出力：replay.png（開き直した画面）と、今の自動検出の要約・JSON の記録との比較を標準出力へ。送信は遮断。
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if len(sys.argv) < 2: sys.exit(__doc__)
rep = json.load(open(sys.argv[1], encoding='utf-8'))
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, '_shots', 'replay'); os.makedirs(OUT, exist_ok=True)
env, st, ls, scr = rep.get('env', {}), rep.get('state', {}), rep.get('ls', {}), rep.get('screen', '')
PORT = 18491
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
with sync_playwright() as pw:
    b = pw.webkit.launch(headless=True)
    ctx = b.new_context(viewport={'width': env.get('w', 390), 'height': env.get('h', 844)}, device_scale_factor=env.get('dpr', 2), is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.route('**/script.google.com/**', lambda r: r.abort()); pg.route('**/fonts.g*/**', lambda r: r.abort())
    errs = []; pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'http://127.0.0.1:{PORT}/index.html?nosend=1'); pg.wait_for_selector('#go', state='attached')
    keys = {'rpg': 'ichimon.rpg.v1', 'stats': 'ichimon.stats.v1', 'sel': 'ichimon.sel.v1'}
    pg.evaluate("([ls, keys]) => { Object.keys(ls).forEach(k => { if (keys[k]) localStorage.setItem(keys[k], JSON.stringify(ls[k])); }); }", [ls, keys])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(1500)
    note = []
    if scr == '問題' and st.get('qid'):
        ok = pg.evaluate("(id) => { const q = DATA.questions.find(q => q.id === id); if (!q) return false; app.onclick = null; start([q]); return true; }", st['qid'])
        if not ok: note.append('問題IDが今の questions.json に無い：' + st['qid'])
        pg.wait_for_timeout(600)
        if st.get('answered'):
            pg.evaluate("() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = 'ぜったいにちがう'; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else { const k = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[k].click(); } }")
            pg.wait_for_timeout(1800); note.append('解答済みなので不正解を押して再現（どれを選んだかは記録に無い）')
    elif scr.startswith('RPG:'):
        pg.evaluate("(n) => RPG.go(n)", scr[4:]); pg.wait_for_timeout(600)
    elif scr in ('結果', '報酬'):
        note.append('結果・報酬の画面は保存状態から戻せません。DOM（report.dom）と elements の位置を読んでください')
    sc = env.get('scroll', {})
    pg.evaluate("(sc) => { if (sc.win) scrollTo(sc.win[0], sc.win[1]); const b = document.getElementById('rsBody'); if (b && sc.rsBody != null) b.scrollTop = sc.rsBody; const r = document.querySelector('#rsBody .rs-scroll'); if (r && sc.rsScroll != null) r.scrollTop = sc.rsScroll; }", sc)
    pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(OUT, 'replay.png'))
    now = pg.evaluate("() => { const o = IchimonVoice.collect(); return { screen: o.screen, summary: o.summary, an: o.report.anomalies }; }")
    print('記録  画面:', scr, '／', rep.get('ver'), '／', f"{env.get('w')}x{env.get('h')} dpr{env.get('dpr')}")
    print('記録の異常:', len(rep.get('anomalies', [])), json.dumps(rep.get('anomalies', [])[:6], ensure_ascii=False))
    print('再現  画面:', now['screen'], '／', now['summary'])
    for n in note: print('注意:', n)
    if errs: print('コンソールエラー:', errs[:5])
    print('画像:', os.path.join(OUT, 'replay.png'))
    b.close()
