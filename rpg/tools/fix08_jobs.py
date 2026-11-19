# 修正指示書08 全職の新比率の確認画像と実測。python rpg/tools/fix08_jobs.py [職 ...]（省略=全12職）
# 出力: rpg/shots/fix08_jobs/（all_L_idle.png / all_S_strip.png / sheet_<職>.png / faces.png / costumes.png / ratios.json）
# 描画は実物の rpg-sprites.js（drawHeroLayered）を headless Chromium で動かす。
import os, sys, io, json, threading, http.server, socketserver, base64
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_jobs'); os.makedirs(OUT, exist_ok=True)
Q3 = "'" * 3
src = open(os.path.join(os.path.dirname(__file__), 'fix08_shots.py'), encoding='utf-8').read()
HTML = eval("b" + Q3 + src.split("HTML = b" + Q3)[1].split(Q3)[0] + Q3)
ALL = ['warrior', 'mage', 'priest', 'thief', 'magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger', 'skyknight', 'starseer']
ALT = ['magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger']
JOBS = sys.argv[1:] or ALL
WEAPON = {'warrior': 'w_start', 'magicknight': 'w_sword_1', 'paladin': 'w_sword_1', 'skyknight': 'w_sword_1', 'mage': 'w_staff_1', 'priest': 'w_staff_1', 'sage': 'w_staff_1', 'starseer': 'w_staff_1', 'thief': 'w_dagger_1', 'shadow': 'w_dagger_1', 'ninja': 'w_dagger_1', 'ranger': 'w_bow_1'}
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.split('?')[0] == '/__h.html':
            self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers(); self.wfile.write(HTML); return
        super().do_GET()
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', 18473), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
FONT = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 13)
BG = (24, 28, 48, 255)
def pil(d): return Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA')
def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def labeled(im, t):
    cv = Image.new('RGBA', (max(im.width, 9 * len(t) + 8), im.height + 18), BG); cv.alpha_composite(im, (0, 18)); ImageDraw.Draw(cv).text((3, 0), t, fill=(255, 255, 255), font=FONT); return cv
def hstack(ims, gap=6):
    cv = Image.new('RGBA', (sum(i.width for i in ims) + gap * (len(ims) + 1), max(i.height for i in ims) + gap * 2), BG); x = gap
    for i in ims: cv.alpha_composite(i, (x, gap)); x += i.width + gap
    return cv
def vstack(ims, gap=6):
    cv = Image.new('RGBA', (max(i.width for i in ims) + gap * 2, sum(i.height for i in ims) + gap * (len(ims) + 1)), BG); y = gap
    for i in ims: cv.alpha_composite(i, (gap, y)); y += i.height + gap
    return cv
def rows(cells, n):
    return vstack([hstack(cells[i:i + n]) for i in range(0, len(cells), n)])
LP = ['idle', 'ready', 'attack', 'guard', 'win', 'hit']; SPS = ['idle', 'walk', 'walk2', 'windup', 'attack', 'guard', 'win', 'hit']
res = {}
with sync_playwright() as pw:
    br = pw.chromium.launch(headless=True); pg = br.new_page(viewport={'width': 800, 'height': 600}); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:18473/__h.html')
    def R(spec): return pil(pg.evaluate('s => render(s)', spec))
    def L(job, pose, costume=None, look=None, weapon=True, w=150, h=118, bg='#e8eefc'):
        o = {'job': job, 'pose': pose, 'use': 'self', 'weaponId': WEAPON[job] if weapon else None, 'costume': costume}
        if look: o['look'] = look
        return R({'w': w, 'h': h, 'bg': 'color', 'color': bg, 'items': [{'kind': 'hero', 'x': 60, 'y': 110, 'o': o}]})
    def S(job, pose, costume=None, w=44, h=36):
        o = {'job': job, 'pose': pose, 'use': 'strip', 'weaponId': WEAPON[job], 'outline': '#141a3c', 'costume': costume}
        return R({'w': w, 'h': h, 'bg': 'color', 'color': '#a8c8a0', 'items': [{'kind': 'hero', 'x': 18, 'y': 33, 'o': o}]})
    def plan(job, pose, size, costume=None):
        for _ in range(60):
            r = pg.evaluate('o => { const p = RPGSprites.planHero(o); return { mode: p.mode, pose: p.h.pose } }', {'job': job, 'pose': pose, 'use': 'strip' if size == 'S' else 'self', 'costume': costume, 'weaponId': WEAPON[job]})
            if r['mode'] != 'wait': return r
            pg.wait_for_timeout(100)
        return r
    pg.wait_for_timeout(500)
    L_cells = [labeled(L(j, 'idle'), j) for j in JOBS]
    L2 = [labeled(up(L(j, 'idle'), 2), j) for j in JOBS]
    vstack([rows(L_cells, 6), rows(L2, 3)]).convert('RGB').save(os.path.join(OUT, 'all_L_idle.png'))
    sc = []
    for j in JOBS:
        s = R({'w': 390, 'h': 44, 'strip': True, 'bg': 'none', 'items': [{'kind': 'enemy', 'id': 'e_acornsoldier', 'x': 90, 'y': 21, 'scale': 1}, {'kind': 'hero', 'x': 60, 'y': 21, 'o': {'job': j, 'pose': 'idle', 'use': 'strip', 'weaponId': WEAPON[j], 'outline': '#141a3c'}}]})
        sc.append(s.crop((60, 0, 240, 44)))
    vstack([rows([labeled(s, j) for s, j in zip(sc, JOBS)], 6), rows([labeled(up(s, 3), j) for s, j in zip(sc, JOBS)], 3)]).convert('RGB').save(os.path.join(OUT, 'all_S_strip.png'))
    for j in JOBS:
        lc = [labeled(up(L(j, p, w=128, h=112), 2), 'L ' + p) for p in LP]; scs = [labeled(up(S(j, p), 5), 'S ' + p) for p in SPS]
        vstack([hstack(lc), hstack(scs[:4]), hstack(scs[4:])]).convert('RGB').save(os.path.join(OUT, f'sheet_{j}.png'))
    # 顔4種x表情3種（戦士・髪0・実寸の2倍）
    fc = []
    for f in range(4):
        look = {'face': f, 'hairStyle': 0, 'skin': '#f0c39a', 'hair': '#7a4a2a'}
        for p, nm in (('idle', '通常'), ('attack', '攻撃'), ('win', '喜び')):
            fc.append(labeled(up(L('warrior', p, look=look, weapon=False, w=110, h=100), 2), f'顔{f} {nm}'))
    rows(fc, 3).convert('RGB').save(os.path.join(OUT, 'faces.png'))
    # マスター・追加衣装
    cc = []
    for j in ALL:
        cc.append(labeled(up(L(j, 'idle', w=120, h=112), 1), j + ' 通常')); cc.append(labeled(L(j, 'idle', costume='master', w=120, h=112), j + ' master'))
        cc.append(labeled(L(j, 'idle', costume='alt1', w=120, h=112), j + ' alt1') if j in ALT else labeled(Image.new('RGBA', (120, 112), (40, 44, 70, 255)), j + ' alt1 なし'))
    rows(cc, 6).convert('RGB').save(os.path.join(OUT, 'costumes.png'))
    sub = []
    for j in ALL:
        for c in (None, 'master') + (('alt1',) if j in ALT else ()):
            for size, ps in (('L', LP), ('S', SPS)):
                for p in ps:
                    r = plan(j, p, size, c)
                    if r['mode'] != 'layered' or r['pose'] != p: sub.append(f'{j}/{c}/{size}/{p}: {r["mode"]}->{r["pose"]}')
    res['代用または非layered'] = sub
    meas = {}
    def mz(j, c, pose='idle', use='self'):
        a = np.array(R({'w': 140, 'h': 130, 'bg': 'none', 'items': [{'kind': 'hero', 'x': 70, 'y': 120, 'o': {'job': j, 'pose': pose, 'use': use, 'weaponId': None, 'costume': c}}]}))
        ys, xs = np.nonzero(a[..., 3] > 0); return int(ys.max() - ys.min() + 1), int(xs.max() - xs.min() + 1)
    for j in ALL:
        for c in (None, 'master') + (('alt1',) if j in ALT else ()):
            meas[f'{j}/{c or "base"}'] = {'L': mz(j, c), 'S': mz(j, c, use='strip')}
    res['errors'] = errs; br.close()
def head_dims(name):
    a = np.array(Image.open(os.path.join(ROOT, 'rpg', 'assets', 'parts', name)).convert('RGBA')); op = a[..., 3] > 0
    ys, xs = np.nonzero(op); w = xs.max() - xs.min() + 1; widths = op.sum(1); neck = widths[-1]
    chin = next((y for y in range(op.shape[0] - 1, -1, -1) if widths[y] > max(neck * 2, neck + 4)), op.shape[0] - 1)
    return int(w), int(chin - ys.min() + 1)
hw, chin = head_dims('head_v2_f0_h0_L.png')
res['head_L'] = {'頭幅': hw, '頭部高(髪の上〜あご)': chin}
res['L'] = {k: {'全高': v['L'][0], '全高÷頭部高': round(v['L'][0] / chin, 3), '頭幅/全高': round(hw / v['L'][0], 3)} for k, v in meas.items()}
res['S_全高'] = {k: v['S'][0] for k, v in meas.items()}
json.dump(res, open(os.path.join(OUT, 'ratios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'代用n': len(sub), 'errors': res['errors'], 'L': {k: v['全高÷頭部高'] for k, v in res['L'].items()}}, ensure_ascii=False))
