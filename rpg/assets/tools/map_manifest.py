# python tools/map_manifest.py key... : 台帳の bg_map_<key>（探索地図 240x240）行だけを正式に更新（実行直前に読み直す）
import json, os, sys
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..')); mp = os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json')
m = json.load(open(mp, encoding='utf-8')); by = {a['id']: a for a in m['assets']}
for k in sys.argv[1:]:
    i = f'bg_map_{k}'; a = by.get(i) or {'id': i}
    a.update({'use': f'探索地図_{k} 240x240（地点・宝箱・進み具合は別レイヤー。画面への接続は未）', 'path': f'rpg/assets/bg/{i}.png', 'src': 'ChatGPT生成 1254x1254', 'display': '240x240', 'anchor': '-', 'status': '正式', 'transparent': False,
              'prompt': 'ChatGPTブラウザ版。世界地図を参照に添付し、地域の探索地図を正方形・斜め見下ろし・入口(下)から奥(上)へ1本の道・印や文字なしで生成', 'inspect': '検品済み(自動): 出力240x240。目視: 担当が確認、最終は父'})
    if i not in by: m['assets'].append(a); by[i] = a
c = {}
for a in m['assets']: c[a['status']] = c.get(a['status'], 0) + 1
m['counts'] = c; s = json.dumps(m, ensure_ascii=False, indent=1); json.loads(s); open(mp, 'w', encoding='utf-8').write(s); print(c)
