'use strict';
// 仮のドット絵（コード描画）と、正式素材への差し替え口。
// 差し替え：ASSET_MANIFEST.json の該当id を status:'正式', path:'rpg/assets/xxx.png' にすると、その画像を優先して描く。
// ここにある絵は全て「仮」。完成扱いにしない。
(function (root) {
  const PAL = { o: '#1d2547', h: '#7a4a2a', s: '#f0c39a', w: '#f5efd8', k: '#5a3a22', g: '#d7dfe8', y: '#e0b030', e: '#ffffff', p: '#1d2547' };
  const JOB_COLOR = { warrior: '#3b6fd0', mage: '#7a4fc9', priest: '#e8e4d0', thief: '#3a8a5a', magicknight: '#d0503b', paladin: '#d8c060', shadow: '#4a4a66', sage: '#4fa0c9', ninja: '#5a3a6a', ranger: '#4f9a3a', skyknight: '#6fb0e8', starseer: '#2a2f78' };
  const HERO = [
    '....hhhhh.....', '...hhhhhhh....', '...hhssshh....', '...hssossh....', '....ssssss....', '.....wwww.....', '...bbbwwbb....',
    '..sbbbbbbbs.g.', '..sbbbbbbbbgg.', '...bbbbbbb.g..', '...bbbbbbb.y..', '...bbb.bbb....', '...kk...kk....', '..kkk...kkk...'
  ];
  const SHAPES = {
    blob: ['....oooooo....', '..ooggggggoo..', '.oglggggggggo.', '.ogggeoggeogo.', '.oggggggggggo.', 'oggggggggggggo', 'oddddddddddddo', '.oooooooooooo.'],
    bat: ['oo..........oo', 'ogo........ogo', 'oggo.oooo.oggo', '.oggoggggoggo.', '..oogeggeggoo.', '....oggggo....', '.....oddo.....'],
    armor: ['....oooooo....', '...ogggggdo...', '...ogeggegdo..', '...oggggggdo..', '..ooooooooooo.', '.ogggggggggdo.', '.ogggddggggdo.', '.ogggggggggdo.', '..oggo..oggo..', '..oooo..oooo..'],
    beast: ['..o........o..', '.ogo......ogo.', '.oggoooooogdo.', 'oggeggggggegdo', 'ogggggggggggdo', 'oggggggggggdo.', '.ogdo....ogdo.', '.oooo....oooo.']
  };
  function shapeOf(id) {
    if (/bat|condor|bird|screwbird|jelly|jellyfish|icicle/.test(id)) return /jelly/.test(id) ? 'blob' : 'bat';
    if (/armor|soldier|golem|guard|knight|device|giant|machine|mage/.test(id)) return 'armor';
    if (/wolf|lion|lizard|spider|crab|rabbit|dragon|turtle|hermit|mushroom|condor/.test(id)) return 'beast';
    return 'blob';
  }
  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, c = v => Math.max(0, Math.min(255, Math.round(v * f))); return '#' + [c(r), c(g), c(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }
  function hsl(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return '#' + [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join(''); }
  function palForEnemy(id, boss) { const h = hash(id) % 360, b = hsl(h, 55, boss ? 40 : 56); return Object.assign({}, PAL, { g: b, l: shade(b, 1.25), d: shade(b, 0.7) }); }
  function palForHero(job) { return Object.assign({}, PAL, { b: JOB_COLOR[job] || '#3b6fd0' }); }
  function pad(rows, W) { return rows.map(r => (r + '.'.repeat(W)).slice(0, W)); }
  function draw(ctx, rows, pal, x, y, flip, tint) {
    const W = 14; rows = pad(rows, W);
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < W; i++) {
      const ch = rows[j][flip ? W - 1 - i : i]; if (ch === '.') continue;
      ctx.fillStyle = tint || pal[ch] || '#f0f'; ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
  // 外見（顔4・髪6・肌・髪色）。仮絵：顔は目と口の形、髪は上の数行を差し替える
  const FACE3 = ['...hsososh....', '...hosssoh....', '...hsoeosh....', '...hseosoh....'], FACE4 = ['....ssssss....', '....ssooss....', '....sssoss....', '....soosss....'];
  const HAIR_TOP = [null, ['....hhhhh.....', '...hhhhhhh....'], ['....hhhhh.....', '...hhhhhhhh...'], ['..h.h.h.h.....', '...hhhhhhh....'], ['....hhhhh.....', '...hhhhhhh....'], ['....yyyyy.....', '...hhhhhhh....']];
  function heroRows(look) {
    const rows = HERO.slice();
    if (!look) return rows;
    rows[3] = FACE3[look.face % 4]; rows[4] = FACE4[look.face % 4];
    const hs = look.hairStyle | 0, top = HAIR_TOP[hs];
    if (top) { rows[0] = top[0]; rows[1] = top[1]; }
    const put = (r, c, ch) => { rows[r] = rows[r].slice(0, c) + ch + rows[r].slice(c + 1); };
    if (hs === 2) { [4, 5, 6].forEach(r => { put(r, 3, 'h'); put(r, 10, 'h'); }); }   // 長い髪
    if (hs === 4) { [4, 5, 6].forEach(r => { put(r, 2, 'h'); put(r, 11, 'h'); }); }   // ふたつ結び
    return rows;
  }
  function drawHero(ctx, job, x, groundY, o) {
    o = o || {}; const rows = heroRows(o.look), y = groundY - rows.length, pal = palForHero(job);
    if (o.look) { pal.s = o.look.skin; pal.h = o.look.hair; }
    draw(ctx, rows, pal, x, y, false, o.tint);
    if (o.guard) { ctx.fillStyle = '#7fd3ff'; ctx.fillRect(x + 11, y + 5, 2, 5); }
  }
  function drawEnemy(ctx, id, boss, x, groundY, o) {
    o = o || {}; const rows = SHAPES[shapeOf(id)], y = groundY - rows.length - (o.lift || 0);
    draw(ctx, rows, palForEnemy(id, boss), x, y, false, o.tint);
    if (boss) { ctx.fillStyle = '#e0b030'; ctx.fillRect(x + 4, y - 2, 1, 2); ctx.fillRect(x + 6, y - 3, 2, 3); ctx.fillRect(x + 9, y - 2, 1, 2); }
  }
  // 宝箱 12x9
  const CHEST = ['..oooooooo..', '.obbbbbbbbo.', 'obbbbbbbbbbo', 'oyyyyyyyyyyo', 'obbbyybbbbbo', 'obbbyybbbbbo', 'obbbbbbbbbbo', 'oooooooooooo'];
  const CHEST_OPEN = ['.y..y..y..y.', '..oooooooo..', '.oYYYYYYYYo.', 'oyyyyyyyyyyo', 'oddddddddddo', 'obbbbbbbbbbo', 'obbbyybbbbbo', 'oooooooooooo'];
  function drawChest(ctx, x, groundY, open) {
    const rows = open ? CHEST_OPEN : CHEST, pal = { o: '#3b1f12', b: '#a23a2a', y: '#e0b030', Y: '#fff3a0', d: '#4a2418' };
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const ch = r[i]; if (ch === '.') continue; ctx.fillStyle = pal[ch]; ctx.fillRect(x + i, groundY - rows.length + j, 1, 1); } });
  }
  // 背景（地域ごとの色味）。strip は帯用、scene は報酬用（高さに合わせて地面と木を足す）
  const REGION_COLOR = {
    meadow: { sky: ['#8fd3ff', '#d2f0ff'], far: '#79c27a', grass: '#5fae4a', tuft: '#3f8a3a', tree: '#2f7a3a' },
    waterland: { sky: ['#7fc8f0', '#cdeaff'], far: '#5fb0c8', grass: '#4fa8a0', tuft: '#2f7f88', tree: '#2a6a7a' },
    sandsea: { sky: ['#f6d9a0', '#fff0cf'], far: '#e0b873', grass: '#e8c780', tuft: '#c49a50', tree: '#8a7a3a' },
    mountain: { sky: ['#b7d6f0', '#eef6ff'], far: '#c8d8ea', grass: '#e6eef6', tuft: '#b4c8dc', tree: '#6a8aa8' },
    gearcity: { sky: ['#a8a8b8', '#d8d8e0'], far: '#8a8a9a', grass: '#707080', tuft: '#555566', tree: '#4a4a5a' },
    skycastle: { sky: ['#b9a5f0', '#efe6ff'], far: '#a08ad8', grass: '#c8b8f0', tuft: '#9a86d0', tree: '#7a68b8' }
  };
  function drawBackground(ctx, w, h, region) {
    const c = REGION_COLOR[region] || REGION_COLOR.meadow, gh = Math.max(5, Math.round(h * 0.27));
    const sky = Math.floor((h - gh) / 2);
    ctx.fillStyle = c.sky[0]; ctx.fillRect(0, 0, w, h); ctx.fillStyle = c.sky[1]; ctx.fillRect(0, sky, w, h);
    ctx.fillStyle = c.far;   // 遠い丘
    for (let x = 0; x < w; x++) { const hh = Math.round(2 + (h > 40 ? 6 : 2) * (0.5 + 0.5 * Math.sin(x / 11 + 1) * Math.cos(x / 23))); ctx.fillRect(x, h - gh - hh, 1, hh); }
    ctx.fillStyle = c.grass; ctx.fillRect(0, h - gh, w, gh);
    ctx.fillStyle = c.tuft;
    for (let x = 2; x < w; x += 7) { const yy = h - gh + 1 + (hash('t' + x) % Math.max(1, gh - 2)); ctx.fillRect(x, yy, 1, 1); ctx.fillRect(x + 1, yy - 1, 1, 1); }
    ctx.fillStyle = c.tree;   // 木・茂み
    for (let x = 12; x < w - 10; x += 29 + (hash('b' + x) % 14)) { const hh = 4 + (hash('h' + x) % 4) * (h > 40 ? 3 : 1); ctx.fillRect(x, h - gh - hh, 5, hh); ctx.fillRect(x + 1, h - gh - hh - 1, 3, 1); }
  }
  // 小さな点（剣のきらめきなど）
  function px(ctx, x, y, col, n) { ctx.fillStyle = col; ctx.fillRect(x, y, n || 1, n || 1); }
  root.RPGSprites = { heroRows, PAL, JOB_COLOR, HERO, SHAPES, shapeOf, drawHero, drawEnemy, drawChest, drawBackground, px, REGION_COLOR, palForEnemy };
  if (typeof module === 'object' && module.exports) module.exports = root.RPGSprites;
})(typeof self !== 'undefined' ? self : this);
