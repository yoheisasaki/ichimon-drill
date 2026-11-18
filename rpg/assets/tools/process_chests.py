# 宝箱の閉/開を同じ縮尺で後処理: python process_chests.py <normal|morning|boss> ...  (閉の幅が48pxになる縮尺を開にも使う)
import sys, subprocess, os
from PIL import Image
T = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(T, '..', 'src')
for k in sys.argv[1:]:
    c = os.path.join(S, f'chest_{k}_closed', f'chest_{k}_closed.png'); o = os.path.join(S, f'chest_{k}_open', f'chest_{k}_open.png')
    bb = Image.open(c).convert('RGB'); import numpy as np
    a = np.array(bb); m = (a[..., 0] > 140) & (a[..., 2] > 140) & (a[..., 1] < 120)
    ys, xs = np.where(~m); sc = 48 / (xs.max() - xs.min() + 1)
    for state, src in (('closed', c), ('open', o)):
        print(subprocess.run([sys.executable, os.path.join(T, 'process.py'), 'sprite', f'chest_{k}_{state}', src, '%.5f' % sc], capture_output=True, text=True).stdout[:400])
