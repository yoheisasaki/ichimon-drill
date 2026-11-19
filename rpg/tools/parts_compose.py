# 部品を仕様（HERO_PARTS_SPEC.md）の重ね順と parts.json だけで合成する Python（JS は触らない）。
# 重ね順: 身体(後方装飾は身体に含む) → 頭 → 武器 → 前の手。肌・髪は色列を完全一致で置き換える。
import os, sys, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import PARTS, SKIN_RAMP, HAIR_RAMP, hexc, R

PJ = json.load(open(os.path.join(PARTS, 'parts.json'), encoding='utf-8'))
ICONS = os.path.join(R, 'assets', 'icons')
SKIN = ['#f0c39a', '#f6d7b8', '#d9a77a', '#b97d56', '#8a5a3c']          # rpg-meta.js
HAIR_COLOR = ['#7a4a2a', '#2a2a33', '#d9b04a', '#c9572e', '#6a8fd0', '#e8e8f0']

def ramp_from(c, base):
    """基準列 base（明→暗、base[1] が基準色）と同じ明暗関係の列を、色 c から作る"""
    b = [np.array(hexc(x), float) for x in base]; c = np.array(hexc(c), float); out = []
    for i, bi in enumerate(b):
        if i < 1: t = (bi - b[1]) / (255 - b[1]); v = c + (255 - c) * t
        else: v = c * (bi / b[1])
        out.append(tuple(int(round(min(255, max(0, x)))) for x in v))
    return out

def recolor(img, src_list, dst_list):
    a = np.array(img); rgb = a[..., :3]
    for s, d in zip(src_list, dst_list):
        m = (rgb[..., 0] == s[0]) & (rgb[..., 1] == s[1]) & (rgb[..., 2] == s[2]) & (a[..., 3] > 0)
        a[m, 0], a[m, 1], a[m, 2] = d
    return Image.fromarray(a)

def part(name, skin=None, hair=None):
    im = Image.open(os.path.join(PARTS, name)).convert('RGBA')
    if skin is not None: im = recolor(im, [hexc(x) for x in PJ['palette']['skin'].get(name, SKIN_RAMP)], ramp_from(SKIN[skin], SKIN_RAMP))
    if hair is not None and name in PJ['palette']['hair']:
        im = recolor(im, [hexc(x) for x in PJ['palette']['hair'][name]], ramp_from(HAIR_COLOR[hair], HAIR_RAMP))
    return im

def weapon(icon, angle_deg, scale):
    """武器アイコンを grip 基準で (gripAngle − tipAngle) だけ回して (画像, grip座標) を返す。90度単位は劣化なし"""
    e = PJ['weapon'][icon]; im = Image.open(os.path.join(ICONS, icon)).convert('RGBA')
    gx, gy = e['grip']
    if scale != 1:
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.NEAREST); gx, gy = gx * scale, gy * scale
    pad = 24; big = Image.new('RGBA', (im.width + pad * 2, im.height + pad * 2), (0, 0, 0, 0)); big.paste(im, (pad, pad))
    gx += pad; gy += pad
    rot = angle_deg - e['tipAngle']   # 反時計回りが正（PIL の rotate と同じ）
    if rot % 360:
        r = rot % 360
        if r % 90 == 0:
            n = int(r // 90); big2 = big.rotate(r, resample=Image.NEAREST, expand=False, center=(gx, gy)); big = big2
        else:
            big = big.rotate(rot, resample=Image.NEAREST, expand=False, center=(gx, gy))
    return big, (gx, gy)

def compose(job, pose, size, head, icon, skin=0, hair=0, costume='', canvas_pad=26):
    key = f'{job}{("_" + costume) if costume else ""}_{pose}_{size}'; b = PJ['body'][key]
    body = part(f'body_{key}.png', skin=skin)
    hd = PJ['head'][head]; hi = part(f'{head}.png', skin=skin, hair=hair)
    W, H = body.width + canvas_pad * 2, body.height + canvas_pad * 2
    cv = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ox = oy = canvas_pad
    back = b.get('weaponLayer') == 'back'   # S: 武器は身体より後ろ（胴体に重ならない）
    def put_weapon():
        wi, (gx, gy) = weapon(icon, b['gripAngle'], b['weaponScale'])
        px = round(ox + b['grip'][0] - gx); py = round(oy + b['grip'][1] - gy)
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); layer.paste(wi, (px, py)); cv.alpha_composite(layer)
    if icon and back: put_weapon()
    cv.alpha_composite(body, (ox, oy))
    hx = round(ox + b['neck'][0] - hd['neck'][0]); hy = round(oy + b['neck'][1] - hd['neck'][1])
    cv.alpha_composite(hi, (hx, hy))
    if icon and not back: put_weapon()
    if b.get('hand') and not back:
        hand = part(b['hand'], skin=skin); cv.alpha_composite(hand, (ox + b['handPos'][0], oy + b['handPos'][1]))
    return cv, (ox + b['foot'][0], oy + b['foot'][1])

def bg_sheet(w, h, color=(96, 128, 100, 255)):
    return Image.new('RGBA', (w, h), color)
