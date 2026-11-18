# 画像一覧画面(headless): python roster_shots.py <出力名> <kind: hero|enemy> id1 id2 ... → rpg/shots/<出力名>.png。実画面の描画関数で 報酬用(2倍)と帯用(1倍) を並べる
import sys, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
name, kind, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 18434), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
con = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_context(viewport={'width': 1000, 'height': 900}, device_scale_factor=2).new_page()
    pg.on('console', lambda m: con.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: con.append(str(e)))
    pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.goto('http://127.0.0.1:18434/index.html?nosend=1'); pg.wait_for_selector('.subj'); pg.wait_for_timeout(1500)
    pg.evaluate("""([kind, ids]) => {
      document.body.innerHTML = ''; document.body.style.background = '#6a9a6a';
      ids.forEach(id => { const w = document.createElement('div'); w.style.cssText = 'display:inline-block;margin:4px;text-align:center;font:10px sans-serif';
        [['reward', 1], ['strip', 1]].forEach(([m, s]) => { const cv = document.createElement('canvas'); cv.width = 100; cv.height = 100; cv.style.cssText = 'width:100px;height:100px;vertical-align:bottom'; const g = cv.getContext('2d'); g.scale(s, s);
          if (kind === 'hero') RPGSprites.drawHero(g, id, 10, 99, { img: m }); else RPGSprites.drawEnemy(g, id, false, 10, 99, { img: m }); w.appendChild(cv); });
        w.appendChild(document.createElement('br')); w.append(id); document.body.appendChild(w); });
    }""", [kind, ids])
    pg.wait_for_timeout(300); pg.screenshot(path=os.path.join(ROOT, 'rpg', 'shots', name + '.png'), full_page=True); print('console', con); b.close()
