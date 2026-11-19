# L（大表示）用の手持ち武器絵：店アイコン(32px)を 42px（1.3125倍・最近傍）にして held_<id>_L.png に出し、parts.json の weapon に held/heldGrip を足す。
# 頭が大きい新比率では1倍だと短剣に見えるため。S は従来どおりアイコン×0.5。形と色は店アイコンと同一。
import os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import PARTS, save_parts_json
ICONS = os.path.join(os.path.dirname(__file__), '..', 'assets', 'icons')
IDS = ['w_start', 'w_sword_1', 'w_sword_2', 'w_staff_1', 'w_dagger_1', 'w_bow_1']
N = 42; K = N / 32
def mut(d):
    for i in IDS:
        im = Image.open(os.path.join(ICONS, i + '.png')).convert('RGBA').resize((N, N), Image.NEAREST)
        f = f'held_{i}_L.png'; im.save(os.path.join(PARTS, f))
        e = d['weapon'][i + '.png']; e['held'] = f; e['heldGrip'] = [round(e['grip'][0] * K + K / 2 - 0.5), round(e['grip'][1] * K + K / 2 - 0.5)]
        print(i, e['heldGrip'])
save_parts_json(mut)
