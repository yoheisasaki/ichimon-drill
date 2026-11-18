# 後処理: python rpg/assets/tools/process.py sprite <id> <src.png> <高さpx> [出力名]
#         python rpg/assets/tools/process.py bg <id> <src.png> <幅> <高さ> [出力名]
# sprite: マゼンタ除去(透過)→縁のにじみ除去→余白切り→最近傍法で縮小 → rpg/assets/chars/<名前>.png
# sprite の高さに 0.05 のような小数を渡すと縮小率指定（宝箱の閉/開を同じ縮尺にする用）
# bg    : 中央を目的の縦横比に切り→最近傍法で縮小 → rpg/assets/bg/<名前>.png
# 検品結果(JSON)を rpg/assets/src/<id>/inspect.json に書く。
import sys, os, json
import numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
A = os.path.join(ROOT, 'rpg', 'assets')

STRICT = os.environ.get('STRICT') == '1'   # 紫の服の職(ninja等)用: マゼンタ判定を厳しく(背景の純マゼンタだけ消す)
def magenta_mask(a):
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    if STRICT: return (r > 200) & (b > 200) & (g < 80) & ((r + b) // 2 - g > 150)
    return (r > 140) & (b > 140) & (g < 120) & ((r + b) // 2 - g > 80)

def rel(x): return x.replace(ROOT, '').replace(chr(92), '/').lstrip('/')

def sprite(id_, src, height, name):
    im = Image.open(src).convert('RGBA'); a = np.array(im)
    bgm = magenta_mask(a); n_bg = int(bgm.sum())
    a[bgm, 3] = 0
    # 縁のにじみ: 透明に接する不透明画素でマゼンタ寄り(r,bがgより大きく上回る)なものを消す。数回繰り返す
    removed = 0
    for _ in range(4):
        alpha = a[..., 3] > 0
        pad = np.pad(~alpha, 1, constant_values=True)
        edge = alpha & (pad[:-2, 1:-1] | pad[2:, 1:-1] | pad[1:-1, :-2] | pad[1:-1, 2:])
        r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
        tint = (((r - g) > 110) & ((b - g) > 110) & (np.abs(r - b) < 60) & (b > 150)) if STRICT else (((r - g) > 40) & ((b - g) > 40) & (np.abs(r - b) < 90) & (b > 90))
        kill = edge & tint
        if not kill.any(): break
        removed += int(kill.sum()); a[kill, 3] = 0
    a[a[..., 3] > 0, 3] = 255
    im = Image.fromarray(a); bbox = im.getchannel('A').getbbox(); im = im.crop(bbox)
    w, h = im.size
    if isinstance(height, float): height = max(1, round(h * height))   # 小数なら縮小率(出力px/元px)
    nw = max(1, round(w * height / h))
    if os.environ.get('RESAMPLE') == 'box':   # 細かい飾りの多い絵を小さくするとき(帯用マスター衣装): 面積平均で縮め、透明度だけ2値に戻す
        out = im.resize((nw, height), Image.BOX); oa = np.array(out); oa[..., 3] = np.where(oa[..., 3] > 127, 255, 0); out = Image.fromarray(oa)
    else: out = im.resize((nw, height), Image.NEAREST)
    # 縮小後に残ったマゼンタ寄り画素の数(検品)
    o = np.array(out); op = o[..., 3] > 0
    r, g, b = o[..., 0].astype(int), o[..., 1].astype(int), o[..., 2].astype(int)
    left = int((op & ((r - g) > 60) & ((b - g) > 60)).sum())
    os.makedirs(os.path.join(A, 'chars'), exist_ok=True)
    p = os.path.join(A, 'chars', name + '.png'); out.save(p)
    info = {'src': rel(src), 'src_size': list(Image.open(src).size), 'trim_size': [w, h], 'out': rel(p), 'out_size': [nw, height],
            'magenta_removed_px': n_bg, 'fringe_removed_px': removed, 'magenta_left_px': left, 'opaque_px': int(op.sum()), 'colors': len({tuple(x) for x in o[op].tolist()})}
    return info

def bg(id_, src, W, H, name):
    im = Image.open(src).convert('RGB'); sw, sh = im.size
    tr = W / H
    if sw / sh > tr: nw = round(sh * tr); x0 = (sw - nw) // 2; im = im.crop((x0, 0, x0 + nw, sh))
    else: nh = round(sw / tr); y0 = sh - nh if id_.endswith('strip') else (sh - nh) // 2; im = im.crop((0, y0, sw, y0 + nh))
    out = im.resize((W, H), Image.NEAREST)
    a = np.array(out); mag = int(magenta_mask(np.dstack([a, np.full(a.shape[:2], 255)])).sum())
    os.makedirs(os.path.join(A, 'bg'), exist_ok=True)
    p = os.path.join(A, 'bg', name + '.png'); out.save(p)
    return {'src': rel(src), 'src_size': [sw, sh], 'out': rel(p), 'out_size': [W, H], 'magenta_px': mag, 'colors': len({tuple(x) for x in a.reshape(-1, 3).tolist()})}

k = sys.argv[1]
if k == 'sprite':
    id_, src, h = sys.argv[2], sys.argv[3], (float(sys.argv[4]) if '.' in sys.argv[4] else int(sys.argv[4])); name = sys.argv[5] if len(sys.argv) > 5 else id_
    info = sprite(id_, src, h, name)
else:
    id_, src, W, H = sys.argv[2], sys.argv[3], int(sys.argv[4]), int(sys.argv[5]); name = sys.argv[6] if len(sys.argv) > 6 else id_
    info = bg(id_, src, W, H, name)
d = os.path.join(A, 'src', id_); os.makedirs(d, exist_ok=True)
json.dump(info, open(os.path.join(d, 'inspect.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(info, ensure_ascii=False))
