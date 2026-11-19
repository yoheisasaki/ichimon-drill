# 白い服の職（僧侶・賢者・天空騎士）の L ready/guard：白い袖の腕が胴を斜めに横切って縞に見える（外側の輪郭は元々ある）
# → 腕（大きな白の塊）の縁の1ドットを青灰色（RIM）にし、白い胴・裾と別の「筒」に見えるようにする。
# 使い方: python rpg/tools/parts_fix_white_arm.py [--dry]   他の職・他のポーズ・他の部品には触らない。
import os, sys, numpy as np
from PIL import Image
from scipy import ndimage
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PD = os.path.join(ROOT, 'rpg', 'assets', 'parts')
OUTLINE = (20, 26, 58, 255)
RIM = (150, 166, 208, 255)
JOBS = ['priest', 'sage', 'skyknight']
changed = []
for j in JOBS:
    for c in ['', '_master', '_alt1']:
        for p in ['ready', 'guard']:
            f = os.path.join(PD, f'body_{j}{c}_v3b_{p}_L.png')
            if not os.path.exists(f): continue
            a = np.array(Image.open(f).convert('RGBA')).astype(int)
            op = a[..., 3] > 0; mx = a[..., :3].max(2); mn = a[..., :3].min(2)
            wh = op & (mn > 195) & (mx - mn < 45)
            lab, k = ndimage.label(wh, structure=np.ones((3, 3)))
            arm = np.zeros_like(wh)
            for i in range(1, k + 1):
                ys, xs = np.where(lab == i)
                if len(ys) >= 80 and xs.max() - xs.min() >= 12 and ys.min() >= 50: arm |= lab == i
            if not arm.any(): continue
            inner = arm & ~ndimage.binary_erosion(arm, structure=ndimage.generate_binary_structure(2, 1), border_value=1)
            tgt = inner
            if '--dry' not in sys.argv:
                a[tgt] = RIM; Image.fromarray(a.astype(np.uint8), 'RGBA').save(f)
            changed.append((os.path.basename(f), int(arm.sum()), int(tgt.sum())))
for r in changed: print(r)
