# 07 D05：レア箱／素材箱／コイン箱／重複レアの開封画面を撮る（headless chromium、390px、nosend=1）。python rpg/tools/d05_chests.py [port]
# 抽選結果を固定して（箱の roll を書き換えて）開封する。開封の処理・表示は実物。結果は rpg/shots/fix07_d05/result.json
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18481
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix07_d05'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'cases': {}, 'console': [], 'blocked': 0}
def blk(r): R['blocked'] += 1; r.abort()
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
CASES = {
  'rare': ({'kind': 'rare', 'rank': 1, 'wish': 'sword', 'pityBefore': 0, 'item': 'rw_sword_1'}, False),
  'rare_dup': ({'kind': 'rare', 'rank': 1, 'wish': 'sword', 'pityBefore': 0, 'item': 'rw_sword_1'}, True),
  'mat': ({'kind': 'mat', 'rank': 1, 'wish': 'sword', 'pityBefore': 0, 'mats': {'ore_1': 4}}, False),
  'coin': ({'kind': 'coinmat', 'rank': 1, 'wish': 'sword', 'pityBefore': 0, 'coin': 40, 'mats': {'ore_1': 2}}, False),
}
TX = "(s) => { const e = document.querySelector(s); if (!e) return null; const c = e.cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent.trim(); }"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for name, (roll, dup) in CASES.items():
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); ctx.add_init_script('window.__rangeOpen = true')
        pg = ctx.new_page(); pg.set_default_timeout(30000)
        pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
        pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}')); pg.route('**/script.google.com/**', blk)
        pg.goto(URL); pg.wait_for_selector('.subj'); pg.wait_for_function("() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766", timeout=90000); pg.wait_for_timeout(500)
        if dup: pg.evaluate("() => { RPG.save.inv.items.rw_sword_1 = 1; RPG.save.codex.items.rw_sword_1 = 1; RPG.persist(); }")
        pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice')
        for _ in range(40):
            if pg.query_selector('#rwRoot'): break
            pg.evaluate(CORRECT); pg.wait_for_timeout(750)
        pg.wait_for_selector('#rwRoot', timeout=8000); pg.wait_for_timeout(500)
        pg.evaluate("(roll) => { const c = RPG.save.chests[RPG.save.chests.length - 1]; c.roll = roll; RPG.persist(); }", roll)
        s0 = pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))"); pg.screenshot(path=os.path.join(OUT, f'{name}_1_sealed.png'), full_page=True)
        pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')", timeout=5000); pg.wait_for_timeout(600)
        s1 = pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))"); pg.screenshot(path=os.path.join(OUT, f'{name}_2_opened.png'), full_page=True)
        pg.locator('#rwDrop').screenshot(path=os.path.join(OUT, f'{name}_3_card.png'))
        c = s1['chests'][-1]
        R['cases'][name] = {'line': pg.evaluate(TX, '#rwChestLine'), 'total': pg.evaluate(TX, '#rwTotal'), 'status': c['status'], 'result': c.get('result'),
                            'coin_delta': s1['coins'] - s0['coins'], 'ore1_delta': (s1['inv']['mats'].get('ore_1', 0)) - (s0['inv']['mats'].get('ore_1', 0)),
                            'rare_count': s1['inv']['items'].get('rw_sword_1', 0), 'hscroll': pg.evaluate("() => document.documentElement.scrollWidth > innerWidth")}
        ctx.close()
    b.close()
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps(R, ensure_ascii=False, indent=1))
