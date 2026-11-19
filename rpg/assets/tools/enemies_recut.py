# python enemies_recut.py [--apply] : 全シートを「セルで区切らず」連結成分で切り直し、セル境界で欠けていた敵を検出/再生成
import sys, os, subprocess
import numpy as np
from PIL import Image
from scipy import ndimage
T = os.path.dirname(os.path.abspath(__file__)); A = os.path.abspath(os.path.join(T, '..')); sys.path.insert(0, T)
import enemies_sheet as E
apply = '--apply' in sys.argv
for n in range(10):
    items = E.S[n*6:n*6+6]
    a = np.array(Image.open(f'{A}/src/enemy_sheet{n}/sheet.png').convert('RGBA')); H, W = a.shape[:2]
    r, g, b = [a[..., i].astype(int) for i in range(3)]
    mg = (r > 140) & (b > 140) & (g < 140) & ((r + b) // 2 - g > 70); al = ~mg
    sub = ndimage.binary_opening(al, iterations=1)
    dil = ndimage.binary_dilation(sub, iterations=8)
    lab, m = ndimage.label(dil)
    for k, (key, nm, desc, kind) in enumerate(items):
        cx, cy = k % 3, k // 3
        x0, x1, y0, y1 = int(cx*W/3), int((cx+1)*W/3), int(cy*H/2), int((cy+1)*H/2)
        # セル中心を含む成分のうち、セル内の面積が最大のもの
        cl = lab[y0:y1, x0:x1]; ids = [i for i in np.unique(cl) if i]
        best = max(ids, key=lambda i: (sub[y0:y1, x0:x1] & (cl == i)).sum())
        comp = (lab == best) & dil
        ys, xs = np.where(comp & sub)
        # 他セルへのはみ出し量
        out_px = int((comp & sub).sum() - (comp & sub)[y0:y1, x0:x1].sum())
        # 旧(セル内のみ)
        old = (comp & sub)[y0:y1, x0:x1]
        cutw = out_px
        if cutw > 30:
            print(n, key, 'はみ出し/欠け画素', cutw, 'bbox', xs.min(), ys.min(), xs.max(), ys.max(), 'cell', x0, y0, x1, y1)
            if apply:
                # 全体マスク
                tile = a.copy(); msk = comp & ndimage.binary_dilation(sub, iterations=8)
                tile[~msk, 3] = 0; tile[~msk, :3] = (255, 0, 255)
                px0, px1, py0, py1 = max(xs.min()-10, 0), min(xs.max()+11, W), max(ys.min()-10, 0), min(ys.max()+11, H)
                t = tile[py0:py1, px0:px1]
                i = 'enemy_' + key; sp = f'{A}/src/{i}/{i}.png'; Image.fromarray(t).save(sp)
                big, small = (192, 48) if kind == 'b' else (96, 28)
                for name, h in ((i, big), (i + '_strip', small)):
                    subprocess.run([sys.executable, f'{T}/process.py', 'sprite', name, sp, str(h)], capture_output=True, text=True, encoding='utf-8')
