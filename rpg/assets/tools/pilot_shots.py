# 試作素材の画面確認(headless chromium)。python rpg/assets/tools/pilot_shots.py [port]
# 出力: rpg/shots/assets_pilot_reward.png / assets_pilot_strip.png(幅390) / assets_pilot_strip_zoom.png
import sys, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18433
OUT = os.path.join(ROOT, 'rpg', 'shots')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
con = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page()
    pg.on('console', lambda m: con.append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: con.append(f'pageerror:{e}'))
    pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.goto(URL); pg.wait_for_selector('.subj')
    pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }")
    pg.wait_for_selector('.choice'); pg.wait_for_timeout(800)
    print('imgs', pg.evaluate("() => Object.keys(RPGSprites.IMGS)"))
    print('region/enemy', pg.evaluate("() => { const a = RPG.save.active; return [a.route.bg || a.route.region, a.enemyId, a.battle.hero.job]; }"))
    pg.screenshot(path=os.path.join(OUT, 'assets_pilot_strip.png'))
    cv = pg.query_selector('.rpg-strip canvas'); cv.screenshot(path=os.path.join(OUT, 'assets_pilot_strip_zoom.png'))
    for _ in range(40):
        if pg.query_selector('#rwRoot'): break
        pg.evaluate(CORRECT); pg.wait_for_timeout(750)
    pg.wait_for_selector('#rwRoot', timeout=8000); pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(OUT, 'assets_pilot_reward.png'), full_page=True)
    print('console', con)
    b.close()
