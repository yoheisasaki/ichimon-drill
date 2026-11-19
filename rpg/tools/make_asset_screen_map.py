# 素材台帳 → 実画面の対応表 rpg/ASSET_SCREEN_MAP.md を作る。python rpg/tools/make_asset_screen_map.py（台帳の connectedWhere を、同じ接続先ごとにまとめる）
import json, os, collections
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
m = json.load(open(os.path.join(ROOT, 'rpg', 'ASSET_MANIFEST.json'), encoding='utf-8')); A = m['assets']
g = collections.OrderedDict()
for a in A:
    key = (a['status'], a['connected'], a['connectedWhere'])
    g.setdefault(key, []).append(a['id'])
def short(ids):
    ids = sorted(ids)
    return ', '.join(ids[:4]) + (f' ほか{len(ids) - 4}件' if len(ids) > 4 else '')
L = ['# 素材台帳と実画面の対応表', '', f"自動生成（`python rpg/tools/make_asset_screen_map.py`）。元は `rpg/ASSET_MANIFEST.json`（更新 {m['updated']}）。**制作状態（status）と画面への接続（connected）は別の欄。**",
     '', '## 件数', '', f"- 制作状態：{json.dumps(m['counts'], ensure_ascii=False)}", f"- 画面への接続：{json.dumps(m['connectedCounts'], ensure_ascii=False)}（対象外＝画像素材でない台帳行・制作計画の行）",
     '- 「正式」の画像行 773 のうち、画面に接続済み 729、未接続 44（下の「未接続」表）', '', '## 画面に接続済み（正式）', '', '|件数|例（台帳ID）|読んでいる画面・場面|', '|---|---|---|']
for (st, cn, where), ids in g.items():
    if st == '正式' and cn == '接続済み': L.append(f'|{len(ids)}|{short(ids)}|{where}|')
L += ['', '## 未接続（素材は制作済みだが、どの画面にも出していない）', '', '|件数|例（台帳ID）|理由・メモ|', '|---|---|---|']
for (st, cn, where), ids in g.items():
    if cn == '未接続': L.append(f'|{len(ids)}|{short(ids)}|{where}|')
L += ['', '## 画像素材ではない行・制作計画の行（対象外）', '', '|状態|件数|例|メモ|', '|---|---|---|---|']
for (st, cn, where), ids in g.items():
    if cn == '対象外': L.append(f'|{st}|{len(ids)}|{short(ids)}|{where}|')
open(os.path.join(ROOT, 'rpg', 'ASSET_SCREEN_MAP.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('\n'.join(L))
