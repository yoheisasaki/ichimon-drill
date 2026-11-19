# v3b の仕上げ（父の4点修正と残りポーズ）。先に parts_body_v3b.py を L・S の順に実行してから python rpg/tools/parts_body_v3b_fix.py
# L: 髪の房をまとめる・肩の金飾りを控えめに・攻撃の頭は待機と同じ頭に差し替え・待機の剣は立てて脚にかけない
#    ready/guard は攻撃の身体、hit は待機の身体を後ろへ傾けて目を閉じた顔にして作る（元絵の再生成はしない）
# S: 元絵（濃くつぶれる）は使わず、同じパレットで手描きし直す（parts_body_v3b_s.py。目は肌色に囲まれた縦2×3）。全ポーズ同じ頭
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.path.insert(0, os.path.dirname(__file__))
from parts_common import PARTS, save_parts_json

OUT = (20, 26, 58); HB = (136, 73, 50); HH = (191, 135, 102); SK = (251, 209, 164)
GOLD1 = (248, 191, 69); GOLD2 = (232, 161, 44); BROWN = (180, 108, 50)

def load(name): return np.array(Image.open(os.path.join(PARTS, name)).convert('RGBA'))
def save(name, a): Image.fromarray(a.astype(np.uint8)).save(os.path.join(PARTS, name))
def eq(a, c): return (a[..., :3] == np.array(c)).all(2) & (a[..., 3] > 0)
def face_info(a):
    """顔（最大の肌色のかたまり）の下端の行・中心の列・肌色が広がり始める行"""
    sk = eq(a, SK); lab, n = ndi.label(sk); sizes = ndi.sum(sk, lab, range(1, n + 1)); k = 1 + int(np.argmax(sizes)); m = lab == k
    ys, xs = np.nonzero(m); return int(ys.max()), float(xs.mean()), int(np.nonzero(sk.sum(1) >= 6)[0].min())

def simplify_hair(a, ystop, r=2, keep_hl=2):
    """頭頂の房を開き処理でまとめ、輪郭を引き直す。ystop より下（前髪・顔）は触らない。ハイライトは大きい2つだけ残す"""
    op = a[..., 3] > 0; h, w = op.shape
    M = op.copy(); M[ystop:] = False
    yy, xx = np.mgrid[-r:r + 1, -r:r + 1]; st = (yy ** 2 + xx ** 2) <= r * r + 1
    P = np.pad(M, r + 2); P = ndi.binary_opening(P, st); P = ndi.binary_closing(P, np.ones((3, 3), bool))[r + 2:-(r + 2), r + 2:-(r + 2)]
    reg = np.zeros_like(op); reg[:ystop] = True
    hl = eq(a, HH) & reg; lab, n = ndi.label(hl); sizes = ndi.sum(hl, lab, range(1, n + 1)); keep = np.zeros_like(hl)
    for k in np.argsort(sizes)[::-1][:keep_hl]: keep |= lab == k + 1
    new = a.copy(); new[reg] = 0
    hairlike = eq(a, HB) | eq(a, HH) | eq(a, OUT) | eq(a, GOLD2)
    for y in range(ystop):
        for x in range(w):
            if not P[y, x]: continue
            new[y, x] = a[y, x] if (a[y, x, 3] > 0 and not hairlike[y, x]) else [*HB, 255]
    new[keep & P] = [*HH, 255]
    Pe = P | (op & ~reg); inner = ndi.binary_erosion(np.pad(Pe, 1), np.ones((3, 3), bool))[1:-1, 1:-1]
    new[(P & ~inner) & reg] = [*OUT, 255]
    return new

def tone_shoulders(a, y0, y1):
    """肩の金飾り：明るい金→中の金、中の金→ベルトの茶。面積は変えず目立ちを下げる"""
    a = a.copy(); sl = np.zeros(a.shape[:2], bool); sl[y0:y1] = True
    g1 = eq(a, GOLD1) & sl; g2 = eq(a, GOLD2) & sl; a[g2] = [*BROWN, 255]; a[g1] = [*GOLD2, 255]; return a

def paste_head(dst, src):
    """src（待機）の頭を dst（攻撃）へ：あごの行と顔の中心をそろえ、dst の古い頭（拳より上）を消してから貼る"""
    sc, sx, _ = face_info(src); dc, dx, _ = face_info(dst); ddx = int(round(dx - sx)); ddy = dc - sc
    out = dst.copy(); h, w = out.shape[:2]
    out[:dc + 2, :57] = 0; out[:dc - 2] = 0
    for y in range(0, sc + 2):
        for x in range(src.shape[1]):
            if src[y, x, 3] == 0: continue
            ty, tx = y + ddy, x + ddx
            if 0 <= ty < h and 0 <= tx < w: out[ty, tx] = src[y, x]
    return out

def closed_eyes(a):
    """被弾の顔：両目を肌色にして > < を描く（待機の座標）"""
    a = a.copy(); a[33:43, 22:32] = [*SK, 255]; a[32:43, 39:48] = [*SK, 255]
    for y, xs in ((36, (24, 25)), (37, (26, 27)), (38, (27, 28)), (39, (26, 27)), (40, (24, 25)), (36, (43, 44)), (37, (41, 42)), (38, (40, 41)), (39, (41, 42)), (40, (43, 44))):
        for x in xs: a[y, x] = [*OUT, 255]
    return a


BLUE = (47, 102, 194)
def erase_fists(a, ent):
    """待機の両拳（肌色・影・桃色）を袖の青で塗りつぶす。右は手部品の範囲、左は左右対称の位置（輪郭は残す）"""
    a = a.copy(); hx, hy = ent['handPos']; hh, hw = load(ent['hand']).shape[:2]; w = a.shape[1]
    skin = [SK, (227, 166, 122), (229, 124, 91), (250, 227, 185)]
    for x0, x1 in ((hx, hx + hw), (8, 18)):
        for y in range(hy, hy + hh):
            for x in range(x0, x1):
                if 0 <= x < w and a[y, x, 3] > 0 and tuple(a[y, x, :3]) in skin: a[y, x] = [*BLUE, 255]
    return a
def draw_arm(a, p0, p1, thick=3):
    """袖の青の腕を p0→p1 に描き、外側に輪郭1色・1px"""
    a = a.copy(); h, w = a.shape[:2]; m = np.zeros((h, w), bool); n = 40
    for i in range(n + 1):
        cx = p0[0] + (p1[0] - p0[0]) * i / n; cy = p0[1] + (p1[1] - p0[1]) * i / n
        yy, xx = np.ogrid[:h, :w]; m |= (yy - cy) ** 2 + (xx - cx) ** 2 <= (thick / 2 + 0.6) ** 2
    ring = ndi.binary_dilation(m, structure=np.ones((3, 3), bool)) & ~m
    a[ring] = [*OUT, 255]; a[m] = [*BLUE, 255]; return a

def hand_layer(ent, shape):
    L = np.zeros(shape, np.uint8)
    if ent.get('hand'):
        im = load(ent['hand']); x, y = ent['handPos']; L[y:y + im.shape[0], x:x + im.shape[1]] = im
    return L
def crop_hand(L):
    ys, xs = np.nonzero(L[..., 3] > 0)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1); return L[box[1]:box[3], box[0]:box[2]], [int(box[0]), int(box[1])]
def remap(a, rows, dx):
    """rows: 元の行番号の並び（飛ばせば縮み）、dx: 出力行ごとの横ずれ。左へずらす分は余白を足す"""
    pad = max(0, -min(dx)); h = len(rows); w = a.shape[1] + pad + max(0, max(dx)); out = np.zeros((h, w, 4), np.uint8)
    for i, sy in enumerate(rows): out[i, pad + dx[i]:pad + dx[i] + a.shape[1]] = a[sy]
    return out, pad

def write_pose(job, pose, size, body, ent, hand_arr, hpos, **over):
    key = f'{job}_{pose}_{size}'; save(f'body_{key}.png', body)
    hf = None
    if hand_arr is not None: hf = f'hand_{key}.png'; save(hf, hand_arr)
    ys, xs = np.nonzero(body[..., 3] > 0); low = ys >= ys.max() - 1
    def mut(dj):
        e = dict(ent); refoot = over.pop('refoot', False); e.update(over)
        e['w'] = int(body.shape[1]); e['h'] = int(body.shape[0])
        if refoot: e['foot'] = [round(float(xs[low].mean()), 1), int(ys.max())]
        e['hand'] = hf; e['handPos'] = hpos
        if hf: e['grip'] = [hpos[0] + hand_arr.shape[1] / 2, hpos[1] + hand_arr.shape[0] / 2]
        dj['body'][key] = e
    save_parts_json(mut)

def main():
    J = 'warrior_v3b'; pj = json.load(open(os.path.join(PARTS, 'parts.json'), encoding='utf-8'))['body']
    ent = lambda p, s: dict(pj[f'{J}_{p}_{s}'])
    # ---- L ----
    idle = load(f'body_{J}_idle_L.png'); fb, _, st = face_info(idle)
    idle = tone_shoulders(simplify_hair(idle, st - 3), fb + 1, fb + 11)
    win = load(f'body_{J}_win_L.png'); fbw, _, stw = face_info(win); win = tone_shoulders(simplify_hair(win, stw - 3), fbw + 1, fbw + 11)
    atk = paste_head(load(f'body_{J}_attack_L.png'), idle); fba = face_info(atk)[0]; atk = tone_shoulders(atk, fba + 1, fba + 11)
    WS = 0.65
    e = ent('idle', 'L'); write_pose(J, 'idle', 'L', idle, e, load(e['hand']), e['handPos'], gripAngle=5, weaponScale=WS)
    e = ent('attack', 'L'); ah = load(e['hand']); write_pose(J, 'attack', 'L', atk, e, ah, e['handPos'], weaponScale=WS)
    e = ent('win', 'L'); write_pose(J, 'win', 'L', win, e, load(e['hand']), e['handPos'], weaponScale=WS)
    # ready/guard：待機の身体の両拳を消し、腕を前へ描き直して両手で剣を持つ（待機の頭のまま）
    ie = ent('idle', 'L'); fist = load(ie['hand']); fh, fw = fist.shape[:2]
    base = erase_fists(idle, ie)
    def two_hands(vertical, gap=1):
        W_, H_ = (fw, fh * 2 + gap) if vertical else (fw * 2 + gap, fh); c = np.zeros((H_, W_, 4), np.uint8)
        c[0:fh, 0:fw] = fist
        if vertical: c[fh + gap:, :fw] = fist
        else: c[:, fw + gap:] = fist
        return c
    # ready：剣を両手で身体の前に立てる（拳は腹の前に縦に2つ）
    hc = two_hands(True, 0); hp = (26, 64)
    rb = draw_arm(draw_arm(base, (49, 76), (hp[0] + 9, hp[1] + 3)), (13, 77), (hp[0] + 2, hp[1] + 13))
    write_pose(J, 'ready', 'L', rb, ie, hc, list(hp), gripAngle=12, weaponScale=WS)
    # guard：膝を曲げて3行低く、剣を横にして顔〜胸の前で受ける（拳は胸の前に横に2つ）
    hc = two_hands(False); hp = (17, 52)
    gb = draw_arm(draw_arm(base, (49, 76), (hp[0] + 17, hp[1] + 6)), (13, 77), (hp[0] + 4, hp[1] + 6))
    rows = [y for y in range(gb.shape[0]) if y not in (85, 88, 91)]
    gb, _ = remap(gb, rows, [0] * len(rows))
    write_pose(J, 'guard', 'L', gb, ie, hc, list(hp), gripAngle=78, weaponScale=WS, refoot=True)
    # hit：待機を大きく後ろへのけぞらせ、目を閉じる。剣は手から離さず右上へ流す
    e = ent('idle', 'L'); hl = hand_layer(e, idle.shape); hb = closed_eyes(idle)
    rows = list(range(idle.shape[0])); dx = [-int(round((max(0, 76 - y) / 76) ** 1.3 * 17)) for y in rows]
    hbb, _ = remap(hb, rows, dx); hhl, _ = remap(hl, rows, dx); ha, hp = crop_hand(hhl)
    write_pose(J, 'hit', 'L', hbb, e, ha, hp, gripAngle=60, weaponScale=WS, refoot=True)
    from parts_body_v3b_s import build_s
    build_s(J, ent, save, write_pose)

if __name__ == '__main__': main()
