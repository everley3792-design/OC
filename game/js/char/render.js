/* OC Shimeji — one character renderer for the world billboards, portraits, editors and the
 * desktop-pet export. Chooses per action between the procedural rig and the player's frames
 * (OC.Anim.resolve with direction/action fallback), normalises sprite size with ONE reference
 * height per character (so switching actions never makes the OC grow/shrink or jump), places
 * frames by their foot anchor, applies overlay animations (blink) unless suppressed, and lets
 * accessories follow the frame's attach points.
 */
(function () {
  'use strict';
  const RIG_H = 50;                       // a default rig OC is ~50 rig units tall (feet → ear tips)

  // ---------------- motion helpers (Phase 6) ----------------
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const E = { out: (q) => 1 - (1 - q) * (1 - q), inOut: (q) => (q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2), back: (q) => { const k = 1.70158; return 1 + (k + 1) * Math.pow(q - 1, 3) + k * Math.pow(q - 1, 2); } };
  const arc = (t, a, b) => Math.sin(Math.PI * seg(t, a, b));
  /** temperament → how big / how fast / how contained the body moves (real pose differences, not only speed) */
  function motion(c) {
    const p = c.personality || {}, n = c.needs || {}, has = (t) => OC.Chars.has(c, t);
    const tired = (n.energy != null && n.energy < 28) || (n.sleep != null && n.sleep < 22) ? 1 : 0, shy = has('shy') ? 1 : 0;
    const e = p.energy == null ? 50 : p.energy;
    return {
      amp: clamp(0.78 + (e - 50) / 110 + (has('cheerful') ? 0.15 : 0) - shy * 0.22 - tired * 0.28, 0.45, 1.4),
      tempo: clamp(0.9 + (e - 50) / 220 - tired * 0.28 + (has('lazy') ? -0.08 : 0), 0.55, 1.25),
      shy, tired, glad: (n.mood || 60) > 70 ? 1 : 0, seed: (c.id ? c.id.charCodeAt(c.id.length - 1) : 0) % 7,
    };
  }

  /** procedural pose for an action: phases (anticipation → action → follow-through → settle), temperament, secondary motion */
  function rigState(c, p, t) {
    const b = OC.Chars.behavior(c), m = motion(c), at = p.at || 0, T = at * m.tempo, s = {
      face: p.face || 0, back: p.back || 0, walk: p.walk || 0, phase: p.phase || 0, breath: p.breath || 0, blink: p.blink || 0,
      lift: p.lift || 0, squash: p.squash || 1, lean: 0, eyes: p.eyes, mouth: p.mouth || b.face, blush: p.blush || 0, bounce: b.bounce, sway: b.sway, lookX: p.lookX || 0, lookY: 0,
    };
    const A = m.amp;
    const droop = () => { s.ear = 0.42; s.headDy = (s.headDy || 0) + 1; s.lookY = Math.max(s.lookY, 0.4); s.tail = -0.15; };
    switch (p.action) {
      case 'walk': case undefined: case null: break;
      case 'run': s.walk = 1; s.bounce *= 1.3; s.lean = 0.09 * Math.sign(s.face || 1); s.ear = 0.28; s.armL = -1.0 * Math.sin((s.phase || 0) * Math.PI) * A; s.armR = 1.0 * Math.sin((s.phase || 0) * Math.PI) * A; break;
      case 'sit': s.squash = 0.9; s.lift = -3; if (b.sit === 'flop') { s.lean = 0.16; s.eyes = s.eyes || 'sleepy'; } if (b.sit === 'swing') s.armL = Math.sin(at * 4) * 0.3; s.tail = Math.sin(T * 1.2) * 0.12; break;
      case 'sleep': s.blink = 1; s.eyes = 'sleepy'; s.mouth = 'cat'; s.breath = Math.sin(at * 1.6) * 2; s.zzz = b.sleep === 'snore'; if (b.sleep === 'curl') { s.squash = 0.84; s.lean = 0.25; } s.lift = -2; s.ear = (at % 9) < 0.35 ? 0.25 : 0.12; break;
      case 'eat': {
        // hand to mouth → bite → chew ×3 → happy pause → repeat
        const up = E.out(seg(T, 0, 0.25)), cyc = Math.max(0, T - 0.25) % 1.6, chewing = cyc < 1.1;
        s.armR = -0.2 - 0.75 * up + (chewing ? Math.sin(cyc * 9) * 0.06 : 0.25); s.mouth = T < 0.25 ? 'o' : chewing ? (Math.sin(cyc * 18) > 0 ? 'chew' : 'cat') : 'smile';
        s.eyes = chewing ? 'happy' : 'happy'; s.headDy = chewing ? Math.abs(Math.sin(cyc * 9)) * 0.7 : 0; s.tail = Math.sin(T * 5) * 0.2 * A; s.chewRate = 14 / (b.chew / 1.6); s.ear = chewing ? 0.05 : -0.08; break;
      }
      case 'drink': { const up = E.out(seg(T, 0, 0.3)); s.armR = -0.2 - 1.15 * up; s.lookY = -0.35 * up; s.tilt = -0.06 * up; s.mouth = 'o'; s.headDy = Math.max(0, Math.sin(T * 5)) * 0.5 * up; s.eyes = 'line'; break; }
      case 'taste': {
        // bring it up, bite, then a held breath while it decides (the reveal is the next action)
        const up = E.out(seg(T, 0, 0.32)); s.armR = -0.2 - 0.8 * up; s.mouth = T < 0.32 ? 'o' : T < 0.5 ? 'chew' : Math.sin(T * 7) > 0.3 ? 'chew' : 'flat';
        s.headDy = arc(T, 0.32, 0.5) * 1.3; s.eyes = T > 0.45 ? 'line' : 'round'; s.lookY = T > 0.5 ? -0.35 : 0.2; s.ear = T > 0.5 ? -0.1 + Math.sin(T * 3) * 0.04 : 0; s.tilt = T > 0.55 ? Math.sin(T * 1.6) * 0.05 : 0; break;
      }
      case 'yum': {
        const k = seg(T, 0, 0.25); s.squash = 1 - arc(T, 0, 0.12) * 0.06 + arc(T, 0.12, 0.3) * 0.05;
        s.armL = s.armR = -1.4 - 0.55 * E.back(k) + Math.sin(T * 4) * 0.08; s.eyes = 'happy'; s.blush = 1; s.mouth = 'open';
        s.lean = Math.sin(T * 3) * 0.07 * A; s.lift = Math.abs(Math.sin(T * 5.5)) * 2.2 * A * (m.shy ? 0.4 : 1); s.tail = Math.sin(T * 9) * 0.35; s.ear = -0.18 + Math.sin(T * 5.5) * 0.06; break;
      }
      case 'yuck': {
        const rec = arc(T, 0, 0.22), dec = Math.max(0, 1 - T / 1.6);
        s.lean = -0.09 * rec + Math.sin(T * 38) * 0.03 * dec; s.squash = 1 + rec * 0.05; s.brows = 'worry'; s.mouth = 'wave'; s.eyes = T < 0.25 ? 'wide' : 'line';
        s.ear = 0.48 * seg(T, 0.1, 0.5); s.sweat = true; s.gloom = T > 0.3; s.lookY = 0.4; s.armL = s.armR = -0.3 - 0.4 * rec; s.tail = -0.2; break;
      }
      case 'play': case 'happy': {
        if (p.action === 'play' && OC.Growth && OC.Growth.has(c, 'trick') && (T % 4.2) > 3.2) { const q = seg(T % 4.2, 3.2, 4.0); s.lean = E.inOut(q) * Math.PI * 2 * Math.sign(s.face || 1); s.lift = Math.sin(Math.PI * q) * 9 * A; s.armL = s.armR = -2.2; s.eyes = 'happy'; s.mouth = 'open'; s.ear = 0.3; break; }
        const dip = arc(T, 0, 0.12), h1 = arc(T, 0.12, 0.42), h2 = arc(T, 0.45, 0.72) * 0.7;
        s.squash = 1 - dip * 0.1 + (h1 + h2) * 0.05; s.eyes = 'happy'; s.mouth = m.shy ? 'smile' : 'open'; s.tail = Math.sin(T * 10) * 0.32;
        if (m.shy) { s.blush = 0.8; s.armL = s.armR = -0.35; s.lift = (h1 + h2) * 1.6; s.headDy = 0.6; s.ear = 0.1; }
        else { s.lift = (h1 * 5 + h2 * 3.5) * A * b.emoteScale + (T > 0.75 ? Math.abs(Math.sin(T * 6)) * 1.5 * A : 0); s.armL = s.armR = -0.4 - 1.5 * Math.max(h1, h2, T > 0.75 ? 0.4 : 0) * A; s.lean = T > 0.75 ? Math.sin(T * 5) * 0.05 * A : 0; s.ear = -0.15 * (h1 + h2) + 0.22 * dip; }
        if (m.tired) { s.lift *= 0.4; s.armL = s.armR = -0.3; } break;
      }
      case 'cheer': { const pop = E.back(seg(T, 0.06, 0.3)); s.squash = 1 - arc(T, 0, 0.08) * 0.1; s.lift = arc(T, 0.08, 0.42) * 5 * A; s.armL = -2.2 * pop + Math.sin(T * 7) * 0.12; s.armR = -2.2 * pop - Math.sin(T * 7) * 0.12; s.eyes = 'happy'; s.mouth = 'open'; s.ear = -0.2; s.tail = Math.sin(T * 10) * 0.35; s.sparkle = true; break; }
      case 'proud': { const k = E.out(seg(T, 0, 0.35)); s.armL = s.armR = 0.55 * k; s.lean = -0.045 * k; s.headDy = -0.6 * k; s.eyes = T > 0.3 ? 'line' : 'happy'; s.mouth = 'smile'; s.ear = -0.15; s.tail = Math.sin(T * 6) * 0.25; s.sparkle = T < 1.2; break; }
      case 'nod': { s.headDy = Math.max(0, Math.sin(seg(T, 0, 0.9) * Math.PI * 4)) * 1.7; s.eyes = 'happy'; s.mouth = 'smile'; s.ear = 0.06; break; }
      case 'shake': { s.lookX = Math.sin(T * 13) > 0 ? 1 : -1; s.tilt = Math.sin(T * 13) * 0.05; s.eyes = 'line'; s.mouth = 'flat'; s.ear = 0.2; break; }
      case 'receive': { const k = E.out(seg(T, 0, 0.3)); s.armL = s.armR = -0.95 * k; s.lookY = T < 0.7 ? 0.6 : -0.1; s.eyes = T < 0.7 ? 'round' : 'happy'; s.mouth = T < 0.7 ? 'o' : 'smile'; s.ear = T < 0.7 ? -0.1 : -0.18; s.tail = T > 0.7 ? Math.sin(T * 8) * 0.3 : 0; break; }
      case 'shy': s.blush = 1; s.lookY = 1; s.tilt = 0.12 + Math.sin(T * 1.4) * 0.03; s.mouth = 'wave'; s.armL = s.armR = -0.3; s.ear = 0.18; s.headDy = 0.6; break;
      case 'angry': s.brows = 'angry'; s.mouth = 'frown'; s.lean = Math.sin(at * 20) * 0.02; s.ear = -0.25; s.tail = Math.sin(T * 14) * 0.15; s.armL = s.armR = 0.3; break;
      case 'sad': s.brows = 'worry'; s.mouth = 'frown'; s.lookY = 0.8; s.ear = 0.5; s.headDy = 1.4; s.lean = Math.sin(T * 0.8) * 0.02; s.tail = -0.2; s.armL = s.armR = 0.15; break;
      case 'surprised': { const dip = arc(T, 0, 0.07), pop = arc(T, 0.07, 0.45); s.eyes = 'wide'; s.mouth = 'o'; s.shock = true; s.squash = 1 - dip * 0.08 + pop * 0.08; s.lift = pop * 6 * A; s.armL = s.armR = -1.2 * pop; s.ear = -0.28 * pop; break; }
      case 'hurt': s.eyes = 'line'; s.sweat = true; s.mouth = 'wave'; s.ear = 0.35; break;
      case 'greet':
        if (b.greet === 'wave') { s.armR = -2.1 + Math.sin(at * 12) * 0.35 * A; s.mouth = 'smile'; s.ear = -0.08; s.tail = Math.sin(T * 8) * 0.25; }
        if (b.greet === 'bow') { s.headDy = Math.sin(Math.min(1, at * 1.5) * Math.PI) * 3; s.eyes = 'happy'; }
        if (b.greet === 'jump') { s.lift = Math.max(0, Math.sin(Math.min(1, at * 2) * Math.PI)) * b.jumpHeight; s.armL = s.armR = -1.4; s.eyes = 'happy'; s.mouth = 'open'; s.ear = 0.25 * Math.sin(Math.min(1, at * 2) * Math.PI); }
        if (b.greet === 'shy') { s.blush = 1; s.headDy = Math.sin(Math.min(1, at * 2) * Math.PI) * 1.5; s.mouth = 'wave'; }
        break;
      // Phase 4 life actions
      case 'read': s.squash = 0.9; s.lift = -3; s.lookY = 0.9; s.armL = -0.7; s.armR = -0.7; s.book = true; if (Math.sin(at * 0.9) > 0.97) s.eyes = 'line'; s.ear = (T % 6) < 0.4 ? 0.2 : 0.05; break;
      case 'think': s.lookY = -0.6; s.lookX = Math.sin(at * 0.4) * 0.6; s.armR = -1.1; s.mouth = 'flat'; s.tilt = Math.sin(at * 0.5) * 0.06; s.thought = true; break;
      case 'stretch': case 'yawn': { const q = Math.sin(at * 1.6); s.armL = s.armR = -2.3 - q * 0.2; s.eyes = 'line'; s.mouth = 'o'; s.lift = Math.max(0, q) * 2; s.squash = 1 + Math.max(0, q) * 0.05; s.ear = -0.1; break; }
      case 'tend': s.headDy = 1.5; s.lookY = 1; s.armR = -0.6 + Math.sin(at * 3) * 0.25; s.mouth = 'smile'; s.can = true; break;
      case 'talk': s.mouth = Math.sin(at * 14) > 0 ? 'open' : 'smile'; s.armR = -0.4 + Math.sin(at * 3) * 0.2 * A; s.headDy = Math.max(0, Math.sin(at * 5)) * 0.5; s.ear = Math.sin(at * 2) * 0.05; break;
      case 'dance': s.lift = Math.abs(Math.sin(at * 5)) * 4 * A; s.lean = Math.sin(at * 2.5) * 0.12 * A; s.armL = -1.8 + Math.sin(at * 5) * 0.5; s.armR = -1.8 - Math.sin(at * 5) * 0.5; s.eyes = 'happy'; s.mouth = 'open'; s.tail = Math.sin(at * 10) * 0.35; s.ear = Math.sin(at * 5) * 0.12; break;
      case 'sing': s.mouth = Math.sin(T * 6) > 0 ? 'open' : 'o'; s.eyes = 'happy'; s.lean = Math.sin(T * 2) * 0.06 * A; s.armR = -1.3 + Math.sin(T * 2) * 0.2; s.notes = true; s.tail = Math.sin(T * 4) * 0.25; s.headDy = Math.max(0, Math.sin(T * 4)) * 0.4; break;
      case 'sketch': s.squash = 0.9; s.lift = -3; s.sketch = true; s.armR = -0.75 + Math.sin(T * 7) * 0.12; s.armL = -0.7; s.lookY = (T % 5) < 1.2 ? -0.3 : 0.9; s.mouth = 'cat'; s.tilt = Math.sin(T * 0.7) * 0.04; break;
      case 'cry': s.brows = 'worry'; s.mouth = 'wave'; s.eyes = 'line'; s.tear = true; s.lookY = 0.8; s.ear = 0.5; s.lean = Math.sin(T * 9) * 0.015; break;
      case 'laugh': s.eyes = 'happy'; s.mouth = 'open'; s.lift = Math.abs(Math.sin(at * 9)) * 2 * A; s.lean = Math.sin(at * 9) * 0.03; s.ear = -0.1; break;
      case 'fish': s.rod = true; s.armR = -1.2; s.armL = -1; s.lookY = 0.6; s.mouth = 'cat'; s.rodBob = Math.sin(at * 2.2) * 0.6; s.ear = (T % 7) < 0.3 ? 0.2 : 0.05; break;
      case 'cook': s.pan = true; s.armR = -0.9 + Math.sin(at * 6) * 0.25; s.armL = -0.7; s.lookY = 0.8; s.mouth = 'smile'; break;
      case 'study': s.squash = 0.9; s.lift = -3; s.lookY = 1; s.book = true; s.armR = -0.6 + Math.sin(at * 5) * 0.15; s.mouth = 'flat'; break;
      case 'forage': s.headDy = 2; s.lookY = 1; s.armR = -0.4 + Math.abs(Math.sin(at * 4)) * 0.4; s.armL = -0.4; s.mouth = 'smile'; break;
      case 'browse': s.lookX = Math.sin(at * 0.8) > 0 ? 1 : -1; s.mouth = 'o'; s.eyes = s.eyes || 'round'; break;
      case 'pet': s.eyes = 'happy'; s.blush = 0.8; s.tail = Math.sin(at * 8) * 0.4; s.ear = 0.3; s.headDy = 0.6; break;
      case 'drag': s.eyes = 'wide'; s.mouth = 'o'; s.armL = s.armR = -1.3; s.ear = 0.3; break;
      case 'climb': s.walk = 1; s.armL = -1.6 + Math.sin(at * 8) * 0.4; s.armR = -1.6 - Math.sin(at * 8) * 0.4; break;
      case 'jump': { const crouch = arc(T, 0, 0.12), air = seg(T, 0.12, 0.5), land = arc(T, 0.5, 0.62); s.lift = Math.sin(Math.PI * air) * b.jumpHeight * A; s.squash = 1 - crouch * 0.12 + (air > 0 && air < 1 ? 0.06 * (1 - air) : 0) - land * 0.08; s.armL = s.armR = air > 0 && air < 1 ? -1.6 : 0.3 * crouch; s.ear = air > 0 && air < 1 ? 0.3 * Math.sin(Math.PI * air) : -0.1 * land; break; }
      default: break;
    }
    // walking / idle secondary motion (only when the action did not set it)
    if (!p.action || p.action === 'idle' || p.action === 'walk') {
      if (s.walk > 0.05) {
        const st = Math.sin((s.phase || 0) * Math.PI); s.armL = -s.walk * st * 0.6 * A; s.armR = s.walk * st * 0.6 * A;
        s.ear = 0.1 * Math.abs(st) * A * s.walk; s.tail = Math.sin((s.phase || 0) * Math.PI * 2) * 0.18 * s.walk;
        if (m.tired) { s.headDy = 1; s.lean = 0.03 * Math.sign(s.face || 1); }
      } else {
        // idle: weight shift, ear flick, tail by mood, look around, fatigue
        s.lean = Math.sin(T * 0.6 + m.seed) * 0.014 * A;
        const ef = (T + m.seed * 1.3) % 7.5; s.ear = ef < 0.5 ? Math.sin((ef / 0.5) * Math.PI) * 0.22 : 0;
        s.tail = b.habit === 'tailswish' || m.glad ? Math.sin(T * (m.glad ? 4 : 3)) * 0.3 : Math.sin(T * 1.4) * 0.1;
        if (b.lookAround) { s.lookX = Math.sin(at * 0.7) > 0.6 ? 1 : Math.sin(at * 0.7) < -0.6 ? -1 : 0; }
        if (b.habit === 'stretch' && (at % 9) > 8) { s.armL = s.armR = -2.2; s.eyes = 'line'; }
        if (m.tired) { droop(); s.eyes = s.eyes || 'sleepy'; if ((T % 11) > 10.2) { s.mouth = 'o'; s.eyes = 'line'; } }
      }
    }
    if (p.overrides) Object.assign(s, p.overrides);
    return s;
  }

  /** does this pose render from player frames? → { doc, mirror } | null */
  function spriteFor(c, p) {
    const r = OC.Anim.resolve(c, p.action || 'idle', p.dir || 'front');
    if (r) return r;
    return null;
  }
  /** reference height (frame px) used to scale every action of this character equally */
  function refH(c, doc) { return (c.appearance && c.appearance.refH) || (doc ? doc.h * 0.8 : 200); }

  /**
   * draw(ctx, c, pose, x, y, unitPx, t) — feet at (x, y); unitPx = canvas px per rig unit.
   * returns { sprite, doc, i, loading }
   */
  function draw(ctx, c, p, x, y, unitPx, t) {
    const sp = c.appearance.mode === 'sprite' || (c.actions && c.actions[p.action || 'idle']) ? spriteFor(c, p) : null;
    if (sp) {
      const doc = sp.doc, f = OC.Anim.frameAt(doc, p.at || 0, p.speed || 1), img = OC.Anim.composite(doc, f.i);
      if (!img) return { sprite: true, doc, i: f.i, loading: true };
      const a = doc.anchor || { x: doc.w / 2, y: doc.h * 0.9 }, k = (unitPx * RIG_H * (c.appearance.scale || 1)) / refH(c, doc);
      const breath = 1 + (p.breath || 0) * 0.008, sq = p.squash || 1;
      ctx.save(); ctx.translate(x + (doc.offset.x || 0) * k, y - (p.lift || 0) * unitPx + (doc.offset.y || 0) * k);
      ctx.rotate(p.lean || 0); ctx.scale((sp.mirror ? -1 : 1) * k / Math.sqrt(sq), k * sq * breath);
      ctx.drawImage(img, -a.x, -a.y);
      // overlay (blink) — suppressed in states that already have closed eyes
      if ((p.blink || 0) > 0.5) {
        const ov = OC.Anim.resolve(c, 'blink', p.dir || 'front');
        if (ov && ov.doc.category === 'overlay' && !(ov.doc.overlay.suppressIn || []).includes(p.action)) { const oi = OC.Anim.composite(ov.doc, 0); if (oi) { const oa = ov.doc.anchor || a; ctx.drawImage(oi, -oa.x, -oa.y); } }
      }
      // a held item (gift, food…) for frame animations too
      if (p.overrides && p.overrides.held) { const ic = OC.Style.itemCanvas(p.overrides.held, 64), rh = refH(c, doc), hp = (doc.points || {}).handR || { x: a.x + rh * 0.22, y: a.y - rh * 0.32 }; ctx.save(); ctx.translate(hp.x, hp.y); const k2 = (rh * 0.32) / 64; ctx.scale(sp.mirror ? -k2 : k2, k2); ctx.drawImage(ic, -32, -40); ctx.restore(); }
      // accessories on attach points
      const parts = (c.parts || []).filter((q) => q.visible !== false && !OC.Rig.REPLACE.has(q.slot));
      if (parts.length) {
        const rh = refH(c, doc), pts = doc.points || {}, head = pts.head || { x: a.x, y: a.y - rh * 0.78 }, rigK = rh / RIG_H;
        const at = { head, face: head, earL: { x: head.x - rh * 0.2, y: head.y - rh * 0.12 }, earR: { x: head.x + rh * 0.2, y: head.y - rh * 0.12 }, body: { x: a.x, y: a.y - rh * 0.3 }, tail: { x: a.x + rh * 0.14, y: a.y - rh * 0.2 }, handL: { x: a.x - rh * 0.2, y: a.y - rh * 0.25 }, handR: { x: a.x + rh * 0.2, y: a.y - rh * 0.25 }, feet: a };
        for (const q of parts) { const im = OC.Assets.peek(q.assetId), pt = at[q.anchor] || head; if (!im) continue; const s2 = (24 * (q.scale || 1) * rigK) / Math.max(im.width, im.height);
          ctx.save(); ctx.translate(pt.x + (q.x || 0) * rigK, pt.y + (q.y || 0) * rigK); ctx.rotate(((q.rot || 0) * Math.PI) / 180); ctx.scale((q.flip ? -1 : 1) * s2, s2); ctx.globalAlpha = q.opacity == null ? 1 : q.opacity; ctx.drawImage(im, -im.width / 2, -im.height / 2); ctx.restore(); }
      }
      ctx.restore();
      return { sprite: true, doc, i: f.i, mirror: sp.mirror, done: f.done };
    }
    const s = rigState(c, p, t); s.noShadow = p.noShadow !== false;
    OC.Rig.draw(ctx, c.look, s, x, y, unitPx, t, { parts: c.parts });
    return { sprite: false, state: s };
  }
  /** what draw() would show, without drawing (for change detection) */
  function plan(c, p) {
    const sp = c.appearance.mode === 'sprite' || (c.actions && c.actions[p.action || 'idle']) ? spriteFor(c, p) : null;
    if (!sp) return { sprite: false };
    const f = OC.Anim.frameAt(sp.doc, p.at || 0, p.speed || 1), ready = !!OC.Anim.composite(sp.doc, f.i);
    return { sprite: true, doc: sp.doc, i: f.i, mirror: sp.mirror, done: f.done, loading: !ready };
  }
  const FAST = new Set(['eat', 'drink', 'greet', 'happy', 'play', 'jump', 'surprised', 'climb', 'angry', 'pet', 'sit', 'sleep', 'taste', 'yum', 'yuck', 'cheer', 'proud', 'nod', 'shake', 'receive', 'sing', 'sketch', 'dance', 'talk', 'laugh', 'cry', 'run', 'yawn', 'stretch']);
  /** cache key: repaint a billboard/portrait only when this changes */
  function key(c, p, res) {
    if (res && res.sprite) return `S${res.doc.id}:${res.doc.updated}:${res.i}:${res.mirror ? 1 : 0}:${(p.blink || 0) > 0.5 ? 1 : 0}:${res.loading ? 'L' + Math.random() : ''}:${c.updated}:${(p.lift || 0).toFixed(1)}`;
    const q = (v, n) => Math.round((v || 0) * n);
    const loaded = (c.parts || []).reduce((n, pt) => n + (OC.Assets.peek(pt.assetId) ? 1 : 0), 0);
    return `R${c.updated}:${p.action}:${q(p.face, 4)}:${q(p.back, 3)}:${p.walk > 0.05 ? q((p.phase || 0) % 2, 4) : 'x'}:${(p.blink || 0) > 0.5 ? 1 : 0}:${p.eyes || ''}:${p.mouth || ''}:${q(p.at, FAST.has(p.action) ? 10 : p.action === 'idle' || !p.action ? 4 : 2)}:${q(p.lookX, 1)}:${loaded}:${q(p.blush, 2)}:${p.overrides && p.overrides.held || ''}`;
  }

  /** draw a character to fill a portrait canvas */
  function portrait(canvas, c, o = {}) {
    const x = canvas.getContext('2d'); x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, canvas.width, canvas.height);
    if (!c) return;
    const h = c.appearance.mode === 'sprite' ? RIG_H * 1.15 : OC.Rig.height(c.look) + 4;
    const unit = Math.min(canvas.height * (o.fill || 0.86) / h, canvas.width / 46);
    return draw(x, c, Object.assign({ action: 'idle', at: o.t || 0, dir: 'front', face: 0.15, noShadow: true }, o.pose || {}), canvas.width / 2, canvas.height * (o.feet || 0.95), unit * (o.scale || 1), o.t || 0);
  }
  /** for NPCs / presets that are not in the roster */
  const presetCache = {};
  function presetChar(key) { return presetCache[key] || (presetCache[key] = OC.Chars.fromPreset(key)); }

  OC.CharRender = { draw, plan, key, portrait, rigState, spriteFor, refH, presetChar, RIG_H, motion };
})();
