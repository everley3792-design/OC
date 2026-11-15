/* OC Shimeji 16.9 — 職業與學業（OC.Career16）
 *
 *   rabbit holes   work and school happen out of sight: at the start of the shift / school day a character walks to the edge of
 *                  the place (the notice board / the door) and is gone until it ends ('work16' / 'school16', ACTS.away). Away from
 *                  you the same happens in the abstract life (c.life.cur). No office or classroom scenes are built.
 *   pay & grades   everything is read from the one progress stream (OC.Progress 'act' events from Mind.record): a finished shift
 *                  pays once per character and day through OC.Tx (key c16pay:<oc>:<day>), school days and homework raise grades,
 *                  freelance work moves a commission forward. Offline catch-up sends no progress events → no pay, no grades.
 *   careers        17 lines, 8 titles each: employed (fixed hours on weekdays, colleagues by name, performance, promotions) and
 *                  freelance (commissions with a client, a subject, a deadline and a fee; reputation; inspiration; portfolio;
 *                  finished works can be listed in a shop as workshop products — listed, never stocked).
 *   school         kindergarten, primary, middle school, adult classes; 15 subjects. Status: 在學 (goes by itself, attendance),
 *                  休學 (keeps its place, no classes), 自學 (studies on its own; slower progress, its own grade, no classmates),
 *                  不上學. Exams at the end of each season; graduation after enough terms; school fair / sports day.
 *   migration      the 15.2 part-time job (打工) history becomes level 1 「兼職」 of the matching career.
 */
(function () {
  'use strict';
  const D = () => OC.LifeData, M = () => OC.Mind, Sim = () => OC.Sim, B = () => OC.Brain, Ch = () => OC.Chars, S = () => OC.Store.s, St = () => OC.Store, W = () => OC.World;
  const has = (c, t) => !!(c && c.personality.traits.includes(t));
  const any = (c, ts) => ts.some((t) => has(c, t));
  const name = (c) => Ch().name(c);
  const stageOf = (c) => (OC.People && OC.People.stage(c) ? OC.People.stage(c).id : 'adult');
  /** a stable 0…1 number for any key (OC.hash only takes numbers) */
  const hs = (k) => { let x = 2166136261; for (const ch of String(k)) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619); } return ((x >>> 0) % 100000) / 100000; };
  const ageOf = (c) => (OC.People && OC.People.stage(c) ? OC.People.stage(c).age : 25);

  // ================================================================ data
  /* [id, 名稱, 類型 emp|free, 時薪 or 案件基本酬勞, 技能, 作品類型, 8 個職稱] */
  const LINES = [
    ['chef', '廚師', 'emp', 14, 'cook', null, ['兼職', '廚房助手', '備料員', '二廚', '熱炒師傅', '副主廚', '主廚', '行政主廚']],
    ['barista', '咖啡館店員', 'emp', 11, 'social', null, ['兼職', '見習店員', '咖啡師', '資深咖啡師', '值班組長', '副店長', '店長', '烘豆師']],
    ['librarian', '圖書館員', 'emp', 12, 'reading', null, ['兼職', '書架整理員', '流通櫃台', '參考諮詢員', '館藏規劃員', '資深館員', '副館長', '館長']],
    ['teacher', '教師', 'emp', 15, 'reading', null, ['兼職', '代課老師', '實習老師', '老師', '班導師', '學年主任', '教務主任', '校長']],
    ['nurse', '醫護', 'emp', 16, 'social', null, ['兼職', '照護助理', '實習護理師', '護理師', '專科護理師', '護理長', '督導', '院長']],
    ['postman', '郵差', 'emp', 11, 'sport', null, ['兼職', '分信員', '郵差', '資深郵差', '快遞組長', '郵務主任', '分局長', '郵政局長']],
    ['performer', '遊樂園演出', 'emp', 13, 'music', null, ['兼職', '布偶裝演員', '舞群', '主唱候補', '星光舞台主唱', '演出總監', '園區明星', '傳奇巨星']],
    ['shopkeep', '花店與小店店員', 'emp', 10, 'garden', null, ['兼職', '店員', '包花師', '櫥窗設計', '採購', '副店長', '店長', '連鎖店老闆']],
    ['illustrator', '插畫師', 'free', 120, 'art', 'art', ['新人插畫家', '接案插畫家', '雜誌插畫家', '封面繪師', '人氣繪師', '畫冊作者', '大師級插畫家', '傳說畫家']],
    ['writer', '作家', 'free', 110, 'reading', 'text', ['投稿新人', '專欄作者', '短篇作家', '小說家', '暢銷作家', '得獎作家', '文壇名家', '國民作家']],
    ['musician', '音樂人', 'free', 115, 'music', 'music', ['街頭樂手', '編曲助手', '作曲人', '獨立音樂人', '人氣歌手', '金曲製作人', '樂壇名人', '傳奇音樂家']],
    ['photographer', '攝影師', 'free', 105, 'art', 'photo', ['攝影新手', '活動攝影', '人像攝影', '旅遊攝影', '雜誌攝影', '攝影集作者', '名攝影師', '傳奇攝影師']],
    ['crafter', '工匠', 'free', 100, 'craft', 'craft', ['手作新手', '市集攤主', '木工學徒', '工房師傅', '人氣工匠', '工藝家', '名匠', '人間國寶']],
    ['programmer', '程式設計師', 'free', 130, 'reading', 'code', ['寫程式新手', '外包工程師', '網頁工程師', '遊戲工程師', '資深工程師', '架構師', '技術顧問', '傳奇駭客']],
    ['gardener', '園藝家', 'free', 95, 'garden', 'plant', ['園藝愛好者', '庭園幫手', '花壇設計', '景觀師', '溫室主人', '園藝作家', '名園設計師', '綠手指大師']],
    ['foodie', '料理研究家', 'free', 110, 'cook', 'recipe', ['料理部落客', '食譜投稿人', '料理講師', '食譜作家', '電視料理人', '料理研究家', '美食評論家', '國民料理家']],
    ['streamer', '直播主', 'free', 90, 'social', 'stream', ['新手直播主', '固定直播', '人氣直播主', '企劃直播主', '百萬訂閱', '跨界明星', '網路名人', '傳奇直播主']],
  ].map(([id, zh, type, base, skill, work, titles]) => ({ id, zh, type, base, skill, work, titles }));
  const LINE = Object.fromEntries(LINES.map((l) => [l.id, l]));
  const WORK_ZH = { art: '插畫', text: '文章', music: '曲子', photo: '照片', craft: '手作', code: '程式', plant: '庭園設計', recipe: '食譜', stream: '直播企劃' };
  const CLIENTS = ['港口麵包店', '晴日島報', '雲朵咖啡館', '風車磨坊', '彩虹遊樂園', '葉影圖書館', '苔光森林保護會', '星砂海灘商會', '島上的小學', '木木家具行', '星星禮品屋', '一位匿名的島民'];
  const TOPICS = { art: ['海報', '繪本插圖', '店招', '明信片', '角色設計'], text: ['短篇故事', '專欄', '導覽手冊', '詩', '訪談稿'], music: ['店裡的背景音樂', '主題曲', '生日歌', '廣告配樂', '搖籃曲'],
    photo: ['商品照', '活動紀錄', '風景明信片', '全家福', '菜單照片'], craft: ['木頭招牌', '陶杯', '手作飾品', '小板凳', '布偶'], code: ['訂位網頁', '庫存小程式', '小遊戲', '會員系統', '班表工具'],
    plant: ['花壇', '店門口的盆栽', '屋頂花園', '婚禮花藝', '藥草園'], recipe: ['季節新菜單', '便當食譜', '甜點食譜', '健康早餐', '節日料理'], stream: ['新店開幕直播', '料理直播', '遊戲實況', '島嶼導覽', '晚安聊天'] };
  const SUBJ = [['lang', '國語'], ['math', '數學'], ['sci', '自然'], ['soc', '社會'], ['eng', '英語'], ['art', '美術'], ['music', '音樂'], ['pe', '體育'], ['home', '家政'], ['life', '生活'], ['hist', '歷史'], ['geo', '地理'], ['phys', '物理'], ['chem', '化學'], ['code', '程式']];
  const SUBJ_ZH = Object.fromEntries(SUBJ);
  const LEVELS = {
    kinder: { zh: '幼兒園', stages: ['toddler'], subj: ['life', 'art', 'music', 'pe'], terms: 2 },
    elem: { zh: '小學', stages: ['child'], subj: ['lang', 'math', 'sci', 'soc', 'eng', 'art', 'music', 'pe'], terms: 6 },
    middle: { zh: '中學', stages: ['teen'], subj: ['lang', 'math', 'eng', 'hist', 'geo', 'phys', 'chem', 'pe', 'home'], terms: 4 },
    adult: { zh: '成人進修', stages: ['adult', 'middle', 'elder'], subj: ['eng', 'code', 'home', 'art', 'music'], terms: 2 },
  };
  const STATUS = { enrolled: '在學', leave: '休學', self: '自學', none: '不上學' };
  const WORK_H = [9, 15], SCHOOL_H = [8, 14];

  /* the activities (rabbit holes are hidden while they last; none of these appear in menus) */
  Object.assign(D().ACTS, {
    work16: { zh: '上班', ic: '💼', verb: null, fx: { energy: -12, fun: -8, social: 12, interest: 10 }, dur: [300, 330], anim: 'idle', cat: 'chore', aw16: true, away: true, lock: true },
    school16: { zh: '上學', ic: '🎒', verb: null, fx: { energy: -10, social: 18, interest: 24, fun: 6 }, dur: [300, 300], anim: 'idle', cat: 'chore', aw16: true, away: true, lock: true },
    homework16: { zh: '寫作業', ic: '✏️', verb: null, fx: { interest: 60, fun: -10, energy: -8 }, dur: [25, 40], anim: 'write', sed: true, cat: 'chore', aw16: true },
    freelance16: { zh: '接案工作', ic: '🖋️', verb: null, fx: { interest: 50, energy: -14, fun: 10 }, dur: [40, 70], anim: 'write', sed: true, cat: 'chore', aw16: true },
  });

  // ================================================================ state
  function st(c) {
    const l = c.life, x = l.c16 || (l.c16 = {});
    x.school = x.school || { status: null, level: null, grades: {}, att: { days: 0, missed: 0 }, terms: 0, self: 0, grad: [], exams: [] };
    x.job = x.job || null; x.works = x.works || []; x.insp = x.insp == null ? 70 : x.insp; x.rep = x.rep || 0;
    return x;
  }
  /** the school level a character belongs to now (by life stage) */
  function levelFor(c) { const s = stageOf(c); for (const [k, L] of Object.entries(LEVELS)) if (L.stages.includes(s)) return k; return null; }
  function schoolOf(c) {
    const X = st(c).school, lv = levelFor(c);
    if (X.status == null) X.status = lv && lv !== 'adult' ? 'enrolled' : 'none';   /* children go to school; adults choose */
    if (X.level !== lv) { if (X.level && X.status === 'enrolled' && !X.grad.includes(X.level)) X.terms = 0; if (!X.chosen && lv && lv !== 'adult' && X.status === 'none') X.status = 'enrolled';   /* a child goes to school unless you decided otherwise */
      X.level = lv; for (const s of (LEVELS[lv] || { subj: [] }).subj) if (X.grades[s] == null) X.grades[s] = 40; }
    if (!lv) X.status = 'none';
    return X;
  }
  function setSchool(id, status) {
    const c = Ch().get(id); if (!c || !STATUS[status]) return { ok: false, why: '找不到' };
    const lv = levelFor(c); if (!lv && status !== 'none') return { ok: false, why: '嬰兒還不能上學' };
    const X = schoolOf(c), old = X.status; X.status = status; X.chosen = true;
    if (old !== status) M().remember(c, { type: 'event', imp: 0.35, text: status === 'enrolled' ? `開始上${LEVELS[lv].zh}` : status === 'leave' ? '休學了一陣子' : status === 'self' ? '開始在家自學' : '不再上學', key: `sch:${id}:${status}:${Sim().day()}` });
    St().touch('life', { career: id }); return { ok: true };
  }
  const jobOf = (c) => st(c).job;
  function title(c) { const j = jobOf(c); if (!j) return ''; const L = LINE[j.line]; return L.titles[Math.min(L.titles.length - 1, j.lv - 1)]; }
  /** can this character take this line? */
  function canTake(c, line) {
    const L = LINE[line]; if (!L) return '沒有這個職業'; const a = ageOf(c);
    if (a < 15) return '年紀還太小'; if (L.type === 'emp' && a < 16) return '16 歲才能受僱';
    return null;
  }
  function takeJob(id, line) {
    const c = Ch().get(id); if (!c) return { ok: false, why: '找不到' }; const why = canTake(c, line); if (why) return { ok: false, why };
    const L = LINE[line], X = st(c), old = X.job;
    X.job = { line, lv: 1, perf: 0, days: 0, since: Sim().day(), att: 0, miss: 0, cases: [], done: 0 };
    if (ageOf(c) < 18 && L.type === 'emp') X.job.cap = 2;   /* teenagers stay part-time */
    M().remember(c, { type: 'event', imp: 0.5, text: `開始當${L.zh}（${L.titles[0]}）`, key: `job:${id}:${line}:${Sim().day()}` });
    if (old && old.line !== line) M().remember(c, { type: 'event', imp: 0.3, text: `不再當${LINE[old.line].zh}了`, key: `quit:${id}:${old.line}:${Sim().day()}` });
    St().touch('life', { career: id }); OC.Progress && OC.Progress.emit('career', { oc: id, line, lv: 1 }); return { ok: true };
  }
  function quitJob(id) { const c = Ch().get(id); if (!c || !jobOf(c)) return { ok: false }; const L = LINE[jobOf(c).line]; st(c).job = null; M().remember(c, { type: 'event', imp: 0.35, text: `辭掉了${L.zh}的工作`, key: `quit:${id}:${L.id}:${Sim().day()}` }); St().touch('life', { career: id }); return { ok: true }; }

  // ================================================================ schedule (every game minute)
  const today = () => (OC.Clock.cal ? OC.Clock.cal() : { weekday: Sim().day() % 7, weekend: false, day: 1 });
  const hr = () => OC.Clock.hour();
  function inWindow(h, w) { return h >= w[0] && h < w[0] + 1.5; }
  /** where a rabbit hole begins on this map: the notice board / the door */
  function awayPoint() {
    const A = W().area; if (!A) return null; const ex = (A.exits || []).find((e) => e.to === 'map') || (A.exits || [])[0];
    const p = ex ? W().nearestWalkable(ex.x, ex.y - 6, 30) : null; return p || W().nearestWalkable(A.spawn.x, A.spawn.y, 40);
  }
  function busyNow(c, b) { if (b) return b.holds.size || b.st === 'event' || (b.st === 'do' && ['sleep', 'work16', 'school16'].includes(b.act)); const cu = c.life.cur; return cu && cu.until > Sim().now() && ['sleep', 'work16', 'school16'].includes(cu.act); }
  function goAway(c, act) {
    const b = B().get(c.id), day = Sim().day(), X = st(c), k = act === 'work16' ? 'w' : 's';
    if ((X.went || {})[k] === day) return false;
    if (OC.Health16 && OC.Health16.staysHome(c)) { if (!(X.sick16 = X.sick16 || {})[day]) { X.sick16[day] = k; const ks = Object.keys(X.sick16); if (ks.length > 14) delete X.sick16[ks[0]]; OC.Store.touch('life'); } return false; }   /* 16.11: a sick day, not a missed one */
    if (busyNow(c, b)) return false;
    (X.went = X.went || {})[k] = day;
    if (b && b.a) {
      const p = awayPoint(); if (!p) return false;
      if (OC.Queue) OC.Queue.add(c.id, { kind: 'act', act, pt: { x: p.x, y: p.y, k: act } }, { now: true }); else { b.queuedPt = { x: p.x, y: p.y, k: act }; B().command(c.id, act); }
      if (OC.App && OC.App.bubble && S().life.settings.bubbles) { const ln = OC.Talk.say(act === 'work16' ? 'c16_go_work' : 'c16_go_school', c, null); if (ln) OC.App.bubble(b.a, ln.text, name(c), 2.2); }
    } else {
      const now = Sim().now(), A = D().ACTS[act], dur = A.dur[0];
      c.life.cur = { act, t0: now, until: now + dur, place: 'place:' + (c.life.loc || 'isle'), placeZh: act === 'work16' ? '上班中' : '上學中', abstract: true };
    }
    return true;
  }
  function step() {
    if (Sim().catching || S().life.settings.career16 === false) return;
    const cal = today(), h = hr();
    for (const c of Ch().all()) {
      if (!c.status || c.status.onIsland === false) continue;
      const j = jobOf(c), X = schoolOf(c);
      if (j && LINE[j.line].type === 'emp' && !cal.weekend && inWindow(h, WORK_H)) goAway(c, 'work16');
      if (X.status === 'enrolled' && X.level && !cal.weekend && inWindow(h, SCHOOL_H) && !(j && LINE[j.line].type === 'emp' && X.level === 'adult')) goAway(c, 'school16');
    }
  }
  /** once a day: missed shifts / classes, inspiration, commissions, exams, school fair */
  function dayStep(day) {
    if (Sim().catching) return; const cal = OC.Clock.cal ? OC.Clock.cal(day) : { weekday: day % 7, weekend: false, day: 1, season: 'spring' }, prev = day - 1, pcal = OC.Clock.cal ? OC.Clock.cal(prev) : cal;
    for (const c of Ch().all()) {
      const X = st(c), j = X.job, sc = schoolOf(c);
      if (j && LINE[j.line].type === 'emp' && !pcal.weekend) { if ((X.paid || {})[prev]) j.att++; else if ((X.sick16 || {})[prev]) j.sick = (j.sick || 0) + 1; else if (j.since < prev) { j.miss++; j.perf = Math.max(0, j.perf - 5); } }
      if (sc.status === 'enrolled' && !pcal.weekend && sc.level) { if ((X.att || {})[prev]) sc.att.days++; else if ((X.sick16 || {})[prev]) sc.att.sick = (sc.att.sick || 0) + 1; else sc.att.missed++; }
      X.insp = Math.min(100, X.insp + 12 + (any(c, ['daydreamer', 'creative']) ? 6 : 0));
      if (j && LINE[j.line].type === 'free') commissions(c, day, cal);
      if (cal.day === 27) exam(c, day, cal);
      if (cal.day === 14 && sc.status === 'enrolled' && sc.level && sc.level !== 'adult') { const ev = ['spring', 'autumn'].includes(cal.season) ? '校慶' : '運動會'; M().remember(c, { type: 'event', imp: 0.45, text: `學校的${ev}`, key: `fair:${c.id}:${day}` }); M().feel(c, 'happy', 0.3, ev); }
    }
  }
  function commissions(c, day, cal) {
    const X = st(c), j = X.job, L = LINE[j.line], now = day;
    for (const k of j.cases.slice()) if (!k.done && k.due < now) {
      j.cases.splice(j.cases.indexOf(k), 1); X.rep = Math.max(0, X.rep - 8); M().feel(c, 'down', 0.3, '沒趕上截止日');
      M().remember(c, { type: 'event', imp: 0.4, text: `${k.client}的${k.topic}沒有在截止日前交出去`, key: `late:${k.id}` });
      OC.Budget && OC.Budget.mail({ kind: 'career', title: `${name(c)}錯過了截止日`, text: `${k.client}委託的${k.topic}沒有準時交件，信譽下降了。`, key: `late:${k.id}` });
    }
    if (j.cases.length < 2 && (cal.weekday === 0 || !j.cases.length)) {
      const h = hs(c.id + ':' + day), client = CLIENTS[Math.floor(h * CLIENTS.length)], tp = TOPICS[L.work], topic = tp[Math.floor(hs(day + c.id) * tp.length)];
      const fee = Math.round(L.base * (1 + j.lv * 0.18) * (1 + X.rep / 120) * (0.8 + hs(c.id + day) * 0.5));
      const k = { id: `${c.id}:${day}`, client, topic, kind: L.work, fee, need: 120 + Math.round(hs(day * 7 + c.id.length) * 120), prog: 0, due: day + 3 + Math.floor(hs(c.id + 'd' + day) * 4), at: day };
      j.cases.push(k); St().touch('life', { career: c.id });
    }
  }
  function exam(c, day, cal) {
    const X = schoolOf(c); if (!X.level || !['enrolled', 'self'].includes(X.status)) return;
    const subj = LEVELS[X.level].subj, avg = subj.reduce((s, k) => s + (X.grades[k] || 0), 0) / subj.length;
    const score = X.status === 'self' ? Math.round(Math.min(100, X.self)) : Math.round(avg), pass = score >= (X.status === 'self' ? 60 : 50);
    X.exams.unshift({ day, score, pass, self: X.status === 'self', key: cal.key }); X.exams.length = Math.min(X.exams.length, 8);
    if (pass) X.terms++;
    if (X.status === 'self') X.self = Math.max(0, X.self - 40);
    M().remember(c, { type: 'event', imp: 0.4, text: `${LEVELS[X.level].zh}的期末考：${score} 分${pass ? '' : '（沒過）'}`, key: `exam:${c.id}:${day}` });
    M().feel(c, pass ? 'proud' : 'down', 0.35, '期末考');
    if (X.terms >= LEVELS[X.level].terms && !X.grad.includes(X.level)) {
      X.grad.push(X.level); M().remember(c, { type: 'bond', imp: 0.85, text: `${LEVELS[X.level].zh}畢業了`, key: `grad:${c.id}:${X.level}` });
      OC.Budget && OC.Budget.mail({ kind: 'school', title: `${name(c)}${LEVELS[X.level].zh}畢業了`, text: `${name(c)}${X.status === 'self' ? '自學' : ''}完成了${LEVELS[X.level].zh}。`, key: `grad:${c.id}:${X.level}` });
      OC.Progress && OC.Progress.emit('graduate', { oc: c.id, level: X.level });
      OC.Store.emit('career16:grad', { id: c.id, level: LEVELS[X.level].zh });   /* 16.11: a small scene (OC.Theatre) */
      if (X.level === 'adult') X.status = 'none';
    }
  }

  // ================================================================ results (from the one progress stream)
  function onProgress(d) {
    if (d.ev !== 'act' || !d.oc) return; const c = Ch().get(d.oc); if (!c) return; const X = st(c), day = Sim().day(), min = d.min || 0;
    if (d.act === 'work16') {
      const j = X.job; if (!j || LINE[j.line].type !== 'emp' || min < 60) return;
      const L = LINE[j.line], hours = Math.min(6, min / 60), amount = Math.round(L.base * hours * (1 + 0.15 * (j.lv - 1)));
      const r = OC.Tx.run(`c16pay:${c.id}:${day}`, { get: { coins: amount } }, `${name(c)}當${title(c)}（${Math.round(min)} 分鐘）`); if (!r.ok) return;
      (X.paid = X.paid || {})[day] = amount; for (const k of Object.keys(X.paid)) if (+k < day - 10) delete X.paid[k];
      const mood = (c.needs.fun + c.needs.energy) / 200, gain = Math.round(3 + mood * 4 + (any(c, ['serious', 'organized']) ? 2 : 0) - (has(c, 'lazy') ? 2 : 0) + (M().skillLv ? M().skillLv(c, L.skill) || 0 : 0));
      j.perf += gain; j.days++;
      const need = 25 + j.lv * 10, max = Math.min(L.titles.length, j.cap || L.titles.length);
      if (j.perf >= need && j.days >= 3 && j.lv < max) {
        j.lv++; j.perf = 0; j.days = 0; const t = title(c);
        M().feel(c, 'proud', 0.6, '升職'); M().remember(c, { type: 'bond', imp: 0.7, text: `升為${t}了`, key: `promo:${c.id}:${j.line}:${j.lv}` });
        OC.Budget && OC.Budget.mail({ kind: 'career', title: `${name(c)}升職了`, text: `${name(c)}在${L.zh}的工作升為「${t}」，時薪提高了。`, key: `promo:${c.id}:${j.line}:${j.lv}` });
        OC.Progress.emit('promote', { oc: c.id, line: j.line, lv: j.lv });
      }
      if (OC.UI) OC.UI.toast(`${name(c)}下班了：+${amount} 星幣`, 'coin');
      St().touch('life', { career: c.id });
    } else if (d.act === 'school16') {
      const sc = schoolOf(c); if (!sc.level || min < 60) return; (X.att = X.att || {})[day] = 1;
      const subj = LEVELS[sc.level].subj, gain = 2 + (c.needs.energy > 40 ? 1 : 0) + (any(c, ['serious', 'scholar', 'curious']) ? 1.5 : 0) - (any(c, ['lazy', 'restless']) ? 1 : 0);
      for (const s2 of subj) sc.grades[s2] = Math.min(100, (sc.grades[s2] || 40) + gain * (0.6 + hs(c.id + s2 + day) * 0.8));
      St().touch('life', { career: c.id });
    } else if (d.act === 'homework16') {
      const sc = schoolOf(c); if (!sc.level) return; const subj = LEVELS[sc.level].subj, s2 = subj[Math.floor(hs(c.id + day + 'hw') * subj.length)];
      sc.grades[s2] = Math.min(100, (sc.grades[s2] || 40) + 3 + min / 15); if (sc.status === 'self') sc.self = Math.min(100, sc.self + min / 4);
      (X.hw = X.hw || {})[day] = 1;
    } else if (['study', 'read'].includes(d.act) && schoolOf(c).status === 'self') {
      const sc = schoolOf(c); sc.self = Math.min(100, sc.self + min / 6);   /* self-study counts reading and studying too (slower) */
    } else if (d.act === 'freelance16') {
      const j = X.job; if (!j || LINE[j.line].type !== 'free') return; const k = j.cases.find((x) => !x.done); if (!k) return;
      const L = LINE[j.line], q = 0.7 + Math.min(0.6, (M().skillLv ? M().skillLv(c, L.skill) || 0 : 0) * 0.1) + (X.insp < 25 ? -0.35 : 0);
      k.prog += min * q; X.insp = Math.max(0, X.insp - min / 3);
      if (k.prog >= k.need) finishCase(c, k);
      St().touch('life', { career: c.id });
    }
  }
  function finishCase(c, k) {
    const X = st(c), j = X.job, L = LINE[j.line], early = k.due - Sim().day();
    k.done = true; j.cases.splice(j.cases.indexOf(k), 1); j.done++;
    const r = OC.Tx.run(`case16:${k.id}`, { get: { coins: k.fee } }, `${name(c)}交了${k.client}的${k.topic}`); if (!r.ok) return;
    const quality = Math.max(1, Math.min(3, 1 + Math.round(((M().skillLv ? M().skillLv(c, L.skill) || 0 : 0) / 3) + (X.insp > 60 ? 1 : 0) + (early > 1 ? 0.5 : 0))));
    X.rep = Math.min(100, X.rep + 5 + (early > 1 ? 3 : 0));
    const w = { id: 'w' + k.id.replace(/[^a-z0-9]/gi, ''), kind: k.kind, title: `${k.topic}（${k.client}）`, q: quality, at: Sim().day(), line: j.line };
    X.works.unshift(w); if (X.works.length > 30) X.works.length = 30;
    j.perf += 6; if (j.perf >= 25 + j.lv * 10 && j.lv < L.titles.length) { j.lv++; j.perf = 0; M().remember(c, { type: 'bond', imp: 0.7, text: `成為${title(c)}了`, key: `promo:${c.id}:${j.line}:${j.lv}` }); OC.Progress.emit('promote', { oc: c.id, line: j.line, lv: j.lv }); }
    M().feel(c, 'proud', 0.45, '交件'); M().remember(c, { type: 'event', imp: 0.45, text: `交出了${k.client}的${k.topic}，拿到 ${k.fee} 星幣`, key: `case:${k.id}` });
    if (OC.UI) OC.UI.toast(`${name(c)}交件了：+${k.fee} 星幣`, 'coin');
    OC.Progress.emit('commission', { oc: c.id, line: j.line, coins: k.fee });
  }

  // ================================================================ the AI: homework, freelance work, asking for inspiration
  function shape(c, b, list) {
    if (!b || !b.a || b.queued || (B().manualMode(b) && !(b.manualOverride > performance.now() / 1000))) return list;
    const X = st(c), h = hr(), day = Sim().day(), sc = schoolOf(c), j = X.job;
    const here = () => { const p = W().nearestWalkable(b.a.x + 6, b.a.y + 4, 20) || { x: b.a.x, y: b.a.y }; return p; };
    if (['enrolled', 'self'].includes(sc.status) && sc.level && sc.level !== 'kinder' && h >= 15 && h < 21 && !(X.hw || {})[day] && c.needs.energy > 25) {
      const p = here(); list.push({ kind: 'act', act: 'homework16', target: { pt: { x: p.x, y: p.y, k: 'hw16' } }, s: 0.35 + (any(c, ['serious', 'scholar', 'organized']) ? 0.35 : 0) - (any(c, ['lazy', 'playful', 'restless']) ? 0.25 : 0) + (sc.status === 'self' ? 0.25 : 0), why: [sc.status === 'self' ? '今天的自學進度' : '回家作業'] });
    }
    if (j && LINE[j.line].type === 'free' && j.cases.some((k) => !k.done) && h >= 9 && h < 22 && c.needs.energy > 30) {
      const k = j.cases.find((x) => !x.done), left = k.due - day, p = here();
      list.push({ kind: 'act', act: 'freelance16', target: { pt: { x: p.x, y: p.y, k: 'fl16' } }, s: 0.3 + Math.max(0, 3 - left) * 0.25 + (any(c, ['serious', 'organized']) ? 0.2 : 0) - (has(c, 'lazy') ? 0.2 : 0) - (X.insp < 25 ? 0.3 : 0), why: [`${k.client}的${k.topic}（還剩 ${left} 天）`] });
      if (X.insp < 25) askInspiration(c);
    }
    return list;
  }
  /** a freelancer out of ideas asks you (through the allowance; at most every three days) */
  function askInspiration(c) {
    const X = st(c), day = Sim().day(); if (X.askedInsp != null && day - X.askedInsp < 3) return false;
    if (S().life.settings.lively === 'legacy' || (OC.Budget && !OC.Budget.can('ask'))) return false;
    X.askedInsp = day; OC.Budget && OC.Budget.spend('ask');
    const j = X.job, k = j && j.cases.find((x) => !x.done); if (!k || !OC.UI || !OC.UI.sheet) return false;
    const h = OC.UI.h, ideas = ['季節的顏色', '小時候的回憶', '島上的風景', '朋友的笑臉', '一首喜歡的歌', '雨天的味道'].sort(() => hs(c.id + day) - 0.5).slice(0, 3);
    const b = B().get(c.id); if (b) B().hold(c.id, 'menu'); let done = false;
    OC.UI.sheet(`${name(c)}卡住了`, (box, api) => {
      box.append(h('p', null, `「${k.client}的${k.topic}……一點靈感都沒有。你覺得從哪裡開始好？」`),
        h('div.vstack', { style: { gap: '8px', marginTop: '8px' } }, ...ideas.map((t) => h('button.btn.block', { 'data-insp': t, on: { click: () => { done = true; giveIdea(c, t); api.close(); } } }, t))));
      OC.Pick && OC.Pick.guard(box);
    }, { onClose: () => { if (b) B().unhold(c.id, 'menu'); void done; } });
    return true;
  }
  function giveIdea(c, idea) { const X = st(c); X.insp = Math.min(100, X.insp + 60); M().player(c, { aff: 1 }); M().feel(c, 'happy', 0.3, '有靈感了'); M().remember(c, { type: 'event', imp: 0.3, text: `你給了靈感：${idea}`, key: `insp:${c.id}:${Sim().day()}` }); }

  // ================================================================ portfolio → shop
  const WORK_ART = { art: '🎨', text: '📖', music: '🎵', photo: '📷', craft: '🪵', code: '💻', plant: '🌿', recipe: '🍳', stream: '📺' };
  async function listWork(id, wid) {
    const c = Ch().get(id), X = c && st(c), w = X && X.works.find((x) => x.id === wid); if (!w) return { ok: false, why: '找不到作品' };
    if (w.listed) return { ok: false, why: '已經上架了' };
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    const col = ['#F2B33D', '#9B7BE0', '#3FC1B0', '#F26B5B', '#5A9BE0'][Math.floor(hs(w.id) * 5)];
    g.fillStyle = '#FFF7EC'; g.fillRect(0, 0, 128, 128); g.fillStyle = col; g.fillRect(10, 10, 108, 108); g.fillStyle = '#FFFDF3'; g.fillRect(18, 18, 92, 92);
    g.font = '52px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(WORK_ART[w.kind] || '✨', 64, 58);
    g.fillStyle = '#6F5438'; g.font = 'bold 13px sans-serif'; g.fillText('★'.repeat(w.q), 64, 96);
    const rec = await OC.Assets.put(cv, { kind: 'product', name: w.title, owner: null });
    const r = OC.Items.saveCustom({ zh: w.title.split('（')[0].slice(0, 16), kind: 'gift', asset: rec.id, price: 60 + w.q * 40, shop: 'gift', d: `${name(c)}的${WORK_ZH[w.kind] || '作品'}（${'★'.repeat(w.q)}）。` });
    if (!r.ok) return { ok: false, why: (r.errors || []).join('、') };
    w.listed = r.id; X.rep = Math.min(100, X.rep + 2); St().touch('life', { career: id });
    return { ok: true, item: r.id };
  }

  // ================================================================ migration: the 15.2 part-time job becomes level 1 「兼職」
  const OLD = { cafe: 'barista', hill: 'shopkeep', fair: 'performer' };
  function migrate() {
    for (const c of Ch().all()) {
      const X = st(c); if (X.job || X.migrated) continue; X.migrated = true;
      const r = c.life.rec && c.life.rec.act && c.life.rec.act.work; if (!r || !r.n) continue;
      const pl = Object.entries(r.place || {}).sort((a, b) => b[1] - a[1]).map(([k]) => String(k).replace('job:', '').replace('place:', ''))[0] || 'cafe';
      const line = OLD[pl] || OLD[{ mill: 'hill' }[pl]] || 'barista';
      X.job = { line, lv: 1, perf: Math.min(20, r.n * 3), days: r.n, since: Sim().day(), att: r.n, miss: 0, cases: [], done: 0, migrated: true };
    }
  }

  // ================================================================ lines (data)
  { const T = (...t) => ({ trait: t }); const L = [
    ['c16_go_work', '我去上班了。'], ['c16_go_work', '時間到了，出門。'], ['c16_go_work', '今天也要好好工作。'], ['c16_go_work', '……好想再睡五分鐘。', T('lazy', 'lightsleeper')], ['c16_go_work', '今天的班表很滿。', T('serious', 'organized')],
    ['c16_go_work', '去賺星幣囉。', T('cheerful', 'playful')], ['c16_go_work', '晚上見。'],
    ['c16_go_school', '我去上學了。'], ['c16_go_school', '書包有帶。走了。'], ['c16_go_school', '今天有小考……'], ['c16_go_school', '想見同學。', T('outgoing', 'talkative')], ['c16_go_school', '不想去……', T('lazy', 'shy')],
    ['c16_go_school', '下課再一起玩。'],
  ]; L.forEach((x, i) => D().LINES.push({ id: 'c16_' + i, cat: x[0], text: x[1], c: x[2] || null, w: 1, m: true, cd: 10 })); }

  // ================================================================ the page 「工作與學校」
  const h = (...a) => OC.UI.h(...a);
  OC.Pages.define('career16', '工作與學校', {
    sub: true,
    build(p, el) { p.who = h('div.chips.c16-who'); p.box = h('div.c16'); el.append(p.who, p.box); },
    refresh(p) {
      const cs = Ch().all(); if (!cs.length) { p.box.replaceChildren(h('div.empty', null, '還沒有角色。')); return; }
      if (!p.id || !Ch().get(p.id)) p.id = (p.params && p.params.id) || S().activeId || cs[0].id;
      const c = Ch().get(p.id), X = st(c), sc = schoolOf(c);
      const sig = JSON.stringify([p.id, cs.map((x) => [x.id, name(x)]), X, sc, p.pick]); if (p._sig === sig) return; p._sig = sig;
      p.who.replaceChildren(...cs.map((x) => h('button.chip' + (x.id === p.id ? '.on' : ''), { 'data-who': x.id, on: { click: () => { p.id = x.id; p.pick = false; p._sig = ''; p.refresh(p); } } }, name(x))));
      p.box.replaceChildren(schoolCard(p, c, sc), jobCard(p, c, X));
    },
  });
  const re = (p) => { p._sig = ''; p.refresh(p); };
  function bar(v, max = 100) { return h('div.c16-bar', null, h('i', { style: { width: Math.round(Math.max(0, Math.min(1, v / max)) * 100) + '%' } })); }
  function schoolCard(p, c, sc) {
    const lv = sc.level, box = h('div.card.c16-card', { 'data-card': 'school' }, h('div.hstack', null, OC.UI.sticker('book'), h('b.grow', null, lv ? LEVELS[lv].zh : '學校'), h('span.tag', null, STATUS[sc.status] || '')));
    if (!lv) { box.append(h('div.muted', null, '嬰兒還不能上學。')); return box; }
    box.append(h('div.seg.c16-status', { role: 'tablist' }, ...Object.entries(STATUS).map(([k, zh]) => h('button' + (sc.status === k ? '.on' : ''), { 'data-status': k, on: { click: () => { setSchool(c.id, k); re(p); } } }, zh))));
    if (sc.status === 'enrolled') box.append(h('div.muted', null, `平日 ${SCHOOL_H[0]}:00 自己去上學（看不到的地方）。出席 ${sc.att.days} 天、缺席 ${sc.att.missed} 天・已完成 ${sc.terms}/${LEVELS[lv].terms} 學期`));
    if (sc.status === 'leave') box.append(h('div.muted', null, '休學中：不上課、不算出席，學籍保留，復學從原本的年級接著讀。'));
    if (sc.status === 'self') box.append(h('div.muted', null, `自學：讀書、寫作業、看書都會累積自學進度（比上學慢、沒有同學）。期末考看自學進度，60 分以上就過。`), h('div.hstack', null, h('span', null, '自學進度'), bar(sc.self), h('b', null, Math.round(sc.self))));
    if (['enrolled', 'self', 'leave'].includes(sc.status)) box.append(h('div.c16-grades', null, ...LEVELS[lv].subj.map((s2) => h('div.c16-g', null, h('span', null, SUBJ_ZH[s2]), bar(sc.grades[s2] || 0), h('small', null, Math.round(sc.grades[s2] || 0))))),
      sc.status === 'self' ? h('div.muted.c16-note', null, '（自學成績只給自己看，不和同學比較）') : null);
    if (sc.exams.length) box.append(h('div.muted', null, '期末考：' + sc.exams.slice(0, 3).map((e) => `${e.score} 分${e.pass ? '' : '（沒過）'}`).join('・')));
    if (sc.grad.length) box.append(h('div', null, '畢業：' + sc.grad.map((g) => LEVELS[g].zh).join('、')));
    return box;
  }
  function jobCard(p, c, X) {
    const j = X.job, box = h('div.card.c16-card', { 'data-card': 'job' });
    if (!j || p.pick) {
      box.append(h('div.hstack', null, OC.UI.sticker('coin'), h('b.grow', null, j ? '換工作' : '找工作'), j ? h('button.btn.s.ghost', { on: { click: () => { p.pick = false; re(p); } } }, '取消') : null));
      for (const [type, zh] of [['emp', '受僱（平日固定時段，去看不到的地方上班）'], ['free', '自由業（在家接案、自己安排時間）']]) {
        box.append(h('div.muted.c16-sec', null, zh), h('div.c16-lines', null, ...LINES.filter((l) => l.type === type).map((l) => { const why = canTake(c, l.id); return h('button.c16-line' + (why ? '.locked' : ''), { 'data-line': l.id, disabled: !!why, on: { click: () => { const r = takeJob(c.id, l.id); if (!r.ok) OC.UI.toast(r.why, 'info'); p.pick = false; re(p); } } }, h('b', null, l.zh), h('small', null, why || (type === 'emp' ? `時薪 ${l.base} 起` : `案件 ${l.base} 起`))); })));
      }
      return box;
    }
    const L = LINE[j.line], need = 25 + j.lv * 10;
    box.append(h('div.hstack', null, OC.UI.sticker('coin'), h('div.grow', null, h('b', null, `${L.zh}・${title(c)}`), h('div.muted', null, L.type === 'emp' ? `平日 ${WORK_H[0]}:00–${WORK_H[1]}:00・時薪 ${Math.round(L.base * (1 + 0.15 * (j.lv - 1)))} 星幣` : `信譽 ${Math.round(X.rep)}・靈感 ${Math.round(X.insp)}`)), h('span.tag', null, `Lv.${j.lv}`)),
      h('div.hstack', null, h('span', null, L.type === 'emp' ? '表現' : '經驗'), bar(j.perf, need), h('small', null, `${Math.round(j.perf)}/${need}`)),
      L.type === 'emp' ? h('div.muted', null, `出勤 ${j.att} 天・缺勤 ${j.miss} 天${j.cap ? '・未滿 18 歲只能兼職到 Lv.' + j.cap : ''}${j.migrated ? '・從以前的打工接續' : ''}`) : null);
    if (L.type === 'free') {
      box.append(h('div.muted.c16-sec', null, '案件'), ...(j.cases.length ? j.cases.map((k) => h('div.c16-case', { 'data-case': k.id }, h('div', null, h('b', null, `${k.client}・${k.topic}`), h('small.muted', null, `　${k.fee} 星幣・截止 ${OC.Clock.cal ? OC.Clock.cal(k.due).text : '第 ' + k.due + ' 天'}`)), bar(k.prog, k.need))) : [h('div.muted', null, '目前沒有案件（每週一會有新的委託）。')]));
      box.append(h('div.muted.c16-sec', null, `作品集（${X.works.length}）`), ...(X.works.length ? X.works.slice(0, 8).map((w) => h('div.c16-work', { 'data-work': w.id }, h('span', null, `${WORK_ART[w.kind] || '✨'} ${w.title} ${'★'.repeat(w.q)}`),
        w.listed ? h('span.tag', null, '已上架') : h('button.btn.s', { 'data-list': w.id, on: { click: async () => { const r = await listWork(c.id, w.id); OC.UI.toast(r.ok ? '已上架到星星禮品屋（工坊商品）' : r.why, r.ok ? 'gift' : 'info'); re(p); } } }, '上架'))) : [h('div.muted', null, '交件之後作品會放在這裡，可以上架到商店。')]));
    }
    box.append(h('div.hstack', { style: { gap: '8px', marginTop: '10px' } }, h('button.btn.s', { 'data-act': 'change', on: { click: () => { p.pick = true; re(p); } } }, '換工作'), h('button.btn.s.ghost', { 'data-act': 'quit', on: { click: () => { quitJob(c.id); re(p); } } }, '辭職')));
    return box;
  }

  function init() { Sim().onStep(step); Sim().onDay((d) => dayStep(d)); OC.Progress && OC.Progress.on(onProgress); migrate(); }
  OC.Career16 = { LINES, LINE, SUBJ, LEVELS, STATUS, CLIENTS, WORK_H, SCHOOL_H, st, levelFor, schoolOf, setSchool, jobOf, title, canTake, takeJob, quitJob, step, dayStep, commissions, exam, onProgress, finishCase, shape, askInspiration, giveIdea, listWork, migrate, goAway, init };
})();
