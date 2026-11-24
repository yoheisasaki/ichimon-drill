/* 地図問題の描画部品。外部依存なし。
   renderMap(container, mapData, features, mapq, opts)
   mapData = map_chubu_kanto.json / features = features.json(配列) / mapq = 問題の map ({hl?, mark?})
   opts.aspect (幅/高さ、既定 1.7) opts.all=true で全地点を重ねる(確認用)
   view の決め方：hl の県の bbox（本土の最大の島）＋ mark の座標を含む箱を 1.6 倍し、aspect に合わせて広げる。
   hl が無い（形C）ときは mark を中心に、箱は最低でも幅 190 を確保。 */
(function (g) {
  var NS = 'http://www.w3.org/2000/svg';
  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function xy(pr, lo, la) { return [(lo - pr.lon0) * pr.kx, (pr.lat1 - la) * pr.ky]; }
  function geomPts(pr, f) {
    var gm = f.geom; if (gm.point) return [xy(pr, gm.point[0], gm.point[1])];
    return gm.line.map(function (p) { return xy(pr, p[0], p[1]); });
  }
  function view(mapData, pts, hl, aspect, zoom) {
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    function inc(x, y) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    (hl || []).forEach(function (n) { var b = mapData.bbox[n]; if (b) { inc(b[0], b[1]); inc(b[2], b[3]); } });
    pts.forEach(function (p) { inc(p[0], p[1]); });
    var w = x1 - x0, h = y1 - y0, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    var minW = hl && hl.length ? 60 : 190;
    w = Math.max(w * zoom, minW); h = h * zoom;
    if (w / h < aspect) w = h * aspect; else h = w / aspect;
    return [cx - w / 2, cy - h / 2, w, h];
  }
  function renderMap(container, mapData, features, mapq, opts) {
    opts = opts || {}; var aspect = opts.aspect || 1.7, pr = mapData.project;
    var byName = {}; features.forEach(function (f) { byName[f.name] = f; });
    var hl = mapq && mapq.hl ? [mapq.hl] : [];
    var marks = []; if (mapq && mapq.mark) marks = [byName[mapq.mark]];
    if (opts.all) marks = features;
    var pts = []; (mapq && mapq.mark ? [byName[mapq.mark]] : []).forEach(function (f) { if (f) pts = pts.concat(geomPts(pr, f)); });
    if (opts.all) pts = [];
    var v = view(mapData, pts, hl, aspect, 1.6);
    if (opts.all || opts.overview) v = [0, 0, mapData.viewBox[2], mapData.viewBox[3]];
    container.innerHTML = '';
    var svg = el('svg', { viewBox: v.join(' '), width: '100%', style: 'display:block;border-radius:16px;background:#dff0fb', role: 'img', 'aria-label': '地図' });
    el('rect', { x: v[0] - 1000, y: v[1] - 1000, width: v[2] + 2000, height: v[3] + 2000, fill: '#dff0fb' }, svg);
    var land = el('g', { fill: '#cfe8c0', stroke: '#6aa56a', 'stroke-width': 1.2, 'stroke-linejoin': 'round' }, svg);
    var hlPath = [];
    Object.keys(mapData.prefs).forEach(function (n) {
      var p = el('path', { d: mapData.prefs[n], 'vector-effect': 'non-scaling-stroke', 'fill-rule': 'evenodd' }, land);
      if (hl.indexOf(n) >= 0) hlPath.push(mapData.prefs[n]);
    });
    hlPath.forEach(function (d) {
      el('path', { d: d, fill: '#f0a830', stroke: '#111', 'stroke-width': 3, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, svg);
    });
    var sz = opts.all ? 2.2 : v[2] * 0.05;
    marks.forEach(function (f) {
      if (!f) return;
      var P = geomPts(pr, f);
      if (f.geom.line) {
        var d = 'M' + P.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L');
        var river = f.type === '川';
        var col = river ? '#1e6fe0' : '#8b5a2b', wd = opts.all ? 1.5 : (river ? 5 : 11);
        el('path', { d: d, fill: 'none', stroke: '#fff', 'stroke-width': wd + 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, svg);
        el('path', { d: d, fill: 'none', stroke: col, 'stroke-width': wd, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, svg);
      } else {
        var c = P[0], pts5 = [];
        for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? sz * 0.42 : sz; pts5.push((c[0] + r * Math.cos(a)).toFixed(2) + ',' + (c[1] + r * Math.sin(a)).toFixed(2)); }
        el('polygon', { points: pts5.join(' '), fill: '#e8312a', stroke: '#fff', 'stroke-width': 2.5, 'stroke-linejoin': 'round', 'vector-effect': 'non-scaling-stroke' }, svg);
        if (opts.all) { var t = el('text', { x: c[0] + sz * 0.8, y: c[1], 'font-size': 3.2, fill: '#222' }, svg); t.textContent = f.name; }
      }
    });
    container.appendChild(svg);
    return svg;
  }
  g.renderMap = renderMap;
})(typeof window !== 'undefined' ? window : this);
