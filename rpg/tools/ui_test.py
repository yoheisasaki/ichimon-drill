# 画面の通し確認（headless）。python rpg/tools/ui_test.py [port]
# ・送信先をネットワーク層で遮断（実データを送らない） ・幅390px(+320/430)  ・スクショは rpg/shots/ に保存
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18432
OUT = os.path.join(ROOT, 'rpg', 'shots'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'checks': {}, 'console': [], 'blocked': 0}
def chk(name, cond, extra=None):
    R['checks'][name] = bool(cond) if extra is None else {'ok': bool(cond), 'v': extra}
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
WRONG = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = 'ぜったいにちがう'; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else { const k = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[k].click(); } }"
def blk(r): R['blocked'] += 1; r.abort()
with sync_playwright() as p:
    for engine in ('chromium', 'webkit'):
        b = getattr(p, engine).launch(headless=True)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script('window.__rangeOpen = false'); pg = ctx.new_page()
        pg.on('console', lambda m, e=engine: R['console'].append(f'{e}:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, en=engine: R['console'].append(f'{en}:pageerror:{e}'))
        pg.route('**/script.google.com/**', blk)
        pg.goto(URL); pg.wait_for_selector('#go')
        chk(engine + ':rpg_ok', pg.evaluate('() => RPG.ok'))
        # 社会の4択で通常の1冒険（10問）。1問目から最後まで正解6/不正解4＋復習
        pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }")
        pg.wait_for_selector('.choice')
        if engine == 'chromium': pg.screenshot(path=os.path.join(OUT, 'q_choice.png'))
        strip = pg.evaluate("() => { const s = document.querySelector('.rpg-strip canvas'); const r = s.getBoundingClientRect(); const ch = [...document.querySelectorAll('.choice')].map(e => e.getBoundingClientRect()); const sk = document.querySelector('.skip').getBoundingClientRect(); const cardH = document.querySelector('.card').getBoundingClientRect().height; return {sh: Math.round(r.height), sw: Math.round(r.width), top: Math.round(r.top), bottom: Math.round(r.bottom), lastChoiceBottom: Math.round(ch[ch.length-1].bottom), skipBottom: Math.round(sk.bottom), choiceH: ch.map(c => Math.round(c.height)), cardH: Math.round(cardH), doc: document.documentElement.scrollHeight, vh: innerHeight, aria: document.querySelector('.rpg-strip').getAttribute('aria-hidden')}; }")
        R['checks'][engine + ':strip'] = strip
        chk(engine + ':strip_no_overlap', strip['top'] >= strip['skipBottom'])
        chk(engine + ':strip_height_44', strip['sh'] == 44)
        # 回答を進める
        answers = [True, False, True, True, False, True, False, True, True, False]
        i = 0
        saw_review = 0
        for _ in range(40):
            if pg.query_selector('#rwRoot') or pg.query_selector('.res-score'): break
            is_rv = pg.evaluate("() => !!S.cur._rv")
            if is_rv: saw_review += 1
            ok = True if is_rv else answers[i % 10]
            if not is_rv: i += 1
            pg.evaluate(CORRECT if ok else WRONG)
            if ok: pg.wait_for_timeout(750)
            else:
                pg.wait_for_function("() => document.getElementById('next') && document.getElementById('next').textContent.includes('つぎへ')", timeout=3000)
                pg.click('#next')
            pg.wait_for_timeout(80)
        pg.wait_for_selector('#rwRoot', timeout=5000)
        chk(engine + ':reviews_seen', saw_review >= 1, saw_review)
        pg.wait_for_timeout(300)
        if engine == 'chromium': pg.screenshot(path=os.path.join(OUT, 'reward_full.png'), full_page=True)
        rw = pg.evaluate("() => ({text: document.querySelector('.rw').innerText, hscroll: document.documentElement.scrollWidth > innerWidth, btns: [...document.querySelectorAll('.rw-btns .rw-btn')].map(b => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.width), Math.round(r.height), getComputedStyle(b).backgroundImage]; }), save: JSON.parse(localStorage.getItem('ichimon.rpg.v1'))})")
        R['checks'][engine + ':reward_text'] = rw['text'].replace('\n', ' | ')[:400]
        chk(engine + ':reward_buttons_equal', len(rw['btns']) == 2 and rw['btns'][0][1:] == rw['btns'][1][1:], rw['btns'])
        chk(engine + ':reward_no_hscroll', not rw['hscroll'])
        sv = rw['save']
        chk(engine + ':saved_settled', sv['active'] is None and sv['stats']['adventures'] == 1 and sv['advXp'] > 0, {'xp': sv['advXp'], 'coins': sv['coins'], 'rev': sv['rev']})
        # 学習側の記録は従来どおり（行の形が変わっていない）
        rows = pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.queue.v1')).rows.map(r => Object.keys(r).sort().join())")
        chk(engine + ':rows_shape_unchanged', all(r in ('ok,pick,qid,rid,sess,t,test', 'ok,pick,qid,rid,sess,skip,t,test') for r in rows), len(rows))
        # 再読込しても結果を再計算しない（二重付与なし）
        pg.reload(); pg.wait_for_selector('#go')
        sv2 = pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))")
        chk(engine + ':reload_no_double', sv2['advXp'] == sv['advXp'] and sv2['coins'] == sv['coins'])
        # 終わる/もう1冒険
        b.close()
    # 長文・地図・入力で縮まないこと（RPGあり vs なし の同一画面比較）
    b = p.chromium.launch(headless=True)
    def measure(w, rpg_on):
        ctx = b.new_context(viewport={'width': w, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script('window.__rangeOpen = false'); pg = ctx.new_page(); pg.route('**/script.google.com/**', blk)
        pg.on('console', lambda m: R['console'].append(f'cmp:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.goto(URL + ('' if rpg_on else '&rpg=0')); pg.wait_for_selector('#go')
        out = {}
        for name, sel in (('long', "qs().filter(q => q.type !== 'input' && !q.map).sort((a, b) => plain(b.q).length - plain(a.q).length)[0]"), ('map', "qs().find(q => q.map && q.type !== 'input')"), ('input', "qs().find(q => q.type === 'input')")):
            pg.evaluate(f"() => start([{sel}])")
            pg.wait_for_selector('.map svg' if name == 'map' else ('#ans' if name == 'input' else '.choice'), timeout=8000)
            out[name] = pg.evaluate("() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; }; const ch = [...document.querySelectorAll('.choice')].map(e => Math.round(e.getBoundingClientRect().height)); const st = document.querySelector('.rpg-strip canvas'); const sr = st ? st.getBoundingClientRect() : null; const lastEl = [...document.querySelectorAll('.choice,.skip,.next,.score,#submit,.credit')].pop(); const lb = lastEl ? lastEl.getBoundingClientRect().bottom : 0; return {card: r('.card'), map: r('.map'), choice: ch, ans: r('.ans'), submit: r('#submit'), skip: r('.skip'), strip: sr ? [Math.round(sr.height), Math.round(sr.top)] : null, contentBottom: Math.round(lb), hscroll: document.documentElement.scrollWidth > innerWidth, cardFs: getComputedStyle(document.querySelector('.card')).fontSize, choiceFs: document.querySelector('.choice') ? getComputedStyle(document.querySelector('.choice')).fontSize : null}; }")
            if w == 390 and rpg_on: pg.screenshot(path=os.path.join(OUT, f'q_{name}.png'))
            pg.click('#quit'); pg.wait_for_selector('#go')
        ctx.close(); return out
    for w in (320, 375, 390, 430):
        a, c = measure(w, True), measure(w, False)
        same = all(a[k]['card'] == c[k]['card'] and a[k]['map'] == c[k]['map'] and a[k]['choice'] == c[k]['choice'] and a[k]['ans'] == c[k]['ans'] and a[k]['submit'] == c[k]['submit'] and a[k]['skip'] == c[k]['skip'] for k in a)
        chk(f'w{w}:question_map_choice_same_as_without_rpg', same, {k: [a[k]['card'], a[k]['map'], a[k]['choice'], a[k]['strip'], a[k]['contentBottom']] for k in a} if not same else None)
        chk(f'w{w}:strip_below_content', all(a[k]['strip'] is None or a[k]['strip'][1] >= a[k]['contentBottom'] - 1 for k in a), {k: (a[k]['strip'], a[k]['contentBottom']) for k in a})
        chk(f'w{w}:no_hscroll', not any(a[k]['hscroll'] for k in a))
        chk(f'w{w}:strip_44', all(a[k]['strip'] is None or a[k]['strip'][0] == 44 for k in a))
    b.close()
R['blocked_send_requests'] = R['blocked']
srv.shutdown()
json.dump(R, open(os.path.join(OUT, 'ui_test.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = {k: v for k, v in R['checks'].items() if v is False or (isinstance(v, dict) and 'ok' in v and not v['ok'])}
print(json.dumps({'failed': bad, 'console': R['console'][:10], 'n': len(R['checks'])}, ensure_ascii=False, indent=1)[:3000])
