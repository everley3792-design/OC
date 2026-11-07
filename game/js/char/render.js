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

  /** procedural pose for an action, flavoured by personality quirks */
  function rigState(c, p, t) {
    const b = OC.Chars.behavior(c), at = p.at || 0, s = {
      face: p.face || 0, back: p.back || 0, walk: p.walk || 0, phase: p.phase || 0, breath: p.breath || 0, blink: p.blink || 0,
      lift: p.lift || 0, squash: p.squash || 1, lean: 0, eyes: p.eyes, mouth: p.mouth || b.face, blush: p.blush || 0, bounce: b.bounce, sway: b.sway, lookX: p.lookX || 0, lookY: 0,
    };
    switch (p.action) {
      case 'run': s.walk = 1; s.bounce *= 1.3; s.lean = 0.08 * Math.sign(s.face || 1); break;
      case 'sit': s.squash = 0.9; s.lift = -3; if (b.sit === 'flop') { s.lean = 0.16; s.eyes = s.eyes || 'sleepy'; } if (b.sit === 'swing') s.armL = Math.sin(at * 4) * 0.3; break;
      case 'sleep': s.blink = 1; s.eyes = 'sleepy'; s.mouth = 'cat'; s.breath = Math.sin(at * 1.6) * 2; s.zzz = b.sleep === 'snore'; if (b.sleep === 'curl') { s.squash = 0.84; s.lean = 0.25; } s.lift = -2; break;
      case 'eat': case 'drink': s.mouth = 'chew'; s.chewRate = 14 / (b.chew / 1.6); s.eyes = 'happy'; s.armR = -0.9; break;
      case 'play': case 'happy': s.eyes = 'happy'; s.mouth = 'open'; s.lift = Math.abs(Math.sin(at * 6)) * 4 * b.emoteScale; break;
      case 'shy': s.blush = 1; s.lookY = 1; s.tilt = 0.12; s.mouth = 'wave'; break;
      case 'angry': s.brows = 'angry'; s.mouth = 'frown'; s.lean = Math.sin(at * 20) * 0.02; break;
      case 'sad': s.brows = 'worry'; s.mouth = 'frown'; s.lookY = 0.8; break;
      case 'surprised': s.eyes = 'wide'; s.mouth = 'o'; s.shock = true; s.lift = Math.max(0, Math.sin(Math.min(1, at * 3) * Math.PI)) * 6; break;
      case 'hurt': s.eyes = 'line'; s.sweat = true; s.mouth = 'wave'; break;
      case 'greet':
        if (b.greet === 'wave') { s.armR = -2.1 + Math.sin(at * 12) * 0.35; s.mouth = 'smile'; }
        if (b.greet === 'bow') { s.headDy = Math.sin(Math.min(1, at * 1.5) * Math.PI) * 3; s.eyes = 'happy'; }
        if (b.greet === 'jump') { s.lift = Math.max(0, Math.sin(Math.min(1, at * 2) * Math.PI)) * b.jumpHeight; s.armL = s.armR = -1.4; s.eyes = 'happy'; s.mouth = 'open'; }
        if (b.greet === 'shy') { s.blush = 1; s.headDy = Math.sin(Math.min(1, at * 2) * Math.PI) * 1.5; s.mouth = 'wave'; }
        break;
      case 'pet': s.eyes = 'happy'; s.blush = 0.8; s.tail = Math.sin(at * 8) * 0.4; break;
      case 'drag': s.eyes = 'wide'; s.mouth = 'o'; s.armL = s.armR = -1.3; break;
      case 'climb': s.walk = 1; s.armL = -1.6 + Math.sin(at * 8) * 0.4; s.armR = -1.6 - Math.sin(at * 8) * 0.4; break;
      case 'jump': s.lift = Math.max(0, Math.sin(Math.min(1, at * 2) * Math.PI)) * b.jumpHeight; s.squash = at < 0.08 ? 0.9 : 1; break;
      default: // idle / breath / walk
        if (b.habit === 'tailswish') s.tail = Math.sin(at * 3) * 0.35;
        if (b.lookAround && !s.walk) { s.lookX = Math.sin(at * 0.7) > 0.6 ? 1 : Math.sin(at * 0.7) < -0.6 ? -1 : 0; }
        if (b.habit === 'stretch' && !s.walk && (at % 9) > 8) { s.armL = s.armR = -2.2; s.eyes = 'line'; }
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
  /** cache key: repaint a billboard/portrait only when this changes */
  function key(c, p, res) {
    if (res && res.sprite) return `S${res.doc.id}:${res.doc.updated}:${res.i}:${res.mirror ? 1 : 0}:${(p.blink || 0) > 0.5 ? 1 : 0}:${res.loading ? 'L' + Math.random() : ''}:${c.updated}:${(p.lift || 0).toFixed(1)}`;
    const q = (v, n) => Math.round((v || 0) * n);
    const loaded = (c.parts || []).reduce((n, pt) => n + (OC.Assets.peek(pt.assetId) ? 1 : 0), 0);
    return `R${c.updated}:${p.action}:${q(p.face, 4)}:${q(p.back, 3)}:${p.walk > 0.05 ? q((p.phase || 0) % 2, 4) : 'x'}:${(p.blink || 0) > 0.5 ? 1 : 0}:${p.eyes || ''}:${p.mouth || ''}:${q(p.at, ['eat', 'drink', 'greet', 'happy', 'play', 'jump', 'surprised', 'climb', 'angry', 'pet', 'sit', 'sleep'].includes(p.action) ? 10 : 0.5)}:${q(p.lookX, 1)}:${loaded}:${q(p.blush, 2)}`;
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

  OC.CharRender = { draw, plan, key, portrait, rigState, spriteFor, refH, presetChar, RIG_H };
})();
