# python fx_take.py <シート番号> [ファイル] : 技効果シート(6個)を切り分け→ fx/<id>.png(64px) と fx/<id>_strip.png(24px)、台帳 fx_<id>
import sys, os, glob, shutil, json, time
import numpy as np
from PIL import Image
from scipy import ndimage
T = os.path.dirname(os.path.abspath(__file__)); A = os.path.abspath(os.path.join(T, '..')); ROOT = os.path.abspath(os.path.join(A, '..', '..'))
FX = [
 [('slash','斬撃','白い三日月形の斬撃の軌跡'),('fire','炎','赤橙の燃え上がる炎の塊'),('ice','氷','水色の氷の結晶の塊'),('thunder','雷','黄色いジグザグの稲妻'),('water','水','青い水しぶきの渦'),('light','光','白金色に輝く光の玉と十字の輝き')],
 [('heal','回復','緑色の光る十字と葉'),('shield','盾','水色に光る半透明の円い盾の障壁'),('smoke','煙','灰色の丸い煙のかたまり'),('star','星','金色の大きな星と小さな星'),('wind','風','白緑の渦巻く風の刃'),('blast','爆発','橙と黄色の爆発の火の玉')],
]
n = int(sys.argv[1]); items = FX[n]
if len(sys.argv) > 2: f = sys.argv[2]
else:
    c = [p for p in glob.glob('C:/Users/user/Downloads/*') if p.lower().endswith(('.png', '.webp', '.jpg')) and time.time() - os.path.getmtime(p) < 600]
    f = max(c, key=os.path.getmtime)
d = f'{A}/src/fx_sheet{n}'; os.makedirs(d, exist_ok=True); sh = f'{d}/sheet.png'
if os.path.abspath(f) != os.path.abspath(sh): shutil.move(f, sh)
a = np.array(Image.open(sh).convert('RGBA')); H, W = a.shape[:2]
r, g, b = [a[..., i].astype(int) for i in range(3)]
mg = (r > 140) & (b > 140) & (g < 140) & ((r + b) // 2 - g > 70)
os.makedirs(f'{A}/fx', exist_ok=True)
mp = f'{ROOT}/rpg/ASSET_MANIFEST.json'; m = json.load(open(mp, encoding='utf-8')); by = {x['id']: x for x in m['assets']}
for k, (key, nm, desc) in enumerate(items):
    cx, cy = k % 3, k // 3
    x0, x1, y0, y1 = int(cx*W/3), int((cx+1)*W/3), int(cy*H/2), int((cy+1)*H/2)
    t = a[y0:y1, x0:x1].copy(); t[mg[y0:y1, x0:x1], 3] = 0
    sub = ndimage.binary_opening(t[..., 3] > 0, iterations=1)
    lab, q = ndimage.label(ndimage.binary_dilation(sub, iterations=8))
    sz = ndimage.sum(sub, lab, range(1, q+1)); msk = (lab == int(np.argmax(sz)) + 1) & ndimage.binary_dilation(sub, iterations=8)
    t[~msk, 3] = 0; ys, xs = np.where(msk)
    im = Image.fromarray(t).crop((xs.min(), ys.min(), xs.max()+1, ys.max()+1))
    for suf, px in (('', 64), ('_strip', 24)):
        w, h = im.size; sc = px / max(w, h); nw, nh = max(1, round(w*sc)), max(1, round(h*sc))
        arr = np.array(im).astype(float); al = arr[..., 3:4] / 255
        pm = Image.fromarray((arr[..., :3]*al).astype(np.uint8)).resize((nw, nh), Image.BOX); am = Image.fromarray((al[..., 0]*255).astype(np.uint8)).resize((nw, nh), Image.BOX)
        pa, aa = np.array(pm).astype(float), np.array(am).astype(float)/255
        col = np.where(aa[..., None] > 0, pa/np.maximum(aa[..., None], 1e-3), 0).clip(0, 255).astype(np.uint8)
        out = Image.fromarray(np.dstack([col, np.where(aa > 0.5, 255, 0).astype(np.uint8)])); cv = Image.new('RGBA', (px, px), (0, 0, 0, 0)); cv.paste(out, ((px-nw)//2, (px-nh)//2), out)
        cv.save(f'{A}/fx/{key}{suf}.png')
        i = 'fx_' + key + suf; e = by.get(i) or {'id': i}
        e.update({'use': f'技の効果 {nm}（{"共通" if not suf else "帯用縮小"} {px}px）', 'path': f'rpg/assets/fx/{key}{suf}.png', 'src': f'シート(ChatGPT) src/fx_sheet{n}/sheet.png', 'display': f'{px}px', 'anchor': '中央', 'status': '正式', 'transparent': True, 'ref': 'rpg/assets/src/enemy_slime/ref.png', 'prompt': f'{desc}（シート{n}）', 'inspect': '自動: マゼンタ透過・箱平均縮小。画面への接続は未（素材のみ）'})
        if i not in by: m['assets'].append(e); by[i] = e
    print(key, nm, im.size)
c = {}
for x in m['assets']: c[x['status']] = c.get(x['status'], 0) + 1
m['counts'] = c; json.dump(m, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
