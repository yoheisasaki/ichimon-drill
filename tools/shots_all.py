# 全画面の撮影＋自動検出（headless webkit）。python tools/shots_all.py <出力タグ> [--zoom] [--vp 390x844,375x667,320x568]
# 出力：_shots/ui_<タグ>/<幅x高さ>[_z130]/<画面>.png と result.json（voice.js の collect() が返す異常の要約）。送信は遮断。
import sys, os, json, threading, http.server, socketserver, functools, re
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TAG = sys.argv[1] if len(sys.argv) > 1 else 'x'
VPS = ['390x844', '375x667', '320x568']
ZOOMS = [1.0]
if '--vp' in sys.argv: VPS = sys.argv[sys.argv.index('--vp') + 1].split(',')
if '--zoom' in sys.argv: ZOOMS = [1.0, 1.3]
PORT = 18490
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=3000; ['w_sword_1','w_sword_2'].forEach(i => { s.inv.items[i]=1; s.codex.items[i]=1; }); s.equip.weapon='w_sword_1'; s.active=null; s.look={face:1,hair:2,skin:1,hairColor:3,outfit:null}; s.name='ゆうた'; s.daily={maxKey:'',used:{}}; s.progress.step=40; s.seen={};"
DATA = json.load(open(os.path.join(ROOT, 'data', 'questions.json'), encoding='utf-8'))
cur = [t for t in DATA['tests'] if t.get('current')][0]['id']
QS = [q for q in DATA['questions'] if q['test'] == cur]
def pickq(f):
    for q in QS:
        if f(q): return q['id']
CASES = [
    ('kok_exp', lambda q: q['subject'] == '国語' and q.get('exp') and q.get('type') != 'input'),
    ('san', lambda q: q['subject'] == '算数' and q.get('type') != 'input'),
    ('ri_exp', lambda q: q['subject'] == '理科' and q.get('exp')),
    ('sha_exp', lambda q: q['subject'] == '社会' and q.get('exp') and not q.get('map') and q.get('type') != 'input'),
    ('chizu', lambda q: q.get('map') and q.get('type') != 'input' and q.get('exp')),
    ('chizu_input', lambda q: q.get('map') and q.get('type') == 'input' and q.get('exp')),
    ('input_kok', lambda q: q['subject'] == '国語' and q.get('type') == 'input'),
    ('long', lambda q: q.get('exp') and q.get('type') != 'input' and len(q.get('exp', '')) > 60),
]
RPGS = ['me', 'equip', 'adv', 'town', 'shop', 'jobs', 'look', 'codex', 'settings', 'forge', 'loadout', 'story']
R = {}
def new_page(b, w, h, z):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.route('**/script.google.com/**', lambda r: r.abort()); pg.route('**/fonts.g*/**', lambda r: r.abort())
    return pg
def boot(pg):
    base = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
    pg.goto(base); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(600)
HAS_VOICE = os.path.exists(os.path.join(ROOT, 'voice.js')) and 'voice.js' in open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
def scan(pg):
    if not HAS_VOICE:
        if not pg.evaluate("() => !!window.IchimonVoice"):
            pg.add_script_tag(path=os.path.join(ROOT, 'voice.js')); pg.evaluate("() => { const a = document.getElementById('vbar'); if (a) a.remove(); const b = document.getElementById('vsheet'); if (b) b.remove(); }")
    r = pg.evaluate("() => { const o = IchimonVoice.collect(); return { screen: o.screen, summary: o.summary, an: o.report.anomalies }; }")
    return r
def shot(pg, d, name):
    pg.screenshot(path=os.path.join(d, name + '.png'))
    r = scan(pg); R[os.path.basename(d) + '/' + name] = {'summary': r['summary'], 'an': r['an']}
def wrong(pg): pg.evaluate("() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = 'ぜったいにちがう'; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else { const k = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[k].click(); } }")
def right(pg): pg.evaluate("() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }")
with sync_playwright() as pw:
    b = pw.webkit.launch(headless=True)
    for vp in VPS:
        w, h = map(int, vp.split('x'))
        for z in ZOOMS:
            d = os.path.join(ROOT, '_shots', 'ui_' + TAG, vp + ('_z130' if z != 1.0 else '')); os.makedirs(d, exist_ok=True)
            pg = new_page(b, w, h, z); boot(pg)
            if z != 1.0: pg.evaluate("() => { document.body.style.zoom = 1.3; }")
            def goto_home():
                pg.evaluate("() => { app.onclick = null; if (window.S) clearTimeout(S.timer); home(); }"); pg.wait_for_timeout(300)
            shot(pg, d, 'home')
            for name, f in CASES:
                qid = pickq(f)
                if not qid: continue
                for mode in ('wrong', 'right'):
                    pg.evaluate("(id) => { app.onclick = null; start([DATA.questions.find(q => q.id === id)], '', { manual: false }); }", qid)
                    pg.wait_for_timeout(500)
                    if mode == 'wrong': shot(pg, d, f'q_{name}_0ask')
                    (wrong if mode == 'wrong' else right)(pg); pg.wait_for_timeout(1700)
                    shot(pg, d, f'q_{name}_{mode}')
            # 結果・報酬
            ids = [q['id'] for q in QS[:3]]
            pg.evaluate("(ids) => { app.onclick = null; start(ids.map(id => DATA.questions.find(q => q.id === id))); }", ids)
            for i in range(8):
                pg.wait_for_timeout(500)
                if pg.evaluate("() => !!document.querySelector('#app .choice:not(.ok):not(.ng), #ans:not([readonly])') && !S.locked"): right(pg)
                pg.wait_for_timeout(1500)
                pg.evaluate("() => { if (app.onclick) { app.onclick = null; advance(); } }")
            pg.wait_for_timeout(2500); shot(pg, d, 'result')
            pg.evaluate("() => window.scrollTo(0, 99999)"); pg.wait_for_timeout(300); shot(pg, d, 'result_bottom')
            goto_home()
            for nm in RPGS:
                pg.evaluate("(n) => RPG.go(n)", nm); pg.wait_for_timeout(500); shot(pg, d, 'rpg_' + nm)
            pg.close()
    b.close()
json.dump(R, open(os.path.join(ROOT, '_shots', 'ui_' + TAG, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
n = sum(1 for v in R.values() if v['an'])
print('shots', len(R), 'with anomalies', n)
for k, v in R.items():
    if v['an']: print(k, v['summary'][:200])
