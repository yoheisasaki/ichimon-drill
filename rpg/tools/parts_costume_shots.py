# 確認画像: rpg/shots/parts_pilot/h_costumes.png (L) と h_costumes_S.png (S)。職ごとに 通常/マスター/追加 の待機と勝利(S は待機と攻撃)を並べる
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from parts_compose import *
OUT = os.path.join(R, 'shots', 'parts_pilot')
ALL = ['warrior', 'mage', 'priest', 'thief', 'magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger', 'skyknight', 'starseer']
def tile(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def crop(im): return im.crop(im.getchannel('A').getbbox())
def row(ims, k, gap=8):
    ts = [tile(crop(i), k) if i else None for i in ims]; H = max(t.height for t in ts if t)
    W = sum((t.width if t else 40 * k) for t in ts) + gap * (len(ts) + 1); cv = bg_sheet(W, H + 12); x = gap
    for t in ts:
        if t: cv.alpha_composite(t, (x, cv.height - t.height - 6)); x += t.width + gap
        else: x += 40 * k + gap
    return cv
def make(size, k, poses, name, jobs):
    rows = []
    for j in jobs:
        ims = []
        for p in poses:
            for c in ('', 'master', 'alt1'):
                key = f'{j}{("_" + c) if c else ""}_{p}_{size}'
                ims.append(compose(j, p, size, 'head_f0_h0_L' if size == 'L' else 'head_h0_S', PJ['jobWeapon'][j], costume=c)[0] if key in PJ['body'] else None)
        if any(ims[1::3]) or any(ims[2::3]): rows.append(row(ims, k))
    W = max(r.width for r in rows); half = (len(rows) + 1) // 2
    cols = [rows[:half], rows[half:]]; cvs = []
    for c in cols:
        if not c: continue
        cv = bg_sheet(max(r.width for r in c), sum(r.height for r in c) + 3 * len(c)); y = 0
        for r in c: cv.alpha_composite(r, (0, y)); y += r.height + 3
        cvs.append(cv)
    out = bg_sheet(sum(c.width for c in cvs) + 6 * len(cvs), max(c.height for c in cvs)); x = 0
    for c in cvs: out.alpha_composite(c, (x, 0)); x += c.width + 6
    out.save(os.path.join(OUT, name)); print(name, out.size, len(rows), 'rows')
jobs = sys.argv[1:] or ALL
make('L', 2, ['idle', 'win'], 'h_costumes.png', jobs)
make('S', 5, ['idle', 'attack'], 'h_costumes_S.png', jobs)
