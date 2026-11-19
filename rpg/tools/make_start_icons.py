# はじまりの武器の種別別アイコン（K-02）：杖・短剣・弓の素朴な木製。w_start（木の剣）は既存。出力 assets/icons/w_start_<種別>.png（32px・透過）
# 素朴＝木だけ・飾りなし。購入品（w_<種別>_1…）は葉・布・金属・鍔・弦などで見分ける。
import os, math
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage as ndi
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, '..', 'assets', 'icons')
OL = (14, 10, 56); LI = (252, 204, 121); MI = (219, 151, 70); DK = (153, 90, 40); VD = (110, 62, 34); ST = (186, 160, 120)
def canvas(): return np.zeros((32, 32, 4), np.uint8)
def put(a, mask, col):
    a[mask, :3] = col; a[mask, 3] = 255
def outline(a):
    op = a[..., 3] > 0; ring = ndi.binary_dilation(op, structure=ndi.generate_binary_structure(2, 2)) & ~op
    a[ring] = (*OL, 255); return a
def line_mask(p0, p1, w):
    im = Image.new('L', (32, 32), 0); ImageDraw.Draw(im).line([p0, p1], fill=255, width=w); return np.array(im) > 0
def shade_line(a, p0, p1, w, grip_len, knob=None):
    m = line_mask(p0, p1, w); yy, xx = np.mgrid[:32, :32]
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]; L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
    side = (xx - p0[0]) * nx + (yy - p0[1]) * ny; along = ((xx - p0[0]) * dx + (yy - p0[1]) * dy) / L
    put(a, m & (side <= 0.2), LI); put(a, m & (side > 0.2), MI)
    put(a, m & (along < grip_len), DK)
    put(a, m & (along < grip_len) & (side <= 0.2), MI)
    if knob:
        k = np.zeros((32, 32), bool); yy2, xx2 = np.mgrid[:32, :32]; k = (xx2 - knob[0]) ** 2 + (yy2 - knob[1]) ** 2 <= 2.5; put(a, k, LI); put(a, k & (xx2 + yy2 > knob[0] + knob[1]), MI)
R2 = math.sqrt(0.5)
def rod(a, c0, L, hw_fn, grip_len, light_side=-1):
    """c0 から右上(45度)へ長さ L の棒。hw_fn(s)＝位置 s での半幅。柄(s<grip_len)は暗い木"""
    yy, xx = np.mgrid[:32, :32]; s = ((xx - c0[0]) * R2 - (yy - c0[1]) * R2); q = ((xx - c0[0]) * R2 + (yy - c0[1]) * R2)
    m = (s >= -0.5) & (s <= L) & (np.abs(q) <= np.vectorize(hw_fn)(np.clip(s, 0, L)))
    put(a, m & (q <= 0.3), LI); put(a, m & (q > 0.3), MI)
    g = m & (s < grip_len); put(a, g, DK); put(a, g & (q <= 0.3), MI)
    return m
def staff():
    a = canvas(); rod(a, (6, 27), 28, lambda s: 1.6, 7)
    yy, xx = np.mgrid[:32, :32]; k = (xx - 26) ** 2 + (yy - 7) ** 2 <= 3.2; put(a, k, LI); put(a, k & (xx + yy > 33), MI); return outline(a)
def dagger():
    a = canvas(); rod(a, (7, 26), 24, lambda s: 1.0 if s < 6 else (2.3 if s < 17 else max(0.3, 2.3 - 2.0 * (s - 17) / 5)), 6)
    yy, xx = np.mgrid[:32, :32]; k = (xx - 7) ** 2 + (yy - 26) ** 2 <= 2.2; put(a, k, MI)
    # 柄は細く(半幅1.5)、刃に切り替わる所の半幅で段が付く（鍔は付けない）
    return outline(a)
def bow():
    a = canvas(); P0, C, P1 = (28, 4), (3, 3), (4, 28); m = np.zeros((32, 32), bool)
    for t in np.linspace(0, 1, 120):
        x = (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * C[0] + t * t * P1[0]; y = (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * C[1] + t * t * P1[1]
        m[int(round(y)), int(round(x))] = True
    m = ndi.binary_dilation(m, structure=np.array([[0, 1], [1, 1]], bool))
    yy, xx = np.mgrid[:32, :32]; d = (xx - 28) ** 2 * 0 + 0
    put(a, m, MI); put(a, m & ((xx + yy) <= 22), LI); put(a, m & ((xx + yy) >= 30), DK)
    gm = m & (np.abs((xx + yy) - 19) <= 3) & (np.abs(xx - yy) <= 5) ; put(a, gm, VD)
    sm = line_mask(P0, P1, 1) & ~m; put(a, sm, ST); return outline(a)
if __name__ == '__main__':
    for n, f in (('staff', staff), ('dagger', dagger), ('bow', bow)):
        Image.fromarray(f()).save(os.path.join(OUT, f'w_start_{n}.png'))
    print('ok')
