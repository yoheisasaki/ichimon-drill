# 報酬と宝箱の画面確認（headless chromium、390px、nosend=1）。python rpg/tools/fix06_reward.py [port]
# 勝利/継続/撤退/3回目 × 未開封/開封後/箱なし を撮影し、DOMの数値も検査する。結果は rpg/shots/fix06_reward/result.json
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18461
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix06_reward'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.ThreadingTCPServer.allow_reuse_address = True
srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'checks': {}, 'console': [], 'blocked': 0}
def chk(name, cond, extra=None): R['checks'][name] = bool(cond) if extra is None else {'ok': bool(cond), 'v': extra}
def blk(r): R['blocked'] += 1; r.abort()
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
SAVE = "() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))"
def shot(pg, name): pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=True)
def new_page(b):
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    ctx.add_init_script('window.__rangeOpen = true'); pg = ctx.new_page()
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}'))
    pg.route('**/script.google.com/**', blk)
    pg.goto(URL); pg.wait_for_selector('.subj'); pg.wait_for_timeout(600)
    return pg
def adventure(pg, patch=''):
    pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }")
    pg.wait_for_selector('.choice')
    if patch: pg.evaluate(patch)
    for _ in range(40):
        if pg.query_selector('#rwRoot'): break
        pg.evaluate(CORRECT); pg.wait_for_timeout(750)
    pg.wait_for_selector('#rwRoot', timeout=8000); pg.wait_for_timeout(500)
INFO = """() => { const q = s => document.querySelector(s); const tx = e => { const c = e.cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent.trim(); }; const bs = [...document.querySelectorAll('#end,#more')].map(b => { const c = getComputedStyle(b), r = b.getBoundingClientRect(); return [c.backgroundImage, c.color, c.fontSize, c.fontWeight, c.borderColor, Math.round(r.width), Math.round(r.height)].join('|'); });
  return { outcome: q('#rwRoot').dataset.outcome, cap: (() => { const c = q('#rwCap').cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; })(), drops: document.querySelectorAll('.rw-drop').length, chestCanvases: document.querySelectorAll('#rwRoot canvas').length,
    total: q('#rwTotal') && tx(q('#rwTotal')), base: q('#rwCoinBase') && tx(q('#rwCoinBase')), line: q('#rwChestLine') ? tx(q('#rwChestLine')) : null, lineHidden: q('#rwChestLine') ? q('#rwChestLine').hidden : null,
    open: !!q('#rwOpen'), btnSame: bs.length === 2 && bs[0] === bs[1], hscroll: document.documentElement.scrollWidth > innerWidth,
    html: q('#rwRoot').innerHTML.indexOf('朝星') >= 0, order: [...document.querySelectorAll('#rwRoot > *')].map(e => e.className.split(' ')[0] || e.id).join(','),
    endVisible: (() => { const r = q('#end').getBoundingClientRect(); return r.bottom > 0; })() }; }"""
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    # ===== 勝利（日次1回目・全正解）：未開封→開封後 =====
    pg = new_page(b); adventure(pg)
    i = pg.evaluate(INFO); R['victory_unopened'] = i
    chk('D01 victory caption', i['outcome'] == 'victory' and '倒した' in i['cap'], i['cap'])
    chk('D01 no chest in scene canvas / one card only', i['drops'] == 1 and i['chestCanvases'] == 2, i)   # 場面canvas＋箱カードcanvasの2つだけ
    chk('D03 sealed: line empty, total=base', i['line'] == '' and i['open'] and i['total'].replace(' ', '') == '合計' + i['base'], i)
    chk('D10 buttons same style', i['btnSame'])
    sv = pg.evaluate(SAVE); chk('D03 coins saved = base only', sv['coins'] == int(i['base'].replace('+', '')) and sv['chests'][-1]['status'] == 'sealed', [sv['coins'], i['base']])
    shot(pg, 'victory_unopened')
    pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')", timeout=4000); pg.wait_for_timeout(300)
    i2 = pg.evaluate(INFO); R['victory_opened'] = i2; sv2 = pg.evaluate(SAVE)
    gained = sv2['coins'] - sv['coins']
    chk('D04 formula matches', i2['total'] == f"学習・討伐{int(i2['base'].replace('+',''))}＋宝箱{gained if sv2['chests'][-1]['result'].get('coin') else 0}＝合計{sv2['coins']}", [i2['total'], sv2['coins']])
    chk('D04 opened line shown & saved', len(i2['line']) > 3 and sv2['chests'][-1]['status'] == 'opened', i2['line'])
    shot(pg, 'victory_opened')
    # ホームへ戻って「受け取った宝箱」が出ない（全て開封済み）
    pg.click('#end'); pg.wait_for_selector('.subj'); chk('home no chestbox when none sealed', pg.query_selector('#rsChestBox') is None)
    # ===== 未開封で終了 → ホームの小さな入口 → 開封（D06） =====
    pg2 = new_page(b); adventure(pg2)
    c_before = pg2.evaluate(SAVE)['coins']
    pg2.click('#end'); pg2.wait_for_selector('.subj')
    chk('D06 home shows sealed chest entry', pg2.query_selector('#rsChestBox') is not None)
    shot(pg2, 'home_with_sealed_chest')
    pg2.reload(); pg2.wait_for_selector('.subj'); pg2.wait_for_timeout(400)
    chk('D06 after reload still sealed', pg2.query_selector('#rsChestBox') is not None and pg2.evaluate(SAVE)['coins'] == c_before)
    pg2.click('#rsChestBox summary'); pg2.wait_for_selector('#rwOpen', state='visible')
    pg2.click('#rwOpen'); pg2.wait_for_function("() => !document.getElementById('rwOpen')", timeout=4000)
    sv3 = pg2.evaluate(SAVE); chk('D06 later open grants once', sv3['chests'][-1]['status'] == 'opened')
    shot(pg2, 'home_chest_opened')
    pg2.reload(); pg2.wait_for_selector('.subj'); chk('D06 no entry after reload', pg2.query_selector('#rsChestBox') is None and pg2.evaluate(SAVE)['coins'] == sv3['coins'])
    # ===== 継続 =====
    pg3 = new_page(b); adventure(pg3, "() => { const e = RPG.save.active.battle.enemy; e.hp = e.maxHp = 99999; }")
    i = pg3.evaluate(INFO); R['continue'] = i
    chk('D01 continue caption', i['outcome'] == 'continue' and '今日はここまで' in i['cap'], i['cap']); chk('D01 continue one card, sealed', i['drops'] == 1 and i['open'], i)
    shot(pg3, 'continue_unopened')
    # ===== 撤退 =====
    pg4 = new_page(b); adventure(pg4, "() => { const bt = RPG.save.active.battle; bt.status = 'retreat'; }")
    i = pg4.evaluate(INFO); R['retreat'] = i
    chk('D01 retreat caption', i['outcome'] == 'retreat' and '街に戻りました' in i['cap'], i['cap']); chk('D01 retreat one card', i['drops'] == 1, i)
    shot(pg4, 'retreat_unopened')
    # ===== 当日3回目：箱なし（空の欄も出さない）、終わる/次へは成立（D10） =====
    pg5 = new_page(b)
    pg5.evaluate("() => { RPG.save.daily.used[RPGCore.todayKey(RPG.save, Date.now())] = 2; RPG.persist(); }")
    adventure(pg5)
    i = pg5.evaluate(INFO); R['third'] = i
    chk('D02 third has no chest card/area', i['drops'] == 0 and not i['html'] and i['chestCanvases'] == 1 and i['line'] is None, i)
    chk('D10 third buttons same', i['btnSame']); shot(pg5, 'third_nochest')
    pg5.click('#more'); pg5.wait_for_selector('.choice', timeout=5000); chk('D10 more starts next 10 only on tap', True)
    # ===== 日次2回目にも箱、宝箱を開けずに「次の10問」（D10/D02） =====
    pg6 = new_page(b); adventure(pg6)
    pg6.evaluate(SAVE); pg6.click('#more'); pg6.wait_for_selector('.choice', timeout=5000)
    chk('D10 end without opening ok (chest stays sealed)', pg6.evaluate(SAVE)['chests'][-1]['status'] == 'sealed')
    for _ in range(40):
        if pg6.query_selector('#rwRoot'): break
        pg6.evaluate(CORRECT); pg6.wait_for_timeout(750)
    pg6.wait_for_selector('#rwRoot'); pg6.wait_for_timeout(400); i = pg6.evaluate(INFO)
    chk('D02 second adventure has closed chest', i['drops'] == 1 and i['open'] and i['line'] == '', i)
    sv = pg6.evaluate(SAVE); chk('D06 two sealed chests kept', len([c for c in sv['chests'] if c['status'] == 'sealed']) == 2)
    # ===== 連打（D07） =====
    c0 = sv['coins']
    pg6.evaluate("() => { const b = document.getElementById('rwOpen'); b.click(); b.click(); b.click(); }")
    pg6.wait_for_function("() => !document.getElementById('rwOpen')", timeout=4000); sv = pg6.evaluate(SAVE)
    chk('D07 rapid click: opened once, others still sealed', len([c for c in sv['chests'] if c['status'] == 'opened']) == 1 and len([c for c in sv['chests'] if c['status'] == 'sealed']) == 1, [c['status'] for c in sv['chests']])
    shot(pg6, 'second_opened')
    # ===== 狭い画面（320）で報酬の末尾まで到達 =====
    pg6.set_viewport_size({'width': 320, 'height': 640}); pg6.wait_for_timeout(300)
    r = pg6.evaluate("() => { window.scrollTo(0, document.body.scrollHeight); const b = document.getElementById('more').getBoundingClientRect(); return { hscroll: document.documentElement.scrollWidth > innerWidth, bottom: Math.round(b.bottom), vh: innerHeight }; }")
    chk('320px: no hscroll, buttons reachable', not r['hscroll'] and r['bottom'] <= r['vh'] + 1, r)
    b.close()
R['pass'] = sum(1 for v in R['checks'].values() if (v if isinstance(v, bool) else v['ok']))
R['fail'] = [k for k, v in R['checks'].items() if not (v if isinstance(v, bool) else v['ok'])]
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'pass': R['pass'], 'fail': R['fail'], 'console': R['console'][:8], 'blocked': R['blocked']}, ensure_ascii=False, indent=1))
