# 異常系・再開の画面確認（headless）。python rpg/tools/ui_test2.py [port]
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
def answer(pg, ok):
    is_rv = pg.evaluate("() => !!S.cur._rv")
    pg.evaluate(CORRECT if ok else WRONG)
    if ok: pg.wait_for_timeout(720)
    else:
        pg.wait_for_function("() => document.getElementById('next') && document.getElementById('next').textContent.includes('つぎへ')", timeout=3000); pg.click('#next')
    pg.wait_for_timeout(60)
    return is_rv
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    def newpage(ctx):
        ctx.add_init_script('window.__rangeOpen = true'); pg = ctx.new_page(); pg.route('**/script.google.com/**', blk)
        pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') else None)
        pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}')); return pg
    # ---- A. 保存不能（setItem が例外）でも学習は動き、案内が出る
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = newpage(ctx)
    pg.add_init_script("const _s = Storage.prototype.setItem; Storage.prototype.setItem = function(k, v) { if (k.startsWith('ichimon.rpg')) throw new Error('QuotaExceededError'); return _s.call(this, k, v); };")
    pg.goto(URL); pg.wait_for_selector('.subj')
    chk('A:rpg_disabled_on_storage_error', pg.evaluate('() => RPG.ok === false && RPG.err === "storage"'))
    chk('A:home_notice', pg.query_selector('.rpg-notice') is not None)
    if True: pg.screenshot(path=os.path.join(OUT, 'home_savefail.png'))
    pg.evaluate("() => start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10))"); pg.wait_for_selector('.choice')
    chk('A:no_strip_when_disabled', pg.query_selector('.rpg-strip') is None)
    answer(pg, True)
    chk('A:learning_still_records', pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.queue.v1')).rows.length") == 1)
    ctx.close()
    # ---- B. 2タブ：古いタブは上書きしない
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    p1 = newpage(ctx); p1.goto(URL); p1.wait_for_selector('.subj')
    p2 = newpage(ctx); p2.goto(URL); p2.wait_for_selector('.subj')
    p1.evaluate("() => start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10))"); p1.wait_for_selector('.choice'); answer(p1, True)
    rev_after_p1 = p1.evaluate("() => JSON.parse(localStorage.getItem('ichimon.rpg.v1')).rev")
    p2.evaluate("() => start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10))"); p2.wait_for_selector('.choice')
    chk('B:stale_tab_stops', p2.evaluate('() => RPG.ok === false && RPG.err === "stale"'))
    answer(p2, True)
    chk('B:stale_not_overwritten', p1.evaluate("() => JSON.parse(localStorage.getItem('ichimon.rpg.v1')).rev") >= rev_after_p1)
    p2.evaluate("() => home()")
    chk('B:stale_notice_shown', 'なおしてね' in p2.inner_text('#app'))
    ctx.close()
    # ---- C. 途中でやめる→再開（復習の持ち越し）・短いセッションの累積
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = newpage(ctx); pg.goto(URL); pg.wait_for_selector('.subj')
    pg.evaluate("() => start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10))"); pg.wait_for_selector('.choice')
    answer(pg, False); answer(pg, True); answer(pg, True)      # 1問目×(復習待ち)、2,3問目○
    pg.click('#quit'); pg.wait_for_selector('.subj')
    st = pg.evaluate("() => { const a = RPG.save.active; return {n: a.basic.n, pending: a.reviews.pending.length, used: a.reviews.used}; }")
    chk('C:active_kept_after_quit', st['n'] == 3 and st['pending'] == 1, st)
    chk('C:home_progress_note', '3 / 10' in pg.inner_text('#app'))
    pg.reload(); pg.wait_for_selector('.subj')
    st2 = pg.evaluate("() => { const a = RPG.save.active; return a ? {n: a.basic.n, pending: a.reviews.pending.length} : null; }")
    chk('C:active_kept_after_reload', st2 == {'n': 3, 'pending': 1}, st2)
    pg.evaluate("() => start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10))"); pg.wait_for_selector('.choice')
    info = pg.evaluate("() => ({total: S.total, queue: S.queue.length, firstIsReview: !!S.queue[0]._rv, reask: S.reask})")
    chk('C:resume_caps_basics_to_7_and_prepends_review', info['total'] == 7 and info['firstIsReview'] and info['reask'] == 1, info)
    for _ in range(40):
        if pg.query_selector('#rwRoot'): break
        answer(pg, True)
    pg.wait_for_selector('#rwRoot', timeout=5000)
    sv = pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))")
    chk('C:settled_once_after_accumulation', sv['active'] is None and sv['stats']['adventures'] == 1, {'adv': sv['stats']['adventures'], 'xp': sv['advXp']})
    # 次の通常スタートは新しい冒険（2回目 ×2）
    pg.click('#more'); pg.wait_for_selector('.choice')
    chk('C:next_adventure_slot2', pg.evaluate("() => RPG.save.active.basic.n === 0 && RPG.save.active.no === 2"))
    ctx.close()
    # ---- D. 短い範囲（3問しかない）：冒険3/10 を表示し宝箱は出ない
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = newpage(ctx); pg.goto(URL); pg.wait_for_selector('.subj')
    pg.evaluate("() => start(pick(pool().filter(q => q.type !== 'input' && !q.map), 3))"); pg.wait_for_selector('.choice')
    for _ in range(10):
        if pg.query_selector('.res-score'): break
        answer(pg, True)
    pg.wait_for_selector('.res-score', timeout=5000)
    txt = pg.inner_text('#app'); chk('D:short_session_note', '3 / 10' in txt and 'ぼうけん' in txt, txt[:120].replace('\n', ' '))
    chk('D:no_reward_screen_for_short', pg.query_selector('#rwRoot') is None)
    pg.screenshot(path=os.path.join(OUT, 'result_short.png'))
    chk('D:buttons_still_work', pg.query_selector('#more') is not None and pg.query_selector('#end') is not None)
    ctx.close()
    # ---- E. 入力問題：キーボード（フォーカス）中は帯を隠す
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = newpage(ctx); pg.goto(URL); pg.wait_for_selector('.subj')
    pg.evaluate("() => { start([qs().find(q => q.type === 'input')]); }"); pg.wait_for_selector('#ans')
    vis0 = pg.evaluate("() => !document.querySelector('.rpg-strip').hidden")
    pg.focus('#ans'); pg.wait_for_timeout(100)
    vis1 = pg.evaluate("() => !document.querySelector('.rpg-strip').hidden")
    pg.evaluate("() => document.getElementById('ans').blur()"); pg.wait_for_timeout(100)
    vis2 = pg.evaluate("() => !document.querySelector('.rpg-strip').hidden")
    chk('E:strip_hidden_while_typing', vis0 and not vis1 and vis2, [vis0, vis1, vis2])
    pg.screenshot(path=os.path.join(OUT, 'q_input_strip.png'))
    ctx.close()
    # ---- F. 正解/不正解の演出：不正解は「つぎへ」を押すまで敵の行動を出さない（状態は先に計算・保存される）
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = newpage(ctx); pg.goto(URL); pg.wait_for_selector('.subj')
    pg.evaluate("() => start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10))"); pg.wait_for_selector('.choice')
    pg.evaluate(WRONG); pg.wait_for_timeout(200)
    d = pg.evaluate("() => ({deferred: RPG.deferred.length, hp: RPG.save.active.battle.hero.hp, max: RPG.save.active.battle.hero.maxHp})")
    chk('F:enemy_action_deferred_until_next', d['deferred'] == 1 and d['hp'] < d['max'], d)
    pg.wait_for_function("() => document.getElementById('next').textContent.includes('つぎへ')"); pg.screenshot(path=os.path.join(OUT, 'q_wrong_strip.png')); pg.click('#next'); pg.wait_for_timeout(400)
    chk('F:deferred_played_on_next_question', pg.evaluate("() => RPG.deferred.length") == 0)
    # 同じ回答を二重タップしても1回だけ
    n0 = pg.evaluate("() => RPG.save.active.basic.n")
    pg.evaluate("() => { const b = document.querySelectorAll('.choice')[0]; b.click(); b.click(); b.click(); }"); pg.wait_for_timeout(200)
    n1 = pg.evaluate("() => RPG.save.active.basic.n")
    chk('F:double_tap_single_event', n1 == n0 + 1, [n0, n1])
    ctx.close()
    # ---- G. reduce-motion でも動作し、帯の描画は静止
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, reduced_motion='reduce')
    pg = newpage(ctx); pg.goto(URL); pg.wait_for_selector('.subj')
    pg.evaluate("() => start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10))"); pg.wait_for_selector('.choice'); answer(pg, True)
    chk('G:reduce_motion_ok', pg.evaluate("() => RPG.ok") is True)
    ctx.close()
    b.close()
R['blocked_send_requests'] = R['blocked']
srv.shutdown()
json.dump(R, open(os.path.join(OUT, 'ui_test2.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = {k: v for k, v in R['checks'].items() if v is False or (isinstance(v, dict) and 'ok' in v and not v['ok'])}
print(json.dumps({'failed': bad, 'console': R['console'][:10], 'n': len(R['checks'])}, ensure_ascii=False, indent=1)[:3000])
