# 追加修正指示書10の 3章（宝箱）・4章（成長ゲージ）の実寸検査（headless）。
# python rpg/tools/fix10_reward.py [port]    ENGINE=chromium|webkit  VPS=390x700,...
# 証拠は rpg/shots/fix10_reward/。数値は fix10_<engine>_result.json
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18541
ENGINE = os.environ.get('ENGINE', 'chromium')
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix10_reward'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
R = {'engine': ENGINE, 'viewports': {}, 'gauge': {}, 'console': [], 'flows': {}}
def blk(r): r.abort()
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=1000; s.active=null; s.daily.used={}; s.chests=[]; s.inv.items={};"
VPS = [('390x700', 390, 700, False), ('375x640', 375, 640, False), ('320x568', 320, 568, False), ('390x700_t130', 390, 700, True), ('320x568_t130', 320, 568, True)]
VPS = [v for v in VPS if v[0] in os.environ['VPS'].split(',')] if os.environ.get('VPS') else VPS
BUMP = """() => { const rr = document.getElementById('rwRoot'); if (rr.dataset.b) return; rr.dataset.b = '1'; const els = [...document.querySelectorAll('#app *')]; const fs = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.fontSize = (fs[i] * 1.3) + 'px'; }); }"""
# 画面の状態をつくる。o.roll：宝箱の抽選済み保存値、o.job、o.have：すでに持っている装備、o.xp/lvFrom/advFrom：成長
SETUP = """(o) => {
  const D = RPGData, C = RPGCore, s = RPG.save, eid = Object.keys(D.ENEMIES)[0], ed = D.ENEMIES[eid];
  s.job = o.job || 'warrior'; s.chests = []; s.coins = 1000; s.inv.items = {}; (o.have || []).forEach(i => { s.inv.items[i] = 1; }); let chestId = null;
  if (o.roll) { chestId = 'rwt-' + Math.random().toString(36).slice(2, 7); C.addSealedChest(s, chestId, Object.assign({ rank: 1, wish: null, pityBefore: 0 }, o.roll), {}); }
  const job = s.job, tier = D.JOBS[job].tier, NEED = C.NEED[tier], lvAt = L => C.cum(NEED, L);
  let xp = lvAt(5) + 100, lvFrom = 5, lvTo = 5;
  if (o.lv) { xp = lvAt(o.lv.lv) + (o.lv.into || 0); lvFrom = o.lv.from == null ? o.lv.lv : o.lv.from; lvTo = o.lv.lv; }
  if (o.lastSkill) { const last = Math.max(...D.SKILLS_OF[job].map(k => k.lv)); xp = lvAt(last + 2) + 100; lvFrom = lvTo = last + 2; }
  s.jobXp[job] = xp;
  const res = { id: 't', outcome: 'victory', enemy: { id: eid, name: ed.name, boss: false, hpLeft: 0, hpMax: 10 }, region: '草原', bg: ed.region, quest: null, clear: null, mainClear: false, route: { point: '草原の入口' },
    N: 10, C: 8, R: 0, xpBase: 140, xpMult: 1, slot: { no: 3, key: 'k' }, coinAnswers: 100, coinKill: 15, coinWelcome: 0, coin: 115,
    adv: { lvFrom: o.advFrom || 4, lvTo: o.advTo || o.advFrom || 4 }, job: { id: job, lvFrom, lvTo, next: C.nextSkill(job, xp) }, newSkills: [], drops: [], chestId, hero: { hp: 5, maxHp: 10 }, coinsAfter: s.coins, xp: 140, firstClear: false };
  RPG.afterSession = () => ({ settled: true, res });
  RPG.persist();
  S = { sess: 't', queue: [], idx: 0, total: 10, reask: 0, rpg: true, correct: 8, wrong: [], skips: 0, seen: new Set(), wrongIds: new Set(), timer: null };
  result(); return { coins: s.coins, chestId, xp, lvTo };
}"""
CHECK = """() => {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement, q = s => document.querySelector(s);
  const rect = e => { if (!e) return null; const r = e.getBoundingClientRect(); const t = document.elementFromPoint(Math.min(vw - 1, Math.max(0, (r.left + r.right) / 2)), Math.min(vh - 1, Math.max(0, (r.top + r.bottom) / 2))); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), inView: r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw, hit: !!t && (t === e || e.contains(t)) }; };
  const body = document.getElementById('rwBody'), card = document.getElementById('rwDrop'), gi = q('#rwDrop .rw-gimg'), bar = q('#rwBar i');
  return { hscroll: de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1, pageScroll: de.scrollHeight > vh + 1, scrollTop: Math.round(body.scrollTop),
    end: rect(document.getElementById('end')), more: rect(document.getElementById('more')), card: rect(card), icon: rect(gi), iconSrc: gi ? (gi.getAttribute('src') || '').split('/').pop() : null,
    cardOver: card ? Math.round(card.scrollWidth - card.clientWidth) : null, chestSlots: document.querySelectorAll('#rwDrop').length, openBtn: !!document.getElementById('rwOpen'),
    name: (q('#rwDrop .rw-gname') || {}).textContent || null, use: (q('#rwDrop .rw-guse') || {}).textContent || null, moreBtn: (document.getElementById('rwChestMore') || {}).textContent || null,
    lines: card ? Math.round(q('#rwDrop .rw-dtx').getBoundingClientRect().height / parseFloat(getComputedStyle(q('#rwDrop .rw-gname') || card).lineHeight || 20)) : null,
    total: (document.getElementById('rwTotal') || {}).textContent, totalLabel: (q('#rwTotal') ? q('#rwTotal').parentElement.querySelector('span').textContent : null), note: (document.getElementById('rwCoinNote') || {}).textContent,
    coinRows: [...document.querySelectorAll('.rw-row')].filter(e => /コイン/.test(e.textContent)).length,
    jobL: (document.getElementById('rwJobL') || {}).textContent, jobR: (document.getElementById('rwJobR') || {}).textContent, jobSub: (document.getElementById('rwJobSub') || {}).textContent || null,
    barPct: bar ? parseFloat(bar.style.width) : null, barShown: !!bar, advUp: (q('.rw-advup') || {}).textContent || null, coins: RPG.save.coins, cards: document.querySelectorAll('#rwDrop, .rw-drop').length,
    bodyScrollable: body.scrollHeight > body.clientHeight + 1 }; }"""
CHESTS = [
  ('mat', {'roll': {'kind': 'mat', 'mats': {'ore_1': 4}}}),
  ('mat_rank4', {'roll': {'kind': 'mat', 'rank': 4, 'mats': {'ore_4': 4}}}),
  ('equip_new', {'roll': {'kind': 'rare', 'item': 'rw_sword_1'}}),
  ('equip_rare_armor', {'roll': {'kind': 'rare', 'item': 'ra_heavy_1'}}),
  ('equip_unfit', {'roll': {'kind': 'rare', 'item': 'rw_staff_1'}}),
  ('coinmat_multi', {'roll': {'kind': 'coinmat', 'coin': 40, 'mats': {'ore_1': 2}}}),
  ('coin_only', {'roll': {'kind': 'coin', 'coin': 40}}),
  ('dup', {'roll': {'kind': 'rare', 'item': 'rw_sword_1'}, 'have': ['rw_sword_1']}),
]
GAUGES = [
  ('normal', {'lv': {'lv': 8, 'into': 300}}),
  ('levelup', {'lv': {'lv': 9, 'from': 8, 'into': 60}, 'advFrom': 1, 'advTo': 2}),
  ('multi_up', {'lv': {'lv': 9, 'from': 6, 'into': 10}}),
  ('allskills', {'lastSkill': True}),
  ('capped', {'lv': {'lv': 30, 'from': 29, 'into': 0}}),
  ('boundary0', {'lv': {'lv': 8, 'into': 0}}),
]
def page(b, w, h, rm):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=(ENGINE != 'x'), has_touch=True, reduced_motion='reduce' if rm else 'no-preference')
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}')); pg.route('**/script.google.com/**', blk)
    pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(600)
    return pg
TIMING = """() => new Promise(res => { const t0 = performance.now(); const b = document.getElementById('rwOpen'); b.click();
  const chk = () => { const g = document.querySelector('#rwDrop .rw-gimg'); if (g) return res(Math.round(performance.now() - t0)); if (performance.now() - t0 > 3000) return res(-1); requestAnimationFrame(chk); }; chk(); })"""
def run_vp(b, vp, w, h, t130):
    pg = page(b, w, h, False)
    for name, o in CHESTS:
        info = pg.evaluate(SETUP, o); pg.wait_for_timeout(450)
        a = pg.evaluate(CHECK); pg.screenshot(path=os.path.join(OUT, f'{ENGINE}_{vp}_{name}_before.png'))
        if t130: pg.evaluate(BUMP); pg.wait_for_timeout(150)
        ms = pg.evaluate(TIMING); pg.wait_for_timeout(900)
        c = pg.evaluate(CHECK); c['reveal_ms'] = ms; c['coins_start'] = info['coins']; c['before'] = {'total': a['total'], 'chestSlots': a['chestSlots'], 'card_h': a['card'] and a['card']['h']}
        R['viewports'].setdefault(vp, {})[name] = c
        pg.screenshot(path=os.path.join(OUT, f'{ENGINE}_{vp}_{name}_after.png'))
        if name in ('coinmat_multi', 'dup') and vp in ('390x700', '320x568'):
            pg.click('#rwChestMore'); pg.wait_for_timeout(300); pg.screenshot(path=os.path.join(OUT, f'{ENGINE}_{vp}_{name}_sheet.png'))
            R['flows'][f'sheet_{vp}_{name}'] = pg.evaluate("() => (document.getElementById('rsSheet') || {}).innerText || null"); pg.click('#rsSheetX'); pg.wait_for_timeout(250)
    for name, o in GAUGES:
        info = pg.evaluate(SETUP, o); pg.wait_for_timeout(350)
        if t130: pg.evaluate(BUMP); pg.wait_for_timeout(100)
        c = pg.evaluate(CHECK); c['setup'] = info; R['gauge'].setdefault(vp, {})[name] = c
        pg.evaluate("() => document.getElementById('rwJob').scrollIntoView({block:'center'})"); pg.wait_for_timeout(150)
        pg.screenshot(path=os.path.join(OUT, f'{ENGINE}_{vp}_gauge_{name}.png'))
    pg.context.close()
def flows(b):
    # 動きを減らす：即時（待たない）
    pg = page(b, 390, 700, True)
    pg.evaluate(SETUP, CHESTS[2][1]); pg.wait_for_timeout(300)
    R['flows']['reduce_motion_ms'] = pg.evaluate(TIMING); pg.wait_for_timeout(300)
    R['flows']['reduce_motion_anim_class'] = pg.evaluate("() => document.getElementById('rwDrop').classList.contains('rw-anim')")
    pg.context.close()
    pg = page(b, 390, 700, False)
    # T07：二重タップ・再読込・開けずに終了→後日開封・演出中に終了
    info = pg.evaluate(SETUP, CHESTS[5][1]); pg.wait_for_timeout(300)
    pg.evaluate("() => { const b = document.getElementById('rwOpen'); b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(1000)
    d = pg.evaluate("() => ({ coins: RPG.save.coins, mat: RPG.save.inv.mats.ore_1 || 0 })")
    R['flows']['T07_doubletap'] = {'coins_start': info['coins'], 'after': d, 'ok': d['coins'] == info['coins'] + 40}
    pg.reload(); pg.wait_for_selector('#go', state='attached'); pg.wait_for_function("() => !!window.RPG && RPG.ok"); pg.wait_for_timeout(500)
    R['flows']['T07_reload'] = pg.evaluate("() => ({ coins: RPG.save.coins, sealed: RPGCore.sealedChests(RPG.save).length, opened: RPG.save.chests.filter(c => c.status === 'opened').length })")
    # 演出中（開封直後）に「おわる」→ ホームで加算済み、箱なし
    info = pg.evaluate(SETUP, CHESTS[5][1]); pg.wait_for_timeout(300); c0 = pg.evaluate("() => RPG.save.coins")
    pg.evaluate("() => document.getElementById('rwOpen').click()"); pg.wait_for_timeout(60); pg.click('#end'); pg.wait_for_selector('.rs-homewrap'); pg.wait_for_timeout(900)
    R['flows']['T07_end_during_anim'] = pg.evaluate("(c0) => ({ delta: RPG.save.coins - c0, sealed: RPGCore.sealedChests(RPG.save).length, chestRow: document.getElementById('rsBonusRow').classList.contains('chest') })", c0)
    # 未開封は保存値で再抽選しない：保存した roll は画面を作り直しても同じ
    info = pg.evaluate(SETUP, CHESTS[2][1]); roll1 = pg.evaluate("(id) => JSON.stringify(RPGCore.chestById(RPG.save, id).roll)", info['chestId'])
    pg.reload(); pg.wait_for_selector('#go', state='attached'); pg.wait_for_function("() => !!window.RPG && RPG.ok"); pg.wait_for_timeout(400)
    roll2 = pg.evaluate("(id) => JSON.stringify(RPGCore.chestById(RPG.save, id).roll)", info['chestId'])
    R['flows']['T07_roll_kept'] = {'same': roll1 == roll2, 'roll': roll1}
    pg.context.close()
with sync_playwright() as p:
    b = getattr(p, ENGINE).launch(headless=True)
    for vp, w, h, t in VPS: run_vp(b, vp, w, h, t)
    if not os.environ.get('NOFLOWS'): flows(b)
    b.close()
bad = []
for vp, scr in R['viewports'].items():
    for name, c in scr.items():
        if c['hscroll']: bad.append([vp, name, 'hscroll'])
        if c['pageScroll']: bad.append([vp, name, 'pageScroll'])
        for k in ('end', 'more'):
            r = c[k]
            if not r or not r['inView'] or not r['hit']: bad.append([vp, name, 'notinview/hit ' + k, r])
        if not c['icon'] or not c['icon']['inView']: bad.append([vp, name, 'icon not in view', c['icon']])
        elif c['icon']['w'] < 44 or c['icon']['w'] > 52: bad.append([vp, name, 'icon size', c['icon']['w']])
        if c['cards'] != 1: bad.append([vp, name, 'cards', c['cards']])
        if c['coinRows'] != 1: bad.append([vp, name, 'coinRows', c['coinRows']])
        if not (500 <= c['reveal_ms'] <= 800): bad.append([vp, name, 'reveal_ms', c['reveal_ms']])
        if c['card'] and c['card']['h'] > 170: bad.append([vp, name, 'card tall', c['card']['h']])
        if c['cardOver'] and c['cardOver'] > 1: bad.append([vp, name, 'card overflow', c['cardOver']])
for vp, scr in R['gauge'].items():
    for name, c in scr.items():
        if c['hscroll']: bad.append([vp, 'gauge_' + name, 'hscroll'])
        if c['cards'] > 0 and False: pass
R['problems'] = bad; R['console_n'] = len(R['console'])
json.dump(R, open(os.path.join(OUT, f'fix10_{ENGINE}_result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'problems': len(bad), 'console': R['console'][:5], 'flows': {k: (v.get('ok') if isinstance(v, dict) and 'ok' in v else v) for k, v in R['flows'].items() if not k.startswith('sheet_')}}, ensure_ascii=False))
for x in bad[:60]: print(x)
