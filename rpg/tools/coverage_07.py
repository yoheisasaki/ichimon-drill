# 07 A07/A08/A09：主人公12職×衣装(通常/マスター/追加)×ポーズ×用途の描き方一覧（部品で描けるか、1枚絵に戻るか）と、画像の無い敵の有無。headless。
# python rpg/tools/coverage_07.py → rpg/shots/fix07_tests/coverage.json
import threading, http.server, socketserver, functools, json, os
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', 18497), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
ALL = "() => RPGSprites.coverage(RPGData.JOB_IDS, [null, 'master', 'alt1'], ['self', 'strip'])"
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); pg = b.new_context().new_page()
    pg.goto('http://127.0.0.1:18497/index.html?nosend=1&devcheck=1'); pg.wait_for_function("() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766", timeout=90000)
    pg.evaluate(ALL); pg.wait_for_timeout(6000)   # 1回目で部品を読み込み、2回目で判定
    r = pg.evaluate("(src) => { const cov = (new Function('return ' + src))()(); const by = {}; cov.forEach(e => { const k = (e.costume || 'base') + ':' + e.mode; by[k] = (by[k] || 0) + 1; }); const advWhole = cov.filter(e => e.mode !== 'layered').every(e => e.costume === 'alt1' && !['magicknight','paladin','shadow','sage','ninja','ranger'].includes(e.job)); const rep = RPGSprites.devReport(); return { n: cov.length, by, nonLayeredOnlyAltOfNonAdvJobs: advWhole, parts: rep.parts, enemyMissing: rep.enemyMissing, missing: rep.missing }; }", ALL)
    b.close()
json.dump(r, open(os.path.join(ROOT, 'rpg', 'shots', 'fix07_tests', 'coverage.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(json.dumps(r, ensure_ascii=False))
