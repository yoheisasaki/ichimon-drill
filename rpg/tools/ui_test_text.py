# 修正指示書06 4章・6章の画面テスト（headless）。python rpg/tools/ui_test_text.py [port]
# B03 同じ itemId の 名前・アイコン・効果が 店・装備・図鑑でそろう（レア60品を含む）／ B04 子ども向け画面の漢字にルビ（読みが無い漢字を数える）／
# B05 分かち書き・仮名・仮の絵・開発用の注記が子ども画面に残らない／ 図鑑の分母／ ルビの切り替え／ 会話は出来事の区間だけ。
# 画像は rpg/shots/fix06_text/ に保存、結果は result.json。送信は遮断（nosend=1）。HEADED=1 のときだけ画面を出す
import sys, json, os, re, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 18461
OUT = os.path.join(ROOT, 'rpg', 'shots', 'fix06_text'); os.makedirs(OUT, exist_ok=True)
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', PORT), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/index.html?nosend=1'
SAVE0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
R = {'checks': {}, 'console': [], 'blocked': 0, 'bare_kanji': {}, 'bad_text': []}
def chk(name, cond, extra=None): R['checks'][name] = bool(cond) if extra is None else {'ok': bool(cond), 'v': extra}
def blk(r): R['blocked'] += 1; r.abort()
CORRECT = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = q.accept[0]; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
WRONG = "() => { const q = S.cur; if (q.type === 'input') { const i = document.getElementById('ans'); i.value = 'ぜったいにちがう'; i.dispatchEvent(new Event('input')); document.getElementById('submit').click(); } else { const k = S.opts.findIndex(o => o !== q.a); document.querySelectorAll('.choice')[k].click(); } }"
PATCH = "s.job='warrior'; s.firstDone=true; s.coins=3000; ['w_sword_1','w_sword_2'].forEach(i => { s.inv.items[i]=1; s.codex.items[i]=1; }); s.equip.weapon='w_sword_1'; s.active=null; s.look={face:1,hair:2,skin:1,hairColor:3,outfit:null}; s.name='ゆうた'; s.daily={maxKey:'',used:{}}; s.progress.step=40; s.seen={};"
def new_page(b, w=390, h=844):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.set_default_timeout(30000)
    pg.on('console', lambda m: R['console'].append(f'{m.type}:{m.text}') if m.type in ('error', 'warning') and 'willReadFrequently' not in m.text else None)
    pg.on('pageerror', lambda e: R['console'].append(f'pageerror:{e}'))
    pg.route('**/script.google.com/**', blk); return pg
def boot(pg, patch=PATCH, query=''):
    pg.goto(BASE + query); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, patch])
    pg.reload(); pg.wait_for_selector('#go', state='attached')
    pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(500)
def go(pg, name, p=None): pg.evaluate("([n, p]) => RPG.go(n, p || {})", [name, p]); pg.wait_for_timeout(250)
def shot(pg, name, full=True): pg.screenshot(path=os.path.join(OUT, name + '.png'), full_page=full)
# 画面の見える文字のうち、ルビの外にある漢字（＝読みが付いていない漢字）と、分かち書き・禁止語
SCAN = """() => {
  const roots = [...document.querySelectorAll('#app, .rs-fx')]; const out = {bare: [], bad: [], text: []};
  const KANJI = /[\\u3400-\\u9fff々〆]/, BAD = /仮名|仮の絵|provisional|planned|未実装|じっそうまえ|TODO|devcheck/i, WAKA = /[ぁ-ん]{2,} [ぁ-ん]{2,}/;
  roots.forEach(root => { const w = document.createTreeWalker(root, 4); while (w.nextNode()) { const t = w.currentNode; const v = t.nodeValue; if (!v.trim()) continue;
    let skip = false; for (let p = t.parentNode; p && p !== document.body; p = p.parentNode) { if (p.nodeType === 1 && (['RT', 'RP', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION'].includes(p.nodeName) || p.hasAttribute('data-noruby') || (p.classList && (p.classList.contains('subj') || p.classList.contains('chips'))) || p.id === 'rsDev' || (p.id === 'rsName'))) { skip = true; break; } }
    if (skip) continue;
    const inRuby = !!(t.parentNode.closest && t.parentNode.closest('ruby'));
    out.text.push(v.trim());
    if (BAD.test(v)) out.bad.push('禁止語：' + v.trim().slice(0, 60)); if (WAKA.test(v)) out.bad.push('分かち書き：' + v.trim().slice(0, 60));
    if (!inRuby && KANJI.test(v)) out.bare.push(v.trim().slice(0, 50)); } });
  return out; }"""
def scan(pg, key):
    r = pg.evaluate(SCAN)
    if r['bare']: R['bare_kanji'][key] = r['bare'][:8]
    for b in r['bad']: R['bad_text'].append(key + '：' + b)
    return r

with sync_playwright() as p:
    b = p.chromium.launch(headless=not os.environ.get('HEADED'))
    pg = new_page(b); boot(pg)
    # ================= 画面を全部めぐって、ルビ・分かち書き・禁止語を調べる =================
    SCREENS = [('adv', None), ('town', None), ('place', {'id': 'guild'}), ('place', {'id': 'shop'}), ('place', {'id': 'forge'}), ('place', {'id': 'temple'}), ('place', {'id': 'room'}),
               ('me', None), ('equip', None), ('shop', None), ('forge', None), ('jobs', None), ('loadout', None), ('look', None), ('ach', None), ('settings', None), ('storylist', None), ('regionmap', {'id': 'meadow'}), ('codex', None)]
    pg.evaluate("() => home()"); pg.wait_for_timeout(400); scan(pg, 'home'); shot(pg, 'home_390', False)
    for scr, prm in SCREENS:
        go(pg, scr, prm); pg.wait_for_timeout(300); key = scr + (':' + prm['id'] if prm and 'id' in prm else ''); scan(pg, key)
        if scr in ('adv', 'town', 'me', 'equip', 'shop', 'codex', 'forge'): shot(pg, scr + '_390', False)
    for tier in ('base', 'adv', 'top'):
        go(pg, 'jobs'); pg.evaluate("(t) => document.querySelector(`[data-tier=${t}]`).click()", tier); pg.wait_for_timeout(300); scan(pg, 'jobs:' + tier)
    for j in pg.evaluate("() => RPGData.JOB_IDS"):
        go(pg, 'jobdetail', {'job': j}); pg.evaluate("() => document.querySelectorAll('details').forEach(d => d.open = true)"); pg.wait_for_timeout(200); scan(pg, 'jobdetail:' + j)
    go(pg, 'jobdetail', {'job': 'magicknight'}); shot(pg, 'jobdetail_390', False)
    for tab in ('armor', 'acc', 'sell'): go(pg, 'shop'); pg.click(f'[data-st={tab}]'); pg.wait_for_timeout(200); scan(pg, 'shop:' + tab)
    go(pg, 'shop'); pg.click('[data-st=weapon]'); pg.click('[data-shopall="1"]'); pg.wait_for_timeout(200); scan(pg, 'shop:all')
    go(pg, 'codex'); pg.evaluate("() => { const s = RPG.save; Object.keys(RPGData.ENEMIES).forEach(i => { s.codex.enemies[i] = {seen: 1, kills: 2}; }); }"); go(pg, 'codex'); pg.wait_for_timeout(500); scan(pg, 'codex:enemy'); shot(pg, 'codex_enemy_390', False)
    pg.click('[data-ct=item]'); pg.wait_for_timeout(300); scan(pg, 'codex:item')
    # 設定の「ふりがな」
    go(pg, 'settings'); pg.wait_for_timeout(200); scan(pg, 'settings'); shot(pg, 'settings_390', False)
    chk('ruby_default_on', pg.evaluate("() => RPGRuby.isOn() && !document.documentElement.classList.contains('rb-off') && getComputedStyle(document.querySelector('.rs-app rt')).display !== 'none'"))
    pg.click('#rbOff'); pg.wait_for_timeout(200)
    chk('ruby_toggle_off_hides_rt_in_rpg_screens', pg.evaluate("() => [...document.querySelectorAll('.rs-app rt')].every(r => getComputedStyle(r).display === 'none')"))
    go(pg, 'me'); shot(pg, 'me_ruby_off_390', False); pg.evaluate("() => home()"); pg.wait_for_timeout(300)
    chk('ruby_toggle_off_hides_rt_on_home', pg.evaluate("() => [...document.querySelectorAll('[data-rb] rt, .rs-nav rt')].every(r => getComputedStyle(r).display === 'none')"))
    pg.reload(); pg.wait_for_selector('#go', state='attached'); pg.wait_for_timeout(500)
    chk('ruby_off_kept_after_reload', pg.evaluate("() => !RPGRuby.isOn() && document.documentElement.classList.contains('rb-off')"))
    go(pg, 'settings'); pg.click('#rbOn'); pg.wait_for_timeout(200)
    chk('ruby_toggle_on_again', pg.evaluate("() => RPGRuby.isOn() && !document.documentElement.classList.contains('rb-off')"))
    # 学習の問題の文は、ルビの切り替えの影響を受けない（app.js の ruby() が出す rt はそのまま）
    pg.evaluate("() => { RPGRuby.setOn(false); }"); pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice')
    chk('learning_question_rt_not_hidden_by_toggle', pg.evaluate("() => { const r = document.querySelector('.qt rt, .choice rt'); return !r || getComputedStyle(r).display !== 'none'; }"))
    pg.evaluate("() => { RPGRuby.setOn(true); home(); }")
    # 報酬画面
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
    pg.wait_for_selector('#rwRoot', timeout=8000); pg.wait_for_timeout(500)
    r = scan(pg, 'reward'); shot(pg, 'reward_390', False)
    rw_n = pg.evaluate("() => [...document.querySelectorAll('#rwRoot ruby')].length"); chk('reward_text_has_kanji_ruby_words', rw_n > 5 and not R['bare_kanji'].get('reward'), [rw_n, r['text'][:3] if isinstance(r['text'], list) else str(r['text'])[:60]])
    chk('reward_ore_name_kanji', pg.evaluate("() => RPGCore.oreName(1)") == 'ランクIの鉱石')
    if pg.query_selector('#rwOpen'): pg.click('#rwOpen'); pg.wait_for_timeout(1200); scan(pg, 'reward_opened'); shot(pg, 'reward_opened_390', False)
    pg.click('#end'); pg.wait_for_selector('#go', state='attached')
    # ホームの言い方（学習アプリ本体＝復習）
    pg.wait_for_timeout(300)
    hm = pg.evaluate("() => { const f = id => { const c = document.getElementById(id).cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; }; return {go: f('go'), hard: f('hard')}; }")
    chk('home_buttons_use_fukushu_wording_with_kanji', hm['go'].startswith('スタート（') and '問' in hm['go'] and '復習が必要' in hm['hard'] and 'にがて' not in hm['hard'], hm)
    chk('home_has_ruby_on_start_buttons', pg.evaluate("() => document.querySelectorAll('#go ruby, #hard ruby').length >= 3"))
    # ================= 図鑑の分母・会話・レア品 =================
    cs = pg.evaluate("() => RPGMeta.codexSummary(RPG.save)")
    chk('codex_denominator_base_species_99_variants_60', cs['enemies']['total'] == 99 and cs['enemies']['variants']['total'] == 60, cs)
    chk('codex_enemy_tab_total_matches_summary', pg.evaluate("() => { RPG.go('codex', {}); return document.querySelector('[data-ct=enemy]').textContent.includes('/' + RPGMeta.codexSummary(RPG.save).enemies.total); }"))
    pg.wait_for_timeout(300)
    nb = pg.evaluate("() => { const cells = document.querySelectorAll('.rs-cgrid .rs-cell').length; return {cells, base: RPGMeta.baseEnemyIds().length}; }")
    chk('codex_enemy_grid_shows_only_base_species', nb['cells'] == nb['base'], nb)
    chk('codex_variants_shown_inside_parent', pg.evaluate("() => [...document.querySelectorAll('.rs-cell small')].some(s => s.textContent.includes('強化') && /\\d+\\/\\d+/.test(s.textContent))"))
    st = pg.evaluate("() => { const s = RPG.save; const ids = RPGMeta.codexItemIds(); return {total: ids.length, listed: (RPG.go('codex', {}), document.querySelector('[data-ct=item]').click(), document.querySelectorAll('.rs-eqitem[data-item]').length), tab: document.querySelector('[data-ct=item]').textContent}; }")
    chk('codex_item_list_count_equals_denominator', st['listed'] == st['total'] and f"/{st['total']}" in st['tab'], st)
    ev = pg.evaluate("() => { const D = RPGData, ST = RPGStory; let n = 0, ev = 0; D.ROUTE.forEach(r => { n++; if (ST.pagesFor(r).length) ev++; }); return {n, ev, boss2: ST.pagesFor(D.ROUTE.find(r => r.boss && r.seg === 2)).length}; }")
    chk('story_only_at_events', 0 < ev['ev'] < ev['n'] / 2 and ev['boss2'] == 0, ev)
    # レア60品：正式名（仮の札なし）・名前の重複なし・アイコン・同じ itemId で 装備/図鑑 に同じ名前とアイコン
    rare = pg.evaluate("() => Object.values(RPGData.ITEMS).filter(i => i.rarity === 'rare').map(i => ({id: i.id, name: i.name, prov: !!i.provisional, icon: !!RPG.assets['icon_' + i.id], slot: i.slot, eff: RPGMeta.effectShort(i.id)}))")
    chk('rare_60_items_formal_names_icons_effects', len(rare) == 60 and not any(x['prov'] for x in rare) and all(x['icon'] and x['eff'] for x in rare) and len({x['name'] for x in rare}) == 60, [len(rare), [x['id'] for x in rare if not x['icon']]])
    pg.evaluate("() => { const s = RPG.save; Object.values(RPGData.ITEMS).filter(i => i.rarity === 'rare').forEach(i => { s.inv.items[i.id] = 1; s.codex.items[i.id] = 1; }); s.progress.step = 300; }")
    rows = {}
    for slot in ('weapon', 'armor', 'acc'):
        go(pg, 'equip'); pg.click(f'[data-slot={slot}]'); pg.evaluate("() => document.querySelectorAll('details.rs-det').forEach(d => d.open = true)"); pg.wait_for_timeout(250)
        for rw in pg.evaluate("() => { const tx = e => { if (!e) return ''; const c = e.cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; };  return [...document.querySelectorAll('.rs-eqitem[data-eq]')].map(r => ({id: r.dataset.eq, name: tx(r.querySelector('b')).replace(/ \\+\\d+$/, ''), icon: (r.querySelector('img.rs-ic') || {}).src || ''})); }"):
            if rw['id']: rows[rw['id']] = rw
    go(pg, 'codex'); pg.click('[data-ct=item]'); pg.wait_for_timeout(300)
    cdx = {r['id']: r for r in pg.evaluate("() => { const tx = e => { if (!e) return ''; const c = e.cloneNode(true); c.querySelectorAll('rt').forEach(r => r.remove()); return c.textContent; };  return [...document.querySelectorAll('.rs-eqitem[data-item]')].map(r => ({id: r.dataset.item, name: tx(r.querySelector('b')), icon: (r.querySelector('img.rs-ic') || {}).src || '', small: tx(r.querySelector('small'))})); }")}
    bad = [x['id'] for x in rare if not (x['id'] in rows and x['id'] in cdx and rows[x['id']]['name'] == cdx[x['id']]['name'] == x['name'] and rows[x['id']]['icon'] == cdx[x['id']]['icon'] and rows[x['id']]['icon'] and x['eff'] in cdx[x['id']]['small'])]
    R['dbg'] = {'rows': list(rows.items())[:2], 'cdx': list(cdx.items())[:2], 'nrows': len(rows), 'ncdx': len(cdx)}
    chk('B03_rare_60_same_name_icon_effect_in_equip_and_codex_by_itemId', not bad, bad[:6])
    go(pg, 'equip'); shot(pg, 'equip_rare_390', False)
    pg.context.close()

    # ================= 390px 撮影：ホーム・冒険・街・自分・装備・店・転職・図鑑・報酬（目視用）=================
    # （上の巡回で撮影済み。ルビOFFの比較は me_ruby_off_390）
    b.close()

json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
open(os.path.join(OUT, 'bare_kanji.txt'), 'w', encoding='utf-8').write('\n'.join(f'{k}\t{" / ".join(v)}' for k, v in R['bare_kanji'].items()) or '（ルビの外の漢字なし）')
chk('B04_no_bare_kanji_in_any_kid_screen', not R['bare_kanji'], {k: v[:3] for k, v in list(R['bare_kanji'].items())[:6]})
chk('B05_no_wakachi_kari_or_dev_notes_in_any_screen', not R['bad_text'], R['bad_text'][:8])
json.dump(R, open(os.path.join(OUT, 'result.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
bad = {k: v for k, v in R['checks'].items() if v is False or (isinstance(v, dict) and not v['ok'])}
for k, v in bad.items():
    if isinstance(v, dict) and 'v' in v: v['v'] = str(v['v'])[:400]
print(json.dumps({'failed': bad, 'console': R['console'][:10], 'n': len(R['checks']), 'blocked': R['blocked']}, ensure_ascii=False, indent=1))
