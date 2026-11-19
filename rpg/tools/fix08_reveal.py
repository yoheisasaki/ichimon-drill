# 開封直後のアイテム名が下の操作帯に隠れないかの検査（chromium・webkit、nosend=1）。python rpg/tools/fix08_reveal.py [port]
# 条件：開封後、#rwChestLine の bottom <= .rw-foot の top（かつ top >= #rwBody の top）。reduced-motion も確認。
import sys, os, json
src = open(os.path.join(os.path.dirname(__file__), 'fix08_reward.py'), encoding='utf-8').read()
exec(src.split('def run_vp')[0].replace("os.path.join(ROOT, 'rpg', 'shots', 'fix08_screens')", "os.path.join(ROOT, 'rpg', 'shots', 'fix08_reveal')"))
from playwright.sync_api import sync_playwright
VP = [(320, 568), (320, 640), (390, 640), (390, 700)]
CASES = [('coin', {'chest': 'coin', 'wrong': True}), ('rare_big', {'chest': 'rare', 'big': True, 'R': 2, 'C': 7, 'wrong': True, 'boss': True})]
M = """() => { const l = document.getElementById('rwChestLine').getBoundingClientRect(), f = document.querySelector('.rw-foot').getBoundingClientRect(), b = document.getElementById('rwBody').getBoundingClientRect();
  return { lineTop: Math.round(l.top), lineBottom: Math.round(l.bottom), footTop: Math.round(f.top), bodyTop: Math.round(b.top), ok: l.bottom <= f.top + 0.5 && l.top >= b.top - 0.5 }; }"""
res = []; bad = []
def one(br, name, w, h, case, o, rm):
    ctx = br.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, is_mobile=True, has_touch=True, reduced_motion='reduce' if rm else 'no-preference')
    pg = ctx.new_page(); pg.route('**/script.google.com/**', blk); pg.goto(BASE); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t, js]) => { const s = JSON.parse(t); (new Function('s', js))(s); localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [SAVE0, PATCH])
    pg.reload(); pg.wait_for_selector('#go', state='attached'); pg.wait_for_function("() => Object.keys(RPGSprites.IMGS).length >= 700 && !!window.RPG && RPG.ok", timeout=90000); pg.wait_for_timeout(500)
    pg.evaluate(SETUP, o); pg.wait_for_timeout(400)
    pg.click('#rwOpen'); pg.wait_for_function("() => !document.getElementById('rwOpen')", timeout=5000); pg.wait_for_timeout(1000)
    m = pg.evaluate(M); m.update(br=name, vp=f'{w}x{h}', case=case, rm=rm); res.append(m)
    if not m['ok']: bad.append(m)
    pg.screenshot(path=os.path.join(OUT, f'{name}_{w}x{h}_{case}{"_rm" if rm else ""}.png')); ctx.close()
with sync_playwright() as p:
    for name, bt in (('chromium', p.chromium), ('webkit', p.webkit)):
        br = bt.launch(headless=True)
        for w, h in VP:
            for case, o in CASES: one(br, name, w, h, case, o, False)
        one(br, name, 320, 568, 'rare_big', CASES[1][1], True); br.close()
for m in res: print(m)
print('checks', len(res), 'bad', len(bad), 'console', R['console'][:3])
