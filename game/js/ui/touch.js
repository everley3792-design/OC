/* OC Shimeji — direct touch on characters in the world (OC.Touch). 11.0: real stroking.
 *
 * A finger that lands on an OC belongs to that OC (OC.World claim hooks) — it never pans the camera:
 *   tap                           → context ring (OC.Radial) around the OC
 *   slide over the body           → STROKING: continuous, not a counter. The finger's speed, the body part under it (ears / head / cheek /
 *                                    belly / tail), how long it has been rubbing and the OC's own taste (hash-seeded favourite and disliked
 *                                    spots, ticklish or not, shy…) drive a 0–1 "contentment" level that reshapes the pose every frame
 *                                    (OC.Anim11.touchLayer): squint, blush, leaning into the finger, ears, tail, purr, melting, giggling,
 *                                    or pulling away when it is overdone / on a spot it dislikes. Hearts follow the finger, haptics tick
 *                                    along the stroke, a soft rustle / purr plays. Leaving the body ends it softly (no pick-up).
 *   hold still / drag out of body → pick up: the OC hangs under the finger and swings like a pendulum from the hands
 *   release                       → gentle drop, or a throw (ballistic arc, bounces, never leaves walkable ground)
 * Everything is driven by real time in requestAnimationFrame (frame-rate independent); data only changes through the existing
 * life APIs (Brain.hold / Mind.feel / Mind.needs / Mind.player) — see petEffects().
 */
(function () {
  'use strict';
  const A = () => OC.App, Wd = () => OC.World;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  let t = null, raf = 0;

  const isChar = (it) => it && (it.type === 'self' || it.type === 'mate');
  const idOf = (it) => (it.type === 'self' ? OC.Store.s.activeId : it.id);
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); };

  // ------------------------------------------------------------------ taste (each OC likes different spots; you discover them)
  const ZONES = ['head', 'cheek', 'ears', 'belly'];
  const ZONE_ZH = { head: '頭頂', cheek: '臉頰', ears: '耳朵', belly: '肚子', tail: '尾巴', feet: '腳' };
  /** deterministic taste from the OC's id (+ shy / sensitive traits): { likes, dislikes, ticklish } */
  function taste(c) {
    const h = hash(c.id || 'x'), likes = ZONES[h % 4], dis = ['tail', ZONES[(h >> 3) % 4]].filter((z) => z !== likes)[(h >> 7) % 2] || 'tail';
    const has = (k) => OC.Chars.has(c, k);
    return { likes, dislikes: dis, ticklish: ((h >> 5) % 3 === 0) || has('sensitive') || has('energetic'), shy: has('shy') };
  }
  /** what the player has found out so far (shown in the profile): zone → 1 (loves) / -1 (dislikes) */
  function known(c) { const L = c.life; return (L.touch || (L.touch = { known: {}, n: 0, total: 0 })); }

  // ------------------------------------------------------------------ geometry: which body part is under the finger
  function box(a) {
    const W = Wd(), lv = a.lvl || 0, gy = a.gy - lv * W.HY;
    const f = W.project(a.x, a.y, lv, gy + 0), hd = W.project(a.x, a.y, lv, gy + 62);
    return { cx: f.x, feet: f.y - (a.lift || 0) * 0.2, h: Math.max(30, f.y - hd.y) };
  }
  function zoneAt(a, p) {
    const b = box(a), fr = (b.feet - p.y) / b.h, dx = (p.x - b.cx) / b.h, ax = Math.abs(dx);
    const inside = ax < 0.6 && fr > -0.12 && fr < 1.12;
    let z = 'head';
    if (fr >= 0.9 && ax > 0.18) z = 'ears'; else if (fr >= 0.52) z = ax > 0.34 && fr < 0.78 ? 'cheek' : 'head'; else if (fr >= 0.2) z = (ax > 0.36 && fr < 0.42) ? 'tail' : 'belly'; else z = 'feet';
    return { z, inside, fr, dx };
  }

  // ------------------------------------------------------------------ gesture entry points (called by World's claim hooks)
  function down(r, p) {
    if (!isChar(r.it) || A().dlgOpen || A().curTab !== 'island' || A().placing) return false;
    const id = idOf(r.it), a = A().actorOf(id); if (!a) return false;
    if (flights.has(a)) return false;
    if (t) cancel();   // a stale gesture (its finger-up never arrived) is finished first: put down, never left hanging
    const now = performance.now(), c = OC.Chars.get(id);
    t = { id, a, c, x0: p.x, y0: p.y, lx: p.x, ly: p.y, t0: now, lastT: now, lastMove: now, dir: 0, rev: 0, lifted: false, moved: false, hist: [], swing: 0, swingV: 0, vxPrev: 0,
      // stroking state
      sp: 0, pend: 0, lv: 0, ann: 0, zone: 'head', ticklish: false, engaged: false, petT: 0, heartT: 0, hapT: 0, segLen: 0, tasteK: taste(c), stage: 0, dirS: 0, inBox: true, asleep: false, peakLv: 0, held: false, sess: { zones: {}, ms: 0 } };
    const me = t;
    // hold still → pick up (confirmed on the next frame: after a slow frame the queued moves are dispatched first)
    t.timer = setTimeout(() => requestAnimationFrame(() => { if (t === me && !t.moved && !t.lifted && !t.engaged && performance.now() - t.lastMove > 300) lift(true); }), 420);
    loop();
    return true;
  }

  function move(dp, p) {
    if (!t) return;
    const now = performance.now(), dxs = p.x - t.lx, dys = p.y - t.ly, dist = Math.hypot(dxs, dys);
    t.hist.push({ x: p.x, y: p.y, t: now }); while (t.hist.length > 2 && now - t.hist[0].t > 120) t.hist.shift();
    if (dist > 3) t.lastMove = now;
    const far = Math.hypot(p.x - t.x0, p.y - t.y0); if (far > 10) t.moved = true;
    if (t.lifted) { t.lx = p.x; t.ly = p.y; hold(dp, p, now); return; }
    const dtm = Math.max(8, now - (t.lastSample || now - 16)); t.lastSample = now;
    const speed = dist / (dtm / 1000);                        // px/s
    const zi = zoneAt(t.a, p); t.inBox = zi.inside; t.zone = zi.z;
    if (Math.abs(dxs) > 4) { const s = Math.sign(dxs); if (t.dirS && s !== t.dirS) t.rev++; t.dirS = s; }
    t.dirTarget = clamp(zi.dx * 2.2, -1, 1);                    // which side of the body the finger is on → the OC leans toward it
    if (zi.inside && dist > 0.5) {
      // a stroke: slow-to-medium speed is petting, a fast flick is just a swipe
      const q = speed < 30 ? 0 : speed > 1500 ? 0 : clamp(speed / 260, 0, 1) * (speed > 900 ? 0.4 : 1);
      t.sp = Math.max(t.sp * 0.6, q); t.pend += q * Math.min(0.08, dtm / 1000); t.segLen += dist;   // pend = "stroke-seconds" since the last frame (frame-rate independent)
       t.strokeLen = (t.strokeLen || 0) + dist * (q > 0 ? 1 : 0);
      if (!t.engaged && t.strokeLen > 34) engage();
      if (t.engaged) strokeFeedback(p, dist, q);
    } else if (!zi.inside) {
      // left the body: a straight pull away (no rubbing back and forth, not deep into contentment) picks the OC up;
      // after real rubbing it is just the end of the stroke (relax softly, never a surprise pick-up)
      if (t.rev < 2 && far > 24 && (!t.engaged || t.lv < 0.35)) lift(false, dp); else if (t.engaged) t.sp = 0;
    }
    t.lx = p.x; t.ly = p.y;
  }

  /** first real stroke: take the OC's attention (hold) and start the session */
  function engage() {
    if (t.engaged) return; t.engaged = true; clearTimeout(t.timer);
    const id = t.id, b = OC.Brain.get(id); t.asleep = !!(b && b.act === 'sleep' && b.st === 'do');
    if (!t.asleep) { t.held = !!OC.Brain.hold(id, 'pet'); t.a.path = null; }
    OC.Store.emit('touch:pet:start', { id });
  }

  function strokeFeedback(p, dist, q) {
    const now = performance.now(), lv = t.lv;
    // haptics: a soft tick every ~38 px of stroke, firmer as the OC melts
    t.hapT += dist; if (t.hapT > 38 && now - (t.hapLast || 0) > 85 && q > 0) { t.hapT = 0; t.hapLast = now; OC.UI.haptic(lv > 0.6 ? 'light' : 'tick'); }
    // rustle / purr
    if (OC.Sound && now - (t.sndLast || 0) > (lv > 0.55 ? 520 : 240) && q > 0.15) { t.sndLast = now; OC.Sound.play(lv > 0.55 ? 'purr' : 'stroke', { lv }); }
    // hearts follow the finger once it feels good
    if (lv > 0.3 && now - t.heartT > (lv > 0.7 ? 150 : 260) && !document.documentElement.classList.contains('lite')) { t.heartT = now; heartAt(p.x, p.y - 18, lv); }
  }
  function heartAt(x, y, lv) {
    const o = document.getElementById('overlays'); if (!o) return;
    const el = OC.UI.h('div.fx-p', { style: { left: x + 'px', top: y + 'px', color: lv > 0.75 ? 'var(--heart)' : 'var(--pink)', '--dx': (Math.random() - 0.5) * 30 + 'px', '--dy': -34 - Math.random() * 24 + 'px', fontSize: 12 + lv * 9 + 'px' } }, '♥');
    o.append(el); setTimeout(() => el.remove(), 1500);
  }

  function lift(still, dp) {
    if (!t || t.lifted) return;
    if (t.engaged) endStroke(true);
    const r = A().startCarry(t.id); if (!r) { t = null; return; }
    t.lifted = true; clearTimeout(t.timer);
    if (still) { OC.UI.haptic('long'); A().floatText(t.a, '!', 'var(--sun)'); }
    OC.Sound && OC.Sound.play('pickup'); OC.Store.emit('touch:lift', { id: t.id });
    if (dp) place(dp);
  }
  /** the OC hangs under the finger (feet a little below it), anywhere over the area while held */
  function place(dp) { const a = t.a; a.x = dp.x; a.y = dp.y + 10; a.lift = 24; }

  function hold(dp, p, now) {
    place(dp);
    const dt = Math.max(0.008, (now - t.lastT) / 1000); t.lastT = now;
    const vx = (p.x - (t.px == null ? p.x : t.px)) / dt; t.px = p.x;
    // the finger's change of velocity kicks the pendulum (an impulse — the same at 30, 60 or 120 Hz input)
    const dv = vx - t.vxPrev; t.vxPrev = vx;
    t.swingV += Math.max(-8, Math.min(8, -dv * 0.022));
  }

  function up(dp, p) {
    if (!t) return; const cur = t; t = null; clearTimeout(cur.timer);
    if (cur.engaged) { t = cur; endStroke(false); t = null; return; }
    if (!cur.lifted) {
      if (cur.moved) return;                              // a slip: nothing else
      A().menuFor({ type: cur.id === OC.Store.s.activeId ? 'self' : 'mate', id: cur.id }, A().screenOf(cur.a));
      return;
    }
    // release velocity (screen px/s) from the last ~100 ms
    const h0 = cur.hist[0], h1 = cur.hist[cur.hist.length - 1], dtv = h0 && h1 ? Math.max(0.016, (h1.t - h0.t) / 1000) : 1;
    const sv = h0 && h1 ? { x: (h1.x - h0.x) / dtv, y: (h1.y - h0.y) / dtv } : { x: 0, y: 0 }, speed = Math.hypot(sv.x, sv.y);
    const dv = Wd().screenDelta(sv.x, sv.y), cap = 520, m = Math.hypot(dv.x, dv.y) || 1, k = Math.min(1, cap / m);
    fly(cur, { vx: dv.x * k * 0.85, vy: dv.y * k * 0.85, vl: speed > 500 ? Math.min(150, speed * 0.12) : 0, strong: speed > 1300, swing: cur.swing, swingV: cur.swingV });
  }

  function cancel() { if (t && t.lifted) up(null, { x: t.lx, y: t.ly }); else if (t) { clearTimeout(t.timer); if (t.engaged) endStroke(true); t = null; } }

  // ------------------------------------------------------------------ the session: effects on the OC's life
  /** at the end of a stroking session: the OC's reaction + the real data changes (once per session, with cooldowns) */
  function endStroke(aborted) {
    const s = t; if (!s || !s.engaged || s.ended) return; s.ended = true;
    const { id, a, c } = s, peak = s.peakLv, K = known(c), st = s.tasteK;
    a.touch = null; a.key = '';
    // what this session taught about the OC's taste (shown in the profile as "喜歡被摸的地方")
    const zs = Object.entries(s.sess.zones).sort((x, y) => y[1] - x[1])[0];
    if (zs && zs[1] > 1.2) { if (zs[0] === st.likes && peak > 0.5) K.known[zs[0]] = 1; if (zs[0] === st.dislikes && s.ann > 0.5) K.known[zs[0]] = -1; }
    K.n++; K.total += s.sess.ms / 1000;
    if (peak >= 0.25) {
      petEffects(id, c, a, { peak, ann: s.ann, zone: zs ? zs[0] : 'head', asleep: s.asleep, ms: s.sess.ms, ticklish: st.ticklish });
      OC.Store.emit('touch:pet', { id, peak });
    }
    // the goodbye: leans in once more, or turns away when annoyed
    if (!s.asleep) {
      if (s.ann > 0.55) OC.World.setAction(a, 'turnaway', { dur: 1.6, priority: 7 });
      else if (peak > 0.8) OC.World.setAction(a, 'nuzzle', { dur: 1.6, priority: 7 });
      else if (peak > 0.3) OC.World.setAction(a, 'lookup', { dur: 1.4, priority: 7 });
    }
    if (s.held) setTimeout(() => OC.Brain.unhold(id, 'pet'), s.ann > 0.55 ? 1800 : peak > 0.3 ? 1700 : 300);
  }
  /** the only place stroking changes game data (aff/fam, social need, emotions, talk) — rewards are capped by game-time cooldowns */
  function petEffects(id, c, a, o) {
    const M = OC.Mind, Sim = OC.Sim, P = M.player(c), now = Sim.now();
    if (o.asleep) { M.player(c, { aff: 0.3 }); A().bubble(a, '（呼嚕……）', OC.Chars.name(c), 1.6); return; }
    const annoyed = o.ann > 0.55 || M.dominant(c) === 'annoyed';
    if (annoyed) { M.feel(c, 'annoyed', 0.3 + o.ann * 0.3, '被摸到不喜歡的地方'); const ln = OC.Talk.say('pet_dislike', c, null); if (ln) A().bubble(a, ln.text, OC.Chars.name(c)); return; }
    M.feel(c, OC.Chars.has(c, 'shy') ? 'shy' : o.peak > 0.7 ? 'content' : 'happy', 0.25 + o.peak * 0.4, '被你摸摸');
    M.needs(c, { social: 3 + o.peak * 7, comfort: o.peak * 4 });
    if (!P.petAt || now - P.petAt > 10) { M.player(c, { aff: o.peak > 0.7 ? 1.6 : 1, fam: 1 }); P.petAt = now; }
    const cat = { ears: 'pet_ears', cheek: 'pet_cheek', belly: 'pet_belly', tail: 'pet_tail' }[o.zone] || 'pet';
    const ln = OC.Talk.say(o.ticklish && o.zone === 'belly' ? 'pet_tickle' : cat, c, null) || OC.Talk.say('pet', c, null); if (ln) A().bubble(a, ln.text, OC.Chars.name(c));
    if (OC.Progress) OC.Progress.emit('pet', { oc: id });
    M.remember(c, { type: 'player', imp: 0.3 + o.peak * 0.2, text: o.peak > 0.7 ? '被你摸得好舒服' : '被你摸摸', key: 'pet:' + Math.floor(now / 90) });
  }

  // ------------------------------------------------------------------ flights (drop / throw)
  const flights = new Map();
  function fly(cur, o) {
    const a = cur.a; OC.Store.emit('touch:release', { id: cur.id, strong: o.strong });
    flights.set(a, { id: cur.id, vx: o.vx, vy: o.vy, vl: o.vl, bounces: 0, strong: o.strong, swing: o.swing, swingV: o.swingV, t: 0 });
    loop();
  }
  function stepFlight(a, f, dt) {
    const W_ = Wd(); f.t += dt;
    let nx = a.x + f.vx * dt, ny = a.y + f.vy * dt;
    // never off the ground: bounce off what is not walkable (walls, sea, cliffs)
    if (!W_.walkable(nx, a.y)) { f.vx = -f.vx * 0.4; nx = a.x; }
    if (!W_.walkable(a.x, ny)) { f.vy = -f.vy * 0.4; ny = a.y; }
    if (W_.walkable(nx, ny)) { a.x = nx; a.y = ny; }
    f.vl -= 620 * dt; a.lift = Math.max(0, a.lift + f.vl * dt);
    const drag = Math.exp(-dt * (a.lift > 0 ? 0.6 : 6)); f.vx *= drag; f.vy *= drag;
    // the swing settles while falling
    f.swingV += (-f.swing * 70 - f.swingV * 7) * dt; f.swing += f.swingV * dt; a.swing = f.swing;
    if (a.lift <= 0) {
      if (f.vl < -120 && f.bounces < 2) { f.vl = -f.vl * 0.38; f.bounces++; a.squashT = 0; OC.Sound && OC.Sound.play('jump'); return false; }
      if (Math.hypot(f.vx, f.vy) > 20 && f.t < 2.5) return false;   // still sliding to a stop
      return true;
    }
    return f.t > 4;   // safety
  }
  function land(a, f) {
    flights.delete(a); a.lift = 0; a.swing = 0;
    if (!Wd().walkable(a.x, a.y)) { const q = Wd().nearestWalkable(a.x, a.y, 80); if (q) { a.x = q.x; a.y = q.y; } }
    OC.UI.haptic(f.strong ? 'heavy' : 'light');
    A().dragEnd(null, { fling: f.strong ? 2 : f.bounces ? 1 : 0 });
    OC.Store.emit('touch:land', { id: f.id, strong: f.strong });
  }

  // ------------------------------------------------------------------ per-frame update (real time, small sub-steps)
  function stroking(dt) {
    const s = t; if (!s || !s.engaged || s.lifted || s.ended) return;
    const a = s.a, st = s.tasteK, z = s.zone, now = performance.now();
    s.sp *= Math.exp(-dt * 7);                                     // the stroke "energy" fades when the finger stops
    const gs = s.inBox ? s.pend : 0; s.pend = 0; const g = gs > 0 ? 1 : (s.inBox ? s.sp : 0);
    const liked = z === st.likes ? 1.7 : z === st.dislikes ? -1 : z === 'feet' ? -0.4 : 1, ticklish = st.ticklish && (z === 'belly' || z === 'ears');
    // contentment grows with gentle strokes on nice spots, slowly shrinks otherwise
    if (liked > 0) s.lv = clamp(s.lv + gs * (0.9 * liked) * (st.shy && s.lv < 0.3 ? 0.7 : 1) - dt * (g > 0.05 ? 0.02 : 0.16) * (s.ann > 0.3 ? 2 : 1));
    else { s.ann = clamp(s.ann + gs * 0.9 * (liked < -0.5 ? 1.3 : 0.7)); s.lv = clamp(s.lv - dt * 0.2); }
    if (liked > 0) s.ann = clamp(s.ann - dt * 0.12);
    // over-petting without a break: after ~14 s of continuous rubbing, even a happy OC has had enough
    s.sess.ms += dt * 1000; if (gs > 0) s.sess.zones[z] = (s.sess.zones[z] || 0) + gs;
    if (s.sess.ms > 14000 && s.lv > 0.9) s.ann = clamp(s.ann + dt * 0.1);
    s.peakLv = Math.max(s.peakLv, s.lv);
    // pose layer: smooth the lean toward the side the finger is on
    s.dirS2 = (s.dirS2 || 0) + ((s.dirTarget || 0) - (s.dirS2 || 0)) * Math.min(1, dt * 8);
    a.touch = { lv: s.asleep ? Math.min(s.lv, 0.4) : s.lv, zone: z === 'feet' ? 'belly' : z, dir: s.dirS2, ticklish, annoyed: s.ann > 0.5 };
    // stage events: first purr, the OC speaks, melting
    const stage = s.lv > 0.85 ? 3 : s.lv > 0.55 ? 2 : s.lv > 0.25 ? 1 : 0;
    if (stage > s.stage) {
      s.stage = stage;
      OC.UI.haptic(stage === 3 ? 'confirm' : 'light');
      if (stage === 1) OC.Store.emit('touch:pet', { id: s.id, peak: s.lv });
      if (stage === 2 && !s.asleep) { const ln = OC.Talk.say({ ears: 'pet_ears', cheek: 'pet_cheek', belly: ticklish ? 'pet_tickle' : 'pet_belly' }[z] || 'pet', s.c, null); if (ln) A().bubble(a, ln.text, OC.Chars.name(s.c), 2.2); }
      if (stage === 3 && !s.asleep) { a.run = false; OC.World.setAction(a, 'melt', { dur: 30, priority: 7 }); A().floatText(a, '♡', 'var(--heart)'); }
    } else if (stage < s.stage) { s.stage = stage; if (a.act && a.act.action === 'melt') OC.World.setAction(a, 'idle'); }
    if (s.ann > 0.55 && !s.annoyedShown) { s.annoyedShown = true; OC.UI.haptic('error'); OC.World.setAction(a, 'turnaway', { dur: 30, priority: 7 }); const ln = OC.Talk.say('pet_dislike', s.c, null); if (ln) A().bubble(a, ln.text, OC.Chars.name(s.c), 2); }
    if (s.ann < 0.3 && s.annoyedShown) { s.annoyedShown = false; if (a.act && a.act.action === 'turnaway') OC.World.setAction(a, 'idle'); }
  }

  function loop() {
    if (raf) return;
    let last = performance.now();
    const step = (now) => {
      // real time in small sub-steps: a slow device must not throw in slow motion (or explode with big steps)
      let left = Math.min(0.5, (now - last) / 1000); last = now;
      while (left > 1e-4) {
        const dt = Math.min(0.02, left); left -= dt;
        if (t && t.lifted) { // pendulum while held (pivot at the hands; damped)
          t.swingV += (-t.swing * 60 - t.swingV * 5) * dt; t.swing = Math.max(-0.75, Math.min(0.75, t.swing + t.swingV * dt)); t.a.swing = t.swing;
        }
        stroking(dt);
        for (const [a, f] of [...flights]) if (stepFlight(a, f, dt)) land(a, f);
      }
      if (t || flights.size) raf = requestAnimationFrame(step); else raf = 0;
    };
    raf = requestAnimationFrame(step);
  }

  // the app going to the background / losing focus while an OC is held: put it down (the finger-up will never come)
  document.addEventListener('visibilitychange', () => { if (document.hidden && t) cancel(); });
  window.addEventListener('blur', () => { if (t) cancel(); });
  OC.Touch = { down, move, up, cancel, taste, known, ZONE_ZH, get active() { return !!t; }, get petting() { return t && t.engaged && !t.lifted ? t.id : null; }, get level() { return t ? t.lv : 0; }, get flying() { return flights.size; } };
})();
