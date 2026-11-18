# 試験用の主人公部品（自動テスト専用。本物の部品ではない。rpg/assets/parts/ には置かない）
# python rpg/tests/fixtures/make_parts_fixture.py → rpg/tests/fixtures/parts/
import json, os
from PIL import Image, ImageDraw
OUT = os.path.join(os.path.dirname(__file__), 'parts'); os.makedirs(OUT, exist_ok=True)
JOBS = ['warrior','mage','priest','thief','magicknight','paladin','shadow','sage','ninja','ranger','skyknight','starseer']
SKIN = ['#ffd6b0', '#e8b088', '#b87850']       # 明→暗
HAIR = ['#a05a2a', '#7a4220', '#4a2810']
COL = {j: c for j, c in zip(JOBS, ['#3355aa','#7a4fc9','#e8e4d0','#3a8a5a','#d0503b','#d8c060','#4a4a66','#4fa0c9','#5a3a6a','#4f9a3a','#6fb0e8','#2a2f78'])}
P = {"version": 1, "body": {}, "head": {}, "weapon": {}, "palette": {"skin": {}, "hair": {}}}
def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (255,)
# 身体 40x64（L）：頭と武器を除く。首(20,16)・握り(31,38)・足元(20,64)
for j in JOBS:
  for pose in ['idle', 'ready', 'attack', 'hit', 'win']:
    sh = {'idle': 0, 'ready': 2, 'attack': 4, 'hit': -2, 'win': 0}[pose]
    im = Image.new('RGBA', (40, 64), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.rectangle([14, 14, 26, 18], fill=rgb(SKIN[1]))                    # 首
    d.rectangle([10, 18, 30, 42], fill=rgb(COL[j]))                      # 胴（職業色）
    d.rectangle([12, 42, 18, 62], fill=rgb('#5a3a22')); d.rectangle([22, 42, 28, 62], fill=rgb('#5a3a22'))   # 脚
    d.rectangle([6, 22, 10, 38], fill=rgb(SKIN[0])); d.rectangle([30, 22 + sh // 2, 34, 40 + sh], fill=rgb(SKIN[2]))        # 腕（肌）
    im.save(os.path.join(OUT, f'body_{j}_{pose}_L.png'))
    hand = Image.new('RGBA', (6, 6), rgb(SKIN[0])); hand.save(os.path.join(OUT, f'hand_{j}_{pose}_L.png'))
    P['body'][f'{j}_{pose}_L'] = {"w": 40, "h": 64, "foot": [20, 64], "neck": [20, 16], "grip": [32, 38 + sh], "gripAngle": 45, "weaponScale": 1, "hand": f'hand_{j}_{pose}_L.png'}
    P['palette']['skin'][f'body_{j}_{pose}_L.png'] = SKIN; P['palette']['skin'][f'hand_{j}_{pose}_L.png'] = SKIN
  for pose in ['idle', 'attack', 'hit', 'walk']:
    s = Image.new('RGBA', (16, 26), (0, 0, 0, 0)); d = ImageDraw.Draw(s)    # 帯用 S：16x26
    d.rectangle([5, 8, 11, 18], fill=rgb(COL[j])); d.rectangle([5, 18, 7, 25], fill=rgb('#5a3a22')); d.rectangle([9, 18, 11, 25], fill=rgb('#5a3a22')); d.rectangle([11, 10, 13, 15], fill=rgb(SKIN[0]))
    s.save(os.path.join(OUT, f'body_{j}_{pose}_S.png'))
    P['body'][f'{j}_{pose}_S'] = {"w": 16, "h": 26, "foot": [8, 26], "neck": [8, 8], "grip": [13, 14], "gripAngle": 45, "weaponScale": 0.5}
    P['palette']['skin'][f'body_{j}_{pose}_S.png'] = SKIN
# 頭 L 24x24（首は下の中央 12,24）：顔4×髪6。顔＝目の間隔、髪＝形
for f in range(4):
    for h in range(6):
        im = Image.new('RGBA', (24, 24), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.ellipse([3, 4, 21, 23], fill=rgb(SKIN[0])); d.rectangle([5, 19, 19, 23], fill=rgb(SKIN[1]))
        ex = 6 + f * 1; d.rectangle([ex, 12, ex + 2, 14], fill=(20, 20, 40, 255)); d.rectangle([21 - ex - 3, 12, 21 - ex - 1, 14], fill=(20, 20, 40, 255))
        top = 3 + (h % 3); d.rectangle([3, top, 21, top + 5], fill=rgb(HAIR[0])); d.rectangle([3, top + 5, 6 + (h // 3) * 3, top + 12], fill=rgb(HAIR[1])); d.rectangle([18 - (h // 3) * 3, top + 5, 21, top + 9], fill=rgb(HAIR[2]))
        n = f'head_f{f}_h{h}_L'; im.save(os.path.join(OUT, n + '.png'))
        P['head'][n] = {"w": 24, "h": 24, "neck": [12, 24]}; P['palette']['skin'][n + '.png'] = SKIN; P['palette']['hair'][n + '.png'] = HAIR
for h in range(6):
    im = Image.new('RGBA', (10, 10), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    d.ellipse([1, 2, 9, 10], fill=rgb(SKIN[0])); d.rectangle([1, 1 + h % 3, 9, 4 + h % 3], fill=rgb(HAIR[0])); d.rectangle([1, 4, 2, 6 + h // 3], fill=rgb(HAIR[2]))
    n = f'head_h{h}_S'; im.save(os.path.join(OUT, n + '.png')); P['head'][n] = {"w": 10, "h": 10, "neck": [5, 10]}; P['palette']['skin'][n + '.png'] = SKIN; P['palette']['hair'][n + '.png'] = HAIR
# 武器：正式アイコンの握りと先の向き（全アイコン共通の仮の値）
ic = os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'icons')
for f in os.listdir(ic):
    if f.startswith('w_'): P['weapon'][f] = {"grip": [6, 26], "tipAngle": 45}
json.dump(P, open(os.path.join(OUT, 'parts.json'), 'w'), ensure_ascii=False, indent=0)
print('ok', len(os.listdir(OUT)), 'files')
