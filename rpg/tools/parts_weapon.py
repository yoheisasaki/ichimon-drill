# 武器アイコン（アイテムの正式アイコン）を持ち手用に parts.json の weapon へ登録する。
# itemId は rpg-data.js の w_<cat>_<rank>（通常）と rw_<cat>_<rank>（レア）。青銅のつるぎ=w_sword_1、火花のつるぎ=rw_sword_1。
# grip=アイコン上の握る位置（柄の中ほど）、tipAngle=剣先の向き（右=0・上=90。アイコンは右上=45度）。
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import save_parts_json
W = {'w_sword_1.png': {'itemId': 'w_sword_1', 'name': '青銅のつるぎ', 'grip': [6, 22], 'tipAngle': 45},
     'rw_sword_1.png': {'itemId': 'rw_sword_1', 'name': '火花のつるぎ', 'grip': [7, 25], 'tipAngle': 45}}
def mut(d): d['weapon'].update(W)
save_parts_json(mut); print('registered', list(W))
