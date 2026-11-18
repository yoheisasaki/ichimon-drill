# python rpg/tools/parts_body.py <職> <L|S> [シート画像]
# ChatGPT で作った「頭と武器なし・頭の位置に緑の円」のポーズシートを切り出し、
#   assets/parts/body_<職>_<pose>_<size>.png ・ hand_<職>_<pose>_<size>.png ・ parts.json の body を作る。
# 手順: マゼンタ除去 → 緑の円（頭の目印）の中心・底から首の基準点 → 円と輪郭を消す → 首〜足元の長さを揃えて縮小
#       → 肌色は基準列(SKIN_RAMP 4色)へ、他は k-means で 19色以内へ（1部品 24色以内）
import sys, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import *

POSES = {'L': {(0, 0): 'idle', (0, 1): 'attack', (0, 2): 'ready', (1, 0): 'hit', (1, 1): 'win'},
         'S': {(0, 0): 'idle', (0, 1): 'attack', (1, 0): 'hit', (1, 1): 'walk'}}
NCOL = {'L': 3, 'S': 2}
NECK_TO_FOOT = {'L': 64, 'S': 16}      # 出力px: 首の基準点〜足元（頭の高さ 約32 / 10 を足して全身 96 / 26）
HEAD_H = {'L': 32, 'S': 10}            # 画像の上に確保する頭の高さ（出力px）
HEAD_HALF_W = {'L': 17, 'S': 6}
DIL = {'L': 9, 'S': 15}                # 円の輪郭を消す幅（元画像px）
# 武器の向き(度, 右=0, 上=90)。アイコンの剣先は45度。45/−45/135 は回転なし・90度回転で済む
GRIP_ANGLE = {'L': {'idle': 45, 'ready': 45, 'attack': 45, 'hit': -45, 'win': -45},
              'S': {'idle': 45, 'attack': 45, 'hit': -45, 'walk': 45}}
WEAPON_SCALE = {'L': 1.0, 'S': 0.5}

job, size = sys.argv[1], sys.argv[2]
sheet = sys.argv[3] if len(sys.argv) > 3 else os.path.join(SRC, f'sheet_body_{job}_{size}.png')
a = np.array(Image.open(sheet).convert('RGB')); H0, W0 = a.shape[:2]
PAD = 80   # 頭の余白が元画像の上端を越えても切り出せるよう、マゼンタで周囲を足す
a = np.pad(a, ((PAD, PAD), (PAD, PAD), (0, 0)), constant_values=0); a[:PAD] = a[-PAD:] = (255, 0, 255); a[:, :PAD] = a[:, -PAD:] = (255, 0, 255); H, W = a.shape[:2]
mag = magenta_mask(a); grn = green_mask(a); fg = ~mag; smsrc = skin_mask_src(a)
cells = {}
for m in components(fg):
    ys, xs = np.nonzero(m); key = (int(ys.mean() - PAD > H0 / 2), min(NCOL[size] - 1, int((xs.mean() - PAD) / (W0 / NCOL[size]))))
    cells.setdefault(key, []).append(m)
raw = {}
for key, pose in POSES[size].items():
    M = np.any(cells[key], axis=0)
    g = M & grn
    lab, n = ndi.label(g); sizes = ndi.sum(g, lab, range(1, n + 1)); gk = 1 + int(np.argmax(sizes)); gm = lab == gk
    ys, xs = np.nonzero(gm); cx = float(xs.mean()); ybot = int(ys.max()); rad = float(np.sqrt(gm.sum() / np.pi))
    rem = ndi.binary_dilation(gm, iterations=DIL[size])
    body = M & ~rem & ~grn
    # 円の輪郭の取り残し（円に接する小さな島）を消す
    lab, n = ndi.label(body)
    if n > 1:
        sz = ndi.sum(body, lab, range(1, n + 1)); keep = 1 + int(np.argmax(sz)); body = lab == keep
    ys, xs = np.nonzero(body)
    raw[pose] = dict(body=body, neck=(cx, ybot + DIL[size]), feet=int(ys.max()), rad=rad, box=(xs.min(), ys.min(), xs.max(), ys.max()))
    print(pose, 'neck', raw[pose]['neck'], 'feet', raw[pose]['feet'], 'marker r', round(rad, 1))
s = NECK_TO_FOOT[size] / (raw['idle']['feet'] - raw['idle']['neck'][1])
print('scale', s)
outs = {}
if size == 'S':
    srcpix = np.concatenate([a[d['body'] & ~smsrc] for d in raw.values()]); srcpal = kmeans_palette(srcpix, 18)
for pose, d in raw.items():
    cx, ny = d['neck']; x0b, y0b, x1b, y1b = d['box']
    x0 = int(min(x0b, cx - HEAD_HALF_W[size] / s)); x1 = int(max(x1b, cx + HEAD_HALF_W[size] / s)) + 1
    y0 = int(min(y0b, ny - HEAD_H[size] / s)); y1 = y1b + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); sub = a[y0:y1, x0:x1]; bm = d['body'][y0:y1, x0:x1]
    rgba[..., :3] = sub; rgba[..., 3] = np.where(bm, 255, 0)
    size_out = (max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s)))
    if size == 'S':
        arr, smk = mode_resize(sub, bm, smsrc[y0:y1, x0:x1], srcpal, size_out)
        outs[pose] = dict(im=arr, neck=((cx - x0) * s, (ny - y0) * s), x0=x0, y1=y1, skin=smk); continue
    im = resize_rgba(Image.fromarray(rgba), size_out)
    smk = (smsrc[y0:y1, x0:x1] & bm).astype(np.uint8) * 255
    smk = np.array(Image.fromarray(smk).resize(size_out, Image.BOX)) > 100
    outs[pose] = dict(im=np.array(im), neck=((cx - x0) * s, (ny - y0) * s), x0=x0, y1=y1, skin=smk & (np.array(im)[..., 3] > 0))
# パレット
allpx = np.concatenate([o['im'][o['im'][..., 3] > 0][:, :3] for o in outs.values()])
skin_sel = np.zeros(1)
nonskin = np.concatenate([o['im'][(o['im'][..., 3] > 0) & ~o['skin']][:, :3] for o in outs.values()])
pal = kmeans_palette(nonskin, 19)
print('palette', len(pal), 'skin-like unique colors', int(skin_sel.sum()))
info = {}
for pose, o in outs.items():
    im = o['im'].copy(); op = im[..., 3] > 0
    px = im[..., :3]
    skin = o['skin']
    q = snap(px, pal); sk = snap(px, np.array(SKIN_RGB, np.uint8))
    px2 = np.where(skin[..., None], sk, q); im[..., :3] = np.where(op[..., None], px2, 0)
    h, w = op.shape
    # 足元: 下端の数行の中心
    ys, xs = np.nonzero(op); low = ys >= ys.max() - 1; foot = [round(float(xs[low].mean()), 1), int(ys.max())]
    # 握り手: 肌色の塊のうち最も右（首は除く）
    lab, n = ndi.label(skin | ndi.binary_dilation(skin, iterations=1) & skin)
    comps = []
    nx, ny = o['neck']
    for k in range(1, n + 1):
        m = lab == k; yy, xx = np.nonzero(m)
        if m.sum() < (2 if size == 'S' else 4): continue
        if abs(xx.mean() - nx) < 6 and abs(yy.mean() - ny) < 7: continue   # 首
        comps.append((xx.mean(), yy.mean(), m))
    gx, gy, gm = max(comps, key=lambda c: c[0]) if comps else (w * 0.8, h * 0.6, np.zeros_like(op))
    if gx < nx + 2:   # 右手が袖と一体で肌色の塊にならなかった（左手を拾った）→ 首の右前を握り位置にし、手の小片は作らない
        gx, gy, gm = nx + (5 if size == 'S' else 18), ny + (8 if size == 'S' else 30), np.zeros_like(op)
    hm = ndi.binary_dilation(gm, iterations=1) & op
    hand = None; hpos = None
    if gm.any():
        hy, hx = np.nonzero(hm); box = (hx.min(), hy.min(), hx.max() + 1, hy.max() + 1)
        hi = im.copy(); hi[~hm] = 0
        hand = f'hand_{job}_{pose}_{size}.png'; Image.fromarray(hi).crop(box).save(os.path.join(PARTS, hand))
        gx, gy = (hx.min() + hx.max()) / 2 + 0.5, (hy.min() + hy.max()) / 2 + 0.5
        hpos = [int(box[0]), int(box[1])]
    name = f'body_{job}_{pose}_{size}.png'
    Image.fromarray(im).save(os.path.join(PARTS, name))
    ncol = len({tuple(c) for c in im[op][:, :3].tolist()})
    skinset = sorted({tuple(c) for c in im[skin][:, :3].tolist()})
    key = f'{job}_{pose}_{size}'
    def mut(dj, key=key, hpos=hpos, w=w, h=h, foot=foot, o=o, gx=gx, gy=gy, pose=pose, hand=hand, name=name, skinset=skinset):
        dj['body'][key] = {'w': w, 'h': h, 'foot': foot, 'neck': [round(o['neck'][0], 1), round(o['neck'][1], 1)], 'grip': [round(gx, 1), round(gy, 1)],
                           'gripAngle': GRIP_ANGLE[size][pose], 'weaponScale': WEAPON_SCALE[size], 'hand': hand, 'handPos': hpos, 'weaponLayer': 'back' if size == 'S' else 'front'}
        dj['palette']['skin'][name] = SKIN_RAMP
    save_parts_json(mut)
    print(name, (w, h), 'colors', ncol, 'foot', foot, 'neck', [round(v, 1) for v in o['neck']], 'grip', (round(gx, 1), round(gy, 1)), 'hand', hand, 'skin', len(skinset))
