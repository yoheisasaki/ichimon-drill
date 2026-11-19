# 08 U12・U13：回答画面（地図・長文4択・ひらがな入力・追加復習）の既存サイズ維持と、冒険帯に隠れないことを6領域で数値確認（headless chromium、nosend=1）
# 「既存サイズ」＝ぼうけん無し(&rpg=0)の同じ問題の寸法と比べる。python rpg/tools/fix08_answer.py [port]
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18551
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_screens'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
R = {'viewports': {}, 'console': [], 'blocked': 0}
def blk(r): R['blocked'] += 1; r.abort()
PATCH = "s.job='warrior'; s.firstDone=true; s.active=null; s.daily.used={}; s.chests=[];"
VPS = [('390x700', 390, 700), ('390x640', 390, 640), ('375x640', 375, 640), ('430x800', 430, 800), ('320x640', 320, 640), ('390x700_t130', 390, 700)]
BUMP = """() => { const rr = document.getElementById('app'); if (rr.dataset.b) return; rr.dataset.b = '1'; const els = [...document.querySelectorAll('#app *')]; const fs = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.fontSize = (fs[i] * 1.3) + 'px'; }); }"""
METRICS = """() => {
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
  const ch = [...document.querySelectorAll('.choice')], qt = document.querySelector('.qt'), mp = document.querySelector('.map'), sk = document.getElementById('skipc') || document.getElementById('skip'), sc = document.querySelector('.score'), inp = document.getElementById('ans'), sub = document.getElementById('submit');
  return { qt_font: qt ? getComputedStyle(qt).fontSize : null, qt: r(qt), choices: ch.map(r), choice_font: ch[0] ? getComputedStyle(ch[0]).fontSize : null, map: r(mp), skip: r(sk), score: r(sc), input: r(inp), submit: r(sub), hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; }"""
CLEAR = """() => {
  window.scrollTo(0, document.documentElement.scrollHeight);
  const st = document.querySelector('.rpg-strip'), sb = st ? st.getBoundingClientRect() : null, top = sb && getComputedStyle(st).display !== 'none' && !st.hidden ? sb.top : innerHeight;
  const pick = s => document.querySelector(s), els = { lastChoice: [...document.querySelectorAll('.choice')].pop(), skip: pick('#skipc') || pick('#skip'), score: pick('.score'), submit: pick('#submit'), input: pick('#ans'), credit: pick('.map .credit, .credit, .map-credit, .mapcredit'), next: pick('#next') };
  const o = { stripTop: sb ? Math.round(sb.top) : null, stripH: sb ? Math.round(sb.height) : null, vh: innerHeight, scrollable: document.documentElement.scrollHeight > innerHeight + 1, items: {}, hidden: [] };
  Object.entries(els).forEach(([k, e]) => { if (!e) { o.items[k] = null; return; } const b = e.getBoundingClientRect(); o.items[k] = { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; if (b.height > 0 && (b.bottom > top + 0.5 || b.bottom > innerHeight + 0.5)) o.hidden.push(k); });
  return o; }"""
def page(b, w, h, rpg):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}')); pg.route('**/script.google.com/**', blk)
    pg.goto(BASE + ('' if rpg else '&rpg=0')); pg.wait_for_selector('#go', state='attached')
    if rpg:
        pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
        pg.reload(); pg.wait_for_selector('#go', state='attached')
        pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(600)
    return pg
PICK = """() => { const all = qs(), ch = all.filter(q => q.type !== 'input' && !q.map), len = q => q.q.length + q.choices.concat(q.a).join('').length;
  const long = ch.slice().sort((a, b) => len(b) - len(a))[0], map = all.find(q => q.map && q.type !== 'input'), inp = all.find(q => q.type === 'input' && !q.map), inpMap = all.find(q => q.type === 'input' && q.map);
  return { long: long && long.id, map: map && map.id, input: inp && inp.id, inputMap: inpMap && inpMap.id }; }"""
def show(pg, qid, rpg):
    pg.evaluate("(id) => { const q = qs().find(x => x.id === id); start([q]%s); }" % ('' if rpg else ', { manual: true }'), qid)
    pg.wait_for_selector('.choice, #ans'); pg.wait_for_timeout(700)
def measure(pg, t130):
    if t130: pg.evaluate(BUMP); pg.wait_for_timeout(150)
    return {'m': pg.evaluate(METRICS), 'clear': pg.evaluate(CLEAR)}
def run_vp(b, vp, w, h):
    t130 = vp.endswith('_t130'); P = page(b, w, h, True); B = page(b, w, h, False)
    ids = P.evaluate(PICK); R.setdefault('ids', ids); out = {}
    for name in ('long', 'map', 'input', 'inputMap'):
        qid = ids.get(name)
        if not qid: continue
        show(B, qid, False); base = measure(B, t130); B.evaluate("() => window.scrollTo(0, 0)")
        show(P, qid, True); mine = measure(P, t130)
        P.evaluate("() => window.scrollTo(0, 0)"); P.screenshot(path=os.path.join(OUT, f'{vp}_answer_{name}.png'))
        srt = lambda m: dict(m, choices=sorted(m['choices']))   # 選択肢の並びは毎回シャッフルされるので並べ替えて比べる
        same = {k: srt(base['m'])[k] == srt(mine['m'])[k] for k in ('qt_font', 'qt', 'choices', 'choice_font', 'map', 'skip', 'input', 'submit')}
        out[name] = {'base': base['m'], 'rpg': mine['m'], 'same_as_no_rpg': same, 'size_kept': all(same.values()), 'clear': mine['clear'], 'covered': mine['clear']['hidden']}
        P.evaluate("() => quit()") if False else None
    # 追加復習：1問目をわざと間違え、3問あとに復習問題が出る画面
    P.evaluate("() => home()"); P.wait_for_selector('#go')
    P.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); P.wait_for_selector('.choice')
    P.evaluate("() => { const q = S.cur; const wrong = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[wrong].click(); }"); P.wait_for_timeout(300)
    got = None
    for _ in range(8):
        P.evaluate("() => { if (document.getElementById('next') && S.locked) { advance(); } }"); P.wait_for_timeout(300)
        if P.evaluate("() => !!(S.cur && S.cur._rv)"): got = True; break
        P.evaluate("() => { const q = S.cur; const i = S.opts.indexOf(q.a); if (i >= 0 && !S.locked) document.querySelectorAll('.choice')[i].click(); }"); P.wait_for_timeout(1500)
        P.evaluate("() => { if (S.locked) advance(); }"); P.wait_for_timeout(500)
        if P.evaluate("() => !!(S.cur && S.cur._rv)"): got = True; break
    if got:
        P.wait_for_timeout(600); mm = measure(P, t130); P.evaluate("() => window.scrollTo(0, 0)"); P.screenshot(path=os.path.join(OUT, f'{vp}_answer_review.png'))
        out['review'] = {'rpg': mm['m'], 'clear': mm['clear'], 'covered': mm['clear']['hidden'], 'is_review_question': True}
    else: out['review'] = {'is_review_question': False}
    R['viewports'][vp] = out; P.context.close(); B.context.close()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for vp, w, h in VPS: run_vp(b, vp, w, h)
    b.close()
bad = []
for vp, scr in R['viewports'].items():
    for name, c in scr.items():
        if name == 'review':
            if not c.get('is_review_question'): bad.append([vp, name, 'review question not reached'])
            elif c['covered']: bad.append([vp, name, 'covered', c['covered']])
            continue
        if not c['size_kept']: bad.append([vp, name, 'size changed', {k: v for k, v in c['same_as_no_rpg'].items() if not v}])
        if c['covered']: bad.append([vp, name, 'covered', c['covered']])
        if c['rpg']['hscroll']: bad.append([vp, name, 'hscroll'])
R['problems'] = bad
json.dump(R, open(os.path.join(OUT, 'answer_result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'problems': len(bad), 'console': R['console'][:4], 'ids': R.get('ids')}, ensure_ascii=False))
for x in bad[:40]: print(x)
