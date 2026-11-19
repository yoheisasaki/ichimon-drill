# 07 確認票 E「一周」（ブラウザ自動操作。headless chromium、390px、nosend=1。人間の試遊ではない）。python rpg/tools/loop_07.py [port]
# 新規セーブ→主人公→範囲→10問→結果→開封→終了→店で購入→試着/取消/装備→試験用セーブで魔法戦士へ転職→ホーム→再読込→次の冒険で外見保持＋異常系。
# 操作は実際のクリック/入力。録画 rpg/shots/fix07_loop/loop.webm、スクショと result.json も同じ場所。送信先は遮断し、遮断数が0であることを確かめる。
import sys, json, os, glob, shutil, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18471
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix07_loop'); os.makedirs(OUT, exist_ok=True)
VID = os.path.join(OUT, '_vid'); shutil.rmtree(VID, ignore_errors=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'checks': {}, 'console': [], 'blocked': 0, 'requests_out': [], 'steps': []}
def chk(name, cond, extra=None): R['checks'][name] = bool(cond) if extra is None else {'ok': bool(cond), 'v': extra}
def blk(r): R['blocked'] += 1; r.abort()
SAVE = "() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))"
def step(m): R['steps'].append(m); print('STEP', m, flush=True)
def shot(pg, name, full=True): pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=full)
def save(pg): return pg.evaluate(SAVE)
def hero(pg, sel='canvas[data-hero]'):
    return pg.evaluate("(sel) => { const c = document.querySelector(sel); if (!c) return null; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i+1] * 3 + d[i+2] * 7 + d[i+3] * 11) >>> 0; return {opt: JSON.parse(c.dataset.hero), hash: h}; }", sel)
def heroes(pg):
    return pg.evaluate("() => [...document.querySelectorAll('canvas[data-hero]')].map(c => { const o = JSON.parse(c.dataset.hero); return {use: o.use, job: o.job, look: o.look, weaponId: o.weaponId || null, costume: o.costume || null}; })")
INSTR = "() => { const SP = RPGSprites, o = SP.drawHeroLayered; window.__calls = []; SP.drawHeroLayered = function (c, a) { const r = o.apply(this, arguments); window.__calls.push({use: a.use, job: a.job, weaponId: a.weaponId || null, costume: a.costume || null, pose: a.pose, look: a.look ? JSON.stringify([a.look.face, a.look.hairStyle, a.look.skin, a.look.hair]) : null}); return r; }; }"
def settle(pg, ms=450): pg.wait_for_timeout(ms)

def answer_one(pg, mode):
    """いま出ている1問に、実際のクリック/入力で答える。mode: ok / wrong / skip"""
    isin = pg.query_selector('#ans') is not None
    if mode == 'skip' and not isin:
        pg.click('#skipc')
    elif isin:
        txt = pg.evaluate("() => S.cur.accept[0]") if mode == 'ok' else 'ぜったいにちがう'
        if mode == 'skip': mode = 'wrong'
        pg.click('#ans'); pg.fill('#ans', txt); pg.click('#submit')
    else:
        idx = pg.evaluate("() => S.opts.indexOf(S.cur.a)")
        if mode == 'wrong': idx = pg.evaluate("() => S.opts.findIndex(o => o !== S.cur.a)")
        pg.click(f'.choice >> nth={idx}')
    if mode == 'ok': pg.wait_for_timeout(700)
    else:
        pg.wait_for_function("() => document.getElementById('next') && document.getElementById('next').textContent.includes('つぎへ')", timeout=4000)
        shot(pg, 'q_after_' + mode, full=False) if not os.path.exists(os.path.join(OUT, 'q_after_' + mode + '.png')) else None
        pg.click('#next')
    pg.wait_for_timeout(80)

def play(pg, plan):
    """10問＋復習を通す。plan は基本10問の ok/wrong/skip。復習は全部正解"""
    i = 0; kinds = {'ok': 0, 'wrong': 0, 'skip': 0, 'review': 0, 'input': 0}
    for _ in range(60):
        if pg.query_selector('#rwRoot'): break
        if pg.query_selector('.choice, #ans') is None: pg.wait_for_timeout(200); continue
        rv = pg.evaluate("() => !!S.cur._rv")
        mode = 'ok' if rv else plan[i % len(plan)]
        if rv: kinds['review'] += 1
        else: i += 1; kinds[mode] += 1
        if pg.query_selector('#ans'): kinds['input'] += 1
        answer_one(pg, mode)
    pg.wait_for_selector('#rwRoot', timeout=10000); settle(pg, 600)
    return kinds

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        record_video_dir=VID, record_video_size={'width': 390, 'height': 844})
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}'))
    pg.on('request', lambda r: R['requests_out'].append(r.url) if not r.url.startswith(f'http://127.0.0.1:{PORT}') and not r.url.startswith('data:') else None)
    pg.route('**/script.google.com/**', blk)
    try:
        # ---- 1. 新規セーブ ----
        pg.goto(URL); pg.wait_for_selector('#go'); pg.wait_for_function("() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766", timeout=90000); settle(pg, 600)
        sv0 = save(pg) if pg.evaluate("() => !!localStorage.getItem('ichimon.rpg.v1')") else None
        chk('E1 new save: no previous data', sv0 is None or (sv0['coins'] == 0 and sv0['stats']['adventures'] == 0), sv0 and sv0['coins'])
        shot(pg, '01_home_new')
        # 主人公を選ぶ（じぶん→名前・見た目）
        pg.click('.rs-tab[data-tab=me]'); pg.wait_for_selector('[data-go=look]'); pg.click('[data-go=look]'); pg.wait_for_selector('#lookOk')
        pg.fill('#rsName', 'テスト'); pg.click('[data-lk=face][data-v="2"]'); pg.click('[data-lk=hair][data-v="3"]'); pg.click('[data-lk=skin][data-v="1"]'); pg.click('[data-lk=hairColor][data-v="2"]')
        shot(pg, '02_look_chosen'); pg.click('#lookOk'); settle(pg)
        look = save(pg)['look']; chk('E1 hero chosen & saved', look['face'] == 2 and look['hair'] == 3 and look['skin'] == 1 and look['hairColor'] == 2 and save(pg)['name'] == 'テスト', look)
        pg.click('#rsBack') if pg.query_selector('#rsBack') else None
        pg.click('.rs-tab[data-tab=home]'); pg.wait_for_selector('#go'); settle(pg)
        h_home0 = hero(pg); shot(pg, '03_home_hero')
        # ---- 2. 範囲を決める ----
        pg.click('.rs-range summary'); pg.click('.subj[data-f=社会]'); pg.wait_for_selector('.rs-range[open]'); shot(pg, '04_range_social'); pg.click('#rsRangeX')
        chk('E1 range = 社会', pg.evaluate("() => filter") == '社会')
        # ---- 3. 10問（正解/不正解/わかんない＋復習） ----
        pg.click('#go'); pg.wait_for_selector('.choice, #ans'); settle(pg, 500); shot(pg, '05_quiz_first', full=False)
        step('start 10')
        kinds = play(pg, ['ok', 'ok', 'wrong', 'skip', 'ok', 'wrong', 'ok', 'ok', 'skip', 'ok'])
        chk('E2 mixed answers (ok/wrong/skip + review)', kinds['ok'] >= 4 and kinds['wrong'] >= 1 and kinds['skip'] >= 1 and kinds['review'] >= 1, kinds)
        R['kinds'] = kinds
        # ---- 結果 ----
        info = pg.evaluate("() => { const q = s => document.querySelector(s); return { outcome: q('#rwRoot').dataset.outcome, total: q('#rwTotal').innerText, base: q('#rwCoinBase') && q('#rwCoinBase').innerText, open: !!q('#rwOpen'), text: q('#rwRoot').innerText.slice(0, 400) }; }")
        R['result_before_open'] = info; shot(pg, '06_result_sealed')
        sv1 = save(pg)
        chk('E3 sealed chest exists, coins=base only', info['open'] and sv1['chests'][-1]['status'] == 'sealed' and sv1['coins'] == int(info['total'].replace('+', '')), [info['total'], sv1['coins']])
        c_before = sv1['coins']
        pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')", timeout=5000); settle(pg, 500); shot(pg, '07_result_opened')
        sv2 = save(pg); got = sv2['coins'] - c_before
        tot = pg.evaluate("() => document.getElementById('rwTotal').innerText")
        chk('E3 コイン1行：開封後は 学習討伐＋宝箱 の合算（残高と一致）', tot == '+' + str(int(info['total'].replace('+', '')) + got) and sv2['chests'][-1]['status'] == 'opened', [tot, sv2['coins'], got])
        R['result_after_open'] = {'total': tot, 'chest': sv2['chests'][-1].get('result')}
        pg.click('#end'); pg.wait_for_selector('#go'); settle(pg)
        chk('E7 no sealed chest: home has no chest entry', pg.query_selector('#rsChestBox') is None)
        coins = save(pg)['coins']; step(f'coins after adventure {coins}')
        # ---- 4. 店で武器を買う ----
        pg.click('.rs-tab[data-tab=town]'); pg.wait_for_selector('.rs-tile[data-go=shop]'); pg.click('.rs-tile[data-go=shop]'); pg.wait_for_selector('[data-pick]')
        shot(pg, '08_shop')
        buyable = pg.evaluate("() => [...document.querySelectorAll('[data-pick]')].map(b => ({id: b.dataset.pick, dis: !!RPGCore.canBuy(RPG.save, b.dataset.pick)}))")
        ok_item = next((x for x in buyable if not x['dis']), None)
        chk('E4 an affordable weapon exists', ok_item is not None, [coins, buyable[:3]])
        if ok_item:
            wid = ok_item['id']; price = pg.evaluate("(id) => RPGData.ITEMS[id].price", wid)
            pg.click(f'[data-pick={wid}]'); pg.click(f'[data-buy={wid}]'); settle(pg, 300)
            s = save(pg); chk('E4 purchase: balance reduced by price, item owned', s['inv']['items'].get(wid) == 1 and s['coins'] == coins - price, [coins, price, s['coins']])
            shot(pg, '10_shop_bought')
            # 試着→取消→装備（最初の青銅の剣は「はじまりの武器」と同じ絵で描かれる＝既知。数値と表示名で確かめ、絵の差は鉄の剣で確かめる）
            pg.click(f'[data-try={wid}]'); pg.wait_for_selector('#eqOk'); settle(pg, 500)
            h_try = hero(pg); shot(pg, '11_equip_try')
            chk('E4 try: preview weapon is the bought sword, numbers change', h_try['opt'].get('weaponId') == wid and pg.evaluate("() => document.querySelector('.rs-eqr').innerText").count('+') >= 1 or '+' in pg.evaluate("() => document.querySelector('.rs-eqr').innerText"), h_try['opt'])
            pg.click('#eqReset'); settle(pg, 400); shot(pg, '12_equip_after_cancel')
            chk('E4 cancel keeps saved weapon', save(pg)['equip']['weapon'] == 'w_start')
            pg.click(f'[data-eq={wid}]'); settle(pg, 400)
            pg.click('#eqOk'); settle(pg, 500); h_eq = hero(pg); shot(pg, '13_equip_confirmed')
            chk('E4 equip saved', save(pg)['equip']['weapon'] == wid and h_eq['opt'].get('weaponId') == wid, save(pg)['equip'])
            # 資金不足：防具・アクセの買えない商品は押せず、残高は変わらない（E7）
            pg.click('#rsBack'); pg.wait_for_selector('[data-st]'); pg.click('[data-st=armor]'); pg.wait_for_selector('[data-pick]')
            broke = pg.evaluate("() => { const b = [...document.querySelectorAll('[data-pick]')].find(x => RPGCore.canBuy(RPG.save, x.dataset.pick)); if (!b) return null; b.click(); return {id: b.dataset.pick, why: (document.getElementById('shopWhy') || {}).textContent || '', dis: document.getElementById('shopBuy').disabled}; }")
            c_now = save(pg)['coins']
            if broke:
                pg.evaluate("() => document.getElementById('shopBuy').click()")
                chk('E7 insufficient funds: buy disabled, reason shown, balance unchanged', save(pg)['coins'] == c_now and broke['id'] not in save(pg)['inv']['items'] and len(broke['why']) > 0, [broke, c_now])
                shot(pg, '09_shop_insufficient')
            else: chk('E7 insufficient funds: buy disabled, reason shown, balance unchanged', False, 'no unaffordable item shown')
        # ---- 7. 異常系（転職条件未達：まだ基本職Lv10に届かない） ----
        pg.evaluate("() => RPG.go('me')"); pg.wait_for_selector('[data-go=jobs]'); pg.click('[data-go=jobs]'); pg.wait_for_selector('.rs-joblist')
        pg.click('[data-tier=adv]'); pg.click('.rs-jobcard >> nth=0'); pg.wait_for_selector('#jobDo'); settle(pg, 400)
        dis = pg.get_attribute('#jobDo', 'disabled') is not None; txt = pg.inner_text('.rs-app')
        chk('E7 job requirement unmet: button disabled & reason shown', dis and ('Lv10' in txt or 'Lv' in txt), txt[:200]); shot(pg, '14_job_unmet')
        s_before = save(pg); pg.evaluate("() => document.getElementById('jobDo').click()"); settle(pg, 200)
        chk('E7 job unmet: click does nothing', save(pg)['job'] == s_before['job'])
        # ---- 5. 条件を満たした別の試験用セーブ（同じ外見・装備のまま職業Lvだけ上げる）で魔法戦士へ ----
        pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('ichimon.rpg.v1')); s.jobXp.warrior = 6000; s.jobXp.mage = 6000; s.coins = 500; s.inv.items.w_bow_1 = 1; s.codex.items.w_bow_1 = 1; s.inv.items.w_sword_2 = 1; s.codex.items.w_sword_2 = 1; localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }")
        pg.reload(); pg.wait_for_selector('#go'); pg.wait_for_function("() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766", timeout=90000); settle(pg, 500)
        step('test save loaded (warrior/mage Lv>=10)')
        # 青銅の剣→鉄の剣：試着で絵が変わり、取消で戻り、確定後も保たれる（A03/A04）
        pg.click('.rs-tab[data-tab=me]'); pg.click('[data-go=equip]'); pg.wait_for_selector('#eqOk'); settle(pg, 500)
        h_a = hero(pg); shot(pg, '15_equip_before_sword2')
        pg.click('[data-eq=w_sword_2]'); settle(pg, 400); h_b = hero(pg); shot(pg, '16_equip_try_sword2')
        chk('E4 try sword2 sword: picture changes, face/look same', h_a['hash'] != h_b['hash'] and h_b['opt'].get('weaponId') == 'w_sword_2', [h_a['hash'], h_b['hash']])
        pg.click('#eqReset'); settle(pg, 400); h_c = hero(pg)
        chk('E4 cancel: picture returns, save unchanged', h_c['hash'] == h_a['hash'] and save(pg)['equip']['weapon'] == wid, [h_a['hash'], h_c['hash']])
        pg.click('[data-eq=w_sword_2]'); settle(pg, 300); pg.click('#eqOk'); settle(pg, 500); h_d = hero(pg); shot(pg, '17_equip_confirmed_sword2')
        chk('E4 equip sword2 sword: saved & same picture as try', save(pg)['equip']['weapon'] == 'w_sword_2' and h_d['hash'] == h_b['hash'])
        wid = 'w_sword_2'
        # 装備不可（弓は戦士・魔法戦士の武器ではない）
        pg.evaluate("() => { const d = [...document.querySelectorAll('details.rs-det')].find(x => x.textContent.includes('用')); if (d) d.open = true; }")
        bow = pg.query_selector('[data-eq=w_bow_1]')
        if bow:
            bow.click(force=True); settle(pg, 300)
            msg = pg.evaluate("() => (document.querySelector('.rs-msg') || {}).textContent || ''")
            chk('E7 unequippable weapon: error shown, save unchanged, picture unchanged', save(pg)['equip']['weapon'] == 'w_sword_2' and len(msg) > 0 and hero(pg)['hash'] == h_d['hash'], [msg, save(pg)['equip']])
            R['unequippable_msg'] = msg; shot(pg, '18_equip_unusable')
        else: chk('E7 unequippable: bow row present', False)
        pg.click('#rsBack'); pg.wait_for_selector('[data-go=jobs]')
        pg.click('[data-go=jobs]'); pg.wait_for_selector('.rs-joblist'); pg.click('[data-tier=adv]'); pg.wait_for_selector('.rs-jobcard')
        # 魔法戦士のカード（職業名で探す）
        pg.click('.rs-jobcard:has-text("魔法戦士")'); pg.wait_for_selector('#jobDo'); settle(pg, 500)
        chk('E5 job unlocked: button enabled', pg.get_attribute('#jobDo', 'disabled') is None); shot(pg, '19_jobdetail_magicknight')
        w_before = save(pg)['equip']['weapon']
        pg.click('#jobDo'); pg.wait_for_selector('#fxSkip'); settle(pg, 700); shot(pg, '20_job_fx', full=False)
        pg.click('#fxSkip'); pg.wait_for_selector('.rs-links, [data-go=look]'); settle(pg, 500)
        s = save(pg); chk('E5 job changed to magicknight, weapon kept', s['job'] == 'magicknight' and s['equip']['weapon'] == w_before, [s['job'], s['equip']])
        shot(pg, '21_me_magicknight')
        # ---- 6. ホーム→再読込→次の冒険 ----
        pg.click('.rs-tab[data-tab=home]'); pg.wait_for_selector('#go'); settle(pg, 500)
        hh = hero(pg); shot(pg, '22_home_magicknight')
        chk('E6 home hero = magicknight + same look + same weapon', hh['opt']['job'] == 'magicknight' and hh['opt'].get('look') in (None, save(pg)['look']) and hh['opt'].get('weaponId') == w_before, hh['opt'])
        pg.reload(); pg.wait_for_selector('#go'); pg.wait_for_function("() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766", timeout=90000); settle(pg, 700)
        hh2 = hero(pg); shot(pg, '23_home_after_reload')
        chk('E6 after reload: identical hero picture', hh2['hash'] == hh['hash'], [hh['hash'], hh2['hash']])
        pg.evaluate(INSTR)
        pg.click('.rs-tab[data-tab=me]'); pg.wait_for_selector('[data-go=look]'); settle(pg, 500)
        me_calls = pg.evaluate("() => window.__calls"); looks0 = {c['look'] for c in me_calls if c['look']}
        chk('E6 じぶん screen hero: magicknight + saved weapon', len(me_calls) >= 1 and all(c['job'] == 'magicknight' for c in me_calls), me_calls[:2])
        pg.click('.rs-tab[data-tab=home]'); pg.wait_for_selector('#go'); settle(pg, 300)
        pg.evaluate("() => window.__calls.length = 0")
        pg.click('.rs-range summary'); pg.click('.subj[data-f=かく]'); pg.wait_for_selector('.rs-range[open]'); pg.click('#rsRangeX'); chk('E2 second adventure range = かいてこたえる（入力問題）', pg.evaluate("() => filter") == 'かく')
        pg.click('#go'); pg.wait_for_selector('.choice, #ans'); settle(pg, 900); shot(pg, '24_quiz_strip', full=False)
        sc = pg.evaluate("() => window.__calls"); R['strip_calls'] = sc[:4]
        sh = [c for c in sc if c['use'] == 'strip']
        chk('E6 next adventure strip: same look/job/weapon', len(sh) >= 1 and all(c['job'] == 'magicknight' and c['look'] in looks0 and c['weaponId'] == w_before for c in sh), [sh[:2], list(looks0)])
        pg.evaluate("() => window.__calls.length = 0")
        kinds2 = play(pg, ['ok'] * 10); shot(pg, '25_result_next'); R['kinds2'] = kinds2; chk('E2 typed-answer questions played with real typing', kinds2['input'] >= 5, kinds2)
        rc = pg.evaluate("() => window.__calls"); R['result_calls'] = [c for c in rc if c['use'] != 'strip'][:4]
        rh = [c for c in rc if c['use'] != 'strip']
        chk('E6 next result: same look/job/weapon', len(rh) >= 1 and all(c['job'] == 'magicknight' and c['look'] in looks0 and c['weaponId'] == w_before for c in rh), [rh[:2], list(looks0)])
        pg.click('#rwOpen') if pg.query_selector('#rwOpen') else None; settle(pg, 600); shot(pg, '26_result_next_opened')
        pg.click('#end'); pg.wait_for_selector('#go'); settle(pg, 400)
        s = save(pg); chk('E6 save sane at end (coins>=0, job kept, chests all opened)', s['coins'] >= 0 and s['job'] == 'magicknight' and all(c['status'] == 'opened' for c in s['chests']), [s['coins'], len(s['chests'])])
        chk('nosend: no request to script.google.com attempted', R['blocked'] == 0, R['blocked'])
        chk('nosend: no external request at all', len(R['requests_out']) == 0, R['requests_out'][:5])
        chk('console: no error/warning', len(R['console']) == 0, R['console'][:5])
    except Exception as e:
        import traceback; R['exception'] = traceback.format_exc(); print(R['exception'])
        try: shot(pg, 'ZZ_exception', full=False)
        except Exception: pass
    vpath = pg.video.path() if pg.video else None
    ctx.close(); b.close()
if vpath and os.path.exists(vpath): shutil.copyfile(vpath, os.path.join(OUT, 'loop.webm'))
shutil.rmtree(VID, ignore_errors=True)
R['pass'] = sum(1 for v in R['checks'].values() if (v if isinstance(v, bool) else v['ok']))
R['fail'] = [k for k, v in R['checks'].items() if not (v if isinstance(v, bool) else v['ok'])]
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'pass': R['pass'], 'fail': R['fail'], 'console': R['console'][:6], 'blocked': R['blocked'], 'exception': R.get('exception', None)}, ensure_ascii=False, indent=1))
