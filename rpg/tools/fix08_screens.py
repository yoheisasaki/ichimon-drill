# 08 5・6章の画面配置の実寸検査（headless chromium、nosend=1）。python rpg/tools/fix08_screens.py [port]
# 6つの表示領域 x 画面・状態をビューポート実寸で撮り、主要操作の可視・横はみ出し・二重スクロール・ナビとの重なり・小さい押し先を数値で JSON に残す。
# 出力: rpg/shots/fix08_screens/*.png と result.json。報酬画面は rpg-ui.js が他担当の編集中のため対象外。
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18521
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_screens'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
R = {'viewports': {}, 'console': [], 'blocked': 0, 'flows': {}}
def blk(r): R['blocked'] += 1; r.abort()
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=3000; s.jobXp.warrior=9000; s.jobXp.mage=0; s.jobXp.priest=0; s.jobXp.thief=0; s.active=null; s.look={face:1,hair:2,skin:1,hairColor:3,outfit:null}; s.daily.used={}; s.chests=[];"
VPS = [('390x700', 390, 700, 1), ('390x640', 390, 640, 1), ('375x640', 375, 640, 1), ('430x800', 430, 800, 1), ('320x640', 320, 640, 1), ('390x700_t130', 390, 700, 1)]
def page(b, w, h, dsf):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dsf, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}')); pg.route('**/script.google.com/**', blk)
    pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(600)
    pg.evaluate("() => { window.__rangeOpen = false; home(); }"); pg.wait_for_timeout(300)
    return pg
def setsave(pg, js):
    pg.evaluate("(js) => { const s = RPG.save; (new Function('s', 'C', js))(s, RPGCore); RPG.persist(); }", js)
def goto(pg, name, params=None):
    if name == 'home': pg.evaluate("() => home()")
    else: pg.evaluate("([n, p]) => RPG.go(n, p || {})", [name, params])
    pg.wait_for_timeout(450)
BUMP = """() => { const rr = document.getElementById('rsRoot'); if (rr.dataset.b) return; rr.dataset.b = '1'; const els = [...document.querySelectorAll('#app *')]; const fs = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.fontSize = (fs[i] * 1.3) + 'px'; }); }"""
CHECK = """(sel) => {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement, app = document.getElementById('app');
  const rect = e => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; };
  const body = document.getElementById('rsBody'), foot = document.querySelector('.rs-foot'), head = document.querySelector('.rs-head'), sc = document.querySelector('#rsBody .rs-scroll');
  const out = { vw, vh, hscroll: de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1, pageScroll: de.scrollHeight > vh + 1,
    bodyScrollable: body ? body.scrollHeight > body.clientHeight + 1 : null, listScrollable: sc ? sc.scrollHeight > sc.clientHeight + 1 : null,
    footTop: foot ? Math.round(foot.getBoundingClientRect().top) : null, footH: foot ? Math.round(foot.getBoundingClientRect().height) : null, headH: head ? Math.round(head.getBoundingClientRect().height) : null, items: {}, small: [] };
  out.doubleScroll = !!(out.bodyScrollable && out.listScrollable) || out.pageScroll;
  if (body && !body.classList.contains('x')) { const r = body.getBoundingClientRect(); out.bodyBottom = Math.round(r.bottom); out.contentOverFoot = out.footTop != null && Math.round(r.bottom) > out.footTop + 1; }
  (sel || []).forEach(s => { const e = document.querySelector(s); if (!e) { out.items[s] = null; return; } const r = rect(e); const cx = Math.min(vw - 1, Math.max(0, (r.l + r.r) / 2)), cy = Math.min(vh - 1, Math.max(0, (r.t + r.b) / 2)); const top = document.elementFromPoint(cx, cy); r.inView = r.t >= 0 && r.b <= vh && r.l >= 0 && r.r <= vw; r.hit = !!top && (top === e || e.contains(top)); out.items[s] = r; });
  [...document.querySelectorAll('#app button, #app summary, #app a, #app input')].forEach(e => { const r = e.getBoundingClientRect(); if (r.width === 0 || r.height === 0) return; const cs = getComputedStyle(e); if (cs.visibility === 'hidden') return; if (e.closest('.rs-sheetbg') && !document.getElementById('rsSheet') && !e.closest('details[open]')) return; if (Math.min(r.width, r.height) < 43.5) out.small.push((e.id ? '#' + e.id : e.className || e.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); });
  let minFs = 99; const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT); let n; const tiny = new Set();
  while ((n = walker.nextNode())) { if (!n.textContent.trim()) continue; const p = n.parentElement; if (!p || p.closest('rt') || p.closest('canvas')) continue; const cs = getComputedStyle(p); if (cs.display === 'none' || cs.visibility === 'hidden') continue; const fs = parseFloat(cs.fontSize); if (fs < minFs) minFs = fs; if (fs < 12) tiny.add(p.className + ':' + n.textContent.trim().slice(0, 12)); }
  out.boxOverflow = [...document.querySelectorAll('.rs-eqr,.rs-shopsel,.rs-cond,.rs-eqcmp,.rs-bonusrow,.rs-topbar,.rs-tile,.rs-jobcard')].filter(e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1).map(e => e.className.split(' ')[0]);
  out.minFont = minFs; out.tinyText = [...tiny].slice(0, 6);
  return out; }"""
def shot(pg, vp, name):
    pg.screenshot(path=os.path.join(OUT, f'{vp}_{name}.png'), full_page=False)
def record(vp, name, c):
    R['viewports'].setdefault(vp, {})[name] = c
SELS = {
  'home': ['#go', '#rsBonusRow', '#hard', '.rs-range summary', '#rsRangeBtn', '.rs-tab >> nth=0', 'canvas.rs-hcv-home', '.rs-contline'],
  'home_chest': ['#go', '#rsBonusRow', '#hard', '.rs-range summary'], 'home_used': ['#go', '#rsBonusRow', '#hard', '.rs-range summary'],
  'equip': ['#eqOk', '#eqReset', '#eqRec', 'canvas.rs-hcv-equip', '.rs-eqr .rs-dr', '[data-slot=weapon]', '.rs-eqitem'],
  'equip20': ['#eqOk', '#eqReset', 'canvas.rs-hcv-equip', '[data-slot=armor]'],
  'jobs': ['[data-tier=base]', '.rs-jobcard', '.rs-tab'], 'jobdetail_ok': ['#jobDo', '#jobNote', '#jobGoal', '[data-sheet=jobskills]', 'canvas.rs-hcv-job', '#jobPlay'],
  'jobdetail_ng': ['#jobDo', '#jobNote', '#jobGoal', '[data-sheet=jobskills]', 'canvas.rs-hcv-job'],
  'town': ['.rs-tile >> nth=0', '.rs-tile >> nth=7', '.rs-tab >> nth=0', 'canvas.rs-hcv-town'], 'adv': ['#rsStart', '[data-sheet=story]', '[data-sheet=wish]', '.rs-tab >> nth=0'],
  'me': ['[data-go=equip]', '[data-go=jobs]', '[data-go=look]', '[data-sheet=mestat]', 'canvas.rs-hcv-self', '.rs-tab >> nth=0'],
  'shop_short': ['#shopBuy', '#shopTry', '#shopWhy', '[data-st=weapon]'], 'shop_ok': ['#shopBuy', '#shopTry', '#shopWhy', '[data-st=weapon]'],
}
def sel_fix(sels):   # playwright の ' >> nth=' は querySelector では使えないので変換
    out = []
    for s in sels:
        if ' >> nth=' in s:
            a, n = s.split(' >> nth='); out.append((a, int(n)))
        else: out.append((s, 0))
    return out
def check(pg, name):
    sels = SELS.get(name, [])
    # nth 指定は個別に評価
    plain = [s for s in sels if ' >> nth=' not in s]
    c = pg.evaluate(CHECK, plain)
    for s in sels:
        if ' >> nth=' in s:
            a, n = s.split(' >> nth=')
            r = pg.evaluate("([a, n]) => { const e = document.querySelectorAll(a)[+n]; if (!e) return null; const r = e.getBoundingClientRect(); const cx = Math.min(innerWidth - 1, Math.max(0, (r.left + r.right) / 2)), cy = Math.min(innerHeight - 1, Math.max(0, (r.top + r.bottom) / 2)); const t = document.elementFromPoint(cx, cy); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), inView: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, hit: !!t && (t === e || e.contains(t)) }; }", [a, n])
            c['items'][s] = r
    return c
def run_vp(b, vp, w, h, dsf):
    t130 = vp.endswith('_t130')
    pg = page(b, w, h, dsf)
    def snap(name, setup=None):
        if setup: setup()
        if t130: pg.evaluate(BUMP); pg.wait_for_timeout(150)
        pg.wait_for_timeout(250); c = check(pg, name); record(vp, name, c); shot(pg, vp, name)
    # ホーム：通常・未開封箱あり・ボーナス使用済み
    snap('home', lambda: goto(pg, 'home'))
    snap('home_chest', lambda: (pg.evaluate("() => { RPGCore.addSealedChest(RPG.save, 'fix08-chest', { kind: 'coinmat', rank: 1, wish: null, pityBefore: 0, coin: 40, mats: { ore_1: 2 } }, {}); RPG.persist(); home(); }"), pg.wait_for_timeout(400)))
    snap('home_used', lambda: (pg.evaluate("() => { const s = RPG.save; s.chests = []; s.daily.used[RPGCore.todayKey(s, Date.now())] = 2; RPG.persist(); home(); }"), pg.wait_for_timeout(400)))
    # 装備：試着中（青銅の剣）／候補20件
    pg.evaluate("() => { const s = RPG.save; s.daily.used = {}; const ids = Object.keys(RPGData.ITEMS).filter(i => RPGData.ITEMS[i].slot === 'weapon' && RPGData.ITEMS[i].rarity === 'normal' && !i.startsWith('rw_')); ids.slice(0, 20).forEach(i => { s.inv.items[i] = 1; }); RPG.persist(); }")
    n_w = pg.evaluate("() => Object.keys(RPG.save.inv.items).filter(i => RPGData.ITEMS[i].slot === 'weapon').length")
    R.setdefault('n_weapons', n_w)
    def eq_try():
        goto(pg, 'equip', {'back': 'me'})
        pg.evaluate("() => { const b = [...document.querySelectorAll('.rs-eqitem:not(.ng)')].find(x => !x.classList.contains('on') && x.dataset.eq !== 'w_start'); if (b) b.click(); }"); pg.wait_for_timeout(400)
    snap('equip', eq_try)
    snap('equip20', lambda: (pg.evaluate("() => { const s = document.querySelector('#eqList'); if (s) s.scrollTop = 240; }"), pg.wait_for_timeout(200)))
    if vp == '390x700':
        R['flows']['equip20_list'] = pg.evaluate("() => { const l = document.querySelector('#eqList'); return { n: l.querySelectorAll('.rs-eqitem').length, scrollTop: l.scrollTop, scrollH: l.scrollHeight, clientH: l.clientHeight, bodyScroll: document.getElementById('rsBody').scrollHeight > document.getElementById('rsBody').clientHeight + 1 }; }")
    # 転職：一覧／詳細（可・未達）
    snap('jobs', lambda: goto(pg, 'jobs', {'back': 'town'}))
    snap('jobdetail_ng', lambda: goto(pg, 'jobdetail', {'job': 'magicknight'}))
    snap('jobdetail_ok', lambda: (setsave(pg, "s.jobXp.mage = 9000;"), goto(pg, 'jobdetail', {'job': 'magicknight'})))
    snap('town', lambda: goto(pg, 'town'))
    snap('adv', lambda: goto(pg, 'adv'))
    snap('me', lambda: goto(pg, 'me'))
    # 店：残高不足／購入成功
    snap('shop_short', lambda: (setsave(pg, "s.coins = 0; s.inv.items = { w_start: 1 }; s.equip.weapon = 'w_start';"), pg.evaluate("() => { RPG.go('shop', { back: 'town' }); }"), pg.wait_for_timeout(450)))
    def shop_ok():
        setsave(pg, "s.coins = 5000;"); goto(pg, 'shop', {'back': 'town'})
        pg.evaluate("() => { const b = document.querySelector('#shopBuy'); const t = b.getBoundingClientRect(); window.__buyTop = [Math.round(t.top), Math.round(t.height)]; b.click(); }"); pg.wait_for_timeout(450)
    snap('shop_ok', shop_ok)
    if vp == '390x700':
        R['flows']['shop_buy_pos'] = pg.evaluate("() => { const t = document.querySelector('#shopBuy').getBoundingClientRect(); return { before: window.__buyTop, after: [Math.round(t.top), Math.round(t.height)], label: document.querySelector('#shopBuy').textContent, tryLabel: document.querySelector('#shopTry').textContent }; }")
    pg.context.close()
def flows(b):
    pg = page(b, 390, 700, 1)
    # 装備：試着で絵と差が変わる→取消で戻る→確定で保存→再読込で同じ
    pg.evaluate("() => { const s = RPG.save; s.coins = 5000; ['w_sword_1', 'w_sword_2'].forEach(i => { if (RPGData.ITEMS[i]) s.inv.items[i] = 1; }); RPG.persist(); }")
    goto(pg, 'equip', {'back': 'me'})
    q = lambda: pg.evaluate("() => ({ eq: JSON.stringify(UI_EQ()), hero: document.querySelector('canvas.rs-hcv-equip').dataset.hero, diff: [...document.querySelectorAll('.rs-eqr .rs-dr')].map(e => e.textContent.replace(/\\s+/g, ' ')).join('|'), ok: !document.getElementById('eqOk').disabled })".replace('UI_EQ()', "RPG.save.equip"))
    r0 = q()
    cand = pg.evaluate("() => [...document.querySelectorAll('.rs-eqitem:not(.ng)')].map(x => x.dataset.eq)")
    R['flows']['equip_candidates'] = cand
    tgt = next((c for c in cand if c and c != r0['eq'] and 'w_start' not in c), None)
    if tgt:
        pg.click(f'[data-eq="{tgt}"]'); pg.wait_for_timeout(300); r1 = q()
        pg.click('#eqReset'); pg.wait_for_timeout(300); r2 = q()
        pg.click(f'[data-eq="{tgt}"]'); pg.wait_for_timeout(300); pg.click('#eqOk'); pg.wait_for_timeout(400); r3 = q()
        saved = pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.rpg.v1')).equip.weapon")
        pg.reload(); pg.wait_for_function("() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 700"); pg.wait_for_timeout(500)
        after_reload = pg.evaluate("() => RPG.save.equip.weapon")
        R['flows']['equip_try_cancel_commit'] = {'target': tgt, 'ok_enabled_after_try': r1['ok'], 'diff_changed_on_try': r1['diff'] != r0['diff'], 'hero_changed_on_try': r1['hero'] != r0['hero'], 'cancel_restores_diff': r2['diff'] == r0['diff'], 'cancel_restores_hero': r2['hero'] == r0['hero'], 'saved_weapon': saved, 'after_reload_weapon': after_reload, 'saved_matches_target': saved == tgt == after_reload}
    # シート：開く→背面スクロール不可→閉じる→元の位置
    goto(pg, 'adv')
    pg.evaluate("() => { document.getElementById('rsBody').scrollTop = 120; }"); y0 = pg.evaluate("() => document.getElementById('rsBody').scrollTop")
    pg.click('[data-sheet=quests]'); pg.wait_for_timeout(300)
    sh = pg.evaluate("() => { const b = document.getElementById('rsBody'), s = document.getElementById('rsSheetB'); return { open: !!document.getElementById('rsSheet'), bodyOverflow: getComputedStyle(b).overflowY, sheetScrollable: s.scrollHeight > s.clientHeight + 1, sheetH: Math.round(document.querySelector('.rs-sheet').getBoundingClientRect().height), vh: innerHeight, closeBtn: Math.round(document.getElementById('rsSheetX').getBoundingClientRect().height) }; }")
    pg.mouse.wheel(0, 300); pg.wait_for_timeout(200)
    y1 = pg.evaluate("() => document.getElementById('rsBody').scrollTop")
    pg.click('#rsSheetX'); pg.wait_for_timeout(250)
    y2 = pg.evaluate("() => document.getElementById('rsBody').scrollTop"); closed = pg.evaluate("() => !document.getElementById('rsSheet')")
    pg.click('[data-sheet=wish]'); pg.wait_for_timeout(200); pg.keyboard.press('Escape'); pg.wait_for_timeout(200); esc_closed = pg.evaluate("() => !document.getElementById('rsSheet')")
    R['flows']['sheet'] = dict(sh, y_before=y0, y_during_wheel=y1, y_after_close=y2, closed=closed, esc_closed=esc_closed, background_fixed=(y0 == y1), position_restored=(y0 == y2))
    # ホームの範囲シート：開く→科目選択で開いたまま→とじる
    goto(pg, 'home'); pg.click('.rs-range summary'); pg.wait_for_timeout(300)
    hs = pg.evaluate("() => ({ open: document.querySelector('.rs-range').open, sheetH: Math.round(document.querySelector('#rsRangeBg .rs-sheet').getBoundingClientRect().height), close: Math.round(document.getElementById('rsRangeX').getBoundingClientRect().height) })")
    pg.click('#rsRangeX'); pg.wait_for_timeout(200); hs['closed'] = pg.evaluate("() => !document.querySelector('.rs-range').open")
    R['flows']['home_range_sheet'] = hs
    # ホームのボーナスシート（未開封箱あり）→開ける導線
    pg.evaluate("() => { RPGCore.addSealedChest(RPG.save, 'fix08-chest2', { kind: 'coinmat', rank: 1, wish: null, pityBefore: 0, coin: 40, mats: { ore_1: 2 } }, {}); RPG.persist(); home(); }"); pg.wait_for_timeout(400)
    pg.click('#rsBonusRow'); pg.wait_for_timeout(400)
    R['flows']['home_chest_sheet'] = pg.evaluate("() => ({ sheet: !!document.getElementById('rsSheet'), openBtn: !!document.getElementById('rwOpen'), text: document.getElementById('rsBonusRow') ? null : 'row hidden by sheet?' })")
    pg.screenshot(path=os.path.join(OUT, '390x700_home_chest_sheet.png'))
    pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')", timeout=5000); pg.wait_for_timeout(400)
    R['flows']['home_chest_opened'] = pg.evaluate("() => ({ chestsLeft: RPGCore.sealedChests(RPG.save).length, coins: RPG.save.coins })")
    pg.click('#rsSheetX'); pg.wait_for_timeout(500)
    R['flows']['home_after_chest_close'] = pg.evaluate("() => ({ row: document.getElementById('rsBonusRow').textContent.trim().slice(0, 30), chestClass: document.getElementById('rsBonusRow').classList.contains('chest') })")
    # 回帰：学習ホーム→10問→報酬画面→おわる→ホーム（報酬画面は他担当の編集中。ここでは動くことだけ確認）
    goto(pg, 'home')
    pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice')
    CORRECT = "() => { const q = S.cur; const i = S.opts.indexOf(q.a); document.querySelectorAll('.choice')[i].click(); }"
    for _ in range(40):
        if pg.query_selector('#rwRoot'): break
        pg.evaluate(CORRECT); pg.wait_for_timeout(750)
    pg.wait_for_selector('#rwRoot', timeout=8000); R['flows']['session_to_reward'] = True
    pg.click('#end'); pg.wait_for_selector('.rs-homewrap', timeout=8000)
    R['flows']['reward_end_to_home'] = pg.evaluate("() => ({ go: !!document.getElementById('go'), nav: document.querySelectorAll('.rs-tab').length, pageScroll: document.documentElement.scrollHeight > innerHeight + 1 })")
    goto(pg, 'adv'); pg.click('[data-sheet=quests]'); pg.wait_for_timeout(300); pg.screenshot(path=os.path.join(OUT, '390x700_adv_sheet_quests.png'))
    pg.context.close()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for vp, w, h, d in VPS: run_vp(b, vp, w, h, d)
    flows(b); b.close()
# 集計：主要操作がビューポート内で見え、押せる（hit）か
bad = []
for vp, scr in R['viewports'].items():
    for name, c in scr.items():
        if c['hscroll']: bad.append([vp, name, 'hscroll'])
        if c.get('boxOverflow'): bad.append([vp, name, 'boxOverflow', c['boxOverflow']])
        if c['pageScroll']: bad.append([vp, name, 'pageScroll'])
        if c.get('contentOverFoot'): bad.append([vp, name, 'contentOverFoot'])
        if c['doubleScroll']: bad.append([vp, name, 'doubleScroll'])
        for s, r in c['items'].items():
            if r is None: bad.append([vp, name, 'missing ' + s])
            elif not r['inView'] or not r['hit']: bad.append([vp, name, 'notinview/hit ' + s, r])
R['problems'] = bad
R['console_n'] = len(R['console'])
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'problems': len(bad), 'console': R['console'][:5], 'blocked': R['blocked']}, ensure_ascii=False))
for x in bad[:60]: print(x)
