# 注: 現行の rpg-sprites に drawHero が無いので主人公は仮の赤い箱（位置関係の目安）。
# 第1章ボス3体を台帳未登録のまま boss_fit と同じ測定にかける（台帳レスポンスだけメモリ上で書き換え）。python rpg/tools/boss3_fit.py
import re, os, sys
src = open(os.path.join(os.path.dirname(__file__), 'boss_fit.py'), encoding='utf-8').read()
add = r"""
pg.route('**/rpg/ASSET_MANIFEST.json*', lambda r: r.fulfill(body=__import__('json').dumps(PATCH(__import__('json').loads(r.fetch().text()))), content_type='application/json'))
"""
pre = r"""
def PATCH(m):
    have = {a['id'] for a in m['assets']}
    for i in ('b_hourglass', 'b_blackknight', 'b_machinegod'):
        for suf in ('', '_strip'):
            if 'enemy_' + i + suf in have: continue
            m['assets'].append({'id': 'enemy_' + i + suf, 'path': 'rpg/assets/chars/enemy_' + i + suf + '.png', 'status': '正式'})
    return m
"""
src = src.replace("ids = sys.argv[1:] or None", pre + "ids = sys.argv[1:] or ['b_hourglass', 'b_blackknight', 'b_machinegod']")
src = src.replace("pg.goto(", add.strip() + "\n    pg.goto(", 1).replace("assets_boss_fit.png", "boss3/boss3_fit.png")
src = src.replace("const SP = RPGSprites, out = [];", "const SP = RPGSprites, out = []; if (!SP.drawHero) SP.drawHero = (g, j, x, y) => { g.fillStyle = '#c33'; g.fillRect(x - 8, y - 28, 16, 28); };").replace("wait_for_selector('.subj')", "wait_for_selector('.subj', state='attached')").replace("__file__", repr(os.path.join(os.path.dirname(__file__), 'boss_fit.py')))
exec(compile(src, 'boss3_fit_run', 'exec'))
