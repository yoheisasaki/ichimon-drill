# 頭身の測定: python rpg/assets/tools/measure.py <src.png>  (マゼンタ背景の生成元)
# 全身=不透明画素の上端〜下端。頭の下端(顎)=顔の肌色(r>215,g 150-200,b 90-150)が最後に現れる行のうち、首巻き/手より上の連続部分の下端。目安なので画像も目視する。
import sys, numpy as np
from PIL import Image
a = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(int); r, g, b = a[..., 0], a[..., 1], a[..., 2]
fg = ~((r > 140) & (b > 140) & (g < 120))
ys = np.where(fg.any(1))[0]; top, bot = ys[0], ys[-1]
skin = (r > 215) & (g > 150) & (g < 205) & (b > 90) & (b < 160)
cnt = skin.sum(1)
# 顔: 上から見て最初に肌が20画素以上ある行から、連続して肌がある範囲
rows = np.where(cnt >= 15)[0]
start = rows[0]; end = start
for y in rows:
    if y - end <= 6: end = y
    else: break
total = bot - top + 1; head = end - top + 1
print(f'top={top} bottom={bot} total={total} chin_row={end} head={head} ratio={head/total:.3f} heads={total/head:.2f}')
