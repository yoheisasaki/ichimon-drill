# 冒険帯S（44px帯・人物約28px）の職ごとの特徴。大表示（L）の代表的な要素を小型専用に描き足す（単色の人型にしない）。
# 呼び出し元: parts_body_v3b_all.py の build_s。体は22文字幅（体の列c＝文字位置 c+3）。使う記号（色は STYLE から）:
#   U 胴 V 影 Y 金具/飾り T 靴/ベルト D 襟/スカーフ L 脚/すそ K ベルト C 素肌の腕 G 手 W 白 A 胴の明るい面 P マント S 副色 E 宝石/輪 N 濃紺
def lighten(c, f): return tuple(int(v + (255 - v) * f) for v in c)
def darken(c, f): return tuple(int(v * (1 - f)) for v in c)

def apply(job, rows, st, COL):
    """rows: 16文字幅の体の行（14行）。22文字幅の行（str）を返し、COL に A/P/S の色を足す"""
    g = [list('...' + r + '...') for r in rows]
    def px(r, c, ch):
        if 0 <= r < len(g) and 0 <= c + 3 < len(g[r]): g[r][c + 3] = ch
    def fill(r, c0, c1, ch):
        for c in range(c0, c1 + 1): px(r, c, ch)
    def sleeves(ch):   # 腕（素肌C）を袖の色に。手（G）は残す
        for r in range(2, 7):
            for c in (0, 1, 14, 15):
                if g[r][c + 3] == 'C': g[r][c + 3] = ch
    U, V = st['U'], st['V']
    COL['A'] = lighten(U, 0.35); COL['S'] = st.get('S', darken(U, 0.25)); COL['P'] = st.get('P', darken(U, 0.1))
    if job in ('warrior', 'paladin', 'magicknight', 'skyknight') or st.get('armor'):   # 肩当て（3幅）
        for r in (1, 2):
            fill(r, 1, 3, 'Y'); fill(r, 12, 14, 'Y')
    f = FEAT.get(job)
    if f: f(g, px, fill, sleeves, st, COL)
    if 'A' in st: COL['A'] = st['A']
    if 'S' in st: COL['S'] = st['S']
    return [''.join(r) for r in g]

def f_warrior(g, px, fill, sleeves, st, COL):
    COL['A'] = (178, 190, 214); COL['P'] = (214, 170, 110)       # 胸当て（鋼）・短いマント（生成り）
    fill(3, 5, 10, 'A'); fill(4, 5, 10, 'A'); fill(5, 6, 9, 'A')
    for r in range(2, 10): px(r, -1, 'P')
    for r in range(4, 9): px(r, -2, 'P')
def f_mage(g, px, fill, sleeves, st, COL):
    COL['P'] = (250, 249, 246)
    sleeves('V'); fill(1, 3, 12, 'D'); fill(0, 4, 11, 'D'); fill(2, 5, 10, 'D')       # 白い襟（広い）
    fill(10, 3, 12, 'Y')                                          # 金のすそ
def f_priest(g, px, fill, sleeves, st, COL):
    sleeves('U'); fill(1, 3, 12, 'D'); fill(2, 5, 10, 'D')       # 青いスカーフ
    px(3, 7, 'Y'); px(3, 8, 'Y'); fill(4, 6, 9, 'Y'); px(5, 7, 'Y'); px(5, 8, 'Y')   # 金の十字
    fill(10, 3, 12, 'K')                                           # 青いすそ
def f_thief(g, px, fill, sleeves, st, COL):
    sleeves('V'); fill(0, 3, 12, 'D'); fill(1, 2, 13, 'D')         # 茶色の大きな襟巻き
    for i in range(5): px(3 + i, 5 + i, 'Y')                       # 肩から斜めの革帯
def f_magicknight(g, px, fill, sleeves, st, COL):
    COL['A'] = (250, 249, 246)
    fill(1, 3, 12, 'D'); fill(1, 12, 13, 'U')                      # 白いスカーフ・右肩は飾り無し
    fill(3, 5, 10, 'U'); px(4, 7, 'Y'); px(4, 8, 'Y')
    for r in range(3, 9): px(r, -1, 'P')                           # 赤いマント（体の色の暗色）
    COL['P'] = darken(st['U'], 0.25)
def f_paladin(g, px, fill, sleeves, st, COL):
    COL['A'] = (250, 249, 246); COL['S'] = (47, 102, 194)
    fill(3, 6, 9, 'A'); fill(4, 6, 9, 'A'); fill(5, 6, 9, 'A')     # 白い鎧の胸
    px(3, 7, 'S'); px(3, 8, 'S'); fill(4, 6, 9, 'S'); px(5, 7, 'S'); px(5, 8, 'S')   # 青い十字
    for r in range(7, 11): fill(r, 5, 10, 'A')                     # 白いすそ（タバード）
    fill(7, 5, 10, 'S') if False else None
    for r in range(7, 11): px(r, 5, 'S'); px(r, 10, 'S')
def f_shadow(g, px, fill, sleeves, st, COL):
    sleeves('V'); fill(0, 4, 11, 'D'); fill(1, 4, 11, 'D')         # 口元を覆う襟
    for i in range(5): px(3 + i, 10 - i, 'Y')                      # 灰色の胸の帯（斜め）
    COL['A'] = lighten(U_of(st), 0.2)
def U_of(st): return st['U']
def f_sage(g, px, fill, sleeves, st, COL):
    sleeves('U'); fill(1, 3, 12, 'D'); fill(0, 4, 11, 'D'); fill(2, 5, 10, 'D')         # 青いスカーフ
    fill(10, 3, 12, 'Y'); fill(6, 5, 10, 'K')                      # 金のすそ・帯
def f_ninja(g, px, fill, sleeves, st, COL):
    COL['A'] = (250, 249, 246)
    sleeves('V'); fill(6, 3, 12, 'A'); px(7, 12, 'A'); px(8, 12, 'A'); px(8, 13, 'A')   # 白い帯と垂れ
    px(5, 0, 'A'); px(5, 1, 'A'); px(5, 14, 'A'); px(5, 15, 'A')   # 手首の白い巻き布
    fill(8, 3, 12, 'V')                                            # だぼっとしたズボン
def f_ranger(g, px, fill, sleeves, st, COL):
    COL['P'] = (60, 140, 70); COL['A'] = (215, 190, 140)
    sleeves('V'); fill(3, 5, 10, 'A'); fill(4, 5, 10, 'A')         # 明るい胴着
    for r in range(2, 11): px(r, -1, 'P'); px(r, 16, 'P')          # 緑のマント（両側）
    for r in range(4, 10): px(r, -2, 'P'); px(r, 17, 'P')
def f_skyknight(g, px, fill, sleeves, st, COL):
    COL['A'] = (250, 249, 246); COL['P'] = (250, 249, 246)
    fill(3, 5, 10, 'A'); fill(4, 5, 10, 'A'); px(4, 7, 'E'); px(4, 8, 'E'); px(3, 7, 'E'); px(3, 8, 'E')   # 青い宝石の胸当て
    for r in range(1, 6): px(r, -1, 'P'); px(r, 16, 'P')           # 背中の白い翼
    for r in range(2, 5): px(r, -2, 'P'); px(r, 17, 'P')
def f_starseer(g, px, fill, sleeves, st, COL):
    sleeves('V'); fill(1, 3, 12, 'D'); fill(0, 4, 11, 'D'); fill(2, 5, 10, 'D')         # 金のスカーフ
    fill(10, 3, 12, 'Y')                                           # 金のすそ（星は1pxに潰れるので描かない）
FEAT = dict(warrior=f_warrior, mage=f_mage, priest=f_priest, thief=f_thief, magicknight=f_magicknight, paladin=f_paladin, shadow=f_shadow, sage=f_sage,
            ninja=f_ninja, ranger=f_ranger, skyknight=f_skyknight, starseer=f_starseer)
