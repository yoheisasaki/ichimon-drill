# 意見ボタン・おかしい！ボタンの確認（headless webkit/chromium）。python tools/voice_test.py
# 送信先はローカルの受け口に差し替え（?send=）。見るもの：全画面で押せる／帯が他の要素にかぶらない／送信の中身／解答状態が残る／電波なしで端末にためて後で送る／名前が含まれない
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
POSTED = []

class Rcv(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def _h(self): self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Content-Type', 'application/json')
    def do_OPTIONS(self): self.send_response(204); self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*'); self.end_headers()
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); POSTED.append(json.loads(self.rfile.read(n).decode('utf-8')))
        self.send_response(200); self._h(); self.end_headers(); self.wfile.write(b'{"ok":true,"saved":1}')
    def do_GET(self): self.send_response(200); self._h(); self.end_headers(); self.wfile.write(b'{"ok":true,"conf":{}}')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
web = TS(('127.0.0.1', 18495), functools.partial(Q, directory=ROOT)); threading.Thread(target=web.serve_forever, daemon=True).start()
rcv = TS(('127.0.0.1', 18496), Rcv); threading.Thread(target=rcv.serve_forever, daemon=True).start()
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=3000; s.equip.weapon='w_sword_1'; s.inv.items['w_sword_1']=1; s.active=null; s.name='ゆうた'; s.daily={maxKey:'',used:{}}; s.progress.step=40; s.seen={};"
DATA = json.load(open(os.path.join(ROOT, 'data', 'questions.json'), encoding='utf-8'))
cur = [t for t in DATA['tests'] if t.get('current')][0]['id']
QID = next(q['id'] for q in DATA['questions'] if q['test'] == cur and q['subject'] == '理科' and q.get('exp') and q.get('type') != 'input')
def VP(): return [p for p in POSTED if p.get('api') == 'ichimon_voice']
R = {}
def chk(k, c, v=None): R[k] = bool(c) if v is None else {'ok': bool(c), 'v': v}
def run(bt, name, w, h):
    b = bt.launch(headless=True)
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.route('**/fonts.g*/**', lambda r: r.abort()); pg.route('**/script.google.com/**', lambda r: r.abort())
    url = 'http://127.0.0.1:18495/index.html?send=http://127.0.0.1:18496/'
    pg.goto(url); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
    pg.reload(); pg.wait_for_selector('#go', state='attached'); pg.wait_for_function("() => !!window.RPG && RPG.ok && !!window.IchimonVoice", timeout=90000); pg.wait_for_timeout(800)
    P = f'{name}_{w}x{h}'
    def bar_ok(label):
        r = pg.evaluate("""() => { const vb = document.getElementById('vbar').getBoundingClientRect(), btns = [...document.querySelectorAll('#vbar .vb')].map(b => b.getBoundingClientRect());
          const bad = []; document.querySelectorAll('#app *').forEach(e => { if (e.closest('canvas')) return; const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return; const cs = getComputedStyle(e); if (cs.position === 'fixed' || cs.visibility === 'hidden') return;
            if (r.top < vb.bottom - 0.5 && r.bottom > vb.top + 0.5 && r.right > btns[0].left && r.left < btns[btns.length - 1].right && (e.children.length === 0 || e.tagName === 'BUTTON')) bad.push(e.className || e.tagName); });
          const sw = document.documentElement.scrollWidth > innerWidth + 1; return { bad: bad.slice(0, 4), hscroll: sw, btn: btns.map(b => [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]) }; }""")
        chk(f'{P}:{label}:帯がほかの要素にかぶらない', not r['bad'], r['bad']); chk(f'{P}:{label}:横スクロールなし', not r['hscroll'])
        return r
    # ホームとRPGの各画面
    bar_ok('home')
    for nm in ['me', 'equip', 'adv', 'town', 'shop', 'jobs']:
        pg.evaluate("(n) => RPG.go(n)", nm); pg.wait_for_timeout(300); bar_ok('rpg_' + nm)
        chk(f'{P}:rpg_{nm}:意見が開く', pg.evaluate("() => { document.getElementById('vIken').click(); const h = !document.getElementById('vsheet').hidden; document.getElementById('vsX').click(); return h; }"))
    pg.evaluate("() => home()"); pg.wait_for_timeout(300)
    # 問題の途中：不正解で解説が出た状態で意見を送る
    pg.evaluate("(id) => { app.onclick = null; start([DATA.questions.find(q => q.id === id)]); }", QID); pg.wait_for_timeout(500)
    bar_ok('question')
    pg.evaluate("() => { const q = S.cur, k = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[k].click(); }"); pg.wait_for_timeout(1700)
    before = pg.evaluate("() => ({ id: S.cur.id, idx: S.idx, ng: document.querySelectorAll('.choice.ng').length, exp: !!document.querySelector('#next .exp'), locked: S.locked })")
    pg.click('#vIken'); pg.wait_for_selector('#vsheet:not([hidden])')
    chk(f'{P}:意見：送るは最初は押せない', pg.evaluate("() => document.getElementById('vsSend').disabled"))
    pg.click('.vs-chip[data-i="1"]'); pg.click('.vs-chip[data-i="3"]'); pg.fill('#vsText', 'テスト（父の確認用）ゆうた'); pg.click('#vsSend'); pg.wait_for_function("() => /とどいたよ/.test(document.getElementById('vsDone').textContent)", timeout=8000)
    pg.wait_for_selector('#vsheet[hidden]', state='attached', timeout=5000); pg.wait_for_timeout(300)
    after = pg.evaluate("() => ({ id: S.cur.id, idx: S.idx, ng: document.querySelectorAll('.choice.ng').length, exp: !!document.querySelector('#next .exp'), locked: S.locked })")
    chk(f'{P}:意見のあと解答状態が残る', before == after, [before, after])
    it = [x for p in VP() for x in p['items'] if x['kind'] == 'iken'][-1]
    chk(f'{P}:意見の中身', it['screen'] == '問題' and it['qid'] == QID and '見えない' in it['tags'][0] and it['text'].startswith('テスト') and it['size'] == f'{w}x{h}' and it['ver'], {k: it[k] for k in ('screen', 'subject', 'qid', 'state', 'size', 'ver', 'tags', 'text')})
    # おかしい！
    n0 = len(VP()); pg.click('#vOka'); pg.wait_for_timeout(1500)
    chk(f'{P}:おかしい！が1タップで送られる', len(VP()) == n0 + 1)
    ok = [x for p in VP()[n0:] for x in p['items']][0]; rp = ok['report']
    chk(f'{P}:おかしい！の中身', ok['kind'] == 'oka' and ok['qid'] == QID and all(k in rp for k in ('state', 'env', 'anomalies', 'elements', 'console', 'actions', 'dom', 'ls')) and rp['state'].get('answered') and rp['state'].get('expShown'), {'summary': ok['summary'], 'domlen': len(rp['dom']), 'actions': len(rp['actions']), 'elements': len(rp['elements']), 'env': {k: rp['env'][k] for k in ('w', 'h', 'dpr', 'safe', 'rootFont')}})
    chk(f'{P}:名前が入らない', 'ゆうた' not in json.dumps(VP()[n0], ensure_ascii=False).replace('テスト（父の確認用）ゆうた', ''))
    chk(f'{P}:DOMは60KB程度まで', len(rp['dom']) <= 60100)
    # 電波なし：端末にためて、戻ったら送る
    ctx.set_offline(True); n1 = len(VP()); pg.wait_for_timeout(2600); pg.click('#vOka'); pg.wait_for_timeout(1500)
    chk(f'{P}:電波なしは端末にたまる', len(VP()) == n1 and pg.evaluate("() => IchimonVoice.queue().length") == 1 and pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.voice.v1')).length") == 1)
    ctx.set_offline(False); pg.evaluate("() => window.dispatchEvent(new Event('online'))"); pg.wait_for_timeout(1500)
    chk(f'{P}:電波が戻ると送られて空になる', len(VP()) == n1 + 1 and pg.evaluate("() => IchimonVoice.queue().length") == 0)
    pg.screenshot(path=os.path.join(ROOT, '_shots', f'voice_{P}.png'))
    chk(f'{P}:ページエラーなし', not errs, errs[:3]); b.close()
os.makedirs(os.path.join(ROOT, '_shots'), exist_ok=True)
with sync_playwright() as pw:
    for bt, nm in ((pw.webkit, 'webkit'), (pw.chromium, 'chromium')):
        for (w, h) in ((390, 844), (320, 568)):
            if nm == 'chromium' and w == 320 and False: continue
            run(bt, nm, w, h)
bad = {k: v for k, v in R.items() if not (v if isinstance(v, bool) else v['ok'])}
print('checks', len(R), 'failed', len(bad))
for k, v in bad.items(): print('NG', k, json.dumps(v, ensure_ascii=False)[:400])
json.dump(R, open(os.path.join(ROOT, '_shots', 'voice_test.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
