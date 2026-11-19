# python enemies_variants.py : 秘境 x_<地域>_<k>(30) と 夜明けの孤島 xi_<k>(30) を、元の敵の画像から色替え＋縁取り・きらめきの飾りで作る。台帳に登録。
# 元の敵 = rpg-world.js と同じ規則（x: REGIONS[12+si]+REGIONS[6+si] の先頭5 / xi: pool[(k*7)%30]）。元が正式画像でないものは作らず一覧に出す。
import os, sys, json, subprocess, colorsys
import numpy as np
from PIL import Image
T = os.path.dirname(os.path.abspath(__file__)); A = os.path.abspath(os.path.join(T, '..')); R = os.path.abspath(os.path.join(A, '..')); ROOT = os.path.abspath(os.path.join(R, '..'))
base = json.loads(subprocess.run(['node', '-e', """
const D=require('./js/rpg-data.js');require('./js/rpg-world.js');const W=D.WORLD;
console.log(JSON.stringify(W.SECRET_DEFS.map((s,si)=>({id:s.id,base:D.REGIONS[12+si].enemies.concat(D.REGIONS[6+si].enemies).slice(0,5).map(b=>b.id)}))));"""], cwd=R, capture_output=True, text=True, encoding='utf-8').stdout)
# 地域ごとの色替え: (色相回転°, 彩度倍, 明度倍, 飾りの色)
# 地域ごとの目標色相(°)・彩度倍・明度倍・飾りの色。元の敵の主色(彩度で重みづけ)が目標に寄るよう回転量を決める(近すぎれば120°回す)
TH = {'garden': (335, 1.0, 1.08, (255, 150, 210)), 'pearl': (275, 0.95, 1.08, (200, 190, 255)), 'nightcity': (265, 0.9, 0.85, (255, 215, 90)),
      'dragonvalley': (190, 1.0, 1.1, (170, 230, 255)), 'lab0': (25, 1.1, 1.0, (255, 140, 60)), 'orchard': (300, 1.0, 0.9, (255, 230, 120))}
DAWN = (38, 1.0, 1.12, (255, 200, 130))   # 夜明け: 桃・暁色寄せ＋金の飾り
def domhue(im):
    a = np.array(im.convert('RGBA')); rgb = a[..., :3].astype(float) / 255; m = a[..., 3] > 0
    hs = np.array([colorsys.rgb_to_hsv(*c) for c in rgb[m][::3]]); w = hs[:, 1] * hs[:, 2] * (hs[:, 2] > 0.3)
    if w.sum() < 1e-6: return 0
    return (np.degrees(np.angle((w * np.exp(2j * np.pi * hs[:, 0])).sum())) % 360)
def shiftfor(im, th):
    d = (th[0] - domhue(im) + 180) % 360 - 180
    return d if abs(d) >= 50 else (120 if d >= 0 else -120)
def exist(i): return os.path.exists(f'{A}/chars/enemy_{i}.png') and os.path.exists(f'{A}/chars/enemy_{i}_strip.png')
def recolor(im, th, warm=0.0):
    a = np.array(im.convert('RGBA')); rgb = a[..., :3].astype(float) / 255
    mx = rgb.max(-1); mn = rgb.min(-1); v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    d = mx - mn + 1e-9
    h = np.where(mx == rgb[..., 0], ((rgb[..., 1] - rgb[..., 2]) / d) % 6, np.where(mx == rgb[..., 1], (rgb[..., 2] - rgb[..., 0]) / d + 2, (rgb[..., 0] - rgb[..., 1]) / d + 4)) / 6
    dark = (v < 0.28)   # 濃い輪郭は色を変えない
    h2 = (h + th[0] / 360) % 1; s2 = np.clip(s * th[1], 0, 1); v2 = np.clip(v * th[2], 0, 1)
    h2 = np.where(dark, h, h2); s2 = np.where(dark, s, s2); v2 = np.where(dark, v, v2)
    i = np.floor(h2 * 6).astype(int) % 6; f = h2 * 6 - np.floor(h2 * 6); p = v2 * (1 - s2); q = v2 * (1 - f * s2); t = v2 * (1 - (1 - f) * s2)
    out = np.select([(i == n)[..., None] for n in range(6)], [np.stack(x, -1) for x in [(v2, t, p), (q, v2, p), (p, v2, t), (p, q, v2), (t, p, v2), (v2, p, q)]])
    if warm: out = out * (1 - warm) + np.array(th[3]) / 255 * warm * np.where(dark[..., None], 0.3, 1)
    a[..., :3] = (out * 255).clip(0, 255).astype(np.uint8); return Image.fromarray(a)
def ornament(im, col, px, seed):
    # 縁取り(1px)と きらめき(+字)を足す。余白pxを四方に足してから描く
    pad = 2 if px >= 56 else 1; sp = 3 if px >= 56 else 2
    w, h = im.size; cv = Image.new('RGBA', (w + pad * 2 + sp, h + pad * 2 + sp), (0, 0, 0, 0)); cv.paste(im, (pad, pad + sp), im)
    a = np.array(cv); al = a[..., 3] > 0
    pd = np.pad(al, 1); n = pd[:-2, 1:-1] | pd[2:, 1:-1] | pd[1:-1, :-2] | pd[1:-1, 2:]
    ring = n & ~al
    a[ring] = (*col, 255)
    # きらめき: 右上寄りの空き地に + を2つ
    H, W = al.shape; rng = np.random.RandomState(seed)
    for (fx, fy, r) in ((0.78, 0.10, sp), (0.22, 0.04, max(1, sp - 1))):
        cx, cy = int(W * fx), int(H * fy) + r
        for d in range(-r, r + 1):
            for (x, y) in ((cx + d, cy), (cx, cy + d)):
                if 0 <= x < W and 0 <= y < H and not al[y, x]: a[y, x] = (*col, 255)
    return Image.fromarray(a)
def make(src, dst, th, col, px, seed, warm):
    im = Image.open(src).convert('RGBA'); o = ornament(recolor(im, th, warm), col, px, seed); o.save(dst)
mp = f'{ROOT}/rpg/ASSET_MANIFEST.json'
jobs = []; skipped = []
for si, s in enumerate(base):
    for k, b in enumerate(s['base']):
        jobs.append((f"x_{s['id']}_{k}", b, TH[s['id']], 0.0))
pool = [f"x_{s['id']}_{k}" for s in base for k in range(5)]
srcof = {j[0]: j[1] for j in jobs}
for k in range(30):
    jobs.append((f'xi_{k}', srcof[pool[(k * 7) % 30]], DAWN, 0.18))
done = []
for i, (vid, b, th, warm) in enumerate(jobs):
    if not exist(b): skipped.append((vid, b)); continue
    for suf, px in (('', 96), ('_strip', 28)):
        im = Image.open(f'{A}/chars/enemy_{b}{suf}.png'); big = im.size[1] > 40
        t2 = (shiftfor(Image.open(f'{A}/chars/enemy_{b}.png'), th),) + tuple(th[1:])
        make(f'{A}/chars/enemy_{b}{suf}.png', f'{A}/chars/enemy_{vid}{suf}.png', t2, th[3], 96 if suf == '' else 28, i, warm)
    done.append((vid, b))
# 台帳（書く直前に読み直し、自分のIDの行だけ更新。一時ファイル→検証→置換）
m = json.load(open(mp, encoding='utf-8')); by = {x['id']: x for x in m['assets']}
for vid, b in done:
    for suf, lab in (('', '帯用でない（報酬用）'), ('_strip', '帯用')):
        i = f'enemy_{vid}{suf}'; e = by.get(i) or {'id': i}
        e.update({'use': f'敵 {vid}（{b} の強化個体・{lab}）', 'path': f'rpg/assets/chars/enemy_{vid}{suf}.png', 'src': f'chars/enemy_{b}{suf}.png のパレット変更＋縁取り・きらめき（tools/enemies_variants.py）',
                  'display': '報酬用' if not suf else '帯用', 'anchor': '足元中央', 'status': '正式', 'transparent': True, 'ref': f'rpg/assets/chars/enemy_{b}.png', 'prompt': '生成なし（元の敵の色替え）', 'inspect': '自動: 色相回転・縁取り・きらめき。元の敵と別色で判別できること'})
        if i not in by: m['assets'].append(e); by[i] = e
c = {}
for x in m['assets']: c[x['status']] = c.get(x['status'], 0) + 1
m['counts'] = c
tmp = mp + '.tmp'; json.dump(m, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); json.load(open(tmp, encoding='utf-8')); os.replace(tmp, mp)
print('made', len(done), 'skipped', skipped)
