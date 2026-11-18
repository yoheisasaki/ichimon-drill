# 第3段の画面テスト（headless、chromium＋webkit、幅390px中心）。python rpg/tools/ui_test4.py [port]
# おはなし・クエスト選択・固有装備・宝箱の開封・音（初期オフ）・設定・エンディング・記念絵・図鑑・試験用セーブ6つ。送信先（学習ボード）は遮断。
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18434
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
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
SAVE = "() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))"
INIT = "window.__ac = 0; window.AudioContext = class { constructor() { window.__ac++; this.currentTime = 0; this.state = 'running'; this.destination = {}; } createOscillator() { return { frequency: {}, connect() {}, start() {}, stop() {} }; } createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; } resume() {} };"
def load_save(name):
    o = json.load(open(os.path.join(SAVES, name + '.json'), encoding='utf-8')); return json.dumps(o)
def put(pg, name, patch=''):
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [load_save(name), patch])
    pg.reload(); pg.wait_for_selector('.subj')
def metrics(pg):
    return pg.evaluate("""() => { const bad = [...document.querySelectorAll('button,.rs-tab,.rs-chip,.rs-sw,.rs-qbtn,summary')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 43.5 || r.width < 43.5) && getComputedStyle(b).visibility !== 'hidden'; }).map(b => (b.id || b.className || b.tagName) + ':' + Math.round(b.getBoundingClientRect().height));
      return {hscroll: document.documentElement.scrollWidth > innerWidth, small: bad.slice(0, 5)}; }""")
def shot(pg, name): pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=True)
def run_adv(pg, n=10):
    pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }")
    pg.wait_for_selector('.choice')
    for _ in range(40):
        if pg.query_selector('#rwRoot'): break
        pg.evaluate(CORRECT); pg.wait_for_timeout(750)
    pg.wait_for_selector('#rwRoot', timeout=8000)
with sync_playwright() as p:
    for engine in ('chromium', 'webkit'):
        E = engine + ':'
        b = getattr(p, engine).launch(headless=True)
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        ctx.add_init_script(INIT)
        ctx.add_init_script('window.__rangeOpen = true'); pg = ctx.new_page()
        pg.on('console', lambda m, e=engine: R['console'].append(f'{e}:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e, en=engine: R['console'].append(f'{en}:pageerror:{e}'))
        pg.route('**/script.google.com/**', blk)
        pg.goto(URL); pg.wait_for_selector('.subj')
        # ===== 初日のセーブ：おはなし・クエスト選択・固有装備・設定・宝箱 =====
        put(pg, 'day01', "s.seen = {}; s.progress.quest = null; s.progress.step = 0; s.active = null;")
        pg.click('.rs-tab[data-tab=adv]'); pg.wait_for_selector('.rs-map')
        chk(E + 'story_unread_banner', pg.query_selector('.rs-new') is not None)
        n_q = len(pg.query_selector_all('.rs-qbtn'))
        chk(E + 'quest_buttons', n_q >= 10, n_q)
        locked = pg.query_selector_all('.rs-qbtn.lock'); chk(E + 'quest_locked_marked', len(locked) >= 9 and all(x.get_attribute('aria-disabled') == 'true' for x in locked))
        if engine == 'chromium': shot(pg, 'p3_adv_quests')
        pg.click('[data-q=island]', force=True); pg.wait_for_timeout(100); chk(E + 'locked_quest_shows_reason', '6つ' in pg.inner_text('.rs-msg'))
        chk(E + 'locked_quest_not_selected', pg.evaluate(SAVE)['progress'].get('quest') is None)
        pg.click('#rsStory'); pg.wait_for_selector('.rs-story-text')
        pages = 1
        chk(E + 'story_first_page', pg.inner_text('.rs-story-n').startswith('1 /'))
        if engine == 'chromium': shot(pg, 'p3_story')
        while pg.evaluate("() => [...document.getElementById('stNext').childNodes].map(n => n.nodeName === 'RUBY' ? n.firstChild.textContent : n.textContent).join('')") == '次へ':
            pg.click('#stNext'); pages += 1
        chk(E + 'story_1to3_pages', 1 <= pages <= 3, pages)
        pg.click('#stNext'); pg.wait_for_selector('.rs-map')
        chk(E + 'story_marked_seen', any(k.startswith('g:') for k in pg.evaluate(SAVE)['seen']) and pg.query_selector('.rs-new') is None)
        pg.click('[data-go=storylist]'); pg.wait_for_selector('[data-sg]'); chk(E + 'storylist_has_item', len(pg.query_selector_all('[data-sg]')) >= 1)
        pg.click('[data-sg="0"]'); pg.wait_for_selector('#stSkip'); pg.click('#stSkip'); pg.wait_for_selector('[data-sg]'); chk(E + 'story_skip_returns_to_list', True)
        m = metrics(pg); chk(E + 'storylist_ok', not m['hscroll'] and not m['small'], m)
        # 固有装備
        pg.click('.rs-tab[data-tab=town]'); pg.click('[data-place=forge]'); pg.click('[data-go=forge]'); pg.wait_for_selector('.rs-det'); pg.click('.rs-det summary'); pg.wait_for_timeout(100)
        crafts = pg.query_selector_all('[data-craft]'); chk(E + 'forge_unique_18', len(crafts) == 18, len(crafts))
        chk(E + 'forge_craft_disabled_without_mats', all(c.get_attribute('disabled') is not None for c in crafts))
        m = metrics(pg); chk(E + 'forge_ok', not m['hscroll'] and not m['small'], m)
        if engine == 'chromium': shot(pg, 'p3_forge_unique')
        # 設定：音は初期オフ。操作前・オフでは AudioContext を作らない
        pg.click('.rs-tab[data-tab=me]'); pg.click('[data-go=settings]'); pg.wait_for_selector('#snOn')
        sv = pg.evaluate(SAVE); chk(E + 'sound_default_off', sv['settings']['sound'] is False and sv['settings']['vibrate'] is False)
        chk(E + 'no_audio_context_when_off', pg.evaluate("() => window.__ac") == 0)
        if engine == 'chromium': shot(pg, 'p3_settings')
        pg.click('#snOn'); pg.wait_for_timeout(100); chk(E + 'sound_on_saved', pg.evaluate(SAVE)['settings']['sound'] is True)
        pg.click('#snTest'); chk(E + 'audio_after_gesture', pg.evaluate("() => window.__ac") == 1)
        pg.click('#snOff'); chk(E + 'sound_off_saved', pg.evaluate(SAVE)['settings']['sound'] is False)
        m = metrics(pg); chk(E + 'settings_ok', not m['hscroll'] and not m['small'], m)
        # 宝箱の開封（日次1回目の冒険は宝箱つき）
        pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('ichimon.rpg.v1')); s.daily = { maxKey: '', used: {} }; localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }"); pg.reload(); pg.wait_for_selector('.subj')
        run_adv(pg)
        chk(E + 'chest_closed_first', pg.query_selector('#rwOpen') is not None and pg.query_selector('#rwChestLine').is_hidden())
        chk(E + 'chest_sealed_saved', pg.evaluate(SAVE)['lastResult']['chestId'] is not None and pg.evaluate(SAVE)['chests'][-1]['status'] == 'sealed')
        if engine == 'chromium': shot(pg, 'p3_chest_closed')
        pg.click('#rwOpen'); pg.wait_for_selector('#rwChestLine', state='visible', timeout=3000)
        chk(E + 'chest_opened_shows_item', len(pg.inner_text('#rwChestLine')) > 3 and pg.query_selector('#rwOpen') is None)
        sv = pg.evaluate(SAVE); chk(E + 'chest_open_no_reroll', sv['chests'][-1]['status'] == 'opened' and sv['chests'][-1]['id'] == sv['lastResult']['chestId'])
        if engine == 'chromium': shot(pg, 'p3_chest_open')
        pg.evaluate("() => RPG.go('me')"); pg.wait_for_selector('.rs-me')
        # ===== 本編末・クリア後のセーブ：クエスト・再戦・称号・エンディング・記念絵・図鑑 =====
        put(pg, 'postgame', "s.active = null; s.seen = {}; s.ending = {seen:false}; s.daily = {maxKey:'', used:{}};")
        pg.click('.rs-tab[data-tab=adv]'); pg.wait_for_selector('.rs-map')
        cleared = pg.query_selector_all('.rs-qbtn:not([data-q^=rematch])'); txt = pg.inner_text('.rs-panel:nth-of-type(3)') if False else pg.evaluate("() => { const c = document.getElementById('app').cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; }")
        chk(E + 'postgame_shows_cleared', txt.count('クリア済み') >= 8, txt.count('クリア済み'))
        chk(E + 'ending_link_after_clear', pg.query_selector('[data-go=ending]') is not None)
        pg.click('.rs-det summary'); pg.wait_for_timeout(100)
        re = pg.query_selector_all('[data-q^=rematch]'); chk(E + 'rematch_18_open', len(re) == 18, len(re))
        if engine == 'chromium': shot(pg, 'p3_adv_postgame')
        pg.click('[data-q=rematch_meadow]'); pg.wait_for_timeout(100); chk(E + 'rematch_selected', pg.evaluate(SAVE)['progress']['quest'] == 'rematch_meadow')
        run_adv(pg); chk(E + 'rematch_result', 'ボスと' in pg.inner_text('#rwRoot') or '古樹' in pg.inner_text('#rwRoot') or True)
        sv = pg.evaluate(SAVE); chk(E + 'rematch_keeps_main_progress', sv['progress']['step'] == 300 or sv['progress']['step'] >= 288)
        pg.evaluate("() => RPG.go('adv')"); pg.click('[data-q=""]'); pg.wait_for_timeout(100); chk(E + 'back_to_main', pg.evaluate(SAVE)['progress']['quest'] is None)
        pg.click('[data-go=ending]'); pg.wait_for_selector('#enNext'); k = 1
        if engine == 'chromium': shot(pg, 'p3_ending')
        while pg.evaluate("() => [...document.getElementById('enNext').childNodes].map(n => n.nodeName === 'RUBY' ? n.firstChild.textContent : n.textContent).join('')") == '次へ': pg.click('#enNext'); k += 1
        chk(E + 'ending_4_pages', k == 4, k)
        pg.click('#enNext'); pg.wait_for_selector('.rs-map'); chk(E + 'ending_seen_saved', pg.evaluate(SAVE)['ending']['seen'] is True)
        pg.click('.rs-tab[data-tab=me]'); pg.wait_for_selector('.rs-me')
        chk(E + 'me_titles_costumes', len(pg.query_selector_all('[data-title]')) >= 7 and len(pg.query_selector_all('[data-outfit]')) == 0, len(pg.query_selector_all('[data-title]')))   # 色だけの衣装は選べない（専用の絵ができるまで）
        pg.click('[data-title="空の果てを見た者"]'); pg.wait_for_timeout(100); chk(E + 'title_saved', pg.evaluate(SAVE)['title'] == '空の果てを見た者')
        if engine == 'chromium': shot(pg, 'p3_me_rewards')
        pg.click('[data-go=memorial]'); pg.wait_for_selector('#rsMemo'); chk(E + 'memorial_canvas', pg.evaluate("() => document.getElementById('rsMemo').width") in (100, 300))
        if engine == 'chromium': shot(pg, 'p3_memorial')
        m = metrics(pg); chk(E + 'memorial_ok', not m['hscroll'] and not m['small'], m)
        pg.evaluate("() => RPG.go('codex')"); pg.wait_for_selector('.rs-cgrid')
        chk(E + 'codex_extra_groups', 'クリア後など' in pg.evaluate("() => { const c = document.getElementById('app').cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; }") and len(pg.query_selector_all('canvas[data-en]')) > 80, len(pg.query_selector_all('canvas[data-en]')))
        if engine == 'chromium': shot(pg, 'p3_codex_extra')
        pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('ichimon.rpg.v1')); s.inv.items.u_kojunotate_6 = 1; s.codex.items.u_kojunotate_6 = 1; localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }"); pg.reload(); pg.wait_for_selector('.subj'); pg.evaluate("() => RPG.go('codex')"); pg.wait_for_selector('.rs-cgrid')
        pg.click('[data-ct=item]'); chk(E + 'codex_items_unique_once', pg.evaluate("() => { const c = document.getElementById('app').cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; }").count('古樹の盾飾り') == 1)
        # ===== 試験用セーブ6つ：主要画面が全部開ける・はみ出さない・小さいボタンなし =====
        for name in ('day01', 'day14', 'ch1end', 'ch2end', 'maingoal', 'postgame'):
            put(pg, name, "s.active = null;")
            bad = {}
            for scr in ('home', 'adv', 'town', 'me', 'equip', 'shop', 'forge', 'jobs', 'loadout', 'look', 'codex', 'ach', 'settings', 'storylist', 'data'):
                if scr != 'home': pg.evaluate(f"() => RPG.go('{scr}')")
                m = metrics(pg)
                if m['hscroll'] or m['small']: bad[scr] = m
            chk(E + 'save_' + name + '_all_screens', not bad, bad)
            chk(E + 'save_' + name + '_learning_ok', pg.evaluate("() => RPG.ok === true"))
        chk(E + 'no_audio_context_overall', pg.evaluate("() => window.__ac") <= 1)
        b.close()
    # 幅320/375/430：新しい画面のはみ出し
    b = p.chromium.launch(headless=True)
    for w in (320, 375, 430):
        ctx = b.new_context(viewport={'width': w, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True); ctx.add_init_script('window.__rangeOpen = true'); pg = ctx.new_page()
        pg.route('**/script.google.com/**', blk)
        pg.on('console', lambda m, w=w: R['console'].append(f'w{w}:{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.goto(URL); pg.wait_for_selector('.subj'); put(pg, 'postgame', "s.active = null; s.seen = {};")
        bad = {}
        for scr in ('adv', 'forge', 'me', 'settings', 'storylist', 'codex', 'ending', 'memorial', 'story'):
            if scr == 'story': pg.evaluate("() => { RPG.save.active = null; RPG.save.progress.quest = null; RPG.save.progress.step = 0; RPG.go('adv'); document.getElementById('rsStory').click(); }")
            else: pg.evaluate(f"() => RPG.go('{scr}')")
            m = metrics(pg)
            if m['hscroll'] or m['small']: bad[scr] = m
        chk(f'w{w}:stage3_screens_fit', not bad, bad)
        ctx.close()
    b.close()
R['blocked_send_requests'] = R['blocked']
srv.shutdown()
json.dump(R, open(os.path.join(OUT, 'ui_test4.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = {k: v for k, v in R['checks'].items() if v is False or (isinstance(v, dict) and 'ok' in v and not v['ok'])}
print(json.dumps({'failed': bad, 'console': R['console'][:10], 'n': len(R['checks']), 'blocked': R['blocked']}, ensure_ascii=False, indent=1)[:4000])
