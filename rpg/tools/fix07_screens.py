# 07 確認票の穴埋め撮影（headless chromium、nosend=1）：A02 12職の一覧／B06 320・375・390・430pxの主要画面／C02 入力欄とキーボード（縦を縮めて近似）
# python rpg/tools/fix07_screens.py [port]  → rpg/shots/fix07_screens/ と result.json。実機のキーボードは未確認。
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18491
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix07_screens'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
R = {'checks': {}, 'console': [], 'blocked': 0}
def chk(n, c, x=None): R['checks'][n] = bool(c) if x is None else {'ok': bool(c), 'v': x}
def blk(r): R['blocked'] += 1; r.abort()
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=3000; s.jobXp.warrior=9000; s.jobXp.mage=9000; s.jobXp.priest=9000; s.jobXp.thief=9000; s.active=null; s.look={face:1,hair:2,skin:1,hairColor:3,outfit:null};"
STRIP = "document.querySelector('.rs-stripbox, #rsStrip, [class*=strip]')"
def page(b, w, h=844):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True); ctx.add_init_script('window.__rangeOpen = true')
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}')); pg.route('**/script.google.com/**', blk)
    pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 766 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(500); return pg
def go(pg, n, p=None): pg.evaluate("([n, p]) => RPG.go(n, p || {})", [n, p]); pg.wait_for_timeout(400)
def shot(pg, n, full=True): pg.screenshot(path=os.path.join(OUT, n + '.png'), full_page=full)
LAYOUT = """() => { const nav = document.querySelector('.rs-nav'), nt = nav ? nav.getBoundingClientRect().top : innerHeight; window.scrollTo(0, document.documentElement.scrollHeight); const els = [...document.querySelectorAll('#app button, #app summary, #app input, #app a')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('.rs-nav') && getComputedStyle(e).visibility !== 'hidden' && (e.tagName === 'SUMMARY' || !e.closest('details:not([open])')); }); const last = els.length ? Math.max(...els.map(e => e.getBoundingClientRect().bottom)) : 0; window.scrollTo(0, 0); return {hscroll: document.documentElement.scrollWidth > innerWidth, lastBottom: Math.round(last), navTop: Math.round(nt)}; }"""
QUIZ = """() => { const sk = document.getElementById('skipc').getBoundingClientRect(); const ch = [...document.querySelectorAll('.choice')].map(e => e.getBoundingClientRect()); const e = STRIPSEL; const st = e ? e.getBoundingClientRect() : null; return {hscroll: document.documentElement.scrollWidth > innerWidth, skipBottom: Math.round(sk.bottom), lastChoice: Math.round(ch[ch.length - 1].bottom), stripTop: st ? Math.round(st.top) : null, vh: innerHeight}; }""".replace('STRIPSEL', STRIP)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    # ---- A02：12職の一覧（実画面。基本4・上級6・最上級2）----
    pg = page(b, 390); go(pg, 'jobs'); names = {}
    for tier in ('base', 'adv', 'top'):
        pg.click(f'[data-tier={tier}]'); pg.wait_for_timeout(500)
        names[tier] = pg.evaluate("() => [...document.querySelectorAll('.rs-jobcard b')].map(e => { const c = e.cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent.trim(); })")
        shot(pg, f'A02_jobs_{tier}_390')
    chk('A02 12 jobs listed (4+6+2)', [len(names[t]) for t in ('base', 'adv', 'top')] == [4, 6, 2], names); R['job_names'] = names
    pg.context.close()
    # ---- B06：4幅 x 主要画面 ----
    SCR = [('home', None), ('equip', None), ('shop', None), ('jobs', None), ('jobdetail', {'job': 'magicknight'}), ('me', None)]
    for w in (320, 375, 390, 430):
        pg = page(b, w); bad = []
        for scr, prm in SCR:
            if scr == 'home': pg.evaluate("() => home()")
            else: go(pg, scr, prm)
            pg.wait_for_timeout(300); l = pg.evaluate(LAYOUT); shot(pg, f'B06_{w}_{scr}')
            if l['hscroll'] or l['lastBottom'] > l['navTop'] + 1: bad.append([scr, l])
            R.setdefault('b06_layout', {})[f'{w}/{scr}'] = l
        pg.evaluate("() => home()"); pg.wait_for_timeout(300)
        pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice'); pg.wait_for_timeout(500)
        l = pg.evaluate(QUIZ); shot(pg, f'B06_{w}_quiz', full=False); R['b06_layout'][f'{w}/quiz'] = l
        if l['hscroll'] or (l['stripTop'] is not None and l['skipBottom'] > l['stripTop'] + 1): bad.append(['quiz', l])
        chk(f'B06 {w}px: no hscroll, end reachable above nav, quiz buttons not covered by strip', not bad, bad)
        pg.context.close()
    # ---- C02：入力問題とキーボード（キーボードで縦が縮む状態を、表示領域の高さ 844→410 で近似）----
    pg = page(b, 390)
    pg.evaluate("() => { filter = '全部'; units = {}; start(pick(pool().filter(q => q.type === 'input'), 10)); }"); pg.wait_for_selector('#ans'); pg.wait_for_timeout(500)
    shot(pg, 'C02_input_before_focus', full=False)
    pg.click('#ans'); pg.set_viewport_size({'width': 390, 'height': 410}); pg.wait_for_timeout(700)
    pg.keyboard.type('てすと'); pg.wait_for_timeout(300)
    info = pg.evaluate("() => { const a = document.getElementById('ans').getBoundingClientRect(), s = document.getElementById('submit').getBoundingClientRect(); const e = STRIPSEL; return {ansTop: Math.round(a.top), subBottom: Math.round(s.bottom), vh: innerHeight, stripHidden: e ? (e.hidden || getComputedStyle(e).display === 'none') : null, focused: document.activeElement.id, typed: document.getElementById('ans').value}; }".replace('STRIPSEL', STRIP))
    shot(pg, 'C02_input_keyboard_410', full=False)
    chk('C02 input: field and submit inside the shrunken viewport, keyboard typing works', info['ansTop'] >= 0 and info['subBottom'] <= info['vh'] + 1 and info['typed'] == 'てすと' and info['focused'] == 'ans', info)
    R['c02_info'] = info
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.evaluate("() => document.getElementById('ans').blur()"); pg.wait_for_timeout(500)
    R['c02_strip_visible_after_blur'] = pg.evaluate("() => { const e = STRIPSEL; return e ? !e.hidden : null; }".replace('STRIPSEL', STRIP))
    pg.context.close(); b.close()
chk('console clean / no external request', not R['console'] and R['blocked'] == 0, [R['console'][:3], R['blocked']])
R['pass'] = sum(1 for v in R['checks'].values() if (v if isinstance(v, bool) else v['ok'])); R['fail'] = [k for k, v in R['checks'].items() if not (v if isinstance(v, bool) else v['ok'])]
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'pass': R['pass'], 'fail': R['fail'], 'console': R['console'][:4]}, ensure_ascii=False, indent=1))
