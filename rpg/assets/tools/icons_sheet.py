# 確認用の拡大一覧: python rpg/assets/tools/icons_sheet.py <prefix> <出力png>
import sys, glob, os
from PIL import Image
pre, out = sys.argv[1], sys.argv[2]
fs = sorted(glob.glob(os.path.join(os.path.dirname(__file__), '..', 'icons', pre + '*.png')))
s = Image.new('RGBA', (len(fs) * 100, 100), (40, 60, 110, 255))
for i, f in enumerate(fs):
    im = Image.open(f).resize((96, 96), Image.NEAREST); s.paste(im, (i * 100 + 2, 2), im)
s.save(out)
