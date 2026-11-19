# 点検用: 衣装ごとに L 全ポーズ(上段)と S 全ポーズ(下段)を並べる。python tools/parts_costume_poses.py <出力名> <職:衣装> ...
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from parts_compose import *
OUT = os.path.join(R, 'shots', 'parts_pilot')
LP = ['idle', 'ready', 'attack', 'hit', 'win']; SP = ['idle', 'attack', 'hit', 'walk']
def crop(im): return im.crop(im.getchannel('A').getbbox())
def strip(ims, k, gap=8):
    ts = [crop(i).resize((crop(i).width * k, crop(i).height * k), Image.NEAREST) for i in ims]
    cv = bg_sheet(sum(t.width for t in ts) + gap * (len(ts) + 1), max(t.height for t in ts) + 8); x = gap
    for t in ts: cv.alpha_composite(t, (x, cv.height - t.height - 4)); x += t.width + gap
    return cv
name, specs = sys.argv[1], sys.argv[2:]; rows = []
for s in specs:
    j, c = s.split(':')
    rows.append(strip([compose(j, p, 'L', 'head_f0_h0_L', PJ['jobWeapon'][j], costume=c)[0] for p in LP], 2))
    rows.append(strip([compose(j, p, 'S', 'head_h0_S', PJ['jobWeapon'][j], costume=c)[0] for p in SP], 6))
W = max(r.width for r in rows); H = sum(r.height for r in rows) + 2 * len(rows)
cv = bg_sheet(W, H); y = 0
for r in rows: cv.alpha_composite(r, (0, y)); y += r.height + 2
cv.save(os.path.join(OUT, name)); print(cv.size)
