# ホーム画面アイコンを作る（息子用＝RPG主人公（戦士）の顔のドット絵／ママ用＝ノートとチェック）。python tools/make_icons.py
# 出力：icons/kid-{180,192,512}.png・kid.svg、icons/mama-{180,192,512}.png・mama.svg
import os, base64, io
from PIL import Image, ImageDraw
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..')); OUT = os.path.join(ROOT, 'icons'); os.makedirs(OUT, exist_ok=True)
def kid(sz):
    hero = Image.open(os.path.join(ROOT, 'rpg', 'assets', 'chars', 'hero_warrior.png')).convert('RGBA').crop((20, 2, 70, 52))
    base = Image.new('RGBA', (64, 64), (16, 26, 62, 255)); d = ImageDraw.Draw(base)
    for y in range(64): d.line([(0, y), (63, y)], fill=(16 + y // 6, 26 + y // 5, 62 + y // 3, 255))   # 濃紺の縦グラデ
    d.rectangle([1, 1, 62, 62], outline=(212, 175, 90, 255)); d.rectangle([3, 3, 60, 60], outline=(138, 112, 54, 255))   # 金の二重枠（ゲームの画面と同じ）
    base.alpha_composite(hero.resize((50, 50), Image.NEAREST), (7, 8))
    return base.resize((sz, sz), Image.NEAREST)
def mama(sz):
    # 落ち着いた絵柄：生成り地に、緑のノートと白いチェック（64マスのドットで描いて拡大）
    im = Image.new('RGBA', (64, 64), (246, 241, 230, 255)); d = ImageDraw.Draw(im)
    d.rectangle([14, 8, 52, 56], fill=(70, 120, 98, 255))            # 表紙
    d.rectangle([14, 8, 52, 56], outline=(44, 84, 66, 255))
    d.rectangle([19, 8, 22, 56], fill=(44, 84, 66, 255))             # 背
    d.rectangle([26, 14, 48, 50], fill=(252, 249, 240, 255))         # 紙
    for y in (22, 30, 38): d.rectangle([29, y, 45, y], fill=(190, 182, 160, 255))   # 罫線
    ck = [(30, 18), (31, 19), (32, 20), (33, 19), (34, 18), (35, 17), (36, 16), (37, 15), (38, 14)]   # チェック
    for x, y in [(29, 44), (30, 45), (31, 46), (32, 45), (33, 44), (34, 43), (35, 42), (36, 41), (37, 40), (38, 39)]:
        d.rectangle([x, y, x + 1, y + 1], fill=(226, 128, 58, 255))
    return im.resize((sz, sz), Image.NEAREST)
for name, fn in (('kid', kid), ('mama', mama)):
    for sz in (180, 192, 512):
        fn(sz).convert('RGB').save(os.path.join(OUT, f'{name}-{sz}.png'))
    buf = io.BytesIO(); fn(64).convert('RGB').save(buf, 'PNG'); b64 = base64.b64encode(buf.getvalue()).decode()
    open(os.path.join(OUT, f'{name}.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><image href="data:image/png;base64,{b64}" width="64" height="64" style="image-rendering:pixelated"/></svg>')
print('ok')
