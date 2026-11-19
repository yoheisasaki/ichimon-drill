# 戦士v3b 仕上げの比較画像と実測。python rpg/tools/fix08_v3b2.py [修正前のチェックアウト先（2b1cf26 のworktree）]
# 出力: rpg/shots/fix08_v3b2/compare.png・poses.png・metrics.json。修正前が無ければ修正後だけ。実物の rpg-sprites.js を headless Chromium で動かす。
import os, io, sys, json, threading, http.server, socketserver, base64
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BEFORE = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else None
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_v3b2'); os.makedirs(OUT, exist_ok=True)
Q3 = "'" * 3
src = open(os.path.join(os.path.dirname(__file__), 'fix08_shots.py'), encoding='utf-8').read()
HTML = eval("b" + Q3 + src.split("HTML = b" + Q3)[1].split(Q3)[0] + Q3)
def serve(root, port):
    class H(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
        def do_GET(self):
            if self.path.split('?')[0] == '/__h.html':
                self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers(); self.wfile.write(HTML); return
            super().do_GET()
        def __init__(self, *a, **k): super().__init__(*a, directory=root, **k)
    class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
    s = TS(('127.0.0.1', port), H); threading.Thread(target=s.serve_forever, daemon=True).start(); return s
FONT = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 13); BG = (24, 28, 48, 255)
def pil(d): return Image.open(io.BytesIO(base64.b64decode(d.split(',')[1]))).convert('RGBA')
def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def labeled(im, t):
    cv = Image.new('RGBA', (max(im.width, 14 * len(t) + 8), im.height + 18), BG); cv.alpha_composite(im, (0, 18)); ImageDraw.Draw(cv).text((3, 0), t, fill=(255, 255, 255), font=FONT); return cv
def hstack(ims, gap=8):
    cv = Image.new('RGBA', (sum(i.width for i in ims) + gap * (len(ims) + 1), max(i.height for i in ims) + gap * 2), BG); x = gap
    for i in ims: cv.alpha_composite(i, (x, gap)); x += i.width + gap
    return cv
def vstack(ims, gap=8):
    cv = Image.new('RGBA', (max(i.width for i in ims) + gap * 2, sum(i.height for i in ims) + gap * (len(ims) + 1)), BG); y = gap
    for i in ims: cv.alpha_composite(i, (gap, y)); y += i.height + gap
    return cv
ref = Image.open(os.path.join(ROOT, 'rpg', 'assets', 'src', 'ref_style_father_20261119.png')).convert('RGBA')
JOB = 'warrior_v3b'

class R_:
    def __init__(self, pw, port):
        self.br = pw.chromium.launch(headless=True); self.pg = self.br.new_page(viewport={'width': 800, 'height': 600}); self.errs = []
        self.pg.on('console', lambda m: self.errs.append(m.text) if m.type == 'error' else None); self.pg.on('pageerror', lambda e: self.errs.append(str(e)))
        self.pg.goto(f'http://127.0.0.1:{port}/__h.html'); self.pg.wait_for_timeout(500)
    def R(self, spec): return pil(self.pg.evaluate('s => render(s)', spec))
    def L(self, pose, weapon='w_sword_1', bg='town'):
        return self.R({'w': 150, 'h': 130, 'bg': bg, 'color': '#e8eefc', 'items': [{'kind': 'hero', 'x': 70, 'y': 122, 'o': {'job': JOB, 'pose': pose, 'use': 'home', 'weaponId': weapon}}]})
    def S(self, pose, weapon='w_sword_1'):
        items = [{'kind': 'enemy', 'id': 'e_acornsoldier', 'x': 97 - 7, 'y': 21, 'scale': 1}, {'kind': 'hero', 'x': 60, 'y': 21, 'o': {'job': JOB, 'pose': pose, 'use': 'strip', 'weaponId': weapon, 'outline': '#141a3c'}}]
        return self.R({'w': 390, 'h': 44, 'strip': True, 'bg': 'none', 'items': items}).crop((40, 0, 220, 44))
    def Lalpha(self, pose, weapon):
        return np.array(self.R({'w': 150, 'h': 130, 'bg': 'none', 'items': [{'kind': 'hero', 'x': 70, 'y': 122, 'o': {'job': JOB, 'pose': pose, 'use': 'home', 'weaponId': weapon}}]}))
    def close(self): self.br.close()

def sword_on_legs(r, pose):
    """剣の画素のうち、身体の足のあたり（身体の下から約22%＝拳より下の脚）にかかっている数。剣あり・なしの差から出す"""
    a = r.Lalpha(pose, 'w_sword_1'); b = r.Lalpha(pose, None)
    body = b[..., 3] > 0; ys, xs = np.nonzero(body); y0, y1 = ys.min(), ys.max(); hip = y1 - int((y1 - y0 + 1) * 0.22)
    diff = (a[..., :3] != b[..., :3]).any(2) & (a[..., 3] > 0)
    sw = diff | ((a[..., 3] > 0) & ~body)
    over_legs = int((sw & (np.arange(a.shape[0])[:, None] >= hip) & (np.arange(a.shape[1])[None] >= xs.min() - 2) & (np.arange(a.shape[1])[None] <= xs.max() + 2) & (np.arange(a.shape[0])[:, None] <= y1)).sum())
    # 脚の画素（身体の下22%）を剣が上書きした数
    legs_covered = int((diff & body & (np.arange(a.shape[0])[:, None] >= hip)).sum())
    return dict(hip_row=int(hip), sword_px_total=int(sw.sum()), sword_px_in_leg_rows=over_legs, leg_px_covered_by_sword=legs_covered)

def load_part(root, name): return np.array(Image.open(os.path.join(root, 'rpg', 'assets', 'parts', name)).convert('RGBA'))
def face_metrics(root, pose, size):
    a = load_part(root, f'body_{JOB}_{pose}_{size}.png'); pj = json.load(open(os.path.join(root, 'rpg', 'assets', 'parts', 'parts.json'), encoding='utf-8'))['body'][f'{JOB}_{pose}_{size}']
    fb = pj['faceBottom']; return a, fb
def eye_metrics(a, fb):
    """目：白いハイライトを含む暗い塊の大きさ（px）。輪郭や髪とつながると大きくなる（目だけなら小さい）。fb 行までの範囲"""
    h = a[:fb + 1]; rgb = h[..., :3].astype(int); op = h[..., 3] > 0
    dark = op & (rgb @ np.array([0.3, 0.59, 0.11]) < 80); white = op & (rgb.min(2) > 235)
    lab, n = ndi.label(dark, structure=np.ones((3, 3), int)); res = []
    for k in range(1, n + 1):
        m = lab == k
        if (ndi.binary_dilation(m, iterations=1) & white).any(): ys, xs = np.nonzero(m); res.append(dict(px=int(m.sum()), w=int(np.ptp(xs) + 1), h=int(np.ptp(ys) + 1)))
    return res
def tufts(a, fb):
    """髪の房：髪の上半分の輪郭から、半径2の円で開いても残らない（細くとがった）突起の数と画素数"""
    op = a[:, :, 3] > 0; sk = (np.abs(a[..., :3].astype(int) - np.array([251, 209, 164])).sum(2) < 30) & op
    rows = np.nonzero(sk.sum(1) >= 6)[0].min() - 3; M = op.copy(); M[rows:] = False
    yy, xx = np.mgrid[-2:3, -2:3]; st = (yy ** 2 + xx ** 2) <= 5
    P = np.pad(M, 4); O = ndi.binary_opening(P, st)[4:-4, 4:-4]; spikes = M & ~O; lab, n = ndi.label(spikes, structure=np.ones((3, 3), int))
    sizes = [int((lab == k).sum()) for k in range(1, n + 1)]; return dict(count=int(sum(1 for z in sizes if z >= 2)), px=int(sum(z for z in sizes if z >= 2)))
def colors(a): return int(len({tuple(c) for c in a[a[..., 3] > 0][:, :3].tolist()}))

res = {}
with sync_playwright() as pw:
    sa = serve(ROOT, 18476); A = R_(pw, 18476)
    B = None
    if BEFORE: sb = serve(BEFORE, 18477); B = R_(pw, 18477)
    V = [('修正後', A)] if not B else [('修正前', B), ('修正後', A)]
    refL = ref.resize((int(ref.width * 130 / ref.height), 130), Image.LANCZOS); refL2 = ref.resize((int(ref.width * 260 / ref.height), 260), Image.LANCZOS)
    rows = [hstack([labeled(refL, '見本（縮小）')] + [labeled(r.L('idle'), n + ' 待機 1倍') for n, r in V]),
            hstack([labeled(refL2, '見本')] + [labeled(up(r.L('idle'), 2), n + ' 待機 2倍') for n, r in V])]
    for pose, nm in (('attack', '攻撃'), ('win', '勝利')):
        rows.append(hstack([labeled(up(r.L(pose), 2), f'{n} {nm} 2倍') for n, r in V]))
    for pose, nm in (('idle', '待機'), ('attack', '攻撃')):
        rows.append(hstack([labeled(r.S(pose), f'帯 {n} {nm} 1倍') for n, r in V]))
    for pose, nm in (('idle', '待機'), ('attack', '攻撃')):
        rows.append(hstack([labeled(up(r.S(pose), 3), f'帯 {n} {nm} 3倍') for n, r in V]))
    vstack(rows).convert('RGB').save(os.path.join(OUT, 'compare.png'))
    # 顔・髪の拡大（部品そのもの 6倍）
    face = []
    for n, root in ([('修正前', BEFORE)] if BEFORE else []) + [('修正後', ROOT)]:
        for pose in ('idle', 'attack', 'win'):
            a, fb = face_metrics(root, pose, 'L'); im = Image.fromarray(a[:fb + 3]); bgc = Image.new('RGBA', im.size, (200, 220, 240, 255)); bgc.alpha_composite(im); face.append(labeled(up(bgc, 4), f'{n} {pose} 頭 4倍'))
    face2 = []
    for n, root in ([('修正前', BEFORE)] if BEFORE else []) + [('修正後', ROOT)]:
        for pose in ('idle', 'attack', 'win'):
            a, fb = face_metrics(root, pose, 'S'); im = Image.fromarray(a[:fb + 3]); bgc = Image.new('RGBA', im.size, (200, 220, 240, 255)); bgc.alpha_composite(im); face2.append(labeled(up(bgc, 12), f'{n} {pose} S頭 12倍'))
    n3 = len(face) // (2 if BEFORE else 1); n3s = len(face2) // (2 if BEFORE else 1)
    vstack([hstack(face[i:i + 3]) for i in range(0, len(face), 3)] + [hstack(face2[i:i + 3]) for i in range(0, len(face2), 3)]).convert('RGB').save(os.path.join(OUT, 'faces.png'))
    # 追加ポーズ（修正後のみ）
    pr = [labeled(up(A.L(p), 3), 'L ' + p + ' 3倍') for p in ('ready', 'guard', 'hit')]
    ps = [labeled(up(A.S(p), 2).crop((120, 0, 420, 88)), 'S ' + p + ' 2倍') for p in ('walk', 'walk2', 'windup', 'guard', 'hit')]
    vstack([hstack(pr), hstack(ps[:3]), hstack(ps[3:])]).convert('RGB').save(os.path.join(OUT, 'poses.png'))
    # 実測
    for n, r, root in ([('修正前', B, BEFORE)] if B else []) + [('修正後', A, ROOT)]:
        m = {'待機の剣と脚': sword_on_legs(r, 'idle')}
        for size in ('L', 'S'):
            for pose in ('idle', 'attack', 'win'):
                a, fb = face_metrics(root, pose, size); m[f'{size}_{pose}'] = dict(colors=colors(a), eyes=eye_metrics(a, fb) if size == 'S' else None, 髪の房=tufts(a, fb) if size == 'L' else None)
        ai, fi = face_metrics(root, 'idle', 'L'); aa, fa = face_metrics(root, 'attack', 'L')
        # 攻撃と待機の頭（髪の上〜あご）が同じか：あごの行をそろえ、左右の位置は一致する横ずれの最小差を探す
        hi = ai[:fi + 1]; ha = aa[:fa + 1]; best = None
        for dx in range(-20, 21):
            diff = 0; tot = 0
            for y in range(hi.shape[0]):
                for x in range(hi.shape[1]):
                    ya = y + (fa - fi); xa = x + dx
                    if 0 <= ya < ha.shape[0] and 0 <= xa < ha.shape[1]:
                        tot += 1; diff += int((hi[y, x] != ha[ya, xa]).any())
            if best is None or diff < best[0]: best = (diff, tot, dx)
        m['攻撃と待機の頭の相違画素'] = dict(diff=best[0], of=best[1], dx=best[2])
        res[n] = m
    res['errors'] = A.errs + (B.errs if B else [])
    A.close()
    if B: B.close()
json.dump(res, open(os.path.join(OUT, 'metrics.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
