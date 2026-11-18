'use strict';
// 技の効果：pixelfx（MIT。rpg/vendor/pixelfx）の動くドット絵エフェクトを、帯・報酬画面の canvas に描く。
// 読めない・失敗したときは呼び出し側が静止画 fx_*（RPGSprites.IMGS）→ コード描画の順に戻す。ここは「描ける時だけ描く」。
(function (root) {
  const BASE = 'rpg/vendor/pixelfx/src/';
  // 効果キー → pixelfx のモジュール、と、静止画への戻り先（still）
  const FX = {
    slash: ['fx/melee/sword-slash', 'slash'], double: ['fx/melee/double-slash', 'slash'], flurry: ['fx/melee/dagger-flurry', 'slash'],
    cleave: ['fx/melee/heavy-cleave', 'slash'], thrust: ['fx/melee/thrust', 'wind'], fire: ['fx/fire/fireball', 'fire'],
    ice: ['fx/ice/ice-lance', 'ice'], nova: ['fx/ice/frost-nova', 'ice'], zap: ['fx/lightning/zap-hit', 'thunder'],
    clap: ['fx/lightning/thunderclap', 'thunder'], heal: ['fx/holy/heal', 'heal'], shield: ['fx/holy/divine-shield', 'shield'],
    block: ['fx/impacts/shield-block', 'shield'], smite: ['fx/holy/smite', 'light'], pillar: ['fx/holy/holy-pillar', 'light'],
    crit: ['fx/impacts/crit-hit', 'blast'], smoke: ['fx/explosions/smoke-bomb', 'smoke'], star: ['fx/arcane/star-fall', 'star'],
    burst: ['fx/arcane/mana-burst', 'blast'], splash: ['fx/water/splash', 'water']
  };
  // どこに出すか：enemy＝敵に当てる／hero＝自分の足元／melee＝敵の手前から振る斬撃系
  const AT = { slash: 'melee', double: 'melee', flurry: 'melee', cleave: 'melee', thrust: 'melee', crit: 'enemy', heal: 'hero', shield: 'hero', block: 'hero' };
  // 職の色を使う（無属性の斬撃・突き・盾）。炎・氷・雷・水・光・回復は属性の色のまま
  const JOBPAL = { slash: 1, double: 1, flurry: 1, cleave: 1, thrust: 1, block: 1, crit: 1 };
  // 技ID → 効果キー（12職すべて。DECISIONS D-39 に同じ表）
  const SKILL = {
    w_strike: 'slash', w_shield: 'block', w_rock: 'crit', w_brave: 'cleave',
    m_fire: 'fire', m_ice: 'ice', m_thunder: 'zap', m_rain: 'star',
    p_heal: 'heal', p_arrow: 'thrust', p_barrier: 'shield', p_holy: 'pillar',
    t_twin: 'double', t_parry: 'slash', t_gap: 'thrust', t_gale: 'flurry',
    mk_fire: 'fire', mk_ice: 'ice', mk_thunder: 'zap', mk_release: 'burst', mk_dance: 'double', mk_rainbow: 'nova',
    pa_shield: 'shield', pa_sword: 'heal', pa_smite: 'crit', pa_wall: 'shield', pa_light: 'smite', pa_dawn: 'pillar',
    sh_copy: 'slash', sh_after: 'slash', sh_pinch: 'double', sh_pass: 'thrust', sh_three: 'flurry', sh_dance: 'crit',
    sa_spark: 'zap', sa_wind: 'heal', sa_elem: 'nova', sa_ward: 'shield', sa_flow: 'star', sa_harmony: 'pillar',
    ni_fire: 'fire', ni_water: 'splash', ni_thunder: 'zap', ni_smoke: 'smoke', ni_three: 'flurry', ni_secret: 'clap',
    ra_aim: 'thrust', ra_grace: 'heal', ra_stop: 'thrust', ra_wind: 'thrust', ra_star: 'star', ra_tree: 'pillar',
    sk_wing: 'slash', sk_guard: 'shield', sk_meteor: 'star', sk_blade: 'double', sk_slash: 'flurry', sk_dawn: 'pillar',
    ss_arrow: 'thrust', ss_ward: 'shield', ss_comet: 'star', ss_drop: 'heal', ss_night: 'star', ss_create: 'burst'
  };
  // 報酬画面で出す「職の大技」
  const BIG = { warrior: 'cleave', mage: 'star', priest: 'pillar', thief: 'flurry', magicknight: 'nova', paladin: 'pillar', shadow: 'crit', sage: 'pillar', ninja: 'clap', ranger: 'pillar', skyknight: 'pillar', starseer: 'burst' };

  function ramp(color) {   // 暗→明の6段
    const n = parseInt(String(color).slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const sh = f => '#' + [r, g, b].map(v => Math.round(v * f).toString(16).padStart(2, '0')).join('');
    const mixw = f => '#' + [r, g, b].map(v => Math.round(v + (255 - v) * f).toString(16).padStart(2, '0')).join('');
    return [sh(0.3), sh(0.55), sh(0.8), color, mixw(0.45), mixw(0.85)];
  }

  const S = { state: 'idle', core: null, mods: {}, failed: {}, promise: null };
  function load() {
    if (S.promise) return S.promise;
    if (typeof root.document === 'undefined') { S.state = 'failed'; return (S.promise = Promise.resolve(false)); }
    S.state = 'loading';
    const url = p => new URL(BASE + p + '.js', root.document.baseURI).href;
    S.promise = import(url('core/index')).then(core => {
      S.core = core;
      return Promise.all(Object.keys(FX).map(k => import(url(FX[k][0])).then(m => { S.mods[k] = m; }, () => { S.failed[k] = 1; })));
    }).then(() => { S.state = 'ready'; return true; }, () => { S.state = 'failed'; return false; });
    return S.promise;
  }
  function keyFor(skillId) { return SKILL[skillId] || null; }
  function ready(key) { return S.state === 'ready' && !!S.mods[key]; }
  function stillOf(key) { return FX[key] ? FX[key][1] : null; }

  // 1つの再生。opts: { job, jobColor, seed, light, cap（秒。超えたら終わらせる）, delay, hitstop:[秒,止める秒] }
  function spawn(key, opts) {
    opts = opts || {}; if (!ready(key)) return null;
    try {
      const m = S.mods[key], core = S.core, meta = m.meta, w = meta.size[0], h = meta.size[1], o = { seed: opts.seed || 7, light: opts.light == null ? 1 : opts.light };
      if (opts.jobColor && JOBPAL[key]) o.palette = ramp(opts.jobColor);
      const fx = core.createFx(m, o), frame = core.createFrame(w, h, -meta.origin[0], -meta.origin[1]);
      const cv = root.document.createElement('canvas'); cv.width = w; cv.height = h;
      const g = cv.getContext('2d'), img = g.createImageData(w, h);
      const inst = {
        key, at: AT[key] || 'enemy', t: 0, delay: opts.delay || 0, pause: 0, hsDone: !opts.hitstop, stopped: false, dirty: true, acc: 0, ox: meta.origin[0], oy: meta.origin[1], w, h, ms: 0, frames: 0,
        update(dt) {
          if (this.delay > 0) { this.delay -= dt; return; }
          if (this.pause > 0) { this.pause -= dt; return; }
          dt = Math.min(dt, 1 / 20); this.t += dt;
          if (!this.hsDone && this.t >= opts.hitstop[0]) { this.hsDone = true; this.pause = opts.hitstop[1]; }
          if (opts.cap && !this.stopped && this.t >= opts.cap) { this.stopped = true; fx.stop(); }
          fx.update(dt); this.acc += dt;
          if (this.acc >= 1 / 30 - 1e-6) { this.acc = 0; this.dirty = true; }   // 描き直しは毎秒30回まで
        },
        done() { return fx.done(); },
        started() { return this.delay <= 0; },
        // ctx の座標で、アンカー(ax,ay)に s 倍で描く
        blit(ctx, ax, ay, s, alpha) {
          if (this.delay > 0) return;
          if (this.dirty) {
            const t0 = root.performance ? root.performance.now() : 0;
            core.clearFrame(frame); fx.draw(frame); core.composite(frame, img.data, null, 1); g.putImageData(img, 0, 0); this.dirty = false;
            if (root.performance) { this.ms += root.performance.now() - t0; this.frames++; }
          }
          ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.imageSmoothingEnabled = true;
          ctx.drawImage(cv, ax - this.ox * s, ay - this.oy * s, w * s, h * s); ctx.restore();
        }
      };
      return inst;
    } catch (e) { S.failed[key] = 1; return null; }
  }
  root.RPGFX = { load, keyFor, ready, spawn, stillOf, SKILL, BIG, FX, AT, ramp, get state() { return S.state; }, _S: S };
  if (typeof module === 'object' && module.exports) module.exports = root.RPGFX;
})(typeof self !== 'undefined' ? self : this);
