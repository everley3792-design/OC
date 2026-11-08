/* OC Shimeji 11.0 — animation library (OC.Anim11): data-driven, procedural 2D rig actions.
 *
 * Every action is a handful of keyframe tracks over the rig's parameters (arms, ears, tail, lean, lift, squash, head offset/tilt,
 * legs, look, blush) plus step tracks for face (eyes / mouth / brows) and overlay flags (hearts, sweat…). Tracks are smooth (cosine
 * eased) between keys; loops wrap, one-shots hold their last pose. Personality scales amplitude and tempo (see render.js motion()).
 * Players can still replace any of these with their own frames — each action registers a fallback chain in OC.Chars.ACTIONS.
 *
 *   OC.Anim11.apply(action, at, s, m, b)   fills rig state s (called from CharRender.rigState)
 *   OC.Anim11.has(action) · OC.Anim11.LIB · OC.Anim11.touchLayer(s, touch, T, m, b) · OC.Anim11.layer(...)
 */
(function () {
  'use strict';
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  /** "0:-0.3 .3:-2.2 1:-0.3" → [[0,-0.3],[0.3,-2.2],[1,-0.3]] ; a trailing ~ on the number means "linear from here" */
  const P = (str) => String(str).trim().split(/\s+/).map((k) => { const [t, v] = k.split(':'); return [parseFloat(t), isNaN(+v) ? v : +v]; });
  function num(tr, T) {
    if (T <= tr[0][0]) return tr[0][1]; const n = tr.length;
    if (T >= tr[n - 1][0]) return tr[n - 1][1];
    let i = 1; while (i < n - 1 && tr[i][0] < T) i++;
    const a = tr[i - 1], b = tr[i], q = (T - a[0]) / Math.max(1e-6, b[0] - a[0]), e = 0.5 - Math.cos(q * Math.PI) / 2;
    return a[1] + (b[1] - a[1]) * e;
  }
  function step(tr, T) { let v = tr[0][1]; for (const k of tr) { if (k[0] <= T) v = k[1]; else break; } return v; }

  const LIB = {};
  const NUMS = ['armL', 'armR', 'ear', 'earL', 'earR', 'tail', 'lean', 'lift', 'squash', 'headDy', 'headDx', 'tilt', 'legL', 'legR', 'lookX', 'lookY', 'blush', 'shiftX'];
  const STEPS = ['eyes', 'mouth', 'brows'];
  /** def(name, zh, loop?, dur, {track strings}, 'fx flags', ['fallback chain']) */
  function def(name, zh, loop, dur, tracks, fx, fb) {
    const d = { name, zh, loop, dur, num: {}, step: {}, fx: fx ? fx.split(/\s+/) : [], fb: fb || ['idle'] };
    for (const k of Object.keys(tracks)) { if (NUMS.includes(k)) d.num[k] = P(tracks[k]); else if (STEPS.includes(k)) d.step[k] = P(tracks[k]); }
    LIB[name] = d; return d;
  }
  // ---------------------------------------------------------------- solo expressions & gestures
  def('wave', '揮手', 1, 1.4, { armR: '0:-1.2 .15:-2.3 .3:-1.9 .45:-2.4 .6:-1.9 .75:-2.4 1.05:-2.3 1.4:-1.2', tail: '0:0 .35:.3 .7:-.3 1.05:.3 1.4:0', eyes: '0:happy', mouth: '0:smile', ear: '0:-.08' }, '', ['greet', 'happy', 'idle']);
  def('bow', '鞠躬', 0, 1.3, { lean: '0:0 .35:.34 .8:.34 1.3:0', headDy: '0:0 .35:2.5 .8:2.5 1.3:0', armL: '0:.2 .35:.5 1.3:.2', armR: '0:.2 .35:.5 1.3:.2', eyes: '0:line', mouth: '0:smile', ear: '0:.2 .5:.4 1.3:.1' }, '', ['greet', 'idle']);
  def('clap', '拍手', 1, 0.6, { armL: '0:-1.0 .15:-.55 .3:-1.0 .45:-.55 .6:-1.0', armR: '0:-1.0 .15:-.55 .3:-1.0 .45:-.55 .6:-1.0', lift: '0:0 .15:1.4 .3:0 .45:1.4 .6:0', eyes: '0:happy', mouth: '0:open', tail: '0:.2 .3:-.2 .6:.2' }, '', ['cheer', 'happy', 'idle']);
  def('giggle', '偷笑', 1, 0.7, { headDy: '0:0 .1:.8 .2:0 .3:.8 .4:0 .7:0', tilt: '0:.05 .35:-.05 .7:.05', armL: '0:-.5', armR: '0:-.5', blush: '0:.9', eyes: '0:happy', mouth: '0:smile', lean: '0:0 .1:.03 .2:-.03 .3:.03 .4:0' }, '', ['laugh', 'happy', 'idle']);
  def('pout', '鼓嘴賭氣', 1, 2.4, { lean: '0:0 1.2:-.03 2.4:0', headDy: '0:.6', armL: '0:.4', armR: '0:.4', ear: '0:.3', tail: '0:-.1 1.2:-.25 2.4:-.1', lookX: '0:1 1.2:1 1.3:-1 2.4:-1', eyes: '0:line', brows: '0:angry', mouth: '0:flat' }, '', ['angry', 'idle']);
  def('stomp', '跺腳', 1, 0.7, { legL: '0:0 .1:3 .25:0 .7:0', legR: '0:0 .35:0 .45:3 .6:0 .7:0', lift: '0:0 .1:.6 .25:0 .45:.6 .6:0', squash: '0:1 .25:.94 .35:1 .6:.94 .7:1', armL: '0:.5', armR: '0:.5', brows: '0:angry', mouth: '0:frown', eyes: '0:line', ear: '0:-.3', tail: '0:.25 .35:-.25 .7:.25' }, 'anger', ['angry', 'idle']);
  def('shiver', '發抖', 1, 0.4, { lean: '0:.03 .1:-.03 .2:.03 .3:-.03 .4:.03', armL: '0:.1', armR: '0:.1', squash: '0:.96', ear: '0:.4', tail: '0:-.2', eyes: '0:line', mouth: '0:wave' }, '', ['sad', 'idle']);
  def('sneeze', '打噴嚏', 0, 1.6, { headDy: '0:0 .5:-1.2 .75:-1.5 .85:3 1.1:2 1.6:0', lean: '0:0 .5:-.1 .85:.14 1.2:.03 1.6:0', squash: '0:1 .5:1.06 .85:.9 1.1:1 1.6:1', eyes: '0:round .55:line 1.2:round', mouth: '0:o .5:open .85:o 1.3:flat', armR: '0:-.3 .6:-.9 .9:-.2 1.6:-.2', ear: '0:0 .5:-.25 .85:.45 1.6:0' }, 'puff', ['surprised', 'idle']);
  def('hiccup', '打嗝', 1, 1.8, { lift: '0:0 .5:0 .58:2.8 .72:0 1.8:0', squash: '0:1 .5:1 .56:.93 .66:1.05 .8:1 1.8:1', ear: '0:0 .55:-.2 .8:0', eyes: '0:round .55:wide .8:round', mouth: '0:flat .55:o .8:flat', armL: '0:-.3 .56:-.8 .9:-.3', armR: '0:-.3 .56:-.8 .9:-.3' }, '', ['surprised', 'idle']);
  def('dizzy', '頭暈', 1, 2.2, { lean: '0:.1 .55:0 1.1:-.1 1.65:0 2.2:.1', tilt: '0:.14 1.1:-.14 2.2:.14', lookX: '0:1 .55:0 1.1:-1 1.65:0 2.2:1', armL: '0:.4 1.1:-.4 2.2:.4', armR: '0:-.4 1.1:.4 2.2:-.4', eyes: '0:wide', mouth: '0:wave', headDy: '0:.5' }, 'spiral', ['hurt', 'surprised', 'idle']);
  def('sulk', '蹲著畫圈圈', 1, 2.0, { squash: '0:.82', lift: '0:-4', lean: '0:.12', headDy: '0:2', armR: '0:-.7 .3:-.55 .6:-.8 .9:-.55 1.2:-.8 2:-.7', armL: '0:.2', ear: '0:.55', tail: '0:-.3', eyes: '0:line', mouth: '0:frown', brows: '0:worry', lookY: '0:1' }, 'gloom', ['sad', 'sit', 'idle']);
  def('sigh', '嘆氣', 0, 2.0, { headDy: '0:0 .6:-.8 1.2:2.2 2:0', squash: '0:1 .6:1.03 1.2:.95 2:1', armL: '0:.15 1.2:.35', armR: '0:.15 1.2:.35', ear: '0:0 1.2:.4 2:.15', eyes: '0:line', mouth: '0:o .6:o 1.4:flat', lookY: '0:0 1.2:.7', tail: '0:0 1.2:-.25 2:-.1' }, 'puff', ['sad', 'idle']);
  def('aha', '靈光一閃', 0, 1.4, { lift: '0:0 .15:-.6 .3:3.5 .55:0 1.4:0', squash: '0:1 .15:.92 .3:1.08 .55:.95 .7:1', armR: '0:-.3 .2:-2.3 1.4:-2.2', ear: '0:0 .3:-.4 1.4:-.3', eyes: '0:round .3:wide 1:happy', mouth: '0:o .3:open 1:smile', lookY: '0:-.4' }, 'bulb', ['surprised', 'cheer', 'idle']);
  def('shrug', '聳肩', 0, 1.5, { armL: '0:.2 .3:-.6 1:-.6 1.5:.2', armR: '0:.2 .3:-.6 1:-.6 1.5:.2', headDy: '0:0 .3:-.9 1:-.9 1.5:0', tilt: '0:0 .3:.1 1:.1 1.5:0', lift: '0:0 .3:1 1:1 1.5:0', eyes: '0:line', mouth: '0:flat', ear: '0:.1 .4:.35 1:.35 1.5:.1' }, '', ['think', 'idle']);
  def('point', '指向', 0, 1.2, { armR: '0:.2 .2:-1.7 1.0:-1.7 1.2:.2', lean: '0:0 .2:.05 1.0:.05 1.2:0', lookX: '0:0 .2:1 1.0:1 1.2:0', eyes: '0:round', mouth: '0:o', ear: '0:-.15' }, '', ['talk', 'idle']);
  def('salute', '敬禮', 0, 1.2, { armR: '0:.2 .15:-2.5 .9:-2.5 1.2:.2', lift: '0:0 .15:1.2 .9:1.2 1.2:0', eyes: '0:happy', mouth: '0:smile', ear: '0:-.15', headDy: '0:0 .15:-.5 .9:-.5 1.2:0' }, '', ['proud', 'greet', 'idle']);
  def('flex', '秀肌肉', 1, 1.6, { armL: '0:-1.7 .4:-2.1 .8:-1.7 1.2:-2.1 1.6:-1.7', armR: '0:-1.7 .4:-2.1 .8:-1.7 1.2:-2.1 1.6:-1.7', lift: '0:0 .4:.8 .8:0 1.2:.8 1.6:0', squash: '0:1 .4:1.04 .8:1 1.2:1.04', brows: '0:angry', mouth: '0:grin', eyes: '0:happy', tail: '0:.2 .8:-.2 1.6:.2' }, 'sparkle', ['proud', 'cheer', 'idle']);
  def('wiggle', '扭扭', 1, 0.8, { lean: '0:.1 .2:-.1 .4:.1 .6:-.1 .8:.1', shiftX: '0:1 .2:-1 .4:1 .6:-1 .8:1', tail: '0:.4 .2:-.4 .4:.4 .6:-.4 .8:.4', armL: '0:-.5 .4:-1 .8:-.5', armR: '0:-1 .4:-.5 .8:-1', eyes: '0:happy', mouth: '0:open', ear: '0:-.1' }, '', ['dance', 'happy', 'idle']);
  def('spin', '轉圈圈', 0, 1.1, { lift: '0:0 .2:-.4 .35:4 .8:4 .95:0 1.1:0', squash: '0:1 .2:.93 .35:1.06 .95:.94 1.1:1', lean: '0:0 .3:.4 .8:-.4 1.1:0', armL: '0:.3 .35:-1.7 .8:-1.7 1.1:.3', armR: '0:.3 .35:-1.7 .8:-1.7 1.1:.3', eyes: '0:happy', mouth: '0:open', tail: '0:0 .5:.8 1.1:0' }, 'sparkle', ['jump', 'happy', 'idle']);
  def('flip', '翻跟斗', 0, 1.0, { lift: '0:0 .15:-.6 .25:3 .55:7 .8:3 .92:0 1.0:0', lean: '0:0 .2:0 .8:6.28 1.0:6.28', squash: '0:1 .15:.9 .3:1.08 .9:.92 1.0:1', armL: '0:.2 .25:-1.5 .8:-1.5 1.0:.2', armR: '0:.2 .25:-1.5 .8:-1.5 1.0:.2', eyes: '0:happy', mouth: '0:open' }, 'sparkle', ['jump', 'cheer', 'idle']);
  def('tiptoe', '躡手躡腳', 1, 0.9, { legL: '0:0 .22:2.2 .45:0', legR: '0:0 .45:0 .67:2.2 .9:0', lift: '0:1.4 .45:.9 .9:1.4', lean: '0:.1', armL: '0:-.5', armR: '0:-.5', headDy: '0:.5', eyes: '0:round', mouth: '0:flat', ear: '0:-.2', lookX: '0:0 .45:1 .9:0', tail: '0:.1' }, '', ['walk', 'idle']);
  def('stargaze', '看星星', 1, 6.0, { lookY: '0:-1', headDy: '0:-1', tilt: '0:-.06 3:.06 6:-.06', lean: '0:-.05', armL: '0:.2', armR: '0:.2', eyes: '0:round', mouth: '0:smile', ear: '0:-.1', tail: '0:.15 3:-.15 6:.15' }, 'sparkle', ['think', 'sit', 'idle']);
  def('nap', '打盹', 1, 3.2, { headDy: '0:.5 .8:2.6 1.0:1 1.8:.3 2.2:2.6 2.5:.9 3.2:.5', lean: '0:.02 1.6:-.02 3.2:.02', squash: '0:.9', lift: '0:-3', eyes: '0:sleepy', mouth: '0:cat', ear: '0:.3 1.6:.4 3.2:.3', tail: '0:-.1' }, 'zzz', ['sleep', 'sit', 'idle']);
  def('daydream', '發呆', 1, 4.0, { lookY: '0:-.5', lookX: '0:0 1:.8 2:.8 3:-.6 4:0', tilt: '0:0 2:.08 4:0', headDy: '0:-.3', eyes: '0:round', mouth: '0:o .5:flat 2:flat 3:o', ear: '0:0 2:.1 4:0', tail: '0:.05' }, 'thought', ['think', 'idle']);
  def('tailchase', '追尾巴', 1, 1.4, { lean: '0:0 .7:.8 1.4:0', shiftX: '0:0 .35:1 .7:0 1.05:-1 1.4:0', tail: '0:.8 .35:-.8 .7:.8 1.05:-.8 1.4:.8', headDx: '0:0 .35:1.4 .7:0 1.05:-1.4 1.4:0', lookX: '0:1 .7:-1 1.4:1', eyes: '0:round', mouth: '0:open', lift: '0:0 .35:.8 .7:0 1.05:.8 1.4:0' }, '', ['play', 'happy', 'idle']);
  def('roll', '打滾', 1, 1.6, { lean: '0:0 .4:1.57 .8:3.14 1.2:4.71 1.6:6.28', squash: '0:.9', lift: '0:-3', shiftX: '0:0 .8:1 1.6:0', armL: '0:-1.4 .8:-.2 1.6:-1.4', armR: '0:-1.4 .8:-.2 1.6:-1.4', legL: '0:2 .8:0 1.6:2', legR: '0:0 .8:2 1.6:0', eyes: '0:happy', mouth: '0:open', tail: '0:.4 .8:-.4 1.6:.4' }, '', ['play', 'happy', 'idle']);
  def('lie', '躺平', 1, 4.0, { lean: '0:1.45', squash: '0:.82', lift: '0:-5', headDy: '0:1', armL: '0:-.3 2:-.5 4:-.3', armR: '0:-.3 2:-.5 4:-.3', eyes: '0:line', mouth: '0:smile', ear: '0:.3', tail: '0:-.15 2:.1 4:-.15', lookY: '0:-.6' }, '', ['sleep', 'sit', 'idle']);
  def('hide', '躲起來', 1, 1.6, { squash: '0:.78', lift: '0:-4', lean: '0:.15', armL: '0:-1.7', armR: '0:-1.7', headDy: '0:1.5', ear: '0:.45 .8:.55 1.6:.45', eyes: '0:round', mouth: '0:flat', tail: '0:-.25', blush: '0:.4', lookX: '0:0 .8:1 1.6:0' }, '', ['shy', 'peek', 'idle']);
  def('knock', '敲門', 1, 1.2, { armR: '0:-1.0 .12:-1.35 .24:-1.0 .5:-1.0 .62:-1.35 .74:-1.0 1.2:-1.0', lean: '0:.05', headDy: '0:.3', mouth: '0:smile', eyes: '0:round', ear: '0:-.1' }, '', ['talk', 'idle']);
  def('wish', '許願', 1, 3.0, { armL: '0:-1.0', armR: '0:-1.0', headDy: '0:1.2', lift: '0:.4 1.5:.9 3:.4', eyes: '0:line', mouth: '0:smile', ear: '0:.05', tail: '0:.1', blush: '0:.3' }, 'sparkle', ['think', 'idle']);
  def('peace', '比YA', 1, 2.0, { armR: '0:-2.0 1:-2.15 2:-2.0', tilt: '0:.1', blush: '0:.5', eyes: '0:happy', mouth: '0:open', lift: '0:.6 1:1.2 2:.6', ear: '0:-.12', tail: '0:.25 1:-.25 2:.25' }, 'sparkle', ['cheer', 'happy', 'idle']);
  def('photo', '擺拍', 1, 3.0, { armL: '0:-1.9 1.5:-1.4 3:-1.9', armR: '0:-.7 1.5:-1.1 3:-.7', tilt: '0:-.12 1.5:.12 3:-.12', lean: '0:.04 1.5:-.04', eyes: '0:happy', mouth: '0:open', blush: '0:.5', ear: '0:-.1', tail: '0:.2' }, 'sparkle', ['peace', 'happy', 'idle']);
  def('blow', '吹泡泡', 1, 2.4, { headDy: '0:.3 .6:-.8 1.2:.2 2.4:.3', mouth: '0:o', eyes: '0:round .6:line 1.4:round', ear: '0:0 .6:-.15', armL: '0:-.6', armR: '0:-.9', lookY: '0:-.3' }, 'bubbles', ['talk', 'idle']);
  def('sip', '啜飲', 1, 3.0, { armR: '0:-.5 .5:-1.45 1.4:-1.45 2.2:-.5 3:-.5', lookY: '0:0 .5:-.2 1.4:-.3 2.2:.2', headDy: '0:0 .8:-.4 1.4:-.4 2.2:0', eyes: '0:round 1.0:line 1.6:happy 2.4:round', mouth: '0:smile 1:o 1.6:smile', ear: '0:0 1.6:-.1 2.4:0' }, 'cup', ['drink', 'idle']);
  def('write', '寫字', 1, 2.0, { armR: '0:-.7 .2:-.55 .4:-.75 .6:-.55 .8:-.75 1:-.6 1.4:-.7 2:-.7', headDy: '0:1.6', lookY: '0:1', eyes: '0:round', mouth: '0:flat', tilt: '0:.04 1:-.02 2:.04', squash: '0:.92', lift: '0:-2', ear: '0:.1' }, 'sketch', ['sketch', 'study', 'idle']);
  def('drum', '打鼓', 1, 0.8, { armL: '0:-.9 .1:-1.4 .2:-.9 .4:-.9 .5:-1.4 .6:-.9', armR: '0:-1.4 .1:-.9 .3:-.9 .4:-1.4 .5:-.9 .8:-1.4', lift: '0:0 .1:.8 .2:0 .4:.8 .5:0', headDy: '0:0 .1:.5 .2:0 .4:.5', eyes: '0:happy', mouth: '0:open', tail: '0:.3 .4:-.3 .8:.3', lean: '0:.04 .4:-.04 .8:.04' }, 'notes', ['dance', 'sing', 'happy', 'idle']);
  def('conduct', '指揮', 1, 2.0, { armR: '0:-1.5 .5:-2.0 1:-1.5 1.5:-1.1 2:-1.5', armL: '0:-.6 1:-1.0 2:-.6', lean: '0:.05 1:-.05 2:.05', eyes: '0:happy', mouth: '0:smile', ear: '0:-.1', tail: '0:.2 1:-.2 2:.2', lift: '0:.4 1:.9 2:.4' }, 'notes', ['sing', 'happy', 'idle']);
  def('march', '踏步', 1, 0.8, { legL: '0:0 .2:2.4 .4:0', legR: '0:0 .4:0 .6:2.4 .8:0', armL: '0:-.6 .4:.6 .8:-.6', armR: '0:.6 .4:-.6 .8:.6', lift: '0:0 .2:.8 .4:0 .6:.8 .8:0', eyes: '0:happy', mouth: '0:open', headDy: '0:-.3' }, '', ['walk', 'happy', 'idle']);
  def('skip', '蹦蹦跳跳', 1, 0.7, { lift: '0:0 .17:3 .35:0 .52:3 .7:0', squash: '0:.94 .1:1.06 .35:.94 .45:1.06 .7:.94', armL: '0:-.4 .35:-1.4 .7:-.4', armR: '0:-1.4 .35:-.4 .7:-1.4', eyes: '0:happy', mouth: '0:open', ear: '0:-.2 .17:-.35 .35:-.2', tail: '0:.2 .35:.5 .7:.2' }, '', ['run', 'happy', 'idle']);
  def('swish', '甩甩手', 1, 1.0, { armL: '0:.2 .25:-.7 .5:.2 .75:-.7 1:.2', armR: '0:-.7 .25:.2 .5:-.7 .75:.2 1:-.7', lean: '0:.05 .5:-.05 1:.05', eyes: '0:happy', mouth: '0:smile' }, '', ['idle']);
  // ---------------------------------------------------------------- reactions to touch (single OC, finger on it)
  def('ticklish', '怕癢', 1, 0.5, { lean: '0:.1 .12:-.1 .25:.1 .37:-.1 .5:.1', shiftX: '0:.8 .12:-.8 .25:.8 .37:-.8 .5:.8', armL: '0:-1.2 .25:-.4 .5:-1.2', armR: '0:-.4 .25:-1.2 .5:-.4', legL: '0:0 .12:1.6 .25:0', legR: '0:1.6 .12:0 .25:1.6', eyes: '0:line', mouth: '0:open', blush: '0:.9', tail: '0:.5 .25:-.5 .5:.5', ear: '0:.1', headDy: '0:.4 .25:.9 .5:.4' }, 'sweat', ['laugh', 'happy', 'idle']);
  def('melt', '被摸到融化', 1, 3.0, { squash: '0:.88 1.5:.84 3:.88', lift: '0:-2.5', lean: '0:.04 1.5:-.04 3:.04', headDy: '0:1.4 1.5:2 3:1.4', tilt: '0:.1 1.5:.15 3:.1', armL: '0:.3', armR: '0:.3', eyes: '0:line', mouth: '0:smile', blush: '0:1', ear: '0:.4', tail: '0:.1 1.5:.4 3:.1' }, 'heart', ['pet', 'happy', 'idle']);
  def('nuzzle', '蹭蹭', 1, 1.2, { headDx: '0:0 .3:1.4 .6:-1 .9:1.2 1.2:0', tilt: '0:.12 .6:-.12 1.2:.12', lean: '0:.05 .6:-.05 1.2:.05', eyes: '0:line', mouth: '0:smile', blush: '0:.9', ear: '0:.3', tail: '0:.4 .6:-.4 1.2:.4', armL: '0:-.3', armR: '0:-.3' }, 'heart', ['pet', 'happy', 'idle']);
  def('startle', '嚇一跳', 0, 0.9, { lift: '0:0 .08:5.5 .35:0 .5:0', squash: '0:1 .05:.9 .1:1.1 .35:.92 .5:1', armL: '0:.2 .1:-1.7 .6:-1.2 .9:.2', armR: '0:.2 .1:-1.7 .6:-1.2 .9:.2', ear: '0:0 .1:-.45 .9:0', eyes: '0:wide', mouth: '0:o', tail: '0:0 .1:.6 .9:0' }, 'shock', ['surprised', 'idle']);
  def('lookup', '抬頭看著你', 1, 3.0, { lookY: '0:-1', headDy: '0:-1', tilt: '0:.05 1.5:-.05 3:.05', ear: '0:-.1', eyes: '0:round', mouth: '0:smile', blush: '0:.4', tail: '0:.2 1.5:.4 3:.2', armL: '0:.1', armR: '0:.1' }, '', ['happy', 'idle']);
  def('turnaway', '別過頭去', 0, 1.6, { lean: '0:0 .3:-.06 1.6:-.06', lookX: '0:0 .3:-1 1.6:-1', tilt: '0:0 .3:-.1 1.6:-.1', ear: '0:.2 .3:.3 1.6:.3', eyes: '0:line', mouth: '0:flat', armL: '0:.3', armR: '0:.3', blush: '0:.5', tail: '0:-.2' }, '', ['shy', 'angry', 'idle']);
  def('poked', '被戳', 0, 0.8, { squash: '0:1 .08:.82 .22:1.08 .5:.97 .8:1', lean: '0:0 .08:-.08 .3:.04 .8:0', ear: '0:0 .1:-.4 .8:0', eyes: '0:wide .3:round', mouth: '0:o .4:smile', headDy: '0:0 .08:1.4 .3:-.4 .8:0', blush: '0:.5', tail: '0:0 .1:.5 .5:-.2 .8:0' }, 'shock', ['surprised', 'idle']);
  def('hugme', '張開手臂', 1, 2.0, { armL: '0:-1.7 1:-1.85 2:-1.7', armR: '0:-1.7 1:-1.85 2:-1.7', lift: '0:.5 1:1 2:.5', eyes: '0:happy', mouth: '0:open', blush: '0:.4', ear: '0:-.15', tail: '0:.3 1:-.3 2:.3', lookY: '0:-.2' }, '', ['happy', 'cheer', 'idle']);
  def('hug', '抱抱', 1, 2.4, { armL: '0:-1.7 .35:-.9 .6:-.55 2.4:-.55', armR: '0:-1.7 .35:-.9 .6:-.55 2.4:-.55', squash: '0:1 .35:.94 .6:.9 2.4:.9', lean: '0:0 .5:.05', headDy: '0:0 .5:1.2', tilt: '0:0 .5:.12', eyes: '0:happy', mouth: '0:smile', blush: '0:1', ear: '0:.3', tail: '0:.4 1.2:-.2 2.4:.4' }, 'heart', ['hugme', 'happy', 'idle']);
  def('highfive', '擊掌', 0, 1.0, { armR: '0:.2 .22:-2.4 .42:-2.4 .52:-2.0 1:.2', lift: '0:0 .2:1.5 .5:0', lean: '0:0 .25:.08 .45:-.04 1:0', eyes: '0:happy', mouth: '0:open', ear: '0:-.2', tail: '0:.2 .45:.6 1:.2' }, 'sparkle', ['cheer', 'wave', 'happy', 'idle']);
  def('handhold', '牽手', 1, 2.0, { armR: '0:-.3 1:-.4 2:-.3', armL: '0:-.35', shiftX: '0:0', lean: '0:-.03', eyes: '0:happy', mouth: '0:smile', blush: '0:.6', tail: '0:.2 1:-.2 2:.2', ear: '0:-.05' }, '', ['walk', 'happy', 'idle']);
  // ---------------------------------------------------------------- paired social gestures (A = the one who starts, B = the other; same shape, different roles)
  def('pat', '拍拍頭', 1, 1.2, { armR: '0:-1.2 .2:-1.5 .4:-1.2 .6:-1.5 .8:-1.2 1.2:-1.2', lean: '0:.06', eyes: '0:happy', mouth: '0:smile', ear: '0:-.1' }, '', ['happy', 'idle']);
  def('patted', '被拍拍頭', 1, 1.2, { headDy: '0:.8 .2:1.4 .4:.8 .6:1.4 .8:.8', squash: '0:.96 .2:.93 .4:.96 .6:.93', eyes: '0:line', mouth: '0:smile', blush: '0:.9', ear: '0:.3', tail: '0:.3 .6:-.3 1.2:.3' }, 'heart', ['pet', 'happy', 'idle']);
  def('whisper', '悄悄話', 1, 1.6, { lean: '0:.12', headDx: '0:1', armR: '0:-1.3', mouth: '0:o .4:flat .8:o 1.2:flat', eyes: '0:round', ear: '0:-.1', tilt: '0:.1' }, '', ['talk', 'idle']);
  def('listen', '側耳傾聽', 1, 1.6, { lean: '0:-.04', tilt: '0:-.14', ear: '0:-.3', lookX: '0:1', eyes: '0:round', mouth: '0:smile', blush: '0:.4', headDy: '0:.2' }, '', ['idle']);
  def('feedbite', '餵食', 1, 2.0, { armR: '0:-1.2 .5:-1.45 1:-1.2 1.5:-1.45 2:-1.2', lean: '0:.05', eyes: '0:happy', mouth: '0:smile', blush: '0:.4', ear: '0:-.1' }, '', ['happy', 'idle']);
  def('bitefed', '張嘴吃', 1, 2.0, { headDy: '0:0 .5:.8 1:0 1.5:.8 2:0', mouth: '0:open .5:chew 1:open 1.5:chew', eyes: '0:happy', blush: '0:.8', ear: '0:.05', tail: '0:.4 1:-.4 2:.4', squash: '0:1 .5:.97 1:1 1.5:.97' }, 'heart', ['eat', 'happy', 'idle']);
  def('lean_on', '靠肩膀', 1, 3.0, { lean: '0:.1 1.5:.13 3:.1', tilt: '0:.2 1.5:.24 3:.2', headDy: '0:1', squash: '0:.95', eyes: '0:line', mouth: '0:smile', blush: '0:.8', ear: '0:.3', tail: '0:.15', armL: '0:.2', armR: '0:.2' }, 'heart', ['sit', 'melt', 'idle']);
  def('shoulder', '借肩膀', 1, 3.0, { lean: '0:-.02 1.5:.02 3:-.02', eyes: '0:happy', mouth: '0:smile', blush: '0:.3', ear: '0:-.05', tail: '0:.1', armL: '0:.2', armR: '0:.2', headDy: '0:-.3' }, '', ['sit', 'idle']);
  def('comfort', '拍背安慰', 1, 1.6, { armR: '0:-.9 .4:-1.15 .8:-.9 1.2:-1.15 1.6:-.9', lean: '0:.07', eyes: '0:round', mouth: '0:smile', brows: '0:worry', ear: '0:.2', tail: '0:-.1' }, '', ['pat', 'idle']);
  def('comforted', '被安慰', 1, 2.4, { headDy: '0:1.6 1.2:1.2 2.4:1.6', lean: '0:.03', eyes: '0:line', mouth: '0:wave 1.2:smile', armL: '0:.25', armR: '0:.25', ear: '0:.45 1.2:.3', tail: '0:-.2', brows: '0:worry' }, 'tear', ['sad', 'cry', 'idle']);
  def('tickle', '搔癢', 1, 0.5, { armL: '0:-.9 .12:-1.2 .25:-.9 .37:-1.2 .5:-.9', armR: '0:-1.2 .12:-.9 .25:-1.2 .37:-.9 .5:-1.2', lean: '0:.08', eyes: '0:happy', mouth: '0:open', ear: '0:-.15' }, '', ['happy', 'idle']);
  def('argue', '爭論', 1, 1.2, { armL: '0:-1.3 .3:-.7 .6:-1.5 .9:-.7 1.2:-1.3', armR: '0:-.7 .3:-1.5 .6:-.7 .9:-1.4 1.2:-.7', lean: '0:.06 .6:-.02 1.2:.06', brows: '0:angry', mouth: '0:open .4:frown .8:open', eyes: '0:line', ear: '0:-.3', lift: '0:0 .3:1 .6:0 .9:1 1.2:0', tail: '0:.3 .6:-.3 1.2:.3' }, 'anger', ['angry', 'talk', 'idle']);
  def('upset', '被說得難過', 1, 2.0, { headDy: '0:1.6', lean: '0:.04', eyes: '0:line', mouth: '0:frown', brows: '0:worry', ear: '0:.5', tail: '0:-.3', armL: '0:.2', armR: '0:.2', lookY: '0:1' }, 'gloom', ['sad', 'idle']);
  def('apologize', '道歉', 0, 1.8, { lean: '0:0 .3:.3 1.2:.3 1.8:.05', headDy: '0:0 .3:2.4 1.2:2.4 1.8:.4', armL: '0:.3 .3:.55', armR: '0:.3 .3:.55', eyes: '0:line', mouth: '0:wave', brows: '0:worry', ear: '0:.4', tail: '0:-.25', blush: '0:.5' }, 'sweat', ['bow', 'sad', 'idle']);
  def('accept', '接受', 0, 1.2, { headDy: '0:0 .3:1.2 .6:0 .9:1 1.2:0', eyes: '0:happy', mouth: '0:smile', armL: '0:.2', armR: '0:.2', ear: '0:-.1', tail: '0:.3 .6:-.3 1.2:.3' }, '', ['nod', 'happy', 'idle']);
  def('twirl', '牽手轉圈', 1, 1.6, { lean: '0:.12 .8:-.12 1.6:.12', shiftX: '0:1.2 .8:-1.2 1.6:1.2', lift: '0:0 .4:2.2 .8:0 1.2:2.2 1.6:0', armL: '0:-1.4', armR: '0:-1.4', eyes: '0:happy', mouth: '0:open', tail: '0:.5 .8:-.5 1.6:.5', ear: '0:-.2' }, 'sparkle', ['dance', 'happy', 'idle']);
  def('sidebyside', '並肩看風景', 1, 4.0, { lean: '0:.02 2:-.02 4:.02', lookX: '0:1', lookY: '0:-.2', eyes: '0:round', mouth: '0:smile', armL: '0:.15', armR: '0:.15', ear: '0:-.05', tail: '0:.15 2:.3 4:.15' }, '', ['sit', 'idle']);
  def('rps', '猜拳', 1, 1.4, { armR: '0:-1.2 .2:-1.6 .4:-1.2 .6:-1.6 .8:-1.2 1:-1.9 1.4:-1.9', lift: '0:0 .2:.8 .4:0 .6:.8 .8:0', eyes: '0:round', mouth: '0:o', ear: '0:-.2', tail: '0:.3 .7:-.3 1.4:.3' }, '', ['think', 'idle']);
  def('rps_win', '猜拳贏了', 0, 1.6, { lift: '0:0 .2:4 .4:0 .7:3 .9:0', armL: '0:-2.3', armR: '0:-2.3', eyes: '0:happy', mouth: '0:open', ear: '0:-.3', tail: '0:.6 .8:-.6 1.6:.6', squash: '0:1 .2:1.06 .4:.94 .9:1' }, 'sparkle', ['cheer', 'happy', 'idle']);
  def('rps_lose', '猜拳輸了', 0, 1.6, { headDy: '0:0 .3:2 1.6:1.4', lean: '0:0 .3:.07', armL: '0:.2 .3:.4', armR: '0:.2 .3:.4', eyes: '0:line', mouth: '0:frown', ear: '0:.45', tail: '0:-.3', squash: '0:1 .3:.95' }, 'sweat', ['sad', 'idle']);
  def('selfie', '一起自拍', 1, 3.0, { armR: '0:-1.9 1.5:-2.0 3:-1.9', tilt: '0:.12 1.5:.16 3:.12', eyes: '0:happy', mouth: '0:open', blush: '0:.6', ear: '0:-.1', lean: '0:.04', tail: '0:.25' }, 'sparkle', ['peace', 'happy', 'idle']);
  def('cheerup', '一起歡呼', 1, 0.9, { lift: '0:0 .22:4 .45:0 .67:4 .9:0', armL: '0:-1.6 .22:-2.4 .45:-1.6 .67:-2.4', armR: '0:-1.6 .22:-2.4 .45:-1.6 .67:-2.4', squash: '0:.94 .22:1.06 .45:.94 .67:1.06', eyes: '0:happy', mouth: '0:open', ear: '0:-.3', tail: '0:.4 .45:-.4 .9:.4' }, 'sparkle', ['cheer', 'happy', 'idle']);
  def('chase', '追逐', 1, 0.6, { lift: '0:0 .15:1.5 .3:0 .45:1.5 .6:0', lean: '0:.12', armL: '0:-1.0 .3:.6 .6:-1.0', armR: '0:.6 .3:-1.0 .6:.6', eyes: '0:happy', mouth: '0:open', ear: '0:.25', tail: '0:.3 .3:-.3 .6:.3' }, '', ['run', 'happy', 'idle']);
  def('peekaboo', '躲貓貓', 1, 1.6, { armL: '0:-1.6 .6:-1.6 .8:-.4 1.6:-.4', armR: '0:-1.6 .6:-1.6 .8:-.4 1.6:-.4', eyes: '0:line .8:happy', mouth: '0:flat .8:open', headDy: '0:.8 .8:-.5 1.6:-.2', ear: '0:.2 .8:-.3', tail: '0:0 .8:.5 1.6:.2' }, '', ['hide', 'happy', 'idle']);
  def('stunned', '看呆了', 1, 2.0, { eyes: '0:wide', mouth: '0:o', ear: '0:-.3', armL: '0:.2', armR: '0:.2', headDy: '0:-.4', tail: '0:.05' }, 'shock', ['surprised', 'idle']);

  // ---------------------------------------------------------------- more everyday acting (work, feelings, signals)
  def('sweep', '掃地', 1, 1.2, { armL: '0:-.6 .6:-.9 1.2:-.6', armR: '0:-.9 .6:-.5 1.2:-.9', lean: '0:.06 .6:.12 1.2:.06', shiftX: '0:-1 .6:1 1.2:-1', headDy: '0:.8', lookY: '0:.8', eyes: '0:round', mouth: '0:smile', tail: '0:.1 .6:-.1 1.2:.1' }, '', ['tend', 'idle']);
  def('dig', '挖土', 1, 1.0, { lean: '0:.04 .3:.2 .6:.04 1:.04', armL: '0:-.7 .3:-.2 .6:-.9', armR: '0:-.7 .3:-.2 .6:-.9', headDy: '0:.8 .3:1.8 .6:.8', lift: '0:0 .3:-1 .6:.6 1:0', eyes: '0:round', mouth: '0:flat', lookY: '0:.9' }, '', ['tend', 'forage', 'idle']);
  def('pull', '用力拔', 1, 1.6, { lean: '0:.04 .5:-.12 .8:-.12 1:.12 1.6:.04', armL: '0:-.6 .5:-.1 .8:-.1 1:-1.3', armR: '0:-.6 .5:-.1 .8:-.1 1:-1.3', squash: '0:1 .5:.93 .8:.93 1:1.05 1.6:1', eyes: '0:line .8:wide', mouth: '0:frown .9:open', lift: '0:0 1:2.5 1.2:0' }, 'sweat', ['tend', 'forage', 'idle']);
  def('carry', '搬東西', 1, 0.8, { lean: '0:-.08', armL: '0:-.9', armR: '0:-.9', legL: '0:0 .2:1.4 .4:0', legR: '0:0 .4:0 .6:1.4 .8:0', lift: '0:0 .2:.5 .4:0 .6:.5 .8:0', eyes: '0:line', mouth: '0:frown', squash: '0:.97' }, 'sweat', ['walk', 'idle']);
  def('sniff', '聞一聞', 1, 1.6, { headDy: '0:1.4 .4:2.2 .8:1.4 1.2:2.2 1.6:1.4', lean: '0:.1', lookY: '0:1', eyes: '0:line', mouth: '0:o', ear: '0:-.1', tail: '0:.2 .8:-.2 1.6:.2', blush: '0:.2' }, '', ['browse', 'idle']);
  def('lickips', '舔舔嘴巴', 0, 1.2, { headDy: '0:0 .3:.5 .6:0 .9:.5 1.2:0', mouth: '0:chew .3:smile .6:chew', eyes: '0:happy', blush: '0:.4', tail: '0:.3 .6:-.3 1.2:.3', armL: '0:.2', armR: '0:-.2' }, '', ['yum', 'happy', 'idle']);
  def('jealous', '吃醋斜眼', 1, 2.4, { lookX: '0:1', tilt: '0:-.08', lean: '0:-.04', armL: '0:.4', armR: '0:.4', brows: '0:angry', mouth: '0:flat', eyes: '0:line', blush: '0:.3', ear: '0:.25', tail: '0:-.1 1.2:-.25 2.4:-.1' }, '', ['pout', 'angry', 'idle']);
  def('embarrassed', '害羞摀臉', 1, 2.0, { armL: '0:-1.5', armR: '0:-1.5', headDy: '0:1.2', blush: '0:1', lean: '0:.04 1:-.04 2:.04', ear: '0:.4', tail: '0:-.1', eyes: '0:line', mouth: '0:wave', squash: '0:.96', shiftX: '0:.4 1:-.4 2:.4' }, '', ['shy', 'idle']);
  def('worried', '坐立不安', 1, 1.4, { armL: '0:-.6 .35:-.8 .7:-.6 1.05:-.8', armR: '0:-.6 .35:-.8 .7:-.6 1.05:-.8', lookX: '0:1 .7:-1 1.4:1', ear: '0:.35', headDy: '0:.8', brows: '0:worry', mouth: '0:wave', eyes: '0:round', legL: '0:0 .35:.8 .7:0', tail: '0:-.15', lean: '0:.03 .7:-.03 1.4:.03' }, 'sweat', ['sad', 'idle']);
  def('nervous', '緊張發抖', 1, 0.5, { lean: '0:.02 .08:-.02 .16:.02 .24:-.02 .32:.02', armL: '0:-.5', armR: '0:-.5', ear: '0:.3', eyes: '0:wide', mouth: '0:wave', headDy: '0:.5', tail: '0:-.1', blush: '0:.3' }, 'sweat', ['shiver', 'shy', 'idle']);
  def('relieved', '鬆一口氣', 0, 1.8, { headDy: '0:0 .5:-.8 1.2:2 1.8:0', squash: '0:1 .5:1.04 1.2:.94 1.8:1', armL: '0:.2 .5:-.4 1.2:.3', armR: '0:.2 .5:-.4 1.2:.3', eyes: '0:line', mouth: '0:o .6:smile', ear: '0:0 1.2:.3 1.8:.1' }, 'puff', ['sigh', 'idle']);
  def('lonely', '抱著自己', 1, 3.0, { armL: '0:-.7', armR: '0:-.7', squash: '0:.93', headDy: '0:1.4', lookY: '0:.8', ear: '0:.45', tail: '0:-.25', eyes: '0:line', mouth: '0:frown', brows: '0:worry', lean: '0:.03 1.5:-.03 3:.03' }, 'gloom', ['sad', 'idle']);
  def('determined', '握拳加油', 1, 1.6, { armR: '0:-1.9 .4:-2.1 .8:-1.9 1.6:-1.9', lean: '0:.05', brows: '0:angry', mouth: '0:grin', eyes: '0:round', lift: '0:0 .4:.8 .8:0', ear: '0:-.3', tail: '0:.3 .8:-.3 1.6:.3' }, '', ['cheer', 'proud', 'idle']);
  def('wave_far', '遠遠揮手', 1, 1.2, { armL: '0:-2.2 .3:-2.5 .6:-2.2 .9:-2.5 1.2:-2.2', armR: '0:-2.5 .3:-2.2 .6:-2.5 .9:-2.2 1.2:-2.5', lift: '0:.4 .3:1.2 .6:.4', eyes: '0:happy', mouth: '0:open', ear: '0:-.2', tail: '0:.3 .6:-.3 1.2:.3' }, '', ['wave', 'greet', 'idle']);
  def('beckon', '招招手', 1, 1.0, { armR: '0:-1.6 .25:-1.15 .5:-1.6 .75:-1.15 1:-1.6', lean: '0:.04', eyes: '0:happy', mouth: '0:smile', tilt: '0:.05', ear: '0:-.1' }, '', ['wave', 'idle']);
  def('shoo', '趕走', 0, 1.2, { armR: '0:.2 .2:-1.5 .4:-1.1 .6:-1.5 .8:-1.1 1.2:.2', lean: '0:0 .2:-.05 1.2:0', eyes: '0:line', mouth: '0:frown', brows: '0:angry', ear: '0:.2' }, '', ['angry', 'idle']);
  def('thumbsup', '比讚', 0, 1.4, { armR: '0:.2 .25:-1.5 1:-1.5 1.4:.2', lift: '0:0 .25:1 .6:.4 1.4:0', eyes: '0:happy', mouth: '0:open', ear: '0:-.2', tail: '0:.3 .6:-.3 1.4:.3', blush: '0:.2' }, 'sparkle', ['cheer', 'happy', 'idle']);
  def('facepalm', '扶額', 0, 1.8, { armR: '0:.2 .3:-1.5 1.4:-1.5 1.8:.2', headDy: '0:0 .3:1.4 1.4:1.4 1.8:0', lean: '0:0 .3:.06 1.4:.06', eyes: '0:line', mouth: '0:flat', ear: '0:.3', tail: '0:-.2' }, 'sweat', ['shrug', 'sad', 'idle']);
  def('headscratch', '搔搔頭', 1, 1.2, { armR: '0:-1.7 .15:-1.55 .3:-1.7 .45:-1.55 .6:-1.7 1.2:-1.7', tilt: '0:.1', eyes: '0:round', mouth: '0:wave', ear: '0:.15', blush: '0:.3', lookY: '0:-.4' }, '', ['think', 'shy', 'idle']);
  def('lookaround', '東張西望', 1, 3.0, { lookX: '0:0 .5:1 1:1 1.5:-1 2:-1 2.5:0 3:0', headDx: '0:0 .5:1.2 1:1.2 1.5:-1.2 2:-1.2 2.5:0', tilt: '0:0 .5:.06 1.5:-.06 2.5:0', ear: '0:0 .5:-.1 1.5:-.1 2.5:0', eyes: '0:round', mouth: '0:o .5:flat' }, '', ['browse', 'idle']);
  def('squat', '蹲下看', 1, 3.0, { squash: '0:.76', lift: '0:-4', lean: '0:.1', headDy: '0:2', lookY: '0:1', armL: '0:-.4', armR: '0:-.4', eyes: '0:round', mouth: '0:o', ear: '0:-.05', tail: '0:.1 1.5:.3 3:.1' }, '', ['sit', 'forage', 'idle']);
  def('recoil', '往後縮', 0, 0.8, { lean: '0:0 .1:-.2 .5:-.1 .8:0', lift: '0:0 .1:2 .4:0', shiftX: '0:0 .1:-2.4 .6:-1 .8:0', armL: '0:.2 .1:-1.3 .6:-.8', armR: '0:.2 .1:-1.3 .6:-.8', eyes: '0:wide', mouth: '0:o', ear: '0:-.35', tail: '0:.5' }, 'shock', ['surprised', 'idle']);
  def('trip', '絆倒', 0, 1.6, { lean: '0:0 .15:.5 .4:1.35 1.0:1.35 1.4:.3 1.6:0', lift: '0:0 .15:1 .4:-3 1.0:-3 1.6:0', squash: '0:1 .4:.86 1.0:.86 1.6:1', armL: '0:.2 .2:-1.8 1.0:-.5', armR: '0:.2 .2:-1.8 1.0:-.5', eyes: '0:wide .4:line 1.2:round', mouth: '0:o .4:wave', headDy: '0:0 .4:1.2 1.4:0', ear: '0:-.3 .4:.4' }, 'shock', ['fall', 'hurt', 'idle']);
  def('getup', '爬起來', 0, 1.4, { lean: '0:1.2 .5:.5 1:.1 1.4:0', lift: '0:-3 .5:-1.5 1:.5 1.4:0', squash: '0:.86 .5:.92 1:1.04 1.4:1', armL: '0:-.5 .5:-1 1.4:.2', armR: '0:-.5 .5:-1 1.4:.2', eyes: '0:round', mouth: '0:wave 1:smile', blush: '0:.7 .8:.3', ear: '0:.3 1.4:.05' }, '', ['stretch', 'shy', 'idle']);
  def('stretch2', '側身伸展', 1, 3.0, { lean: '0:.2 1.5:-.2 3:.2', armL: '0:-2.4 1.5:-1.8 3:-2.4', armR: '0:-1.8 1.5:-2.4 3:-1.8', lift: '0:.5 1.5:.9 3:.5', eyes: '0:line', mouth: '0:o', ear: '0:-.1', tail: '0:.2 1.5:-.2 3:.2' }, '', ['stretch', 'idle']);
  def('cast', '甩竿', 0, 1.4, { armR: '0:-.9 .3:-2.2 .6:-1.2 1.4:-1.2', armL: '0:-.8 .3:-1.6 .6:-1', lean: '0:.04 .3:-.08 .6:.1 1.4:.06', headDy: '0:0 .3:-.5 .6:.6', eyes: '0:round', mouth: '0:o .6:smile', lookY: '0:0 .4:-.3 .8:.4' }, '', ['fish', 'idle']);
  def('reel', '收竿', 1, 1.0, { armR: '0:-1.2 .5:-1.6 1:-1.2', armL: '0:-.9 .25:-.4 .5:-.9 .75:-.4 1:-.9', lean: '0:.06 .5:-.04 1:.06', eyes: '0:round', mouth: '0:flat', lookY: '0:.6', headDy: '0:.4 .5:1 1:.4' }, 'sweat', ['fish', 'idle']);
  def('stir', '攪拌', 1, 1.0, { armR: '0:-.9 .25:-.6 .5:-.9 .75:-1.1 1:-.9', armL: '0:-.6', lean: '0:.05', lookY: '0:.8', mouth: '0:smile', eyes: '0:round', shiftX: '0:.4 .5:-.4 1:.4', ear: '0:-.05' }, '', ['cook', 'idle']);
  def('wash', '洗手', 1, 1.2, { armL: '0:-.7 .3:-.55 .6:-.7 .9:-.55 1.2:-.7', armR: '0:-.7 .3:-.55 .6:-.7 .9:-.55 1.2:-.7', headDy: '0:.8', lookY: '0:.8', eyes: '0:round', mouth: '0:smile', shiftX: '0:.3 .6:-.3 1.2:.3' }, 'bubbles', ['tend', 'idle']);
  def('stretchcat', '拱背伸懶腰', 0, 2.4, { lean: '0:0 .6:.3 1.4:.3 2.4:0', headDy: '0:0 .6:2 1.4:2 2.4:0', armL: '0:.2 .6:-.3 1.4:-.3 2.4:.2', armR: '0:.2 .6:-.3 1.4:-.3 2.4:.2', squash: '0:1 .6:.94 1.4:.94 2.4:1', eyes: '0:line', mouth: '0:o', ear: '0:0 .8:.3 1.6:.3 2.4:.05', tail: '0:.1 .6:.6 1.4:.6 2.4:.1' }, '', ['stretch', 'yawn', 'idle']);
  def('bounce', '開心彈跳', 1, 0.5, { lift: '0:0 .12:2.2 .25:0 .37:2.2 .5:0', squash: '0:.95 .12:1.05 .25:.95 .37:1.05', armL: '0:-.5 .25:-1 .5:-.5', armR: '0:-1 .25:-.5 .5:-1', eyes: '0:happy', mouth: '0:open', ear: '0:-.25 .12:-.35 .25:-.25', tail: '0:.4 .25:-.4 .5:.4' }, '', ['skip', 'happy', 'idle']);

  const names = Object.keys(LIB);
  const has = (a) => !!(a && LIB[a]);

  /** fill rig state from a library action. `at` = seconds since the action began (already tempo-scaled by the caller) */
  function apply(a, at, s, m, b) {
    const d = LIB[a]; if (!d) return false;
    const T = d.loop ? at % d.dur : Math.min(at, d.dur), A = m ? m.amp : 1;
    for (const k of Object.keys(d.num)) {
      let v = num(d.num[k], T);
      if (k === 'lift' || k === 'headDy' || k === 'shiftX' || k === 'legL' || k === 'legR') v *= (0.55 + 0.45 * A);   // lively OCs move bigger
      else if (k === 'armL' || k === 'armR') { v = v < 0 ? v * (0.7 + 0.3 * A) : v; }
      if (m && m.shy && (k === 'lift' || k === 'headDx')) v *= 0.7;
      s[k] = v;
    }
    for (const k of Object.keys(d.step)) s[k] = step(d.step[k], T);
    for (const f of d.fx) s[{ heart: 'fxHeart', anger: 'fxAnger', spiral: 'fxSpiral', bulb: 'fxBulb', puff: 'fxPuff', bubbles: 'fxBubbles', cup: 'fxCup', sweat: 'sweat', sparkle: 'sparkle', thought: 'thought', gloom: 'gloom', tear: 'tear', shock: 'shock', zzz: 'zzz', notes: 'notes', sketch: 'sketch' }[f] || f] = true;
    return true;
  }

  /** 11.0 touch layer: a continuous reaction to a finger stroking the OC (level 0–1, zone, stroke direction) — additive on top of any action */
  function touchLayer(s, k, T, m) {
    const lv = clamp(k.lv), z = k.zone || 'head', dir = k.dir || 0, sh = m && m.shy ? 1 : 0, wob = Math.sin(T * 9);
    s.blush = Math.max(s.blush || 0, 0.35 + lv * 0.65 * (sh ? 1.2 : 1));
    s.eyes = lv > 0.18 ? (k.ticklish && lv < 0.9 ? 'happy' : 'line') : s.eyes;
    s.mouth = lv > 0.55 ? 'smile' : lv > 0.18 ? 'cat' : s.mouth;
    s.tail = (s.tail || 0) * 0.3 + Math.sin(T * (4 + lv * 7)) * (0.15 + lv * 0.4);
    s.ear = Math.max(s.ear || 0, 0) + (z === 'ears' ? Math.sin(T * 22) * 0.2 : 0.18 + lv * 0.22);
    s.tilt = (s.tilt || 0) + dir * 0.12 * lv;                          // leans into the finger
    s.headDx = (s.headDx || 0) + dir * 1.6 * lv;
    s.headDy = (s.headDy || 0) + 0.5 + lv * 1.4 + (z === 'head' ? Math.abs(Math.sin(T * 5)) * 0.4 * lv : 0);
    s.lean = (s.lean || 0) + dir * 0.05 * lv;
    s.squash = (s.squash || 1) * (1 - lv * 0.09);
    if (z === 'belly' || k.ticklish) { s.lean += wob * 0.04 * (0.3 + lv); s.mouth = 'open'; s.armL = -0.6 + wob * 0.4; s.armR = -0.6 - wob * 0.4; s.sweat = lv > 0.5; }
    if (z === 'ears') { s.earL = 0.35 + Math.sin(T * 20) * 0.25; s.earR = 0.35 - Math.sin(T * 20) * 0.25; }
    if (z === 'cheek') { s.headDx += dir * 1.0; s.mouth = 'smile'; }
    if (z === 'tail') { s.tail = Math.sin(T * 14) * 0.6; s.eyes = 'wide'; s.mouth = 'o'; s.shock = lv > 0.3; s.lift = (s.lift || 0) + Math.max(0, Math.sin(T * 7)) * 1.2; }
    if (lv > 0.75) { s.fxHeart = true; s.lift = Math.min(s.lift || 0, 0) - 1.2; s.squash *= 0.97; }
    if (k.annoyed) { s.eyes = 'line'; s.mouth = 'frown'; s.brows = 'angry'; s.blush = 0.2; s.lean = (s.lean || 0) - dir * 0.1; s.ear = 0.5; s.fxAnger = lv > 0.4; }
    return s;
  }

  // the library registers itself as ordinary actions (editor list, animation workshop, fallback chains)
  function register() {
    const AC = OC.Chars && OC.Chars.ACTIONS; if (!AC || register.done) return; register.done = true;
    for (const n of names) { if (AC.some((x) => x[0] === n)) continue; const d = LIB[n]; AC.push([n, d.zh, d.loop ? 'loop' : 'once', d.fb]); if (OC.Chars.ACTION_ZH) OC.Chars.ACTION_ZH[n] = d.zh; }
  }
  // ---------------------------------------------------------------- variety: what an OC does with its idle moments / while doing something
  /** while doing an activity, the pose is picked from these (re-picked now and then → the same activity never looks the same twice) */
  const VARIED = { play: ['play', 'skip', 'tailchase', 'spin', 'wiggle', 'happy'], daydream: ['daydream', 'think', 'daydream'], study: ['study', 'write', 'study'], drink: ['drink', 'sip'], observe: ['idle', 'daydream', 'stargaze'], tidy: ['tend', 'swish', 'tend'], browse: ['browse', 'point', 'browse', 'shrug'], explore: ['idle', 'tiptoe', 'point'], rest: ['sit', 'sit', 'sigh'] };
  /** a small spontaneous action for an idle OC from its mood / needs / personality / weather: { action, dur } or null */
  function fidget(c, ctx) {
    const M = OC.Mind, has = (t) => OC.Chars.has(c, t), emo = M.dominant(c), k = M.intensity(c, emo), wx = OC.Clock.weather(), night = OC.Clock.phase() === 'night';
    const W = []; const add = (action, w) => { if (w > 0 && LIB[action]) W.push([action, w]); };
    if (['happy', 'excited', 'proud', 'content'].includes(emo) && k > 0.3) { add('wiggle', 1 + (has('energetic') ? 1 : 0)); add('skip', has('energetic') || has('cheerful') ? 1.5 : 0.3); add('spin', has('energetic') ? 1 : 0.4); add('peace', has('cheerful') ? 1 : 0.3); add('wave', 0.6); add('giggle', has('shy') ? 1.6 : 0.5); add('flex', has('energetic') ? 0.7 : 0); add('salute', has('diligent') ? 0.6 : 0); }
    if (emo === 'tired' || c.needs.energy < 35) { add('yawn', 2); add('sigh', 1); add('nap', c.needs.energy < 25 ? 1 : 0); }
    if (['bored'].includes(emo) || c.needs.fun < 35) { add('sigh', 1); add('swish', 1); add('shrug', 0.8); add('daydream', 1.2); add('tailchase', has('energetic') ? 1 : 0); }
    if (['down', 'lonely'].includes(emo) && k > 0.3) { add('sigh', 1.6); add('sulk', 0.6); add('daydream', 0.8); }
    if (emo === 'annoyed' && k > 0.3) { add('stomp', 1.5); add('pout', 1); }
    if (emo === 'curious' || has('curious')) { add('tiptoe', 0.5); add('aha', 0.25); add('point', 0.4); add('daydream', 0.4); }
    if (night && wx === 'clear' && (has('nightowl') || has('curious') || has('artsy'))) add('stargaze', 1.4);
    if (wx === 'rain' || wx === 'fog') add('shiver', 0.5);
    if (c.needs.food < 30) add('sigh', 1);
    add('sneeze', 0.12); add('hiccup', 0.08);
    if (!W.length) return null;
    let tot = 0; for (const w of W) tot += w[1]; let r = Math.random() * tot, pick = W[0][0]; for (const w of W) { r -= w[1]; if (r <= 0) { pick = w[0]; break; } }
    const d = LIB[pick]; return { action: pick, dur: d.loop ? Math.min(6, d.dur * (d.dur < 1.5 ? 3 : 1.4)) : d.dur + 0.2 };
  }
  OC.Anim11 = { VARIED, fidget, LIB, has, apply, touchLayer, register, def, get names() { return names; }, num, step, P };
  register();
})();
