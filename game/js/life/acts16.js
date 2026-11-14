/* OC Shimeji 16.4 — more things to do (done where the character stands, or at the spot you chose: under that tree, by those flowers).
 * Every one uses an existing pose (its fallback chain is in OC.Chars.ACTIONS / OC.Anim11) and is offered by the menus of the ground,
 * trees, flower beds and the character itself. Effects are per game hour, like every activity. Some only make sense at a time of day
 * (stars at night, clouds by day) — OC.Queue refuses those with the reason, and the AI does not pick them then (score below).
 */
(function () {
  'use strict';
  const D = OC.LifeData;
  const NEW = {
    dance: { zh: '跳舞', ic: '💃', verb: null, fx: { fun: 160, active: 140, energy: -25, mood: 10 }, dur: [5, 9], anim: 'dance', cat: 'fun' },
    stargaze: { zh: '看星星', ic: '🌌', verb: null, fx: { fun: 50, interest: 60, comfort: 30 }, dur: [10, 20], anim: 'stargaze', sed: true, look: true, cat: 'fun', night: true },
    cloudwatch: { zh: '看雲', ic: '☁️', verb: null, fx: { fun: 40, comfort: 50, energy: 15 }, dur: [10, 18], anim: 'lie', sed: true, cat: 'rest', day: true },
    meditate: { zh: '冥想', ic: '🧘', verb: null, fx: { comfort: 120, energy: 40, interest: 10 }, dur: [10, 18], anim: 'sit', sed: true, cat: 'rest' },
    treehug: { zh: '抱抱樹', ic: '🌳', verb: null, fx: { comfort: 50, fun: 20 }, dur: [2, 4], anim: 'hug', cat: 'fun', menuOnly: true },
    smell: { zh: '聞花香', ic: '🌸', verb: null, fx: { comfort: 40, interest: 20, fun: 20 }, dur: [2, 5], anim: 'sniff', cat: 'fun', menuOnly: true },
    diary: { zh: '寫日記', ic: '📔', verb: null, fx: { interest: 50, comfort: 40 }, dur: [8, 14], anim: 'write', sed: true, cat: 'fun' },
    spin: { zh: '轉圈圈', ic: '🌀', verb: null, fx: { fun: 60, active: 60 }, dur: [2, 4], anim: 'spin', cat: 'body' },
    sweep: { zh: '打掃', ic: '🧹', verb: null, fx: { comfort: 20, active: 80, energy: -10 }, dur: [6, 10], anim: 'sweep', cat: 'chore' },
    photo: { zh: '拍照留念', ic: '📷', verb: null, fx: { fun: 40, interest: 40 }, dur: [2, 4], anim: 'photo', cat: 'fun', menuOnly: true },
    workout: { zh: '運動', ic: '🏋️', verb: null, fx: { active: 300, energy: -40, fun: 10 }, dur: [6, 10], anim: 'squat', cat: 'body' },
  };
  Object.assign(D.ACTS, NEW);
  /* where they can also happen while the character is away (abstract life) */
  const OUT = ['dance', 'stargaze', 'cloudwatch', 'meditate', 'spin', 'photo', 'workout'], IN = ['dance', 'meditate', 'diary', 'sweep', 'spin', 'workout'];
  for (const [id, P0] of Object.entries(OC.Places.P)) { if (!P0 || !P0.acts) continue; for (const a of P0.interior ? IN : OUT) if (!P0.acts.includes(a)) P0.acts.push(a); }
  /* the AI never does the "menu only" ones by itself (hugging a tree, smelling flowers, a photo need a place you chose) and respects day/night */
  const NIGHT = ['evening', 'night', 'late'];
  OC.Acts16 = {
    NEW,
    fits(act) { const A = D.ACTS[act]; if (!A) return false; const ph = OC.Clock.phase(OC.Clock.hour()), wx = OC.Clock.weather(); if (A.night && !NIGHT.includes(ph)) return false; if (A.day && (NIGHT.includes(ph) || ['rain', 'storm', 'snow'].includes(wx))) return false; return true; },
    auto(act) { const A = D.ACTS[act]; return !(A && A.menuOnly) && this.fits(act); },
    /** places where an activity happens (for a request at another place) */
    placesFor(act) { const A = D.ACTS[act]; if (!A) return []; return Object.entries(OC.Places.P).filter(([id, P0]) => P0 && OC.Places.open(id) && (P0.acts || []).includes(act)).map(([id]) => id); },
  };
})();
