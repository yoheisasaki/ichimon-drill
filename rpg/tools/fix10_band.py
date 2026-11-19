# 冒険帯Sの確認画像（追加修正指示書10）。python rpg/tools/fix10_band.py [名前,...] ／ 出力 rpg/shots/fix10_band/
# 実物の rpg-sprites.js を headless Chromium で動かす（fix08_v3b2.py の描画部を流用）。実寸(1倍)を主、4倍は補助。
import os, sys, json
here = os.path.dirname(os.path.abspath(__file__))
sel = sys.argv[1].split(',') if len(sys.argv) > 1 else None
sys.argv = [sys.argv[0]]
src = open(os.path.join(here, 'fix08_v3b2.py'), encoding='utf-8').read().split('def sword_on_legs')[0]
g = {'__file__': os.path.join(here, 'fix08_v3b2.py'), '__name__': 'viewer'}
exec(compile(src, 'fix08_v3b2_head', 'exec'), g)
R_, serve, pw_ = g['R_'], g['serve'], g['sync_playwright']
labeled, hstack, vstack, up, ROOT = g['labeled'], g['hstack'], g['vstack'], g['up'], g['ROOT']
from PIL import Image
OUTD = os.path.join(ROOT, 'rpg', 'shots', 'fix10_band'); os.makedirs(OUTD, exist_ok=True)
B = ['warrior', 'mage', 'priest', 'thief', 'magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger', 'skyknight', 'starseer']
ALL = B + [b + '_master' for b in B] + [b + '_alt1' for b in ['magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger']]
JOBS = [j for j in ALL if sel is None or j in sel]
WEAPON = {'warrior': 'w_sword_1', 'magicknight': 'w_sword_1', 'paladin': 'w_sword_1', 'skyknight': 'w_sword_1', 'mage': 'w_staff_1', 'priest': 'w_staff_1', 'sage': 'w_staff_1', 'starseer': 'w_staff_1', 'thief': 'w_dagger_1', 'shadow': 'w_dagger_1', 'ninja': 'w_dagger_1', 'ranger': 'w_bow_1'}
POSES = ['idle', 'walk', 'walk2', 'windup', 'attack', 'guard', 'win', 'hit']
def hero_o(j, pose, use, w, extra=None):
    b, _, c = j.partition('_'); o = {'job': b, 'pose': pose, 'use': use, 'weaponId': w}
    if c: o['costume'] = c
    if extra: o.update(extra)
    return o
def Lr(A, j, pose, w): return A.R({'w': 150, 'h': 130, 'bg': 'none', 'items': [{'kind': 'hero', 'x': 70, 'y': 122, 'o': hero_o(j, pose, 'home', w)}]})
def Sr(A, j, pose, w, enemy=False, bg='strip'):
    items = ([{'kind': 'enemy', 'id': 'e_acornsoldier', 'x': 90, 'y': 21, 'scale': 1}] if enemy else []) + [{'kind': 'hero', 'x': 60, 'y': 21, 'o': hero_o(j, pose, 'strip', w, {'outline': '#141a3c'})}]
    return A.R({'w': 390, 'h': 44, 'strip': True, 'bg': 'none', 'items': items}).crop((40, 0, 220, 44))
def person(im): return im.crop((58, 0, 102, 44))   # 人物まわり（帯は高さ44・実寸）
with pw_() as pw:
    s = serve(ROOT, 18479); A = R_(pw, 18479)
    rows = []
    for j in JOBS:
        w = WEAPON[j.split('_')[0]]
        lg = labeled(Lr(A, j, 'idle', w), j + ' 大表示')
        frames = [labeled(person(Sr(A, j, p, w)), p) for p in POSES]
        strip = hstack(frames, 4)
        strip.convert('RGB').save(os.path.join(OUTD, f'poses_{j}_1x.png'))
        up(strip, 3).convert('RGB').save(os.path.join(OUTD, f'poses_{j}_3x.png'))
        rows.append((lg, labeled(person(Sr(A, j, 'idle', w)), '帯1倍'), labeled(up(person(Sr(A, j, 'idle', w)), 4), '帯4倍(補助)')))
    # 一覧：職ごとに 大表示(1倍)・帯1倍・帯4倍。
    tiles = [hstack(list(r)) for r in rows]
    for name, part in (('base', tiles[:12]), ('master', tiles[12:24]), ('alt1', tiles[24:])):
        if part: vstack([hstack(part[k:k + 2]) for k in range(0, len(part), 2)]).convert('RGB').save(os.path.join(OUTD, f'all_{name}.png'))
    # 全ポーズ一覧（2倍・人物の右側まで含め武器と弾道の出どころが見える範囲）
    allp = {'base': [], 'master': [], 'alt1': []}
    for j in JOBS:
        w = WEAPON[j.split('_')[0]]; k = 'master' if j.endswith('_master') else 'alt1' if j.endswith('_alt1') else 'base'
        allp[k].append(hstack([labeled(up(Sr(A, j, p, w).crop((58, 12, 118, 44)), 2), (j + ' ' if i == 0 else '') + p) for i, p in enumerate(POSES)], 4))
    for k, v in allp.items():
        if v: vstack(v).convert('RGB').save(os.path.join(OUTD, f'poses_all_{k}.png'))
    # 補助：人物だけ6倍（待機・攻撃）。実寸の一覧が主、これは細部の確認用
    dets = {'base': [], 'master': [], 'alt1': []}
    for j in JOBS:
        w = WEAPON[j.split('_')[0]]; k = 'master' if j.endswith('_master') else 'alt1' if j.endswith('_alt1') else 'base'
        dets[k].append(hstack([labeled(up(person(Sr(A, j, p, w)).crop((6, 8, 38, 44)), 6), j + ' ' + p) for p in ('idle', 'attack')]))
    for k, v in dets.items():
        if v: vstack([hstack(v[i:i + 3]) for i in range(0, len(v), 3)]).convert('RGB').save(os.path.join(OUTD, f'detail6x_{k}.png'))
    print('errors', A.errs); A.close()
