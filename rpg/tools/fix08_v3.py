# 父の指示（2.0頭身・頭が大きく身体が細い）の戦士v3試作の比較画像と実測。python rpg/tools/fix08_v3.py
# 出力: rpg/shots/fix08_v3/compare.png・neck_zoom.png と ratios.json。左から 見本（縮小）・現行v2・前回v3・今回v3b（頭も身体も一体の絵）。実物の rpg-sprites.js を headless Chromium で動かす。
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
JOB = {'v2': 'warrior', 'v3': 'warrior_v3', 'v3b': 'warrior_v3b'}
VS = ('v2', 'v3', 'v3b')
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
    NM = {'v2': '現行v2', 'v3': '前回v3', 'v3b': '今回v3b'}
    rows = [hstack([labeled(refL, '見本（縮小）')] + [labeled(L(v, 'idle'), NM[v] + ' 実寸1倍') for v in VS]),
            hstack([labeled(refL2, '見本')] + [labeled(up(L(v, 'idle'), 2), NM[v] + ' 2倍') for v in VS])]
    for pose, nm in (('attack', '攻撃'), ('win', '勝利')):
        rows.append(hstack([labeled(up(L(v, pose), 2), NM[v] + ' ' + nm) for v in VS]))
    for pose, nm in (('idle', '待機'), ('attack', '攻撃')):
        rows.append(hstack([labeled(S(v, pose), f'帯 {NM[v]} {nm} 実寸1倍') for v in VS]))
    for pose, nm in (('idle', '待機'), ('attack', '攻撃')):
        rows.append(hstack([labeled(up(S(v, pose), 3), f'帯 {NM[v]} {nm} 3倍') for v in VS[1:]]))
    vstack(rows).convert('RGB').save(os.path.join(OUT, 'compare.png'))
    def meas(v, pose='idle', use='self'):
        a = np.array(R({'w': 140, 'h': 130, 'bg': 'none', 'items': [{'kind': 'hero', 'x': 70, 'y': 120, 'o': {'job': JOB[v], 'pose': pose, 'use': use, 'weaponId': None}}]}))
        ys, xs = np.nonzero(a[..., 3] > 0); return int(ys.max() - ys.min() + 1), int(xs.max() - xs.min() + 1)
    M = {v: {'L': meas(v), 'S': meas(v, use='strip')} for v in VS}
    IMG = {v: np.array(R({'w': 140, 'h': 130, 'bg': 'none', 'items': [{'kind': 'hero', 'x': 70, 'y': 120, 'o': {'job': JOB[v], 'pose': 'idle', 'use': 'self', 'weaponId': None}}]})) for v in VS}
    res['errors'] = errs; br.close()
P = os.path.join(ROOT, 'rpg', 'assets', 'parts'); pj = json.load(open(os.path.join(P, 'parts.json'), encoding='utf-8'))
import colorsys
from scipy import ndimage as ndi
def hsv(c): return colorsys.rgb_to_hsv(*[x / 255 for x in c[:3]])
def skinlike(a):
    f = a[..., :3].astype(float) / 255; mx = f.max(2); mn = f.min(2); d = mx - mn; sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]; h = np.where(d == 0, 0, np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6, 60)) * 60
    return (a[..., 3] > 0) & (h >= 8) & (h <= 36) & (sat >= 0.22) & (sat <= 0.7) & (mx >= 0.6) & (r > g) & (g > b)
def analyze(img):
    op = img[..., 3] > 0; sk = skinlike(img); lab, n = ndi.label(sk)
    sizes = ndi.sum(sk, lab, range(1, n + 1)); face = lab == (1 + int(np.argmax(sizes)))
    ys, xs = np.nonzero(op); top = ys.min(); fy = int(np.nonzero(face)[0].max())
    rgb = img[..., :3].astype(int); luma = rgb @ np.array([0.3, 0.59, 0.11]); dark = op & (luma < 85)
    def band(y0, y1):
        rows = range(y0, y1 + 1); cols = set(); skins = set(); runs = []
        for y in rows:
            for x in np.nonzero(dark[y])[0]: cols.add(tuple(rgb[y, x]))
            for x in np.nonzero(sk[y])[0]: skins.add(tuple(rgb[y, x]))
            x = 0; row = dark[y]; W_ = len(row)
            while x < W_:   # 輪郭の太さ＝横方向に連続した暗い画素の長さ（帯の全行の中央値）
                if row[x]:
                    k = 0
                    while x < W_ and row[x]: k += 1; x += 1
                    runs.append(k)
                else: x += 1
        return cols, skins, float(np.median(runs)) if runs else 0.0
    ua = band(fy - 5, fy); ub = band(fy + 1, fy + 6)
    hw = int(np.ptp(np.nonzero(op[top:fy - 5].any(0))[0]) + 1)
    f = img[..., :3].astype(int); blue = op & (f[..., 2] > f[..., 0] + 40) & (f[..., 2] > f[..., 1] + 5) & (f[..., :3].sum(2) > 250); tw = 0
    for y in range(fy + 3, min(img.shape[0], fy + 22)):
        xs_ = np.nonzero(blue[y])[0]
        if len(xs_): tw = max(tw, int(xs_.max() - xs_.min() + 1))
    cape = (f[..., 0] > 200) & (f[..., 1] > 170) & (f[..., 2] > 120) & (f[..., 2] < 225); keep = op & ~cape; wmax = 0
    for y in range(fy, img.shape[0]):
        xs_ = np.nonzero(keep[y])[0]
        if len(xs_): wmax = max(wmax, int(xs_.max() - xs_.min() + 1))
    return dict(top=int(top), chin=fy, head_h=int(fy - top + 1), head_w=hw, total_h=int(ys.max() - top + 1), torso_w=tw, maxw_nocape=wmax, maxw_all=int(np.ptp(np.nonzero(op.any(0))[0]) + 1),
                neck=dict(outline_colors_above=len(ua[0]), outline_colors_below=len(ub[0]), outline_same_color=ua[0] == ub[0] and len(ua[0]) == 1, outline_thick_above=round(ua[2], 2), outline_thick_below=round(ub[2], 2),
                          skin_values_above=len(ua[1]), skin_values_below=len(ub[1]), skin_values_shared=len(ua[1] & ub[1]), skin_values_all_shared=ua[1] <= ub[1] or ub[1] <= ua[1]))
def hand_of(v):
    b = pj['body'][{'v2': 'warrior_idle_L', 'v3': 'warrior_v3_idle_L', 'v3b': 'warrior_v3b_idle_L'}[v]]
    return list(Image.open(os.path.join(P, b['hand'])).size) if b.get('hand') else None
NECK = []
for v in VS:
    A = analyze(IMG[v]); hand = hand_of(v)
    res[v] = {'全高(px)': A['total_h'], '頭部高_髪の上〜あご(px)': A['head_h'], '全高÷頭部高': round(A['total_h'] / A['head_h'], 2), '頭幅(px)': A['head_w'], '胴幅_青い上着の最大(px)': A['torso_w'], '胴幅/頭幅': round(A['torso_w'] / A['head_w'], 2),
              'マント込み最大幅(px)': A['maxw_all'], 'マント除く最大幅(px)': A['maxw_nocape'], '拳(px)': hand, '拳幅/頭幅': round(hand[0] / A['head_w'], 2) if hand else None, 'S全高(px)': M[v]['S'][0], '首の上下5pxの帯の自己検査': A['neck']}
    cy = A['chin']; crop = Image.fromarray(IMG[v]).crop((0, max(0, cy - 14), 140, cy + 15)); bg = Image.new('RGBA', crop.size, (232, 238, 252, 255)); bg.alpha_composite(crop); NECK.append(labeled(up(bg, 6).crop((200, 0, 700, 174)), f'{NM[v]} 首まわり6倍（あご={cy}行）'))
vstack(NECK).convert('RGB').save(os.path.join(OUT, 'neck_zoom.png'))
json.dump(res, open(os.path.join(OUT, 'ratios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
