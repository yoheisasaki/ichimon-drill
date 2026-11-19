# 主人公の絵が各舞台の枠に収まっているか（頭の上端が切れていないか）の実測。python rpg/tools/fix09_fit.py [port]
# 実際の画面の canvas[data-hero] ごとに、背景なしで同じ位置・倍率に描き直し、描かれた画素の上端・左右端・下端と枠の余白を測る（headless chromium、390x700、nosend=1）。
import sys, os, re, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18561
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix09_fit'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
PATCH = "s.job='%s'; s.firstDone=true; s.coins=3000; s.equip.weapon='%s'; s.active=null; s.daily.used={}; s.chests=[];"
MEASURE = """() => [...document.querySelectorAll('canvas[data-hero]')].map(c => {
  const a = JSON.parse(c.dataset.hero), W = c.width, H = c.height, dpr = W / c.getBoundingClientRect().width;
  // 画面の絵（背景つき）ではなく、同じ canvas を背景なしで描き直した結果の外接矩形を測る
  const t = document.createElement('canvas'); t.width = W; t.height = H;
  const g = t.getContext('2d'); g.imageSmoothingEnabled = false;
  const cs = window.__STAGE_FOR(a.use); const css = H / dpr;
  const r = RPGSprites.drawHeroLayered(g, { job: a.job, costume: a.costume, weaponId: a.weaponId, pose: a.pose || cs.pose, use: cs.strip ? 'strip' : a.use, x: Math.round(W / dpr * cs.at) * dpr, groundY: (css - (cs.gy || 8)) * dpr, scale: cs.k * dpr });
  const d = g.getImageData(0, 0, W, H).data; let top = H, bot = -1, l = W, rr = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (y < top) top = y; if (y > bot) bot = y; if (x < l) l = x; if (x > rr) rr = x; }
  return { use: a.use, job: a.job, drawn: r, cssW: W / dpr, cssH: css, top: top / dpr, bottom: (H - bot) / dpr, left: l / dpr, right: (W - rr) / dpr, hero_h: (bot - top) / dpr };
})"""
STAGE_JS = """window.__STAGE_FOR = u => ({
  home: { h: 190, k: 1.5, pose: 'idle', at: 0.5, gy: 24 }, self: { k: 1.35, pose: 'idle', at: 0.5, gy: 10 }, town: { k: 1, pose: 'idle', at: 0.5, gy: 14 },
  equip: { k: 1.35, pose: 'idle', at: 0.5, gy: 10 }, job: { k: 1.5, pose: 'idle', at: 0.5, gy: 12 }, jobcard: { k: 0.5, pose: 'idle', at: 0.5, gy: 5 }, look: { k: 2, pose: 'idle', at: 0.5 },
  ending: { k: 2, pose: 'win', at: 0.5 }, fx: { k: 2, pose: 'idle', at: 0.5 }, mini: { k: 1, pose: 'idle', at: 0.5, strip: true } }[u] || { k: 1.5, pose: 'idle', at: 0.5 })"""
R = {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for job, wp in (('warrior', 'w_sword_1'), ('priest', 'w_staff_1'), ('skyknight', 'w_sword_1'), ('sage', 'w_staff_1')):
        ctx = b.new_context(viewport={'width': 390, 'height': 700}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.set_default_timeout(30000); pg.route('**/script.google.com/**', lambda r: r.abort())
        pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
        pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); s.jobXp.warrior=9000; s.jobXp.mage=9000; s.jobXp.priest=9000; localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH % (job, wp)])
        pg.reload(); pg.wait_for_selector('#go', state='attached')
        pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(700)
        pg.evaluate(STAGE_JS)
        for scr, prm in (('home', {}), ('town', {}), ('me', {}), ('equip', {}), ('jobs', {}), ('jobdetail', {'job': job}), ('look', {})):
            try:
                pg.evaluate("([n, p]) => RPG.go(n, p || {})", [scr, prm]); pg.wait_for_timeout(600)
                R.setdefault(job, {})[scr] = pg.evaluate(MEASURE)
                if scr in ('equip', 'me'): pg.screenshot(path=os.path.join(OUT, f'{job}_{scr}.png'))
            except Exception as e:
                R.setdefault(job, {})[scr] = str(e)[:120]
        ctx.close()
    b.close()
bad = []
for job, d in R.items():
    for scr, L in d.items():
        if isinstance(L, str): continue
        for x in L:
            if x['top'] < 2 or x['left'] < 0 or x['right'] < 0 or x['bottom'] < 0: bad.append((job, scr, x['use'], x['top'], x['left'], x['right'], x['bottom']))
json.dump({'rows': R, 'bad': bad}, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for job, d in R.items():
    for scr, L in d.items():
        if isinstance(L, str): print(job, scr, 'ERR', L); continue
        for x in L: print(job, scr, x['use'], 'h=%.0f top=%.1f bot=%.1f L=%.1f R=%.1f W=%.0f H=%.0f %s' % (x['hero_h'], x['top'], x['bottom'], x['left'], x['right'], x['cssW'], x['cssH'], x['drawn']))
print('BAD', bad)
