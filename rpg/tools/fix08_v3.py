# 父の指示（2.0頭身・頭が大きく身体が細い）の戦士v3試作の比較画像と実測。python rpg/tools/fix08_v3.py
# 出力: rpg/shots/fix08_v3/compare.png と ratios.json。左から 見本（縮小）・現行v2・試作v3。実物の rpg-sprites.js を headless Chromium で動かす。
import os, io, json, threading, http.server, socketserver, base64
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_v3'); os.makedirs(OUT, exist_ok=True)
Q3 = "'" * 3
src = open(os.path.join(os.path.dirname(__file__), 'fix08_shots.py'), encoding='utf-8').read()
HTML = eval("b" + Q3 + src.split("HTML = b" + Q3)[1].split(Q3)[0] + Q3)
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.split('?')[0] == '/__h.html':
            self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers(); self.wfile.write(HTML); return
        super().do_GET()
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', 18475), H); threading.Thread(target=srv.serve_forever, daemon=True).start()
FONT = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 13); BG = (24, 28, 48, 255)
def pil(d): return Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA')
def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def labeled(im, t):
    cv = Image.new('RGBA', (max(im.width, 9 * len(t) + 8), im.height + 18), BG); cv.alpha_composite(im, (0, 18)); ImageDraw.Draw(cv).text((3, 0), t, fill=(255, 255, 255), font=FONT); return cv
def hstack(ims, gap=8):
    cv = Image.new('RGBA', (sum(i.width for i in ims) + gap * (len(ims) + 1), max(i.height for i in ims) + gap * 2), BG); x = gap
    for i in ims: cv.alpha_composite(i, (x, gap)); x += i.width + gap
    return cv
def vstack(ims, gap=8):
    cv = Image.new('RGBA', (max(i.width for i in ims) + gap * 2, sum(i.height for i in ims) + gap * (len(ims) + 1)), BG); y = gap
    for i in ims: cv.alpha_composite(i, (gap, y)); y += i.height + gap
    return cv
ref = Image.open(os.path.join(ROOT, 'rpg', 'assets', 'src', 'ref_style_father_20261119.png')).convert('RGBA')
JOB = {'v2': 'warrior', 'v3': 'warrior_v3'}
res = {}
with sync_playwright() as pw:
    br = pw.chromium.launch(headless=True); pg = br.new_page(viewport={'width': 800, 'height': 600}); errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://127.0.0.1:18475/__h.html'); pg.wait_for_timeout(500)
    def R(spec): return pil(pg.evaluate('s => render(s)', spec))
    def L(v, pose, bg='town', weapon='w_sword_1', w=150, h=130, use='home'):
        o = {'job': JOB[v], 'pose': pose, 'use': use, 'weaponId': weapon}
        return R({'w': w, 'h': h, 'bg': bg, 'color': '#e8eefc', 'items': [{'kind': 'hero', 'x': 70, 'y': 122, 'o': o}]})
    def S(v, pose, weapon='w_sword_1'):
        items = [{'kind': 'enemy', 'id': 'e_acornsoldier', 'x': 97 - 7, 'y': 21, 'scale': 1}, {'kind': 'hero', 'x': 60, 'y': 21, 'o': {'job': JOB[v], 'pose': pose, 'use': 'strip', 'weaponId': weapon, 'outline': '#141a3c'}}]
        return R({'w': 390, 'h': 44, 'strip': True, 'bg': 'none', 'items': items}).crop((40, 0, 220, 44))
    refL = ref.resize((int(ref.width * 130 / ref.height), 130), Image.LANCZOS); refL2 = ref.resize((int(ref.width * 260 / ref.height), 260), Image.LANCZOS)
    rows = [hstack([labeled(refL, '見本（縮小）'), labeled(L('v2', 'idle'), '現行v2 実寸1倍'), labeled(L('v3', 'idle'), '試作v3 実寸1倍')]),
            hstack([labeled(refL2, '見本'), labeled(up(L('v2', 'idle'), 2), '現行v2 2倍（ホームの表示）'), labeled(up(L('v3', 'idle'), 2), '試作v3 2倍')])]
    pose_row = []
    for pose, nm in (('attack', '攻撃'), ('win', '勝利')):
        pose_row += [labeled(up(L('v2', pose), 2), 'v2 ' + nm), labeled(up(L('v3', pose), 2), 'v3 ' + nm)]
    rows.append(hstack(pose_row))
    srow = []
    for v in ('v2', 'v3'): srow.append(labeled(S(v, 'idle'), f'帯 {v} 待機 実寸1倍'))
    for v in ('v2', 'v3'): srow.append(labeled(S(v, 'attack'), f'帯 {v} 攻撃 実寸1倍'))
    rows.append(hstack(srow))
    srow3 = []
    for v in ('v2', 'v3'): srow3.append(labeled(up(S(v, 'idle'), 3), f'帯 {v} 待機 3倍'))
    for v in ('v2', 'v3'): srow3.append(labeled(up(S(v, 'attack'), 3), f'帯 {v} 攻撃 3倍'))
    rows.append(hstack(srow3[:2])); rows.append(hstack(srow3[2:]))
    vstack(rows).convert('RGB').save(os.path.join(OUT, 'compare.png'))
    def meas(v, pose='idle', use='self'):
        a = np.array(R({'w': 140, 'h': 130, 'bg': 'none', 'items': [{'kind': 'hero', 'x': 70, 'y': 120, 'o': {'job': JOB[v], 'pose': pose, 'use': use, 'weaponId': None}}]}))
        ys, xs = np.nonzero(a[..., 3] > 0); return int(ys.max() - ys.min() + 1), int(xs.max() - xs.min() + 1)
    M = {v: {'L': meas(v), 'S': meas(v, use='strip')} for v in ('v2', 'v3')}
    res['errors'] = errs; br.close()
P = os.path.join(ROOT, 'rpg', 'assets', 'parts'); pj = json.load(open(os.path.join(P, 'parts.json'), encoding='utf-8'))
def head_dims(name):
    a = np.array(Image.open(os.path.join(P, name)).convert('RGBA')); op = a[..., 3] > 0
    ys, xs = np.nonzero(op); w = xs.max() - xs.min() + 1; widths = op.sum(1); neck = widths[-1]
    chin = next((y for y in range(op.shape[0] - 1, -1, -1) if widths[y] > max(neck * 2, neck + 4)), op.shape[0] - 1)
    return int(w), int(chin - ys.min() + 1)
def torso(v):
    key = ('warrior_idle_L' if v == 'v2' else 'warrior_v3_idle_L'); b = pj['body'][key]; ny = int(b['neck'][1])
    a = np.array(Image.open(os.path.join(P, 'body_' + key + '.png')).convert('RGBA')).astype(int)
    blue = (a[..., 2] > a[..., 0] + 40) & (a[..., 2] > a[..., 1] + 5) & (a[..., 3] > 0) & (a[..., :3].sum(2) > 250); best = 0
    for y in range(ny + 1, min(a.shape[0], ny + 22)):
        xs = np.nonzero(blue[y])[0]
        if len(xs): best = max(best, int(xs.max() - xs.min() + 1))
    hand = Image.open(os.path.join(P, b['hand'])).size if b.get('hand') else None
    cape = (a[..., 0] > 200) & (a[..., 1] > 170) & (a[..., 2] > 120) & (a[..., 2] < 225); keep = (a[..., 3] > 0) & ~cape; wmax = 0
    for y in range(ny, a.shape[0]):
        xs = np.nonzero(keep[y])[0]
        if len(xs): wmax = max(wmax, int(xs.max() - xs.min() + 1))
    return best, hand, wmax
for v, hn in (('v2', 'head_v2_f0_h0_L.png'), ('v3', 'head_v3_f0_h0_L.png')):
    hw, chin = head_dims(hn); tw, hand, wmax = torso(v); H_, W_ = M[v]['L']
    res[v] = {'全高(px)': H_, '頭部高_髪の上〜あご(px)': chin, '全高÷頭部高': round(H_ / chin, 2), '頭幅(px)': hw, '胴幅_青い上着の最大(px)': tw, '胴幅/頭幅': round(tw / hw, 2),
              'マント込み最大幅(px)': W_, '拳込み最大幅_マント除く(px)': wmax, '拳込み最大幅/頭幅': round(wmax / hw, 2), '拳(px)': list(hand) if hand else None, '拳幅/頭幅': round(hand[0] / hw, 2) if hand else None, 'S全高(px)': M[v]['S'][0]}
json.dump(res, open(os.path.join(OUT, 'ratios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
