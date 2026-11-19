# 探索地図の画面テスト（headless、chromium＋webkit、幅390px）。python rpg/tools/ui_test_map.py [port]
# ぼうけん→ちず→探索地図。試験用セーブ（初日／第1章末／本編末／クリア後）で撮り、shots/assets_explore_*.png に保存。送信先は遮断。
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18436
OUT = os.path.join(ROOT, 'rpg', 'shots'); os.makedirs(OUT, exist_ok=True)
SAVES = os.path.join(ROOT, 'rpg', 'tests', 'saves')
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'checks': {}, 'console': [], 'blocked': 0}
def chk(name, cond, extra=None): R['checks'][name] = bool(cond) if extra is None else {'ok': bool(cond), 'v': extra}
def blk(r): R['blocked'] += 1; r.abort()
def put(pg, name, patch=''):
    o = json.load(open(os.path.join(SAVES, name + '.json'), encoding='utf-8'))
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [json.dumps(o), patch])
    pg.reload(); pg.wait_for_selector('.subj', state='attached')
def shot(pg, name): pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=True)
MET = """() => {
  const small = [...document.querySelectorAll('.rs button, .rs summary')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44); }).map(b => (b.className || b.id) + ':' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height));
  const box = document.getElementById('rsMapBox'); let out = 0;
  if (box) { const bb = box.getBoundingClientRect(); box.querySelectorAll('.rs-mn,.rs-mhero,.rs-mboss').forEach(e => { const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; if (cx < bb.left || cx > bb.right || cy < bb.top || cy > bb.bottom) out++; }); }
  return { hscroll: document.documentElement.scrollWidth > innerWidth, small, out, nodes: document.querySelectorAll('.rs-mn').length, done: document.querySelectorAll('.rs-mn.done').length, cur: document.querySelectorAll('.rs-mn.cur').length, lock: document.querySelectorAll('.rs-mn.lock').length,
    hero: !!document.getElementById('rsMapHero'), chestOpen: !!document.querySelector('.rs-mboss.open'), chest: !!document.getElementById('rsMapBoss'), imgOk: (() => { const i = document.querySelector('.rs-mapimg'); return !!i && i.complete && i.naturalWidth === 240; })(), rows: document.querySelectorAll('.rs-mrow').length, screen: RPG.screenName() }; }"""
def open_map(pg, key):
    pg.evaluate(f"() => RPG.go('regionmap', {{id: '{key}'}})"); pg.wait_for_selector('#rsMapBox'); pg.wait_for_function("() => { const i = document.querySelector('.rs-mapimg'); return i && i.complete; }"); pg.wait_for_timeout(120)
    return pg.evaluate(MET)
with sync_playwright() as p:
    for engine in ('chromium', 'webkit'):
        E = engine + ':'
        b = getattr(p, engine).launch(headless=True)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script('window.__rangeOpen = false'); pg = ctx.new_page()
        pg.on('console', lambda m, e=engine: R['console'].append(f'{e}:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, en=engine: R['console'].append(f'{en}:pageerror:{e}'))
        pg.route('**/script.google.com/**', blk)
        pg.goto(URL); pg.wait_for_selector('.subj', state='attached')
        first = engine == 'chromium'
        # ===== 初日：せかいちずの「ちず」ボタン → 草原（2/3区間）=====
        put(pg, 'day01', "s.progress.quest = null; s.active = null;")
        pg.click('.rs-tab[data-tab=adv]'); pg.wait_for_selector('.rs-map')
        chk(E + 'world_buttons_6(08: 冒険は章ごとに切り替え。第1章の6地域)', len(pg.query_selector_all('.rs-mapbtn')) == 6, len(pg.query_selector_all('.rs-mapbtn')))
        pg.click('.rs-mapbtn[data-p*=meadow]'); pg.wait_for_selector('#rsMapBox'); pg.wait_for_timeout(200)
        m = pg.evaluate(MET); chk(E + 'day01_meadow', m['screen'] == 'regionmap' and m['nodes'] == 4 and m['done'] == 0 and m['cur'] == 1 and m['hero'] and m['imgOk'] and not m['chestOpen'] and m['chest'], m)
        chk(E + 'day01_fit', not m['hscroll'] and not m['small'] and m['out'] == 0, m)
        txt = pg.inner_text('#rsMapDet'); chk(E + 'day01_detail_progress', '2 / 3' in txt, txt)
        if first: shot(pg, 'assets_explore_day01')
        pg.click('.rs-mn[data-mn="3"]'); pg.wait_for_timeout(80)
        chk(E + 'tap_boss_node_detail', 'ボス：' in pg.inner_text('#rsMapDet') and 'まだ' in pg.inner_text('#rsMapDet'))
        pg.click('#rsBack'); pg.wait_for_selector('.rs-map'); chk(E + 'back_to_adv', pg.evaluate('() => RPG.screenName()') == 'adv')
        pg.click('[data-go=regionmap][data-p*=meadow]:not(.rs-mapbtn)'); pg.wait_for_selector('#rsMapBox'); chk(E + 'now_button_opens_current', pg.evaluate(MET)['hero'])
        m = open_map(pg, 'worldtree'); chk(E + 'locked_region', m['lock'] == 7 and m['done'] == 0 and m['cur'] == 0 and not m['hero'] and m['nodes'] == 7, m)
        # ===== 第1章末：第2章の最初（地底樹海）と、クリア済みの草原 =====
        put(pg, 'ch1end', "s.progress.quest = null; s.active = null;")
        m = open_map(pg, 'rootwood'); chk(E + 'ch1end_rootwood', m['nodes'] == 5 and m['cur'] == 1 and m['hero'] and not m['small'] and not m['hscroll'] and m['out'] == 0, m)
        if first: shot(pg, 'assets_explore_ch1end')
        m = open_map(pg, 'meadow'); chk(E + 'ch1end_meadow_cleared', m['done'] == 4 and m['cur'] == 0 and not m['hero'] and m['chestOpen'], m)
        if first: shot(pg, 'assets_explore_ch1end_meadow')
        # 再戦中：元の地域でボスに主人公
        put(pg, 'ch1end', "s.progress.quest = 'rematch_meadow'; s.active = null;")
        m = open_map(pg, 'meadow'); chk(E + 'rematch_hero_at_boss', m['hero'] and m['cur'] == 1, m)
        # ===== 本編末：最後の地域（王冠）=====
        put(pg, 'maingoal', "s.active = null;")
        m = open_map(pg, 'crown'); chk(E + 'maingoal_crown', m['nodes'] == 7 and m['done'] == 7 and m['chestOpen'] and not m['hscroll'] and not m['small'] and m['out'] == 0, m)
        if first: shot(pg, 'assets_explore_maingoal')
        # ===== クリア後：秘境（途中）・孤島（クリア済み）=====
        put(pg, 'postgame', "s.active = null; s.quests.secret_pearl = {step: 5, enemyHp: null, count: 0, cleared: false}; s.progress.quest = 'secret_pearl';")
        m = open_map(pg, 'secret_pearl'); chk(E + 'post_pearl_progress', m['nodes'] == 5 and m['done'] == 1 and m['cur'] == 1 and m['hero'] and m['out'] == 0 and not m['small'], m)
        if first: shot(pg, 'assets_explore_post_pearl')
        m = open_map(pg, 'island'); chk(E + 'post_island_cleared', m['nodes'] == 7 and m['done'] == 7 and m['chestOpen'] and not m['hscroll'] and not m['small'] and m['out'] == 0, m)
        if first: shot(pg, 'assets_explore_post_island')
        pg.evaluate("() => RPG.go('adv')"); pg.wait_for_selector('.rs-map')
        pg.click('[data-sheet=quests]'); pg.wait_for_timeout(300)   # 08：クエストは冒険画面のシートに移った
        chk(E + 'quest_map_buttons_7', len(pg.query_selector_all('.rs-mini')) == 7, len(pg.query_selector_all('.rs-mini')))
        pg.click('.rs-mini >> nth=0'); pg.wait_for_selector('#rsMapBox'); chk(E + 'quest_button_opens_map', pg.evaluate(MET)['screen'] == 'regionmap')
        # ===== 全25枚が開き、はみ出さない（初日・クリア後）=====
        bad = {}
        put(pg, 'postgame', "s.active = null; s.progress.quest = null;")
        keys = pg.evaluate("() => [...RPGData.REGIONS.map(r => r.id), ...RPGWorld.QUEST_ORDER.filter(k => /^secret_|^island$/.test(k))]")
        for k in keys:
            m = open_map(pg, k)
            if not (m['imgOk'] and m['nodes'] >= 4 and m['out'] == 0 and not m['small'] and not m['hscroll'] and m['rows'] == m['nodes']): bad[k] = m
        chk(E + 'all_25_maps_ok', len(keys) == 25 and not bad, {'n': len(keys), 'bad': bad})
        # 学習画面・冒険帯への影響なし（ホーム→学習開始の寸法は regress.py が確認）。ここでは地図を出したあとホームに戻れること
        pg.evaluate("() => RPG.go('regionmap', {id: 'meadow'})"); pg.click('.rs-tab[data-tab=home]'); pg.wait_for_selector('.subj', state='attached'); chk(E + 'home_after_map', True)
        ctx.close(); b.close()
srv.shutdown()
json.dump(R, open(os.path.join(OUT, 'ui_test_map.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = {k: v for k, v in R['checks'].items() if v is False or (isinstance(v, dict) and 'ok' in v and not v['ok'])}
print(json.dumps({'failed': bad, 'console': R['console'][:10], 'n': len(R['checks']), 'blocked': R['blocked']}, ensure_ascii=False, indent=1)[:4000])
