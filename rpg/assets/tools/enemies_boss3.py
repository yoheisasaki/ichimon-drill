# 第1章ボス3体(砂時計の巨人・黒鎧の騎士・天蓋の機神)専用。python enemies_boss3.py [シート画像]  元: enemies_take.py
#    Downloadsの最新画像→シート保存→6体切り分け→96/192px(通常/ボス)と帯用(28/48px)へ
import sys, os, glob, shutil, subprocess, time
import numpy as np
from PIL import Image
from scipy import ndimage
T = os.path.dirname(os.path.abspath(__file__)); A = os.path.abspath(os.path.join(T, '..')); sys.path.insert(0, T)
import enemies_data as ED
D = {}
for _n in dir(ED):
    if _n.startswith('E') and isinstance(getattr(ED, _n), dict): D.update(getattr(ED, _n))
items = [(k,) + D[k] for k in ('b_hourglass', 'b_blackknight', 'b_machinegod')]
n = 'boss3'
if len(sys.argv) > 1: f = sys.argv[1]
else:
    c = [p for p in glob.glob('C:/Users/user/Downloads/*') if p.lower().endswith(('.png', '.webp', '.jpg')) and time.time() - os.path.getmtime(p) < 600]
    f = max(c, key=os.path.getmtime)
d = f'{A}/src/enemy_sheet{n}'; os.makedirs(d, exist_ok=True)
sh = f'{d}/sheet.png'
if os.path.abspath(f) != os.path.abspath(sh): shutil.move(f, sh)
a = np.array(Image.open(sh).convert('RGBA')); H, W = a.shape[:2]
r, g, b = [a[..., i].astype(int) for i in range(3)]
mg = (r > 140) & (b > 140) & (g < 140) & ((r + b) // 2 - g > 70)
al = ~mg
for k, (key, nm, desc, kind) in enumerate(items):
    cx, cy = k % 3, k // 3
    rows = 1
    x0, x1, y0, y1 = int(cx*W/3), int((cx+1)*W/3), int(cy*H/rows), int((cy+1)*H/rows)
    sub = ndimage.binary_opening(al[y0:y1, x0:x1], iterations=1)
    lab, m = ndimage.label(ndimage.binary_dilation(sub, iterations=8))
    if m == 0: print(key, 'EMPTY'); continue
    sz = ndimage.sum(sub, lab, range(1, m+1)); keep = lab == int(np.argmax(sz)) + 1
    msk = keep & ndimage.binary_dilation(sub, iterations=8)
    tile = a[y0:y1, x0:x1].copy(); tile[~msk, 3] = 0; tile[~msk, :3] = (255, 0, 255)
    ys, xs = np.where(msk)
    touch = xs.min() <= 1 or ys.min() <= 1 or xs.max() >= x1-x0-2 or ys.max() >= y1-y0-2
    i = 'enemy_' + key; os.makedirs(f'{A}/src/{i}', exist_ok=True); sp = f'{A}/src/{i}/{i}.png'
    Image.fromarray(tile).save(sp)
    big, small = (192, 48) if kind == 'b' else (96, 28)
    for name, h in ((i, big), (i + '_strip', small)):
        out = subprocess.run([sys.executable, f'{T}/process.py', 'sprite', name, sp, str(h)], capture_output=True, text=True, encoding='utf-8').stdout.strip()
        if name == i: print(key, nm, 'EDGE-TOUCH' if touch else '', out[-160:])
