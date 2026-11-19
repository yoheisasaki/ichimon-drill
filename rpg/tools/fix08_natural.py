# 08修正指示書：自然な速度で10問回答する録画（headless chromium・実時間・390x700）。python rpg/tools/fix08_natural.py
# 出力：rpg/shots/fix08_strip/natural10.webm と natural10.json（演出の実時間の統計）
import sys, os, json, threading, http.server, socketserver, functools, shutil, random
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = 18492
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_strip'); os.makedirs(OUT, exist_ok=True)
VID = os.path.join(OUT, '_vid'); shutil.rmtree(VID, ignore_errors=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
READY = "() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766"
PLAN = ['ok', 'ok', 'ok', 'wrong', 'ok', 'ok', 'skip', 'ok', 'ok', 'ok']
random.seed(8)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 700}, device_scale_factor=1, is_mobile=True, has_touch=True, record_video_dir=VID, record_video_size={'width': 390, 'height': 700})
    pg = ctx.new_page(); pg.set_default_timeout(30000); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.goto(URL); pg.wait_for_selector('#go'); pg.wait_for_function(READY, timeout=90000)
    pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('ichimon.rpg.v1')); s.jobXp.warrior = 6000; localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }")
    pg.reload(); pg.wait_for_selector('#go'); pg.wait_for_function(READY, timeout=90000); pg.wait_for_timeout(1200)
    pg.click('#go'); pg.wait_for_selector('.choice, #ans'); pg.wait_for_timeout(1500)
    kinds = []
    for mode in PLAN:
        pg.wait_for_timeout(random.randint(1100, 1700))   # 問題を読む時間
        if pg.query_selector('#ans'):
            if mode == 'skip': pg.click('#skip')
            else:
                pg.click('#ans'); pg.fill('#ans', pg.evaluate("() => S.cur.accept[0]") if mode == 'ok' else 'ちがう'); pg.click('#submit')
        else:
            if mode == 'skip': pg.click('#skipc')
            else:
                idx = pg.evaluate("() => S.opts.indexOf(S.cur.a)") if mode == 'ok' else pg.evaluate("() => S.opts.findIndex(o => o !== S.cur.a)")
                pg.click(f'.choice >> nth={idx}')
        if mode == 'ok': pg.wait_for_timeout(800)
        else:
            pg.wait_for_function("() => document.getElementById('next') && document.getElementById('next').textContent.includes('つぎへ')", timeout=5000)
            pg.wait_for_timeout(1300); pg.click('#next'); pg.wait_for_timeout(300)
        kinds.append(mode)
    pg.wait_for_timeout(1500)
    log = pg.evaluate("() => RPG.stripLog")
    st = {}
    for x in log:
        if 'ms' in x: st.setdefault(x['k'], []).append(x['ms'])
    res = {'plan': kinds, 'console_errors': errs, 'ms_by_kind': {k: {'n': len(v), 'min': min(v), 'max': max(v), 'mean': round(sum(v) / len(v))} for k, v in st.items()}, 'dropped': sum(x.get('dropped', 0) for x in log if x['k'] == 'enqueue'), 'enqueues': [x for x in log if x['k'] == 'enqueue']}
    ctx.close(); b.close()
vids = [f for f in os.listdir(VID) if f.endswith('.webm')]
shutil.move(os.path.join(VID, vids[0]), os.path.join(OUT, 'natural10.webm')); shutil.rmtree(VID, ignore_errors=True)
json.dump(res, open(os.path.join(OUT, 'natural10.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False))
