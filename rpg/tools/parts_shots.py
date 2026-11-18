# 確認画像: rpg/shots/parts_pilot/ に (a)〜(e) を作る。parts.json と部品PNGだけで合成（JS は使わない）
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from parts_compose import *
OUT = os.path.join(R, 'shots', 'parts_pilot'); os.makedirs(OUT, exist_ok=True)
JOBS = ['warrior', 'magicknight']; LP = ['idle', 'ready', 'attack', 'hit', 'win']; SP = ['idle', 'attack', 'hit', 'walk']
BRONZE, SPARK = 'w_sword_1.png', 'rw_sword_1.png'
def tile(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def row(images, k, gap=6, h=None):
    ts = [tile(i, k) for i in images]; H = h or max(t.height for t in ts)
    W = sum(t.width for t in ts) + gap * (len(ts) + 1); cv = bg_sheet(W, H + 12); x = gap
    for t in ts: cv.alpha_composite(t, (x, cv.height - t.height - 6)); x += t.width + gap
    return cv
def stack(rows, gap=4):
    W = max(r.width for r in rows); H = sum(r.height for r in rows) + gap * (len(rows) - 1)
    cv = bg_sheet(W, H); y = 0
    for r in rows: cv.alpha_composite(r, (0, y)); y += r.height + gap
    return cv
def crop(im):
    bb = im.getchannel('A').getbbox(); return im.crop(bb)
# (a) 2職×全ポーズ（既定の顔髪・青銅の剣）。L は4倍、S は8倍
rows = []
for j in JOBS:
    rows.append(row([compose(j, p, 'L', 'head_f0_h0_L', BRONZE)[0] for p in LP], 3))
    rows.append(row([compose(j, p, 'S', 'head_h0_S', BRONZE)[0] for p in SP], 8))
stack(rows).save(os.path.join(OUT, 'a_all_poses.png'))
# (b) 同じ待機で 青銅→火花
rows = [row([compose(j, 'idle', 'L', 'head_f0_h0_L', w)[0] for w in (BRONZE, SPARK)] + [compose(j, 'attack', 'L', 'head_f0_h0_L', w)[0] for w in (BRONZE, SPARK)], 4) for j in JOBS]
stack(rows).save(os.path.join(OUT, 'b_weapon_swap.png'))
# (c) 顔4×髪6（頭だけ。行=髪型、列=顔）
rows = [row([part(f'head_f{f}_h{h}_L.png', skin=0, hair=0) for f in range(4)], 5) for h in range(6)]
stack(rows, 2).save(os.path.join(OUT, 'c_faces_hairs.png'))
# (c2) 顔4種の全身（待機・戦士）
row([compose('warrior', 'idle', 'L', f'head_f{f}_h{f}_L', BRONZE)[0] for f in range(4)], 4).save(os.path.join(OUT, 'c2_faces_on_body.png'))
# (d) 肌5色×髪色6色（行=肌、列=髪色。戦士・待機）
rows = [row([compose('warrior', 'idle', 'L', 'head_f0_h0_L', BRONZE, skin=s, hair=h)[0] for h in range(6)], 2) for s in range(5)]
stack(rows, 2).save(os.path.join(OUT, 'd_skin_hair.png'))
rows = [row([compose('warrior', 'idle', 'L', f'head_f{h % 4}_h{h}_L', BRONZE, skin=s, hair=h)[0] for h in range(6)], 2) for s in range(5)]
# (e) S の帯サイズ: 実寸(1倍)と4倍
items = [compose(j, p, 'S', f'head_h{i}_S', BRONZE if i % 2 == 0 else SPARK)[0] for j in JOBS for i, p in enumerate(SP)]
a1 = row(items, 1, gap=8); a4 = row(items, 4, gap=8)
stack([row(items, 1, gap=8), row(items, 4, gap=8)]).save(os.path.join(OUT, 'e_strip_size.png'))
print('done', os.listdir(OUT))
