/* match.js — 경기 엔진(lolpro 5.3). 장면 판정 → 승패·KDA·POM, 그리고 관전용 타임라인 프레임.
   프레임: {clock, text, cls, gold:[a,b], kills:[a,b], towers:[a,b], dragons:[a,b], pos:[[x,y]x10], dead:[idx], flash, sc}
   pos 0~4 = 내 팀(TOP,JUNGLE,MID,AD,SUP), 5~9 = 상대 팀 같은 순서. 좌표 0~100. DOM 의존 없음. */
(function (LP) {
  'use strict';
  var R = LP.rules, S = LP.state, L = LP.league;
  var M = {};
  var POS = R.POS;

  // 장면에 쓰는 능력치 가중치 — 설계 추정(lolpro: '관련 능력치'만 명시)
  var SCENE_W = { lan: { lan: 0.6, phy: 0.2, vis: 0.2 }, skr: { skr: 0.6, phy: 0.3, vis: 0.1 }, tf: { tf: 0.6, vis: 0.2, skr: 0.2 } };
  var SCENE_KO = { lan: '라인전', skr: '소규모 교전', tf: '한타' };
  M.SCENE_KO = SCENE_KO;
  function mix(scene, st) { var w = SCENE_W[scene], t = 0; for (var k in w) t += w[k] * st[k]; return t; }

  // ---------- 챔피언 ----------
  function champKo(id) { var c = LP.data.db.champs[id]; return c ? c.ko : id; }
  M.champKo = champKo;
  function available(date) { return LP.data.db.champList.filter(function (c) { return c.release <= date; }); }
  function champBonus(c, scene, phase, meta, inPool) {
    if (!c) return 0;
    var v = (c[scene] - 3) * 10;
    if (c.curve === '초반' && phase === 'early') v += 10;
    if (c.curve === '후반' && phase === 'late') v += 10;
    var m = meta[c.id];
    if (m) v += m.tier === 'S' ? 10 : m.tier === 'A' ? 5 : 0;
    if (!inPool) v += c.diff >= 4 ? -30 : -15;
    return R.clamp(v, -30, 30);
  }
  M.champBonus = champBonus;
  function metaPick(rng, date, pos, exclude, meta) {
    var list = available(date).filter(function (c) { return c.pos.indexOf(pos) >= 0 && exclude.indexOf(c.id) < 0; });
    var inMeta = list.filter(function (c) { return meta[c.id]; });
    if (inMeta.length) return rng.weighted(inMeta, function (c) { return meta[c.id].pb; });
    return list.length ? rng.pick(list) : null;
  }
  function poolScore(c, meta, pool) {
    var inP = pool.indexOf(c.id) >= 0;
    return Math.round((champBonus(c, 'lan', 'early', meta, inP) + champBonus(c, 'skr', 'mid', meta, inP) + champBonus(c, 'tf', 'late', meta, inP)) / 3);
  }

  // ---------- 컨디션·적응 ----------
  function seriesCondition(state, rng) {
    var p = state.p, fx = R.fxOf(p.traits), roll = rng.d2x6(), c = R.condition(roll), key = c.key;
    if (p.status.slump > 0 || p.status.injury > 0) key = Math.max(0, key - 1);
    if (fx.condWorstBad && key === 0) key = 1;
    var base = R.CONDITION_BY_KEY[key], adj = Math.round(base.adj * R.VOL_MULT[p.hidden.vol]);
    return { roll: roll, key: key, label: base.label, adj: adj, raw: base.adj };
  }
  function ensureAdapt(state, rng, stage) {
    var a = state.p.adapt;
    if (stage !== 'cl' && stage !== 'pro') return null;
    if (a[stage]) return a[stage];
    var p = state.p, fx = R.fxOf(p.traits);
    var roll = rng.d2x6() + (p.hidden.men >= 4 ? 1 : p.hidden.men <= 2 ? -1 : 0);
    roll = R.clamp(roll, 2, 12);
    var row = R.adaptRow(roll);
    a[stage] = { roll: roll, label: row.label, pen: row[stage], monster: !!row.monster, sets: 0, bonusLeft: row.monster ? 3 : 0 };
    S.addFeed(state, 'adapt', { stage: stage, label: row.label, roll: roll }, '', { noAI: true, tpl: 'adapt' });
    return a[stage];
  }

  // ---------- 준비(밴픽 선택지) ----------
  M.prepare = function (state, series) {
    var rng = S.rng(state), p = state.p, w = state.world, date = state.date;
    var meta = LP.data.metaFor(date), mine = series.a === state.career.team, myId = mine ? series.a : series.b, oppId = mine ? series.b : series.a;
    var opp = L.starters(state, oppId), pool = p.pool.filter(function (id) { var c = LP.data.db.champs[id]; return c && c.release <= date; });
    var banned = [];
    if (pool.length >= 3 && rng.chance(30)) {
      var top = pool.slice().sort(function (a, b) { return poolScore(LP.data.db.champs[b], meta, pool) - poolScore(LP.data.db.champs[a], meta, pool); })[0];
      banned.push(top);
    }
    var opts = pool.map(function (id) {
      var c = LP.data.db.champs[id], m = meta[id];
      return { id: id, ko: c.ko, diff: c.diff, curve: c.curve, tier: m ? m.tier : '-', score: poolScore(c, meta, pool), banned: banned.indexOf(id) >= 0 };
    });
    var lineup = POS.map(function (pos) { var o = opp[pos]; return { pos: pos, name: o ? o.name : '-', ovr: o ? R.ovr(o.stats) : 0 }; });
    var imp = series.kind === 'po' || series.kind === 'msi' || series.kind === 'worlds';
    return { me: myId, opp: oppId, myName: L.teamName(state, myId), oppName: L.teamName(state, oppId), bo: series.bo, kind: series.kind, name: series.name, final: !!series.final,
      round: series.round === undefined ? null : series.round, fearless: !!series.fearless, important: imp, options: opts, banned: banned, lineup: lineup,
      myPower: Math.round(L.power(state, myId)), oppPower: Math.round(L.power(state, oppId)), serKey: series.key };
  };

  // ---------- 세트 ----------
  function sideFx(ref) { return R.fxOf(ref.traits); }

  function playSet(state, rng, o) {
    var p = state.p, meta = o.meta, set = { no: o.no, scenes: [], champs: { mine: {}, theirs: {} } };
    var fxP = R.fxOf(p.traits), myPos = p.pos, myL = o.myLine, opL = o.oppLine;
    // 챔피언 배정
    var usedMine = o.usedMine.slice(), usedOpp = o.usedOpp.slice();
    var myChamp = o.myChamp;
    POS.forEach(function (pos) {
      if (pos === myPos) { set.champs.mine[pos] = myChamp; return; }
      var c = metaPick(rng, state.date, pos, usedMine, meta); set.champs.mine[pos] = c ? c.id : null; if (c) usedMine.push(c.id);
    });
    POS.forEach(function (pos) { var c = metaPick(rng, state.date, pos, usedOpp, meta); set.champs.theirs[pos] = c ? c.id : null; if (c) usedOpp.push(c.id); });
    set.myChamp = myChamp; set.oppChamp = set.champs.theirs[myPos];
    var db = LP.data.db.champs;
    var nLane = rng.range(1, 2), nSkr = rng.range(1, 2), nTf = rng.range(1, 2);
    var plan = [];
    for (var i = 0; i < nLane; i++) plan.push('lan');
    for (i = 0; i < nSkr; i++) plan.push('skr');
    for (i = 0; i < nTf; i++) plan.push('tf');
    var base = (o.myPower - o.oppPower) * 0.03;
    var score = base, prevFail = false, failStreak = 0, tfSeen = 0;
    var kda = { k: 0, d: 0, a: 0 }, perf = 0;
    var ad = o.adapt, adaptPen = ad ? ad.pen + (ad.bonusLeft > 0 ? 10 : 0) : 0;
    var intlPen = o.intlPen ? -10 : 0;
    var oppRef = opL[myPos];
    plan.forEach(function (scene, idx) {
      var phase = scene === 'lan' ? 'early' : scene === 'skr' ? 'mid' : 'late';
      if (scene === 'tf') { tfSeen++; phase = (nTf === 1 || tfSeen === 2) ? 'late' : 'mid'; }
      var ctx = { scene: scene, late: phase === 'late', clutch: o.tourney || o.decider || (scene === 'tf' && idx === plan.length - 1),
        domestic: o.kind === 'po', big: o.intl || o.final, intl: o.intl, behind: score <= -1, final: o.final, worlds: o.kind === 'worlds', worldsKO: o.kind === 'worlds' && o.round !== null && o.round >= 1,
        pressure: prevFail || score <= -2 || failStreak >= 2 || state.community <= -40 };
      // 내 유효 능력치
      var st = p.stats;
      if (ctx.clutch && fxP.clutchFloor) { st = {}; R.STATS.forEach(function (k) { st[k] = Math.max(p.stats[k], fxP.clutchFloor); }); }
      var cond = o.cond.adj;
      if (ctx.clutch && fxP.clutchCond && o.cond.key < 2) cond = 0;
      var cMine = db[myChamp], cOpp = db[set.oppChamp];
      var inPool = p.pool.indexOf(myChamp) >= 0;
      var champMe = champBonus(cMine, scene, phase, meta, inPool);
      var champOp = champBonus(cOpp, scene, phase, meta, true);
      var hid = 0;
      if (ctx.clutch) hid += p.hidden.clutch * 10;
      if (ctx.pressure) hid += R.MENTAL_PRESSURE[p.hidden.men] + fxP.pressure + (ctx.worlds ? fxP.worldsPressure : 0);
      var tr = R.traitScene(fxP, ctx);
      if (ctx.clutch && fxP.clutchSucc === 0 && false) tr += 0;
      var bg = R.bgScene(p.bg, ctx);
      var pen = adaptPen + (intlPen && ctx.big ? intlPen : 0) + (o.intlPen && !ctx.big ? intlPen : 0);
      var mePart = { stat: Math.round(mix(scene, st)), cond: cond, adapt: pen, bg: bg, hidden: hid, trait: tr, champ: champMe };
      var meEff = mePart.stat + cond + pen + bg + hid + tr + champMe;
      var opEff, opPart;
      var fxO = oppRef ? sideFx(oppRef) : R.blankFx();
      var oh = 0;
      if (oppRef) {
        if (ctx.clutch) oh += oppRef.hidden.clutch * 10;
        if (ctx.pressure || (ctx.clutch && fxP.enemyPressure)) oh += R.MENTAL_PRESSURE[oppRef.hidden.men] + fxO.pressure;
      }
      if (scene === 'tf') {
        // 한타: 양 팀 평균. 내 쪽은 플레이어 칸을 유효 능력치로 대체한다.
        var sumMe = 0, sumOp = 0, cm = 0, co = 0;
        POS.forEach(function (pos) {
          var a = myL[pos], b = opL[pos];
          var cA = db[set.champs.mine[pos]], cB = db[set.champs.theirs[pos]];
          if (pos === myPos) sumMe += meEff;
          else { var bonus = (a ? 0 : 0); sumMe += (a ? mix('tf', a.stats) : 380) + champBonus(cA, 'tf', phase, meta, true) + (fxP.teamBoost && (!fxP.teamBoostLast || o.decider) ? fxP.teamBoost : 0); }
          sumOp += (b ? mix('tf', b.stats) : 380) + champBonus(cB, 'tf', phase, meta, true) + (b ? R.traitScene(sideFx(b), ctx) : 0);
        });
        meEff = sumMe / 5; opEff = sumOp / 5 + oh / 5;
        opPart = { stat: Math.round(opEff - oh / 5), hidden: Math.round(oh / 5) };
        mePart.avg = true;
      } else {
        opEff = (oppRef ? mix(scene, oppRef.stats) : 380) + champOp + oh + (oppRef ? R.traitScene(fxO, ctx) : 0);
        opPart = { stat: Math.round(oppRef ? mix(scene, oppRef.stats) : 380), champ: champOp, hidden: oh, trait: oppRef ? R.traitScene(fxO, ctx) : 0 };
      }
      var rate = R.clamp(Math.round(50 + (meEff - opEff) * 0.3), 5, 95);
      var roll = rng.int(100);
      var succMax = ctx.clutch ? Math.max(fxP.succMax, fxP.clutchSucc) : fxP.succMax;
      var failMin = (ctx.clutch && fxP.clutchNoFail) ? 101 : fxP.failMin;
      var res = roll <= succMax ? 'critS' : roll >= failMin ? 'critF' : roll <= rate ? 'S' : 'F';
      var pts = { critS: 2, S: 1, F: -1, critF: -2 }[res];
      score += pts; perf += pts;
      var good = pts > 0;
      prevFail = !good; failStreak = good ? 0 : failStreak + 1;
      // KDA
      var ev = { k: 0, d: 0, a: 0 };
      if (scene === 'lan') { if (res === 'critS') ev.k = 1; else if (res === 'S' && rng.chance(35)) ev.k = 1; if (res === 'critF') ev.d = 1; else if (res === 'F' && rng.chance(30)) ev.d = 1; }
      else if (scene === 'skr') { if (good) { ev.k = res === 'critS' ? rng.range(1, 2) : rng.range(0, 2); ev.a = rng.range(0, 1); } else { ev.d = res === 'critF' ? 1 : (rng.chance(60) ? 1 : 0); ev.a = rng.range(0, 1); } }
      else { if (good) { ev.k = res === 'critS' ? rng.range(2, 3) : rng.range(0, 2); ev.a = rng.range(2, 4); } else { ev.d = rng.chance(res === 'critF' ? 100 : 65) ? 1 : 0; ev.a = rng.range(0, 2); } }
      kda.k += ev.k; kda.d += ev.d; kda.a += ev.a;
      set.scenes.push({ scene: scene, label: SCENE_KO[scene], phase: phase, me: Math.round(meEff), opp: Math.round(opEff), rate: rate, roll: roll, res: res, pts: pts, ev: ev, parts: mePart, oppParts: opPart,
        flags: { clutch: !!ctx.clutch, pressure: !!ctx.pressure, behind: !!ctx.behind }, mc: myChamp, oc: set.oppChamp });
    });
    set.score = Math.round(score * 100) / 100;
    var noise = rng.gauss(0, 0.8);
    var fin = score + noise;
    var win;
    if (Math.abs(fin) < 0.05) win = rng.chance(50 + (o.myPower - o.oppPower) * 0.3);
    else win = fin > 0;
    set.win = win; set.kda = kda; set.perf = perf;
    var pomP = !win ? 0 : perf >= 3 ? 70 : perf === 2 ? 35 : perf === 1 ? 12 : 3;
    set.pom = rng.chance(pomP);
    set.dur = 24 + plan.length * 2 + rng.range(0, 5);
    set.usedMine = usedMine; set.usedOpp = usedOpp;
    set.frames = buildFrames(state, rng, set, o);
    return set;
  }

  // ---------- 관전 타임라인 ----------
  var W = { A: [8, 92], B: [92, 8] };
  var LANE = { TOP: { a: [12, 62], b: [62, 12], c: [14, 14] }, MID: { a: [40, 60], b: [60, 40], c: [50, 50] }, AD: { a: [60, 88], b: [88, 60], c: [88, 88] }, SUP: { a: [64, 86], b: [86, 64], c: [86, 86] } };
  var JG_A = [[26, 72], [20, 46], [40, 78]], JG_B = [[74, 28], [80, 54], [60, 22]];
  var SPOT = { dragon: [68, 68], baron: [32, 32], mid: [50, 50], top: [14, 14], bot: [88, 88] };
  var LANE_OF = { TOP: 'TOP', JUNGLE: 'MID', MID: 'MID', AD: 'AD', SUP: 'AD' };
  function jit(rng, pt, a) { return [R.clamp(pt[0] + rng.range(-a, a), 2, 98), R.clamp(pt[1] + rng.range(-a, a), 2, 98)]; }

  function buildFrames(state, rng, set, o) {
    var frames = [], db = LP.data.db.champs, myPos = state.p.pos, myIdx = POS.indexOf(myPos);
    var gold = [2.5, 2.5], kills = [0, 0], towers = [0, 0], dragons = [0, 0], dead = [];
    var pos = [];
    var laneBase = function (t) { // t: 0 = 자기 진영, 1 = 라인 중앙
      var out = [];
      POS.forEach(function (ps, i) {
        if (ps === 'JUNGLE') out[i] = JG_A[0]; else { var l = LANE[ps]; out[i] = [l.a[0] + (l.c[0] - l.a[0]) * t * 0.5, l.a[1] + (l.c[1] - l.a[1]) * t * 0.5]; }
      });
      POS.forEach(function (ps, i) {
        if (ps === 'JUNGLE') out[5 + i] = JG_B[0]; else { var l = LANE[ps]; out[5 + i] = [l.b[0] + (l.c[0] - l.b[0]) * t * 0.5, l.b[1] + (l.c[1] - l.b[1]) * t * 0.5]; }
      });
      return out;
    };
    function clk(min) { var m = Math.floor(min), s = Math.round((min - m) * 60); if (s === 60) { m++; s = 0; } return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
    function push(min, text, cls, extra) {
      var f = { clock: clk(min), min: min, text: text, cls: cls || '', gold: [round1(gold[0]), round1(gold[1])], kills: kills.slice(), towers: towers.slice(), dragons: dragons.slice(),
        pos: pos.map(function (p) { return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; }), dead: dead.slice() };
      if (extra) for (var k in extra) f[k] = extra[k];
      frames.push(f);
    }
    function round1(v) { return Math.round(v * 10) / 10; }
    function killPiece(i) { if (dead.indexOf(i) < 0) dead.push(i); pos[i] = i < 5 ? W.A : W.B; }
    function livePieces() { dead = []; }
    var myK = champKo(set.myChamp), opK = champKo(set.oppChamp);
    var oppName = (o.oppLine[myPos] && o.oppLine[myPos].name) || '상대';
    var me = state.p.nick;
    function sub(t) { return t.replace(/\{me\}/g, me).replace(/\{opp\}/g, oppName).replace(/\{ch\}/g, myK).replace(/\{oc\}/g, opK).replace(/\{pos\}/g, R.POS_KO[myPos]); }
    function pk(a) { return sub(rng.pick(a)); }

    pos = laneBase(-1); pos = pos.map(function (p, i) { return i < 5 ? W.A : W.B; });
    push(0, '게임 시작. ' + o.myName + ' 대 ' + o.oppName + ' — {me}의 {ch} 대 {oc}.'.replace('{me}', me).replace('{ch}', myK).replace('{oc}', opK), 'sys');
    pos = laneBase(0);
    push(1.5, '양 팀이 라인에 도착한다.', 'sys');

    var laneSc = set.scenes.filter(function (s) { return s.scene === 'lan'; });
    var skrSc = set.scenes.filter(function (s) { return s.scene === 'skr'; });
    var tfSc = set.scenes.filter(function (s) { return s.scene === 'tf'; });
    var lead = function () { return gold[0] >= gold[1] ? 0 : 1; };
    var fillers = {
      cs: ['{pos} 라인 CS가 천천히 쌓인다.', '웨이브를 정리하며 라인 주도권을 가늠한다.', '정글러가 첫 캠프를 정리하고 있다.'],
      ward: ['시야 장악을 위해 와드를 심는다.', '적 정글 입구에 제어 와드가 박힌다.']
    };
    var min = 3, step;

    function addScene(sc, start, kind) {
      var good = sc.pts > 0, crit = Math.abs(sc.pts) === 2, tm = start;
      var winSide = good ? 0 : 1;
      var detail = '성공률 ' + sc.rate + '% · 주사위 ' + sc.roll + ' → ' + ({ critS: '대성공', S: '성공', F: '실패', critF: '대실패' }[sc.res]);
      var mi = myIdx, oi = 5 + myIdx;
      livePieces();
      if (kind === 'lan') {
        var lane = LANE_OF[myPos], l = LANE[lane];
        // 라인전 위치: 각자 라인. 내 선수와 맞상대는 라인 중앙으로
        pos = laneBase(0.6);
        if (myPos !== 'JUNGLE') { pos[mi] = jit(rng, l.c, 3); pos[oi] = jit(rng, l.c, 3); }
        else { pos[mi] = jit(rng, JG_A[rng.range(0, 2)], 3); }
        push(tm - 0.8, pk(['{pos}에서 {me}의 {ch}와 {opp}의 {oc}가 라인을 두고 맞선다.', '{me}가 {opp}를 상대로 라인 주도권을 잡으려 한다.', '레벨 2 교환을 앞두고 신경전이 이어진다.']), 'info', { sc: sc.idx });
        // 정글 갱킹
        var ganker = myPos === 'JUNGLE' ? 1 : 1;
        if (myPos !== 'JUNGLE') { pos[1] = jit(rng, l.c, 6); if (good) pos[1] = jit(rng, l.c, 4); }
        else { var tl = LANE[['TOP', 'MID', 'AD'][rng.range(0, 2)]]; pos[mi] = jit(rng, tl.c, 4); pos[oi] = jit(rng, tl.c, 4); }
        if (good) {
          var vict = oi; if (myPos === 'JUNGLE') vict = 5 + rng.range(0, 3) % 5; kills[0]++; gold[0] += crit ? 1.2 : 0.7; killPiece(vict);
          if (crit && rng.chance(50)) { towers[0]++; }
          push(tm, pk(crit ? ['{me}의 완벽한 딜교환! {opp}를 솔로킬로 잡아낸다.', '{ch}의 콤보가 정확히 들어가며 {opp}가 쓰러진다.'] : ['{me}가 교환에서 이득을 보며 {opp}를 압박한다.', '{me}가 CS 격차를 벌리며 라인을 밀어붙인다.', '정글 합류와 함께 {opp}를 잡아낸다.']), crit ? 'crit-good' : 'good', { sc: sc.idx, detail: detail, flash: { type: 'kill', x: pos[oi][0], y: pos[oi][1] } });
        } else {
          kills[1]++; gold[1] += crit ? 1.2 : 0.7; var dv = (myPos === 'JUNGLE') ? mi : mi; killPiece(dv);
          push(tm, pk(crit ? ['{opp}의 {oc}가 {me}를 순식간에 잘라낸다. 큰 손해다.', '{me}가 무리한 진입으로 솔로킬을 허용한다.'] : ['{me}가 라인 주도권을 내주고 밀린다.', '{opp}가 CS 우위를 점하며 {me}를 압박한다.', '{me}가 갱킹을 읽지 못하고 손해를 본다.']), crit ? 'crit-bad' : 'bad', { sc: sc.idx, detail: detail, flash: { type: 'kill', x: W.A[0], y: W.A[1] } });
        }
      } else if (kind === 'skr') {
        var spot = rng.pick([SPOT.mid, SPOT.dragon, SPOT.baron, [30, 50], [66, 40]]);
        pos = laneBase(0.5);
        [1, 2, mi].forEach(function (i) { pos[i] = jit(rng, spot, 4); pos[5 + i] = jit(rng, spot, 5); });
        push(tm - 0.6, pk(['소규모 교전의 기미가 보인다. 양 팀이 한 지점으로 모인다.', '리쉬 근처에서 맞대결이 벌어진다.', '용 둥지 근처에서 인원이 맞붙는다.']), 'info', { sc: sc.idx });
        var n = crit ? 2 : 1;
        if (good) { for (var q = 0; q < n; q++) { killPiece(5 + [1, 2, myIdx][q % 3]); } kills[0] += n; gold[0] += 0.8 * n; }
        else { for (q = 0; q < n; q++) { killPiece([1, 2, myIdx][q % 3] === 1 && q === 0 ? myIdx : [myIdx, 1, 2][q % 3]); } kills[1] += n; gold[1] += 0.8 * n; }
        push(tm, pk(good ? ['{me}의 {ch}가 진입 타이밍을 정확히 잡아 교전을 이긴다.', '딜교환이 우리 쪽으로 기운다. {me}가 빛난다.', '{me}가 {opp}의 스킬을 피하며 킬을 챙긴다.'] : ['교전 판단이 어긋나 {me}가 먼저 쓰러진다.', '{opp}의 {oc}가 집요하게 파고들어 교전에서 밀린다.', '{me}의 진입이 늦어 아군이 고립된다.']), crit ? (good ? 'crit-good' : 'crit-bad') : (good ? 'good' : 'bad'), { sc: sc.idx, detail: detail, flash: { type: 'kill', x: spot[0], y: spot[1] } });
        if (good && rng.chance(60)) { dragons[0]++; gold[0] += 0.4; pos[1] = SPOT.dragon; push(tm + 0.8, '교전 직후 드래곤을 가져간다.', 'obj', { flash: { type: 'obj', x: SPOT.dragon[0], y: SPOT.dragon[1] } }); }
        else if (!good && rng.chance(50)) { dragons[1]++; gold[1] += 0.4; push(tm + 0.8, '상대가 드래곤을 가져간다.', 'obj-bad', { flash: { type: 'obj', x: SPOT.dragon[0], y: SPOT.dragon[1] } }); }
      } else {
        var sp = rng.pick([SPOT.baron, SPOT.dragon, SPOT.mid]);
        livePieces();
        for (var i = 0; i < 5; i++) { pos[i] = jit(rng, [sp[0] - 3, sp[1] + 3], 4); pos[5 + i] = jit(rng, [sp[0] + 3, sp[1] - 3], 4); }
        push(tm - 0.7, pk(['양 팀이 오브젝트 앞에서 대치한다. 한타가 시작될 분위기다.', '시야 싸움 끝에 5대5 한타가 열린다.', '바론 둥지 앞, 모든 선수가 모여든다.']), 'info', { sc: sc.idx });
        var dk = good ? rng.range(3, 5) : rng.range(0, 2), dl = good ? rng.range(0, 2) : rng.range(3, 5);
        if (crit) { dk = good ? 5 : dk; dl = good ? dl : 5; }
        var order = [0, 1, 2, 3, 4];
        rng.shuffle(order);
        for (i = 0; i < dk; i++) killPiece(5 + order[i]);
        rng.shuffle(order);
        for (i = 0; i < dl; i++) killPiece(order[i]);
        kills[0] += dk; kills[1] += dl; gold[0] += dk * 0.35; gold[1] += dl * 0.35;
        if (good && dl === 0 && !crit) { }
        push(tm, pk(good ? ['{me}의 {ch}가 한타의 중심에서 활약한다. 상대가 무너진다.', '완벽한 포지셔닝! 한타를 압도적으로 이긴다.', '{me}가 핵심 타깃을 정확히 끊으며 한타를 가져온다.'] : ['한타에서 진형이 무너지며 크게 패한다.', '{opp}의 {oc}에게 핵심 스킬을 허용하며 한타가 기운다.', '{me}의 포지션이 어긋나 한타 대패로 이어진다.']), crit ? (good ? 'crit-good' : 'crit-bad') : (good ? 'good' : 'bad'), { sc: sc.idx, detail: detail, flash: { type: 'tf', x: sp[0], y: sp[1] } });
        // 한타 뒤 오브젝트·타워
        livePieces();
        var side = good ? 0 : 1;
        var tw = rng.range(1, 3);
        towers[side] += tw; gold[side] += tw * 0.6;
        if (tm > 28 && rng.chance(50)) { gold[side] += 1.5; push(tm + 1, (good ? '우리 팀이 ' : '상대 팀이 ') + '바론을 처치하고 라인을 밀어붙인다.', good ? 'obj' : 'obj-bad', { flash: { type: 'obj', x: SPOT.baron[0], y: SPOT.baron[1] } }); }
        else push(tm + 1, (good ? '우리 팀이 ' : '상대 팀이 ') + '타워 ' + tw + '개를 연달아 부순다.', good ? 'obj' : 'obj-bad');
      }
      livePieces();
    }

    set.scenes.forEach(function (s, i) { s.idx = i; });
    // 라인전 0~14분
    laneSc.forEach(function (sc, i) {
      var t = 4 + (i + 1) * (9 / (laneSc.length + 1));
      push(t - 2, pk(rng.chance(50) ? fillers.cs : fillers.ward), 'info');
      addScene(sc, t, 'lan');
    });
    push(14, '14분. 라인전이 마무리되고 오브젝트 싸움이 시작된다.', 'sys');
    // 교전 14~25분
    skrSc.forEach(function (sc, i) {
      var t = 15 + (i + 1) * (9 / (skrSc.length + 1));
      pos = laneBase(0.3);
      push(t - 1.6, pk(['정글러들이 협곡 곳곳으로 움직이며 시야 싸움을 벌인다.', '미드 주도권을 두고 양 팀이 움직인다.']), 'info');
      addScene(sc, t, 'skr');
    });
    // 한타 25분~
    tfSc.forEach(function (sc, i) {
      var t = 26 + i * 5 + rng.range(0, 1);
      pos = laneBase(0.2);
      push(t - 1.4, '게임이 후반으로 접어든다. 양 팀이 마지막 승부를 준비한다.', 'sys');
      addScene(sc, t, 'tf');
    });
    // 결과
    var end = Math.max(set.dur, frames[frames.length - 1].min + 2);
    var w = set.win ? 0 : 1;
    if ((gold[w] <= gold[1 - w])) gold[w] = gold[1 - w] + 2.2;
    towers[w] = Math.max(towers[w], 9); towers[1 - w] = Math.min(towers[1 - w], 6);
    livePieces();
    for (var j = 0; j < 5; j++) {
      pos[w * 5 + j] = jit(rng, w === 0 ? [80, 20] : [20, 80], 6);
      pos[(1 - w) * 5 + j] = (1 - w) === 0 ? W.A : W.B;
    }
    set.dur = Math.round(end);
    push(end, set.win ? '넥서스 파괴! ' + o.myName + ' 승리.' : '아군 넥서스가 무너진다. ' + o.myName + ' 패배.', set.win ? 'win' : 'lose', { flash: { type: 'nexus', x: w === 0 ? 92 : 8, y: w === 0 ? 8 : 92 } });
    return frames;
  }

  // ---------- 시리즈 ----------
  // choice: {pick: champId|'auto'}
  M.play = function (state, series, prep, choice) {
    var rng = S.rng(state), p = state.p, meta = LP.data.metaFor(state.date);
    var mine = series.a === state.career.team, myId = mine ? series.a : series.b, oppId = mine ? series.b : series.a;
    var need = series.bo === 2 ? 99 : Math.floor(series.bo / 2) + 1;
    var intl = series.kind === 'msi' || series.kind === 'worlds';
    var stage = state.career.stage;
    var adapt = ensureAdapt(state, rng, stage);
    var cond = seriesCondition(state, rng);
    var pool = p.pool.filter(function (id) { var c = LP.data.db.champs[id]; return c && c.release <= state.date; });
    var res = { sets: [], cond: cond, sa: 0, sb: 0, kda: { k: 0, d: 0, a: 0 }, pomCount: 0 };
    var usedMine = [], usedOpp = [], last = null;
    var fx = R.fxOf(p.traits);
    // 첫 국제대회·첫 결승 −10
    var intlPen = false;
    if (intl || series.final) {
      var ex = adapt && adapt.monster || p.hidden.clutch >= 2 || p.traits.indexOf('intl_champ') >= 0;
      if (intl && (!p.adapt.intlKey || p.adapt.intlKey === series.key)) { p.adapt.intlKey = series.key; intlPen = !ex; }
      else if (series.final && !p.adapt.finalSeen) { intlPen = !ex; }
      if (series.final) p.adapt.finalSeen = true;
    }
    var maxSets = series.bo === 2 ? 2 : series.bo;
    var myLine = L.starters(state, myId, true), oppLine = L.starters(state, oppId);
    var myPower = L.power(state, myId), oppPower = L.power(state, oppId);
    for (var no = 1; no <= maxSets; no++) {
      if (series.bo !== 2 && (res.sa >= need || res.sb >= need)) break;
      var banned = prep.banned || [];
      var opts = pool.filter(function (id) { return banned.indexOf(id) < 0 && (!series.fearless || usedMine.indexOf(id) < 0); });
      var champ = null;
      if (no === 1 && choice && choice.pick && choice.pick !== 'auto' && opts.indexOf(choice.pick) >= 0) champ = choice.pick;
      else if (no > 1 && last && !series.fearless && opts.indexOf(last) >= 0) champ = last;
      if (!champ) {
        var cand = opts.length ? opts : pool;
        if (cand.length) champ = cand.slice().sort(function (a, b) { return poolScore(LP.data.db.champs[b], meta, pool) - poolScore(LP.data.db.champs[a], meta, pool); })[0];
        if (!champ || (series.fearless && usedMine.indexOf(champ) >= 0)) {
          var c2 = metaPick(rng, state.date, p.pos, usedMine, meta); champ = c2 ? c2.id : (cand[0] || pool[0]);
        }
      }
      last = champ;
      var decider = series.bo !== 2 && series.bo > 1 && res.sa === need - 1 && res.sb === need - 1;
      if (series.bo === 1) decider = true;
      var set = playSet(state, rng, {
        no: no, meta: meta, myLine: myLine, oppLine: oppLine, myPower: myPower, oppPower: oppPower, cond: cond, adapt: adapt, intlPen: intlPen,
        kind: series.kind, tourney: series.kind === 'po' || intl, intl: intl, final: !!series.final, decider: decider, round: series.round === undefined ? null : series.round,
        myChamp: champ, usedMine: series.fearless ? usedMine : [], usedOpp: series.fearless ? usedOpp : [], myName: prep.myName, oppName: prep.oppName
      });
      usedMine.push(champ);
      if (series.fearless) { usedOpp = set.usedOpp; usedMine = set.usedMine.concat(usedMine.filter(function (x) { return set.usedMine.indexOf(x) < 0; })); }
      res.sets.push(set);
      if (set.win) res.sa++; else res.sb++;
      res.kda.k += set.kda.k; res.kda.d += set.kda.d; res.kda.a += set.kda.a;
      if (set.pom) res.pomCount++;
      // 기록
      var rec = state.record;
      if (set.win) rec.official.w++; else rec.official.l++;
      rec.kda.k += set.kda.k; rec.kda.d += set.kda.d; rec.kda.a += set.kda.a;
      set.scenes.forEach(function (sc) { var a = rec.scenes[sc.scene]; a[1]++; if (sc.pts > 0) a[0]++; });
      rec.played = rec.played || {}; rec.played[prep.serKey] = (rec.played[prep.serKey] || 0) + 1;
      // 적응 갱신
      if (adapt) {
        adapt.sets++;
        if (adapt.bonusLeft > 0) adapt.bonusLeft--;
        if (adapt.sets % 5 === 0) adapt.pen = Math.min(0, adapt.pen + R.ADAPT_RECOVER[p.hidden.pro]);
      }
      if (set.pom) { state.fame = R.clamp(state.fame + 1, 0, 100); }
      if (set.perf <= -3) state.community = R.clamp(state.community - 3, -100, 100);
      else if (set.perf >= 3) state.community = R.clamp(state.community + 2, -100, 100);
    }
    var winnerA = res.sa > res.sb ? 1 : res.sa < res.sb ? 0 : -1;
    res.mine = mine;
    res.winner = winnerA === 1 ? myId : winnerA === 0 ? oppId : null;
    res.sMine = res.sa; res.sOpp = res.sb;
    // 시리즈 결과를 league 쪽(a,b) 기준으로
    res.sa = mine ? res.sMine : res.sOpp; res.sb = mine ? res.sOpp : res.sMine;
    if (winnerA === 1) state.record.series.w++; else if (winnerA === 0) state.record.series.l++;
    if (winnerA === 1 && (series.final || intl)) { state.community = R.clamp(state.community + 4, -100, 100); state.fame = R.clamp(state.fame + 2, 0, 100); }
    if (adapt && state.career.stage) { /* 적응 메모는 상태 카드에서 읽는다 */ }
    res.adapt = adapt ? { label: adapt.label, pen: adapt.pen, sets: adapt.sets } : null;
    res.intlPen = intlPen;
    res.meName = prep.myName; res.oppName = prep.oppName;
    return res;
  };

  // 관전 없이 쓰는 한 줄 요약용
  M.summarize = function (res) {
    return res.sets.map(function (s) { return (s.win ? '승' : '패') + ' ' + champKo(s.myChamp) + ' ' + s.kda.k + '/' + s.kda.d + '/' + s.kda.a; }).join(', ');
  };

  M.poolScore = function (id, date, pool) { var meta = LP.data.metaFor(date); return poolScore(LP.data.db.champs[id], meta, pool); };
  M.metaPick = function (state, pos) { return metaPick(S.rng(state), state.date, pos, [], LP.data.metaFor(state.date)); };
  LP.match = M;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
