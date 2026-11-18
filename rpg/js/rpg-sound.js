'use strict';
// 短いオリジナルの音（WebAudioで合成。外部素材なし）。初期はオフ。最初のユーザー操作のあとだけ鳴らせる。
// 音が使えなくても（AudioContextが無い・止められている）操作は変わらない。回答中の常時BGMは無し。
(function (root) {
  const RPG = root.RPG; if (!RPG) return;
  let ctx = null;
  // [周波数Hz, 長さ秒, 波形, 音量]。連続で鳴らす
  const SEQ = {
    correct: [[660, .07, 'square', .05], [880, .09, 'square', .05]],
    attack: [[240, .05, 'sawtooth', .05], [360, .07, 'sawtooth', .05]],
    skill: [[440, .06, 'triangle', .07], [660, .06, 'triangle', .07], [990, .10, 'triangle', .07]],
    hit: [[160, .12, 'square', .05]],
    reward: [[523, .09, 'square', .05], [659, .09, 'square', .05], [784, .09, 'square', .05], [1047, .18, 'square', .05]],
    level: [[392, .09, 'triangle', .07], [523, .09, 'triangle', .07], [659, .09, 'triangle', .07], [784, .09, 'triangle', .07], [1047, .22, 'triangle', .07]],
    chest: [[300, .05, 'square', .05], [450, .05, 'square', .05], [600, .05, 'square', .05], [900, .16, 'triangle', .07]],
    job: [[262, .1, 'triangle', .07], [330, .1, 'triangle', .07], [392, .1, 'triangle', .07], [523, .1, 'triangle', .07], [659, .1, 'triangle', .07], [784, .3, 'triangle', .07]]
  };
  const settings = () => (RPG.save && RPG.save.settings) || {};
  const Snd = {
    SEQ, log: [],
    enabled: () => !!(RPG.ok && settings().sound),
    // ユーザー操作の中で呼ぶ（スイッチをオンにしたとき・画面を触ったとき）
    unlock() {
      if (ctx || !Snd.enabled()) return;
      try { const AC = root.AudioContext || root.webkitAudioContext; if (AC) ctx = new AC(); } catch (e) { ctx = null; }
      if (ctx && ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch (e) {} }
    },
    play(name) {
      Snd.log.push(name); if (Snd.log.length > 50) Snd.log.shift();
      try {
        if (settings().vibrate && root.navigator && root.navigator.vibrate && (name === 'reward' || name === 'level' || name === 'hit')) root.navigator.vibrate(name === 'hit' ? 12 : 25);
        if (!Snd.enabled() || !ctx || !SEQ[name]) return;
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        let t = ctx.currentTime + 0.01;
        SEQ[name].forEach(n => {
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = n[2]; o.frequency.value = n[0]; g.gain.setValueAtTime(n[3], t); g.gain.exponentialRampToValueAtTime(0.0001, t + n[1]);
          o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + n[1] + 0.02); t += n[1];
        });
      } catch (e) { /* 音が出なくても続ける */ }
    }
  };
  RPG.sound = Snd;
  ['pointerdown', 'touchend', 'keydown'].forEach(ev => { try { root.addEventListener(ev, () => Snd.unlock(), { passive: true }); } catch (e) {} });
})(typeof self !== 'undefined' ? self : this);
