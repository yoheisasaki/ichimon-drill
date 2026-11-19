# 09 U15：幅320×高568の縮退表示で、画面内に収まらない主要操作が「縦スクロールで届き、押せる」ことの確認（chromium・webkit、nosend=1）。
# fix08_screens.py で 320x568 の #hard・範囲変更・「くわしく」が最初の表示の外／ナビの裏に出た画面について、内側の本文（#rsBody）を最下までスクロールして可視・押下可能かを測る。
# 出力: rpg/shots/fix09_scroll320/ の画像と result.json。python rpg/tools/fix09_scroll320.py [port]
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18611
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix09_scroll320'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=3000; s.equip.weapon='w_sword_1'; s.jobXp.warrior=9000; s.active=null; s.daily.used={}; s.chests=[];"
R = {'rows': [], 'console': []}
PROBE = """(sel) => { const e = document.querySelector(sel); if (!e) return null; const b = document.getElementById('rsBody'); if (b) b.scrollTop = b.scrollHeight; const r = e.getBoundingClientRect(); const cx = Math.min(innerWidth - 1, Math.max(0, (r.left + r.right) / 2)), cy = Math.min(innerHeight - 1, Math.max(0, (r.top + r.bottom) / 2)); const t = document.elementFromPoint(cx, cy);
  const nav = document.querySelector('.rs-nav, .rs-tabs'); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, inView: r.top >= 0 && r.bottom <= innerHeight, hit: !!t && (t === e || e.contains(t)), navTop: nav ? Math.round(nav.getBoundingClientRect().top) : null, pageScroll: document.documentElement.scrollHeight > innerHeight + 1 }; }"""
CASES = [('home', "() => { window.__rangeOpen = false; home(); }", '#hard'), ('home', None, '.rs-range summary'), ('me', "() => RPG.go('me')", '[data-sheet=mestat]'), ('me', None, '[data-go=equip]')]
with sync_playwright() as p:
    for eng in ('chromium', 'webkit'):
        b = getattr(p, eng).launch(headless=True)
        ctx = b.new_context(viewport={'width': 320, 'height': 568}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); pg.set_default_timeout(30000)
        pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
        pg.route('**/script.google.com/**', lambda r: r.abort())
        pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
        pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
        pg.reload(); pg.wait_for_selector('#go', state='attached'); pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(600)
        for scr, setup, sel in CASES:
            if setup: pg.evaluate(setup); pg.wait_for_timeout(500)
            r = pg.evaluate(PROBE, sel); pg.wait_for_timeout(200)
            pg.screenshot(path=os.path.join(OUT, f'{eng}_320x568_{scr}_{sel.replace(" ", "_").replace("[", "").replace("]", "").replace("#", "").replace(".", "").replace("=", "-")}_scrolled.png'))
            R['rows'].append({'engine': eng, 'screen': scr, 'sel': sel, 'result': r})
            print(eng, scr, sel, r, flush=True)
        ctx.close(); b.close()
R['bad'] = [x for x in R['rows'] if not x['result'] or not x['result']['inView'] or not x['result']['hit']]
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('BAD', len(R['bad']), R['console'][:3])
