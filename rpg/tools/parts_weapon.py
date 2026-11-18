# 武器アイコン（アイテムの正式アイコン）を持ち手用に parts.json の weapon へ登録する。
# itemId は rpg-data.js の w_<cat>_<rank>（通常）と rw_<cat>_<rank>（レア）。青銅のつるぎ=w_sword_1、火花のつるぎ=rw_sword_1。
# grip=アイコン上の握る位置（柄の中ほど）、tipAngle=剣先の向き（右=0・上=90。アイコンは右上=45度）。
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import save_parts_json
W = {'w_sword_1.png': {'itemId': 'w_sword_1', 'name': '青銅のつるぎ', 'grip': [6, 22], 'tipAngle': 45},
     'rw_sword_1.png': {'itemId': 'rw_sword_1', 'name': '火花のつるぎ', 'grip': [7, 25], 'tipAngle': 45},
     'w_staff_1.png': {'itemId': 'w_staff_1', 'name': '旅人の杖', 'grip': [8, 22], 'tipAngle': 45},
     'w_dagger_1.png': {'itemId': 'w_dagger_1', 'name': '銅の短剣', 'grip': [8, 24], 'tipAngle': 45},
     # 弓: アイコンは弓の上端が右上(45度)。弓の胴の中ほど(木の部分)を握る。回転なしで使う
     'w_bow_1.png': {'itemId': 'w_bow_1', 'name': '若木の弓', 'grip': [16, 16], 'tipAngle': 45}}
# 各職の基本武器（rpg-data.js JOBS[*].weapons の先頭。影武者は剣と短剣のうち短剣＝戦士・聖騎士と見分けるため）
JOB_WEAPON = {'warrior': 'w_sword_1.png', 'magicknight': 'w_sword_1.png', 'paladin': 'w_sword_1.png', 'skyknight': 'w_sword_1.png',
              'mage': 'w_staff_1.png', 'priest': 'w_staff_1.png', 'sage': 'w_staff_1.png', 'starseer': 'w_staff_1.png',
              'thief': 'w_dagger_1.png', 'shadow': 'w_dagger_1.png', 'ninja': 'w_dagger_1.png', 'ranger': 'w_bow_1.png'}
def mut(d): d['weapon'].update(W); d['jobWeapon'] = JOB_WEAPON
save_parts_json(mut); print('registered', list(W))
