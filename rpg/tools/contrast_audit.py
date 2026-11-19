# 文字色と背景色のコントラスト比を、主要画面の全テキスト要素で計算する（headless chromium、390px、nosend=1）。4.5 未満を列挙。
# python rpg/tools/contrast_audit.py → rpg/shots/fix07_tests/contrast.json。背景が画像（canvas/img）の上の文字は対象外（枠付きの札は札の色で計算）。
import sys, json, os, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
class TS(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True; allow_reuse_address = True
srv = TS(('127.0.0.1', 18493), functools.partial(Q, directory=ROOT)); threading.Thread(target=srv.serve_forever, daemon=True).start()
S0 = open(os.path.join(ROOT, 'rpg', 'tests', 'saves', 'day14.json'), encoding='utf-8').read()
JS = r"""() => {
  const parse = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(',').map(x => parseFloat(x)); return { r: v[0], g: v[1], b: v[2], a: v.length > 3 ? v[3] : 1 }; };
  const lum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * (f.a) + b.b * (1 - f.a), a: 1 });
  // 背景候補（最悪ケースを使う）：背景色＋グラデーションの各色
  const bgOf = (el, txt) => {
    let layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e), c = parse(cs.backgroundColor), bi = cs.backgroundImage;
      if (bi && bi !== 'none') { if (/url\(/.test(bi)) return { img: true }; const cols = (bi.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean); if (cols.length) { layers.push({ multi: cols }); if (cols.every(x => x.a >= 1)) break; } }
      if (c && c.a > 0) { layers.push({ one: c }); if (c.a >= 1) break; }
    }
    let cands = [{ r: 241, g: 239, b: 252, a: 1 }];
    for (let i = layers.length - 1; i >= 0; i--) { const L = layers[i]; const opts = L.one ? [L.one] : L.multi; cands = cands.flatMap(b => opts.map(o => over(o, b))); }
    return { cands };
  };
  const out = [], seen = new Set();
  const walker = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
  for (let n; (n = walker.nextNode());) {
    const t = n.nodeValue.trim(); if (!t) continue; const el = n.parentElement; if (!el || el.closest('canvas,script,style')) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (el.closest('details:not([open]) > :not(summary)')) continue;
    const fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el); if (bg.img) continue;
    const op = parseFloat(cs.opacity) * (el.closest('[disabled],.used,.lock,.ng') ? 1 : 1);
    let worst = 99, wb = null; bg.cands.forEach(b => { const f = over({ r: fg.r, g: fg.g, b: fg.b, a: fg.a }, b); const c = cr(f, b); if (c < worst) { worst = c; wb = b; } });
    const key = (el.className || el.tagName) + '|' + t.slice(0, 12) + '|' + cs.color; if (seen.has(key)) continue; seen.add(key);
    const disabled = !!el.closest('button:disabled,[aria-disabled=true]');
    out.push({ text: t.slice(0, 16), tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal === undefined ? el.className : '').toString().slice(0, 30), fg: cs.color, ratio: Math.round(worst * 100) / 100, size: parseFloat(cs.fontSize), disabled });
  }
  return out;
}"""
SCREENS = [('home_range_open', None), ('adv', None), ('town', None), ('me', None), ('equip', None), ('shop', None), ('forge', None), ('jobs', None), ('jobdetail', {'job': 'magicknight'}), ('look', None), ('settings', None), ('codex', None), ('ach', None), ('loadout', None), ('place', {'id': 'guild'})]
R = {}
with sync_playwright() as p:
    b = p.chromium.launch(headless=True); ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    ctx.add_init_script('window.__rangeOpen = true'); pg = ctx.new_page(); pg.goto(f'http://127.0.0.1:18493/index.html?nosend=1'); pg.wait_for_selector('#go', state='attached')
    pg.evaluate("([t]) => { const s = JSON.parse(t); s.job='warrior'; s.firstDone=true; s.coins=3000; s.jobXp.warrior=9000; s.jobXp.mage=9000; s.active=null; s.inv.items.w_sword_2=1; s.codex.items.w_sword_2=1; localStorage.setItem('ichimon.rpg.v1', JSON.stringify(s)); }", [S0])
    pg.reload(); pg.wait_for_function("() => !!window.RPG && RPG.ok && Object.keys(RPGSprites.IMGS).length >= 766", timeout=90000); pg.wait_for_timeout(800)
    for scr, prm in SCREENS:
        if scr == 'home_range_open': pg.evaluate("() => home()"); pg.wait_for_timeout(400); pg.click('.rs-range summary') if pg.query_selector('.rs-range:not([open])') else None; pg.click('.subj[data-f=社会]'); pg.wait_for_timeout(300)
        else: pg.evaluate("([n, p]) => RPG.go(n, p || {})", [scr, prm]); pg.wait_for_timeout(500)
        R[scr] = pg.evaluate(JS)
    # 報酬（結果）画面
    pg.evaluate("() => home()"); pg.wait_for_timeout(300)
    pg.evaluate("() => { filter = '社会'; units = {}; start(pick(pool().filter(q => q.type !== 'input' && !q.map), 10)); }"); pg.wait_for_selector('.choice')
    C = "() => { const q = S.cur; document.querySelectorAll('.choice')[S.opts.indexOf(q.a)].click(); }"
    for _ in range(40):
        if pg.query_selector('#rwRoot'): break
        pg.evaluate(C); pg.wait_for_timeout(700)
    pg.wait_for_selector('#rwRoot'); pg.wait_for_timeout(500); R['reward'] = pg.evaluate(JS)
    b.close()
bad = {k: [x for x in v if x['ratio'] < 4.5] for k, v in R.items()}
tot = sum(len(v) for v in R.values()); nb = sum(len(v) for v in bad.values())
json.dump({'checked': tot, 'below_4.5': nb, 'bad': bad}, open(os.path.join(ROOT, 'rpg', 'shots', 'fix07_tests', 'contrast.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('checked', tot, 'below 4.5:', nb)
for k, v in bad.items():
    for x in v: print(k, x)
