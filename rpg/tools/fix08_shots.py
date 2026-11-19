# 修正指示書08 戦士の新旧比較画像と比率の実測。python rpg/tools/fix08_shots.py
# 出力: rpg/shots/fix08_warrior/（compare_L.png / compare_S_strip.png / weapons.png / poses.png / ratios.json）
# 旧 = 修正前（コミット 706a192 の親）の部品（rpg/assets/parts）。新 = 作業ツリー。描画は実物の rpg-sprites.js（drawHeroLayered）を headless Chromium で動かす。
import os, sys, io, json, subprocess, threading, http.server, socketserver, base64, tarfile, tempfile
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_warrior'); os.makedirs(OUT, exist_ok=True)
OLD = tempfile.mkdtemp(prefix='fix08_old_')
tar = subprocess.run(['git', '-C', ROOT, 'archive', os.environ.get('OLD_REF', '706a192~1'), 'rpg/assets/parts'], capture_output=True, check=True).stdout
tarfile.open(fileobj=io.BytesIO(tar)).extractall(OLD)
OLD_PARTS = os.path.join(OLD, 'rpg', 'assets', 'parts')
HTML = b'''<!doctype html><meta charset=utf-8><body style="margin:0"><script src="/rpg/js/rpg-sprites.js"></script><script>
const SP = RPGSprites; let up = 0; SP.onUpdate(() => up++);
const ready = fetch('/rpg/ASSET_MANIFEST.json').then(r => r.json()).then(m => { const a = {}; m.assets.filter(x => x.status === '\xe6\xad\xa3\xe5\xbc\x8f').forEach(x => a[x.id] = x); SP.loadImages(a); SP.loadParts('rpg/assets/parts/'); });
// spec: {w,h,bg:'town'|'strip'|'none', scale, items:[{kind:'hero',x,y,o}|{kind:'enemy',id,x,y,scale}], strip:true}
async function render(spec) {
  await ready;
  const c = document.createElement('canvas'); c.width = spec.w; c.height = spec.h; const g = c.getContext('2d');
  for (let t = 0; t < 80; t++) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, spec.w, spec.h); let wait = false;
    if (spec.bg === 'town') { const bg = SP.IMGS.bg_town; if (!bg) wait = true; else { const sc = Math.max(spec.w / bg.width, spec.h / bg.height), dw = bg.width * sc, dh = bg.height * sc; g.imageSmoothingEnabled = false; g.drawImage(bg, (spec.w - dw) / 2, (spec.h - dh) * 0.62, dw, dh); } }
    if (spec.bg === 'color') { g.fillStyle = spec.color || '#2a3f7a'; g.fillRect(0, 0, spec.w, spec.h); }
    if (spec.strip) { g.setTransform(2, 0, 0, 2, 0, 0); const W = Math.ceil(spec.w / 2), H = Math.round(spec.h / 2); SP.drawBackground(g, W, H, 'meadow', 'strip'); g.fillStyle = 'rgba(226,232,248,.36)'; g.fillRect(0, 0, W, H); }
    for (const it of spec.items) {
      if (it.kind === 'hero') { const r = SP.drawHeroLayered(g, Object.assign({ job: 'warrior', look: { face: 0, hairStyle: 0, skin: '#f0c39a', hair: '#7a4a2a' }, scale: 1, use: spec.strip ? 'strip' : 'self' }, it.o, { x: it.x, groundY: it.y })); if (r === 'wait') wait = true; if (r === 'whole' || r === 'missing') window.__mode = r; }
      else if (it.kind === 'enemy') { if (!SP.IMGS['enemy_' + it.id + '_strip']) wait = true; else SP.drawEnemy(g, it.id, false, it.x, it.y, { img: 'strip', outline: '#141a3c', scale: it.scale || 1 }); }
    }
    if (!wait) return c.toDataURL('image/png');
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('timeout ' + JSON.stringify(spec).slice(0, 200));
}
</script>'''
class H(http.server.SimpleHTTPRequestHandler):
    old = False
    def log_message(self, *a): pass
    def do_GET(self):
        if self.path.split('?')[0] == '/__h.html':
            self.send_response(200); self.send_header('Content-Type', 'text/html'); self.end_headers(); self.wfile.write(HTML); return
        super().do_GET()
    def translate_path(self, path):
        p = path.split('?')[0]
        if self.old and p.startswith('/rpg/assets/parts/'): return os.path.join(OLD_PARTS, p[len('/rpg/assets/parts/'):].replace('/', os.sep))
        return super().translate_path(path)
def serve(port, old):
    cls = type('H' + str(port), (H,), {'old': old, 'directory': ROOT})
    def init(self, *a, **k): http.server.SimpleHTTPRequestHandler.__init__(self, *a, directory=ROOT, **k)
    cls.__init__ = init
    class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
    s = TS(('127.0.0.1', port), cls); threading.Thread(target=s.serve_forever, daemon=True).start(); return s
serve(18471, False); serve(18472, True)
FONT = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 14)
def pil(durl): return Image.open(io.BytesIO(base64.b64decode(durl.split(',')[1]))).convert('RGBA')
def up(im, k): return im.resize((im.width * k, im.height * k), Image.NEAREST)
def labeled(im, text):
    cv = Image.new('RGBA', (im.width, im.height + 20), (24, 28, 48, 255)); cv.alpha_composite(im, (0, 20)); ImageDraw.Draw(cv).text((4, 1), text, fill=(255, 255, 255), font=FONT); return cv
def hstack(ims, gap=8, bg=(24, 28, 48, 255)):
    cv = Image.new('RGBA', (sum(i.width for i in ims) + gap * (len(ims) + 1), max(i.height for i in ims) + gap * 2), bg); x = gap
    for i in ims: cv.alpha_composite(i, (x, gap)); x += i.width + gap
    return cv
def vstack(ims, gap=8, bg=(24, 28, 48, 255)):
    cv = Image.new('RGBA', (max(i.width for i in ims) + gap * 2, sum(i.height for i in ims) + gap * (len(ims) + 1)), bg); y = gap
    for i in ims: cv.alpha_composite(i, (gap, y)); y += i.height + gap
    return cv
res = {}
with sync_playwright() as pw:
    br = pw.chromium.launch(headless=True)
    pages = {}
    for name, port in (('new', 18471), ('old', 18472)):
        pg = br.new_page(viewport={'width': 800, 'height': 600}); errs = []
        pg.on('console', lambda m, errs=errs: errs.append(m.text) if m.type == 'error' else None); pg.on('pageerror', lambda e, errs=errs: errs.append(str(e)))
        pg.goto(f'http://127.0.0.1:{port}/__h.html'); pages[name] = (pg, errs)
    def R(name, spec): return pil(pages[name][0].evaluate('s => render(s)', spec))
    # --- L: ホーム相当（旧=青銅の剣、新=木の剣。実際のゲームの初期状態と同じ）
    Lw = {'old': 'w_sword_1', 'new': 'w_start'}
    L1 = {n: R(n, {'w': 150, 'h': 130, 'bg': 'town', 'items': [{'kind': 'hero', 'x': 70, 'y': 122, 'o': {'pose': 'idle', 'use': 'home', 'weaponId': Lw[n]}}]}) for n in ('old', 'new')}
    row1 = hstack([labeled(L1['old'], '旧 実寸1倍'), labeled(L1['new'], '新 実寸1倍')])
    row2 = hstack([labeled(up(L1['old'], 2), '旧 2倍（ホームの表示）'), labeled(up(L1['new'], 2), '新 2倍（ホームの表示）')])
    vstack([row1, row2]).convert('RGB').save(os.path.join(OUT, 'compare_L.png'))
    # --- S: 帯と同じ背景・実寸（390x44 CSS px、論理1ドット=2px、主人公は1ドット=1px）
    strips = {}
    for n in ('old', 'new'):
        items = [{'kind': 'enemy', 'id': 'e_acornsoldier', 'x': 97 - 7, 'y': 21, 'scale': 1}, {'kind': 'hero', 'x': 60, 'y': 21, 'o': {'pose': 'idle', 'use': 'strip', 'weaponId': 'w_sword_1', 'outline': '#141a3c'}}]
        strips[n] = R(n, {'w': 390, 'h': 44, 'strip': True, 'bg': 'none', 'items': items})
    z = lambda im: up(im.crop((60, 0, 300, 44)), 3)
    vstack([labeled(strips['old'], '旧 帯 実寸1倍(390x44)'), labeled(strips['new'], '新 帯 実寸1倍(390x44)'), labeled(z(strips['old']), '旧 3倍（左240px）'), labeled(z(strips['new']), '新 3倍（左240px）')]).convert('RGB').save(os.path.join(OUT, 'compare_S_strip.png'))
    # --- 武器3種の手持ち（店アイコンと並べる）
    W3 = [('w_start', '初期武器 木の剣'), ('w_sword_1', '青銅の剣'), ('w_sword_2', '鉄の剣')]
    icons = {w: Image.open(os.path.join(ROOT, 'rpg', 'assets', 'icons', w + '.png')).convert('RGBA') for w, _ in W3}
    def wrow(which, k, pose):
        cells = []
        for (w, nm), w2 in zip(W3, ('w_sword_1', 'w_sword_1', 'w_sword_2') if which == 'old' else [x[0] for x in W3]):
            h = R(which, {'w': 150, 'h': 112, 'bg': 'color', 'color': '#e8eefc', 'items': [{'kind': 'hero', 'x': 60, 'y': 106, 'o': {'pose': pose, 'use': 'self', 'weaponId': w2}}]})
            ic = Image.new('RGBA', (32, 32), (232, 238, 252, 255)); ic.alpha_composite(icons[w])
            cells.append(labeled(hstack([up(h, k), up(ic, k)], gap=4, bg=(232, 238, 252, 255)), nm))
        return hstack(cells)
    def srow(which, k):
        cells = []
        for w, nm in W3:
            h = R(which, {'w': 44, 'h': 36, 'bg': 'color', 'color': '#a8c8a0', 'items': [{'kind': 'hero', 'x': 18, 'y': 33, 'o': {'pose': 'idle', 'use': 'strip', 'weaponId': w, 'outline': '#141a3c'}}]})
            cells.append(labeled(up(h, k), nm + ' (S)'))
        return hstack(cells)
    vstack([labeled(wrow('old', 3, 'idle'), '旧（初期武器は青銅の剣の絵に置き換わっていた。左のアイコンは店の絵）'), labeled(wrow('new', 3, 'idle'), '新 L 待機'), labeled(wrow('new', 3, 'attack'), '新 L 攻撃'), labeled(srow('new', 6), '新 S 待機')]).convert('RGB').save(os.path.join(OUT, 'weapons.png'))
    # --- ポーズ一覧（新）
    LP = ['idle', 'ready', 'attack', 'guard', 'win', 'hit']; SPS = ['idle', 'walk', 'walk2', 'windup', 'attack', 'guard', 'win', 'hit']
    lcells = [labeled(up(R('new', {'w': 128, 'h': 112, 'bg': 'color', 'color': '#e8eefc', 'items': [{'kind': 'hero', 'x': 50, 'y': 106, 'o': {'pose': p, 'use': 'self', 'weaponId': 'w_sword_1'}}]}), 2), 'L ' + p) for p in LP]
    scells = [labeled(up(R('new', {'w': 44, 'h': 36, 'bg': 'color', 'color': '#a8c8a0', 'items': [{'kind': 'hero', 'x': 18, 'y': 33, 'o': {'pose': p, 'use': 'strip', 'weaponId': 'w_sword_1', 'outline': '#141a3c'}}]}), 5), 'S ' + p) for p in SPS]
    vstack([hstack(lcells), hstack(scells[:4]), hstack(scells[4:])]).convert('RGB').save(os.path.join(OUT, 'poses.png'))
    # --- 実測用（武器なし・透明背景）
    ms = {}
    for size, use, pose in (('L', 'self', 'idle'), ('S', 'strip', 'idle')):
        im = R('new', {'w': 140, 'h': 130, 'bg': 'none', 'items': [{'kind': 'hero', 'x': 70, 'y': 120, 'o': {'pose': pose, 'use': use, 'weaponId': None}}]}); ms[size] = np.array(im)
    errs = {k: v[1] for k, v in pages.items()}
    br.close()
def bbox(a): ys, xs = np.nonzero(a[..., 3] > 0); return xs.min(), ys.min(), xs.max(), ys.max()
def head_dims(name):
    a = np.array(Image.open(os.path.join(ROOT, 'rpg', 'assets', 'parts', name)).convert('RGBA')); op = a[..., 3] > 0
    ys, xs = np.nonzero(op); h = ys.max() - ys.min() + 1; w = xs.max() - xs.min() + 1
    widths = op.sum(1); neck = widths[-1]
    # あご＝下から見て、行の幅が首の幅の2倍を超える最初の行の次
    chin = next((y for y in range(op.shape[0] - 1, -1, -1) if widths[y] > max(neck * 2, neck + 4)), op.shape[0] - 1)
    return int(w), int(h), int(chin - ys.min() + 1)
def torso_width(file, row_from_neck):
    import json as _j
    pj = _j.load(open(os.path.join(ROOT, 'rpg', 'assets', 'parts', 'parts.json'), encoding='utf-8'))
    key = file.replace('body_', '').replace('.png', ''); ny = int(pj['body'][key]['neck'][1]); a = np.array(Image.open(os.path.join(ROOT, 'rpg', 'assets', 'parts', file)).convert('RGBA'))
    row = a[ny + row_from_neck]; op = row[:, 3] > 0
    cape = op & (row[:, 0] > 200) & (row[:, 1] > 170) & (row[:, 2] > 120) & (row[:, 2] < 220)   # ベージュのマント
    keep = op & ~cape; xs = np.nonzero(keep)[0]
    # 最大の連続区間（胴＋両腕）
    runs = []; s = None
    for x in range(len(keep) + 1):
        if x < len(keep) and keep[x]:
            s = x if s is None else s
        elif s is not None: runs.append((s, x - 1)); s = None
    r = max(runs, key=lambda r: r[1] - r[0]) if runs else (0, 0); return int(r[1] - r[0] + 1)
for size, a in ms.items():
    x0, y0, x1, y1 = bbox(a); total = int(y1 - y0 + 1)
    hw, hh, chin = head_dims('head_v2_f0_h0_L.png' if size == 'L' else 'head_v2_h0_S.png')
    res[size] = {'全高_髪の上〜足裏(px)': total, '頭部高_髪の上〜あご(px)': chin, '全高÷頭部高': round(total / chin, 3), '頭幅(px)': hw, '頭幅/全高': round(hw / total, 3), '全体の幅(マント込み)': int(x1 - x0 + 1)}
    if size == 'L':
        bd = np.array(Image.open(os.path.join(ROOT, 'rpg', 'assets', 'parts', 'body_warrior_idle_L.png')).convert('RGBA')).astype(int)
        blue = (bd[..., 2] > bd[..., 0] + 50) & (bd[..., 2] > bd[..., 1] + 10) & (bd[..., 3] > 0)
        spans = [(np.nonzero(blue[y])[0].min(), np.nonzero(blue[y])[0].max()) for y in range(50, 60) if blue[y].any()]
        jw = max(b_ - a_ + 1 for a_, b_ in spans); tw = torso_width('body_warrior_idle_L.png', 8)
        res[size]['胴(青い上着)の最大幅'] = int(jw); res[size]['胴の幅/頭幅'] = round(jw / hw, 3)
        res[size]['肩の飾り・縁取りを足した胴幅(上着+4px)'] = int(jw + 4); res[size]['同/頭幅'] = round((jw + 4) / hw, 3)
        res[size]['腕と拳を含む最大幅(マント除く)'] = tw; res[size]['同/頭幅 '] = round(tw / hw, 3)
res['errors'] = errs
json.dump(res, open(os.path.join(OUT, 'ratios.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(res, ensure_ascii=False, indent=1))
