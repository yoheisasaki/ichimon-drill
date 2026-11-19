# 試作素材の台帳更新: python rpg/assets/tools/update_manifest.py
import json, os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
mp = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json'); m = json.load(open(mp, encoding='utf-8'))
by = {a['id']: a for a in m['assets']}
def insp(i): return json.load(open(os.path.join(ROOT, 'rpg', 'assets', 'src', i, 'inspect.json'), encoding='utf-8'))
def prompt(i): return open(os.path.join(ROOT, 'rpg', 'assets', 'src', i, i + '.prompt.txt'), encoding='utf-8').read().split('\n')[0]
HEAD = {'hero_warrior_chibi': '頭身: 頭336/全身871px(源) = 0.386 = 2.59頭身', 'hero_warrior_strip': '頭身: 頭320/全身760px(源) = 0.42 = 2.4頭身'}
items = [
 ('hero_warrior', 'hero_warrior_chibi', 'rpg/assets/chars/hero_warrior.png', '主人公 戦士・待機（報酬用 96px・2.5頭身）', '96px(報酬)'),
 ('hero_warrior_strip', 'hero_warrior_strip', 'rpg/assets/chars/hero_warrior_strip.png', '主人公 戦士・待機（帯用 28px・2.5頭身）', '28px(帯)'),
 ('enemy_e_leafslime', 'enemy_slime', 'rpg/assets/chars/enemy_e_leafslime.png', '敵 はっぱスライム（報酬用 56px）', '56px(報酬)'),
 ('enemy_e_leafslime_strip', 'enemy_slime', 'rpg/assets/chars/enemy_e_leafslime_strip.png', '敵 はっぱスライム（帯用 24px。報酬用と同じ元絵を縮小）', '24px(帯)'),
 ('bg_meadow', 'bg_meadow', 'rpg/assets/bg/bg_meadow.png', '背景（報酬） はじまりの草原 480x240', '480x240'),
 ('bg_meadow_strip', 'bg_meadow_strip', 'rpg/assets/bg/bg_meadow_strip.png', '背景（帯） はじまりの草原 390x44', '390x44'),
]
for id_, src, path, use, disp in items:
    i = insp(src)
    a = by.get(id_) or {'id': id_, 'ref': 'references/approved-answer-reward.png（見本）'}
    a.update({'use': use, 'path': path, 'src': '%dx%d' % tuple(i['src_size']), 'display': disp, 'anchor': '足元中央' if 'bg' not in id_ else '-', 'status': '正式', 'transparent': 'bg' not in id_, 'prompt': prompt(src), 'inspect': '試作・検品済み(自動): ' + json.dumps({k: v for k, v in i.items() if k not in ('src', 'out')}, ensure_ascii=False) + ('。' + HEAD[src] if src in HEAD else '') + '。目視: 絵柄の最終確認は父'})
    if id_ not in by: m['assets'].append(a); by[id_] = a
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c; m['note'] = m['note'].replace('正式素材は0件', '試作の正式素材は6件（草原セット）')
json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(c)
