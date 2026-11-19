# 冒険帯S（小型）を全12職×（通常・マスター・alt1）で描き直す（追加修正指示書10の2章）。python rpg/tools/fix10_build_s.py [名前,...]（例: warrior,mage_master）
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import parts_body_v3b_fix as F
import parts_body_v3b_all as AL
from parts_common import PARTS
B = ['warrior', 'mage', 'priest', 'thief', 'magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger', 'skyknight', 'starseer']
ALL = B + [b + '_master' for b in B] + [b + '_alt1' for b in ['magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger']]
sel = sys.argv[1].split(',') if len(sys.argv) > 1 else ALL
pj = json.load(open(os.path.join(PARTS, 'parts.json'), encoding='utf-8'))['body']
base = dict(pj['warrior_v3b_idle_S'])
for job in sel:
    base_job = job.split('_')[0]
    AL.build_s(job, f'{job}_v3b', lambda p, s: dict(base), F.save, F.write_pose, AL.WS[AL.JOB_WEAPON[base_job]])
    print(job, 'ok')
