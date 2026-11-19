# python rpg/tools/bg_shots.py <出力名> <地域キー>... : 報酬(主人公+敵+宝箱)と帯を、地域背景つきで headless 撮影 → rpg/shots/<出力名>.png
import sys, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 18439), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async (regs) => {
  document.body.innerHTML = '<div id="host" style="padding:8px;display:grid;grid-template-columns:repeat(2,1fr);gap:8px;background:#0b1329"></div>'; const host = document.getElementById('host'); const SP = RPGSprites, missing = [];
  for (const r of regs) {
    if (!SP.IMGS['bg_' + r]) missing.push(r); if (!SP.IMGS['bg_' + r + '_strip']) missing.push(r + '_strip');
    const w = document.createElement('div'); w.style.cssText = 'color:#fff;font:11px sans-serif'; w.innerHTML = r + '<br><canvas class="a" style="width:100%;image-rendering:pixelated"></canvas><canvas class="b" style="width:100%;image-rendering:pixelated;margin-top:4px"></canvas>'; host.appendChild(w);
    const c = w.querySelector('.a'), k = 3; c.width = 480; c.height = 240; let g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
    SP.drawBackground(g, 480, 240, r, 'reward'); g.save(); g.scale(2, 2); SP.drawHero(g, 'warrior', 70, 105, { img: 'reward' }); g.restore();
    const s = w.querySelector('.b'); s.width = 390; s.height = 44; g = s.getContext('2d'); SP.drawBackground(g, 390, 44, r, 'strip'); SP.drawHero(g, 'warrior', 30, 42, { img: 'strip' });
  }
  return missing;
}
"""
out, regs = sys.argv[1], sys.argv[2:]
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_context(viewport={'width': 1000, 'height': 900}).new_page(); con = []
    pg.on('pageerror', lambda e: con.append(str(e))); pg.on('console', lambda m: con.append(m.text) if m.type == 'error' else None); pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.goto('http://127.0.0.1:18439/index.html?nosend=1'); pg.wait_for_selector('.subj'); pg.wait_for_timeout(2500)
    miss = pg.evaluate(JS, regs); pg.wait_for_timeout(300)
    pg.screenshot(path=os.path.join(ROOT, 'rpg', 'shots', out + '.png'), full_page=True); print('missing', miss, 'console', con); b.close()
