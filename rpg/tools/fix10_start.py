# 初期武器→最初の購入武器の比較（K-02）。python rpg/tools/fix10_start.py ／ 出力 rpg/shots/fix10_band/start_basic4.png・start_all.png
# 各職：[大表示 初期｜大表示 購入｜帯1倍 初期｜帯1倍 購入｜店アイコン40px 初期｜購入]。実物の rpg-sprites.js を headless Chromium で動かす。
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
sys.argv = [sys.argv[0]]
exec(compile(open(os.path.join(here, 'fix10_band.py'), encoding='utf-8').read().split('with pw_() as pw:')[0], 'fix10_head', 'exec'), globals())
from PIL import Image
CAT = {'warrior': 'sword', 'magicknight': 'sword', 'paladin': 'sword', 'skyknight': 'sword', 'shadow': 'sword', 'mage': 'staff', 'priest': 'staff', 'sage': 'staff', 'starseer': 'staff', 'thief': 'dagger', 'ninja': 'dagger', 'ranger': 'bow'}
ICON = os.path.join(ROOT, 'rpg', 'assets', 'icons')
def icon(i, px=40): return Image.open(os.path.join(ICON, i + '.png')).convert('RGBA').resize((px, px), Image.NEAREST)
with pw_() as pw:
    s = serve(ROOT, 18481); A = R_(pw, 18481); rows = {}
    for j in B:
        c = CAT[j]; st = 'w_start' if c == 'sword' else 'w_start_' + c; bu = f'w_{c}_1'
        cell = []
        for lab, w in (('初期', st), ('購入', bu)):
            cell += [labeled(Lr(A, j, 'idle', w).crop((20, 20, 120, 130)), f'{j} 大 {lab}'), labeled(Sr(A, j, 'idle', w).crop((60, 0, 104, 44)), f'帯 {lab}'), labeled(Sr(A, j, 'attack', w).crop((60, 0, 124, 44)), f'帯攻撃 {lab}'), labeled(icon(w), f'店 {lab}')]
        rows[j] = hstack(cell)
    OUTD = os.path.join(ROOT, 'rpg', 'shots', 'fix10_band')
    vstack([rows[j] for j in ('warrior', 'mage', 'priest', 'thief')]).convert('RGB').save(os.path.join(OUTD, 'start_basic4.png'))
    vstack([rows[j] for j in B[4:]]).convert('RGB').save(os.path.join(OUTD, 'start_others.png'))
    print('errors', A.errs); A.close()
