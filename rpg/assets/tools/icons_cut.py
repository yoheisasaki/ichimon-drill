# アイコンシート切り分け: python rpg/assets/tools/icons_cut.py <sheet.png> <列数> <行数> <id1,id2,...> [size=32] [mode=box|nearest]
# マゼンタを透過→連結成分で各アイコンを取る→行・列の順に並べる→size四方(余白2)に収め→ rpg/assets/icons/<id>.png
import sys, os, numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
src, cols, rows, ids = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4].split(',')
size = int(sys.argv[5]) if len(sys.argv) > 5 else 32
mode = sys.argv[6] if len(sys.argv) > 6 else 'box'
im = Image.open(src).convert('RGBA'); a = np.array(im)
r, g, b = [a[..., i].astype(int) for i in range(3)]
mg = (r > 140) & (b > 140) & (g < 140) & ((r + b) // 2 - g > 70)
a[mg, 3] = 0
alpha = a[..., 3] > 0
H, W = alpha.shape
cw, ch = W / cols, H / rows
out = os.path.join(ROOT, 'rpg', 'assets', 'icons'); os.makedirs(out, exist_ok=True)
rep = []
for k, id_ in enumerate(ids):
    cx, cy = k % cols, k // cols
    x0, x1, y0, y1 = int(cx * cw), int((cx + 1) * cw), int(cy * ch), int((cy + 1) * ch)
    sub = alpha[y0:y1, x0:x1]
    sub = ndimage.binary_opening(sub, iterations=1)
    lab, n = ndimage.label(ndimage.binary_dilation(sub, iterations=6))
    if n == 0: rep.append((id_, 'EMPTY')); continue
    sizes = ndimage.sum(sub, lab, range(1, n + 1)); keep = int(np.argmax(sizes)) + 1
    m = (lab == keep) & ndimage.binary_dilation(sub, iterations=6)
    ys, xs = np.where(m); bb = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    tile = a[y0:y1, x0:x1].copy(); tile[~m, 3] = 0
    t = Image.fromarray(tile).crop(bb)
    w, h = t.size; inner = size - 4; sc = inner / max(w, h)
    nw, nh = max(1, round(w * sc)), max(1, round(h * sc))
    if mode == 'box':
        # 不透明部だけで平均(縁のマゼンタ混入を避ける)。透明は alpha>0.5 で2値化
        arr = np.array(t).astype(float); al = arr[..., 3:4] / 255
        pm = Image.fromarray((arr[..., :3] * al).astype(np.uint8)).resize((nw, nh), Image.BOX)
        am = Image.fromarray((al[..., 0] * 255).astype(np.uint8)).resize((nw, nh), Image.BOX)
        pa, aa = np.array(pm).astype(float), np.array(am).astype(float) / 255
        col = np.where(aa[..., None] > 0, pa / np.maximum(aa[..., None], 1e-3), 0).clip(0, 255).astype(np.uint8)
        o = np.dstack([col, np.where(aa > 0.5, 255, 0).astype(np.uint8)]); t2 = Image.fromarray(o)
    else:
        t2 = t.resize((nw, nh), Image.NEAREST)
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0)); canvas.paste(t2, ((size - nw) // 2, (size - nh) // 2), t2)
    canvas.save(os.path.join(out, id_ + '.png'))
    o = np.array(canvas); op = o[..., 3] > 0
    left = int((op & ((o[..., 0].astype(int) - o[..., 1]) > 60) & ((o[..., 2].astype(int) - o[..., 1]) > 60)).sum())
    rep.append((id_, (nw, nh), 'opaque', int(op.sum()), 'magenta_left', left, 'colors', len({tuple(x) for x in o[op].tolist()})))
for x in rep: print(x)
