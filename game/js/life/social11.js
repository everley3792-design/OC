/* OC Shimeji 11.0 — OC.Social11: ten more paired interactions (hug · high-five · dance · selfie · rock-paper-scissors · tickle · head pat ·
 * whisper · lean on a shoulder · peekaboo) with matching animations for BOTH characters (A and B perform complementary actions in sync, step
 * toward each other a little, react by personality). Registered into LifeData.SOCIAL; brain.js asks cands() for candidates, script() for the
 * line-by-line performance and fx() for what it changes (relationship, needs, mood, memory). Data-driven: adding a kind = one entry below.
 */
(function () {
  'use strict';
  const D = OC.LifeData, M = () => OC.Mind, Ch = () => OC.Chars, has = (c, t) => Ch().has(c, t), Sim = () => OC.Sim;
  const k01 = (v) => Math.max(0, Math.min(1, v / 100));
  const def = (v) => Math.max(0, (100 - v) / 100);
  const glad = (e) => e === 'happy' || e === 'excited';
  const neg = (e) => ['down', 'lonely', 'tired', 'annoyed'].includes(e);
  const KINDS = {
    hug: { zh: '擁抱', ic: '🤗',
      cands: (c, o, r, s0, x) => (r.aff >= 35 ? (neg(x.oe) && M().intensity(o, x.oe) > 0.3 ? 0.5 : 0) + (r.fam >= 40 ? 0.1 : 0) + (has(c, 'gentle') || has(c, 'outgoing') ? 0.15 : 0) - (has(c, 'shy') ? 0.2 : 0) + (r.aff - 35) / 250 : null),
      script: (conv, say) => { say('a', 'hug_a', { anim: 'hugme', dur: 0.9, nudge: 0.3 }); say('b', 'gesture', { anim: 'hug', other: 'hug', dur: 2.4, nudge: 1 }); say('b', 'hug_b', { anim: 'happy' }); },
      fx: () => [{ fam: 2, aff: 6, trust: 3, intim: 3 }, { social: 18, comfort: 10 }, '和{other}擁抱', 0.6, 'content'] },
    highfive: { zh: '擊掌', ic: '🙌',
      cands: (c, o, r, s0, x) => (r.aff >= 20 && (glad(x.myE) || glad(x.oe)) ? 0.05 + (has(c, 'energetic') || has(c, 'cheerful') ? 0.2 : 0) : null),
      script: (conv, say) => { say('a', 'hf_a', { anim: 'highfive', other: 'highfive', dur: 1.0, nudge: 0.6 }); say('b', 'hf_b', { anim: 'cheer' }); },
      fx: () => [{ aff: 3, fam: 1 }, { social: 8, fun: 8 }, '和{other}擊掌', 0.3, 'excited'] },
    dance: { zh: '一起跳舞', ic: '💃',
      cands: (c, o, r, s0) => (r.aff >= 25 && c.needs.energy > 40 && o.needs.energy > 40 && c.needs.fun < 75 ? 0.05 + 0.3 * def(c.needs.fun) + (has(c, 'cheerful') || has(c, 'energetic') ? 0.2 : 0) - (has(c, 'shy') ? 0.2 : 0) : null),
      script: (conv, say) => { say('a', 'dance_a', { anim: 'twirl', other: 'twirl', dur: 3.4, nudge: 0.6 }); say('b', 'dance_b', { anim: 'laugh' }); },
      fx: () => [{ aff: 4, fam: 3 }, { social: 14, fun: 22, active: 25, energy: -8 }, '和{other}一起跳舞', 0.5, 'excited'] },
    selfie: { zh: '一起自拍', ic: '🤳',
      cands: (c, o, r, s0) => (r.aff >= 30 && OC.Clock.weather() !== 'rain' && OC.Clock.phase() !== 'night' ? -0.05 + (has(c, 'artsy') ? 0.2 : 0) + (has(c, 'cheerful') ? 0.1 : 0) : null),
      script: (conv, say) => { say('a', 'selfie_a', { anim: 'selfie', other: 'selfie', dur: 3.0, nudge: 0.9 }); say('b', 'selfie_b', { anim: 'peace' }); },
      fx: () => [{ aff: 4, fam: 2 }, { social: 10, fun: 12 }, '和{other}一起自拍', 0.45, 'happy'] },
    rps: { zh: '猜拳', ic: '✊',
      cands: (c, o, r, s0) => (r.aff >= 10 && c.needs.fun < 70 ? 0.1 * def(c.needs.fun) + (has(c, 'cheerful') ? 0.1 : 0) : null),
      script: (conv, say) => { conv.rpsWin = Sim().rnd() < 0.5 ? 'a' : 'b'; say('a', 'rps_a', { anim: 'rps', other: 'rps', dur: 1.5 });
        say(conv.rpsWin, 'rps_win', { anim: 'rps_win', other: 'rps_lose', dur: 1.7 }); },
      fx: () => [{ aff: 2, fam: 2 }, { social: 8, fun: 14 }, '和{other}猜拳', 0.3, 'happy'] },
    tickle: { zh: '搔癢', ic: '🤭',
      cands: (c, o, r, s0) => (c.personality.expression > 55 && r.aff >= 40 ? -0.15 + (has(c, 'cheerful') ? 0.15 : 0) - (has(o, 'sensitive') ? 0.3 : 0) : null),
      script: (conv, say, A, B, r) => { conv.tickleOk = r.aff / 100 + (Sim().rnd() - 0.5) * 0.5 - (has(B, 'sensitive') ? 0.3 : 0) > 0.2; say('a', 'tickle_a', { anim: 'tickle', other: 'ticklish', dur: 1.8, nudge: 0.8 }); say('b', conv.tickleOk ? 'tickle_ok' : 'tickle_bad', { anim: conv.tickleOk ? 'laugh' : 'angry' }); },
      fx: (conv) => (conv.tickleOk ? [{ aff: 4, fam: 3 }, { social: 10, fun: 14 }, '和{other}鬧著玩（搔癢）', 0.35, 'happy'] : [{ aff: -3, conflict: 6 }, { social: 3 }, '被{other}搔癢，有點受不了', 0.4, 'annoyed']) },
    pat: { zh: '拍拍頭', ic: '🖐',
      cands: (c, o, r, s0, x) => (r.aff >= 25 && (has(c, 'gentle') || has(c, 'outgoing') || neg(x.oe)) ? -0.12 + (neg(x.oe) ? 0.2 : 0) : null),
      script: (conv, say) => { say('a', 'pat_a', { anim: 'pat', other: 'patted', dur: 1.8, nudge: 0.5 }); say('b', 'pat_b', { anim: 'shy' }); },
      fx: () => [{ aff: 4, fam: 1, trust: 2 }, { social: 10, comfort: 6 }, '被{other}拍拍頭', 0.35, 'shy'] },
    whisper: { zh: '說悄悄話', ic: '🤫',
      cands: (c, o, r, s0) => (r.trust >= 35 && r.fam >= 30 ? -0.1 + (r.intim || 0) / 200 : null),
      script: (conv, say) => { say('a', 'whisper_a', { anim: 'whisper', other: 'listen', dur: 2.2, nudge: 0.8 }); say('b', 'whisper_b', { anim: 'shy' }); },
      fx: () => [{ aff: 3, trust: 7, intim: 5, fam: 2 }, { social: 12 }, '和{other}說了悄悄話', 0.55, 'shy'] },
    leanOn: { zh: '靠在肩膀上', ic: '🥺',
      cands: (c, o, r, s0, x) => (r.aff >= 45 && (neg(x.myE) || c.needs.energy < 40) ? 0.2 + (c.needs.energy < 30 ? 0.2 : 0) : null),
      script: (conv, say) => { say('a', 'lean_a', { anim: 'lean_on', other: 'shoulder', dur: 3.2, nudge: 1 }); say('b', 'lean_b', { anim: 'happy' }); },
      fx: () => [{ aff: 5, trust: 5, intim: 4 }, { social: 12, comfort: 14, energy: 6 }, '靠著{other}的肩膀休息了一下', 0.55, 'content'] },
    peekaboo: { zh: '躲貓貓', ic: '🙈',
      cands: (c, o, r, s0) => (c.personality.expression > 55 && has(c, 'cheerful') && r.fam >= 20 ? -0.2 + 0.15 * def(c.needs.fun) : null),
      script: (conv, say) => { say('a', 'peek_a', { anim: 'peekaboo', other: 'stunned', dur: 1.7 }); say('b', 'peek_b', { anim: 'laugh' }); },
      fx: () => [{ aff: 3, fam: 2 }, { social: 8, fun: 12 }, '和{other}玩躲貓貓', 0.3, 'happy'] },
  };
  for (const [id, k] of Object.entries(KINDS)) D.SOCIAL[id] = { zh: k.zh, ic: k.ic, gesture: true };
  OC.Social11 = {
    KINDS,
    /** add candidates for c → o (K(kind, score, why) pushes one) */
    cands(c, o, r, s0, K, myE, oe) {
      const x = { myE, oe };
      for (const [id, k] of Object.entries(KINDS)) { const v = k.cands(c, o, r, s0, x); if (v != null) K(id, s0 + v, k.zh); }
    },
    script(kind, conv, say, A, B, r) { const k = KINDS[kind]; if (k) { k.script(conv, say, A, B, r); return true; } return false; },
    fx(kind, conv) { const k = KINDS[kind]; return k ? k.fx(conv) : null; },
  };
})();
