'use strict';
// 絵の描画：主人公（drawHeroLayered＝唯一の入口）・敵・宝箱・背景。正式素材（ASSET_MANIFEST.json の status:'正式'）の画像を描く。
// 敵の形4種の仮絵は、正式画像が無い敵のための暫定（開発用検査 ?devcheck=1 に出る）。
(function (root) {
  const PAL = { o: '#1d2547', h: '#7a4a2a', s: '#f0c39a', w: '#f5efd8', k: '#5a3a22', g: '#d7dfe8', y: '#e0b030', e: '#ffffff', p: '#1d2547' };
  const JOB_COLOR = { warrior: '#3b6fd0', mage: '#7a4fc9', priest: '#e8e4d0', thief: '#3a8a5a', magicknight: '#d0503b', paladin: '#d8c060', shadow: '#4a4a66', sage: '#4fa0c9', ninja: '#5a3a6a', ranger: '#4f9a3a', skyknight: '#6fb0e8', starseer: '#2a2f78' };
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
  function pad(rows, W) { return rows.map(r => (r + '.'.repeat(W)).slice(0, W)); }
  function draw(ctx, rows, pal, x, y, flip, tint) {
    const W = 14; rows = pad(rows, W);
    for (let j = 0; j < rows.length; j++) for (let i = 0; i < W; i++) {
      const ch = rows[j][flip ? W - 1 - i : i]; if (ch === '.') continue;
      ctx.fillStyle = tint || pal[ch] || '#f0f'; ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
  // ---- 正式素材（画像）。ASSET_MANIFEST.json の status:'正式' の png を読み込み、あれば仮絵の代わりに描く ----
  const IMGS = {}, IMGS_WANT = {}, IMGS_FAILED = {};
  function loadImages(assets, done) {
    loadStarted = true;
    const W_ = id => /^hero_/.test(id) || /^bg_(town|room|crown)/.test(id) ? 0 : /^(chest_|town_|npc_|icon_)/.test(id) ? 1 : /^bg_/.test(id) && !/_(map|strip)/.test(id) ? 2 : /^enemy_/.test(id) ? 3 : 4;   // 画面に先に要る物から読む
    Object.keys(assets || {}).sort((a, b) => W_(a) - W_(b)).forEach(id => {
      const a = assets[id]; if (!a || !/^rpg\/assets\/.+\.png$/.test(a.path || '') || typeof Image === 'undefined') return;
      IMGS_WANT[id] = 1;
      const im = new Image(); im.onload = () => { IMGS[id] = im; if (done) done(id); notifyUpdate(); }; im.onerror = () => { IMGS_FAILED[id] = 1; notifyUpdate(); }; im.src = a.path;
    });
    notifyUpdate();
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
  // ================= 主人公：描画の唯一の入口 drawHeroLayered =================
  // 部品（rpg/assets/parts/）が揃う組合せは「身体→頭→武器→前の手」を重ね、顔・髪・肌・髪色・武器を反映する。
  // 揃わない組合せは正式な1枚絵（chars/hero_*）で描く。1枚絵は顔・髪・色・武器が変わらないので、開発用検査（?devcheck=1）に一覧で出す。
  const UPDATE_CBS = []; let updTimer = 0;
  function onUpdate(cb) { UPDATE_CBS.push(cb); }
  function notifyUpdate() {   // 画像の読込が終わるたびに、描き直し（まとめて1回）
    if (updTimer || typeof setTimeout === 'undefined') return;
    updTimer = setTimeout(() => { updTimer = 0; UPDATE_CBS.forEach(f => { try { f(); } catch (e) { if (root.console) console.error('SP update', e); } }); }, 16);
  }
  const hexInt = h => parseInt(String(h).replace('#', ''), 16) >>> 0;
  const intHex = n => '#' + (n & 0xffffff).toString(16).padStart(6, '0');
  const mix = (a, b, t) => { const A = hexInt(a), B = hexInt(b), c = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t); return intHex((c(16) << 16) | (c(8) << 8) | c(0)); };
  // 肌・髪の色の列（明→暗）。部品の色列（n色）の「基本色」の位置（n<=2:先頭／3〜4色:2番目／5色以上:3番目）に base を置き、明るい側は白へ、暗い側は黒へ寄せる
  const baseIdxOf = n => (n <= 2 ? 0 : n <= 4 ? 1 : 2);
  function buildRamp(base, n) {
    if (n <= 1) return [base];
    const bi = baseIdxOf(n), out = [];
    for (let i = 0; i < n; i++) out.push(i === bi ? base : i < bi ? mix(base, '#ffffff', 0.38 * (bi - i)) : mix(base, '#000000', 0.16 * (i - bi)));
    return out;
  }
  // 完全一致の色だけ置換（ImageData.data を直接書き換える）。pairs: [[from,to],...]
  function recolorData(data, pairs) {
    const m = new Map(); pairs.forEach(([f, t]) => { if (f && t) m.set(hexInt(f), hexInt(t)); });
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const to = m.get(((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]) >>> 0);
      if (to != null) { data[i] = (to >> 16) & 255; data[i + 1] = (to >> 8) & 255; data[i + 2] = to & 255; }
    }
    return data;
  }
  // 武器の置き場所：武器の握り(grip)を身体の握り手に合わせ、(身体の gripAngle − 武器の tipAngle) 度だけ回す
  function weaponPlacement(body, wEntry, iconW, iconH) {
    const wg = (wEntry && wEntry.grip) || [Math.round(iconW * 0.2), Math.round(iconH * 0.8)], tip = wEntry && wEntry.tipAngle != null ? wEntry.tipAngle : 45;
    return { pivot: (body.grip || [0, 0]).map(Math.round), origin: wg.map(Math.round), angle: (body.gripAngle != null ? body.gripAngle : 45) - tip, scale: body.weaponScale || 1 };
  }
  const PARTS = { base: 'rpg/assets/parts/', json: null, state: 'idle', imgs: {}, cache: {} };
  const stripPng = s => String(s).replace(/\.png$/, '');
  function pickKey(obj, names) { if (!obj) return null; for (const n of names) { if (obj[n]) return { key: n, v: obj[n] }; if (obj[n + '.png']) return { key: n + '.png', v: obj[n + '.png'] }; } return null; }
  // base＝部品フォルダ。台帳（ASSET_MANIFEST）の parts_json が「正式」のときだけ rpg-ui から呼ぶ（無いフォルダを取りに行って404を出さない）
  function loadParts(base) {
    PARTS.base = base || PARTS.base; PARTS.state = 'loading'; PARTS.json = null; PARTS.imgs = {}; PARTS.cache = {}; DEV.entries = {};
    if (typeof fetch === 'undefined') { PARTS.state = 'none'; return; }
    fetch(PARTS.base + 'parts.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject(new Error('http ' + r.status))).then(j => { PARTS.json = j; PARTS.state = 'ready'; notifyUpdate(); }).catch(() => { PARTS.state = 'none'; notifyUpdate(); });
  }
  function noParts() { PARTS.state = 'none'; PARTS.json = null; }
  function partImg(file) {   // 'pending' | 'fail' | Image
    const c = PARTS.imgs[file]; if (c) return c.state === 'ok' ? c.im : c.state;
    if (typeof Image === 'undefined') return 'fail';
    const im = new Image(), e = PARTS.imgs[file] = { state: 'pending', im };
    im.onload = () => { e.state = 'ok'; notifyUpdate(); }; im.onerror = () => { e.state = 'fail'; notifyUpdate(); }; im.src = PARTS.base + file;
    return 'pending';
  }
  const bodyKeys = (job, costume, pose, size) => { const k = `${job}${costume ? '_' + costume : ''}_${pose}_${size}`; return [k, 'body_' + k]; };
  const iconImgOf = id => IMGS['icon_' + id] || IMGS['icon_' + String(id).replace(/^(u_.+)_\d$/, '$1')] || null;
  const iconFileOf = id => { const im = iconImgOf(id); return im ? String(im.src || '').split('/').pop().split('?')[0] : ''; };
  function wholeKeys(job, costume, pose, size) {
    if (size === 'S') {
      if (costume === 'master') return ['hero_' + job + '_strip_master', 'hero_' + job + '_strip'];
      return pose === 'idle' ? ['hero_' + job + '_strip'] : ['hero_' + job + '_strip_' + pose, 'hero_' + job + '_strip'];
    }
    if (costume === 'master') return pose === 'win' ? ['hero_' + job + '_master_win', 'hero_' + job + '_master'] : ['hero_' + job + '_master'];
    return pose === 'idle' ? ['hero_' + job] : ['hero_' + job + '_' + pose, 'hero_' + job];
  }
  const POSES = { L: ['idle', 'ready', 'attack', 'guard', 'hit', 'win'], S: ['idle', 'walk', 'walk2', 'windup', 'attack', 'guard', 'win', 'hit'] };
  // 部品が無い職の新ポーズは、近い旧ポーズで代用（新比率の職だけが新ポーズを持つ）
  const POSE_FALLBACK = { guard: ['hit', 'idle'], windup: ['attack', 'idle'], walk2: ['walk', 'idle'], win: ['idle'], ready: ['idle'], walk: ['idle'] };
  const DEV = { entries: {} };
  const ENEMY_MISSING = new Set();
  let loadStarted = false;
  const assetsPending = () => !loadStarted || Object.keys(IMGS_WANT).some(id => !IMGS[id] && !IMGS_FAILED[id]);
  function heroNorm(o) {
    const size = o.use === 'strip' ? 'S' : 'L', ok = POSES[size];
    return { job: o.job, costume: o.costume || null, pose: ok.includes(o.pose) ? o.pose : 'idle', size, use: o.use || 'self', look: o.look || { face: 0, hairStyle: 0, skin: '#f0c39a', hair: '#7a4a2a' }, weaponId: o.weaponId || null };
  }
  // 描き方の決定（描かずに調べる）：mode = layered | whole | wait | missing
  function planHero(o) {
    const h = heroNorm(o);
    const rec = (mode, extra) => { const key = h.job + '|' + (h.costume || '-') + '|' + h.pose + '|' + h.size; DEV.entries[key] = Object.assign({ key, mode, job: h.job, costume: h.costume, pose: h.pose, size: h.size, weapon: !!h.weaponId }, extra || {}); return Object.assign({ mode, h }, extra || {}); };
    if (PARTS.state === 'loading') return { mode: 'wait', h };
    let why = PARTS.state === 'ready' ? '' : '部品なし';
    if (PARTS.state === 'ready') {
      const J = PARTS.json, fk = h.look.face % 4, hk = h.look.hairStyle % 6;
      let b = pickKey(J.body, bodyKeys(h.job, h.costume, h.pose, h.size));
      if (!b) for (const fp of (POSE_FALLBACK[h.pose] || [])) { b = pickKey(J.body, bodyKeys(h.job, h.costume, fp, h.size)); if (b) { h.pose = fp; break; } }
      // 新比率の身体（body.heads === 'v2'）は専用の頭を使う（顔は戦士の確認段階では f0 のみ。表情は 攻撃/喜び を頭の差分で出す）
      const v2 = b && b.v.heads === 'v2', ex = h.pose === 'attack' ? '_attack' : h.pose === 'win' ? '_win' : '';
      const hn = v2 ? (h.size === 'S' ? ['head_v2_h' + hk + '_S'] : ['head_v2_f0_h' + hk + '_L' + ex, 'head_v2_f0_h' + hk + '_L']) : h.size === 'S' ? ['head_h' + hk + '_S'] : ['head_f' + fk + '_h' + hk + '_L_' + h.pose, 'head_f' + fk + '_h' + hk + '_L'], hd = pickKey(J.head, hn.concat(hn.map(n => n.replace(/^head_/, ''))));
      if (!b) why = '身体の部品なし（' + bodyKeys(h.job, h.costume, h.pose, h.size)[0] + '）'; else if (!hd) why = '頭の部品なし（' + hn[hn.length - 1] + '）';
      else {
        const bf = (b.key.startsWith('body_') ? stripPng(b.key) : 'body_' + stripPng(b.key)) + '.png', hf = (hd.key.startsWith('head_') ? stripPng(hd.key) : 'head_' + stripPng(hd.key)) + '.png', hand = b.v.hand ? String(b.v.hand) : null;
        const files = [bf, hf].concat(hand ? [hand] : []), st = files.map(partImg);
        if (st.includes('fail')) why = '部品の画像が読めない：' + files.filter((f, i) => st[i] === 'fail').join(',');
        else if (st.includes('pending')) return { mode: 'wait', h };
        else {
          let wi = null;
          if (h.weaponId) { wi = iconImgOf(h.weaponId); if (!wi) { if (assetsPending()) return { mode: 'wait', h }; why = '武器アイコンなし：' + h.weaponId; } }
          if (!h.weaponId || wi) {
            const wk = wi ? iconFileOf(h.weaponId) : null, we = wk && J.weapon && (J.weapon[wk] || J.weapon[stripPng(wk)]);
            let held = null;   // L は専用の手持ち絵（店アイコンを拡大した held_<id>_L.png）を優先
            if (we && we.held && h.size === 'L') { const hs = partImg(we.held); if (hs === 'pending') return { mode: 'wait', h }; if (hs !== 'fail') held = hs; }
            return rec('layered', { body: b, head: hd, bf, hf, hand, wi: held || wi, wk, held: !!held });
          }
        }
      }
    }
    const ks = wholeKeys(h.job, h.costume, h.pose, h.size), k = ks.find(x => IMGS[x]);
    if (!k) { if (assetsPending()) return { mode: 'wait', h }; return rec('missing', { reason: '1枚絵も無い：' + ks[0] }); }
    return rec('whole', { reason: why + (h.weaponId ? '／武器・顔・髪・色は反映されない' : '／顔・髪・色は反映されない'), wholeKey: k, substituted: k !== ks[0] });
  }
  function composite(plan) {
    const h = plan.h, ck = [h.job, h.costume, h.pose, h.size, h.look.face, h.look.hairStyle, h.look.skin, h.look.hair, h.weaponId].join('|');
    if (PARTS.cache[ck]) return PARTS.cache[ck];
    const J = PARTS.json, pal = J.palette || {}, pals = (file, kind) => { const t = pal[kind] || {}; return t[file] || t[stripPng(file)] || null; };
    const tint = (im, file) => {
      const sk = pals(file, 'skin'), hr = pals(file, 'hair'); if (!sk && !hr) return im;
      const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height), pairs = [];
      if (sk) buildRamp(h.look.skin, sk.length).forEach((t, i) => pairs.push([sk[i], t]));
      if (hr) buildRamp(h.look.hair, hr.length).forEach((t, i) => pairs.push([hr[i], t]));
      recolorData(d.data, pairs); g.putImageData(d, 0, 0); return c;
    };
    const bi = tint(PARTS.imgs[plan.bf].im, plan.bf), hi = tint(PARTS.imgs[plan.hf].im, plan.hf), b = plan.body.v, hd = plan.head.v;
    const items = [];   // 重ね順：身体→頭→武器→前の手
    items.push({ im: bi, x: 0, y: 0, w: bi.width, h: bi.height });
    const hx = Math.round((b.neck ? b.neck[0] : 0) - (hd.neck ? hd.neck[0] : 0)), hy = Math.round((b.neck ? b.neck[1] : 0) - (hd.neck ? hd.neck[1] : 0));
    items.push({ im: hi, x: hx, y: hy, w: hi.width, h: hi.height });
    if (plan.wi && b.grip) {
      const we = (J.weapon && (J.weapon[plan.wk] || J.weapon[stripPng(plan.wk)])) || null;
      items.push({ im: plan.wi, weapon: weaponPlacement(b, plan.held && we.heldGrip ? { grip: we.heldGrip, tipAngle: we.tipAngle } : we, plan.wi.width, plan.wi.height), w: plan.wi.width, h: plan.wi.height });
    }
    if (plan.hand) { const him = PARTS.imgs[plan.hand].im, at = (b.handPos || b.handAt || (b.grip ? [b.grip[0] - him.width / 2, b.grip[1] - him.height / 2] : [0, 0])).map(Math.round); items.push({ im: tint(him, plan.hand), x: at[0], y: at[1], w: him.width, h: him.height }); }
    let x0 = 0, y0 = 0, x1 = bi.width, y1 = bi.height;
    items.forEach(it => {
      let pts;
      if (it.weapon) { const W = it.weapon, a = W.angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); pts = [[0, 0], [it.w, 0], [0, it.h], [it.w, it.h]].map(([px, py]) => { const dx = (px - W.origin[0]) * W.scale, dy = (py - W.origin[1]) * W.scale; return [W.pivot[0] + dx * c - dy * s, W.pivot[1] + dx * s + dy * c]; }); }
      else pts = [[it.x, it.y], [it.x + it.w, it.y + it.h]];
      pts.forEach(([px, py]) => { x0 = Math.min(x0, Math.floor(px)); y0 = Math.min(y0, Math.floor(py)); x1 = Math.max(x1, Math.ceil(px)); y1 = Math.max(y1, Math.ceil(py)); });
    });
    const cv = document.createElement('canvas'); cv.width = x1 - x0; cv.height = y1 - y0; const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    items.forEach(it => {
      if (it.weapon) { const W = it.weapon; g.save(); g.translate(W.pivot[0] - x0, W.pivot[1] - y0); g.rotate(W.angle * Math.PI / 180); g.scale(W.scale, W.scale); g.drawImage(it.im, -W.origin[0], -W.origin[1]); g.restore(); }
      else g.drawImage(it.im, it.x - x0, it.y - y0);
    });
    const foot = b.foot || [Math.round(bi.width / 2), bi.height];
    return (PARTS.cache[ck] = { cv, fx: Math.round(foot[0]) - x0, fy: Math.round(foot[1]) - y0 });
  }
  const SIL = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function silhouette(src, color) {   // 暗い縁取り用の影絵
    let m = SIL && SIL.get(src); if (m && m[color]) return m[color];
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d');
    g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    if (SIL) { m = m || {}; m[color] = c; SIL.set(src, m); } return c;
  }
  function tinted(src, tint) { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.55; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); return c; }
  // 画像（またはcanvas）を、足元(fx,fy)＝(x,groundY) に置いて描く。1ドット＝scale canvas px（ctx の拡大率には依存しない）
  function put(ctx, src, fx, fy, x, groundY, scale, o) {
    const k = ctx.getTransform().a || 1, sc = (scale || 1) / k; ctx.imageSmoothingEnabled = false;
    const dx = x - fx * sc, dy = groundY - fy * sc, w = src.width * sc, h = src.height * sc;
    if (o && o.outline) { const s = silhouette(src, o.outline), e = 1 / k; [[-e, 0], [e, 0], [0, -e], [0, e]].forEach(([ox, oy]) => ctx.drawImage(s, dx + ox, dy + oy, w, h)); }
    ctx.drawImage(o && o.tint ? tinted(src, o.tint) : src, dx, dy, w, h);
  }
  // o: {look:{skin,hair,face,hairStyle}, job, costume:null|'master', weaponId, pose, use, x(足の中心), groundY(足元), scale, tint, outline, guard}
  // 戻り値：'layered' | 'whole' | 'wait'（読込中。読み終わると onUpdate で描き直される）| 'missing'
  function drawHeroLayered(ctx, o) {
    const p = planHero(o), sc = o.scale || 1;
    if (p.mode === 'wait') return 'wait';
    if (p.mode === 'layered') { const c = composite(p); put(ctx, c.cv, c.fx, c.fy, o.x, o.groundY, sc, o); }
    else if (p.mode === 'whole') { const im = IMGS[p.wholeKey]; put(ctx, im, im.width / 2, im.height, o.x, o.groundY, sc, o); }
    else return 'missing';
    if (o.guard) { const k = ctx.getTransform().a || 1; ctx.fillStyle = '#7fd3ff'; ctx.fillRect(o.x + 5 / k, o.groundY - 12 / k, 2 / k, 5 / k); }
    return p.mode;
  }
  function devReport() {
    const L = Object.values(DEV.entries), by = m => L.filter(e => e.mode === m);
    return { parts: PARTS.state, layered: by('layered').map(e => e.key), whole: by('whole').map(e => ({ key: e.key, reason: e.reason })), missing: by('missing').map(e => ({ key: e.key, reason: e.reason })), enemyMissing: Array.from(ENEMY_MISSING) };
  }
  // 12職×衣装×用途 の描き方を一覧にする（描かない）。検査・開発用
  function coverage(jobs, costumes, uses) {
    const out = []; (jobs || []).forEach(job => (costumes || [null]).forEach(costume => (uses || ['self', 'strip']).forEach(use => {
      const size = use === 'strip' ? 'S' : 'L'; POSES[size].forEach(pose => { const p = planHero({ job, costume, pose, use, weaponId: null }); out.push({ job, costume, pose, size, mode: p.mode, reason: p.reason || null }); });
    }))); return out;
  }
  function drawEnemy(ctx, id, boss, x, groundY, o) {
    o = o || {};
    const im = o.img && IMGS['enemy_' + id + (o.img === 'strip' ? '_strip' : '')];
    if (im) { put(ctx, im, im.width / 2, im.height, x + 7, groundY - (o.lift || 0), o.scale || 1, { tint: o.tint, outline: o.outline }); return; }
    if (o.img && !assetsPending()) ENEMY_MISSING.add(id);   // 正式な画像が無い敵：開発用検査に出す（下の仮絵は暫定）
    const rows = SHAPES[shapeOf(id)], y = groundY - rows.length - (o.lift || 0);
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
  root.RPGSprites = { drawHeroLayered, planHero, coverage, devReport, loadParts, noParts, onUpdate, buildRamp, recolorData, weaponPlacement, POSES, PAL, JOB_COLOR, SHAPES, shapeOf, drawEnemy, drawChest, drawBackground, px, REGION_COLOR, palForEnemy, IMGS, loadImages };
  if (typeof module === 'object' && module.exports) module.exports = root.RPGSprites;
})(typeof self !== 'undefined' ? self : this);
