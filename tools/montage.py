# python tools/montage.py <フォルダ> <出力.png> <列数> <倍率> [前方一致...]  画像をタイル状に並べる（確認用）
import sys, os
from PIL import Image, ImageDraw
d, out, cols, sc = sys.argv[1], sys.argv[2], int(sys.argv[3]), float(sys.argv[4]); pre = sys.argv[5:]
fs = sorted(f for f in os.listdir(d) if f.endswith('.png') and (not pre or any(f.startswith(p) for p in pre)))
ims = [(f, Image.open(os.path.join(d, f)).convert('RGB')) for f in fs]
ims = [(f, im.resize((int(im.width * sc), int(im.height * sc)))) for f, im in ims]
w = max(i.width for _, i in ims); h = max(i.height for _, i in ims) + 14
rows = (len(ims) + cols - 1) // cols
M = Image.new('RGB', (cols * w, rows * h), 'white'); dr = ImageDraw.Draw(M)
for k, (f, im) in enumerate(ims):
    x, y = (k % cols) * w, (k // cols) * h; M.paste(im, (x, y + 14)); dr.text((x + 2, y), f[:-4], fill='black')
M.save(out); print(out, M.size)
