# L（大表示）用の手持ち武器絵：全武器アイコン(32px)から held_<id>_L.png を一括生成し、parts.json の weapon に held/heldGrip/grip を足す。
# 種別ごとに倍率を変える: 剣・杖=42px(1.3125倍) / 短剣=34px(1.0625倍。大きくしすぎると短い剣に見える) / 弓=42px＋線を右下へ1px太くする。最近傍拡大で形と色は店アイコンと同一。
# 握り位置(grip)は、既に決めてある6本はそのまま、他は「柄尻から軸に沿って種別ごとの距離」で自動算出。S は従来どおりアイコン×0.5（grip を使う）。
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import PARTS, save_parts_json
ICONS = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
CATS = ['sword', 'staff', 'dagger', 'bow']
UNIQ = {'u_tenbinnotsurugi': 'sword', 'u_chionnotsue': 'staff', 'u_tokisunanotanken': 'dagger', 'u_kyoheinoyumi': 'bow'}   # 固有武器（ランク違いはアイコン共用）
IDS = ['w_start'] + [f'{p}{c}_{k}' for p in ('w_', 'rw_') for c in CATS for k in range(1, 7)] + list(UNIQ)
FIXED = {'w_start': (7, 24), 'w_sword_1': (6, 22), 'w_sword_2': (8, 23), 'w_staff_1': (8, 22), 'w_dagger_1': (8, 24), 'w_bow_1': (16, 16)}
OFF = {'sword': 9, 'staff': 10, 'dagger': 8}   # 柄尻(x-y 最小)から軸方向の距離
SIZE = {'sword': 42, 'staff': 42, 'dagger': 34, 'bow': 42}
def cat_of(i): return UNIQ[i] if i in UNIQ else 'sword' if i == 'w_start' else next(c for c in CATS if f'_{c}_' in i)
def grip_of(i, im):
    if i in FIXED: return FIXED[i]
    c = cat_of(i)
    if c == 'bow': return (16, 16)
    a = np.array(im)[..., 3] > 0; ys, xs = np.nonzero(a); u = xs - ys; gu = u.min() + OFF[c]
    sel = np.abs(u - gu) <= 1; v = (xs + ys)[sel].mean()
    return (int(round((gu + v) / 2)), int(round((v - gu) / 2)))
def thicken(arr):
    # 弓の細い線を右・下へ1px太くする（元の不透明画素の色を、空いている右・下の隣へ写す）
    out = arr.copy(); op = arr[..., 3] > 0
    for dy, dx in ((0, 1), (1, 0)):
        sh = np.zeros_like(op); sh[dy:, dx:] = op[:op.shape[0] - dy, :op.shape[1] - dx]
        src = np.zeros_like(arr); src[dy:, dx:] = arr[:arr.shape[0] - dy, :arr.shape[1] - dx]
        m = sh & (out[..., 3] == 0); out[m] = src[m]
    return out
def mut(d):
    for i in IDS:
        im = Image.open(os.path.join(ICONS, i + '.png')).convert('RGBA'); c = cat_of(i); N = SIZE[c]; K = N / 32
        g = grip_of(i, im)
        big = im.resize((N, N), Image.NEAREST)
        if c == 'bow': big = Image.fromarray(thicken(np.array(big)))
        f = f'held_{i}_L.png'; big.save(os.path.join(PARTS, f))
        e = d['weapon'].setdefault(i + '.png', {'itemId': i, 'tipAngle': 45})
        e.setdefault('itemId', i); e.setdefault('tipAngle', 45); e['grip'] = list(g)
        e['held'] = f; e['heldGrip'] = [round(g[0] * K + K / 2 - 0.5), round(g[1] * K + K / 2 - 0.5)]
save_parts_json(mut); print(len(IDS), 'weapons')
