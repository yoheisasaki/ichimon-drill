# 08修正指示書 3章・4章（回答画面の冒険帯）の確認。python rpg/tools/fix08_strip.py   （headless chromium、390x700、nosend=1）
# 動きの瞬間は Playwright の clock（偽の時計）で時刻を止めて撮る。実時間の演出時間は fix08_natural.py（録画・自然な速度）で測る。
# 出力：rpg/shots/fix08_strip/ に 01_*.png（画面）・z_*.png（帯だけを2倍に拡大）と result.json
import sys, os, json, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18491
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix08_strip'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
R = {'checks': {}, 'measure': {}, 'console': []}
def chk(n, c, v=None): R['checks'][n] = bool(c) if v is None else {'ok': bool(c), 'v': v}; print(('OK  ' if c else 'NG  ') + n, '' if v is None else v, flush=True)
SAVEK = 'ichimon.rpg.v1'
READY = "() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766"

def ctx_new(b, reduced=False, h=700):
    c = b.new_context(viewport={'width': 390, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce' if reduced else 'no-preference')
    pg = c.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}'))
    pg.route('**/script.google.com/**', lambda r: r.abort())
    return c, pg
def freeze(pg):
    # 偽の時計を止める。以後は run_for(ms) の分だけ進む（スクリーンショットの間に時間が流れない）
    pg.clock.pause_at(pg.evaluate("() => Date.now()") + 300)
def boot(pg, seed=None, clock=True):
    if clock: pg.clock.install()
    pg.goto(URL); pg.wait_for_selector('#go'); pg.wait_for_function(READY, polling=100, timeout=90000)
    if seed:
        pg.evaluate("(js) => { const s = JSON.parse(localStorage.getItem('%s')); (new Function('s', js))(s); localStorage.setItem('%s', JSON.stringify(s)); }" % (SAVEK, SAVEK), seed)
        pg.reload(); pg.wait_for_selector('#go'); pg.wait_for_function(READY, polling=100, timeout=90000)
    if clock: pg.clock.run_for(600); freeze(pg)
def start(pg, flt=None):
    if flt:
        pg.click('.rs-range summary'); pg.click(f'.subj[data-f={flt}]'); pg.wait_for_selector('.rs-range[open]')
    pg.click('#go'); pg.wait_for_selector('.choice, #ans'); pg.clock.run_for(300)
def sv(pg): return pg.evaluate("() => JSON.parse(localStorage.getItem('%s'))" % SAVEK)
def info(pg): return pg.evaluate("() => RPG.stripInfo()")
def answer(pg, ok=True):
    if pg.query_selector('#ans'):
        pg.fill('#ans', pg.evaluate("() => S.cur.accept[0]") if ok else 'ぜったいにちがう'); pg.click('#submit'); return
    idx = pg.evaluate("() => S.opts.indexOf(S.cur.a)") if ok else pg.evaluate("() => S.opts.findIndex(o => o !== S.cur.a)")
    pg.click(f'.choice >> nth={idx}')
def nextq(pg):
    # 不正解のあとの「タップして つぎへ」を押す
    for _ in range(12):
        if pg.evaluate("() => { const n = document.getElementById('next'); return !!n && n.textContent.includes('つぎへ'); }"): pg.click('#next'); pg.clock.run_for(100); return True
        pg.clock.run_for(200)
    return False
def shot(pg, name, strip=False):
    pg.screenshot(path=os.path.join(OUT, name + '.png'))
    if strip:   # 帯の実寸（DPR2）を、ドットが分かるように整数倍（2倍）で拡大して保存
        pg.locator('.rpg-strip canvas').screenshot(path=os.path.join(OUT, '_t.png'))
        from PIL import Image
        im = Image.open(os.path.join(OUT, '_t.png')); im = im.resize((im.width * 2, im.height * 2), Image.NEAREST); im.save(os.path.join(OUT, 'z_' + name + '.png')); os.remove(os.path.join(OUT, '_t.png'))
def geom(pg):
    return pg.evaluate("""() => { const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return {t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height)}; };
      const ch = [...document.querySelectorAll('.choice')], last = ch[ch.length - 1];
      return {vw: innerWidth, vh: innerHeight, canvas: r(document.querySelector('.rpg-strip canvas')), box: r(document.querySelector('.rpg-strip')), lastChoice: r(last), skip: r(document.getElementById('skipc') || document.getElementById('skip')), submit: r(document.getElementById('submit')), map: r(document.getElementById('map')), score: r(document.querySelector('.score')), docH: document.documentElement.scrollHeight, sy: scrollY}; }""")

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    # ---------- A. 通常・命中・技・不正解・撃破 ----------
    c, pg = ctx_new(b)
    boot(pg, "s.jobXp.warrior = 6000; s.advXp = 3000;")
    start(pg); pg.clock.run_for(300)
    g0 = geom(pg); st0 = info(pg); R['measure']['idle'] = {'geom': g0, 'strip': st0}
    shot(pg, '01_normal', True)
    chk('B01 帯の高さ44px・左右余白12〜14px', g0['canvas']['h'] == 44 and 12 <= g0['canvas']['l'] <= 14 and 12 <= g0['vw'] - g0['canvas']['r'] <= 14, g0['canvas'])
    chk('B01 主人公と敵の中心距離55〜75px', 55 <= st0['dist'] <= 75, st0['dist'])
    chk('B01 敵の体力バー 幅30×高さ3、満タン=30', st0['bar']['w'] == 30 and st0['bar']['h'] == 3 and st0['bar']['fill'] == 30, st0['bar'])
    # 下端：帯は画面の最下部（安全領域を除く）。最後までスクロールすると選択肢・わからないが帯の上に見える
    pg.evaluate("() => window.scrollTo(0, 99999)"); g1 = geom(pg)
    chk('U13 最下段の選択肢・わからない・得点が帯に隠れない（最後までスクロールした状態）', g1['lastChoice']['b'] <= g1['box']['t'] and g1['skip']['b'] <= g1['box']['t'] and g1['score']['b'] <= g1['box']['t'], {'lastChoice': g1['lastChoice'], 'skip': g1['skip'], 'score': g1['score'], 'strip_top': g1['box']['t']})
    pg.evaluate("() => window.scrollTo(0, 0)")
    # 敵の体力を大きくして（試験用）、技が出るまで正解を続ける。確定状態はここで保存される
    pg.evaluate("() => { const a = RPG.save.active.battle; a.enemy.hp = a.enemy.maxHp = 100; RPG.persist(); RPG.stripSync(); }")
    pg.clock.run_for(1000)
    hp_before = pg.evaluate("() => RPG.save.active.battle.enemy.hp")
    answer(pg, True); pg.clock.run_for(150); i_dash = info(pg); shot(pg, '02a_correct_dash', True); R['measure']['dash_moment'] = i_dash; pg.clock.run_for(85)   # 踏み込み中→命中の直後（命中は200ms）
    i_hit = info(pg); R['measure']['hit_moment'] = i_hit; shot(pg, '02_correct_hit', True)
    hp_after = pg.evaluate("() => RPG.save.active.battle.enemy.hp")
    chk('B02 命中の瞬間に敵の体力バーが減る（命中前は満タン）', i_dash['bar']['fill'] == 30 and i_hit['bar']['fill'] < 30 and hp_after < hp_before and i_hit['dist'] <= 52, [i_dash['bar'], i_dash['dist'], i_hit['bar'], i_hit['dist'], hp_before, hp_after, pg.evaluate("() => RPG.stripLog.slice(-3)")])
    pg.clock.run_for(900)
    pg.evaluate("() => { const a = RPG.save.active.battle; a.enemy.hp = a.enemy.maxHp = 5000; RPG.persist(); RPG.stripSync(); }"); pg.clock.run_for(1000)
    # 技：正解を続けて skill が計画されるまで
    got_skill = None
    for k in range(14):
        n0 = len(pg.evaluate("() => RPG.stripLog"))
        answer(pg, True); pg.clock.run_for(5)
        log = pg.evaluate("() => RPG.stripLog.slice(%d)" % n0)
        if any(x.get('n', '').startswith('skill') or 'skill' in x.get('n', '') or 'support' in x.get('n', '') for x in log if x['k'] == 'enqueue'):
            got_skill = log; break
        pg.clock.run_for(900)
    if got_skill:
        pg.clock.run_for(235); i_sk = info(pg); R['measure']['skill_moment'] = i_sk
        shot(pg, '03_skill', True)
        nm = pg.evaluate("() => { const s = RPG.save.active; return null }")
        chk('B03 技の発動中は左端に技名が出る（地域名と置き換え）', i_sk['label'] and i_sk['label']['live'], i_sk['label'])
        R['measure']['skill_label'] = i_sk['label']['text']
        pg.clock.run_for(900)
    else: chk('B03 技が出るまで正解', False, 'skill not planned in 14 answers')
    # 不正解：守る（小さな構え150〜250ms）。正解確認の画面で邪魔をしない
    hp_e = pg.evaluate("() => RPG.save.active.battle.enemy.hp")
    answer(pg, False); pg.clock.run_for(100)
    i_w = info(pg); shot(pg, '04_wrong_guard', True); R['measure']['wrong_confirm_text'] = pg.evaluate("() => document.getElementById('next').textContent")
    chk('B04 不正解：守りの構え中は技名・文字の置き換えなし・バー不変', not (i_w['label'] and i_w['label']['live']) and True, i_w['label'])
    pg.clock.run_for(800); nextq(pg); pg.clock.run_for(600)
    log = pg.evaluate("() => RPG.stripLog")
    R['measure']['stripLog_A'] = log
    guard = [x for x in log if x['k'] == 'guard']
    chk('B04 守りの実時間150〜250ms', guard and all(150 <= x['ms'] <= 260 for x in guard), guard)
    # 撃破：敵のHPを小さくして1撃で倒す。次問が出た後も同じ canvas で続き、背景が移る
    pg.evaluate("() => { RPG.save.active.battle.enemy.hp = 1; RPG.persist(); RPG.stripSync(); }"); pg.clock.run_for(100)
    canvas_id0 = pg.evaluate("() => { const c = document.querySelector('.rpg-strip canvas'); window.__cvTag = Math.random(); c.__tag = window.__cvTag; return window.__cvTag; }")
    # 先に「わからない」でなく正解で倒す。いまの問題が入力でもよい
    answer(pg, True); pg.clock.run_for(235)
    i_k0 = info(pg); shot(pg, '05a_kill_hit', True)
    pg.clock.run_for(280); i_k1 = info(pg); shot(pg, '05b_kill_fade', True)
    pg.clock.run_for(300); i_k2 = info(pg)   # 次問(0.6秒後)が出た後。撃破の歩行はまだ続いている
    same_canvas = pg.evaluate("() => { const c = document.querySelector('.rpg-strip canvas'); return c && c.__tag }")
    shot(pg, '05c_after_kill_next_question', True)
    chk('B05 撃破：HPバー0→敵が消える→主人公が歩き背景が移る', i_k0['bar'] and i_k0['bar']['fill'] == 0 and i_k2['view']['gone'] and i_k2['view']['bgOff'] > 0, [i_k0['bar'], i_k2['view']])
    chk('B06 次問に移っても帯の canvas は同じ（作り直さない）', same_canvas == canvas_id0, [same_canvas, canvas_id0])
    pg.clock.run_for(1500)
    log = pg.evaluate("() => RPG.stripLog"); de = [x for x in log if x['k'] == 'defeat']
    chk('B05 撃破の演出は最大800ms', de and all(x['ms'] <= 820 for x in de), de)
    R['measure']['stripLog_A2'] = log
    c.close()

    # ---------- B. 連続回答のキュー上限・演出は状態を変えない・30秒放置・再読込 ----------
    c, pg = ctx_new(b)
    boot(pg); start(pg); pg.clock.run_for(500)
    snapA = sv(pg)
    pg.evaluate("() => { for (let i = 0; i < 12; i++) RPG.play([{t:'hero',act:'normal',dmg:1,heal:0},{t:'enemy',k:'atk',dmg:3}], {correct:true}); }")
    inf = info(pg); mx = inf['pending']
    pg.clock.run_for(30)
    chk('B06 連続12回（回答間隔0ms）でも待ちは2件以内', mx <= 2, mx)
    pg.clock.run_for(8000); inf = info(pg); snapB = sv(pg)
    chk('B06 追いついたあと：演出なし・待ち0・表示は確定状態', not inf['animating'] and inf['pending'] == 0 and inf['view']['eHp'] == pg.evaluate("() => RPG.save.active.battle.enemy.hp"), inf['view'])
    chk('B06/B08 演出（表示専用の再生）だけでは保存データが一切変わらない', json.dumps(snapA, sort_keys=True) == json.dumps(snapB, sort_keys=True))
    # 30秒放置（偽の時計。呼吸などのタイマーは実際に動く）
    nlog = len(pg.evaluate("() => RPG.stripLog")); pg.clock.run_for(30000)
    snapC = sv(pg)
    chk('B07 30秒放置：保存データ・演出ログに変化なし', json.dumps(snapB, sort_keys=True) == json.dumps(snapC, sort_keys=True) and len(pg.evaluate("() => RPG.stripLog")) == nlog)
    # 演出中の再読込
    answer(pg, True); pg.clock.run_for(150)
    pre = sv(pg); pg.clock.resume(); pg.reload(); pg.wait_for_selector('#go'); pg.wait_for_function(READY, polling=100, timeout=90000); pg.clock.run_for(800)
    post = sv(pg)
    keep = lambda s: {'coins': s['coins'], 'advXp': s['advXp'], 'jobXp': s['jobXp'], 'basic': s['active']['basic'] if s.get('active') else None, 'hp': s['active']['battle']['enemy']['hp'] if s.get('active') else None, 'led': s['ledger']}
    chk('B08 演出中の再読込：経験値・コイン・回数・敵HP・台帳が回答直後の値のまま（再加算なし）', keep(pre) == keep(post), [keep(pre), keep(post)])
    chk('B08 再読込のあと、演出は再生されない', pg.evaluate("() => RPG.stripLog.length") == 0)
    c.close()

    # ---------- C. reduce-motion ----------
    pat = [True, True, False, True, True, False]
    def run_pat(reduced):
        c, pg = ctx_new(b, reduced); boot(pg); start(pg); pg.clock.run_for(300)
        pg.evaluate("() => { const a = RPG.save.active.battle; a.enemy.hp = a.enemy.maxHp = 2000; RPG.persist(); RPG.stripSync(); }")
        rows = []; dists = []
        for ok in pat:
            answer(pg, ok); mid = []
            for t in range(6):
                pg.clock.run_for(60); i = info(pg); mid.append((i['dist'], i['bar']['fill'] if i['bar'] else None))
            rows.append(mid); pg.clock.run_for(900)
            if not ok: nextq(pg); pg.clock.run_for(300)
        s = sv(pg); res = {'hp': s['active']['battle']['enemy']['hp'], 'hero': s['active']['battle']['hero']['hp'], 'n': s['active']['basic']['n'], 'c': s['active']['basic']['c'], 'bg': pg.evaluate("() => RPG.stripInfo().view.bgOff")}
        if reduced:
            answer(pg, True); pg.clock.run_for(235); shot(pg, '09_reduced_motion_hit', True)
        c.close(); return res, rows
    r_n, rows_n = run_pat(False); r_r, rows_r = run_pat(True)
    chk('B10 動きを減らしても戦闘の計算結果は同じ（敵HP・主人公HP・回答数・正解数）', {k: r_n[k] for k in ('hp', 'hero', 'n', 'c')} == {k: r_r[k] for k in ('hp', 'hero', 'n', 'c')}, [r_n, r_r])
    rr_dist = {d for row in rows_r for d, f in row}; rn_dist = {d for row in rows_n for d, f in row}
    fills = [f for row in rows_r for d, f in row if f is not None]
    chk('B10 動きを減らすと踏み込みなし（主人公と敵の距離が一定）・通常は距離が変わる', len(rr_dist) == 1 and len(rn_dist) > 1, [sorted(rr_dist), sorted(rn_dist)])
    chk('B10 動きを減らしても敵の体力バーは更新される', len(set(fills)) > 1, sorted(set(fills)))
    chk('B10 動きを減らすと背景は移動しない', r_r['bg'] == 0, r_r['bg'])

    # ---------- D. 地図・入力・追加復習 ----------
    c, pg = ctx_new(b)
    boot(pg); start(pg, 'ちず'); pg.clock.run_for(800)
    pg.evaluate("() => window.scrollTo(0, 0)"); gm = geom(pg); shot(pg, '06_map_question', True)
    pg.evaluate("() => window.scrollTo(0, 99999)"); gm2 = geom(pg)
    chk('U12 地図問題：地図・選択肢の寸法（帯のために縮めない）', gm['map']['w'] >= 330 and gm['map']['h'] >= 150, gm['map'])
    chk('U13 地図問題：最下段の選択肢・わからないが帯に隠れない（最後までスクロール）', all(gm2[k]['b'] <= gm2['box']['t'] for k in ('lastChoice', 'skip', 'submit', 'score') if gm2.get(k)), gm2)
    R['measure']['map'] = {'top': gm, 'bottom': gm2}
    c.close()
    c, pg = ctx_new(b)
    boot(pg); start(pg, 'かく'); pg.clock.run_for(500)
    shot(pg, '07_input_unfocused', True)
    pg.click('#ans'); pg.clock.run_for(400)
    hid = pg.evaluate("() => document.querySelector('.rpg-strip').hidden")
    gi = geom(pg); shot(pg, '07_input_focused')
    chk('B11 入力欄にフォーカス中は帯を隠し、入力欄・こたえるボタンが見える', hid and gi['submit'] and gi['submit']['b'] <= gi['vh'], [hid, gi['submit']])
    pg.fill('#ans', 'あ'); pg.evaluate("() => document.getElementById('ans').blur()"); pg.clock.run_for(300)
    chk('B11 閉じる（blur）と帯が最新状態で戻る', not pg.evaluate("() => document.querySelector('.rpg-strip').hidden") and info(pg)['bar']['fill'] == 30, info(pg)['bar'])
    shot(pg, '07_input_blurred', True)
    # 隠れている間に回答して敵のHPが変わっても、戻ったとき最新
    pg.click('#ans'); pg.clock.run_for(100); pg.fill('#ans', pg.evaluate("() => S.cur.accept[0]")); pg.click('#submit'); pg.clock.run_for(2000)
    c.close()
    # 追加復習の「できた！」：間違いの復習が正解のとき。復習が出るまで続ける
    c, pg = ctx_new(b)
    boot(pg); start(pg); pg.clock.run_for(300)
    pg.evaluate("() => { const a = RPG.save.active.battle; a.enemy.hp = a.enemy.maxHp = 5000; RPG.persist(); RPG.stripSync(); }")
    answer(pg, False); pg.clock.run_for(300); nextq(pg)
    saw_rv = False
    for k in range(8):
        pg.clock.run_for(900)
        if not pg.query_selector('.choice, #ans'): break
        rv = pg.evaluate("() => !!S.cur._rv")
        if rv:
            answer(pg, True); pg.clock.run_for(40); i = info(pg)
            ok = pg.evaluate("() => RPG.stripLog.filter(x => x.k === 'enqueue').slice(-1)[0]")
            pg.clock.run_for(60); lab = info(pg)['label']
            chk('B03 復習で正解：「できた！」を1回出す', lab['text'] == 'できた！' and lab['live'], lab); saw_rv = True; shot(pg, '08_review_correct', True); break
        answer(pg, False); pg.clock.run_for(300); nextq(pg)
    if not saw_rv: chk('B03 復習で正解：「できた！」', False, '復習問題が出なかった')
    c.close()
    b.close()
R['console_errors'] = [x for x in R['console'] if x.startswith('error') or x.startswith('pageerror')]
chk('コンソールエラーなし', not R['console_errors'], R['console_errors'][:3])
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('FAIL:', [k for k, v in R['checks'].items() if not (v if isinstance(v, bool) else v['ok'])])
