# python tools/poses_shots.py : 12職のポーズを実画面の描画関数(drawHero)で並べて撮る(headless) → rpg/shots/assets_poses_reward.png / assets_poses_strip.png
# 報酬は 待機/攻撃/構え/被弾/勝利 を3倍、帯は 待機/攻撃/被弾/歩行 を6倍で。画像が無いポーズは待機にフォールバックするので、同じ絵が並んだら未接続のサイン
import sys, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 18435), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
JOBS = 'warrior mage priest thief magicknight paladin shadow sage ninja ranger skyknight starseer'.split()
con = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_context(viewport={'width': 1300, 'height': 900}).new_page()
    pg.on('console', lambda m: con.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: con.append(str(e)))
    pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.goto('http://127.0.0.1:18435/index.html?nosend=1'); pg.wait_for_selector('.subj'); pg.wait_for_timeout(1500)
    for mode, poses, S, W, H in [('reward', [None, 'attack', 'ready', 'hit', 'win'], 2, 110, 110), ('strip', [None, 'attack', 'hit', 'walk'], 6, 40, 40)]:
        pg.evaluate("""([jobs, mode, poses, S, W, H]) => {
          document.body.innerHTML = ''; document.body.style.background = '#6a9a6a';
          jobs.forEach(j => { const r = document.createElement('div'); r.style.cssText = 'white-space:nowrap;font:10px sans-serif';
            poses.forEach(ps => { const cv = document.createElement('canvas'); cv.width = W * S; cv.height = H * S; cv.style.cssText = 'width:' + (W * S) + 'px;height:' + (H * S) + 'px;vertical-align:bottom;outline:1px solid #0003'; const g = cv.getContext('2d'); g.scale(S, S);
              RPGSprites.drawHero(g, j, W / 2, H - 1, { img: mode, pose: ps }); r.appendChild(cv); });
            r.append(j); document.body.appendChild(r); });
        }""", [JOBS, mode, poses, S, W, H])
        pg.wait_for_timeout(1500); pg.screenshot(path=os.path.join(ROOT, 'rpg', 'shots', 'assets_poses_' + mode + '.png'), full_page=True)
    print('console', con); b.close()
