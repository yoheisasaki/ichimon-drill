# 主人公の部品（身体・頭）の共通処理。仕様は rpg/assets/HERO_PARTS_SPEC.md
import os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import colorsys

R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PARTS = os.path.join(R, 'assets', 'parts')
SRC = os.path.join(R, 'assets', 'src', 'parts')
os.makedirs(PARTS, exist_ok=True); os.makedirs(SRC, exist_ok=True)

def hexc(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5))
# 肌・髪の基準列（明→暗）。実行時はこの色だけを rpg-meta.js の SKIN/HAIR_COLOR から作った列に完全一致で置き換える
SKIN_RAMP = ['#f8dcc0', '#f0c39a', '#d9a77a', '#b97d56']
HAIR_RAMP = ['#b8804a', '#7a4a2a', '#56321e', '#37200f']
SKIN_RGB = [hexc(c) for c in SKIN_RAMP]; HAIR_RGB = [hexc(c) for c in HAIR_RAMP]

def magenta_mask(a):
    r, g, b = [a[..., i].astype(int) for i in range(3)]
    return (r > 140) & (b > 140) & (g < 120) & ((r + b) // 2 - g > 80)

def green_mask(a):
    r, g, b = [a[..., i].astype(int) for i in range(3)]
    return (g > 160) & (r < 140) & (b < 140) & (g - np.maximum(r, b) > 60)

def hue_sat_val(rgb):
    h, s, v = colorsys.rgb_to_hsv(*[c / 255 for c in rgb]); return h * 360, s, v

def dist(a, b): return float(np.sqrt(sum((int(x) - int(y)) ** 2 for x, y in zip(a, b))))

def is_skin(rgb, tol=26):
    h, s, v = hue_sat_val(rgb)
    return min(dist(rgb, c) for c in SKIN_RGB) <= tol and h <= 36 and s >= 0.2

def is_hair_placeholder(rgb):
    # 髪は緑系の見本色で描かせる（肌・輪郭と混ざらない）
    h, s, v = hue_sat_val(rgb)
    return 70 <= h <= 175 and s >= 0.25 and v >= 0.12

def skin_mask_src(a):
    """元シート上の肌色（赤〜橙の彩度が高い桃色。ベージュのズボン・クリームの襟巻きは彩度が低くて外れる）"""
    f = a.astype(float) / 255; mx = f.max(2); mn = f.min(2); d = mx - mn
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    h = np.where(d == 0, 0, np.where(mx == r, ((g - b) / np.maximum(d, 1e-6)) % 6, np.where(mx == g, (b - r) / np.maximum(d, 1e-6) + 2, (r - g) / np.maximum(d, 1e-6) + 4))) * 60
    return (h >= 15) & (h <= 38) & (s >= 0.38) & (s <= 0.66) & (mx >= 0.70) & (r > 0.8)

def components(fg, dil=10, minpx=400):
    lab, n = ndi.label(ndi.binary_dilation(fg, iterations=dil)); lab = lab * fg
    out = []
    for k in range(1, n + 1):
        m = lab == k
        if m.sum() >= minpx: out.append(m)
    return out

def resize_rgba(img, size):
    out = img.resize(size, Image.BOX)
    a = np.array(out); a[..., 3] = np.where(a[..., 3] > 127, 255, 0)
    a[a[..., 3] == 0, :3] = 0
    return Image.fromarray(a)

def kmeans_palette(px, k, iters=12, seed=1):
    """px: Nx3。固定シードの k-means（輪郭の濃紺など少数色も残すため、初期値は頻度順に離れた色から取る）"""
    px = px.astype(float)
    uniq, cnt = np.unique(px.astype(np.uint8), axis=0, return_counts=True)
    order = np.argsort(-cnt); cents = [uniq[order[0]].astype(float)]
    while len(cents) < min(k, len(uniq)):
        d = np.min([((uniq - c) ** 2).sum(1) for c in cents], axis=0) * (cnt ** 0.5)
        cents.append(uniq[int(np.argmax(d))].astype(float))
    cents = np.array(cents)
    u = uniq.astype(float)
    for _ in range(iters):
        d = ((u[:, None, :] - cents[None]) ** 2).sum(2); lab = d.argmin(1)
        for i in range(len(cents)):
            m = lab == i
            if m.any(): cents[i] = (u[m] * cnt[m, None]).sum(0) / cnt[m].sum()
    return np.round(cents).astype(np.uint8)

def snap(a, pal):
    """a: HxWx3 → 最も近いパレット色へ"""
    h, w = a.shape[:2]; f = a.reshape(-1, 3).astype(int)
    d = ((f[:, None, :] - pal[None].astype(int)) ** 2).sum(2)
    return pal[d.argmin(1)].reshape(h, w, 3)

def load_json(p, default):
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else default

def save_parts_json(mut):
    p = os.path.join(PARTS, 'parts.json')
    d = load_json(p, {'version': 1, 'body': {}, 'head': {}, 'weapon': {}, 'palette': {'skin': {}, 'hair': {}}})
    mut(d); json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def mode_resize(sub, bm, sk, pal, size_out, dark_w=1.0):
    """S用: 元画像(ブロック状のドット絵)を、出力画素ごとに「ブロック内で最も多い色」で縮める（平均しないので色が濁らない）。
    輪郭の濃い色は重みを掛けて細い線が消えないようにする。返り値 (rgba, skinmask)"""
    H, W = bm.shape; ow, oh = size_out; sx, sy = W / ow, H / oh
    f = sub.reshape(-1, 3).astype(int); d = ((f[:, None, :] - pal[None].astype(int)) ** 2).sum(2); idx = d.argmin(1).reshape(H, W)
    luma = pal.astype(int) @ np.array([0.3, 0.59, 0.11]); w_c = np.where(luma < 70, dark_w, 1.0)
    out = np.zeros((oh, ow, 4), np.uint8); skm = np.zeros((oh, ow), bool)
    for i in range(oh):
        for j in range(ow):
            y0, y1 = int(round(i * sy)), max(int(round((i + 1) * sy)), int(round(i * sy)) + 1)
            x0, x1 = int(round(j * sx)), max(int(round((j + 1) * sx)), int(round(j * sx)) + 1)
            b = bm[y0:y1, x0:x1]
            if b.mean() < 0.5: continue
            ii = idx[y0:y1, x0:x1][b]; cnt = np.bincount(ii, minlength=len(pal)) * w_c
            out[i, j, :3] = pal[int(cnt.argmax())]; out[i, j, 3] = 255
            skm[i, j] = sk[y0:y1, x0:x1][b].mean() > 0.4
    return out, skm


def rank_class(luma, ref_luma, fracs):
    """luma を ref_luma（同じ種類の全画素の明るさ）の分位で len(fracs) 段階に分ける。0=最も明るい。fracs は明→暗の割合"""
    cuts = np.cumsum(fracs)[:-1]; ths = np.quantile(ref_luma, 1 - cuts)   # 明るい側から
    return np.sum(luma[..., None] < ths[None], axis=-1)

def mode_resize_idx(idx, bm, pal, size_out, dark_w=1.0, w_class=None):
    """idx: クラス番号の画像（HxW）。bm: 不透明マスク。ブロック内で最も多いクラスを採用（暗い色は dark_w 倍）"""
    H, W = bm.shape; ow, oh = size_out; sx, sy = W / ow, H / oh
    luma = pal.astype(int) @ np.array([0.3, 0.59, 0.11]); w_c = np.where(luma < 70, dark_w, 1.0)
    if w_class is not None: w_c = w_c * np.asarray(w_class, float)
    out = np.zeros((oh, ow, 4), np.uint8)
    for i in range(oh):
        for j in range(ow):
            y0, y1 = int(round(i * sy)), max(int(round((i + 1) * sy)), int(round(i * sy)) + 1)
            x0, x1 = int(round(j * sx)), max(int(round((j + 1) * sx)), int(round(j * sx)) + 1)
            b = bm[y0:y1, x0:x1]
            if b.mean() < 0.5: continue
            cnt = np.bincount(idx[y0:y1, x0:x1][b], minlength=len(pal)) * w_c
            out[i, j, :3] = pal[int(cnt.argmax())]; out[i, j, 3] = 255
    return out
