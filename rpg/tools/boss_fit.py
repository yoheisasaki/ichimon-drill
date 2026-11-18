# 192pxボスが 報酬画面(幅390)と戦闘の帯(高さ44)に収まるかを headless で測る。python rpg/tools/boss_fit.py → rpg/shots/assets_boss_fit.png と数値
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 18437), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
JS = r"""
async (ids) => {
  document.body.innerHTML = '<div id="host" style="padding:12px 14px"></div>'; const host = document.getElementById('host');
  const SP = RPGSprites, out = [];
  const lw = 0;
  for (const id of ids) {
    const wrap = document.createElement('div'); wrap.className = 'rw'; wrap.style.cssText = 'margin:0 0 10px;padding:0;min-height:0;background:#0b1329';
    wrap.innerHTML = '<div class="rw-scene"><canvas></canvas><div class="rw-cap">' + id + '</div></div><div class="rpg-strip"><canvas></canvas></div>';
    host.appendChild(wrap);
    const c = wrap.querySelector('.rw-scene canvas'), k = 3, cssW = c.parentNode.clientWidth;
    c.width = Math.ceil(cssW / k) * k; c.height = Math.round(c.width * 0.66 / k) * k;
    const g = c.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); const lw = c.width / k, lh = c.height / k;
    const gy2 = Math.round(lh * 0.88 / 2), cx = Math.round(lw / 4);
    const eim = SP.IMGS['enemy_' + id]; let ex2 = cx + 8, esc = 1; if (eim) { esc = Math.min(1, (c.width - 8 - 143) / eim.width); ex2 = Math.min(ex2, (c.width - 8 - eim.width * esc / 2) / 6 - 7); }
    const paint = (gg) => { SP.drawBackground(gg, lw, lh, SP.REGION_COLOR.meadow ? 'meadow' : 'meadow', 'reward'); gg.save(); gg.scale(2, 2);
      SP.drawHero(gg, 'warrior', cx - 20, gy2, { img: 'reward' }); SP.drawEnemy(gg, id, true, ex2, gy2, { img: 'reward', scale: esc }); gg.restore(); };
    paint(g);
    // 収まり判定: 大きな作業用キャンバスに同じ描画をして不透明範囲を測る
    const big = document.createElement('canvas'); big.width = c.width + 400; big.height = c.height + 400; const bg = big.getContext('2d'); bg.setTransform(k, 0, 0, k, 200, 200);
    bg.save(); bg.scale(2, 2); SP.drawEnemy(bg, id, true, ex2, gy2, { img: 'reward', scale: esc }); bg.restore();
    const d = bg.getImageData(0, 0, big.width, big.height).data; let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < big.height; y++) for (let x = 0; x < big.width; x++) if (d[(y * big.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const hb = document.createElement('canvas'); hb.width = big.width; hb.height = big.height; const hg = hb.getContext('2d'); hg.setTransform(k, 0, 0, k, 200, 200); hg.save(); hg.scale(2, 2); SP.drawHero(hg, 'warrior', cx - 20, gy2, { img: 'reward' }); hg.restore();
    const hd = hg.getImageData(0, 0, hb.width, hb.height).data; let hx1 = -1; for (let y = 0; y < hb.height; y++) for (let x = 0; x < hb.width; x++) if (hd[(y * hb.width + x) * 4 + 3] > 0 && x > hx1) hx1 = x;
    const r = { id, canvas: [c.width, c.height], reward: { left: x0 - 200, right: x1 - 200 - c.width + 1, top: y0 - 200, bottom: y1 - 200 - c.height + 1, heroRightVsBossLeft: (x0 - 200) - (hx1 - 200) } };
    // 帯
    const sc = wrap.querySelector('.rpg-strip canvas'); const SC = 2, cssW2 = sc.clientWidth || cssW, W = Math.ceil(cssW2 / SC), H = Math.round(44 / SC);
    sc.width = W * SC; sc.height = H * SC; const sg = sc.getContext('2d'); sg.setTransform(SC, 0, 0, SC, 0, 0); SP.drawBackground(sg, W, H, 'meadow', 'strip');
    const sim = SP.IMGS['enemy_' + id + '_strip'], ssc = sim ? Math.min(1, 40 / sim.height) : 1; const gy = H - 2, ex = W - 26; SP.drawHero(sg, 'warrior', 8, gy, { img: 'strip' }); SP.drawEnemy(sg, id, true, ex, gy, { img: 'strip', scale: ssc });
    const b2 = document.createElement('canvas'); b2.width = sc.width + 400; b2.height = sc.height + 400; const g2 = b2.getContext('2d'); g2.setTransform(SC, 0, 0, SC, 200, 200); SP.drawEnemy(g2, id, true, ex, gy, { img: 'strip', scale: ssc });
    const d2 = g2.getImageData(0, 0, b2.width, b2.height).data; let a0 = 1e9, a1 = -1, t0 = 1e9, t1 = -1;
    for (let y = 0; y < b2.height; y++) for (let x = 0; x < b2.width; x++) if (d2[(y * b2.width + x) * 4 + 3] > 0) { if (x < a0) a0 = x; if (x > a1) a1 = x; if (y < t0) t0 = y; if (y > t1) t1 = y; }
    r.strip = { canvas: [sc.width, sc.height], left: a0 - 200, right: a1 - 200 - sc.width + 1, top: t0 - 200, bottom: t1 - 200 - sc.height + 1 };
    out.push(r);
  }
  return out;
}
"""
ids = sys.argv[1:] or None
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_context(viewport={'width': 390, 'height': 900}, device_scale_factor=1).new_page(); con = []
    pg.on('pageerror', lambda e: con.append(str(e))); pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.goto('http://127.0.0.1:18437/index.html?nosend=1'); pg.wait_for_selector('.subj'); pg.wait_for_timeout(2500)
    if not ids:
        m = pg.evaluate("() => fetch('rpg/ASSET_MANIFEST.json').then(r => r.json())")
        ids = sorted(a['id'][6:] for a in m['assets'] if a['id'].startswith('enemy_') and not a['id'].endswith('_strip') and a['id'][6:].split('_')[0] in ('b', 'tb', 'xb'))
    res = pg.evaluate(JS, ids); pg.wait_for_timeout(300)
    bad = []
    for r in res:
        rw, st = r['reward'], r['strip']
        flag = []
        if rw['left'] < 0 or rw['right'] > 0 or rw['top'] < 0 or rw['bottom'] > 0: flag.append('報酬はみ出し')
        if rw['heroRightVsBossLeft'] < 0: flag.append('主人公と重なり')
        if st['left'] < 0 or st['right'] > 0 or st['top'] < 0 or st['bottom'] > 0: flag.append('帯はみ出し')
        print(r['id'], 'reward', rw, 'strip', st, flag)
        if flag: bad.append((r['id'], flag))
    pg.screenshot(path=os.path.join(ROOT, 'rpg', 'shots', 'assets_boss_fit.png'), full_page=True); print('BAD', bad, 'console', con); b.close()
