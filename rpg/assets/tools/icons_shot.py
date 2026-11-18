# 装備画面のアイコン確認(headless): python rpg/assets/tools/icons_shot.py [出力名] [ID,ID,...]
import sys, os, threading, http.server, socketserver, functools, json
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
name = sys.argv[1] if len(sys.argv) > 1 else 'assets_icons_pilot'
extra = sys.argv[2].split(',') if len(sys.argv) > 2 else []
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 18441), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
con = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    pg.on('console', lambda m: con.append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: con.append(f'pageerror:{e}'))
    pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.goto('http://127.0.0.1:18441/index.html?nosend=1'); pg.wait_for_selector('.subj')
    ids = extra or [f'w_sword_{i}' for i in range(1, 7)]
    pg.evaluate("(ids) => { const s = JSON.parse(localStorage.getItem('ichimon.rpg.v1')); ids.forEach(i => s.inv.items[i] = 1); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", ids)
    pg.reload(); pg.wait_for_selector('.subj'); pg.wait_for_timeout(500)
    pg.click('.rs-tab[data-tab=town]'); pg.wait_for_selector('.rs-town'); pg.click('[data-place=shop]'); pg.wait_for_selector('.rs-list'); pg.click('[data-go=equip]'); pg.wait_for_selector('#eqOk'); pg.wait_for_timeout(600)
    print('imgs', pg.evaluate("() => [...document.querySelectorAll('.rs-ic')].map(i => i.naturalWidth)"))
    pg.screenshot(path=os.path.join(ROOT, 'rpg', 'shots', name + '.png'), full_page=True)
print('console', con)
