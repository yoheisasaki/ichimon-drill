# v3b（頭も身体も1枚の絵で一体。分けるのは武器と前の手だけ）。python rpg/tools/parts_body_v3b.py <職> <L|S> [シート画像]
# 同じ1枚の生成シートから、全ポーズを同じ倍率・同じ方法（共通パレットで色を決め、ブロック内の最頻色で縮小）で縮め、輪郭は全部同じ1色に揃える。
# 部品: body_<職>_v3b_<pose>_<size>.png（頭込み・heads なし）・hand_<職>_v3b_<pose>_<size>.png（前の手）。parts.json の body は neck なし・heads なし。
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import *

POSES = {'L': {0: 'idle', 1: 'attack', 2: 'win'}, 'S': {0: 'idle', 1: 'attack', 2: 'win'}}
NCOL = {'L': 3, 'S': 3}
TARGET_H = {'L': 96, 'S': 28}                 # 待機の全高（髪の上〜足裏）。全ポーズ同じ倍率
NCOLORS = {'L': 22, 'S': 16}                  # 全部品共通のパレット色数
OUTLINE = (20, 26, 58)                        # 輪郭はこの1色だけ
GRIP_ANGLE = {'L': {'idle': 45, 'attack': 135, 'win': 45}, 'S': {'idle': 45, 'attack': 135, 'win': 45}}
WEAPON_SCALE = {'L': 1.0, 'S': 0.5}
job, size = sys.argv[1] + '_v3b', sys.argv[2]
sheet = sys.argv[3] if len(sys.argv) > 3 else os.path.join(SRC, f'rpgv3b_{sys.argv[1]}_{size}.png')
a = np.array(Image.open(sheet).convert('RGB')); H, W = a.shape[:2]
mag = magenta_mask(a); fg = ~mag
cells = {}
for m in components(fg, dil=8, minpx=300):
    ys, xs = np.nonzero(m); cells.setdefault(min(NCOL[size] - 1, int(xs.mean() / (W / NCOL[size]))), []).append(m)
raw = {}
for c, pose in POSES[size].items():
    M = np.any(cells[c], axis=0); ys, xs = np.nonzero(M); raw[pose] = dict(M=M, box=(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
s = TARGET_H[size] / (raw['idle']['box'][3] - raw['idle']['box'][1]); print('scale', s)
# 共通パレット（全ポーズの全画素から）。暗い色は全部まとめて輪郭の1色にする
allpx = np.concatenate([a[d['M']] for d in raw.values()]); pal = kmeans_palette(allpx, NCOLORS[size]).astype(int)
luma = pal @ np.array([0.3, 0.59, 0.11]); dark = luma < float(os.environ.get("DARK", 78))
pal[dark] = OUTLINE
pal = np.unique(pal, axis=0).astype(np.uint8); print('palette', len(pal))
def skin_like(rgb):
    h, sa, v = hue_sat_val(tuple(int(x) for x in rgb)); return 8 <= h <= 38 and 0.2 <= sa <= 0.52 and v >= 0.75
skin_pal = np.array([skin_like(c) for c in pal])
info = {}
for pose, d in raw.items():
    x0, y0, x1, y1 = d['box']; sub = a[y0:y1, x0:x1]; bm = d['M'][y0:y1, x0:x1]
    f = sub.reshape(-1, 3).astype(int); idx = ((f[:, None, :] - pal[None].astype(int)) ** 2).sum(2).argmin(1).reshape(sub.shape[:2])
    size_out = (max(1, round((x1 - x0) * s)), max(1, round((y1 - y0) * s)))
    im = mode_resize_idx(idx, bm, pal, size_out, 1.25)
    op = im[..., 3] > 0; h, w = op.shape
    pix = im[..., :3].reshape(-1, 3).astype(int); pidx = ((pix[:, None, :] - pal[None].astype(int)) ** 2).sum(2).argmin(1).reshape(h, w)
    skin = skin_pal[pidx] & op
    lab, n = ndi.label(skin)
    comps = [(np.nonzero(lab == k)[1].mean(), np.nonzero(lab == k)[0].mean(), lab == k) for k in range(1, n + 1) if (lab == k).sum() >= (2 if size == 'S' else 4)]
    face = max(comps, key=lambda c: c[2].sum()) if comps else None
    hands = [c for c in comps if c is not face]
    ys_, xs_ = np.nonzero(op); low = ys_ >= ys_.max() - 1; foot = [round(float(xs_[low].mean()), 1), int(ys_.max())]
    hand = hpos = None
    if hands:
        big = [c for c in hands if c[2].sum() >= (14 if size == 'L' else 2) and (pose == 'win' or c[1] > face[1] - 4)] or hands
        if os.environ.get('DBG'): print(pose, [(round(c[0]), round(c[1]), int(c[2].sum())) for c in comps], 'face', round(face[0]), round(face[1]))
        cand = [c for c in big if c[0] > face[0] + 20] or big
        gx, gy, gm = (min(cand, key=lambda c: c[1]) if pose == 'win' else max(big, key=lambda c: c[0]))
        hm = ndi.binary_dilation(gm, iterations=1) & op; hy, hx = np.nonzero(hm); box = (hx.min(), hy.min(), hx.max() + 1, hy.max() + 1)
        hi = im.copy(); hi[~hm] = 0; hand = f'hand_{job}_{pose}_{size}.png'; Image.fromarray(hi).crop(box).save(os.path.join(PARTS, hand))
        gx, gy = (hx.min() + hx.max()) / 2 + 0.5, (hy.min() + hy.max()) / 2 + 0.5; hpos = [int(box[0]), int(box[1])]
    else: gx, gy = w * 0.8, h * 0.6
    name = f'body_{job}_{pose}_{size}.png'; Image.fromarray(im).save(os.path.join(PARTS, name))
    fy = int(max(np.nonzero(face[2])[0])) if face else None
    key = f'{job}_{pose}_{size}'
    def mut(dj, key=key, w=w, h=h, foot=foot, gx=gx, gy=gy, pose=pose, hand=hand, hpos=hpos, fy=fy):
        dj['body'][key] = {'w': w, 'h': h, 'foot': foot, 'grip': [round(float(gx), 1), round(float(gy), 1)], 'gripAngle': GRIP_ANGLE[size][pose], 'weaponScale': WEAPON_SCALE[size],
                           'hand': hand, 'handPos': hpos, 'weaponLayer': 'back' if size == 'S' else 'front', 'whole': True, 'faceBottom': fy}
    save_parts_json(mut)
    print(name, (w, h), 'colors', len({tuple(c) for c in im[op][:, :3].tolist()}), 'foot', foot, 'grip', (round(float(gx), 1), round(float(gy), 1)), 'hand', hand, 'faceBottom', fy)
