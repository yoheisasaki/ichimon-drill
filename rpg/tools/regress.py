# 現行学習UIの回帰確認（headless）。使い方: python rpg/tools/regress.py <tag> [port]
# 出力: rpg/baseline/<tag>/metrics.json と スクショ。送信先はネットワーク層で遮断する（実データを送らない）。
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
tag = sys.argv[1] if len(sys.argv) > 1 else 'now'
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8765
OUT = os.path.join(ROOT, 'rpg', 'baseline', tag); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
H = functools.partial(Q, directory=ROOT)
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
M = {'tag': tag, 'widths': {}, 'ops': {}, 'console': []}
blocked = []
MEAS = """() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(), c = getComputedStyle(e); return {w: Math.round(b.width), h: Math.round(b.height), fs: c.fontSize, minH: c.minHeight}; };
 const ch = [...document.querySelectorAll('.choice')].map(e => Math.round(e.getBoundingClientRect().height));
 return {card: r('.card'), map: r('.map'), choice1: r('.choice'), nChoice: ch.length, choiceH: ch, skip: r('.skip'), ans: r('.ans'), submit: r('#submit'), doc: document.documentElement.scrollHeight, vh: innerHeight, hscroll: document.documentElement.scrollWidth > innerWidth}; }"""
CORRECT = "() => { const q = S.cur; document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
with sync_playwright() as p:
    for engine in ('chromium', 'webkit'):
        b = getattr(p, engine).launch(headless=True)
        for w in (320, 375, 390, 430):
            ctx = b.new_context(viewport={'width': w, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = ctx.new_page()
            pg.on('console', lambda m, e=engine, w=w: M['console'].append(f'{e}/{w}:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e, en=engine, w=w: M['console'].append(f'{en}/{w}:pageerror:{e}'))
            pg.route('**/script.google.com/**', lambda r: (blocked.append(r.request.url), r.abort()))
            res = {}
            pg.goto(URL); pg.wait_for_selector('.subj')
            def shot(n):
                if w == 390 and engine == 'chromium': pg.screenshot(path=os.path.join(OUT, n + '.png'))
            shot('1_home')
            pg.evaluate("() => start([qs().find(q => q.subject === '社会' && q.type !== 'input' && !q.map)])"); pg.wait_for_selector('.choice')
            res['choice'] = pg.evaluate(MEAS); shot('2_choice')
            pg.click('#quit'); pg.wait_for_selector('.subj'); pg.evaluate("() => start([qs().find(q => q.map && q.type !== 'input')])"); pg.wait_for_selector('.map svg', timeout=8000)
            res['map'] = pg.evaluate(MEAS); shot('3_map')
            pg.click('#quit'); pg.wait_for_selector('.subj'); pg.evaluate("() => start([qs().find(q => q.type === 'input')])"); pg.wait_for_selector('#ans')
            res['input'] = pg.evaluate(MEAS); shot('4_input')
            pg.click('#quit'); pg.wait_for_selector('.subj')
            pg.evaluate("() => { const L = qs().filter(q => q.type !== 'input' && !q.map).sort((a, b) => plain(b.q).length - plain(a.q).length)[0]; start([L]); }")
            pg.wait_for_selector('.choice'); res['long'] = pg.evaluate(MEAS); res['long']['len'] = pg.evaluate("() => plain(S.cur.q).length"); shot('5_long')
            M['widths'][f'{engine}/{w}'] = res
            ctx.close()
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.route('**/script.google.com/**', lambda r: (blocked.append(r.request.url), r.abort()))
        ops = {}
        pg.goto(URL); pg.wait_for_selector('.subj')
        ops['units_chip'] = pg.evaluate("() => { document.querySelector('button[data-f=\"社会\"]').click(); return document.querySelectorAll('.chip').length; }")
        pg.evaluate("() => { const c = document.querySelectorAll('.chip')[1]; if (c) c.click(); }")
        ops['sel_saved'] = pg.evaluate("() => localStorage.getItem('ichimon.sel.v1')")
        pg.evaluate("() => { start(pick(pool().filter(q => q.type !== 'input'), 10)); }"); pg.wait_for_selector('.choice')
        pg.evaluate(CORRECT)
        pg.wait_for_function("() => document.querySelector('.pill') && document.querySelector('.pill').textContent.startsWith('2')", timeout=3000)
        ops['correct_auto_advance'] = True
        qid = pg.evaluate("() => S.cur.id")
        pg.evaluate("() => { const q = S.cur; const i = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[i].click(); }")
        pg.wait_for_function("() => document.getElementById('next').textContent.includes('つぎへ')", timeout=3000)
        ops['wrong_reask_inserted_at_offset'] = pg.evaluate("(qid) => { const i = S.queue.findIndex((q, k) => k > S.idx && q.id === qid); return i - S.idx; }", qid)
        pg.click('.next'); pg.wait_for_function("() => document.querySelector('.pill').textContent.startsWith('3')")
        pg.click('#skipc'); pg.wait_for_function("() => document.getElementById('next').textContent.includes('つぎへ')", timeout=3000)
        ops['queue_rows'] = pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.queue.v1')).rows.map(r => ({ok: r.ok, skip: r.skip || 0, keys: Object.keys(r).sort().join()}))")
        ops['stats_keys'] = pg.evaluate("() => Object.keys(JSON.parse(localStorage.getItem('ichimon.stats.v1'))).length")
        pg.click('#quit'); pg.wait_for_selector('.subj')
        pg.evaluate("() => { filter='全部'; home(); }"); pg.click('#go'); pg.wait_for_selector('.choice')
        for _ in range(14):
            if pg.query_selector('.res-score') or pg.query_selector('#rwRoot'): break
            if pg.query_selector('#ans'):
                pg.evaluate("() => { const q = S.cur; const inp = document.getElementById('ans'); inp.value = q.accept[0]; inp.dispatchEvent(new Event('input')); document.getElementById('submit').click(); }")
            elif pg.query_selector('.choice'):
                pg.evaluate(CORRECT)
            pg.wait_for_timeout(900)
        pg.wait_for_selector('.res-score, #rwRoot', timeout=5000)
        ops['result_kind'] = 'reward' if pg.query_selector('#rwRoot') else 'plain'
        ops['result_text'] = pg.inner_text('.res-score, .rw-score')
        if engine == 'chromium': pg.screenshot(path=os.path.join(OUT, '6_result.png'))
        ops['result_buttons'] = pg.evaluate("() => [...document.querySelectorAll('.big, .rw-btns .rw-btn')].map(b => b.textContent)")
        M['ops'][engine] = ops; ctx.close(); b.close()
M['send_blocked_requests'] = len(blocked)
srv.shutdown()
json.dump(M, open(os.path.join(OUT, 'metrics.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({k: M[k] for k in ('ops', 'send_blocked_requests', 'console')}, ensure_ascii=False)[:2500])
