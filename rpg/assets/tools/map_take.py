# python tools/map_take.py <key>... : Downloads の cg_map_<key>.png を src/bg_map_<key>/ へ移し 240x240 に縮小（最近傍）して bg/bg_map_<key>.png に
import sys, os, shutil
from PIL import Image
A = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); D = os.path.expanduser('~/Downloads')
for k in sys.argv[1:]:
    i = f'bg_map_{k}'; f = f'{D}/cg_map_{k}.png'; s = f'{A}/src/{i}/{i}.png'
    if os.path.exists(f): os.makedirs(os.path.dirname(s), exist_ok=True); shutil.move(f, s)
    if not os.path.exists(s): print('skip', k); continue
    im = Image.open(s).convert('RGB'); w, h = im.size; m = min(w, h); x0, y0 = (w - m) // 2, (h - m) // 2
    im.crop((x0, y0, x0 + m, y0 + m)).resize((240, 240), Image.NEAREST).save(f'{A}/bg/{i}.png'); print(i, w, h)
