# 全12職の v3b（待機・L）の頭身を実測（髪の上端〜あご／髪の上端〜足裏。武器・手部品は含まない身体の一体絵）。python rpg/tools/fix09_ratio.py
# 出力: rpg/shots/fix09_fit/ratios_v3b.json。あごの位置は最大の肌色の連なりの下端（fix08_v3.py の analyze を流用）
import os, json, numpy as np
from PIL import Image
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
P = os.path.join(ROOT, 'rpg', 'assets', 'parts')
import colorsys
from scipy import ndimage as ndi
def hsv(c): return colorsys.rgb_to_hsv(*[x / 255 for x in c[:3]])
def skinlike(a):
    f = a[..., :3].astype(float) / 255; mx = f.max(2); mn = f.min(2); d = mx - mn; sat = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]; h = np.where(d == 0, 0, np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6, 60)) * 60
    return (a[..., 3] > 0) & (h >= 8) & (h <= 36) & (sat >= 0.22) & (sat <= 0.7) & (mx >= 0.6) & (r > g) & (g > b)
def analyze(img):
    op = img[..., 3] > 0; sk = skinlike(img); lab, n = ndi.label(sk)
    sizes = ndi.sum(sk, lab, range(1, n + 1)); face = lab == (1 + int(np.argmax(sizes)))
    ys, xs = np.nonzero(op); top = ys.min(); fy = int(np.nonzero(face)[0].max())
    rgb = img[..., :3].astype(int); luma = rgb @ np.array([0.3, 0.59, 0.11]); dark = op & (luma < 85)
    def band(y0, y1):
        rows = range(y0, y1 + 1); cols = set(); skins = set(); runs = []
        for y in rows:
            for x in np.nonzero(dark[y])[0]: cols.add(tuple(rgb[y, x]))
            for x in np.nonzero(sk[y])[0]: skins.add(tuple(rgb[y, x]))
            x = 0; row = dark[y]; W_ = len(row)
            while x < W_:   # 輪郭の太さ＝横方向に連続した暗い画素の長さ（帯の全行の中央値）
                if row[x]:
                    k = 0
                    while x < W_ and row[x]: k += 1; x += 1
                    runs.append(k)
                else: x += 1
        return cols, skins, float(np.median(runs)) if runs else 0.0
    ua = band(fy - 5, fy); ub = band(fy + 1, fy + 6)
    hw = int(np.ptp(np.nonzero(op[top:fy - 5].any(0))[0]) + 1)
    f = img[..., :3].astype(int); blue = op & (f[..., 2] > f[..., 0] + 40) & (f[..., 2] > f[..., 1] + 5) & (f[..., :3].sum(2) > 250); tw = 0
    for y in range(fy + 3, min(img.shape[0], fy + 22)):
        xs_ = np.nonzero(blue[y])[0]
        if len(xs_): tw = max(tw, int(xs_.max() - xs_.min() + 1))
    cape = (f[..., 0] > 200) & (f[..., 1] > 170) & (f[..., 2] > 120) & (f[..., 2] < 225); keep = op & ~cape; wmax = 0
    for y in range(fy, img.shape[0]):
        xs_ = np.nonzero(keep[y])[0]
        if len(xs_): wmax = max(wmax, int(xs_.max() - xs_.min() + 1))
    return dict(top=int(top), chin=fy, head_h=int(fy - top + 1), head_w=hw, total_h=int(ys.max() - top + 1), torso_w=tw, maxw_nocape=wmax, maxw_all=int(np.ptp(np.nonzero(op.any(0))[0]) + 1),
                neck=dict(outline_colors_above=len(ua[0]), outline_colors_below=len(ub[0]), outline_same_color=ua[0] == ub[0] and len(ua[0]) == 1, outline_thick_above=round(ua[2], 2), outline_thick_below=round(ub[2], 2),
                          skin_values_above=len(ua[1]), skin_values_below=len(ub[1]), skin_values_shared=len(ua[1] & ub[1]), skin_values_all_shared=ua[1] <= ub[1] or ub[1] <= ua[1]))

JOBS = ['warrior','mage','priest','thief','magicknight','paladin','shadow','sage','ninja','ranger','skyknight','starseer']
res = {}
for j in JOBS:
    for tag, name in (('通常', f'body_{j}_v3b_idle_L.png'), ('マスター', f'body_{j}_master_v3b_idle_L.png')):
        f = os.path.join(P, name)
        if not os.path.exists(f): continue
        im = np.array(Image.open(f).convert('RGBA')); A = analyze(im)
        # 検算：肌色の画素のうち、髪の上端から52px（全高の約54%）より上の最下端をあごとする（ハチマキで顔が2つに分かれる職でも取りこぼさない）。主方法との差は res の「検算頭身」に残す
        sk = skinlike(im); top = np.nonzero(im[..., 3] > 0)[0].min(); chk_h = int(np.nonzero(sk[:top + 52])[0].max() - top + 1)
        if A['head_h'] < 40: A['head_h'] = chk_h   # 主方法の取りこぼし（顔が分断された場合）だけ検算値に置き換える
        res[f'{j}:{tag}'] = {'全高': A['total_h'], '頭部高': A['head_h'], '頭身': round(A['total_h'] / A['head_h'], 2), '検算頭身': round(A['total_h'] / chk_h, 2)}
        print(j, tag, res[f'{j}:{tag}'])
v = [x['頭身'] for x in res.values()]
res['_summary'] = {'min': min(v), 'max': max(v), 'n': len(v)}
os.makedirs(os.path.join(ROOT, 'rpg', 'shots', 'fix09_fit'), exist_ok=True)
json.dump(res, open(os.path.join(ROOT, 'rpg', 'shots', 'fix09_fit', 'ratios_v3b.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(res['_summary'])
