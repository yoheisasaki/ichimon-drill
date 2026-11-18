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
  // ---- 正式素材（画像）。ASSET_MANIFEST.json の status:'正式' の png を読み込み、あれば仮絵の代わりに描く ----
  const IMGS = {};
  function loadImages(assets, done) {
    Object.keys(assets || {}).forEach(id => {
      const a = assets[id]; if (!a || !/^rpg\/assets\/.+\.png$/.test(a.path || '') || typeof Image === 'undefined') return;
      const im = new Image(); im.onload = () => { IMGS[id] = im; if (done) done(id); }; im.src = a.path;
    });
  }
  // 画像は「ctx の拡大率に関わらず 画像1ドット = 画面の1CSS px」で描く（ぼかさない）。cx は中心、gy は足元。
  function blit(ctx, im, cx, gy, tint, scale) {
    const k = ctx.getTransform().a || 1, sc = scale || 1, w = im.width * sc / k, h = im.height * sc / k;
    ctx.imageSmoothingEnabled = false;
    let src = im;
    if (tint) {
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
      g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.55; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); src = c;
    }
    ctx.drawImage(src, cx - w / 2, gy - h, w, h);
  }
  function drawHero(ctx, job, x, groundY, o) {
    o = o || {};
    const im = o.img && IMGS['hero_' + job + (o.img === 'strip' ? '_strip' : '')];
    if (im) {
      blit(ctx, im, x + 7, groundY, o.tint);
      if (o.guard) { ctx.fillStyle = '#7fd3ff'; ctx.fillRect(x + 12, groundY - 12, 2, 5); }
      return;
    } const rows = heroRows(o.look), y = groundY - rows.length, pal = palForHero(job); if (o.outfit) pal.b = o.outfit;
    if (o.look) { pal.s = o.look.skin; pal.h = o.look.hair; }
    draw(ctx, rows, pal, x, y, false, o.tint);
    if (o.guard) { ctx.fillStyle = '#7fd3ff'; ctx.fillRect(x + 11, y + 5, 2, 5); }
  }
  function drawEnemy(ctx, id, boss, x, groundY, o) {
    o = o || {};
    const im = o.img && IMGS['enemy_' + id + (o.img === 'strip' ? '_strip' : '')];
    if (im) { blit(ctx, im, x + 7, groundY - (o.lift || 0), o.tint, o.scale); return; } const rows = SHAPES[shapeOf(id)], y = groundY - rows.length - (o.lift || 0);
    draw(ctx, rows, palForEnemy(id, boss), x, y, false, o.tint);
    if (boss) { ctx.fillStyle = '#e0b030'; ctx.fillRect(x + 4, y - 2, 1, 2); ctx.fillRect(x + 6, y - 3, 2, 3); ctx.fillRect(x + 9, y - 2, 1, 2); }
  }
  // 宝箱 12x9
  const CHEST = ['..oooooooo..', '.obbbbbbbbo.', 'obbbbbbbbbbo', 'oyyyyyyyyyyo', 'obbbyybbbbbo', 'obbbyybbbbbo', 'obbbbbbbbbbo', 'oooooooooooo'];
  const CHEST_OPEN = ['.y..y..y..y.', '..oooooooo..', '.oYYYYYYYYo.', 'oyyyyyyyyyyo', 'oddddddddddo', 'obbbbbbbbbbo', 'obbbyybbbbbo', 'oooooooooooo'];
  function drawChest(ctx, x, groundY, open, kind) {
    const im = IMGS['chest_' + (kind || 'normal') + '_' + (open ? 'open' : 'closed')];
    if (im) { blit(ctx, im, x + 6, groundY, null); return; }
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
    skycastle: { sky: ['#b9a5f0', '#efe6ff'], far: '#a08ad8', grass: '#c8b8f0', tuft: '#9a86d0', tree: '#7a68b8' },
    // 第2・3章・クリア後（仮の色味。正式素材は未制作）
    rootwood: { sky: ['#6a8a5a', '#a8c890'], far: '#4a6a3a', grass: '#3a5a30', tuft: '#2a4a24', tree: '#5a3a20' }, sunkencity: { sky: ['#5a9ac0', '#a8d8e8'], far: '#4a7a9a', grass: '#3a6a88', tuft: '#2a5a78', tree: '#6a8aa0' },
    invertedruins: { sky: ['#d8c090', '#f0e4c0'], far: '#b09a6a', grass: '#c8aa70', tuft: '#a08850', tree: '#7a6a40' }, icevolcano: { sky: ['#e08a60', '#f6d0b0'], far: '#8a4a3a', grass: '#6a4a40', tuft: '#4a3028', tree: '#c8503a' },
    oldfactory: { sky: ['#9a9aa8', '#cacad4'], far: '#707080', grass: '#5a5a68', tuft: '#40404c', tree: '#8a7050' }, skybackside: { sky: ['#8a78c8', '#d0c4f0'], far: '#6a58a8', grass: '#9a88d0', tuft: '#7a68b8', tree: '#5a4a98' },
    worldtree: { sky: ['#9ae0b8', '#e4f8d8'], far: '#5ab07a', grass: '#4aa060', tuft: '#2a8040', tree: '#7a5a30' }, moonfall: { sky: ['#2a3a7a', '#7a8ac8'], far: '#4a5a9a', grass: '#5a7ab0', tuft: '#8ab0d8', tree: '#3a4a80' },
    skytower: { sky: ['#f0c870', '#fff0c0'], far: '#d0a850', grass: '#e0c070', tuft: '#b89040', tree: '#8a6a30' }, aurora: { sky: ['#4a7ac8', '#a0e8d0'], far: '#8ab8d8', grass: '#e0f0f8', tuft: '#a8d0e8', tree: '#5a8ab0' },
    skyfactory: { sky: ['#a0a8c0', '#d8dcec'], far: '#7a8098', grass: '#606880', tuft: '#464e68', tree: '#a07040' }, crown: { sky: ['#2a1a5a', '#8a60c8'], far: '#4a3a8a', grass: '#6a50a8', tuft: '#8a70c8', tree: '#3a2a70' },
    trial_wing: { sky: ['#f0d890', '#fff4d0'], far: '#e0c070', grass: '#f0e0a0', tuft: '#d8b860', tree: '#c8a040' }, trial_star: { sky: ['#1a1a50', '#5a4aa8'], far: '#3a3a80', grass: '#4a4a98', tuft: '#6a5ab8', tree: '#2a2a68' },
    garden: { sky: ['#f8d0e0', '#fff0f4'], far: '#e890b0', grass: '#7ac860', tuft: '#d8608a', tree: '#c8408a' }, pearl: { sky: ['#a0d0e8', '#e0f4f8'], far: '#80b8d0', grass: '#a8d0e0', tuft: '#d8e8f0', tree: '#6a9ab8' },
    nightcity: { sky: ['#1a1a40', '#5a5a98'], far: '#3a3a70', grass: '#40406a', tuft: '#5a5a90', tree: '#2a2a50' }, dragonvalley: { sky: ['#a8c0d8', '#e0ecf4'], far: '#7a98b8', grass: '#c8d8e4', tuft: '#98b4cc', tree: '#6a7a90' },
    lab0: { sky: ['#8a96a8', '#cfd6e0'], far: '#667080', grass: '#505a68', tuft: '#38424e', tree: '#80a0c0' }, orchard: { sky: ['#3a2a78', '#9a80d8'], far: '#5a4a98', grass: '#6a5aa8', tuft: '#f0e090', tree: '#4a3a88' },
    dawnisle: { sky: ['#f8a878', '#fff0c8'], far: '#f0c890', grass: '#e8d8a0', tuft: '#c8b070', tree: '#8a9a5a' }
  };
  function drawBackground(ctx, w, h, region, img) {
    const bim = img && IMGS['bg_' + region + (img === 'strip' ? '_strip' : '')];
    if (bim) {   // 画像を縦横比そのままで敷き詰める（はみ出しは中央〜下基準で切る）
      const k = ctx.getTransform().a || 1, cw = w * k, ch = h * k, sc = Math.max(cw / bim.width, ch / bim.height), dw = bim.width * sc, dh = bim.height * sc;
      ctx.imageSmoothingEnabled = false; ctx.drawImage(bim, (cw - dw) / 2 / k, (ch - dh) / k, dw / k, dh / k); return;
    }
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
  root.RPGSprites = { heroRows, PAL, JOB_COLOR, HERO, SHAPES, shapeOf, drawHero, drawEnemy, drawChest, drawBackground, px, REGION_COLOR, palForEnemy, IMGS, loadImages };
  if (typeof module === 'object' && module.exports) module.exports = root.RPGSprites;
})(typeof self !== 'undefined' ? self : this);
