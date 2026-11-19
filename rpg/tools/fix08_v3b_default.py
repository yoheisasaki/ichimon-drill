# v3b 一体絵が既定になったことの確認（headless chromium・webkit、390x700 と 320x568、nosend=1）。python rpg/tools/fix08_v3b_default.py [port]
# 出力: rpg/shots/fix08_v3b_default/ に <engine>_<vp>_<画面>.png と result.json（読まれた部品の画像URL・外見選択が無いこと・保存の移行・コンソール）
import sys, os, re, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18551
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_v3b_default'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()   # v1・look に face/hair/skin/hairColor あり
SETUP = re.search(r'SETUP = """(.*?)"""', open(os.path.join(ROOT, 'rpg', 'tools', 'fix08_reward.py'), encoding='utf-8').read(), re.S).group(1)
PATCH = "s.job='%s'; s.firstDone=true; s.coins=3000; s.jobXp.warrior=9000; s.jobXp.mage=9000; s.jobXp.priest=9000; s.active=null; s.daily.used={}; s.chests=[]; s.look={face:1,hair:2,skin:1,hairColor:3,outfit:null};"
R = {'console': [], 'runs': {}}
def page(b, w, h, job, urls):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}')); pg.route('**/script.google.com/**', lambda r: r.abort())
    pg.on('request', lambda r: urls.append(r.url.split('/rpg/assets/')[-1]) if '/rpg/assets/parts/' in r.url and r.url.endswith('.png') else None)
    pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH % job])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(700)
    return pg
def go(pg, name, params=None):
    pg.evaluate("([n, p]) => RPG.go(n, p || {})", [name, params]); pg.wait_for_timeout(700)
def run(b, eng, vp, w, h):
    key = f'{eng}_{vp}'; urls = []; res = {}
    pg = page(b, w, h, 'warrior', urls)
    def shot(n): pg.screenshot(path=os.path.join(OUT, f'{key}_{n}.png'))
    res['migrated'] = pg.evaluate("() => ({ v: RPG.save.v, lookKeys: Object.keys(RPG.save.look), job: RPG.save.job, equip: RPG.save.equip.weapon })")
    pg.evaluate("() => home()"); pg.wait_for_timeout(600); shot('01_home')
    go(pg, 'equip'); shot('02_equip')
    go(pg, 'jobs'); shot('03_jobs')
    go(pg, 'jobdetail', {'job': 'priest'}); shot('04_jobdetail')
    go(pg, 'look'); shot('05_name_outfit')
    res['look_screen'] = pg.evaluate("() => ({ lk: document.querySelectorAll('[data-lk]').length, swatches: document.querySelectorAll('.rs-sw').length, text: document.getElementById('app').innerText.replace(/\\s+/g, ' ').slice(0, 160), heroKeys: [...document.querySelectorAll('canvas[data-hero]')].map(c => Object.keys(JSON.parse(c.dataset.hero)).join(',')) })")
    res['entries'] = pg.evaluate("""() => { const out = {}; for (const s of ['home', 'town', 'me', 'adv', 'equip', 'jobs']) { try { RPG.go(s, {}); } catch (e) {} const t = document.getElementById('app').innerText; out[s] = { faceHair: /顔|髪型|肌の色|髪の色|見た目/.test(t), lk: document.querySelectorAll('[data-lk]').length }; } return out; }""")
    pg.evaluate("() => home()"); pg.wait_for_timeout(500)
    pg.click('#go'); pg.wait_for_selector('.choice, #ans'); pg.wait_for_timeout(900); shot('06_battle_strip')
    res['strip'] = pg.evaluate("() => !!document.querySelector('canvas[data-strip], .rs-strip canvas, #strip canvas, canvas')")
    pg.evaluate("() => { const q = S.cur; if (document.getElementById('ans')) { document.getElementById('ans').value = q.accept[0]; document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"); pg.wait_for_timeout(450); shot('07_battle_attack')
    pg.evaluate(SETUP, {'chest': 'coin'}); pg.wait_for_timeout(700); shot('08_reward_win')
    pg.evaluate(SETUP, {'outcome': 'retreat', 'chest': 'coin'}); pg.wait_for_timeout(700); shot('09_reward_ready')
    res['dev'] = pg.evaluate("() => { const r = RPGSprites.devReport(); return { parts: r.parts, layered: r.layered.length, whole: r.whole.length, missing: r.missing.length }; }")
    pg.context.close()
    for job in ('priest', 'sage', 'skyknight'):
        pg = page(b, w, h, job, urls)
        pg.evaluate(SETUP, {'outcome': 'retreat', 'chest': 'coin'}); pg.wait_for_timeout(700); pg.screenshot(path=os.path.join(OUT, f'{key}_10_{job}_ready.png'))
        pg.context.close()
    bodies = sorted({u.split('/')[-1] for u in urls if '/body_' in u}); heads = sorted({u.split('/')[-1] for u in urls if '/head_' in u})
    res['parts_loaded'] = {'body': len(bodies), 'body_not_v3b': [x for x in bodies if '_v3b_' not in x], 'head': heads, 'hand_not_v3b': sorted({u.split('/')[-1] for u in urls if '/hand_' in u and '_v3b_' not in u}),
                           'S_bodies': len([x for x in bodies if x.endswith('_S.png')]), 'L_bodies': len([x for x in bodies if x.endswith('_L.png')]), 'sample': bodies[:6], 'all_png': len(urls)}
    R['runs'][key] = res; print(key, json.dumps(res['parts_loaded'], ensure_ascii=False)[:300], res['migrated'], res['look_screen']['lk'], res['dev'], flush=True)
with sync_playwright() as p:
    for eng in ('chromium', 'webkit'):
        b = getattr(p, eng).launch(headless=True)
        for vp, w, h in (('390x700', 390, 700), ('320x568', 320, 568)): run(b, eng, vp, w, h)
        b.close()
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('console', R['console'][:10])
