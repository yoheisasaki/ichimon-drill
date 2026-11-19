# python rpg/tools/parts_head.py <L|S> [シート画像]
# 顔4×髪型6（L は6行×4列、S は髪型6のみの2行3列）の頭シートを切り出す。髪は緑の見本色で描かれている → HAIR_RAMP（明→暗4色）へ、
# 肌は SKIN_RAMP（4色）へ分位で割り当て、他は k-means の少数色。各頭 24色以内。首の下端が neck（身体の neck に合わせて置く）。
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import *

size = sys.argv[1]
sheet = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SRC, 'rpgv2_heads_L.png')   # S も L の通常顔（1列目）から作る
HEAD_H = {'L': 43, 'S': 12}
HEAD_W = {'L': 40, 'S': 11}
GRID = (6, 3)   # 行=髪型0〜5, 列=通常/攻撃/喜び
EXPR = ['', '_attack', '_win']
DARKW = {'L': 1.3, 'S': 1.0}
a = np.array(Image.open(sheet).convert('RGB')); H, W = a.shape[:2]
rows, cols = GRID
mag = magenta_mask(a); fg = ~mag
skin_src = skin_mask_src(a)
hsv_h = np.zeros(a.shape[:2])
f = a.astype(float) / 255; mx = f.max(2); mn = f.min(2); d = mx - mn
sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
r_, g_, b_ = f[..., 0], f[..., 1], f[..., 2]
hue = np.where(d == 0, 0, np.where(mx == r_, ((g_ - b_) / np.maximum(d, 1e-6)) % 6, np.where(mx == g_, (b_ - r_) / np.maximum(d, 1e-6) + 2, (r_ - g_) / np.maximum(d, 1e-6) + 4))) * 60
hair_src = (hue >= 70) & (hue <= 175) & (sat >= 0.25) & (mx >= 0.12) & fg
luma_src = a.astype(float) @ np.array([0.3, 0.59, 0.11])
cells = {}
for r in range(rows):
    for c in range(cols):
        y0, y1, x0, x1 = int(r * H / rows), int((r + 1) * H / rows), int(c * W / cols), int((c + 1) * W / cols)
        m = np.zeros_like(fg); m[y0:y1, x0:x1] = fg[y0:y1, x0:x1]
        lab, n = ndi.label(ndi.binary_dilation(m, iterations=6)); lab = lab * m
        if n == 0: continue
        sz = ndi.sum(m, lab, range(1, n + 1)); keep = [k + 1 for k, v in enumerate(sz) if v > 0.02 * sz.max()]
        mm = np.isin(lab, keep); ys, xs = np.nonzero(mm)
        cells[(r, c)] = dict(mask=mm, box=(xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
# 縮尺: 既定の頭（髪0・顔0）の高さ（髪の上端〜首の下端）を HEAD_H に
b0 = cells[(0, 0)]['box']; sy = HEAD_H[size] / (b0[3] - b0[1]); sx = HEAD_W[size] / (b0[2] - b0[0]); print('scale', sx, sy, 'default head src', b0[2] - b0[0], b0[3] - b0[1])
# パレット（全頭共通）
allm = np.any([c['mask'] for c in cells.values()], axis=0)
other = allm & ~skin_src & ~hair_src
opal = kmeans_palette(a[other], 14); print('other palette', len(opal))
skin_ref = luma_src[allm & skin_src]; hair_ref = luma_src[allm & hair_src]
PAL = np.concatenate([opal, np.array(SKIN_RGB, np.uint8), np.array(HAIR_RGB, np.uint8)])
nO = len(opal)
idx = np.zeros(a.shape[:2], int)
oi = ((a[other][:, None, :].astype(int) - opal[None].astype(int)) ** 2).sum(2).argmin(1); idx[other] = oi
idx[allm & skin_src] = nO + rank_class(luma_src[allm & skin_src], skin_ref, [0.03, 0.85, 0.10, 0.02])
idx[allm & hair_src] = nO + 4 + rank_class(luma_src[allm & hair_src], hair_ref, [0.12, 0.43, 0.30, 0.15])
# S は顔（目・肌）が髪に埋もれやすいので、目の色・肌のブロックを重く、髪を軽く数える
lum = PAL.astype(int) @ np.array([0.3, 0.59, 0.11])
WCLASS = np.ones(len(PAL))
if size == 'S':
    WCLASS[:nO] = np.where(lum[:nO] >= 70, 2.4, 1.0); WCLASS[nO:nO + 4] = 1.7; WCLASS[nO + 4:] = 0.8
info = {}
for (r, c), cell in sorted(cells.items()):
    if size == 'S' and c != 0: continue
    x0, y0, x1, y1 = cell['box']
    # 首の下端 = 最下行の不透明スパンの中央
    last = cell['mask'][y1 - 1]; xs = np.nonzero(last)[0]; nx = (xs.min() + xs.max() + 1) / 2
    sub_idx = idx[y0:y1, x0:x1]; bm = cell['mask'][y0:y1, x0:x1]
    size_out = (max(1, round((x1 - x0) * sx)), max(1, round((y1 - y0) * sy)))
    im = mode_resize_idx(sub_idx, bm, PAL, size_out, DARKW[size], WCLASS)
    w, h = size_out
    name = f'head_v2_f0_h{r}_L{EXPR[c]}.png' if size == 'L' else f'head_v2_h{r}_S.png'
    Image.fromarray(im).save(os.path.join(PARTS, name))
    used = {tuple(p) for p in im[im[..., 3] > 0][:, :3].tolist()}
    neck = [round((nx - x0) * sx, 1), float(h)]
    info[name] = (w, h, neck, len(used))
    def mut(dj, name=name, w=w, h=h, neck=neck):
        dj['head'][name[:-4]] = {'w': w, 'h': h, 'neck': neck}
        dj['palette']['skin'][name] = SKIN_RAMP; dj['palette']['hair'][name] = HAIR_RAMP
    save_parts_json(mut)
print({k: v for k, v in list(info.items())[:6]}); print('max colors', max(v[3] for v in info.values()), 'files', len(info))
