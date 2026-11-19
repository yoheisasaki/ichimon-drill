# ゲーム画面の字体比較（headless webkit）。python tools/font_compare.py
# A＝今まで（rpg-font.css を外す）／B＝DotGothic16。同じ画面を撮り、はみ出し検出数・読み込んだ字体ファイルの大きさを数える。
# 出力：_shots/font/<幅x高さ>/<画面>_A|B.png と _shots/font/compare_<幅x高さ>.png、result.json
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); OUT = os.path.join(ROOT, '_shots', 'font'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', 18497), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=3000; ['w_sword_1','w_sword_2'].forEach(i => { s.inv.items[i]=1; s.codex.items[i]=1; }); s.equip.weapon='w_sword_1'; s.active=null; s.name='ゆうた'; s.daily={maxKey:'',used:{}}; s.progress.step=40; s.seen={};"
DATA = json.load(open(os.path.join(ROOT, 'data', 'questions.json'), encoding='utf-8'))
cur = [t for t in DATA['tests'] if t.get('current')][0]['id']
QID = next(q['id'] for q in DATA['questions'] if q['test'] == cur and q['subject'] == '理科' and q.get('exp') and q.get('type') != 'input')
SCREENS = ['home', 'adv', 'town', 'me', 'equip', 'jobs', 'shop', 'loadout', 'result', 'question']
R = {}
with sync_playwright() as pw:
    b = pw.webkit.launch(headless=True)
    for (w, h, z) in ((390, 844, 1.0), (375, 667, 1.0), (320, 568, 1.3)):
        vp = f'{w}x{h}' + ('_z130' if z != 1.0 else ''); d = os.path.join(OUT, vp); os.makedirs(d, exist_ok=True)
        pair = {}
        for var in ('A', 'B'):
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
            pg = ctx.new_page(); pg.set_default_timeout(40000); fonts = []
            pg.on('response', lambda r: fonts.append((r.url, len(r.body() or b''))) if 'gstatic.com' in r.url and 'dotgothic' in r.url.lower() else None)
            pg.goto('http://127.0.0.1:18497/index.html?nosend=1'); pg.wait_for_selector('#go', state='attached')
            pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
            pg.reload(); pg.wait_for_selector('#go', state='attached'); pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000)
            if var == 'A': pg.evaluate("() => { [...document.styleSheets].forEach(s => { if (s.href && /rpg-font\\.css/.test(s.href)) s.disabled = true; }); }")
            else: pg.evaluate("async () => { await document.fonts.load('16px DotGothic16', '山脈冒険装備転職'); await document.fonts.ready; }")
            if z != 1.0: pg.evaluate("() => { document.body.style.zoom = 1.3; }")
            pg.wait_for_timeout(800)
            for sc in SCREENS:
                if sc == 'home': pg.evaluate("() => { home(); }")
                elif sc == 'result':
                    pg.evaluate("(ids) => { app.onclick = null; start(ids.map(id => DATA.questions.find(q => q.id === id))); }", [q['id'] for q in DATA['questions'] if q['test'] == cur][:2])
                    for i in range(6):
                        pg.wait_for_timeout(450)
                        pg.evaluate("() => { if (S && !S.locked && document.querySelector('.choice')) { const q = S.cur; document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); } }"); pg.wait_for_timeout(900)
                        pg.evaluate("() => { if (app.onclick) { app.onclick = null; advance(); } }")
                    pg.wait_for_timeout(1500)
                elif sc == 'question':
                    pg.evaluate("() => { home(); }"); pg.evaluate("(id) => { app.onclick = null; start([DATA.questions.find(q => q.id === id)]); }", QID); pg.wait_for_timeout(500)
                    pg.evaluate("() => { const q = S.cur, k = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[k].click(); }"); pg.wait_for_timeout(1700)
                else: pg.evaluate("(n) => RPG.go(n)", sc)
                pg.wait_for_timeout(500)
                if var == 'B': pg.evaluate("async () => { await document.fonts.ready; }")
                f = os.path.join(d, f'{sc}_{var}.png'); pg.screenshot(path=f)
                r = pg.evaluate("() => { const o = IchimonVoice.collect(); return o.report.anomalies.filter(a => a.k === 'text_overflow' || a.k === 'off_x' || a.k === 'overlap').map(a => a.k + ':' + (a.sel || a.n || a.a)); }")
                R[f'{vp}/{sc}/{var}'] = r; pair[(sc, var)] = f
            R[f'{vp}/{var}/fontfiles'] = sorted(set((u.split('/')[-1][-22:], n) for u, n in fonts))
            ctx.close()
        # A | B を並べた比較画像（画面ごと2列）
        ims = [(sc, Image.open(pair[(sc, 'A')]).convert('RGB'), Image.open(pair[(sc, 'B')]).convert('RGB')) for sc in SCREENS]
        sc0 = 0.5; W = int(ims[0][1].width * sc0); H = int(ims[0][1].height * sc0)
        cols = 5; rows = (len(ims) + cols - 1) // cols
        M = Image.new('RGB', (cols * (2 * W + 8), rows * (H + 16)), 'white'); dr = ImageDraw.Draw(M)
        for i, (sc, a, bb) in enumerate(ims):
            x, y = (i % cols) * (2 * W + 8), (i // cols) * (H + 16); dr.text((x + 2, y + 1), f'{sc}   左A(今まで) 右B(DotGothic16)', fill='black')
            M.paste(a.resize((W, H)), (x, y + 14)); M.paste(bb.resize((W, H)), (x + W, y + 14))
        M.save(os.path.join(OUT, f'compare_{vp}.png'))
    b.close()
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for k, v in R.items():
    if k.endswith('fontfiles'): print(k, v)
    elif v: print(k, v[:5])
