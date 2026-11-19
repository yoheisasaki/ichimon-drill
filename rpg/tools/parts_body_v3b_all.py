# v3b を戦士以外の職へ展開する仕上げ。先に `DARK=<輝度しきい値> python rpg/tools/parts_body_v3b.py <職> L` を実行してから
#   python rpg/tools/parts_body_v3b_all.py <職>
# L: 髪の房をまとめる・攻撃の頭は待機と同じ頭・ready/guard/hit を待機/攻撃から作る（戦士と同じ手順。座標は顔の位置の差だけずらす）
# S: 戦士の手描き絵（parts_body_v3b_s.py）の色・兜飾り・ローブを職ごとに替えて作る
import sys, os, json
import numpy as np
from PIL import Image
from collections import Counter
sys.path.insert(0, os.path.dirname(__file__))
import parts_body_v3b_fix as F
import parts_body_v3b_s as SS
from parts_common import PARTS, save_parts_json, hue_sat_val

OUT = F.OUT
WS = {'sword': 0.65, 'staff': 0.95, 'dagger': 0.7, 'bow': 0.7}
JOB_WEAPON = {'warrior': 'sword', 'magicknight': 'sword', 'paladin': 'sword', 'skyknight': 'sword', 'mage': 'staff', 'priest': 'staff', 'sage': 'staff', 'starseer': 'staff',
              'thief': 'dagger', 'shadow': 'dagger', 'ninja': 'dagger', 'ranger': 'bow'}
NARROW_JOBS = ('ranger', 'skyknight')
GRIP = {'sword': (5, 12, 78, 60), 'staff': (5, 12, 78, 60), 'dagger': (5, 12, 78, 60), 'bow': (5, 12, 78, 60)}   # idle, ready, guard, hit

# S の色（職ごと）。U 胴・V 影/脚・Y 飾り・T ベルト/靴・D えり/スカーフ・C 腕の影。headgear は頭の飾り（行,列,色の文字）
STYLE = {
    'mage': dict(U=(113, 49, 135), V=(71, 30, 101), Y=(248, 191, 69), T=(180, 108, 50), D=(251, 240, 217), L=(71, 30, 101), robe=True),
    'priest': dict(U=(214, 221, 240), V=(132, 146, 190), Y=(232, 161, 44), T=(180, 108, 50), D=(150, 205, 240), L=(196, 205, 232), robe=True, belt=(47, 102, 194)),
    'thief': dict(U=(70, 120, 60), V=(45, 85, 45), Y=(150, 100, 55), T=(110, 70, 40), D=(150, 100, 55), L=(60, 100, 50)),
    'magicknight': dict(U=(200, 50, 45), V=(140, 30, 35), Y=(232, 161, 44), T=(120, 70, 40), D=(250, 249, 246), L=(130, 80, 60)),
    'paladin': dict(U=(47, 102, 194), V=(30, 72, 150), Y=(248, 191, 69), T=(180, 108, 50), D=(250, 249, 246), L=(235, 225, 200)),
    'shadow': dict(U=(70, 76, 96), V=(40, 44, 66), Y=(110, 116, 136), T=(50, 50, 60), D=(30, 30, 40), L=(45, 48, 68)),
    'sage': dict(U=(214, 225, 244), V=(125, 160, 205), Y=(232, 161, 44), T=(180, 108, 50), D=(100, 170, 225), L=(190, 208, 236), robe=True, circlet=(60, 190, 90)),
    'ninja': dict(U=(110, 60, 150), V=(70, 35, 105), Y=(240, 235, 220), T=(60, 40, 90), D=(110, 60, 150), L=(80, 45, 115), band=(60, 190, 90)),
    'ranger': dict(U=(130, 95, 55), V=(95, 70, 40), Y=(60, 130, 60), T=(110, 70, 40), D=(60, 130, 60), L=(100, 90, 60)),
    'skyknight': dict(U=(214, 221, 240), V=(132, 150, 200), Y=(96, 160, 230), T=(180, 108, 50), D=(100, 170, 225), L=(200, 210, 236), gem=(60, 120, 230), feather=True),
    'starseer': dict(U=(40, 52, 130), V=(25, 33, 90), Y=(248, 191, 69), T=(180, 108, 50), D=(248, 191, 69), L=(30, 40, 100), robe=True, moon=True),
}


# マスター衣装・追加衣装(alt1)のS色。キー＝<職>_master / <職>_alt1。armor=True は肩の飾りを残す
GOLD = (248, 191, 69); GOLD2 = (232, 161, 44); WHITE = (250, 249, 246)
STYLE.update({
    'warrior_master': dict(U=(30, 60, 150), V=(20, 40, 110), Y=GOLD, T=GOLD2, D=(200, 40, 40), L=(30, 60, 150), armor=True, belt=GOLD),
    'mage_master': dict(U=(30, 40, 110), V=(20, 28, 80), Y=GOLD, T=GOLD2, D=WHITE, L=(25, 35, 100), robe=True, armor=True, belt=GOLD),
    'priest_master': dict(U=(250, 243, 225), V=(190, 170, 120), Y=GOLD2, T=GOLD2, D=GOLD2, L=(235, 225, 195), robe=True, armor=True, belt=(47, 102, 194)),
    'thief_master': dict(U=(62, 46, 52), V=(35, 28, 32), Y=(175, 175, 180), T=(60, 45, 50), D=(210, 45, 55), L=(120, 35, 62), armor=True, belt=(30, 25, 28)),
    'shadow_master': dict(U=(48, 48, 66), V=(25, 25, 40), Y=GOLD2, T=(40, 40, 50), D=(210, 45, 55), L=(40, 42, 58), armor=True, belt=GOLD2),
    'sage_master': dict(U=(245, 225, 150), V=(205, 165, 70), Y=GOLD2, T=GOLD2, D=(60, 160, 150), L=(238, 212, 125), robe=True, armor=True, circlet=(60, 190, 90), belt=GOLD2),
    'ninja_master': dict(U=(38, 38, 50), V=(20, 20, 30), Y=GOLD2, T=GOLD2, D=(210, 45, 55), L=(32, 32, 44), armor=True, belt=GOLD2),
    'ranger_master': dict(U=(70, 120, 60), V=(50, 90, 45), Y=WHITE, T=(110, 70, 40), D=(60, 130, 60), L=(120, 85, 50), armor=True, belt=GOLD2),
    'magicknight_master': dict(U=(205, 210, 222), V=(130, 135, 158), Y=GOLD2, T=(120, 70, 40), D=(120, 60, 160), L=(190, 40, 45), armor=True, belt=GOLD2),
    'paladin_master': dict(U=(225, 228, 240), V=(140, 150, 190), Y=GOLD, T=GOLD2, D=(47, 102, 194), L=(205, 205, 200), armor=True, belt=GOLD2),
    'skyknight_master': dict(U=(214, 221, 240), V=(132, 150, 200), Y=GOLD, T=GOLD2, D=(47, 102, 194), L=(200, 210, 236), armor=True, gem=(60, 120, 230), feather=True, belt=(47, 102, 194)),
    'starseer_master': dict(U=(25, 32, 100), V=(15, 20, 70), Y=GOLD, T=GOLD2, D=GOLD, L=(20, 28, 85), robe=True, armor=True, moon=True, belt=GOLD),
    'magicknight_alt1': dict(U=(20, 90, 100), V=(10, 60, 75), Y=(195, 200, 212), T=(120, 70, 40), D=GOLD2, L=(20, 90, 100), armor=True, belt=(120, 70, 40)),
    'paladin_alt1': dict(U=(200, 45, 45), V=(140, 30, 35), Y=GOLD, T=GOLD2, D=GOLD, L=(210, 50, 50), armor=True, belt=GOLD2),
    'shadow_alt1': dict(U=(222, 228, 244), V=(140, 150, 195), Y=(60, 70, 150), T=(60, 70, 150), D=(222, 228, 244), L=(205, 212, 236), armor=True, belt=(60, 70, 150)),
    'sage_alt1': dict(U=(140, 90, 45), V=(100, 60, 30), Y=GOLD2, T=(100, 60, 30), D=(190, 60, 50), L=(140, 90, 45), robe=True, armor=True, belt=(100, 60, 30)),
    'ninja_alt1': dict(U=(200, 50, 45), V=(140, 30, 35), Y=(235, 235, 240), T=(40, 40, 50), D=(150, 155, 165), L=(35, 35, 45), armor=True, belt=WHITE),
    'ranger_alt1': dict(U=(50, 100, 190), V=(30, 70, 150), Y=WHITE, T=(110, 70, 40), D=WHITE, L=(120, 85, 50), armor=True, belt=(110, 70, 40)),
})

def load(name): return F.load(name)

def detect_colors(idle):
    fb, cx, st = F.face_info(idle)
    return fb, cx, st

def find_skin(idle):
    """顔まわり（あごの少し上）で一番多い肌らしい色"""
    h, w = idle.shape[:2]; fb = None
    cnt = Counter()
    for y in range(40, 50):
        for x in range(15, 45):
            if idle[y, x, 3] and tuple(idle[y, x, :3]) != OUT:
                hh, ss, vv = hue_sat_val(tuple(int(c) for c in idle[y, x, :3]))
                if 8 <= hh <= 38 and 0.2 <= ss <= 0.52 and vv >= 0.85: cnt[tuple(int(c) for c in idle[y, x, :3])] += 1
    return cnt.most_common(1)[0][0]

def find_hair(idle, st):
    cnt = Counter()
    for y in range(0, max(1, st - 3)):
        for x in range(idle.shape[1]):
            if idle[y, x, 3] and tuple(idle[y, x, :3]) != OUT: cnt[tuple(int(c) for c in idle[y, x, :3])] += 1
    top = [c for c, _ in cnt.most_common(4)]
    hb = top[0]; luma = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
    hh = max(top[1:], key=luma) if len(top) > 1 and luma(max(top[1:], key=luma)) > luma(hb) else (min(top[1:], key=luma) if len(top) > 1 else hb)
    return hb, hh

def main(job):
    J = f'{job}_v3b'; pj = json.load(open(os.path.join(PARTS, 'parts.json'), encoding='utf-8'))['body']
    ent = lambda p, s: dict(pj[f'{J}_{p}_{s}'])
    base_job = job.split('_')[0]; wk = JOB_WEAPON[base_job]; ws = WS[wk]; g_idle, g_ready, g_guard, g_hit = GRIP[wk]
    # 戦士の顔の基準
    wid = load('body_warrior_v3b_idle_L.png'); wfb, wcx, _ = F.face_info(wid)
    idle = load(f'body_{J}_idle_L.png')
    F.SK = find_skin(idle); fb, cx, st = F.face_info(idle)
    hb, hh = find_hair(idle, st); F.HB, F.HH = hb, hh; F.GOLD2 = hb
    dx, dy = int(round(cx - wcx)), fb - wfb
    print(job, 'skin', F.SK, 'hair', hb, hh, 'face', fb, round(cx, 1), 'offset', dx, dy)
    win = load(f'body_{J}_win_L.png'); fbw, _, stw = F.face_info(win)
    idle = F.simplify_hair(idle, st - 3); win = F.simplify_hair(win, stw - 3)
    atk = F.paste_head(load(f'body_{J}_attack_L.png'), idle)
    e = ent('idle', 'L'); F.write_pose(J, 'idle', 'L', idle, e, load(e['hand']), e['handPos'], gripAngle=g_idle, weaponScale=ws)
    e = ent('attack', 'L'); F.write_pose(J, 'attack', 'L', atk, e, load(e['hand']), e['handPos'], weaponScale=ws, **({'gripAngle': 195} if wk == 'bow' else {}))   # 弓は拳から下へ垂らす（135度だと顔に近い）
    e = ent('win', 'L'); F.write_pose(J, 'win', 'L', win, e, load(e['hand']), e['handPos'], weaponScale=ws)
    # 拳を消す（手部品と同じ色の画素を、拳の上の袖の色に）
    ie = ent('idle', 'L'); fist = load(ie['hand']); fh, fw = fist.shape[:2]
    fam = {tuple(int(c) for c in p[:3]) for p in fist.reshape(-1, 4) if p[3] and tuple(p[:3]) != OUT}
    hx, hy = ie['handPos']
    narrow = '_' in job or job in NARROW_JOBS   # 袖色は拳の真上の細い窓から取る（広い窓だと肩の飾りの色を拾って腕が浮く）
    def sleeve_of(x0, x1):
        c = Counter()
        for y in (range(hy - 7, hy - 1) if narrow else range(hy - 11, hy - 3)):
            for x in (range(x0, x1) if narrow else range(x0 - 2, x1 + 2)):
                if 0 <= x < idle.shape[1] and idle[y, x, 3] and tuple(int(v) for v in idle[y, x, :3]) not in fam and tuple(idle[y, x, :3]) != OUT: c[tuple(int(v) for v in idle[y, x, :3])] += 1
        return c.most_common(1)[0][0] if c else (128, 128, 128)
    sl_r = sleeve_of(hx, hx + fw)
    base = idle.copy(); h_, w_ = base.shape[:2]
    # 左拳：体の中心から見て右拳と左右対称の位置の付近（x が中心より左・拳の行）
    for (x0, x1) in ((hx, hx + fw), (int(round(2 * cx - hx - fw)) - 2, int(round(2 * cx - hx)) + 3)):
        sl = sleeve_of(x0, x1)
        for y in range(hy - 1, hy + fh + 2):
            for x in range(max(0, x0), min(w_, x1)):
                if base[y, x, 3] and tuple(int(v) for v in base[y, x, :3]) in fam: base[y, x] = [*sl, 255]
    F.BLUE = sl_r
    def two_hands(vertical, gap=1):
        W_, H_ = (fw, fh * 2 + gap) if vertical else (fw * 2 + gap, fh); c = np.zeros((H_, W_, 4), np.uint8)
        c[0:fh, 0:fw] = fist
        if vertical: c[fh + gap:, :fw] = fist
        else: c[:, fw + gap:] = fist
        return c
    rs, ls = (49 + dx, 76 + dy), (13 + dx, 77 + dy)
    hc = two_hands(True, 0); hp = (26 + dx, 64 + dy)
    rb = F.draw_arm(F.draw_arm(base, rs, (hp[0] + 9, hp[1] + 3)), ls, (hp[0] + 2, hp[1] + 13))
    F.write_pose(J, 'ready', 'L', rb, ie, hc, list(hp), gripAngle=g_ready, weaponScale=ws)
    hc = two_hands(False); hp = (17 + dx, 52 + dy)
    gb = F.draw_arm(F.draw_arm(base, rs, (hp[0] + 17, hp[1] + 6)), ls, (hp[0] + 4, hp[1] + 6))
    rows = [y for y in range(gb.shape[0]) if y not in (85 + dy, 88 + dy, 91 + dy)]
    gb, _ = F.remap(gb, rows, [0] * len(rows))
    F.write_pose(J, 'guard', 'L', gb, ie, hc, list(hp), gripAngle=g_guard, weaponScale=ws, refoot=True)
    # hit：目を閉じる（待機の目の位置は戦士との差だけずらす）。下の2行は肌色で目を消し > < を描く
    hb2 = idle.copy(); sk = F.SK
    hb2[33 + dy:43 + dy, 22 + dx:32 + dx] = [*sk, 255]; hb2[32 + dy:43 + dy, 39 + dx:48 + dx] = [*sk, 255]
    for y, xs in ((36, (24, 25)), (37, (26, 27)), (38, (27, 28)), (39, (26, 27)), (40, (24, 25)), (36, (43, 44)), (37, (41, 42)), (38, (40, 41)), (39, (41, 42)), (40, (43, 44))):
        for x in xs: hb2[y + dy, x + dx] = [*OUT, 255]
    e = ent('idle', 'L'); hl = F.hand_layer(e, idle.shape)
    rows = list(range(idle.shape[0])); sdx = [-int(round((max(0, 76 + dy - y) / (76 + dy)) ** 1.3 * 17)) for y in rows]
    hbb, _ = F.remap(hb2, rows, sdx); hhl, _ = F.remap(hl, rows, sdx); ha, hp = F.crop_hand(hhl)
    F.write_pose(J, 'hit', 'L', hbb, e, ha, hp, gripAngle=g_hit, weaponScale=ws, refoot=True)
    ent_s = lambda p, s: dict(pj['warrior_v3b_idle_S']) if s == 'S' else ent(p, s)
    build_s(job, J, ent_s, F.save, F.write_pose, ws)

def build_s(job, J, ent, save, write_pose, ws):
    st = STYLE[job]; base_job = job.split('_')[0]; old = dict(SS.COL); oldh, oldb = list(SS.HEAD), list(SS.BODY)
    try:
        for k in ('U', 'V', 'Y', 'T', 'D', 'L'): SS.COL[k] = st[k]
        SS.COL['L'] = st['L']; SS.COL['Q'] = st['L']; SS.COL['K'] = st.get('belt', st['T']); SS.COL['E'] = st.get('circlet') or st.get('gem') or st.get('band') or (0, 0, 0)
        SS.COL['J'] = st.get('band', st['U'])
        head = [list(r) for r in SS.HEAD]
        if st.get('band'):
            head[5] = list('JJJJJJJJJJJJJJJJ')
        if st.get('circlet'):
            head[5][7] = 'E'; head[5][8] = 'E'
        if st.get('gem'):
            head[5][7] = 'E'; head[5][8] = 'E'
        if st.get('feather'):
            for y, x in ((0, 11), (1, 12), (0, 12), (1, 11), (2, 12)): head[y][x] = 'W'
        if st.get('moon'):
            for x in (6, 9): head[5][x] = 'Y'
            head[5][7] = 'Y'; head[5][8] = 'Y'
        SS.HEAD[:] = [''.join(r) for r in head]
        body = list(SS.BODY)
        body = [r.replace('V', 'V') for r in body]
        new = []
        for i, r in enumerate(body):
            if i >= 7: r = r.replace('V', 'L')
            if i == 6: r = r.replace('T', 'K')
            new.append(r)
        if st.get('robe'):
            new[7] = '..LLLLLLLLLLLL..'; new[8] = '...LLLLLLLLLL...'; new[9] = '...LLLLLLLLLL...'; new[10] = '...LLLLLLLLLL...'
        if (st.get('armor') is None and base_job not in ('paladin', 'magicknight', 'skyknight')):
            new[1] = new[1].replace('Y', 'U')
        SS.BODY[:] = new
        SS.build_s(J, ent, save, write_pose)
    finally:
        SS.COL.clear(); SS.COL.update(old); SS.HEAD[:] = oldh; SS.BODY[:] = oldb

if __name__ == '__main__':
    main(sys.argv[1])
