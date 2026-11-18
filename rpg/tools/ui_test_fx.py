# pixelfx 技エフェクトの画面確認（headless）。python rpg/tools/ui_test_fx.py [port]
# ・全エフェクトの読み込み ・帯で技が出た瞬間のスクショ ・報酬画面（勝利）のスクショ ・1フレーム描画時間 ・コンソールエラー0
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18452
OUT = os.path.join(ROOT, 'rpg', 'shots'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'checks': {}, 'console': [], 'blocked': 0, 'perf': {}}
def chk(name, cond, extra=None): R['checks'][name] = bool(cond) if extra is None else {'ok': bool(cond), 'v': extra}
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
def blk(r): R['blocked'] += 1; r.abort()
KEYS = "Object.keys(RPGFX.FX)"
with sync_playwright() as p:
    for engine in ('chromium', 'webkit'):
        b = getattr(p, engine).launch(headless=True)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page()
        pg.on('console', lambda m, e=engine: R['console'].append(f'{e}:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, en=engine: R['console'].append(f'{en}:pageerror:{e}'))
        pg.route('**/script.google.com/**', blk)
        pg.goto(URL); pg.wait_for_selector('.subj')
        pg.wait_for_function("() => RPGFX.state === 'ready' || RPGFX.state === 'failed'", timeout=15000)
        chk(engine + ':fx_ready', pg.evaluate("() => RPGFX.state") == 'ready', pg.evaluate("() => RPGFX.state"))
        chk(engine + ':all_mods', pg.evaluate("() => Object.keys(RPGFX.FX).every(k => RPGFX.ready(k))"), pg.evaluate("() => Object.keys(RPGFX._S.failed)"))
        # 全エフェクトを描いて1フレームの描画時間を測る（オフスクリーン。帯サイズ）
        perf = pg.evaluate("""() => { const out = {}; const cv = document.createElement('canvas'); cv.width = 400; cv.height = 90; const g = cv.getContext('2d');
          for (const k of Object.keys(RPGFX.FX)) { const f = RPGFX.spawn(k, { cap: 0.9 }); let n = 0, tot = 0, mx = 0; for (let i = 0; i < 40 && !f.done(); i++) { const t0 = performance.now(); f.update(1/60); f.update(1/60); g.clearRect(0,0,400,90); f.blit(g, 100, 80, 1, 1, 2); const d = performance.now() - t0; tot += d; mx = Math.max(mx, d); n++; }
            out[k] = { avg: +(tot / n).toFixed(2), max: +mx.toFixed(2), n }; } return out; }""")
        R['perf'][engine] = perf
        chk(engine + ':frame_avg_lt_10ms', max(v['avg'] for v in perf.values()) < 10, max(v['avg'] for v in perf.values()))
        # 帯：学習開始→技の瞬間
        pg.evaluate("() => { window.__rs = []; const o = RPG.bindReward; RPG.bindReward = function (r) { window.__res = r; return o.apply(this, arguments); }; filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }")
        pg.wait_for_selector('.choice'); pg.wait_for_timeout(300)
        box = pg.evaluate("() => { const r = document.querySelector('.rpg-strip').getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; }")
        for skill, tag in (('m_fire', 'fire'), ('w_strike', 'slash'), ('p_heal', 'heal'), ('mk_rainbow', 'nova')):
            pg.evaluate("(s) => RPG.play([{ t: 'hero', act: s, dmg: 20, heal: 5 }])", skill)
            pg.wait_for_timeout(330)
            pg.screenshot(path=os.path.join(OUT, f'assets_pixelfx_strip_{tag}_{engine}.png'), clip={'x': 0, 'y': box['y'] - 8, 'width': 390, 'height': box['h'] + 16})
            pg.wait_for_timeout(1400)
        # 技が出ている間の rAF 間隔（遅くならないか）
        gaps = pg.evaluate("""() => new Promise(res => { RPG.play([{ t: 'hero', act: 'mk_rainbow', dmg: 20, heal: 0 }]); const g = []; let last = performance.now(), n = 0; const f = now => { g.push(now - last); last = now; if (++n < 70) requestAnimationFrame(f); else res(g); }; requestAnimationFrame(f); })""")
        gs = sorted(gaps[1:]); R['perf'][engine + ':raf'] = {'median': round(gs[len(gs)//2], 1), 'p95': round(gs[int(len(gs)*.95)], 1), 'max': round(gs[-1], 1)}
        pg.wait_for_timeout(1000)
        # 答えを最後まで進めて報酬画面へ
        for _ in range(40):
            if pg.query_selector('#rwRoot'): break
            pg.evaluate(CORRECT); pg.wait_for_timeout(760)
        pg.wait_for_selector('#rwRoot', timeout=8000)
        pg.wait_for_timeout(500)
        pg.evaluate("() => RPG.bindReward(Object.assign({}, window.__res, { outcome: 'victory' }))")
        sc = pg.evaluate("() => { const r = document.getElementById('rwCanvas').getBoundingClientRect(); return {x: r.x, y: r.y + scrollY, w: r.width, h: r.height}; }")
        pg.wait_for_timeout(750)
        pg.screenshot(path=os.path.join(OUT, f'assets_pixelfx_reward_{engine}.png'), full_page=True, clip={'x': sc['x'], 'y': sc['y'], 'width': sc['w'], 'height': sc['h']})
        pg.wait_for_timeout(2200)
        pg.screenshot(path=os.path.join(OUT, f'assets_pixelfx_reward_end_{engine}.png'), full_page=True, clip={'x': sc['x'], 'y': sc['y'], 'width': sc['w'], 'height': sc['h']})
        chk(engine + ':reward_ok', pg.query_selector('#rwRoot') is not None)
        # フォールバック：pixelfx が読めなかった場合でも帯が動く（モジュールを消して確認）
        pg2 = ctx.new_page(); pg2.on('pageerror', lambda e, en=engine: R['console'].append(f'{en}:pageerror(fallback):{e}'))
        pg2.route('**/vendor/pixelfx/**', lambda r: r.abort()); pg2.route('**/script.google.com/**', blk)
        pg2.goto(URL); pg2.wait_for_selector('.subj'); pg2.wait_for_function("() => RPGFX.state === 'failed'", timeout=15000)
        pg2.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }")
        pg2.wait_for_selector('.choice'); pg2.wait_for_timeout(300)
        pg2.evaluate("() => RPG.play([{ t: 'hero', act: 'm_fire', dmg: 20, heal: 0 }])"); pg2.wait_for_timeout(330)
        pg2.screenshot(path=os.path.join(OUT, f'assets_pixelfx_fallback_{engine}.png'), clip={'x': 0, 'y': box['y'] - 8, 'width': 390, 'height': box['h'] + 16})
        chk(engine + ':fallback_state', pg2.evaluate("() => RPGFX.state") == 'failed')
        pg2.close(); b.close()
R['console_errors'] = [c for c in R['console'] if 'pixelfx' not in c and 'Failed to load resource' not in c and 'ERR_FAILED' not in c]
print(json.dumps(R, ensure_ascii=False, indent=1))
bad = [k for k, v in R['checks'].items() if not (v if isinstance(v, bool) else v['ok'])]
print('FAIL:', bad, 'console_errors:', len(R['console_errors']))
