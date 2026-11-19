# python tools/bg_sheet.py 出力.png key... : 背景の一覧シート（確認用）
import sys
from PIL import Image
o, ks = sys.argv[1], sys.argv[2:]; c = Image.new('RGB', (2 * 484, ((len(ks) + 1) // 2) * 290), (20, 20, 20))
for j, k in enumerate(ks):
    x, y = (j % 2) * 484, (j // 2) * 290
    c.paste(Image.open(f'bg/bg_{k}.png'), (x, y)); c.paste(Image.open(f'bg/bg_{k}_strip.png'), (x, y + 244))
c.save(o)
