# 第2段の画面テスト（headless）。python rpg/tools/ui_test3.py [port]
# ホーム上部・ナビ・ぼうけん・まち・装備・店・鍛冶・転職・技設定・外見・図鑑・実績・データ。幅390px中心(+320/430)。送信先は遮断。
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18433
OUT = os.path.join(ROOT, 'rpg', 'shots'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'checks': {}, 'console': [], 'blocked': 0}
def chk(name, cond, extra=None): R['checks'][name] = bool(cond) if extra is None else {'ok': bool(cond), 'v': extra}
def blk(r): R['blocked'] += 1; r.abort()
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
WRONG = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = 'ぜったいにちがう'; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else { const k = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[k].click(); } }"
SAVE = "() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))"
# 試験用に保存データを書き換えて読み込み直す（学習ボードへは何も送らない）
def seed(pg, js):
    pg.evaluate("(js) => { const s = JSON.parse(localStorage.getItem('ichimon.rpg.v1')); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", js)
    pg.reload(); pg.wait_for_selector('#go')
def metrics(pg):
    return pg.evaluate("""() => { const bad = [...document.querySelectorAll('button,.rs-tab,.rs-chip,.rs-sw')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5) && getComputedStyle(b).visibility !== 'hidden'; }).map(b => (b.textContent || b.className).trim().slice(0, 14) + ':' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height));
      return {hscroll: document.documentElement.scrollWidth > innerWidth, small: bad.slice(0, 5), nav: !!document.querySelector('.rs-nav')}; }""")
def shot(pg, name): pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=True)
with sync_playwright() as p:
    for engine in ('chromium', 'webkit'):
        b = getattr(p, engine).launch(headless=True)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script('window.__rangeOpen = false'); pg = ctx.new_page()
        pg.on('console', lambda m, e=engine: R['console'].append(f'{e}:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, en=engine: R['console'].append(f'{en}:pageerror:{e}'))
        pg.route('**/script.google.com/**', blk)
        pg.goto(URL); pg.wait_for_selector('#go')
        E = engine + ':'
        # --- ホーム ---
        chk(E + 'home_card', pg.query_selector('.rs-bonusrow') is not None)
        chk(E + 'home_learning_kept', pg.query_selector('#go') is not None and pg.query_selector('#hard') is not None and len(pg.query_selector_all('.subj')) >= 3)
        chk(E + 'home_nav4', len(pg.query_selector_all('.rs-nav .rs-tab')) == 4)
        chk(E + 'home_bonus2', len(pg.query_selector_all('.rs-bchip')) == 2)
        m = metrics(pg); chk(E + 'home_no_hscroll_44', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p2_home')
        # --- ぼうけん ---
        pg.click('.rs-tab[data-tab=adv]'); pg.wait_for_selector('.rs-map')
        chk(E + 'adv_map18', sum((pg.click(f'[data-ch="{c}"]'), len(pg.query_selector_all('.rs-node')))[1] for c in (1, 2, 3)) == 18)
        m = metrics(pg); chk(E + 'adv_ok', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p2_adv')
        pg.click('[data-sheet=wish]'); pg.click('[data-wish=staff]'); pg.wait_for_timeout(100)
        chk(E + 'wish_saved', pg.evaluate(SAVE)['wish'] == 'staff')
        pg.click('[data-wish=sword]'); pg.click('#rsSheetX')
        # --- まち ---
        pg.click('.rs-tab[data-tab=town]'); pg.wait_for_selector('.rs-tiles')
        chk(E + 'town_8tiles', len(pg.query_selector_all('.rs-tile')) == 8)
        m = metrics(pg); chk(E + 'town_ok', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p2_town')
        pg.click('.rs-tile[data-go=jobs]'); pg.wait_for_selector('.rs-joblist')
        chk(E + 'jobs_base4', len(pg.query_selector_all('.rs-jobcard')) == 4)
        pg.click('[data-tier=adv]'); chk(E + 'jobs_adv6', len(pg.query_selector_all('.rs-jobcard')) == 6)
        pg.click('[data-tier=top]'); chk(E + 'jobs_top2', len(pg.query_selector_all('.rs-jobcard')) == 2)
        pg.click('[data-tier=base]'); pg.click('.rs-jobcard >> nth=1'); pg.wait_for_selector('#jobDo')
        chk(E + 'job_locked_before_first', pg.get_attribute('#jobDo', 'disabled') is not None)
        # 戻る
        pg.click('#rsBack'); pg.wait_for_selector('.rs-joblist'); pg.click('.rs-tab[data-tab=town]'); pg.wait_for_selector('.rs-tiles')
        # --- 試験用データ：最初の冒険済み・コイン・素材 ---
        seed(pg, "s.firstDone = true; s.coins = 3000; s.inv.mats.ore_1 = 12; s.advXp = 2000; s.jobXp.warrior = 5000; s.stats.adventures = 3;")
        pg.click('.rs-tab[data-tab=town]'); pg.click('.rs-tile[data-go=shop]'); pg.wait_for_selector('.rs-tab2')
        pg.click('[data-pick=w_sword_1]'); pg.click('[data-buy=w_sword_1]'); pg.wait_for_timeout(100)
        sv = pg.evaluate(SAVE); chk(E + 'buy_sword', sv['inv']['items'].get('w_sword_1') == 1 and sv['coins'] == 2760, sv['coins'])
        pg.click('[data-st=armor]'); pg.click('[data-pick=a_heavy_1]'); pg.click('[data-buy=a_heavy_1]')
        pg.click('[data-st=sell]')
        chk(E + 'shop_refund_btn', pg.query_selector('[data-refund=w_sword_1]') is not None)
        m = metrics(pg); chk(E + 'shop_ok', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p2_shop')
        pg.click('[data-refund=a_heavy_1]'); chk(E + 'refund_needs_confirm', pg.evaluate(SAVE)['inv']['items'].get('a_heavy_1') == 1)
        pg.click('[data-refund=a_heavy_1]'); pg.wait_for_timeout(100)
        sv = pg.evaluate(SAVE); chk(E + 'refund_ok', 'a_heavy_1' not in sv['inv']['items'] and sv['coins'] == 2760, sv['coins'])
        pg.click('#rsBack'); pg.wait_for_selector('.rs-tiles'); pg.click('.rs-tile[data-go=equip]'); pg.wait_for_selector('#eqOk')
        # --- 装備：試着→確定するまで変わらない ---
        pg.click('[data-eq=w_sword_1]'); pg.wait_for_timeout(100)
        chk(E + 'equip_try_not_saved', pg.evaluate(SAVE)['equip']['weapon'] == 'w_start')
        chk(E + 'equip_diff_shown', pg.query_selector('.rs-up') is not None)
        m = metrics(pg); chk(E + 'equip_ok', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p2_equip')
        pg.click('#eqOk'); pg.wait_for_timeout(100)
        chk(E + 'equip_committed', pg.evaluate(SAVE)['equip']['weapon'] == 'w_sword_1')
        # --- 鍛冶 ---
        pg.click('#rsBack'); pg.wait_for_selector('.rs-tiles'); pg.click('.rs-tile[data-go=forge]'); pg.wait_for_selector('[data-enh]')
        if engine == 'chromium': shot(pg, 'p2_forge')
        pg.click('[data-enh=w_sword_1]'); pg.wait_for_timeout(100)
        sv = pg.evaluate(SAVE); chk(E + 'enhance_1', sv['inv']['enhance'].get('w_sword_1') == 1 and sv['inv']['mats']['ore_1'] == 10 and sv['coins'] == 2760 - 48, sv['coins'])
        # --- 転職：戦士→魔法使い ---
        pg.click('.rs-tab[data-tab=town]'); pg.click('.rs-tile[data-go=jobs]'); pg.wait_for_selector('.rs-joblist')
        pg.click('[data-tier=adv]'); pg.click('.rs-jobcard >> nth=0'); pg.wait_for_selector('#jobDo')
        chk(E + 'adv_locked', pg.get_attribute('#jobDo', 'disabled') is not None)
        chk(E + 'adv_req_progress', '戦士 Lv10' in pg.evaluate("() => { const c = document.querySelector('.rs-app').cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; }"))
        pg.click('#jobGoal'); pg.wait_for_timeout(100); chk(E + 'goal_saved', (pg.evaluate(SAVE).get('goal') or {}).get('job') == 'magicknight')
        if engine == 'chromium': shot(pg, 'p2_jobdetail')
        pg.click('#rsBack'); pg.click('[data-tier=base]'); pg.click('.rs-jobcard >> nth=1'); pg.wait_for_selector('#jobDo')
        pg.click('#jobDo'); pg.wait_for_selector('.rs-fx')
        if engine == 'chromium': pg.screenshot(path=os.path.join(OUT, 'p2_jobfx.png'))
        pg.click('#fxSkip'); pg.wait_for_selector('.rs-me')
        sv = pg.evaluate(SAVE); chk(E + 'job_changed', sv['job'] == 'mage' and sv['equip']['weapon'] == 'w_staff_1' and sv['inv']['items'].get('w_staff_1') == 1, [sv['job'], sv['equip']])
        # --- 技設定 ---
        pg.click('.rs-tab[data-tab=town]'); pg.click('.rs-tile[data-go=loadout]'); pg.wait_for_selector('#lkOk')
        chk(E + 'loadout_rendered', len(pg.query_selector_all('[data-sk]')) >= 1)
        pg.click('[data-tac=guard]'); pg.click('#lkOk'); pg.wait_for_timeout(100)
        sv = pg.evaluate(SAVE); chk(E + 'loadout_saved', sv['loadout']['tactic'] == 'guard' and isinstance(sv['loadout']['skills'], list), sv['loadout'])
        m = metrics(pg); chk(E + 'loadout_ok', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p2_loadout')
        # --- 外見 ---
        pg.click('.rs-tab[data-tab=me]'); pg.click('[data-go=look]'); pg.wait_for_selector('#rsName')
        pg.fill('#rsName', 'ゆうた'); pg.click('#lookOk'); pg.wait_for_timeout(100)
        sv = pg.evaluate(SAVE); chk(E + 'look_saved', sv['name'] == 'ゆうた' and sv['look'] == {'outfit': None}, [sv['name'], sv['look']])
        m = metrics(pg); chk(E + 'look_ok', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p2_look')
        # --- 図鑑・実績・データ・じぶん ---
        pg.click('.rs-tab[data-tab=me]'); pg.wait_for_selector('.rs-me')
        m = metrics(pg); chk(E + 'me_ok', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p2_me')
        pg.click('[data-go=codex]'); pg.wait_for_selector('.rs-cgrid'); chk(E + 'codex_36', len(pg.query_selector_all('.rs-cell')) >= 84)
        if engine == 'chromium': shot(pg, 'p2_codex')
        pg.click('[data-ct=item]'); chk(E + 'codex_items', len(pg.query_selector_all('.rs-item')) >= 10)
        pg.click('#rsBack'); pg.click('[data-go=ach]'); pg.wait_for_selector('.rs-item')
        chk(E + 'ach_list', len(pg.query_selector_all('.rs-item')) >= 20)
        if engine == 'chromium': shot(pg, 'p2_ach')
        pg.click('#rsBack'); pg.wait_for_selector('.rs-tiles') ; pg.click('.rs-tab[data-tab=me]'); pg.click('[data-go=settings]'); pg.wait_for_selector('#rpgExport')
        chk(E + 'data_screen', pg.query_selector('#rpgImport') is not None)
        # --- 再読込しても保持 ---
        pg.reload(); pg.wait_for_selector('#go')
        sv = pg.evaluate(SAVE); chk(E + 'reload_kept', sv['job'] == 'mage' and sv['name'] == 'ゆうた' and sv['inv']['enhance'].get('w_sword_1') == 1)
        chk(E + 'home_shows_goal', 'まじゅつ' in 'x' or '魔法戦士' in (pg.click('#rsBonusRow'), pg.wait_for_selector('#rsSheetB'), pg.inner_text('#rsSheetB'), pg.click('#rsSheetX'))[2])
        # --- 冒険を1回通す（転職後の職業で）→ 結果から装備 ---
        pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }")
        pg.wait_for_selector('.choice'); chk(E + 'question_has_no_nav', pg.query_selector('.rs-nav') is None)
        for _ in range(40):
            if pg.query_selector('#rwRoot'): break
            is_rv = pg.evaluate("() => !!S.cur._rv")
            pg.evaluate(CORRECT)
            pg.wait_for_timeout(750)
        pg.wait_for_selector('#rwRoot', timeout=8000)
        chk(E + 'reward_equip_link', pg.query_selector('#rwEquip') is not None)
        pg.click('#rwEquip'); pg.wait_for_selector('#eqOk'); chk(E + 'result_to_equip', True)
        pg.click('#rsBack'); pg.wait_for_selector('.rs-bonusrow'); chk(E + 'equip_back_to_home', True)
        # 冒険中（途中）の変更不可
        pg.evaluate("() => { filter = '社会'; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice')
        pg.evaluate(CORRECT); pg.wait_for_timeout(800)
        pg.click('#quit'); pg.wait_for_selector('#go')
        pg.click('.rs-tab[data-tab=me]'); pg.click('[data-go=equip]'); pg.wait_for_selector('#eqOk')
        chk(E + 'equip_locked_in_adventure', pg.get_attribute('#eqOk', 'disabled') is not None)
        b.close()
    # 幅320/375/430 の はみ出し
    b = p.chromium.launch(headless=True)
    for w in (320, 375, 430):
        ctx = b.new_context(viewport={'width': w, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); ctx.add_init_script('window.__rangeOpen = false'); pg = ctx.new_page()
        pg.route('**/script.google.com/**', blk)
        pg.on('console', lambda m, w=w: R['console'].append(f'w{w}:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.goto(URL); pg.wait_for_selector('#go')
        seed(pg, "s.firstDone = true; s.coins = 3000; s.stats.adventures = 3; s.jobXp.warrior = 6000; s.jobXp.mage = 6000;")
        bad = {}
        for name, act in (('home', None), ('adv', "RPG.go('adv')"), ('town', "RPG.go('town')"), ('me', "RPG.go('me')"), ('equip', "RPG.go('equip')"), ('shop', "RPG.go('shop')"), ('forge', "RPG.go('forge')"), ('jobs', "RPG.go('jobs')"), ('loadout', "RPG.go('loadout')"), ('look', "RPG.go('look')"), ('codex', "RPG.go('codex')"), ('ach', "RPG.go('ach')"), ('jd', "RPG.go('jobdetail', {job: 'magicknight'})")):
            if act: pg.evaluate('() => ' + act)
            m = metrics(pg)
            if m['hscroll'] or m['small']: bad[name] = m
        chk(f'w{w}:all_screens_fit', not bad, bad)
        ctx.close()
    b.close()
R['blocked_send_requests'] = R['blocked']
srv.shutdown()
json.dump(R, open(os.path.join(OUT, 'ui_test3.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = {k: v for k, v in R['checks'].items() if v is False or (isinstance(v, dict) and 'ok' in v and not v['ok'])}
print(json.dumps({'failed': bad, 'console': R['console'][:10], 'n': len(R['checks']), 'blocked': R['blocked']}, ensure_ascii=False, indent=1)[:3500])
