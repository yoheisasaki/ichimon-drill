# 10 R04用：自然な速さの1周の録画（headless chromium・実時間・390x700）。python rpg/tools/fix10_record.py
# 回答→通常攻撃→技→不正解→撃破→報酬（宝箱開封・自動スクロール）→装備変更→次の戦闘で反映 まで1本。待ち時間は人が読む程度（短縮しない）。
# 出力: rpg/shots/fix10_record/flow.webm・flow.json（各段階の確認値）・各段階のスクショ。nosend=1（送信遮断）。
import time, sys, os, json, threading, http.server, socketserver, functools, shutil, random
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18593
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix10_record'); os.makedirs(OUT, exist_ok=True)
VID = os.path.join(OUT, '_vid'); shutil.rmtree(VID, ignore_errors=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
READY = "() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766"
SAVEK = 'ichimon.rpg.v1'
random.seed(9)
TL = []
T0 = [0.0]
def tl(m): TL.append([round(time.time() - T0[0], 1), m]); print('T+%.1f %s' % (TL[-1][0], m), flush=True)
R = {'steps': [], 'console': [], 'blocked': 0, 'checks': {}}
def chk(n, c, v=None): R['checks'][n] = bool(c) if v is None else {'ok': bool(c), 'v': v}; print(('OK  ' if c else 'NG  ') + n, '' if v is None else v, flush=True)
def step(m): tl(m); R['steps'].append(m); print('STEP', m, flush=True)
def sv(pg): return pg.evaluate("() => JSON.parse(localStorage.getItem('%s'))" % SAVEK)
def shot(pg, n): pg.screenshot(path=os.path.join(OUT, n + '.png'))
def think(pg, a=1100, b=1900): pg.wait_for_timeout(random.randint(a, b))
def answer(pg, mode):
    tl('回答操作 ' + {'ok': '正解', 'wrong': '不正解', 'skip': 'わからない'}[mode])
    if pg.query_selector('#ans'):
        if mode == 'skip': pg.click('#skip')
        else:
            pg.click('#ans'); pg.keyboard.type(pg.evaluate("() => S.cur.accept[0]") if mode == 'ok' else 'ちがう', delay=90); pg.wait_for_timeout(300); pg.click('#submit')
    else:
        if mode == 'skip': pg.click('#skipc')
        else:
            idx = pg.evaluate("() => S.opts.indexOf(S.cur.a)") if mode == 'ok' else pg.evaluate("() => S.opts.findIndex(o => o !== S.cur.a)")
            pg.click(f'.choice >> nth={idx}')
    if mode == 'ok': pg.wait_for_timeout(900)
    else:
        pg.wait_for_function("() => document.getElementById('next') && document.getElementById('next').textContent.includes('つぎへ')", timeout=5000)
        pg.wait_for_timeout(1600); pg.click('#next'); pg.wait_for_timeout(350)
def play(pg, plan, tag):
    kinds = []
    for mode in plan:
        if pg.query_selector('#rwRoot'): break
        pg.wait_for_selector('.choice, #ans'); think(pg)
        if mode == 'ok' and len(kinds) == 1: shot(pg, f'{tag}_q_before_attack')
        answer(pg, mode); kinds.append(mode)
        tl('  演出ログ直近: ' + ','.join(pg.evaluate("() => RPG.stripLog.filter(x => x.k === 'enqueue').slice(-2).map(x => x.n)")))
        if len(kinds) == 2: shot(pg, f'{tag}_q_after_attack')
    return kinds
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 700}, device_scale_factor=1, is_mobile=True, has_touch=True, record_video_dir=VID, record_video_size={'width': 390, 'height': 700})
    pg = ctx.new_page(); T0[0] = time.time(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}'))
    def blk(r): R['blocked'] += 1; r.abort()
    pg.route('**/script.google.com/**', blk)
    try:
        pg.goto(URL); pg.wait_for_selector('#go'); pg.wait_for_function(READY, timeout=90000)
        # 試験用：戦士Lv上げ・青銅と鉄の剣を所持（装備は初期武器のまま）。日次の朝星の箱は未使用
        pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('%s')); s.jobXp.warrior = 6000; s.coins = 600; s.inv.items.w_sword_1 = 1; s.inv.items.w_sword_2 = 1; s.codex.items.w_sword_1 = 1; s.codex.items.w_sword_2 = 1; localStorage.setItem('%s', JSON.stringify(s)); }" % (SAVEK, SAVEK))
        pg.reload(); pg.wait_for_selector('#go'); pg.wait_for_function(READY, timeout=90000); pg.wait_for_timeout(2500)
        w0 = sv(pg)['equip']['weapon']; step('home (job warrior, weapon %s)' % w0); shot(pg, '01_home')
        pg.wait_for_timeout(1500)
        tl('スタート（10問）をタップ'); pg.click('#go'); pg.wait_for_selector('.choice, #ans'); pg.wait_for_timeout(1800); shot(pg, '02_quiz_first')
        step('adventure 1: answer / attack / skill / wrong / defeat')
        kinds = play(pg, ['ok', 'ok', 'ok', 'wrong', 'ok', 'ok', 'skip', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok'], 'a1')
        pg.wait_for_selector('#rwRoot', timeout=15000); pg.wait_for_timeout(1800); shot(pg, '03_reward_sealed')
        log = pg.evaluate("() => RPG.stripLog.filter(x => x.k === 'enqueue').map(x => x.n)")
        R['a1_strip_events'] = log; R['a1_kinds'] = kinds
        chk('R03 通常攻撃・技・不正解（守り）・撃破が演出に出た', any(n.startswith('attack') for n in log) and any('skill' in n for n in log) and any(n.startswith('guard') for n in log) and any('defeat' in n for n in log), log)
        coins_sealed = sv(pg)['coins']
        # 宝箱開封（自動スクロール）：開封前後の位置と、アイテム名が操作帯に隠れないか
        pg.wait_for_timeout(1200)
        tl('宝箱を開ける をタップ'); pg.click('#rwOpen'); pg.wait_for_timeout(300)
        pg.wait_for_function("() => !document.getElementById('rwOpen')", timeout=6000); pg.wait_for_timeout(2200); shot(pg, '04_reward_opened')
        geo = pg.evaluate("() => { const l = document.getElementById('rwChestLine'), f = document.querySelector('.rw-foot'); if (!l || !f) return null; const a = l.getBoundingClientRect(), c = f.getBoundingClientRect(); return { lineTop: Math.round(a.top), lineBottom: Math.round(a.bottom), footTop: Math.round(c.top), vh: innerHeight, text: l.innerText.slice(0, 60) }; }")
        chk('R03 開封後に中身が操作帯に隠れない（自動スクロール後）', geo and geo['lineBottom'] <= geo['footTop'] and geo['lineTop'] >= 0, geo)
        s1 = sv(pg); chk('R03 開封後に宝箱の分だけ増える・二重加算なし', s1['coins'] >= coins_sealed and s1['chests'][-1]['status'] == 'opened', [coins_sealed, s1['coins']])
        pg.wait_for_timeout(1500)
        tl('おわる をタップ'); pg.click('#end'); pg.wait_for_selector('#go'); pg.wait_for_timeout(1500); step('reward closed -> home')
        # 装備変更：自分→装備→鉄の剣を試着→確定
        pg.click('.rs-tab[data-tab=me]'); pg.wait_for_selector('[data-go=equip]'); pg.wait_for_timeout(1000)
        pg.click('[data-go=equip]'); pg.wait_for_selector('#eqOk'); pg.wait_for_timeout(1500); shot(pg, '05_equip_before')
        tl('鉄の剣を試着'); pg.click('[data-eq=w_sword_2]'); pg.wait_for_timeout(1800); shot(pg, '06_equip_try')
        tl('装備を確定'); pg.click('#eqOk'); pg.wait_for_timeout(1500); shot(pg, '07_equip_confirmed')
        w1 = sv(pg)['equip']['weapon']; chk('R03 装備を鉄の剣に変更して保存', w0 != w1 and w1 == 'w_sword_2', [w0, w1]); step('equip changed %s -> %s' % (w0, w1))
        pg.click('#rsBack') if pg.query_selector('#rsBack') else None; pg.wait_for_timeout(600)
        pg.click('.rs-tab[data-tab=home]'); pg.wait_for_selector('#go'); pg.wait_for_timeout(1500)
        # 次の戦闘で反映：帯の主人公が新しい武器で描かれる呼出しを記録
        pg.evaluate("() => { const SP = RPGSprites, o = SP.drawHeroLayered; window.__calls = []; SP.drawHeroLayered = function (c, a) { window.__calls.push({use: a.use, weaponId: a.weaponId || null, pose: a.pose}); return o.apply(this, arguments); }; }")
        tl('2回目の冒険を開始'); pg.click('#go'); pg.wait_for_selector('.choice, #ans'); pg.wait_for_timeout(1800); shot(pg, '08_quiz_new_weapon')
        step('adventure 2: new weapon in strip')
        for mode in ('ok', 'ok', 'ok'):
            pg.wait_for_selector('.choice, #ans'); think(pg); answer(pg, mode)
        shot(pg, '09_quiz_after_attack_new_weapon')
        calls = pg.evaluate("() => window.__calls.filter(c => c.use === 'strip')")
        chk('R03 次の戦闘の帯が新しい武器（w_sword_2）で描かれる', len(calls) >= 1 and all(c['weaponId'] == 'w_sword_2' for c in calls), calls[:3])
        pg.wait_for_timeout(1200)
        R['stats'] = pg.evaluate("() => { const st = {}; RPG.stripLog.forEach(x => { if ('ms' in x) (st[x.k] = st[x.k] || []).push(x.ms); }); const o = {}; for (const k in st) o[k] = { n: st[k].length, mean: Math.round(st[k].reduce((a, c) => a + c, 0) / st[k].length) }; return o; }")
    except Exception as e:
        import traceback; R['exception'] = traceback.format_exc(); print(R['exception'])
        try: shot(pg, 'ZZ_exception')
        except Exception: pass
    vpath = pg.video.path() if pg.video else None
    ctx.close(); b.close()
if vpath and os.path.exists(vpath): shutil.copyfile(vpath, os.path.join(OUT, 'flow.webm'))
shutil.rmtree(VID, ignore_errors=True)
R['timeline'] = TL
R['pass'] = sum(1 for v in R['checks'].values() if (v if isinstance(v, bool) else v['ok'])); R['fail'] = [k for k, v in R['checks'].items() if not (v if isinstance(v, bool) else v['ok'])]
json.dump(R, open(os.path.join(OUT, 'flow.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'pass': R['pass'], 'fail': R['fail'], 'console': R['console'][:5], 'blocked': R['blocked'], 'exception': R.get('exception')}, ensure_ascii=False))
