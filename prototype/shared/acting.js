/* Shared character acting for Round-2 schemes: identical performance & timing in D/E/F,
 * so the videos compare art direction only. Coordinates are dp in each theme's space.
 * tq(t) lets a scheme quantize time (e.g. "on twos"); default is continuous.
 */
(function () {
  'use strict';
  const { clamp, lerp, E, spring, wobble, blink, breath, walkPath, finger } = OC;

  const idle = (t, seed, o = {}) => Object.assign({
    breath: breath(t, 0.36, seed * 0.17), blink: blink(t, seed), tail: Math.sin(t * 2.1 + seed) * 0.16, ear: Math.sin(t * 0.8 + seed) * 0.03,
  }, o);

  /** Island beat: walk keys[0]→keys[1] (0.9→2.7s), turn to camera, wave, then look up as night falls. */
  function island(lt, t, keys, dir = 1) {
    const w = walkPath(keys, lt, 13);
    const turnT = lt - 2.75;
    const face = lt < 2.75 ? (lt > 0.75 ? 0.85 * dir : lerp(0, 0.85 * dir, E.inOutCubic(clamp((lt - 0.45) / 0.3)))) : 0.85 * dir * (1 - spring(turnT, 1.4, 6));
    const look = clamp((lt - 4.0) / 0.6);
    const waving = lt > 3.0 && lt < 3.9;
    return { x: w.x, y: w.y, s: idle(t, 1, {
      face, walk: w.moving ? Math.sin(Math.PI * clamp(w.segT || 0)) ** 0.4 : 0, phase: w.phase,
      earL: wobble(turnT, 3.2, 4.5) * 0.4, earR: wobble(turnT - 0.05, 3.2, 4.5) * 0.4,
      armR: waving ? -2.3 + Math.sin((lt - 3.0) * 12) * 0.35 : undefined,
      eyes: waving ? 'happy' : look > 0.5 ? 'sparkle' : 'round', mouth: waving ? 'smile' : look > 0.3 ? 'o' : 'cat',
      lookY: -look * 1.6, tilt: -look * 0.12 * dir, headDy: -look * 1.2, lean: w.moving ? 0.05 * dir : 0, squash: 1 + wobble(turnT, 2.5, 6) * 0.04,
    }), emote: lt > 4.5 ? { kind: '♪', p: clamp((lt - 4.5) / 1.4) } : null };
  }

  /** Dialogue beat: Kuri walks in, talks, is offered a walk → surprise → jump → hearts. */
  function dialogue(lt, t, from, to) {
    const kw = walkPath([{ t: -0.2, x: from[0], y: from[1] }, { t: 1.0, x: to[0], y: to[1] }], lt, 12);
    const dir = Math.sign(from[0] - to[0]) || 1; // kuri faces toward mochi
    const jumpT = lt - 3.2;
    const antic = clamp((lt - 2.95) / 0.25) * (1 - clamp((lt - 3.2) / 0.05));
    const air = jumpT > 0 && jumpT < 0.42 ? Math.sin((jumpT / 0.42) * Math.PI) : 0;
    const land = wobble(jumpT - 0.42, 2.4, 6);
    const reacting = lt > 2.95;
    const kuri = idle(t, 2, {
      face: -0.75 * dir, walk: kw.moving ? 1 : 0, phase: kw.phase, lift: air * 16, squash: 1 - antic * 0.16 + air * 0.1 - land * 0.12,
      ear: -antic * 0.5 + air * -0.25, earL: wobble(jumpT - 0.3, 2.6, 4) * 0.55, earR: wobble(jumpT - 0.33, 2.6, 4) * 0.55,
      eyes: lt > 3.15 ? 'happy' : lt > 2.95 ? 'wide' : 'round', mouth: lt > 3.15 ? 'open' : lt > 1.0 && lt < 2.2 ? (Math.sin(t * 18) > 0 ? 'o' : 'cat') : 'cat',
      armL: air > 0 ? -2.4 : undefined, armR: air > 0 ? -2.4 : undefined, tail: Math.sin(t * (reacting ? 9 : 2)) * (reacting ? 0.5 : 0.15),
      blush: lt > 3.3 ? 1 : 0, brows: lt > 2.95 && lt < 3.2 ? 'up' : null, shock: lt > 2.95 && lt < 3.2,
    });
    const mochi = idle(t, 1, { face: 0.7 * dir, eyes: lt > 3.5 ? 'happy' : 'round', mouth: lt > 3.5 ? 'smile' : lt > 2.8 && lt < 3.1 ? 'o' : 'cat', blush: clamp((lt - 3.4) / 0.5), lookY: -air * 1.2, tilt: lt > 3.5 ? -0.08 * dir : 0 });
    const emote = lt > 2.95 && lt < 3.35 ? { kind: '!', p: clamp((lt - 2.95) / 0.45) } : lt > 3.4 ? { kind: '♥', p: clamp((lt - 3.4) / 1.4) } : null;
    return { kx: kw.x, ky: kw.y, kuri, mochi, emote, air };
  }

  /** Inventory beat: notice dragged food, eat, happy hop. Finger keys are per theme; pass f. */
  function eat(lt, t, f, mx, my) {
    const eatT = lt - 2.32, chew = eatT > 0 && eatT < 0.9, happy = eatT > 0.9;
    const near = f && lt > 1.45 && lt < 2.32;
    const notice = clamp((lt - 1.5) / 0.3);
    return {
      chew, happy, eatT,
      s: idle(t, 1, {
        eyes: happy ? 'happy' : notice > 0.5 ? 'sparkle' : 'round', mouth: chew ? 'chew' : happy ? 'smile' : notice > 0.5 ? 'open' : 'cat',
        lookY: near ? clamp((f.y - (my - 60)) / 60, -1.5, 1.5) : 0, lookX: near ? clamp((f.x - mx) / 40, -1, 1) : 0, headDx: near ? clamp((f.x - mx) / 40, -2, 2) : 0,
        squash: 1 + (chew ? Math.sin(eatT * 14) * 0.03 : 0) + wobble(eatT - 0.9, 2.2, 5) * 0.06, ear: -notice * 0.15, blush: happy ? 1 : 0,
        tail: Math.sin(t * (notice > 0.5 ? 8 : 2)) * (notice > 0.5 ? 0.45 : 0.15), lift: happy ? Math.max(0, Math.sin((eatT - 0.9) * 7)) * 5 * clamp(1.6 - eatT) : 0,
      }),
    };
  }

  // ---- floating pet (dp, home-screen grid: OC Shimeji icon at (307,386), dock top y≈518) ----
  const PET_KEYS = [{ t: 1.75, x: 120, y: 420 }, { t: 2.05, x: 150, y: 492 }, { t: 2.12, x: 150, y: 492, down: true }, { t: 2.35, x: 150, y: 486, down: true }, { t: 2.85, x: 210, y: 330, down: true }, { t: 3.3, x: 236, y: 212, down: true }, { t: 3.35, x: 236, y: 212 }];
  function pet(lt, t) {
    const f = finger(PET_KEYS, lt);
    if (lt < 0.85) {
      const q = clamp((lt - 0.25) / 0.6);
      return { f, x: lerp(300, 262, q), y: lerp(386, 514, q) - Math.sin(q * Math.PI) * 64, swing: 0, mode: 'jump', s: idle(t, 1, { squash: 1 + Math.sin(q * Math.PI) * 0.1, eyes: 'happy', mouth: 'open', armL: -2, armR: -2, earL: -0.3, earR: -0.3, noShadow: q < 0.95 }) };
    }
    if (lt < 2.12) {
      const w = walkPath([{ t: 1.0, x: 262, y: 514 }, { t: 2.0, x: 150, y: 514 }], lt, 11);
      return { f, x: w.x, y: w.y, swing: 0, mode: 'walk', s: idle(t, 1, { face: -0.85, walk: w.moving ? 1 : 0, phase: w.phase, squash: 1 - wobble(lt - 0.85, 2.4, 6) * 0.12, earL: wobble(lt - 0.85, 3, 5) * 0.4, earR: wobble(lt - 0.87, 3, 5) * 0.4 }) };
    }
    if (lt < 3.35) {
      const fp = f || { x: 236, y: 212 };
      const lag = finger(PET_KEYS.slice(2, 6), lt - 0.12) || fp;
      const swing = clamp((fp.x - lag.x) * 0.06, -0.6, 0.6) + Math.sin(lt * 9) * 0.06;
      return { f, x: fp.x, y: fp.y + 22, swing, mode: 'drag', s: idle(t, 1, { eyes: 'wide', mouth: 'o', walk: 1, phase: lt * 7, armL: -2.6, armR: -2.6, ear: 0.25, earL: Math.sin(lt * 12) * 0.2, earR: Math.sin(lt * 12 + 1) * 0.2, noShadow: true, tail: Math.sin(lt * 14) * 0.5, brows: 'up', sweat: true }) };
    }
    const fall = clamp((lt - 3.35) / 0.25), l2 = lt - 3.6, yawn = l2 > 0.75 && l2 < 1.25;
    return { f, x: 236, y: lerp(234, 248, E.inQuad(fall)), swing: 0, mode: lt < 3.6 ? 'fall' : 'sit', s: idle(t, 1, { squash: 1 - wobble(l2, 2.4, 5) * 0.14, eyes: yawn ? 'happy' : l2 > 1.25 ? 'sleepy' : 'happy', mouth: yawn ? 'open' : 'cat', earL: wobble(l2, 3, 4) * 0.5, earR: wobble(l2 - 0.04, 3, 4) * 0.5, blush: 1, tail: Math.sin(t * 2) * 0.3, noShadow: lt < 3.6 }) };
  }
  const APPS = [['chat', '訊息'], ['camera', '相機'], ['music', '音樂'], ['map', '地圖'], ['clock', '時鐘'], ['leaf', '相簿'], ['gear', '設定'], ['paw', 'OC Shimeji']];
  const appPos = (i) => [52 + (i % 4) * 85, 300 + Math.floor(i / 4) * 86];

  OC.ACT = { idle, island, dialogue, eat, pet, APPS, appPos };
})();
