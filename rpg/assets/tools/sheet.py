# python sheet.py out.png id1 id2 ... : chars/<id>.png を灰背景に3倍で並べる（目視用）
import sys, os
from PIL import Image
A = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
ims = [Image.open(f'{A}/chars/{i}.png').convert('RGBA') for i in sys.argv[2:]]
S = 3; W = sum(i.width * S + 20 for i in ims) + 20; H = max(i.height for i in ims) * S + 40
sh = Image.new('RGBA', (W, H), (96, 150, 96, 255)); x = 20
for i in ims:
    b = i.resize((i.width * S, i.height * S), Image.NEAREST); sh.alpha_composite(b, (x, H - 20 - b.height)); x += b.width + 20
sh.convert('RGB').save(sys.argv[1])
