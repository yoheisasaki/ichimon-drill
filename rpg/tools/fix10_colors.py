# 大表示(L)の胴の主色2色と、帯(S)の胴の主色2色を全30衣装で照合。python rpg/tools/fix10_colors.py [--md]
import os, sys, colorsys
import numpy as np
from PIL import Image
from collections import Counter
P = os.path.join(os.path.dirname(__file__), '..', 'assets', 'parts')
B = ['warrior', 'mage', 'priest', 'thief', 'magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger', 'skyknight', 'starseer']
ALL = B + [b + '_master' for b in B] + [b + '_alt1' for b in ['magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger']]
def load(n): return np.array(Image.open(os.path.join(P, n)).convert('RGBA'))
def skin(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); return 0.02 <= h <= 0.12 and 0.15 <= s <= 0.6 and v > 0.8
def hair(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); return 0.02 <= h <= 0.1 and 0.4 <= s <= 0.8 and 0.3 <= v <= 0.8
def top(sub, n=2):
    c = Counter()
    for p in sub.reshape(-1, 4):
        if p[3] == 0: continue
        r, g, b = (int(v) for v in p[:3])
        if max(r, g, b) < 45 and False: continue
        if skin(r, g, b) or (colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[2] < 0.3 and max(r, g, b) < 75 and abs(r - 20) < 12): continue
        c[(r // 32, g // 32, b // 32)] += 1
    tot = sum(c.values()) or 1
    return [((k[0] * 32 + 16, k[1] * 32 + 16, k[2] * 32 + 16), round(v / tot, 2)) for k, v in c.most_common(n)]
def Lc(j):
    a = load(f'body_{j}_v3b_idle_L.png'); h = a.shape[0]; w = a.shape[1]
    return top(a[int(h * 0.5):int(h * 0.82), int(w * 0.25):int(w * 0.75)])
def Sc(j):
    a = load(f'body_{j}_v3b_idle_S.png'); h = a.shape[0]; w = a.shape[1]
    return top(a[int(h * 0.42):int(h * 0.82), int(w * 0.2):int(w * 0.8)])
def dist(a, b): return float(np.sqrt(sum((x - y) ** 2 for x, y in zip(a, b))))
def hx(c): return '#%02x%02x%02x' % tuple(c)
if __name__ == '__main__':
    rows = ['|衣装|大表示の主色（多い順）|帯の胴の主色（多い順）|最小色距離|判定|', '|---|---|---|---|---|']
    for j in ALL:
        l, s = Lc(j), Sc(j)
        d = min(dist(l[0][0], x[0]) for x in s) if True else 0
        d2 = min(dist(a[0], b[0]) for a in l for b in s)
        rows.append(f"|{j}|{' '.join(hx(c) for c, f in l)}|{' '.join(hx(c) for c, f in s)}|{d2:.0f}|{'一致' if d2 <= 64 else '要確認'}|")
    t = chr(10).join(rows); print(t)
    open(os.path.join(os.path.dirname(__file__), '..', 'shots', 'fix10_band', 'color_match.md'), 'w', encoding='utf-8').write(t + chr(10))
