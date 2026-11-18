# 街・施設の画面確認(headless): python town_shots.py → rpg/shots/assets_town_*.png
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')); OUT = os.path.join(ROOT, 'rpg', 'shots'); SAVES = os.path.join(ROOT, 'rpg', 'tests', 'saves')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 18437), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
con = []
def put(pg, name):
    t = open(os.path.join(SAVES, name + '.json'), encoding='utf-8').read()
    pg.evaluate("t => localStorage.setItem('ichimon.rpg.v1', t)", t); pg.reload(); pg.wait_for_selector('.subj'); pg.wait_for_function("() => RPGSprites.IMGS.town_airship && RPGSprites.IMGS.bg_town"); pg.wait_for_timeout(300)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True).new_page()
    pg.on('console', lambda m: con.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: con.append(str(e)))
    pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.goto('http://127.0.0.1:18437/index.html?nosend=1'); pg.wait_for_selector('.subj')
    for sv in ('day01', 'ch1end', 'maingoal'):
        put(pg, sv); pg.click('.rs-tab[data-tab=town]'); pg.wait_for_timeout(500)
        print(sv, 'parts', pg.evaluate("() => document.querySelectorAll('.rs-tpart').length"), 'hscroll', pg.evaluate("() => document.documentElement.scrollWidth > innerWidth"))
        pg.screenshot(path=os.path.join(OUT, f'assets_town_{sv}.png'), full_page=True)
    for pl in ('guild', 'shop', 'forge', 'temple', 'room'):
        pg.click('.rs-tab[data-tab=town]'); pg.click(f'[data-place={pl}]'); pg.wait_for_timeout(400)
        pg.screenshot(path=os.path.join(OUT, f'assets_room_{pl}.png'), full_page=True)
    print('console', con); b.close()
