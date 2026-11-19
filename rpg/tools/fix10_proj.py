# 08修正指示書 3章・4章（回答画面の冒険帯）の確認。python rpg/tools/fix08_strip.py   （headless chromium、390x700、nosend=1）
# 動きの瞬間は Playwright の clock（偽の時計）で時刻を止めて撮る。実時間の演出時間は fix08_natural.py（録画・自然な速度）で測る。
# 出力：rpg/shots/fix08_strip/ に 01_*.png（画面）・z_*.png（帯だけを2倍に拡大）と result.json
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18491
OUT = os.path.join(ROOT, 'rpg', 'shots', os.environ.get('OUT_NAME', 'fix10_band/proj')); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'checks': {}, 'measure': {}, 'console': []}
def chk(n, c, v=None): R['checks'][n] = bool(c) if v is None else {'ok': bool(c), 'v': v}; print(('OK  ' if c else 'NG  ') + n, '' if v is None else v, flush=True)
SAVEK = 'ichimon.rpg.v1'
READY = "() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766"

def ctx_new(b, reduced=False, h=700):
    c = b.new_context(viewport={'width': 390, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce' if reduced else 'no-preference')
    pg = c.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}'))
    pg.route('**/script.google.com/**', lambda r: r.abort())
    return c, pg
def freeze(pg):
    # 偽の時計を止める。以後は run_for(ms) の分だけ進む（スクリーンショットの間に時間が流れない）
    pg.clock.pause_at(pg.evaluate("() => Date.now()") + 300)
def boot(pg, seed=None, clock=True):
    if clock: pg.clock.install()
    pg.goto(URL); pg.wait_for_selector('#go'); pg.wait_for_function(READY, polling=100, timeout=90000)
    if seed:
        pg.evaluate("(js) => { const s = JSON.parse(localStorage.getItem('%s')); (new Function('s', js))(s); localStorage.setItem('%s', JSON.stringify(s)); }" % (SAVEK, SAVEK), seed)
        pg.reload(); pg.wait_for_selector('#go'); pg.wait_for_function(READY, polling=100, timeout=90000)
    if clock: pg.clock.run_for(600); freeze(pg)
def start(pg, flt=None):
    if flt:
        pg.click('.rs-range summary'); pg.click(f'.subj[data-f={flt}]'); pg.wait_for_selector('.rs-range[open]'); pg.click('#rsRangeX')
    pg.click('#go'); pg.wait_for_selector('.choice, #ans'); pg.clock.run_for(300)
def sv(pg): return pg.evaluate("() => JSON.parse(localStorage.getItem('%s'))" % SAVEK)
def info(pg): return pg.evaluate("() => RPG.stripInfo()")
def answer(pg, ok=True):
    if pg.query_selector('#ans'):
        pg.fill('#ans', pg.evaluate("() => S.cur.accept[0]") if ok else 'ぜったいにちがう'); pg.click('#submit'); return
    idx = pg.evaluate("() => S.opts.indexOf(S.cur.a)") if ok else pg.evaluate("() => S.opts.findIndex(o => o !== S.cur.a)")
    pg.click(f'.choice >> nth={idx}')
def nextq(pg):
    # 不正解のあとの「タップして つぎへ」を押す
    for _ in range(12):
        if pg.evaluate("() => { const n = document.getElementById('next'); return !!n && n.textContent.includes('つぎへ'); }"): pg.click('#next'); pg.clock.run_for(100); return True
        pg.clock.run_for(200)
    return False
def shot(pg, name, strip=False):
    pg.screenshot(path=os.path.join(OUT, name + '.png'))
    if strip:   # 帯の実寸（DPR2）を、ドットが分かるように整数倍（2倍）で拡大して保存
        pg.locator('.rpg-strip canvas').screenshot(path=os.path.join(OUT, '_t.png'))
        from PIL import Image
        im = Image.open(os.path.join(OUT, '_t.png')); im = im.resize((im.width * 2, im.height * 2), Image.NEAREST); im.save(os.path.join(OUT, 'z_' + name + '.png')); os.remove(os.path.join(OUT, '_t.png'))
def geom(pg):
    return pg.evaluate("""() => { const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return {t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height)}; };
      const ch = [...document.querySelectorAll('.choice')], last = ch[ch.length - 1];
      return {vw: innerWidth, vh: innerHeight, canvas: r(document.querySelector('.rpg-strip canvas')), box: r(document.querySelector('.rpg-strip')), lastChoice: r(last), skip: r(document.getElementById('skipc') || document.getElementById('skip')), submit: r(document.getElementById('submit')), map: r(document.getElementById('map')), score: r(document.querySelector('.score')), docH: document.documentElement.scrollHeight, sy: scrollY}; }""")


from PIL import Image
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for job, wid in (('mage', 'w_staff_1'), ('ranger', 'w_bow_1'), ('priest', 'w_staff_1')):
        c, pg = ctx_new(b)
        boot(pg, "s.job = '%s'; s.inv.items.%s = 1; s.equip.weapon = '%s'; s.jobXp.warrior = 6000; s.jobXp.mage = 6000; s.jobXp.priest = 6000; s.jobXp.thief = 6000; s.advXp = 3000;" % (job, wid, wid))
        start(pg); pg.clock.run_for(300)
        pg.evaluate("() => { const a = RPG.save.active.battle; a.enemy.hp = a.enemy.maxHp = 100; RPG.persist(); RPG.stripSync(); }"); pg.clock.run_for(1000)
        answer(pg, True); frames = []
        for t in range(9):
            pg.clock.run_for(45)
            pg.locator('.rpg-strip canvas').screenshot(path=os.path.join(OUT, '_t.png')); im = Image.open(os.path.join(OUT, '_t.png')).convert('RGB'); frames.append(im.crop((int(im.width * 0.12), 0, int(im.width * 0.72), im.height)))
        os.remove(os.path.join(OUT, '_t.png'))
        W = frames[0].width; H = frames[0].height; sheet = Image.new('RGB', (W * 3, H * 3))
        for k, f in enumerate(frames): sheet.paste(f, ((k % 3) * W, (k // 3) * H))
        sheet.save(os.path.join(OUT, f'{job}_frames.png')); print(job, sheet.size, R['console'][:3], flush=True)
        c.close()
    b.close()
