# 修正指示書08 画面実物の確認（全12職・顔4種・衣装 通常/master/alt1）。python rpg/tools/fix08_screens_jobs.py [port]
# 出力: rpg/shots/fix08_jobs/screens_*.png と screens_result.json。headless Chromium 390x700（DPR2）、実部品。送信は遮断。
import sys, os, io, json, threading, http.server, socketserver, functools
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18437
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_jobs')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1&devcheck=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'postgame.json'), encoding='utf-8').read()
JOBS = ['warrior', 'mage', 'priest', 'thief', 'magicknight', 'paladin', 'shadow', 'sage', 'ninja', 'ranger', 'skyknight', 'starseer']
FONT = ImageFont.truetype('C:/Windows/Fonts/meiryo.ttc', 13)
R = {'console': [], 'checks': {}}
def blk(r): r.abort()
def tile(img, label, k=0.5):
    im = Image.open(io.BytesIO(img)).convert('RGB'); im = im.resize((int(im.width * k), int(im.height * k)), Image.LANCZOS)
    cv = Image.new('RGB', (im.width, im.height + 18), (24, 28, 48)); cv.paste(im, (0, 18)); ImageDraw.Draw(cv).text((3, 0), label, fill=(255, 255, 255), font=FONT); return cv
def sheet(tiles, n, name):
    w = max(t.width for t in tiles); h = max(t.height for t in tiles); rows = (len(tiles) + n - 1) // n
    cv = Image.new('RGB', (w * n + 4 * (n + 1), h * rows + 4 * (rows + 1)), (24, 28, 48))
    for i, t in enumerate(tiles): cv.paste(t, (4 + (i % n) * (w + 4), 4 + (i // n) * (h + 4)))
    cv.save(os.path.join(OUT, name)); return name
SETUP = """([job, face, hair, outfit]) => { const s = RPG.save; Object.keys(s.jobXp).forEach(k => { s.jobXp[k] = 2000000; });
  if (!s.progress.clearedRegions.includes('icevolcano')) s.progress.clearedRegions.push('icevolcano');
  s.job = job; s.look = Object.assign({}, s.look, { face: face, hair: hair, outfit: outfit }); }"""
HOPT = "() => [...document.querySelectorAll('canvas[data-hero]')].map(c => Object.assign({k: Object.keys(JSON.parse(c.dataset.hero)).join(',')}, JSON.parse(c.dataset.hero).look || {}, {job: JSON.parse(c.dataset.hero).job}))"
HOPT_OLD = "() => [...document.querySelectorAll('canvas[data-hero]')].map(c => JSON.parse(c.dataset.hero)).map(o => ({job: o.job, costume: o.costume || null, face: o.look && o.look.face, hair: o.look && o.look.hairStyle, skin: o.look && o.look.skin, hc: o.look && o.look.hair}))"
with sync_playwright() as p:
    b = p.chromium.launch(headless=not os.environ.get('HEADED'))
    ctx = b.new_context(viewport={'width': 390, 'height': 700}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type == 'error' else None); pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}'))
    pg.route('**/script.google.com/**', blk)
    pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("(t) => { const s = JSON.parse(t); s.firstDone = true; localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", SAVE0)
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(500)
    def setup(job, face=0, hair=0, outfit=None): pg.evaluate(SETUP, [job, face, hair, outfit])
    def go(name, prm=None): pg.evaluate("([n, p]) => RPG.go(n, p || {})", [name, prm]); pg.wait_for_timeout(450)
    def shot(): return pg.screenshot()
    def hero_opts(): return pg.evaluate(HOPT)
    def dev(): return pg.evaluate("() => { const d = RPG.devReport(); return { missing: d.missing.length, whole: d.whole.length, layered: d.layered.length } }")
    setup('warrior', 2, 3, None); tiles = []
    for tier in ('base', 'adv', 'top'):
        go('jobs'); pg.evaluate("(t) => document.querySelector('[data-tier=' + t + ']').click()", tier); pg.wait_for_timeout(500); tiles.append(tile(shot(), '転職一覧 ' + tier))
    sheet(tiles, 3, 'screens_jobs_list.png'); tiles = []
    for j in JOBS:
        go('jobdetail', {'job': j}); tiles.append(tile(shot(), '転職詳細 ' + j, 0.42))
    sheet(tiles, 6, 'screens_jobdetail_12.png')
    for scr, nm in (('me', '自分'), ('equip', '装備')):
        tiles = []
        for j in JOBS:
            setup(j, 1, 2, None); go(scr); tiles.append(tile(shot(), f'{nm} {j}', 0.42))
        sheet(tiles, 6, f'screens_{scr}_12.png')
    tiles = []
    for f in range(4):
        setup('warrior', f, 1, None); go('look'); tiles.append(tile(shot(), f'外見 顔{f + 1}', 0.5))
    for o in (None, 'master', 'alt1'):
        setup('paladin', 0, 0, o); go('look'); R['checks']['look_paladin_' + str(o)] = hero_opts(); tiles.append(tile(shot(), f'外見 聖騎士 {o or "通常"}', 0.5))
    sheet(tiles, 4, 'screens_look.png'); tiles = []
    for o in (None, 'master', 'alt1'):
        for j in JOBS:
            setup(j, 3, 4, o); go('me'); tiles.append(tile(shot(), f'自分 {j} {o or "通常"}', 0.34))
    sheet(tiles, 6, 'screens_costumes_me.png')
    setup('sage', 1, 5, 'master'); tiles = []
    for scr in ('codex', 'ending', 'memorial', 'adv'):
        go(scr); pg.wait_for_timeout(600); tiles.append(tile(shot(), scr, 0.5))
    sheet(tiles, 4, 'screens_codex_ending.png'); R['checks']['dev'] = dev()
    seq = []; looks = []
    setup('warrior', 0, 0, None); go('look')
    for key, v in (('face', 3), ('hair', 4), ('skin', 2), ('hairColor', 1)): pg.click(f'[data-lk={key}][data-v="{v}"]')
    pg.wait_for_timeout(300); pg.click('#lookOk'); pg.wait_for_timeout(400); seq.append(tile(shot(), '1 外見(顔4・髪5)を決定', 0.5)); looks.append(hero_opts()[:1])
    go('jobdetail', {'job': 'mage'}); seq.append(tile(shot(), '2 魔法使いの転職詳細', 0.5)); looks.append(hero_opts()[:1])
    ids = pg.evaluate("() => [...document.querySelectorAll('button')].map(b => b.id || b.dataset.act || b.textContent.trim()).slice(0, 30)"); R['checks']['jobdetail_buttons'] = ids
    btn = pg.query_selector('#jobDo')
    if btn: btn.click(); pg.wait_for_timeout(600)
    seq.append(tile(shot(), '3 転職後', 0.5)); R['checks']['c05_job_after'] = pg.evaluate("() => RPG.save.job"); looks.append(hero_opts()[:1])
    go('equip'); seq.append(tile(shot(), '4 装備画面', 0.5)); looks.append(hero_opts()[:1])
    pg.wait_for_timeout(500); picked = pg.evaluate("() => { const e = document.querySelector('[data-eq]:not(.on)') || document.querySelector('[data-eq]'); if (e) e.click(); return !!e; }")
    if picked: pg.wait_for_timeout(300); seq.append(tile(shot(), '5 武器を選ぶ', 0.5)); looks.append(hero_opts()[:1])
    pg.evaluate("() => { const e = document.getElementById('eqOk'); if (e && !e.disabled) e.click(); }"); pg.wait_for_timeout(400)
    go('me'); seq.append(tile(shot(), '6 自分', 0.5)); looks.append(hero_opts()[:1])
    sheet(seq, 6, 'screens_c05_flow.png'); R['checks']['c05_looks'] = looks; R['checks']['c05_save_look'] = pg.evaluate("() => RPG.save.look")
    R['dev_final'] = dev(); b.close()
json.dump(R, open(os.path.join(OUT, 'screens_result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'console': R['console'][:5], 'dev': R['dev_final'], 'c05': R['checks'].get('c05_looks'), 'job': R['checks'].get('c05_job_after'), 'look': R['checks'].get('c05_save_look'), 'btn': R['checks'].get('jobdetail_buttons')}, ensure_ascii=False))
