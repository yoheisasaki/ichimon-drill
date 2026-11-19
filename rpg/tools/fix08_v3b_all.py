# 全職×v3b の一覧画像。python rpg/tools/fix08_v3b_all.py [職,職,...]
# 出力: rpg/shots/fix08_v3b_all/{all_1x.png, all_2x.png, poses_<職>.png}。実物の rpg-sprites.js を headless Chromium で動かす（fix08_v3b2.py の描画部を流用）。
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
OUTD = os.path.join(ROOT, 'rpg', 'shots', 'fix08_v3b_all'); os.makedirs(OUTD, exist_ok=True)
JOBS = ['warrior', 'mage', 'priest', 'thief', 'magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger', 'skyknight', 'starseer']
JOBS = [j for j in JOBS if (sel is None or j in sel)]
WEAPON = {'warrior': 'w_sword_1', 'magicknight': 'w_sword_1', 'paladin': 'w_sword_1', 'skyknight': 'w_sword_1', 'mage': 'w_staff_1', 'priest': 'w_staff_1', 'sage': 'w_staff_1', 'starseer': 'w_staff_1', 'thief': 'w_dagger_1', 'shadow': 'w_dagger_1', 'ninja': 'w_dagger_1', 'ranger': 'w_bow_1'}
with pw_() as pw:
    s = serve(ROOT, 18478); A = R_(pw, 18478)
    cols = []
    for j in JOBS:
        g['JOB'] = j + '_v3b'; w = WEAPON[j]
        cols.append([labeled(A.L('idle', w, 'none'), j + ' 待機'), labeled(A.L('attack', w, 'none'), '攻撃'), labeled(A.S('idle', w), '帯 待機')])
        if sel is not None or True:
            pr = [labeled(up(A.L(p, w, 'none'), 2), 'L ' + p) for p in ('idle', 'attack', 'win', 'ready', 'guard', 'hit')]
            ps = [labeled(up(A.S(p, w), 2).crop((120, 0, 420, 88)), 'S ' + p) for p in ('idle', 'attack', 'win', 'walk', 'walk2', 'windup', 'guard', 'hit')]
            vstack([hstack(pr), hstack(ps[:3]), hstack(ps[3:6]), hstack(ps[6:])]).convert('RGB').save(os.path.join(OUTD, f'poses_{j}.png'))
    rows = [hstack([c[i] for c in cols[k:k + 4]]) for k in range(0, len(cols), 4) for i in (0,)]
    # 1倍：職ごとに（L待機・L攻撃・S待機）を横に並べ、4職ずつ段にする
    tiles = [hstack(c) for c in cols]
    grid = vstack([hstack(tiles[k:k + 2]) for k in range(0, len(tiles), 2)])
    grid.convert('RGB').save(os.path.join(OUTD, 'all_1x.png'))
    up(grid, 2).convert('RGB').save(os.path.join(OUTD, 'all_2x.png'))
    # 代用ゼロ：全職×全ポーズ×L/S を実物の描画計画に通し、要求どおりの部品（<職>_v3b_<ポーズ>_<L|S>）が層で選ばれたか
    cov = A.pg.evaluate('''jobs => { const SP = RPGSprites; const out = SP.coverage(jobs, [null], ['self', 'strip']); const rep = SP.devReport(); return { out, layered: rep.layered }; }''', [j + '_v3b' for j in JOBS])
    lay = set(cov['layered']); bad = []
    for e in cov['out']:
        key = f"{e['job']}|-|{e['pose']}|{e['size']}"
        if e['mode'] != 'layered' or key not in lay: bad.append((key, e['mode'], e['reason']))
    print('代用・欠け', len(bad), bad[:5], '／検査した組み合わせ', len(cov['out']))
    json.dump({'checked': len(cov['out']), 'substituted_or_missing': bad}, open(os.path.join(OUTD, 'substitution_check.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('errors', A.errs)
    A.close()
