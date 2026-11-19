# 08 6章 報酬画面の実寸検査（headless chromium、nosend=1）。python rpg/tools/fix08_reward.py [port]
# 6領域 x 状態（開封前／開封後／宝箱なし／初回＋Lv上昇2種＋技＋レア同時／追加復習／撃破・継続・撤退）。U07〜U09 を数値で。
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18531
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_screens'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
R = {'viewports': {}, 'console': [], 'blocked': 0, 'flows': {}}
def blk(r): R['blocked'] += 1; r.abort()
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=1000; s.active=null; s.daily.used={}; s.chests=[];"
VPS = [('390x700', 390, 700), ('390x640', 390, 640), ('375x640', 375, 640), ('430x800', 430, 800), ('320x640', 320, 640), ('390x700_t130', 390, 700)]
BUMP = """() => { const rr = document.getElementById('rwRoot'); if (rr.dataset.b) return; rr.dataset.b = '1'; const els = [...document.querySelectorAll('#app *')]; const fs = els.map(e => parseFloat(getComputedStyle(e).fontSize)); els.forEach((e, i) => { e.style.fontSize = (fs[i] * 1.3) + 'px'; }); }"""
# 画面の状態をつくる：結果(res)を合成して afterSession が返すようにし、result() を呼ぶ
SETUP = """(o) => {
  const D = RPGData, C = RPGCore, s = RPG.save, eid = Object.keys(D.ENEMIES)[o.enemyIdx || 0], ed = D.ENEMIES[eid], job = s.job;
  s.chests = []; s.coins = 1000; let chestId = null;
  if (o.chest) { chestId = 'rwt-' + Math.random().toString(36).slice(2, 7); const rare = Object.keys(D.ITEMS).find(i => D.ITEMS[i].rarity === 'rare' && D.ITEMS[i].rank === 1);
    const roll = o.chest === 'rare' ? { kind: 'rare', rank: 1, wish: null, pityBefore: 0, item: rare } : { kind: 'coinmat', rank: 1, wish: null, pityBefore: 0, coin: 40, mats: { ore_1: 2 } };
    C.addSealedChest(s, chestId, roll, {}); }
  const sk = D.SKILLS_OF[job].slice(1, 3).map(k => k.id);
  const res = { id: 't', outcome: o.outcome || 'victory', enemy: { id: eid, name: ed.name, boss: !!o.boss, hpLeft: 0, hpMax: 10 }, region: '草原', bg: ed.region, quest: null, clear: null, mainClear: false, route: { point: '草原の入口' },
    N: 10, C: o.C == null ? 8 : o.C, R: o.R || 0, xpBase: 140, xpMult: o.big ? 3 : 1, slot: { no: o.big ? 1 : 3, key: 'k' }, coinAnswers: o.big ? 200 : 100, coinKill: o.big ? 300 : 15, coinWelcome: o.big ? 160 : 0, coin: o.big ? 660 : 115,
    adv: { lvFrom: 4, lvTo: o.big ? 5 : 4 }, job: { id: job, lvFrom: 2, lvTo: o.big ? 4 : 2, next: C.nextSkill(job, s.jobXp[job]) }, newSkills: o.big ? sk : [],
    drops: o.big ? [{ mat: 'bm_x', name: 'ボスの素材', n: 1 }, { mat: 'ore_1', name: 'ランクIの鉱石', n: 2 }] : [], chestId, hero: { hp: 5, maxHp: 10 }, coinsAfter: s.coins, xp: o.big ? 420 : 140, firstClear: !!o.big };
  RPG.afterSession = () => ({ settled: true, res });
  RPG.persist();
  S = { sess: 't', queue: [], idx: 0, total: 10, reask: 0, rpg: true, correct: res.C, wrong: o.wrong ? [{ q: '日本でいちばん高い山は', a: '富士山', subject: '社会', map: null, id: 'x1' }, { q: '1+1', a: '2', subject: '算数', map: null, id: 'x2' }] : [], skips: 0, seen: new Set(), wrongIds: new Set(), timer: null };
  result(); return { coins: s.coins, chestId };
}"""
CHECK = """() => {
  const vw = innerWidth, vh = innerHeight, de = document.documentElement, rt = document.getElementById('rwRoot');
  const rect = e => { if (!e) return null; const r = e.getBoundingClientRect(); const t = document.elementFromPoint(Math.min(vw - 1, Math.max(0, (r.left + r.right) / 2)), Math.min(vh - 1, Math.max(0, (r.top + r.bottom) / 2))); return { l: Math.round(r.left), t: Math.round(r.top), r: Math.round(r.right), b: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height), inView: r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw, hit: !!t && (t === e || e.contains(t)) }; };
  const body = document.getElementById('rwBody'), end = document.getElementById('end'), more = document.getElementById('more'), foot = document.querySelector('.rw-foot');
  const coinRows = [...document.querySelectorAll('.rw-row')].filter(e => /コイン/.test(e.textContent)).length;
  return { hscroll: de.scrollWidth > vw + 1 || document.body.scrollWidth > vw + 1, pageScroll: de.scrollHeight > vh + 1, bodyScrollable: body.scrollHeight > body.clientHeight + 1, bodyH: body.clientHeight,
    end: rect(end), more: rect(more), sameSize: !!end && !!more && Math.abs(end.getBoundingClientRect().height - more.getBoundingClientRect().height) < 1 && Math.abs(end.getBoundingClientRect().width - more.getBoundingClientRect().width) < 2,
    footTop: Math.round(foot.getBoundingClientRect().top), bodyBottom: Math.round(body.getBoundingClientRect().bottom), coinRows, chestSlots: document.querySelectorAll('#rwDrop').length, openBtn: !!document.getElementById('rwOpen'),
    total: (document.getElementById('rwTotal') || {}).textContent, scene: rect(document.querySelector('.rw-scene canvas')), small: [...document.querySelectorAll('#app button')].filter(b => { const r = b.getBoundingClientRect(); return r.width && Math.min(r.width, r.height) < 43.5; }).map(b => (b.id || b.className) + ' ' + Math.round(b.getBoundingClientRect().width) + 'x' + Math.round(b.getBoundingClientRect().height)),
    coins: RPG.save.coins }; }"""
SCN = [
  ('before', {'chest': 'coin', 'wrong': True}, None), ('after', {'chest': 'coin', 'wrong': True}, 'open'), ('nochest', {}, None),
  ('big_before', {'chest': 'rare', 'big': True, 'R': 2, 'C': 7, 'wrong': True, 'boss': True}, None), ('big_after', {'chest': 'rare', 'big': True, 'R': 2, 'C': 7, 'wrong': True, 'boss': True}, 'open'),
  ('review', {'chest': 'coin', 'R': 3, 'C': 6, 'wrong': True}, None),
  ('victory', {'chest': 'coin'}, None), ('continue', {'outcome': 'continue', 'chest': 'coin'}, None), ('retreat', {'outcome': 'retreat', 'chest': 'coin'}, None),
]
def page(b, w, h):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}')); pg.route('**/script.google.com/**', blk)
    pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(600)
    return pg
def run_vp(b, vp, w, h):
    t130 = vp.endswith('_t130'); pg = page(b, w, h)
    for name, o, act in SCN:
        info = pg.evaluate(SETUP, o); pg.wait_for_timeout(500)
        before = pg.evaluate(CHECK)
        if act == 'open':
            pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')", timeout=5000); pg.wait_for_timeout(500)
        if t130: pg.evaluate(BUMP); pg.wait_for_timeout(150)
        c = pg.evaluate(CHECK); c['coins_before_open'] = info['coins']
        R['viewports'].setdefault(vp, {})[name] = c
        pg.screenshot(path=os.path.join(OUT, f'{vp}_reward_{name}.png'))
        if name == 'big_after' and vp in ('390x700', '320x640', '390x700_t130'):
            pg.evaluate("() => { const b = document.getElementById('rwBody'); b.scrollTop = b.scrollHeight; }"); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(OUT, f'{vp}_reward_big_after_bottom.png'))
    pg.context.close()
def flows(b):
    pg = page(b, 390, 700)
    # U07：開封前後の残高とコイン行（箱のコインは開封前に足さない）
    info = pg.evaluate(SETUP, {'chest': 'coin', 'wrong': True}); pg.wait_for_timeout(400)
    a = pg.evaluate(CHECK); pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')"); pg.wait_for_timeout(400); z = pg.evaluate(CHECK)
    R['flows']['U07'] = {'coins_start': info['coins'], 'coins_before_open': a['coins'], 'coins_after_open': z['coins'], 'total_before': a['total'], 'total_after': z['total'], 'coin_rows_before': a['coinRows'], 'coin_rows_after': z['coinRows'], 'chest_coin': 40,
                         'ok': a['coins'] == info['coins'] and z['coins'] == info['coins'] + 40 and a['total'] == '+115' and z['total'] == '+155' and a['coinRows'] == 1 and z['coinRows'] == 1}
    # U09 (a) 宝箱なし：空枠なし
    pg.evaluate(SETUP, {}); pg.wait_for_timeout(300)
    R['flows']['U09_nochest'] = pg.evaluate("() => ({ slots: document.querySelectorAll('#rwDrop, .rw-drop').length, openBtn: !!document.getElementById('rwOpen'), endBtn: !!document.getElementById('end') })")
    # U09 (b) 開けずに終了→ホームで後から開封→二重加算なし
    info = pg.evaluate(SETUP, {'chest': 'coin'}); pg.wait_for_timeout(300); c0 = pg.evaluate("() => RPG.save.coins")
    pg.click('#end'); pg.wait_for_selector('.rs-homewrap'); pg.wait_for_timeout(400)
    row = pg.evaluate("() => ({ chestRow: document.getElementById('rsBonusRow').classList.contains('chest'), text: document.getElementById('rsBonusRow').textContent.trim().slice(0, 24) })")
    pg.click('#rsBonusRow'); pg.wait_for_timeout(300); pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')"); pg.wait_for_timeout(400)
    c1 = pg.evaluate("() => RPG.save.coins"); left = pg.evaluate("() => RPGCore.sealedChests(RPG.save).length")
    pg.click('#rsSheetX'); pg.wait_for_timeout(500)
    reopen = pg.evaluate("() => ({ chestRow: document.getElementById('rsBonusRow').classList.contains('chest'), coins: RPG.save.coins })")
    R['flows']['U09_later_open'] = {'home_chest_row': row, 'coins_before': c0, 'coins_after_open': c1, 'delta': c1 - c0, 'sealed_left': left, 'after_close': reopen, 'ok': (c1 - c0 == 40) and left == 0 and not reopen['chestRow'] and reopen['coins'] == c1}
    # U09 (c) 報酬画面で開けて終了→ホームに箱なし
    pg.evaluate(SETUP, {'chest': 'coin'}); pg.wait_for_timeout(300); pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')"); pg.wait_for_timeout(300)
    k0 = pg.evaluate("() => RPG.save.coins"); pg.click('#end'); pg.wait_for_selector('.rs-homewrap'); pg.wait_for_timeout(300)
    R['flows']['U09_open_then_end'] = pg.evaluate("(k0) => ({ chestRow: document.getElementById('rsBonusRow').classList.contains('chest'), coinsSame: RPG.save.coins === k0 })", k0)
    # シート：内訳・技・間違い→again
    pg.evaluate(SETUP, {'chest': 'rare', 'big': True, 'R': 2, 'wrong': True}); pg.wait_for_timeout(300)
    out = {}
    for bid, key in (('rwDetail', 'detail'), ('rwSkill', 'skill'), ('rwWrong', 'wrong')):
        pg.click('#' + bid); pg.wait_for_timeout(250); out[key] = pg.evaluate("() => ({ open: !!document.getElementById('rsSheet'), x: Math.round(document.getElementById('rsSheetX').getBoundingClientRect().height) })")
        if key == 'wrong': out['again_in_sheet'] = pg.evaluate("() => !!document.querySelector('#rsSheet #again')"); pg.screenshot(path=os.path.join(OUT, '390x700_reward_sheet_wrong.png'))
        pg.click('#rsSheetX'); pg.wait_for_timeout(200)
    R['flows']['sheets'] = out
    pg.context.close()
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    for vp, w, h in VPS: run_vp(b, vp, w, h)
    flows(b); b.close()
bad = []
for vp, scr in R['viewports'].items():
    for name, c in scr.items():
        if c['hscroll']: bad.append([vp, name, 'hscroll'])
        if c['pageScroll']: bad.append([vp, name, 'pageScroll'])
        for k in ('end', 'more'):
            r = c[k]
            if not r or not r['inView'] or not r['hit']: bad.append([vp, name, 'notinview/hit ' + k, r])
        if not c['sameSize']: bad.append([vp, name, 'end/more size differ'])
        if c['coinRows'] != 1: bad.append([vp, name, 'coinRows', c['coinRows']])
        if c['chestSlots'] > 1: bad.append([vp, name, 'chestSlots', c['chestSlots']])
        if name == 'nochest' and c['chestSlots']: bad.append([vp, name, 'empty slot'])
        if c['bodyBottom'] > c['footTop'] + 1: bad.append([vp, name, 'body over foot'])
        if vp in ('390x700', '390x640', '375x640', '430x800') and not name.startswith('big') and c['bodyScrollable']: R.setdefault('info_scroll_in_640', []).append([vp, name])   # 390x700 では不要。640高は中だけスクロール（許容）
R['problems'] = bad; R['console_n'] = len(R['console'])
json.dump(R, open(os.path.join(OUT, 'reward_result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'problems': len(bad), 'console': R['console'][:5], 'flows': {k: (v.get('ok') if isinstance(v, dict) and 'ok' in v else v) for k, v in R['flows'].items()}}, ensure_ascii=False))
for x in bad[:50]: print(x)
