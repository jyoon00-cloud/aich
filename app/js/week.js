/* week.js — 주간 진행(턴=1주): 행동 → 성장·솔랭 → 이벤트 → 경기 웨이브 → 마무리(날짜 +7일, 연말 처리). DOM 의존 없음. */
(function (LP) {
  'use strict';
  var R = LP.rules, S = LP.state, L = LP.league, M = LP.match;
  var W = { lastMatch: null };
  var ACTION_KO = { train: '훈련', solo: '솔로랭크 집중', stream: '방송', rest: '휴식' };
  W.ACTION_KO = ACTION_KO;

  // ---------- 도우미 ----------
  function logGrowth(state, stat, d, why) {
    state.growthLog.push([state.date, stat, d, why]);
    if (state.growthLog.length > 60) state.growthLog.shift();
  }
  function setStat(state, k, d, why) {
    var p = state.p, before = p.stats[k];
    p.stats[k] = R.clamp(before + d, 0, p.potential);
    if (p.stats[k] !== before) logGrowth(state, k, p.stats[k] - before, why || '');
    return p.stats[k] - before;
  }
  function bgGrowthMult(state, k) {
    var bg = state.p.bg, sum = 0;
    if (!bg) return 0;
    bg.merits.concat(bg.costs).forEach(function (e) {
      if (e.t !== 'growth') return;
      if (e.months && state.date > bg.expires) return;
      if (e.stats === 'all' || e.stats.indexOf(k) >= 0) sum += e.mult;
    });
    return sum;
  }
  // 4.1 훈련 성장 한 번
  function growOne(state, rng, k, why) {
    var p = state.p, v = p.stats[k], base = R.growthBase(v, rng);
    if (base <= 0) return 0;
    var sum = 0;
    if (v < 200) sum += R.BEGINNER_BONUS;
    sum += R.STAGE_GROWTH[state.career.stage] || 0;
    sum += bgGrowthMult(state, k);
    sum += R.PRO_GROWTH[p.hidden.pro];
    var amt = Math.round(base * (1 + sum));
    amt = Math.round(amt * R.fxOf(p.traits).growth);
    if (state.career.stage === 'amateur' && v >= 300) amt = Math.floor(amt / 2);
    if (S.age(state) >= 25 && k === 'phy') amt = Math.floor(amt / 2);
    return setStat(state, k, Math.max(0, amt), why || '훈련');
  }
  function soloGames(state, rng, games) {
    var q = state.soloq, ovr = R.ovr(state.p.stats), w = 0, l = 0, start = q.mmr;
    for (var i = 0; i < games; i++) {
      var pr = R.clamp(50 + (ovr - R.mmrToOvr(q.mmr)) * R.SOLO_WINRATE_SLOPE, 5, 95);
      var d = rng.range(18, 22);
      if (rng.int(100) <= pr) { w++; q.mmr += d; } else { l++; q.mmr -= d; }
      q.mmr = R.clamp(q.mmr, 0, R.RP_MAX);
    }
    q.w += w; q.l += l; q.totW = (q.totW || 0) + w; q.totL = (q.totL || 0) + l;
    syncTier(state);
    return { w: w, l: l, delta: q.mmr - start };
  }
  function syncTier(state) { var t = R.tierInfo(state.soloq.mmr); state.soloq.tier = t.ko + (t.div ? ' ' + ['', 'I', 'II', 'III', 'IV'][t.div] : ''); state.soloq.lp = t.lp; state.soloq.idx = t.idx; return t; }
  W.syncTier = syncTier;

  // ---------- 이벤트 API ----------
  W.makeApi = function (state) {
    var rng = S.rng(state), p = state.p;
    var api = {
      s: state, p: p, rng: rng,
      ovr: function () { return R.ovr(p.stats); },
      age: function () { return S.age(state); },
      month: function () { return +state.date.slice(5, 7); },
      speech: function () { return 10 * (p.speech - 3); },
      check: function (base) { return rng.int(100) <= R.clamp(base + 10 * (p.speech - 3), 5, 95); },
      evMult: function (ev) { return R.bgEventMult(p.bg, ev, state.date); },
      stat: function (k, d) { setStat(state, k, d, '이벤트'); },
      fame: function (d) { state.fame = R.clamp(state.fame + d, 0, 100); },
      comm: function (d) { state.community = R.clamp(state.community + d, -100, 100); },
      money: function (d) { state.career.money += d; },
      slump: function (w) { p.status.slump = Math.max(0, p.status.slump + w); },
      injury: function (w) { p.status.injury = Math.max(0, p.status.injury + w); if (w >= 5) p.longInjury = true; },
      men: function (d) { p.status.slump = Math.max(0, p.status.slump - d); },
      soloMmr: function (d) { state.soloq.mmr = R.clamp(state.soloq.mmr + d, 0, R.RP_MAX); syncTier(state); },
      slumpDrift: function () { },
      promoteStarter: function () { if (state.career.contract) state.career.contract.role = 'starter'; },
      offers: function (kind, n, checkOnly, transfer) { return L.offers(state, kind, n, checkOnly, transfer); },
      join: function (offer) {
        var msg = L.join(state, offer);
        S.addFeed(state, 'contract', { offer: offer }, msg + '.', { tpl: 'contract' });
        return msg + '.';
      },
      patchVictim: function () {
        if (!p.sig.length) return null;
        var id = p.sig[rng.range(0, p.sig.length - 1)], c = LP.data.db.champs[id];
        return { id: id, name: c ? c.ko : id };
      },
      markPatched: function (id) { state.patched = state.patched || {}; state.patched[id] = S.addDays(state.date, 84); },
      mastery: function (id, d) { p.mastery[id] = R.clamp((p.mastery[id] || 0) + d, 0, 100); LP.mastery.syncPool(p); },
      swapSig: function (id) { return LP.mastery.swapSig(state, rng, id); },
      addSig: function (id) { return LP.mastery.addSig(state, id); },
      canNewChamp: function () { return LP.mastery.newChampPool(state).length > 0; },
      newChampCands: function () { return LP.mastery.newChampCands(state, rng).map(function (c) { return { id: c.id, ko: c.ko }; }); },
      streakChamp: function (consume) {
        var st = p.streak;
        if (!st || !st.id || st.n < 4 || p.sig.indexOf(st.id) >= 0) return null;
        var c = LP.data.db.champs[st.id], out = { id: st.id, name: c ? c.ko : st.id, n: st.n };
        if (consume) p.streak = { id: null, n: 0 };
        return out;
      }
    };
    return api;
  };
  var EXTRA = [
    { id: 'fa_offer', title: 'FA 영입 제안', cd: 0,
      prob: function (s) { return s.career.fa ? 45 : 0; },
      data: function (s, api) { var of = api.offers(s.career.stage === 'amateur' ? 'cl' : s.career.stage, 3); return of.length ? { offers: of } : null; },
      text: function () { return 'FA 시장에서 구단들이 연락을 해 왔다.'; },
      options: function (s, d) { return d.offers.map(function (o, i) { return { id: 'o' + i, label: o.teamName + ' (' + o.league + ') · 연봉 ' + R.fmtMoney(o.salary) + ' · ' + (o.role === 'starter' ? '주전' : '후보') + ' · ' + o.years + '년', apply: function (api) { return api.join(o); } }; })
        .concat([{ id: 'wait', label: '더 기다린다', apply: function () { return '조건을 더 지켜보기로 했다.'; } }]); } }
  ];
  function defOf(id) {
    var i, all = R.EVENTS.concat(EXTRA);
    for (i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }

  function rollEvent(state, api) {
    var rng = S.rng(state), hit = null;
    Object.keys(state.cooldown).forEach(function (k) { if (state.cooldown[k] > 0) state.cooldown[k]--; });
    R.EVENTS.concat(EXTRA).forEach(function (e) {
      if (state.cooldown[e.id] > 0) return;
      var pr = e.prob(state, api);
      if (pr > 0 && rng.random() * 100 < pr && !hit) hit = e;
    });
    if (!hit) return null;
    var data = null;
    if (hit.data) { data = hit.data(state, api); if (!data) return null; }
    state.cooldown[hit.id] = hit.cd || 8;
    return { id: hit.id, data: data };
  }
  function makeEventPending(state, ev) {
    var d = defOf(ev.id), opts = d.options(state, ev.data);
    return { kind: 'event', id: ev.id, title: d.title, text: d.text(state, ev.data), data: ev.data, options: opts.map(function (o) { return { id: o.id, label: o.label, sub: o.sub }; }) };
  }

  // ---------- 스토브: 플레이어 계약 ----------
  function stovePending(state) {
    var c = state.career, year = +state.date.slice(0, 4), rng = S.rng(state), p = state.p;
    if (!c.contract || !c.team) return null;
    if (+c.contract.end.slice(0, 4) > year) return null;
    var ovr = R.ovr(p.stats), team = state.world.teams[c.team];
    var cur = null;
    team.players.forEach(function (id) { if (id === 'PLAYER') return; var x = state.world.npcs[id]; if (x && x.pos === p.pos && (!cur || R.ovr(x.stats) > R.ovr(cur.stats))) cur = x; });
    var role = c.stage === 'academy' ? 'sub' : (!cur || ovr >= R.ovr(cur.stats) - 5 ? 'starter' : 'sub');
    var years = rng.range(1, 3);
    var own = { team: c.team, teamName: team.name, league: c.league, stage: c.stage, role: role, years: c.stage === 'academy' ? 1 : years, salary: R.rollSalary(rng, c.league, year, ovr, c.stage, role, state.fame) };
    var offers = c.stage === 'academy' ? L.offers(state, 'cl', 2) : L.offers(state, c.stage, 2, false, true);
    return { kind: 'event', id: 'stove', title: '계약 만료 · 스토브리그', text: team.name + '과의 계약이 만료된다. 재계약, 다른 팀 제안, FA 중에서 정해야 한다.', data: { own: own, offers: offers },
      options: [{ id: 'own', label: '재계약 · ' + team.name + ' · 연봉 ' + R.fmtMoney(own.salary) + ' · ' + (own.role === 'starter' ? '주전' : '후보') + ' · ' + own.years + '년' }]
        .concat(offers.map(function (o, i) { return { id: 'o' + i, label: o.teamName + ' (' + o.league + ') · 연봉 ' + R.fmtMoney(o.salary) + ' · ' + (o.role === 'starter' ? '주전' : '후보') + ' · ' + o.years + '년' }; }))
        .concat([{ id: 'fa', label: 'FA로 나가 더 좋은 조건을 기다린다' }]) };
  }
  function resolveStove(state, pend, optId) {
    var api = W.makeApi(state), d = pend.data, msg;
    if (optId === 'own') msg = api.join(d.own);
    else if (optId === 'fa') {
      L.leaveTeam(state); state.career.fa = true;
      msg = 'FA 시장으로 나왔다. 구단들의 연락을 기다린다.';
    } else { msg = api.join(d.offers[+optId.slice(1)]); }
    return msg;
  }

  // ---------- 주간 흐름 ----------
  function newWeek(state, input) {
    var rng = S.rng(state), p = state.p, c = state.career;
    LP.mastery.ensure(state);
    var action = input.action || 'train';
    if (p.status.injury > 0 && action !== 'rest') action = action; // 부상 중에는 집중 1개로 줄인다(아래)
    var focus = (input.focus || []).filter(function (k) { return R.STATS.indexOf(k) >= 0; });
    if (!focus.length) focus = lowestTwo(state);
    var wk = { action: action, focus: focus, wave: 0, plan: null, evq: [], hadMatch: false, scrim: false, results: [], growth: {}, soloq: null, notes: [], startMmr: state.soloq.mmr, gradeBefore: R.STATS.map(function (k) { return R.gradeIdx(p.stats[k]); }), tierBefore: R.tierIdx(state.soloq.mmr), yearBefore: +state.date.slice(0, 4) };
    // 행동 효과
    var nFocus = action === 'train' ? 2 : (action === 'rest' ? 0 : 1);
    if (p.status.injury > 0 && nFocus > 1) nFocus = 1;
    focus.slice(0, nFocus).forEach(function (k) {
      var d = growOne(state, rng, k, ACTION_KO[action]);
      wk.growth[k] = (wk.growth[k] || 0) + d;
    });
    var games = R.SOLO_GAMES[action];
    p.bg && p.bg.merits.forEach(function (e) { if (e.t === 'solo') games *= e.mult; });
    wk.soloq = soloGames(state, rng, Math.round(games));
    if (action === 'stream') {
      var gain = rng.range(1, 2) * R.bgEventMult(p.bg, 'broadcast', state.date);
      gain = Math.round(gain + (state.fame < 30 ? 1 : 0));
      state.fame = R.clamp(state.fame + gain, 0, 100);
      var inc = 10 + Math.round(state.fame * 2); c.money += inc; wk.notes.push('방송 수입 ' + R.fmtMoney(inc));
    }
    if (action === 'rest') { p.status.slump = Math.max(0, p.status.slump - 1); p.status.injury = Math.max(0, p.status.injury - 1); }
    if (action === 'train' || action === 'solo') p.trainWeeks = (p.trainWeeks || 0) + 1;
    // 급여
    if (c.contract) c.money += Math.round(c.contract.salary / 52);
    // 숙련도: 주마다 주력 챔피언 성장, 안 쓴 챔피언 감소. 훈련·솔랭 8주마다 새 챔피언 연습
    LP.mastery.weekly(state, rng, action);
    if ((action === 'train' || action === 'solo') && state.week % 8 === 7 && Object.keys(p.mastery).length < 12) {
      var cc = LP.mastery.explore(state, rng);
      if (cc) wk.notes.push('새 연습 챔피언 ' + cc.ko);
    }
    // 스크림
    if (c.stage !== 'amateur' && rng.chance(25)) wk.scrim = true;
    // 이벤트 후보: 스토브 -> 일반
    var cal = L.calendar(+state.date.slice(0, 4));
    if (!state.world.stoveDone[+state.date.slice(0, 4)] && state.date >= cal.stoveStart) {
      var aw = L.seasonAwards(state, +state.date.slice(0, 4));
      if (aw && aw.mine.length) wk.notes = (wk.notes || []).concat(aw.mine.map(function (x) { return x + ' 선정'; }));
      L.stove(state);
      var sp = stovePending(state);
      if (sp) wk.evq.push({ stove: sp });
    }
    var api = W.makeApi(state);
    var ev = rollEvent(state, api);
    if (ev && !wk.evq.length) wk.evq.push(ev);
    state.wk = wk;
  }
  function lowestTwo(state) {
    var p = state.p, ks = R.STATS.filter(function (k) { return p.stats[k] < p.potential; });
    if (ks.length < 2) ks = R.STATS.slice();
    ks.sort(function (a, b) { return p.stats[a] - p.stats[b]; });
    return ks.slice(0, 2);
  }
  W.lowestTwo = lowestTwo;

  function playerSeries(state, plan) {
    var c = state.career, p = state.p, rng = S.rng(state);
    if (c.stage !== 'cl' && c.stage !== 'pro') return null;
    if (!c.team || !c.contract) return null;
    var tier = c.stage === 'cl' ? 'cl' : 'pro', hit = null;
    plan.series.forEach(function (s) { if (!hit && !s.res && s.tier === tier && (s.a === c.team || s.b === c.team)) hit = s; });
    if (!hit) return null;
    if (p.status.injury > 0) { p.subWeeks = (p.subWeeks || 0) + 1; return null; }
    if (c.contract.role === 'sub' && !rng.chance(20)) { p.subWeeks = (p.subWeeks || 0) + 1; return null; }
    p.subWeeks = 0;
    return hit;
  }

  // 한 번 진행. 선택 대기가 생기면 멈춘다.
  function advance(state, auto) {
    var wk = state.wk, rng = S.rng(state);
    while (state.wk) {
      if (wk.evq.length) {
        var e = wk.evq.shift();
        if (e.stove) { state.pending = e.stove; return; }
        state.pending = makeEventPending(state, e); return;
      }
      if (!wk.plan) {
        wk.plan = L.planWave(state, wk.wave);
        wk.cur = null;
      }
      var ps = wk.cur === null || wk.cur === undefined ? playerSeries(state, wk.plan) : null;
      if (ps) {
        wk.cur = ps.id; wk.hadMatch = true;
        var prep = M.prepare(state, ps);
        state.pending = { kind: 'match', series: ps, prep: prep };
        if (auto) { resolveMatch(state, { pick: 'auto' }); continue; }
        return;
      }
      L.simRest(state, wk.plan);
      L.endWave(state, wk.plan);
      if (wk.plan.more) { wk.wave++; wk.plan = null; wk.cur = null; continue; }
      finishWeek(state);
    }
  }

  function resolveMatch(state, choice) {
    var pend = state.pending, wk = state.wk, s = pend.series;
    var res = (choice && choice.res) ? choice.res : M.play(state, s, pend.prep, choice || {});
    L.applyResult(state, s, { winner: res.winner, sa: res.sa, sb: res.sb });
    W.lastMatch = res;
    var win = res.winner === pend.prep.me;
    var facts = { opp: pend.prep.oppName, my: pend.prep.myName, kind: s.kind, name: s.name, bo: s.bo, final: !!s.final, win: win, draw: res.winner === null, score: res.sMine + '-' + res.sOpp,
      mvp: !!res.mvp, sets: res.sets.map(function (x) { return { win: x.win, champ: M.champKo(x.myChamp), vs: M.champKo(x.oppChamp), kda: x.kda.k + '/' + x.kda.d + '/' + x.kda.a, pom: x.pom, dur: x.dur, sig: !!x.sigPick,
        scenes: x.scenes.map(function (sc) { return { l: sc.label, r: sc.res, rate: sc.rate, roll: sc.roll, me: sc.me, opp: sc.opp }; }) }; }),
      cond: res.cond.label, adapt: res.adapt, player: state.p.nick, pos: state.p.pos, pom: res.pomCount };
    var entry = S.addFeed(state, 'match', facts, LP.narrate.template(state, 'match', facts), { ai: true });
    wk.results.push({ win: win, draw: res.winner === null, score: facts.score, opp: facts.opp });
    var lg = state.record.log; lg.push({ date: state.date, name: s.name, kind: s.kind, bo: s.bo, opp: facts.opp, win: win, draw: res.winner === null, score: facts.score, final: !!s.final });
    if (lg.length > 300) lg.splice(0, lg.length - 300);
    res.feedId = entry.id;
    state.pending = null;
    wk.cur = 'done';
    // 같은 웨이브에 내 시리즈가 더 있을 수 있다 → advance가 다시 찾는다
    wk.cur = null;
    return res;
  }

  function finishWeek(state) {
    var wk = state.wk, p = state.p, c = state.career, rng = S.rng(state);
    // 비집중 능력치: 공식 경기·중요 스크림이 있던 주에만 30% +1
    if (wk.hadMatch || wk.scrim) {
      var nf = R.STATS.filter(function (k) { return wk.focus.slice(0, wk.action === 'train' ? 2 : 1).indexOf(k) < 0 });
      if (wk.action !== 'rest') nf.forEach(function (k) { if (rng.int(100) <= R.OFF_FOCUS_CHANCE) { var d = setStat(state, k, 1, '경기 경험'); wk.growth[k] = (wk.growth[k] || 0) + d; } });
    }
    if (wk.scrim && !wk.hadMatch) {
      var pw = L.power(state, c.team), win = rng.chance(R.clamp(50 + (R.ovr(p.stats) - 400) * 0.1, 30, 70));
      if (win) state.record.scrim.w++; else state.record.scrim.l++;
    }
    // 상태 감소
    if (wk.action !== 'rest') { p.status.slump = Math.max(0, p.status.slump - 1); p.status.injury = Math.max(0, p.status.injury - 1); }
    // 월간 역할 점검
    if (state.week % 4 === 3) {
      var ch = L.refreshRole(state);
      if (ch === 'up') S.addFeed(state, 'role', { to: 'starter' }, '코치진이 ' + p.nick + ' 선수의 기량을 인정해 주전 자리를 맡겼다.', { tpl: 'role' });
      if (ch === 'down') S.addFeed(state, 'role', { to: 'sub' }, '성적 부진으로 ' + p.nick + ' 선수가 후보로 내려갔다.', { tpl: 'role' });
    }
    // 아카데미 -> 계약 만료 확인은 스토브에서. 날짜 이동
    var oldYear = +state.date.slice(0, 4);
    var next = S.addDays(state.date, 7);
    var newYear = +next.slice(0, 4);
    var summary = weekSummary(state, wk);
    wk.summary = summary;
    var tierNow = R.tierIdx(state.soloq.mmr);
    state.date = next; state.week++;
    if (newYear !== oldYear) yearEnd(state, rng, newYear);
    var line = LP.narrate.weekLine(state, summary);
    var e = S.addFeed(state, 'week', summary, line, { oneLine: true });
    e.date = S.addDays(state.date, -7 * 1);
    W.lastWeek = { entry: e, summary: summary, gradeUp: gradeUps(state, wk), tierChanged: tierNow !== wk.tierBefore, yearEnd: newYear !== oldYear, match: wk.hadMatch };
    state.wk = null;
  }
  function gradeUps(state, wk) {
    var ups = [];
    R.STATS.forEach(function (k, i) { var g = R.gradeIdx(state.p.stats[k]); if (g > wk.gradeBefore[i]) ups.push({ stat: k, grade: R.gradeName(state.p.stats[k]) }); });
    return ups;
  }
  function weekSummary(state, wk) {
    var q = state.soloq;
    return { action: wk.action, focus: wk.focus.slice(0, wk.action === 'train' ? 2 : wk.action === 'rest' ? 0 : 1), growth: wk.growth, solo: wk.soloq, tier: R.tierInfo(q.mmr).text, matches: wk.results, notes: wk.notes,
      phase: L.phaseLabel(state), ovr: R.ovr(state.p.stats), injured: state.p.status.injury > 0, slump: state.p.status.slump > 0 };
  }

  // ---------- 특성 후보 (시즌 종료) ----------
  function traitCandidates(state) {
    var p = state.p, r = state.record, sc = r.seas, c = state.career, g = LP.data.db.traits.general, out = { pos: [], neg: [] };
    function have(id) { return p.traits.indexOf(id) >= 0; }
    function add(list, id, evidence) { if (have(id) || !g[id]) return; list.push({ id: id, name: g[id].name, effect: g[id].text, evidence: evidence }); }
    function rate(a) { return Math.round(a[0] / a[1] * 100); }
    if (sc.lan[1] >= 30 && sc.lan[0] / sc.lan[1] >= 0.62) add(out.pos, 'lane_king', '라인전 성공률 ' + rate(sc.lan) + '% · ' + sc.lan[1] + '장면 (이번 시즌)');
    if (sc.skr[1] >= 30 && sc.skr[0] / sc.skr[1] >= 0.62) add(out.pos, 'skirmisher', '소규모 교전 성공률 ' + rate(sc.skr) + '% · ' + sc.skr[1] + '장면 (이번 시즌)');
    if (sc.tf[1] >= 30 && sc.tf[0] / sc.tf[1] >= 0.62) add(out.pos, 'teamfighter', '한타 성공률 ' + rate(sc.tf) + '% · ' + sc.tf[1] + '장면 (이번 시즌)');
    if (sc.w + sc.l >= 20 && sc.d > 0 && (sc.k + sc.a) / sc.d >= 5) add(out.pos, 'survivor', 'KDA ' + ((sc.k + sc.a) / sc.d).toFixed(1) + ' · ' + (sc.w + sc.l) + '세트 (이번 시즌)');
    if (r.intlTitles >= 1) add(out.pos, 'intl_champ', '국제대회 우승 ' + r.intlTitles + '회 (커리어)');
    if (r.leagueTitles >= 3 && r.intlTitles === 0) add(out.pos, 'domestic_king', '리그 우승 ' + r.leagueTitles + '회 · 국제대회 우승 없음 (커리어)');
    if (c.stage === 'pro' && c.contract && c.contract.role === 'starter' && (r.proYears || 0) >= 10) add(out.pos, 'iron', '1군 주전 ' + r.proYears + '시즌째 (커리어)');
    if (r.finalsLost >= 3 && p.hidden.clutch <= -1) add(out.neg, 'choker', '결승 패배 ' + r.finalsLost + '회, 큰 무대에서 번번이 흔들렸다 (커리어)');
    return out;
  }
  function traitFeed(state, id, evidence, replaced) {
    var nm = R.traitName(id);
    S.addFeed(state, 'trait', { id: id, name: nm, evidence: evidence || '' }, state.p.nick + ' 선수가 특성 "' + nm + '"을(를) 얻었다.' + (replaced ? ' (' + R.traitName(replaced) + ' 대신)' : ''), { tpl: 'trait' });
  }
  function resolveTrait(state, pend, optId) {
    var p = state.p, g = LP.data.db.traits.general;
    if (pend.id === 'trait_notice') {
      var id = pend.data.id, out = null;
      if (p.traits.indexOf(id) >= 0) return '';
      // 부정 특성은 3개 제한 안에서 우선한다: 칸이 차 있으면 가장 늦게 얻은 긍정 특성을 밀어낸다
      if (p.traits.length >= 3) {
        for (var j = p.traits.length - 1; j >= 0; j--) if (!(g[p.traits[j]] && g[p.traits[j]].neg)) { out = p.traits[j]; break; }
        if (!out) return '';
        p.traits.splice(p.traits.indexOf(out), 1);
      }
      p.traits.push(id); traitFeed(state, id, pend.options[0].sub, out);
      return '"' + R.traitName(id) + '" 특성이 붙었다.' + (out ? ' "' + R.traitName(out) + '" 특성은 사라졌다.' : '');
    }
    if (pend.id === 'trait_pick') {
      if (optId === 'hold') return '이번에는 특성을 고르지 않았다.';
      var cid = optId.slice(2), cand = pend.data.cands.filter(function (x) { return x.id === cid; })[0];
      if (!cand) return '';
      if (p.traits.length < 3) { p.traits.push(cid); traitFeed(state, cid, cand.evidence); return '"' + cand.name + '" 특성을 얻었다.'; }
      state.pq = state.pq || [];
      state.pq.unshift({ kind: 'event', id: 'trait_replace', title: '특성 교체', text: '특성 칸이 가득 찼다. "' + cand.name + '"을(를) 얻으려면 기존 특성 하나를 내려놓아야 한다.', data: { id: cid, name: cand.name, evidence: cand.evidence },
        options: p.traits.map(function (t) { return { id: 'r_' + t, label: R.traitName(t) + ' 대신 얻는다', sub: g[t] ? g[t].text : '' }; }).concat([{ id: 'hold', label: '교체하지 않는다', sub: '기존 특성을 그대로 둔다' }]) });
      return '"' + cand.name + '" 특성을 얻을지 정한다.';
    }
    if (pend.id === 'trait_replace') {
      if (optId === 'hold') return '기존 특성을 그대로 두었다.';
      var old = optId.slice(2), i = p.traits.indexOf(old);
      if (i < 0) return '';
      p.traits.splice(i, 1, pend.data.id); traitFeed(state, pend.data.id, pend.data.evidence, old);
      return '"' + pend.data.name + '" 특성을 얻고 "' + R.traitName(old) + '"을(를) 내려놓았다.';
    }
    return '';
  }

  // ---------- 연말 ----------
  function yearEnd(state, rng, newYear) {
    var p = state.p, c = state.career, r = state.record;
    // 시즌 기록(커리어 표)과 특성 후보 — 장면 통계는 이 시즌 것만 쓴다
    if (c.stage === 'pro' && c.contract && c.contract.role === 'starter') r.proYears = (r.proYears || 0) + 1;
    var q = state.soloq, seasonYear = newYear - 1, snap = r.snap || { w: 0, l: 0, t: 0 };
    var cands = traitCandidates(state);
    r.seasons.push({ year: seasonYear, team: c.team ? L.teamName(state, c.team) : '무소속', stage: c.stage, league: c.league || '', w: r.official.w - snap.w, l: r.official.l - snap.l,
      titles: r.titles.slice(snap.t || 0), tier: R.tierInfo(q.mmr).text, soloW: q.w, soloL: q.l, ovr: R.ovr(p.stats) });
    var seasonRec = { w: r.official.w - snap.w, l: r.official.l - snap.l };
    r.snap = { w: r.official.w, l: r.official.l, t: r.titles.length };
    r.seas = { year: newYear, lan: [0, 0], skr: [0, 0], tf: [0, 0], w: 0, l: 0, k: 0, d: 0, a: 0 };
    var finalTier = R.tierInfo(q.mmr).text;
    // 솔로랭크 시즌 초기화: 전적·LP·티어를 새로 시작하되 MMR은 평균 쪽으로 당겨 시작한다
    q.mmr = Math.round(q.mmr * 0.8 + R.SOLO_BASE_MMR * 0.2); q.w = 0; q.l = 0; q.season = newYear; syncTier(state);
    p.usage = { year: newYear, c: {} };
    var queue = [];
    if (cands.pos.length) {
      queue.push({ kind: 'event', id: 'trait_pick', title: '특성 획득', text: seasonYear + ' 시즌을 마쳤다. 조건을 채운 특성 중 하나를 얻을 수 있다. (보유 ' + p.traits.length + '/3)',
        data: { cands: cands.pos }, options: cands.pos.map(function (t) { return { id: 't_' + t.id, label: t.name, sub: t.effect + ' · ' + t.evidence }; }).concat([{ id: 'hold', label: '보류', sub: '다음 시즌에 조건을 다시 확인한다' }]) });
    }
    cands.neg.forEach(function (t) {
      queue.push({ kind: 'event', id: 'trait_notice', title: '특성 부여', text: p.nick + ' 선수에게 "' + t.name + '" 특성이 붙었다.', data: { id: t.id },
        options: [{ id: 'ok', label: '확인', sub: t.effect + ' · ' + t.evidence }] });
    });
    // 에이징 (만 25세부터, 1월 1일 기준 나이)
    var age = S.ageAt(p.birth, newYear + '-01-01'), fx = R.fxOf(p.traits), row = R.agingRow(age), lost = [];
    if (row) {
      R.STATS.forEach(function (k) {
        var pr = row.p + (R.AGING_STAT_ADJ[k] || 0) + (R.AGING_PRO_ADJ[p.hidden.pro] || 0) + fx.agingProb;
        if ((p.trainWeeks || 0) >= 30 && !p.longInjury) pr -= 5;
        if (rng.int(100) <= pr) { var d = row.roll(rng); var got2 = -setStat(state, k, -d, '에이징'); if (got2) lost.push(R.STAT_SHORT[k] + ' -' + got2); }
      });
      if (lost.length) S.addFeed(state, 'aging', { age: age, lost: lost }, p.nick + ' 선수도 어느덧 만 ' + age + '세. 새해를 맞아 ' + lost.join(', ') + '.', { tpl: 'aging' });
    }
    p.trainWeeks = 0; p.longInjury = false;
    // FA로 새해를 맞으면 무소속
    if (c.fa || (!c.team && c.stage !== 'amateur')) { c.stage = 'amateur'; c.fa = false; c.team = null; c.league = null; c.contract = null; S.addFeed(state, 'career', {}, '새 팀을 구하지 못해 무소속 아마추어로 새해를 맞았다.', { tpl: 'career' }); }
    L.newYear(state, newYear);
    S.addFeed(state, 'season', { year: newYear - 1, record: seasonRec, titles: r.titles.slice(snap.t || 0).slice(-3), ovr: R.ovr(p.stats), tier: finalTier }, '', { ai: true, tpl: 'season' });
    state.feed[state.feed.length - 1].text = LP.narrate.template(state, 'season', state.feed[state.feed.length - 1].facts);
    if (queue.length) { state.pq = (state.pq || []).concat(queue); }
  }

  // ---------- 공개 API ----------
  W.step = function (state, input) {
    if (state.pending) throw new Error('선택 대기 중입니다');
    if (state.wk) throw new Error('진행 중인 주가 있습니다');
    S.rng(state);
    LP.mastery.ensure(state);
    newWeek(state, input || {});
    W.lastWeek = null;
    advance(state, !!(input && input.autoMatch));
    if (!state.pending && state.pq && state.pq.length) state.pending = state.pq.shift();
    S.sync(state);
    return { pending: state.pending, done: !state.wk };
  };
  W.resolve = function (state, payload) {
    var pend = state.pending;
    if (!pend) throw new Error('대기 중인 선택이 없습니다');
    S.rng(state);
    var match = null;
    if (pend.kind === 'event') {
      var msg;
      if (pend.id === 'stove') msg = resolveStove(state, pend, payload.option);
      else if (pend.id === 'trait_pick' || pend.id === 'trait_notice' || pend.id === 'trait_replace') msg = resolveTrait(state, pend, payload.option);
      else {
        var d = defOf(pend.id), opts = d.options(state, pend.data), o = opts.filter(function (x) { return x.id === payload.option; })[0] || opts[opts.length - 1];
        msg = o.apply(W.makeApi(state), pend.data);
      }
      var chosen = pend.options.filter(function (x) { return x.id === payload.option; })[0];
      var facts = { id: pend.id, title: pend.title, text: pend.text, choice: chosen ? chosen.label : '', result: msg };
      if (pend.id.indexOf('trait_') !== 0) S.addFeed(state, 'event', facts, LP.narrate.template(state, 'event', facts), { ai: true });
      state.pending = (state.pq && state.pq.length) ? state.pq.shift() : null;
    } else if (pend.kind === 'match') {
      match = resolveMatch(state, payload);
    }
    advance(state, !!payload.autoMatch);
    if (!state.pending && state.pq && state.pq.length) state.pending = state.pq.shift();
    S.sync(state);
    return { pending: state.pending, done: !state.wk, match: match };
  };

  // 자동 진행. opts: {span: n|'match'|'season', plan, stops}
  W.autoRun = function (state, opts) {
    var prefs = state.prefs, stops = opts.stops || prefs.stops, plan = opts.plan || prefs.speed.plan, span = opts.span;
    var weeks = 0, reason = 'done', startFeed = state.feed.length, startYear = +state.date.slice(0, 4), startIdx = state.feed.length;
    var guard = 0;
    while (guard++ < 400) {
      if (state.pending) { reason = state.pending.kind === 'match' ? 'match' : 'event'; break; }
      var action = plan.action, focus = plan.auto ? lowestTwo(state) : plan.focus;
      if (state.p.status.injury > 0) action = 'rest';
      var r = W.step(state, { action: action, focus: focus, autoMatch: !stops.match });
      if (r.pending && !r.done) {
        if (r.pending.kind === 'event') { reason = 'event'; break; }
        if (r.pending.kind === 'match') { reason = 'match'; break; }
      }
      weeks++;
      var lw = W.lastWeek;
      if (span === 'match' && lw && lw.match) { reason = 'matchDone'; break; }
      if (lw && stops.grade && lw.gradeUp.length) { reason = 'grade'; break; }
      if (lw && stops.tier && lw.tierChanged) { reason = 'tier'; break; }
      if (lw && stops.season && lw.yearEnd) { reason = 'season'; break; }
      if (lw && stops.weekly) { reason = 'weekly'; break; }
      if (typeof span === 'number' && weeks >= span) { reason = 'done'; break; }
      if (span === 'season' && lw && lw.yearEnd) { reason = 'season'; break; }
    }
    return { weeks: weeks, reason: reason, from: startIdx, entries: state.feed.slice(startIdx) };
  };

  W.digestFacts = function (state, fromIdx) {
    var es = state.feed.slice(fromIdx);
    return { lines: es.filter(function (e) { return e.kind === 'week'; }).map(function (e) { return e.text; }), others: es.filter(function (e) { return e.kind !== 'week'; }).map(function (e) { return e.text; }).slice(0, 8) };
  };

  LP.week = W;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
