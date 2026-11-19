# v3b の S（冒険帯・約28px）を手描きで作る。塗りだけを文字で描き、輪郭は外側に自動で1色・1px。全ポーズ同じ頭（目は肌色に囲まれた縦2×3、白いハイライト1つ）
# 呼び出し元: parts_body_v3b_fix.py（L の後）。部品: body_warrior_v3b_<pose>_S.png・hand_..._S.png
import numpy as np

COL = {'O': (20, 26, 58), 'H': (136, 73, 50), 'B': (191, 135, 102), 'G': (251, 209, 164), 'W': (250, 249, 246), 'M': (229, 124, 91),
       'U': (47, 102, 194), 'Y': (232, 161, 44), 'T': (180, 108, 50), 'C': (227, 166, 122), 'D': (250, 227, 185), 'N': (20, 26, 58)}
CW = 22      # 作業幅。頭は x=3〜18
def pad(s): return '...' + s + '...'

HEAD = ['......HH..HH....',
        '....HHHHHHHHHH..',
        '..HHBBHHHHHHHH..',
        '.HHBBHHHHHHHHHH.',
        'HHHHHHHHHHHHHHHH',
        'HHHHHHHHHHHHHHHH',
        'HHHHGGHHHHGGHHHH',
        'HGGGNNGGGGNNGGGH',
        'GGGGNNGGGGNNGGGG',
        '.GGGNNGGGGNNGGG.',
        '.GGGGGGGMMGGGGG.',
        '..GGGGGGGGGGGG..']
HEAD[7] = HEAD[7][:4] + 'WN' + HEAD[7][6:10] + 'WN' + HEAD[7][12:]       # ハイライト
def head_variant(kind):
    h = [list(r) for r in HEAD]
    def put(x, y, c): h[y][x] = c
    if kind in ('hit', 'win'):
        for y in (7, 8, 9):
            for x in (4, 5, 10, 11): put(x, y, 'G')
    if kind == 'hit':      # > <
        for x, y in ((4, 7), (5, 8), (4, 9), (11, 7), (10, 8), (11, 9)): put(x, y, 'N')
    if kind == 'win':      # ^ ^ と大きな口
        for x, y in ((5, 7), (4, 8), (6, 8), (10, 7), (9, 8), (11, 8)): put(x, y, 'N')
        for x in (7, 8): put(x, 10, 'M')
        for x in (7, 8): put(x, 11, 'M')
    return [''.join(r) for r in h]

BODY = ['.....DDGGDD.....',
        '..YYUUUUUUUUYY..',
        '.CUUUUUUUUUUUUC.',
        'CCUUUUUUUUUUUUCC',
        'CCGGUUUUUUUUGGCC',
        'CCGGUUUUUUUUGGCC',
        '.CUUTTTYYTTTUUC.',
        '..UUYUUUUUUYUU..',
        '....UUU..UUU....',
        '....UUU..UUU....',
        '....UUU..UUU....',
        '...TTTT..TTTT...',
        '...TTTT..TTTT...',
        '...HHHH..HHHH...']

def grid(rows):
    return [list(r) for r in rows]
def compose(head, body):
    g = [list(pad(r)) for r in head] + [list(pad(r)) if len(r) == 16 else list(r) for r in body]
    return g
def setpx(g, x, y, c):
    while len(g[y]) <= x: g[y].append('.')
    g[y][x] = c
def to_rgba(g):
    h = len(g); w = max(CW, max(len(r) for r in g)); fill = np.zeros((h + 2, w + 2), bool); col = np.zeros((h + 2, w + 2, 3), np.uint8)
    for y, r in enumerate(g):
        for x, c in enumerate(r):
            if c != '.': fill[y + 1, x + 1] = True; col[y + 1, x + 1] = COL[c]
    ring = np.zeros_like(fill)
    ring[1:] |= fill[:-1]; ring[:-1] |= fill[1:]; ring[:, 1:] |= fill[:, :-1]; ring[:, :-1] |= fill[:, 1:]
    ring &= ~fill
    out = np.zeros(fill.shape + (4,), np.uint8); out[fill, :3] = col[fill]; out[fill, 3] = 255; out[ring] = (*COL['O'], 255)
    ys, xs = np.nonzero(out[..., 3] > 0); return out[ys.min():ys.max() + 1, xs.min():xs.max() + 1], (int(xs.min()), int(ys.min()))

def fist_of(g, cells):
    """拳の塗り座標（x,y の組）から、輪郭つきの手部品と、body 画像内の位置を返す。body 側の拳は残す"""
    h = len(g); w = max(CW, max(len(r) for r in g)); body, (ox, oy) = to_rgba(g)
    xs = [c[0] for c in cells]; ys = [c[1] for c in cells]
    x0, x1, y0, y1 = min(xs) + 1 - ox, max(xs) + 1 - ox, min(ys) + 1 - oy, max(ys) + 1 - oy
    x0 -= 1; y0 -= 1; x1 += 1; y1 += 1                                            # 輪郭ぶん
    x0 = max(x0, 0); y0 = max(y0, 0); x1 = min(x1, body.shape[1] - 1); y1 = min(y1, body.shape[0] - 1)
    hand = body[y0:y1 + 1, x0:x1 + 1].copy()
    return hand, [int(x0), int(y0)]

def build_s(J, ent, save, write_pose):
    base = ent('idle', 'S'); WS = 0.5
    def emit(pose, g, fist, **over):
        body, _ = to_rgba(g); hand, hp = fist_of(g, fist)
        # 手部品は、拳の塗りと拳の輪郭だけを残す
        write_pose(J, pose, 'S', body, base, hand, hp, gripAngle=over.pop('gripAngle', 20), weaponScale=WS, refoot=True, faceBottom=12, weaponLayer='back', whole=True, **over)
        return body
    head = head_variant('idle')
    # 待機
    g = compose(head, BODY); emit('idle', g, [(15, 16), (16, 16), (15, 17), (16, 17)])
    # 攻撃：右手を前へ・足を開く
    g = compose(head, BODY)
    for x, y in ((18, 13), (19, 13), (18, 14), (19, 14)): setpx(g, x, y, 'G')
    for x, y in ((16, 13), (17, 13), (16, 14), (17, 14)): setpx(g, x, y, 'U')
    for y in (16, 17): setpx(g, 15, y, 'U'); setpx(g, 16, y, 'C')
    g[20] = list('.....UUU.......UUU....')
    g[21] = list('....UUU.........UUU...'); g[22] = list('...UUU...........UUU..')
    g[23] = list('..TTTT...........TTTT.'); g[24] = list('..TTTT...........TTTT.'); g[25] = list('..HHHH...........HHHH.')
    emit('attack', g, [(18, 13), (19, 13), (18, 14), (19, 14)], gripAngle=135)
    # 勝利：右手を高く上げる・ハの口
    g = compose(head_variant('win'), BODY)
    for y in range(7, 13): setpx(g, 19, y, 'U'); setpx(g, 20, y, 'U')
    for y in (13, 14): setpx(g, 17, y, 'U'); setpx(g, 18, y, 'U')
    for x, y in ((19, 4), (20, 4), (19, 5), (20, 5), (19, 6), (20, 6)): setpx(g, x, y, 'G')
    for y in (16, 17): setpx(g, 15, y, 'U'); setpx(g, 16, y, 'C')
    emit('win', g, [(19, 4), (20, 4), (19, 5), (20, 5), (19, 6), (20, 6)], gripAngle=10)
    # 歩き：片足を1行上げる（左右交互）。体も1行沈む／戻る
    for pose, lift in (('walk', 'L'), ('walk2', 'R')):
        g = compose(head, BODY)
        # 左右どちらかの脚（x 7〜10 / 12〜15）の脚・靴を1行上げて、最下行を空ける
        cols = range(7, 11) if lift == 'L' else range(12, 16)
        for x in cols:
            for yy in range(20, 25): g[yy][x] = g[yy + 1][x] if g[yy + 1][x] != '.' else g[yy][x]
            g[25][x] = '.'
        emit(pose, g, [(15, 16), (16, 16), (15, 17), (16, 17)], gripAngle=20)
    # 構え前（windup）：右手を後ろ上へ引く（勝利の腕で、普通の顔）。剣は後ろへ倒す
    g = compose(head, BODY)
    for y in range(7, 13): setpx(g, 19, y, 'U'); setpx(g, 20, y, 'U')
    for y in (13, 14): setpx(g, 17, y, 'U'); setpx(g, 18, y, 'U')
    for x, y in ((19, 4), (20, 4), (19, 5), (20, 5), (19, 6), (20, 6)): setpx(g, x, y, 'G')
    for y in (16, 17): setpx(g, 15, y, 'U'); setpx(g, 16, y, 'C')
    emit('windup', g, [(19, 4), (20, 4), (19, 5), (20, 5), (19, 6), (20, 6)], gripAngle=-40)
    # 防御：膝を曲げて2行低く、右の拳を胸の前へ。剣は立てる
    g = compose(head, BODY)
    for y in (16, 17): setpx(g, 15, y, 'U'); setpx(g, 16, y, 'C')
    for x, y in ((16, 14), (17, 14), (16, 15), (17, 15)): setpx(g, x, y, 'G')
    del g[22]; del g[19]
    emit('guard', g, [(16, 14), (17, 14), (16, 15), (17, 15)], gripAngle=5)
    # 被弾：>< の顔。体を後ろへ（上ほど左へ）傾ける
    g = compose(head_variant('hit'), BODY)
    sh = [-2 if y < 8 else -1 if y < 16 else 0 for y in range(len(g))]
    g3 = []
    for y, r in enumerate(g):
        r = list(r) + ['.'] * (CW - len(r)); g3.append((['.'] * (2 + sh[y]) + r)[:CW + 2])
    emit('hit', g3, [(15 + sh[16] + 2, 16), (16 + sh[16] + 2, 16), (15 + sh[17] + 2, 17), (16 + sh[17] + 2, 17)], gripAngle=105)
