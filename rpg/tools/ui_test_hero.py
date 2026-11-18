# 修正指示書06 2章・3章の画面テスト（headless）。python rpg/tools/ui_test_hero.py [port]
# 主人公の共通描画（drawHeroLayered）・装備と試着・外見・衣装・ホーム・転職・店・ナビ・回答帯。
# 部品が届く前は、自作の試験用部品（rpg/tests/fixtures/parts/。?devcheck=1&partsdir=）で仕組みを確かめる（実物の絵ではない）。
# 画像は rpg/shots/fix06_screens/ に保存、結果は result.json。送信は遮断。HEADED=1 のときだけ画面を出す
import re, sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18433
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix06_screens'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
REAL = bool(os.environ.get('REAL'))   # REAL=1：試験用部品ではなく、台帳が正式にした実部品（rpg/assets/parts/）で通す
FIX = '&devcheck=1' if REAL else '&devcheck=1&partsdir=rpg/tests/fixtures/parts/'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
R = {'checks': {}, 'console': [], 'blocked': 0}
def chk(name, cond, extra=None): R['checks'][name] = bool(cond) if extra is None else {'ok': bool(cond), 'v': extra}
def blk(r): R['blocked'] += 1; r.abort()
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
WRONG = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = 'ぜったいにちがう'; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else { const k = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[k].click(); } }"
WARRIOR = "s.job='warrior'; s.firstDone=true; s.coins=3000; ['w_sword_1','w_sword_2'].forEach(i => { s.inv.items[i]=1; s.codex.items[i]=1; }); s.equip.weapon='w_sword_1'; s.active=null; s.look={face:1,hair:2,skin:1,hairColor:3,outfit:null}; s.name='ゆうた'; s.daily={maxKey:'',used:{}};"
INSTR = "() => { const SP = RPGSprites, o = SP.drawHeroLayered; window.__calls = []; SP.drawHeroLayered = function (c, a) { const r = o.apply(this, arguments); window.__calls.push({use: a.use, job: a.job, weaponId: a.weaponId || null, costume: a.costume || null, pose: a.pose, look: a.look ? [a.look.face, a.look.hairStyle, a.look.skin, a.look.hair] : null, r}); return r; }; }"
def new_page(b, w=390, h=844, reduce=False, open_range=False):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True, reduced_motion='reduce' if reduce else 'no-preference')
    if open_range: ctx.add_init_script('window.__rangeOpen = true')
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}'))
    pg.route('**/script.google.com/**', blk); return pg
def boot(pg, patch, query=''):
    pg.goto(BASE + query); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, patch])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 766 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(300)
    pg.evaluate(INSTR)
def save(pg): return pg.evaluate("() => JSON.parse(localStorage.getItem('ichimon.rpg.v1'))")
def go(pg, name, p=None): pg.evaluate("([n, p]) => RPG.go(n, p || {})", [name, p]); pg.wait_for_timeout(250)
def hero_cv(pg): return pg.evaluate("() => { const c = document.querySelector('canvas[data-hero]'); return c ? {opt: JSON.parse(c.dataset.hero), drawn: c.dataset.drawn, h: c.toDataURL().length, hash: c.toDataURL().slice(-400)} : null }")
def pix(pg, sel='canvas[data-hero]'): return pg.evaluate("(sel) => { const c = document.querySelector(sel); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i+1] * 3 + d[i+2] * 7) >>> 0; return h; }", sel)
def has_color(pg, sel, hexc): return pg.evaluate("([sel, hx]) => { const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, n = parseInt(hx.slice(1), 16); for (let i = 0; i < d.length; i += 4) if (d[i+3] === 255 && ((d[i] << 16) | (d[i+1] << 8) | d[i+2]) === n) return true; return false; }", [sel, hexc])
def shot(pg, name, full=True): pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=full)
def play_adventure(pg):
    pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice')
    answers = [True, True, False, True, True, False, True, True, True, False]; i = 0
    for _ in range(40):
        if pg.query_selector('#rwRoot'): break
        is_rv = pg.evaluate("() => !!S.cur._rv"); ok = True if is_rv else answers[i % 10]
        if not is_rv: i += 1
        pg.evaluate(CORRECT if ok else WRONG)
        if ok: pg.wait_for_timeout(650)
        else:
            pg.wait_for_function("() => document.getElementById('next') && document.getElementById('next').textContent.includes('つぎへ')", timeout=3000); pg.click('#next')
        pg.wait_for_timeout(60)
    pg.wait_for_selector('#rwRoot', timeout=8000); pg.wait_for_timeout(400)
NOTEXT = "() => { const c = document.querySelector('.rs-app').cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; }"

with sync_playwright() as p:
    b = p.chromium.launch(headless=not os.environ.get('HEADED'))
    # ================= 実物の絵（部品なし）：ホーム・敵・台帳 =================
    pg = new_page(b); boot(pg, WARRIOR, '&devcheck=1')
    pg.wait_for_timeout(500)
    m = pg.evaluate("() => { const g = document.getElementById('go').getBoundingClientRect(), c = document.querySelector('canvas[data-hero]').getBoundingClientRect(); return {goBottom: g.bottom, heroTop: c.top, heroBottom: c.bottom, vh: innerHeight, sub: document.querySelectorAll('.subj').length && getComputedStyle(document.querySelector('.subj')).display, rangeOpen: document.querySelector('.rs-range').open}; }")
    chk('B01_home_hero_and_start_in_first_screen_390', m['heroTop'] >= 0 and m['heroBottom'] < m['vh'] and m['goBottom'] < m['vh'] and not m['rangeOpen'], m)
    chk('B01_home_hero_official_art', hero_cv(pg)['drawn'] in ('whole', 'layered'), hero_cv(pg)['drawn'])
    shot(pg, 'real_home_390', False)
    chk('home_function_kept(range:subject/unit/hard/go)', pg.evaluate("() => !!document.getElementById('hard') && !!document.getElementById('go') && document.querySelectorAll('.rs-range .subj').length >= 3"))
    pg.evaluate("() => document.querySelector('.rs-range').open = true"); pg.click('.subj >> nth=1'); pg.wait_for_timeout(200)
    chk('home_range_stays_open_after_pick', pg.evaluate("() => document.querySelector('.rs-range').open"))
    chk('backup_not_on_home', pg.evaluate("() => !document.querySelector('.rpg-bk')"))
    go(pg, 'settings'); chk('backup_in_settings', pg.evaluate("() => !!document.getElementById('rpgExport')"))
    # A09：第1章ボス6体と、ぼうけん・図鑑の敵
    ch1 = pg.evaluate("() => RPGData.REGIONS.filter(r => r.ch === 1).map(r => r.boss.id)")
    have = pg.evaluate("(ids) => ids.map(i => [i, !!RPGSprites.IMGS['enemy_' + i]])", ch1)
    chk('A09_ch1_boss_images', all(h for _, h in have), have)
    pg.evaluate("() => { const s = RPG.save; Object.keys(RPGData.ENEMIES).forEach(i => { s.codex.enemies[i] = {seen: 1, kills: 1}; }); }")
    go(pg, 'codex'); pg.wait_for_timeout(800)
    dv = pg.evaluate("() => RPG.devReport()")
    chk('A09_codex_enemies_no_missing_image', len(dv['enemyMissing']) == 0, dv['enemyMissing'])
    drawn = pg.evaluate("() => [...document.querySelectorAll('canvas[data-en]')].length")
    chk('A09_codex_uses_enemy_canvases', drawn >= 90, drawn)
    shot(pg, 'real_codex_390')
    go(pg, 'adv'); pg.wait_for_timeout(500); chk('adv_enemy_canvas_official', pg.evaluate("() => !!document.querySelector('#rsEnemy[data-en]')")); shot(pg, 'real_adv_390', False)
    # 12職の一覧（A02）：職業ごとの姿（部品なし＝1枚絵）。開発用検査に「1枚絵」として出る
    for tier in ('base', 'adv', 'top'):
        go(pg, 'jobs'); pg.evaluate("(t) => { document.querySelector(`[data-tier=${t}]`).click(); }", tier); pg.wait_for_timeout(700); shot(pg, f'real_jobs_{tier}_390', False)
    dv = pg.evaluate("() => RPG.devReport()")
    chk('A02_12jobs_no_missing_art', len([e for e in dv['missing']]) == 0, dv['missing'])
    R['dev_real'] = {'parts': dv['parts'], 'whole': len(dv['whole']), 'layered': len(dv['layered'])}
    chk('devcheck_parts_ready_and_fallbacks_listed(not silent)', dv['parts'] == 'ready' and all(e['reason'] for e in dv['whole']), dv['whole'][:3])
    pg.context.close()

    # ================= 試験用の部品で、重ねの仕組みを確かめる =================
    pg = new_page(b); boot(pg, WARRIOR, FIX)
    dv = pg.evaluate("() => RPG.devReport()"); chk('parts_loaded', dv['parts'] == 'ready', dv['parts'])
    # --- A01：ホーム/自分/装備/転職/外見/報酬/帯 が同じ人物（顔髪肌・衣装・武器・職業）---
    for scr, prm in (('me', None), ('equip', None), ('jobdetail', {'job': 'warrior'}), ('look', None)):
        go(pg, scr, prm); pg.wait_for_timeout(250)
    pg.evaluate("() => home()"); pg.wait_for_timeout(300)
    play_adventure(pg); pg.wait_for_timeout(300)
    cl = pg.evaluate("() => window.__calls")
    tup = {}
    for c in cl: tup.setdefault(c['use'], set()).add(json.dumps([c['job'], c['weaponId'], c['costume'], c['look']] if c['use'] != 'strip' else [c['job'], c['weaponId'], c['costume'], c['look']]))
    uses = sorted(tup)
    chk('A01_all_uses_same_person', all(len(v) == 1 for v in tup.values()) and len(set(x for v in tup.values() for x in v)) == 1, {k: list(v) for k, v in tup.items()})
    chk('A01_uses_seen(home,self,equip,job,look,reward,strip)', all(u in uses for u in ('home', 'self', 'equip', 'job', 'look', 'reward', 'strip')), uses)
    chk('A01_reward_layered_with_weapon', any(c['use'] == 'reward' and c['r'] == 'layered' and c['weaponId'] == 'w_sword_1' for c in cl))
    shot(pg, 'fix_reward_390')
    pg.click('#end'); pg.wait_for_selector('#go', state='attached'); pg.wait_for_timeout(300)
    shot(pg, 'fix_home_390', False)
    # --- A03/A04：試着・取り消し・確定 ---
    go(pg, 'equip'); pg.wait_for_timeout(400)
    h0 = pix(pg); o0 = hero_cv(pg)['opt']; st0 = pg.evaluate("() => document.querySelectorAll('.rs-cmp td')[4].textContent")
    shot(pg, 'fix_equip_before_390', False)
    pg.click('[data-eq=w_sword_2]'); pg.wait_for_timeout(400)
    h1 = pix(pg); o1 = hero_cv(pg)['opt']; st1 = pg.evaluate("() => [...document.querySelectorAll('.rs-cmp td')].map(t => t.textContent)")
    shot(pg, 'fix_equip_try_390', False)
    chk('A03_try_changes_weapon_pixels', h0 != h1 and o1['weaponId'] == 'w_sword_2' and o0['weaponId'] == 'w_sword_1', [o0['weaponId'], o1['weaponId']])
    chk('A03_try_changes_numbers', st1[5] != st1[4] or st1[6] != '±0', st1)
    chk('A03_try_label_and_save_untouched', pg.evaluate("() => !!document.querySelector('.rs-eqitem.on .rs-try')") and save(pg)['equip']['weapon'] == 'w_sword_1')
    # 顔・身体は変わらない：頭の部分（上40ドット＝上80px）の画素が同じ
    same = pg.evaluate("""() => { const SP = RPGSprites, mk = w => { const c = document.createElement('canvas'); c.width = 120; c.height = 120; const g = c.getContext('2d', {willReadFrequently: true}); SP.drawHeroLayered(g, {job: 'warrior', weaponId: w, use: 'equip', pose: 'idle', look: RPGMeta.lookOf(RPG.save), x: 40, groundY: 112, scale: 1}); return g.getImageData(0, 0, 120, 120).data; };
      const a = mk('w_sword_1'), b = mk('w_sword_2'); let head = 0, all = 0; for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) { const i = (y * 120 + x) * 4; if (a[i] !== b[i] || a[i+1] !== b[i+1] || a[i+2] !== b[i+2] || a[i+3] !== b[i+3]) { all++; if (x < 40 && y < 100) head++; } } return {all, bodyHeadDiff: head}; }""")
    chk('A03_only_weapon_pixels_differ(body/head same)', same['all'] > 0 and same['bodyHeadDiff'] == 0, same)
    pg.click('#eqReset'); pg.wait_for_timeout(400)
    chk('A04_cancel_restores_picture', pix(pg) == h0 and hero_cv(pg)['opt']['weaponId'] == 'w_sword_1' and save(pg)['equip']['weapon'] == 'w_sword_1')
    pg.click('[data-eq=w_sword_2]')
    go(pg, 'me'); pg.wait_for_timeout(300); chk('A04_try_not_leaked_to_other_screen', hero_cv(pg)['opt']['weaponId'] == 'w_sword_1' and save(pg)['equip']['weapon'] == 'w_sword_1')
    go(pg, 'equip'); pg.click('[data-eq=w_sword_2]'); pg.click('#eqOk'); pg.wait_for_timeout(400)
    chk('A04_confirm_saves', save(pg)['equip']['weapon'] == 'w_sword_2' and hero_cv(pg)['opt']['weaponId'] == 'w_sword_2')
    pg.reload(); pg.wait_for_selector('#go', state='attached'); pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 766", timeout=90000); pg.wait_for_timeout(500); pg.evaluate(INSTR)
    chk('A04_after_reload_home_same_weapon', hero_cv(pg)['opt']['weaponId'] == 'w_sword_2' and hero_cv(pg)['drawn'] == 'layered', hero_cv(pg)['opt']['weaponId'])
    play_adventure(pg); cl = pg.evaluate("() => window.__calls")
    chk('A04_strip_and_reward_same_weapon', {c['weaponId'] for c in cl if c['use'] in ('strip', 'reward')} == {'w_sword_2'}, sorted({str(c['weaponId']) for c in cl if c['use'] in ('strip', 'reward')}))
    pg.click('#end'); pg.wait_for_selector('#go', state='attached')
    # --- A05：杖の僧侶・短剣の盗賊・弓のレンジャー ---
    W5 = """() => ['priest:w_staff_1', 'thief:w_dagger_1', 'ranger:w_bow_1', 'mage:w_staff_1', 'sage:w_staff_1', 'ninja:w_dagger_1'].map(x => { const [j, w] = x.split(':'); const p = RPGSprites.planHero({job: j, weaponId: RPGMeta.artWeapon(j, w), use: 'equip', pose: 'idle', look: {face: 0, hairStyle: 0, skin: '#f0c39a', hair: '#7a4a2a'}}); return [j, p.mode, p.wk]; })"""
    pg.evaluate(W5); pg.wait_for_timeout(800); r5 = pg.evaluate(W5)
    chk('A05_weapon_icon_matches_job(staff/dagger/bow, one weapon only)', all(m == 'layered' and wk == w + '.png' for (j, m, wk), w in zip(r5, ['w_staff_1', 'w_dagger_1', 'w_bow_1', 'w_staff_1', 'w_staff_1', 'w_dagger_1'])), r5)
    # --- A06/A07：外見の変更が主要画面へ反映。全選択値の読込検査 ---
    go(pg, 'look'); pg.wait_for_timeout(400); look0 = pix(pg); shot(pg, 'fix_look_before_390', False)
    pg.click('[data-lk=face][data-v="2"]'); pg.click('[data-lk=hair][data-v="4"]'); pg.click('[data-lk=skin][data-v="3"]'); pg.click('[data-lk=hairColor][data-v="2"]'); pg.wait_for_timeout(300)
    chk('A06_preview_changes', pix(pg) != look0 and has_color(pg, 'canvas[data-hero]', '#b97d56') and has_color(pg, 'canvas[data-hero]', '#d9b04a'))
    shot(pg, 'fix_look_after_390', False)
    chk('A06_note_text', pg.evaluate(NOTEXT).count('見た目を変えても、強さや覚えた技は変わりません。') == 1)
    pg.click('#lookOk'); pg.wait_for_timeout(300)
    sv = save(pg)['look']; chk('A06_look_saved', sv['face'] == 2 and sv['hair'] == 4 and sv['skin'] == 3 and sv['hairColor'] == 2, sv)
    pg.evaluate("() => window.__calls.length = 0")
    for scr, prm in (('me', None), ('equip', None), ('jobdetail', {'job': 'warrior'})): go(pg, scr, prm)
    pg.evaluate("() => home()"); pg.wait_for_timeout(300)
    cl = pg.evaluate("() => window.__calls"); lk = {json.dumps(c['look']) for c in cl}
    chk('A06_all_screens_new_look', lk == {json.dumps([2, 4, '#b97d56', '#d9b04a'])} and {c['use'] for c in cl} >= {'self', 'equip', 'job', 'home'}, [sorted(lk), sorted({c['use'] for c in cl})])
    chk('A06_home_pixels_have_new_colors', has_color(pg, 'canvas[data-hero]', '#b97d56') and has_color(pg, 'canvas[data-hero]', '#d9b04a'))
    pg.evaluate("() => { const c = document.createElement('canvas'); RPGSprites.drawHeroLayered(c.getContext('2d'), {job: 'warrior', weaponId: 'w_sword_1', use: 'strip', pose: 'idle', look: {face: 0, hairStyle: 0, skin: '#f0c39a', hair: '#7a4a2a'}, x: 10, groundY: 20, scale: 1}); [0, 1, 2, 3, 4, 5].forEach(h => RPGSprites.drawHeroLayered(c.getContext('2d'), {job: 'warrior', weaponId: 'w_sword_1', use: 'strip', pose: 'idle', look: {face: 0, hairStyle: h, skin: '#f0c39a', hair: '#7a4a2a'}, x: 10, groundY: 20, scale: 1})); [0,1,2,3].forEach(f => [0,1,2,3,4,5].forEach(h => RPGSprites.drawHeroLayered(c.getContext('2d'), {job: 'warrior', weaponId: 'w_sword_1', use: 'equip', pose: 'idle', look: {face: f, hairStyle: h, skin: '#f0c39a', hair: '#7a4a2a'}, x: 10, groundY: 20, scale: 1}))); }"); pg.wait_for_timeout(1200)
    all_ok = pg.evaluate("""() => { const SP = RPGSprites, M = RPGMeta; let n = 0, bad = []; const c = document.createElement('canvas'); c.width = 120; c.height = 120; const g = c.getContext('2d', {willReadFrequently: true});
      for (let f = 0; f < M.FACE_N; f++) for (let h = 0; h < M.HAIR_N; h++) for (let s = 0; s < M.SKIN.length; s++) for (let k = 0; k < M.HAIR_COLOR.length; k++) for (const use of ['equip', 'strip']) {
        g.clearRect(0, 0, 120, 120); const r = SP.drawHeroLayered(g, {job: 'warrior', weaponId: 'w_sword_1', use, pose: 'idle', look: {face: f, hairStyle: h, skin: M.SKIN[s], hair: M.HAIR_COLOR[k]}, x: 40, groundY: 112, scale: 1});
        const d = g.getImageData(0, 0, 120, 120).data; let cnt = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) cnt++; n++; if (r !== 'layered' || cnt < 50) bad.push([f, h, s, k, use, r, cnt]); }
      return {n, bad: bad.slice(0, 5), nbad: bad.length}; }""")
    chk('A07_all_look_values_load_and_draw(720x2)', all_ok['n'] == 1440 and all_ok['nbad'] == 0, all_ok)
    # --- A08：マスター衣装 ---
    pg.context.close()
    pg = new_page(b); boot(pg, WARRIOR + "s.jobXp.warrior = 1e7;", FIX)
    go(pg, 'look'); pg.wait_for_timeout(300)
    chk('A08_master_chip_enabled_when_lv30', pg.evaluate("() => !document.querySelector('[data-outfit=master]').disabled")); base = pix(pg)
    pg.click('[data-outfit=master]'); pg.wait_for_timeout(500)
    chk('A08_master_changes_picture', pix(pg) != base and hero_cv(pg)['opt']['costume'] == 'master' and hero_cv(pg)['drawn'] in (('layered', 'whole') if REAL else ('whole',)), hero_cv(pg)['opt']['costume'])
    pg.click('#lookOk'); pg.wait_for_timeout(300)
    pg.evaluate("() => window.__calls.length = 0"); pg.evaluate("() => home()"); pg.wait_for_timeout(300); go(pg, 'me'); go(pg, 'equip')
    chk('A08_master_all_screens', {c['costume'] for c in pg.evaluate("() => window.__calls")} == {'master'} and save(pg)['look']['outfit'] == 'master')
    shot(pg, 'fix_master_equip_390', False)
    pg.context.close()
    pg = new_page(b); boot(pg, WARRIOR, FIX)
    go(pg, 'look'); chk('A08_master_chip_disabled_when_locked', pg.evaluate("() => document.querySelector('[data-outfit=master]').disabled"))
    chk('A08_cannot_set_when_locked', pg.evaluate("() => RPGMeta.setOutfit(RPG.save, 'master') === false"))
    # 未解放職のプレビュー：本人の顔髪で表示し、保存は変えない
    before = pg.evaluate("() => localStorage.getItem('ichimon.rpg.v1')")
    pg.evaluate("() => window.__calls.length = 0"); go(pg, 'jobs'); pg.evaluate("() => document.querySelector('[data-tier=adv]').click()"); pg.wait_for_timeout(500); go(pg, 'jobdetail', {'job': 'sage'}); pg.wait_for_timeout(400)
    cl = pg.evaluate("() => window.__calls"); chk('A08_locked_job_preview_uses_own_look', {json.dumps(c['look']) for c in cl} == {json.dumps([1, 2, '#f6d7b8', '#c9572e'])} and {c['job'] for c in cl} >= {'sage'}, [sorted({json.dumps(c['look']) for c in cl}), sorted({c['job'] for c in cl})])
    pg.click('#jobPlay'); pg.wait_for_timeout(1500)
    chk('A08_preview_does_not_change_save', pg.evaluate("() => localStorage.getItem('ichimon.rpg.v1')") == before)
    # --- B02：転職の順序 ---
    go(pg, 'jobdetail', {'job': 'magicknight'}); pg.wait_for_timeout(400)
    pos = pg.evaluate("() => { const t = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top) : null; }; return {hero: t('canvas[data-hero]'), name: t('.rs-jobname'), blurb: t('.rs-blurb'), req: t('.rs-req'), btn: t('#jobDo'), play: t('#jobPlay'), skills: t('.rs-det summary'), btnBottom: Math.round(document.getElementById('jobDo').getBoundingClientRect().bottom), vh: innerHeight}; }")
    chk('B02_order_hero_name_blurb_req_button_then_details', pos['hero'] < pos['name'] < pos['blurb'] < pos['req'] < pos['btn'] < pos['skills'], pos)
    chk('B02_main_button_in_first_screen_390', pos['btnBottom'] < pos['vh'] - 80, pos)
    chk('B02_details_collapsed', pg.evaluate("() => [...document.querySelectorAll('.rs-det')].every(d => !d.open)"))
    shot(pg, 'fix_jobdetail_390', False)
    # 初回転職：旧姿→光→新姿、とばせる。宝箱・NPCに触れない
    pg.evaluate("() => { const s = RPG.save; s.jobXp.warrior = 1e5; s.jobXp.mage = 1e5; s.jobXp.priest = 1e5; s.inv.items.w_staff_2 = 1; }"); go(pg, 'jobdetail', {'job': 'magicknight'}); pg.click('#jobDo'); pg.wait_for_selector('.rs-fx'); pg.wait_for_timeout(300)
    chk('B02_fx_has_skip_and_no_chest_npc', pg.evaluate("() => { const f = document.querySelector('.rs-fx'); return !!f.querySelector('#fxSkip') && !f.querySelector('img') && !/chest|npc/.test(f.innerHTML); }"))
    shot(pg, 'fix_job_fx_old_390', False); pg.wait_for_timeout(1700); shot(pg, 'fix_job_fx_new_390', False)
    chk('B02_fx_same_look_old_new', len({json.dumps(c['look']) for c in pg.evaluate("() => window.__calls.filter(c => c.use === 'fx')")}) == 1)
    pg.click('#fxSkip'); pg.wait_for_timeout(400)
    sv = save(pg); chk('B02_job_changed_and_weapon_explained', sv['job'] == 'magicknight' and sv['equip']['weapon'] in ('w_sword_1', 'w_sword_2', 'w_staff_1', 'w_staff_2'), sv['equip'])
    # 武器が合わない転職：説明が出る
    pg.evaluate("() => { const s = RPG.save; s.equip.weapon = 'w_sword_2'; s.jobXp.mage = 1e6; s.jobXp.priest = 1e6; s.seen.job_sage = 1; s.active = null; }"); go(pg, 'jobdetail', {'job': 'sage'}); pg.click('#jobDo'); pg.wait_for_timeout(500)
    msg = pg.evaluate("() => (document.querySelector('.rs-msg') || {}).textContent || ''")
    chk('B02_weapon_swap_is_told', '武器を変えました' in re.sub('[ぁ-ん]+(?=[^ぁ-ん]|$)', '', msg) or '武器' in msg and '変' in msg and save(pg)['equip']['weapon'].startswith('w_staff'), msg)
    # --- B03：店・装備・図鑑で同じアイテムに同じ名前・アイコン・効果 ---
    pg.evaluate("() => { const s = RPG.save; s.job = 'warrior'; s.equip.weapon = 'w_sword_1'; s.inv.items.rw_sword_1 = 1; s.codex.items.rw_sword_1 = 1; s.inv.items.w_sword_2 = 1; s.codex.items.w_sword_2 = 1; s.progress.step = Math.max(s.progress.step, 20); }")
    def rows(scr, sel, ids):
        go(pg, scr); pg.wait_for_timeout(400)
        return pg.evaluate("([tpl, ids]) => ids.map(id => { const r = document.querySelector(tpl.replace('ID', id)); if (!r) return [id, null, null, null]; const b = r.querySelector('b'), im = r.querySelector('img.rs-ic'); return [id, b && b.textContent, im && im.getAttribute('src'), (r.querySelector('small') || {}).textContent]; })", [sel, ids])
    ids = ['w_sword_1', 'w_sword_2', 'rw_sword_1']
    eqr = rows('equip', '[data-eq=ID]', ids); go(pg, 'shop'); pg.wait_for_timeout(400)
    shp = pg.evaluate("() => ['w_sword_1'].map(id => { const r = document.querySelector(`[data-try=${id}]`).closest('.rs-shopitem'); return [id, r.querySelector('b').textContent, r.querySelector('img.rs-ic').getAttribute('src'), r.querySelector('small').textContent]; })")
    go(pg, 'codex'); pg.click('[data-ct=item]'); pg.wait_for_timeout(400)
    cdx = pg.evaluate("() => { const out = {}; document.querySelectorAll('.rs-eqitem').forEach(r => { const b = r.querySelector('b'); const im = r.querySelector('img.rs-ic'); if (im) out[b.textContent] = [im.getAttribute('src'), (r.querySelector('small') || {}).textContent]; }); return out; }")
    okB3 = True; ev = []
    for id, nm, src, sm in shp:
        e = [x for x in eqr if x[0] == id][0]; c = cdx.get(nm)
        good = e[1] and e[1].startswith(nm) and src == e[2] and c is not None and c[0] == src and sm.split('　')[0] == c[1].split('　')[0]; okB3 &= bool(good); ev.append([id, nm, good])
    e = [x for x in eqr if x[0] == 'rw_sword_1'][0]; c = cdx.get(e[1].replace(' +1', '').split('旧')[0]) if e[1] else None
    cmatch = [v for k, v in cdx.items() if e[1] and e[1].startswith(k)]
    okB3 &= bool(cmatch and cmatch[0][0] == e[2] and cmatch[0][1].split('　')[0] == (e[3] or '').split('　')[0]); ev.append(['rw_sword_1(equip=codex)', e[1], bool(cmatch)])
    chk('B03_same_name_icon_stat_in_shop_equip_codex', okB3, ev)
    # --- 店：全商品アイコン、いまの職業の武器を先に、購入/試着は別操作 ---
    go(pg, 'shop'); pg.wait_for_timeout(300)
    sh = pg.evaluate("() => ({items: document.querySelectorAll('.rs-shopitem').length, icons: document.querySelectorAll('.rs-shopitem img.rs-ic').length, buy: document.querySelectorAll('[data-buy]').length, tryb: document.querySelectorAll('[data-try]').length, ng: [...document.querySelectorAll('.rs-shopitem small')].filter(s => s.textContent.includes('別の職業用')).length})")
    chk('shop_all_items_have_icon_and_current_job_first', sh['items'] > 0 and sh['icons'] == sh['items'] and sh['ng'] == 0 and sh['tryb'] == sh['items'], sh)
    for tab in ('armor', 'acc', 'sell'):
        pg.click(f'[data-st={tab}]'); pg.wait_for_timeout(200)
        t = pg.evaluate("() => ({items: document.querySelectorAll('.rs-shopitem').length, icons: document.querySelectorAll('.rs-shopitem img.rs-ic').length})"); chk(f'shop_{tab}_all_icons', t['items'] == t['icons'], t)
    pg.click('[data-st=weapon]'); pg.click('[data-shopall="1"]'); pg.wait_for_timeout(200)
    chk('shop_other_job_weapons_via_toggle', pg.evaluate("() => [...document.querySelectorAll('.rs-shopitem small')].some(s => { const c = s.cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent.includes('別の職業用'); })"))
    pg.evaluate("() => { const s = RPG.save; s.inv.items = Object.fromEntries(Object.entries(s.inv.items).filter(([k]) => k !== 'w_sword_3')); }")
    pg.click('[data-try=w_sword_3]') if pg.query_selector('[data-try=w_sword_3]') else None
    pg.wait_for_timeout(400)
    if pg.query_selector('.rs-eqweapon'):
        chk('shop_try_unowned_shows_label_and_cannot_equip', pg.evaluate("() => document.getElementById('eqOk').disabled") and save(pg)['equip']['weapon'] == 'w_sword_1')
    pg.context.close()

    # ================= 画面ごとの末尾まで届くか（B06）・文字拡大（B07）=================
    SCREENS = [('home', None), ('adv', None), ('town', None), ('me', None), ('equip', None), ('shop', None), ('jobs', None), ('jobdetail', {'job': 'magicknight'}), ('look', None), ('settings', None), ('codex', None), ('ach', None), ('loadout', None), ('regionmap', {'id': 'meadow'})]
    LAYOUT = """() => { const nav = document.querySelector('.rs-nav'), nt = nav ? nav.getBoundingClientRect().top : innerHeight; window.scrollTo(0, document.documentElement.scrollHeight); const els = [...document.querySelectorAll('#app button, #app summary, #app input, #app a')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('.rs-nav') && getComputedStyle(e).visibility !== 'hidden' && (e.tagName === 'SUMMARY' || !e.closest('details:not([open])')); }); const last = els.length ? Math.max(...els.map(e => e.getBoundingClientRect().bottom)) : 0; return {hscroll: document.documentElement.scrollWidth > innerWidth, lastBottom: Math.round(last), navTop: Math.round(nt), navH: nav ? Math.round(nav.getBoundingClientRect().height) : 0, spacer: (document.querySelector('.rs-navspace') || {offsetHeight: 0}).offsetHeight}; }"""
    for w in (320, 375, 390, 430):
        pg = new_page(b, w); boot(pg, WARRIOR); bad = []
        for scr, prm in SCREENS:
            if scr == 'home': pg.evaluate("() => home()")
            else: go(pg, scr, prm)
            pg.wait_for_timeout(250); l = pg.evaluate(LAYOUT)
            if l['hscroll'] or l['lastBottom'] > l['navTop'] + 1 or l['spacer'] < l['navH']: bad.append([scr, l])
        chk(f'B06_{w}px_no_hscroll_end_reachable_nav_spacer', not bad, bad)
        pg.context.close()
    pg = new_page(b, 390); boot(pg, WARRIOR); bad = []
    pg.evaluate("() => { document.body.style.zoom = 1.3; }")
    for scr, prm in (('home', None), ('me', None), ('equip', None), ('shop', None), ('jobs', None), ('jobdetail', {'job': 'magicknight'}), ('look', None)):
        if scr == 'home': pg.evaluate("() => home()")
        else: go(pg, scr, prm)
        pg.evaluate("() => document.querySelectorAll('details').forEach(d => d.open = true)"); pg.wait_for_timeout(200)
        l = pg.evaluate("() => ({h: document.documentElement.scrollWidth > innerWidth + 2, clip: [...document.querySelectorAll('#app button, #app .rs-it-t, #app .rs-nextskill')].filter(e => e.scrollWidth > e.clientWidth + 2).length})")
        main = {'jobdetail': '#jobDo', 'equip': '#eqOk', 'look': '#lookOk'}.get(scr); reach = True
        if main: reach = pg.evaluate("(m) => { const e = document.querySelector(m); e.scrollIntoView({block: 'center'}); const r = e.getBoundingClientRect(), n = document.querySelector('.rs-nav').getBoundingClientRect(); return r.bottom <= n.top + 1 && r.top >= 0; }", main)
        if l['h'] or l['clip'] or not reach: bad.append([scr, l, reach])
    chk('B07_zoom130_no_clip_main_button_reachable_with_details_open', not bad, bad)
    pg.context.close()

    # ================= 撮影：実物の絵（real）と試験用部品（fix）を 390/320 で =================
    for mode, q in (('real', ''), ('fix', FIX)):
        for w in (390, 320):
            pg = new_page(b, w); boot(pg, WARRIOR, q); T = mode + '_{}_' + str(w)
            pg.evaluate("() => home()"); pg.wait_for_timeout(300); shot(pg, T.format('home'), False)
            go(pg, 'me'); pg.wait_for_timeout(300); shot(pg, T.format('me'))
            go(pg, 'equip'); pg.wait_for_timeout(300); shot(pg, T.format('equip_before'), False)
            pg.click('[data-eq=w_sword_2]'); pg.wait_for_timeout(300); shot(pg, T.format('equip_try'), False)
            pg.click('#eqOk'); pg.wait_for_timeout(300); shot(pg, T.format('equip_confirmed'), False)
            go(pg, 'shop'); pg.wait_for_timeout(300); shot(pg, T.format('shop'))
            go(pg, 'jobs'); pg.wait_for_timeout(500); shot(pg, T.format('jobs'))
            go(pg, 'jobdetail', {'job': 'magicknight'}); pg.wait_for_timeout(500); shot(pg, T.format('jobdetail'))
            go(pg, 'look'); pg.wait_for_timeout(500); shot(pg, T.format('look'))
            pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice'); pg.wait_for_timeout(500)
            pg.locator('.rpg-strip').screenshot(path=os.path.join(OUT, T.format('strip') + '.png')); pg.screenshot(path=os.path.join(OUT, T.format('quiz') + '.png'))
            pg.evaluate("() => home()"); pg.wait_for_timeout(200)
            play_adventure(pg); shot(pg, T.format('reward_closed'))
            pg.click('#rwOpen'); pg.wait_for_timeout(1200); shot(pg, T.format('reward_opened'))
            pg.context.close()

    # ================= 回答帯：全地域（C03）、待機中は進まない（C04）、不正解の答え確認中は敵が動かない（C05）、控えめ（C06）=================
    from PIL import Image
    pg = new_page(b, 390); boot(pg, WARRIOR)
    n_reg = pg.evaluate("() => RPGData.REGIONS.length"); sheets = []
    for i in range(n_reg):
        pg.evaluate("(i) => { RPG.save.active = null; RPG.save.progress.step = RPGData.REGION_START[i]; RPG.save.progress.quest = null; RPG.persist(); }", i)
        pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice'); pg.wait_for_timeout(450)
        f = os.path.join(OUT, f'_strip_{i}.png'); pg.locator('.rpg-strip').screenshot(path=f); sheets.append(f)
        pg.evaluate("() => { RPG.save.active = null; home(); }"); pg.wait_for_timeout(100)
    ims = [Image.open(f) for f in sheets]; W0 = ims[0].width; sheet = Image.new('RGB', (W0 * 2 + 10, (ims[0].height + 6) * ((len(ims) + 1) // 2)), (240, 240, 250))
    for k, im in enumerate(ims): sheet.paste(im, ((k % 2) * (W0 + 10), (k // 2) * (im.height + 6)))
    sheet.save(os.path.join(OUT, 'strips_all_regions_390.png'))
    for f in sheets: os.remove(f)
    chk('C03_strips_all_regions_captured', len(ims) == 18, len(ims))
    pg.evaluate("() => { RPG.save.active = null; RPG.save.progress.step = 0; RPG.persist(); filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice'); pg.evaluate(INSTR)
    st0 = pg.evaluate("() => JSON.stringify(RPG.save.active.battle)"); pg.wait_for_timeout(3500)
    cl = pg.evaluate("() => window.__calls")
    chk('C04_waiting_no_battle_progress', pg.evaluate("() => JSON.stringify(RPG.save.active.battle)") == st0 and {c['pose'] for c in cl} <= {'idle'} and all(c['use'] == 'strip' for c in cl), sorted({c['pose'] for c in cl}))
    pg.evaluate(WRONG); pg.wait_for_function("() => document.getElementById('next') && document.getElementById('next').textContent.includes('つぎへ')", timeout=3000); pg.wait_for_timeout(1200)
    cl = pg.evaluate("() => window.__calls"); chk('C05_wrong_answer_check_no_enemy_motion', 'hit' not in {c['pose'] for c in cl}, sorted({c['pose'] for c in cl}))
    pg.click('#next'); pg.wait_for_timeout(1500)
    dom = pg.evaluate("() => { const s = document.querySelector('.rpg-strip'); return {kids: [...s.children].map(e => e.tagName), aria: s.getAttribute('aria-hidden'), h: Math.round(s.querySelector('canvas').getBoundingClientRect().height), sound: RPG.save.settings.sound, text: s.innerText.trim()}; }")
    chk('C06_strip_only_canvas_no_buttons_no_numbers_sound_off', dom['kids'] == ['CANVAS'] and dom['aria'] == 'true' and dom['h'] == 44 and dom['sound'] is False and dom['text'] == '', dom)
    pg.context.close()
    pg = new_page(b, 390, reduce=True); boot(pg, WARRIOR); pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice'); pg.evaluate(INSTR); pg.evaluate(CORRECT); pg.wait_for_timeout(1500)
    poses = sorted({c['pose'] for c in pg.evaluate("() => window.__calls")}); chk('C06_reduce_motion_static_strip', set(poses) <= {'idle'}, poses)
    pg.context.close()
    b.close()

json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = {k: v for k, v in R['checks'].items() if v is False or (isinstance(v, dict) and not v['ok'])}
for k, v in bad.items():
    if isinstance(v, dict) and 'v' in v: v['v'] = str(v['v'])[:300]
print(json.dumps({'failed': bad, 'console': R['console'][:10], 'n': len(R['checks']), 'blocked': R['blocked']}, ensure_ascii=False, indent=1))
