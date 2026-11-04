/* league.js — 월드(팀·선수·NPC), schedule.json 달력, 주간 시리즈 계획·NPC 경기, 스토브리그, 연말 갱신, 입단 제안. DOM 의존 없음. */
(function (LP) {
  'use strict';
  var R = LP.rules, S = LP.state;
  var L = {};
  var POS = R.POS;

  function ovrOf(stats) { return R.ovr(stats); }
  function randStats(rng, ovr, spread) {
    var o = {}; R.STATS.forEach(function (k) { o[k] = R.clamp(Math.round(ovr + rng.range(-spread, spread)), 0, 500); });
    return o;
  }

  // ---------- 가상 선수 ----------
  var NICKS = ['Nova', 'Echo', 'Blaze', 'Rune', 'Kite', 'Moss', 'Ash', 'Pike', 'Lynx', 'Orbit', 'Cipher', 'Drift', 'Flint', 'Haze', 'Ivy', 'Jolt', 'Koda', 'Luna', 'Mirage', 'Nimbus', 'Onyx', 'Pixel', 'Quill', 'Raven', 'Sable', 'Tidal', 'Umber', 'Vex', 'Wisp', 'Yarrow', 'Zephyr', 'Argo', 'Birch', 'Cobalt', 'Dune', 'Ember', 'Fjord', 'Gale', 'Hawk', 'Iris', 'Jade', 'Kilo', 'Lotus', 'Mako', 'Neon', 'Opal', 'Prism', 'Quartz', 'Ridge', 'Sprout'];
  function genVirtual(state, rng, o) {
    var w = state.world, id;
    do { id = 'v' + (w.nextVid++); } while (w.npcs[id]);
    var age = o.age, ovr = o.ovr;
    var pot = R.clamp(Math.round(ovr + Math.max(0, 25 - age) * 7 + rng.range(10, 50)), ovr + 10, 480);
    var n = {
      id: id, name: rng.pick(NICKS) + (rng.chance(40) ? rng.range(1, 99) : ''), pos: o.pos, team: null, tier: o.tier || 'cl',
      stats: randStats(rng, ovr, 20), potential: pot, hidden: R.rollHidden(rng), traits: [], birth: w.year - age,
      cEnd: w.year + rng.range(0, 2), lg: o.lg || 'LCK', virt: true
    };
    w.npcs[id] = n;
    return n;
  }
  // 포텐셜 행 → 현재 능력치 (db/README 읽기 규칙 3: 나이에 맞게 포텐셜보다 충분히 낮게)
  function npcFromPot(state, rng, pot, tier, lg) {
    var w = state.world, age = w.year - pot.birth;
    var ovr = R.clamp(pot.potential - 40 - Math.max(0, 24 - age) * 9, 250, 440);
    var st = randStats(rng, ovr, 25);
    R.STATS.forEach(function (k) { st[k] = Math.min(st[k], pot.potential); });
    var n = { id: pot.id, name: pot.name, pos: pot.pos, team: null, tier: tier, stats: st, potential: pot.potential, hidden: pot.hidden, traits: pot.traits.slice(), birth: pot.birth, cEnd: w.year + rng.range(0, 2), lg: lg };
    w.npcs[n.id] = n;
    return n;
  }

  // ---------- 월드 생성 ----------
  L.buildWorld = function (state, db, year, rng) {
    var w = state.world = { year: year, teams: {}, leagues: {}, cl: {}, npcs: {}, prospects: [], fa: [], nextVid: 1, st: {}, stoveDone: {}, history: [], results: {} };
    var used = {};
    R.LEAGUES.forEach(function (lg) {
      var rows = (db.yearRows[year] || {})[lg] || [], byTeam = {}, order = [];
      rows.forEach(function (r) { if (!byTeam[r.team]) { byTeam[r.team] = []; order.push(r.team); } byTeam[r.team].push(r); });
      w.leagues[lg] = []; w.cl[lg] = [];
      order.forEach(function (tn) {
        var t = { id: lg + ':' + tn, name: tn, league: lg, tier: 'pro', players: [], academy: [] };
        w.teams[t.id] = t; w.leagues[lg].push(t.id);
        byTeam[tn].forEach(function (r) {
          var pot = db.pot[r.id], n;
          if (pot) {
            n = { id: r.id, name: pot.name, pos: r.pos, team: t.id, tier: 'pro', stats: r.stats, potential: Math.max(pot.potential, ovrOf(r.stats)), hidden: pot.hidden, traits: pot.traits.slice(), birth: pot.birth, cEnd: year + rng.range(0, 2), lg: lg };
          } else {
            n = { id: r.id, name: r.id, pos: r.pos, team: t.id, tier: 'pro', stats: r.stats, potential: Math.min(490, ovrOf(r.stats) + 20), hidden: R.rollHidden(rng), traits: [], birth: year - 24, cEnd: year + rng.range(0, 2), lg: lg };
          }
          w.npcs[n.id] = n; used[n.id] = 1; t.players.push(n.id);
        });
      });
    });
    // 미래 신인·2군 후보 (엔진이 날짜·나이로 등장시킨다)
    var cand = {};
    Object.keys(db.pot).forEach(function (id) {
      var p = db.pot[id]; if (used[id]) return;
      var age = year - p.birth;
      if (age < 12 || age > 24) return;
      (cand[p.lg] = cand[p.lg] || []).push(p);
    });
    R.LEAGUES.forEach(function (lg) {
      var pool = cand[lg] || [];
      w.leagues[lg].forEach(function (tid) {
        var pt = w.teams[tid];
        var ct = { id: tid + ':CL', name: pt.name + ' 2군', league: lg, tier: 'cl', org: tid, players: [] };
        w.teams[ct.id] = ct; w.cl[lg].push(ct.id); pt.cl = ct.id;
      });
      // 2군: 포지션마다 한 명 이상
      w.cl[lg].forEach(function (cid) {
        var ct = w.teams[cid];
        POS.forEach(function (pos) {
          var opts = pool.filter(function (p) { return p.pos === pos && year - p.birth >= R.MIN_AGE; });
          var p = opts.length ? rng.weighted(opts, function (x) { return x.potential; }) : null;
          addTo(state, ct, p ? npcFromPot(state, rng, p, 'cl', lg) : genVirtual(state, rng, { pos: pos, age: rng.range(17, 21), ovr: rng.range(320, 380), lg: lg }));
          if (p) pool.splice(pool.indexOf(p), 1);
        });
        var ex = pool.filter(function (p) { return year - p.birth >= R.MIN_AGE; });
        if (ex.length) { var q = rng.pick(ex); addTo(state, ct, npcFromPot(state, rng, q, 'cl', lg)); pool.splice(pool.indexOf(q), 1); }
      });
      pool.forEach(function (p) { w.prospects.push(p.id); });
    });
    R.LEAGUES.forEach(function (lg) { w.leagues[lg].forEach(function (tid) { fillVacancies(state, rng, w.teams[tid]); }); });
    // 아직 풀에 없는 신인 포텐셜 행은 id만 두고 등장 시 npcFromPot로 만든다
    return w;
  };

  function addTo(state, team, n) { n.team = team.id; n.tier = team.tier; team.players.push(n.id); return n; }
  function removeFrom(state, team, id) { var i = team.players.indexOf(id); if (i >= 0) team.players.splice(i, 1); }

  // 포지션마다 최소 1명 (1군은 2군 최고 → FA → 가상)
  function fillVacancies(state, rng, team) {
    var w = state.world;
    POS.forEach(function (pos) {
      var has = team.players.some(function (id) { return id !== 'PLAYER' && w.npcs[id].pos === pos; });
      var hasP = team.players.indexOf('PLAYER') >= 0 && state.p.pos === pos;
      if (has || hasP) return;
      if (team.tier === 'pro' && team.cl) {
        var cl = w.teams[team.cl], best = null;
        cl.players.forEach(function (id) { if (id === 'PLAYER') return; var n = w.npcs[id]; if (n.pos === pos && (!best || ovrOf(n.stats) > ovrOf(best.stats))) best = n; });
        if (best && w.year - best.birth >= R.MIN_AGE) { removeFrom(state, cl, best.id); addTo(state, team, best); return; }
      }
      var fas = w.fa.map(function (id) { return w.npcs[id]; }).filter(function (n) { return n && n.pos === pos; });
      if (fas.length) {
        fas.sort(function (a, b) { return ovrOf(b.stats) - ovrOf(a.stats); });
        w.fa.splice(w.fa.indexOf(fas[0].id), 1); addTo(state, team, fas[0]); fas[0].cEnd = w.year + rng.range(0, 2); return;
      }
      var base = team.tier === 'pro' ? rng.range(395, 425) : rng.range(320, 380);
      addTo(state, team, genVirtual(state, rng, { pos: pos, age: rng.range(18, 23), ovr: base, tier: team.tier, lg: team.league }));
    });
  }

  // ---------- 로스터·전력 ----------
  function refNpc(n) { return { id: n.id, name: n.name, pos: n.pos, stats: n.stats, hidden: n.hidden, traits: n.traits, npc: true }; }
  function refPlayer(state) { var p = state.p; return { id: 'PLAYER', name: p.nick, pos: p.pos, stats: p.stats, hidden: p.hidden, traits: p.traits, isPlayer: true }; }
  L.ref = function (state, id) { return id === 'PLAYER' ? refPlayer(state) : refNpc(state.world.npcs[id]); };
  L.starters = function (state, teamId, forcePlayer) {
    var w = state.world, t = w.teams[teamId], out = {};
    if (!t) return out;
    POS.forEach(function (pos) {
      var best = null;
      t.players.forEach(function (id) {
        if (id === 'PLAYER') return;
        var n = w.npcs[id]; if (!n || n.pos !== pos) return;
        if (!best || ovrOf(n.stats) > ovrOf(best.stats)) best = n;
      });
      out[pos] = best ? refNpc(best) : null;
    });
    var pl = t.players.indexOf('PLAYER') >= 0;
    if (pl) {
      var role = state.career.contract && state.career.contract.role;
      var hurt = state.p.status && state.p.status.injury > 0;
      if ((role === 'starter' && !hurt) || forcePlayer) out[state.p.pos] = refPlayer(state);
    }
    return out;
  };
  L.power = function (state, teamId) {
    var s = L.starters(state, teamId), tot = 0, n = 0;
    POS.forEach(function (p) { if (s[p]) { tot += ovrOf(s[p].stats); n++; } });
    return n ? tot / n : 380;
  };
  L.teamName = function (state, id) { var t = state.world.teams[id]; return t ? t.name : '-'; };

  // ---------- 달력 (schedule.json) ----------
  var calCache = {};
  function shiftY(d, y) { return d ? y + d.slice(4) : null; }
  function nearYears(year) {
    var out = [], dataY = Math.min(2026, Math.max(2013, year));
    for (var k = 0; k <= 13; k++) { [dataY - k, dataY + k].forEach(function (y) { if (y >= 2013 && y <= 2026 && out.indexOf(y) < 0) out.push(y); }); }
    return out;
  }
  function defaultTours(year) {
    return [
      { name: 'Spring', start: year + '-01-01', end: year + '-03-31', po_start: year + '-04-01', po_end: year + '-04-28', rr: 2, bo: 3, po_teams: null, po_bo: 5, po_bo_r1: null, draft: '일반', def: true },
      { name: 'Summer', start: year + '-06-01', end: year + '-08-20', po_start: year + '-08-21', po_end: year + '-09-17', rr: 2, bo: 3, po_teams: null, po_bo: 5, po_bo_r1: null, draft: '일반', def: true }
    ];
  }
  function leagueTours(db, lg, year) {
    var sch = db.schedule.years, ys = nearYears(year), base = null, src = 'default', by = null, i;
    for (i = 0; i < ys.length; i++) {
      var d = sch[ys[i]] && sch[ys[i]].leagues[lg];
      if (d && d.tournaments.length) { base = d.tournaments; by = ys[i]; src = (ys[i] === year ? 'data' : 'adjacent'); break; }
    }
    if (!base) return { src: 'default', tours: defaultTours(year) };
    var tours = base.map(function (t, idx) {
      var o = { name: t.name, start: shiftY(t.start, year), end: shiftY(t.end, year), po_start: shiftY(t.po_start, year), po_end: shiftY(t.po_end, year),
        rr: t.rr, bo: t.bo, po_teams: t.po_teams, po_bo: t.po_bo, po_bo_r1: t.po_bo_r1, draft: t.draft, idx: idx };
      // null 필드는 인접 연도의 같은 순서 대회에서
      ['rr', 'bo', 'po_teams', 'po_bo', 'draft'].forEach(function (f) {
        if (o[f] !== null && o[f] !== undefined) return;
        for (var j = 0; j < ys.length; j++) {
          var dd = sch[ys[j]] && sch[ys[j]].leagues[lg];
          var tt = dd && dd.tournaments[idx];
          if (tt && tt[f] !== null && tt[f] !== undefined) { o[f] = tt[f]; return; }
        }
      });
      if (!o.po_start) {
        var off = 3, dur = 20;
        for (var j = 0; j < ys.length; j++) {
          var dd = sch[ys[j]] && sch[ys[j]].leagues[lg], tt = dd && dd.tournaments[idx];
          if (tt && tt.po_start && tt.end) { off = S.diffDays(tt.end, tt.po_start); dur = S.diffDays(tt.po_start, tt.po_end); break; }
        }
        o.po_start = S.addDays(o.end, Math.max(1, off)); o.po_end = S.addDays(o.po_start, Math.max(6, dur));
      }
      return o;
    });
    tours.sort(function (a, b) { return a.start < b.start ? -1 : 1; });
    tours.forEach(function (t, i) {
      var nx = tours[i + 1];
      if (nx && t.po_end >= nx.start) t.po_end = S.addDays(nx.start, -1);
      if (t.po_end < t.po_start) t.po_end = S.addDays(t.po_start, 6);
    });
    return { src: src, tours: tours };
  }
  function intlEvent(db, key, year) {
    var sch = db.schedule.years, ys = nearYears(year), e = sch[Math.min(2026, year)] && sch[Math.min(2026, year)].intl && sch[Math.min(2026, year)].intl[key];
    var exact = year >= 2013 && year <= 2026;
    if (exact && e && e.held === false) return null;       // 그해 열리지 않음(MSI 2013·2014·2020)
    if (!e || !e.start) {
      // 대회 데이터에 날짜가 없으면 인접 연도의 날짜, 그다음 기본 틀
      for (var i = 0; i < ys.length; i++) { var o = sch[ys[i]] && sch[ys[i]].intl && sch[ys[i]].intl[key]; if (o && o.held && o.start) { e = o; break; } }
    }
    if (!e || !e.start) {
      if (key === 'msi') return year >= 2015 ? { start: year + '-05-01', end: year + '-05-28', slots: null, def: true } : null;
      return { start: year + '-10-07', end: year + '-11-10', slots: null, def: true };
    }
    return { start: shiftY(e.start, year), end: shiftY(e.end, year), slots: e.slots, def: false };
  }
  L.calendar = function (year) {
    if (calCache[year]) return calCache[year];
    var db = LP.data.db, cal = { year: year, leagues: {}, src: {} };
    R.LEAGUES.forEach(function (lg) {
      var r = leagueTours(db, lg, year); cal.src[lg] = r.src;
      var segs = [];
      r.tours.forEach(function (t, i) {
        var base = lg + ':' + (t.idx === undefined ? i : t.idx);
        segs.push({ key: base + ':reg', kind: 'reg', league: lg, name: t.name, start: t.start, end: t.end, rr: t.rr || 2, bo: t.bo || 3, draft: t.draft === '피어리스' });
        segs.push({ key: base + ':po', kind: 'po', league: lg, name: t.name + ' 플레이오프', start: t.po_start, end: t.po_end, n: t.po_teams, bo: t.po_bo || 5, boR1: t.po_bo_r1, draft: t.draft === '피어리스', regKey: base + ':reg', splitName: t.name });
      });
      cal.leagues[lg] = segs;
    });
    var msi = intlEvent(db, 'msi', year), wd = intlEvent(db, 'worlds', year);
    cal.msi = msi ? { key: 'MSI', kind: 'msi', name: 'MSI', start: msi.start, end: msi.end, slots: msi.slots, bo: 5 } : null;
    cal.worlds = { key: 'WORLDS', kind: 'worlds', name: '월드 챔피언십', start: wd.start, end: wd.end, slots: wd.slots || { LCK: 4, LPL: 4, LEC: 3, LCS: 3 }, bo: 5 };
    cal.stoveStart = S.addDays(cal.worlds.end, 1);
    if (cal.stoveStart < year + '-11-01') cal.stoveStart = year + '-11-01';
    calCache[year] = cal;
    return cal;
  };
  function overlaps(seg, d0, d1) { return seg.start <= d1 && seg.end >= d0; }
  L.phaseLabel = function (state) {
    var cal = L.calendar(+state.date.slice(0, 4)), d0 = state.date, d1 = S.addDays(d0, 6), lg = state.career.league || 'LCK', out = [];
    (cal.leagues[lg] || []).forEach(function (s) { if (overlaps(s, d0, d1)) out.push(lg + ' ' + s.name); });
    if (cal.msi && overlaps(cal.msi, d0, d1)) out.push('MSI');
    if (overlaps(cal.worlds, d0, d1)) out.push('월즈');
    if (d0 >= cal.stoveStart) out.push('스토브리그');
    return out.length ? out.join(' · ') : '오프 시즌';
  };

  // ---------- 세그먼트 상태 ----------
  function stKey(seg, tier) { return seg.key + (tier === 'cl' ? ':CL' : ''); }
  function teamIdsOf(state, lg, tier) { return (tier === 'cl' ? state.world.cl[lg] : state.world.leagues[lg]).slice(); }
  function roundRobin(ids) {
    var t = ids.slice(); if (t.length % 2) t.push(null);
    var n = t.length, rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var m = [];
      for (var i = 0; i < n / 2; i++) { var a = t[i], b = t[n - 1 - i]; if (a && b) m.push(r % 2 ? [b, a] : [a, b]); }
      rounds.push(m);
      t.splice(1, 0, t.pop());
    }
    return rounds;
  }
  function getReg(state, seg, tier) {
    var k = stKey(seg, tier), st = state.world.st[k];
    if (st) return st;
    var ids = teamIdsOf(state, seg.league, tier), rr = roundRobin(ids), stand = {};
    ids.forEach(function (id) { stand[id] = { w: 0, d: 0, l: 0, gw: 0, gl: 0, pts: 0 }; });
    st = state.world.st[k] = { kind: 'reg', rounds: rr, rr: seg.rr, total: rr.length * seg.rr, played: 0, stand: stand, done: false, pending: 0, bo: seg.bo };
    return st;
  }
  function rank(st, rng) {
    return Object.keys(st.stand).sort(function (a, b) {
      var x = st.stand[a], y = st.stand[b];
      return (y.pts - x.pts) || ((y.gw - y.gl) - (x.gw - x.gl)) || (y.gw - x.gw) || (a < b ? -1 : 1);
    });
  }
  L.rank = rank;
  function bracketOrder(P) { var cur = [1], size = 1; while (size < P) { size *= 2; var nx = []; cur.forEach(function (x) { nx.push(x, size + 1 - x); }); cur = nx; } return cur; }
  function mkBracket(seeds, bo, boR1, meta) {
    var n = seeds.length, P = 1; while (P < n) P *= 2;
    var order = bracketOrder(P), ms = [];
    for (var i = 0; i < P / 2; i++) {
      var a = seeds[order[2 * i] - 1] || null, b = seeds[order[2 * i + 1] - 1] || null;
      ms.push({ a: a, b: b, w: null, sa: 0, sb: 0 });
    }
    var br = { kind: 'br', seeds: seeds.slice(), P: P, nRounds: Math.log2(P), rounds: [{ matches: ms, bo: boR1 || bo }], cur: 0, done: false, champion: null, place: [], elim: [], bo: bo, boR1: boR1, meta: meta || {}, pending: false };
    settleByes(br); advanceBracket(br);
    return br;
  }
  function settleByes(br) {
    br.rounds[br.cur].matches.forEach(function (m) {
      if (m.w === null && (!m.a || !m.b)) { m.w = m.a || m.b; m.bye = true; }
    });
  }
  // 현재 라운드가 모두 끝났으면 다음 라운드를 만든다. 우승이 정해지면 true.
  function advanceBracket(br) {
    while (!br.done) {
      var rd = br.rounds[br.cur];
      if (rd.matches.some(function (m) { return m.w === null; })) return;
      var losers = [], winners = [];
      rd.matches.forEach(function (m) { winners.push(m.w); if (!m.bye) losers.push(m.w === m.a ? m.b : m.a); });
      br.elim.push(losers);
      if (winners.length === 1) {
        br.done = true; br.champion = winners[0];
        br.place = [winners[0]];
        for (var r = br.elim.length - 1; r >= 0; r--) {
          br.elim[r].slice().sort(function (x, y) { return br.seeds.indexOf(x) - br.seeds.indexOf(y); }).forEach(function (id) { br.place.push(id); });
        }
        return;
      }
      var ms = [];
      for (var i = 0; i < winners.length; i += 2) ms.push({ a: winners[i], b: winners[i + 1], w: null, sa: 0, sb: 0 });
      br.cur++;
      br.rounds.push({ matches: ms, bo: br.bo });
      settleByes(br);
    }
  }
  L.advanceBracket = advanceBracket;

  function regDone(state, seg, tier) {
    var st = getReg(state, seg, tier);
    return st.done;
  }
  function simRegRest(state, seg, tier) {
    var st = getReg(state, seg, tier), rng = S.rng(state);
    while (st.played < st.total) {
      var rd = st.rounds[st.played % st.rounds.length];
      rd.forEach(function (m) { var r = quickSeries(state, rng, m[0], m[1], seg.bo); applyReg(st, m[0], m[1], r); });
      st.played++;
    }
    st.done = true; st.pending = 0;
  }
  function getPo(state, seg, tier) {
    var k = stKey(seg, tier), st = state.world.st[k];
    if (st) return st;
    var cal = L.calendar(+seg.start.slice(0, 4));
    var regSeg = cal.leagues[seg.league].filter(function (s) { return s.key === seg.regKey; })[0];
    if (!getReg(state, regSeg, tier).done) simRegRest(state, regSeg, tier);
    var rst = getReg(state, regSeg, tier), order = rank(rst);
    var n = Math.min(seg.n || 6, order.length);
    n = Math.max(2, n);
    st = state.world.st[k] = mkBracket(order.slice(0, n), seg.bo, seg.boR1, { league: seg.league, tier: tier, name: seg.name, seg: seg.key, stk: k, year: seg.start.slice(0, 4), fearless: seg.draft });
    st.regOrder = order;
    return st;
  }
  function powerRank(state, ids) { return ids.slice().sort(function (a, b) { return L.power(state, b) - L.power(state, a); }); }
  // 해당 리그의 beforeDate 이전에 끝난 가장 최근 플레이오프 순위
  function placements(state, lg, beforeDate, year) {
    var cal = L.calendar(year), pos = cal.leagues[lg].filter(function (s) { return s.kind === 'po' && s.end < beforeDate; });
    var seg = pos[pos.length - 1];
    if (!seg) return powerRank(state, state.world.leagues[lg]);
    var st = getPo(state, seg, 'pro');
    forceFinishBracket(state, st, seg.bo);
    var place = st.place.slice();
    st.regOrder.forEach(function (id) { if (place.indexOf(id) < 0) place.push(id); });
    return place;
  }
  function forceFinishBracket(state, st) {
    var rng = S.rng(state), guard = 0;
    while (!st.done && guard++ < 10) {
      var rd = st.rounds[st.cur];
      rd.matches.forEach(function (m) {
        if (m.w !== null) return;
        var r = quickSeries(state, rng, m.a, m.b, rd.bo); m.w = r.winner; m.sa = r.sa; m.sb = r.sb;
      });
      advanceBracket(st);
    }
    if (st.done && !st.recorded) recordBracketDone(state, st, true);
  }
  function getIntl(state, cs, year) {
    var k = cs.key + ':' + year, st = state.world.st[k];
    if (st) return st;
    var cal = L.calendar(year), seeds = [], slotsBy = {};
    R.LEAGUES.forEach(function (lg) {
      var n = cs.slots && cs.slots[lg] !== undefined ? cs.slots[lg] : (cs.kind === 'msi' ? 1 : (lg === 'LCK' || lg === 'LPL' ? 4 : 3));
      slotsBy[lg] = Math.max(0, Math.min(n, state.world.leagues[lg].length));
    });
    var pl = {};
    R.LEAGUES.forEach(function (lg) { pl[lg] = slotsBy[lg] ? placements(state, lg, cs.start, year) : []; });
    var strength = R.LEAGUES.slice().sort(function (a, b) {
      var pa = 0, pb = 0; state.world.leagues[a].forEach(function (t) { pa += L.power(state, t); }); state.world.leagues[b].forEach(function (t) { pb += L.power(state, t); });
      return pb / state.world.leagues[b].length - pa / state.world.leagues[a].length;
    });
    for (var r = 0; r < 4; r++) strength.forEach(function (lg) { if (r < slotsBy[lg] && pl[lg][r]) seeds.push(pl[lg][r]); });
    st = state.world.st[k] = mkBracket(seeds, cs.bo, null, { league: null, tier: 'pro', name: cs.name + ' ' + year, intl: cs.kind, stk: k, year: year });
    return st;
  }

  function applyReg(st, a, b, r) {
    var A = st.stand[a], B = st.stand[b];
    if (!A || !B) return;
    A.gw += r.sa; A.gl += r.sb; B.gw += r.sb; B.gl += r.sa;
    if (r.winner === a) { A.w++; B.l++; A.pts += 3; } else if (r.winner === b) { B.w++; A.l++; B.pts += 3; } else { A.d++; B.d++; A.pts++; B.pts++; }
  }

  // ---------- NPC 경기 ----------
  function quickSeries(state, rng, a, b, bo) {
    var pa = L.power(state, a) + rng.gauss(0, 6), pb = L.power(state, b) + rng.gauss(0, 6);
    var p = R.clamp(50 + (pa - pb) * 0.6, 5, 95), sa = 0, sb = 0;
    if (bo === 2) {
      sa = rng.chance(p) ? 1 : 0; sb = rng.chance(100 - p) ? 1 : 0;
      if (sa + sb === 2) { sa = sb = 1; } else if (sa + sb === 0) { if (rng.chance(p)) sa = 1; else sb = 1; sa = sa ? 1 : 0; sb = sb ? 1 : 0; }
      var w2 = sa > sb ? a : sb > sa ? b : null;
      if (w2) { return { winner: w2, sa: w2 === a ? 2 : 0, sb: w2 === b ? 2 : 0 }; }
      return { winner: null, sa: 1, sb: 1 };
    }
    var need = Math.floor(bo / 2) + 1;
    while (sa < need && sb < need) { if (rng.chance(p)) sa++; else sb++; }
    return { winner: sa > sb ? a : b, sa: sa, sb: sb };
  }
  L.quickSeries = function (state, a, b, bo) { return quickSeries(state, S.rng(state), a, b, bo); };

  // ---------- 주간 계획 ----------
  L.planWave = function (state, wave) {
    var date = state.date, end = S.addDays(date, 6), year = +date.slice(0, 4), cal = L.calendar(year);
    var series = [], more = false;
    // 달력 연도 경계: 12월 말 주는 같은 해 달력만 본다
    var tiers = ['pro'];
    if (state.career.stage === 'cl' && state.career.league) tiers.push('cl');
    tiers.forEach(function (tier) {
      R.LEAGUES.forEach(function (lg) {
        if (tier === 'cl' && lg !== state.career.league) return;
        cal.leagues[lg].forEach(function (seg) {
          if (!overlaps(seg, date, end)) return;
          var weeksLeft = Math.floor(S.diffDays(date, seg.end) / 7) + 1;
          if (seg.kind === 'reg') {
            if (wave > 0) return;
            var st = getReg(state, seg, tier);
            if (st.done) return;
            var rem = st.total - st.played, per = Math.min(rem, Math.ceil(rem / Math.max(1, weeksLeft)));
            st.pending = per;
            for (var i = 0; i < per; i++) {
              var rd = st.rounds[(st.played + i) % st.rounds.length];
              rd.forEach(function (m, mi) { series.push({ key: stKey(seg, tier), seg: seg.key, kind: 'reg', league: lg, tier: tier, a: m[0], b: m[1], bo: seg.bo, name: seg.splitName || seg.name, fearless: seg.draft, id: stKey(seg, tier) + ':' + (st.played + i) + ':' + mi }); });
            }
          } else {
            var br = getPo(state, seg, tier);
            if (br.done) return;
            var roundsLeft = br.nRounds - br.cur, need = Math.ceil(roundsLeft / Math.max(1, weeksLeft));
            if (wave >= need) return;
            if (wave + 1 < need) more = true;
            pushBracket(series, br, stKey(seg, tier), 'po', lg, tier, seg.name, seg.draft);
          }
        });
      });
    });
    [cal.msi, cal.worlds].forEach(function (cs) {
      if (!cs || !overlaps(cs, date, end)) return;
      var br = getIntl(state, cs, year);
      if (br.done) return;
      var weeksLeft = Math.floor(S.diffDays(date, cs.end) / 7) + 1, roundsLeft = br.nRounds - br.cur, need = Math.ceil(roundsLeft / Math.max(1, weeksLeft));
      if (wave >= need) return;
      if (wave + 1 < need) more = true;
      pushBracket(series, br, cs.key + ':' + year, cs.kind, null, 'pro', cs.name, false);
    });
    return { series: series, more: more };
  };
  function pushBracket(series, br, key, kind, lg, tier, name, fearless) {
    var rd = br.rounds[br.cur];
    rd.matches.forEach(function (m, mi) {
      if (m.w !== null) return;
      series.push({ key: key, kind: kind, league: lg, tier: tier, a: m.a, b: m.b, bo: rd.bo, round: br.cur, nRounds: br.nRounds, mi: mi, final: br.cur === br.nRounds - 1, name: name, fearless: fearless, id: key + ':' + br.cur + ':' + mi });
    });
  }
  L.applyResult = function (state, s, res) {
    s.res = { winner: res.winner, sa: res.sa, sb: res.sb };
    var st = state.world.st[s.key];
    if (s.kind === 'reg') applyReg(st, s.a, s.b, res);
    else { var m = st.rounds[s.round].matches[s.mi]; m.w = res.winner; m.sa = res.sa; m.sb = res.sb; }
  };
  L.simRest = function (state, plan) {
    var rng = S.rng(state);
    plan.series.forEach(function (s) {
      if (s.res) return;
      var r = quickSeries(state, rng, s.a, s.b, s.bo);
      L.applyResult(state, s, r);
    });
  };
  // 한 웨이브가 끝난 뒤 정리. 우승이 정해진 브래킷은 기록한다.
  L.endWave = function (state, plan) {
    var w = state.world;
    Object.keys(w.st).forEach(function (k) {
      var st = w.st[k];
      if (st.kind === 'reg' && st.pending) {
        st.played += st.pending; st.pending = 0;
        if (st.played >= st.total) st.done = true;
      } else if (st.kind === 'br' && !st.done) {
        advanceBracket(st);
        if (st.done && !st.recorded) recordBracketDone(state, st, false);
      }
    });
  };
  function recordBracketDone(state, st, silent) {
    st.recorded = true;
    var w = state.world, m = st.meta, champ = st.champion, runner = st.place[1];
    w.history.push({ year: m.year, name: m.name, league: m.league, tier: m.tier, champion: champ, runnerUp: runner, intl: m.intl || null });
    var mine = state.career.team;
    var played = (state.record.played || {})[m.stk] || 0;
    if (mine && played > 0 && m.tier === (state.career.stage === 'cl' ? 'cl' : 'pro')) {
      var tn = w.teams[mine] ? w.teams[mine].name : '';
      if (champ === mine) {
        var title = m.intl ? m.name + ' 우승' : m.year + ' ' + (m.name.indexOf(m.league) === 0 ? '' : m.league + ' ') + m.name + ' 우승';
        state.record.titles.push(title);
        if (m.intl) state.record.intlTitles++; else state.record.leagueTitles++;
        state.fame = R.clamp(state.fame + (m.intl ? 15 : 6), 0, 100);
        state.record.titleSeen = true;
      } else if (runner === mine) {
        state.record.finalsLost++;
        state.record.awards.push(m.year + ' ' + m.name + ' 준우승');
        state.fame = R.clamp(state.fame + 2, 0, 100);
      }
    }
    if (silent) return;
    var interesting = m.intl || m.league === state.career.league;
    if (interesting && (m.tier === 'pro' || state.career.stage === 'cl')) {
      var txt = (m.intl ? '' : m.league + ' ') + m.name + ' 우승은 ' + L.teamName(state, champ) + (runner ? ', 준우승은 ' + L.teamName(state, runner) : '') + '.';
      S.addFeed(state, 'league', { name: m.name, champion: L.teamName(state, champ), runnerUp: runner ? L.teamName(state, runner) : null, mine: champ === mine }, txt);
    }
  }
  L.currentTable = function (state) {
    var lg = state.career.league || 'LCK', tier = state.career.stage === 'cl' ? 'cl' : 'pro', best = null, bestKey = null;
    var yr = +state.date.slice(0, 4), cal = L.calendar(yr), segs = cal.leagues[lg].filter(function (s) { return s.kind === 'reg'; });
    for (var i = 0; i < segs.length; i++) {
      if (segs[i].start <= state.date || !best) { var st = state.world.st[stKey(segs[i], tier)]; if (st) { best = st; bestKey = segs[i]; } }
    }
    if (!best) return null;
    return { name: lg + ' ' + bestKey.name, rows: rank(best).map(function (id) { var x = best.stand[id]; return { id: id, name: L.teamName(state, id), w: x.w, l: x.l, d: x.d, gd: x.gw - x.gl }; }) };
  };

  // ---------- 화면용 조회 (상태를 바꾸지 않는다) ----------
  // 순위표: 리그·티어의 그해 정규 대회마다 {key, name, status, rows}
  L.tables = function (state, lg, tier) {
    var year = +state.date.slice(0, 4), cal = L.calendar(year), out = [];
    (cal.leagues[lg] || []).forEach(function (seg) {
      if (seg.kind !== 'reg') return;
      var st = state.world.st[stKey(seg, tier)];
      out.push({ key: seg.key, name: seg.splitName || seg.name, started: seg.start <= state.date, start: seg.start, end: seg.end, status: st ? (st.done ? '종료' : '진행 중') : (seg.start <= state.date ? '진행 전' : '예정'),
        rows: st ? rank(st).map(function (id) { var x = st.stand[id]; return { id: id, name: L.teamName(state, id), w: x.w, l: x.l, d: x.d, gd: x.gw - x.gl }; }) : null });
    });
    return out;
  };
  // 그해 플레이오프·국제대회 결과
  L.yearHistory = function (state) {
    var yr = String(+state.date.slice(0, 4));
    return state.world.history.filter(function (h) { return String(h.year) === yr; }).map(function (h) {
      return { name: (h.intl ? '' : h.league + ' ') + h.name, tier: h.tier, champion: L.teamName(state, h.champion), runnerUp: h.runnerUp ? L.teamName(state, h.runnerUp) : '-' };
    });
  };
  // 앞으로의 일정: 내 팀의 남은 정규 시리즈(상대 포함)와 플레이오프·국제대회·스토브 기간
  L.upcoming = function (state) {
    var c = state.career, year = +state.date.slice(0, 4), cal = L.calendar(year), lg = c.league || 'LCK', out = [];
    var tier = c.stage === 'cl' ? 'cl' : 'pro', team = (c.stage === 'cl' || c.stage === 'pro') ? c.team : null;
    (cal.leagues[lg] || []).forEach(function (seg) {
      if (seg.end < state.date) return;
      if (seg.kind === 'reg') {
        if (!team) { out.push({ date: seg.start > state.date ? seg.start : state.date, end: seg.end, name: seg.splitName || seg.name, kind: 'period', league: lg }); return; }
        var st = state.world.st[stKey(seg, tier)], rounds, played, total;
        if (st) { rounds = st.rounds; played = st.played; total = st.total; if (st.done) return; }
        else { rounds = roundRobin(teamIdsOf(state, lg, tier)); played = 0; total = rounds.length * (seg.rr || 2); }
        var ws = state.date;
        for (var k = 0; k < 40 && ws <= seg.end && played < total; k++, ws = S.addDays(ws, 7)) {
          if (!overlaps(seg, ws, S.addDays(ws, 6))) continue;
          var weeksLeft = Math.floor(S.diffDays(ws, seg.end) / 7) + 1, rem = total - played, per = Math.min(rem, Math.ceil(rem / Math.max(1, weeksLeft)));
          for (var i = 0; i < per; i++) {
            var rd = rounds[(played + i) % rounds.length];
            rd.forEach(function (m) {
              if (m[0] !== team && m[1] !== team) return;
              var oppId = m[0] === team ? m[1] : m[0];
              out.push({ date: ws, name: seg.splitName || seg.name, kind: 'match', opp: L.teamName(state, oppId), bo: seg.bo, league: lg, fearless: seg.draft });
            });
          }
          played += per;
        }
      } else {
        var br = state.world.st[stKey(seg, tier)];
        if (br && br.done) return;
        var note = team ? '진출 시' : '', opp = null;
        if (br && team) {
          if (br.seeds.indexOf(team) < 0) note = '미진출';
          else if (br.elim.some(function (r) { return r.indexOf(team) >= 0; })) note = '탈락';
          else {
            var cm = br.rounds[br.cur].matches.filter(function (m) { return m.w === null && (m.a === team || m.b === team); })[0];
            if (cm) { opp = L.teamName(state, cm.a === team ? cm.b : cm.a); note = (br.cur === br.nRounds - 1 ? '결승' : (br.cur + 1) + '라운드') + ' Bo' + br.rounds[br.cur].bo; }
            else note = '다음 라운드 대기';
          }
        }
        out.push({ date: seg.start > state.date ? seg.start : state.date, end: seg.end, name: seg.name, kind: opp ? 'match' : 'period', opp: opp || undefined, bo: opp ? br.rounds[br.cur].bo : undefined, league: lg, note: note, fearless: seg.draft });
      }
    });
    [cal.msi, cal.worlds].forEach(function (cs) {
      if (!cs || cs.end < state.date) return;
      out.push({ date: cs.start > state.date ? cs.start : state.date, end: cs.end, name: cs.name, kind: 'period', league: null, note: team ? '진출 시' : '' });
    });
    if (cal.stoveStart >= state.date) out.push({ date: cal.stoveStart, end: year + '-12-31', name: '스토브리그', kind: 'period', league: null });
    out.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.kind === 'match' ? -1 : 1); });
    return out;
  };

  // ---------- 선수 변화 도우미 (NPC 에이징·성장) ----------
  function npcAge(state, n) { return state.world.year - n.birth; }
  function ageNpc(state, rng, n, age) {
    var row = R.agingRow(age);
    if (!row) return;
    var fx = R.fxOf(n.traits);
    R.STATS.forEach(function (k) {
      var p = row.p + (R.AGING_STAT_ADJ[k] || 0) + (R.AGING_PRO_ADJ[n.hidden.pro] || 0) + fx.agingProb;
      if (fx.agingHalf) p = p / 2;
      if (rng.int(100) <= p) {
        var d = row.roll(rng); if (fx.agingHalf) d = Math.floor(d / 2);
        n.stats[k] = R.clamp(n.stats[k] - d, 0, 500);
      }
    });
  }
  function growNpc(state, rng, n, age) {
    if (age >= 25) return;
    var fx = R.fxOf(n.traits), cap = n.potential;
    R.STATS.forEach(function (k) {
      var room = cap - n.stats[k]; if (room <= 0) return;
      var d = age <= 22 ? rng.int(10) : rng.int(6);
      d = Math.round(d * fx.growth * (age >= 21 ? 0.6 : 1));
      n.stats[k] = R.clamp(n.stats[k] + Math.min(room, d), 0, 500);
    });
  }

  // ---------- 스토브리그 (NPC 계약 만료·이적) ----------
  L.stove = function (state) {
    var w = state.world, rng = S.rng(state), year = w.year;
    if (w.stoveDone[year]) return;
    w.stoveDone[year] = true;
    var moves = [];
    R.LEAGUES.forEach(function (lg) {
      w.leagues[lg].forEach(function (tid) {
        var t = w.teams[tid];
        t.players.slice().forEach(function (id) {
          if (id === 'PLAYER') return;
          var n = w.npcs[id];
          if (n.cEnd > year) return;
          if (rng.chance(25)) { removeFrom(state, t, id); n.team = null; n.tier = 'fa'; w.fa.push(id); }
          else n.cEnd = year + rng.range(1, 3);
        });
      });
    });
    // FA 영입: 포지션이 약한 팀부터
    var fas = w.fa.slice().map(function (id) { return w.npcs[id]; }).sort(function (a, b) { return ovrOf(b.stats) - ovrOf(a.stats); });
    fas.forEach(function (n) {
      var cand = [];
      R.LEAGUES.forEach(function (lg) { w.leagues[lg].forEach(function (tid) {
        var t = w.teams[tid], cur = null;
        t.players.forEach(function (id) { if (id === 'PLAYER') return; var x = w.npcs[id]; if (x.pos === n.pos && (!cur || ovrOf(x.stats) > ovrOf(cur.stats))) cur = x; });
        if (!cur || ovrOf(n.stats) > ovrOf(cur.stats) + 3) cand.push(t);
      }); });
      if (cand.length && rng.chance(70)) {
        var t = rng.pick(cand);
        w.fa.splice(w.fa.indexOf(n.id), 1); addTo(state, t, n); n.cEnd = year + rng.range(1, 3);
        moves.push(n.name + ' → ' + t.name);
      }
    });
    R.LEAGUES.forEach(function (lg) { w.leagues[lg].forEach(function (tid) { fillVacancies(state, rng, w.teams[tid]); }); });
    if (moves.length) S.addFeed(state, 'stove', { moves: moves.slice(0, 6) }, '스토브리그: ' + moves.slice(0, 4).join(', ') + (moves.length > 4 ? ' 등' : '') + ' 이적 소식이 전해졌다.');
  };

  // ---------- 연말 갱신 (1월 1일) ----------
  L.newYear = function (state, newYear) {
    var w = state.world, rng = S.rng(state);
    w.year = newYear;
    w.st = {};
    w.mast = {};
    var retired = [];
    Object.keys(w.npcs).forEach(function (id) {
      var n = w.npcs[id], age = npcAge(state, n);
      if (n.tier === 'retired') return;
      ageNpc(state, rng, n, age); growNpc(state, rng, n, age);
      var o = ovrOf(n.stats);
      var chance = age >= 36 ? 100 : (age >= 30 && o < 420) ? 30 + (age - 30) * 12 : (n.tier === 'fa' && age >= 28 ? 60 : 0);
      if (chance && rng.chance(chance)) {
        var t = n.team && w.teams[n.team]; if (t) removeFrom(state, t, id);
        var fi = w.fa.indexOf(id); if (fi >= 0) w.fa.splice(fi, 1);
        n.tier = 'retired'; n.team = null; retired.push(n.name);
      }
    });
    // 신인 등장 (나이 17세 이상이 된 후보)
    var db = LP.data.db, keep = [];
    w.prospects.forEach(function (id) {
      var p = db.pot[id]; if (!p) return;
      var age = newYear - p.birth;
      if (age < R.MIN_AGE) { keep.push(id); return; }
      if (age > 26 || w.npcs[id]) return;
      var cls = w.cl[p.lg].map(function (cid) { return w.teams[cid]; }).filter(function (t) { return t.players.length < 8; });
      if (!cls.length) { keep.push(id); return; }
      cls.sort(function (a, b) { return cnt(w, a, p.pos) - cnt(w, b, p.pos); });
      addTo(state, cls[0], npcFromPot(state, rng, p, 'cl', p.lg));
    });
    w.prospects = keep;
    // 2군 -> 1군 승격, 정리, 빈자리 보충
    R.LEAGUES.forEach(function (lg) {
      w.leagues[lg].forEach(function (tid) {
        var pt = w.teams[tid], ct = w.teams[pt.cl];
        POS.forEach(function (pos) {
          var pros = pt.players.filter(function (id) { return id !== 'PLAYER' && w.npcs[id].pos === pos; }).map(function (id) { return w.npcs[id]; }).sort(function (a, b) { return ovrOf(b.stats) - ovrOf(a.stats); });
          var cls = ct.players.filter(function (id) { return id !== 'PLAYER' && w.npcs[id].pos === pos; }).map(function (id) { return w.npcs[id]; }).sort(function (a, b) { return ovrOf(b.stats) - ovrOf(a.stats); });
          if (cls[0] && pros[0] && ovrOf(cls[0].stats) >= ovrOf(pros[0].stats) - 5 && newYear - cls[0].birth >= R.MIN_AGE) {
            removeFrom(state, ct, cls[0].id); addTo(state, pt, cls[0]);
            if (pros.length >= 2) { var low = pros[pros.length - 1]; if (npcAge(state, low) < 27) { removeFrom(state, pt, low.id); addTo(state, ct, low); } else { removeFrom(state, pt, low.id); low.team = null; low.tier = 'fa'; w.fa.push(low.id); } }
          }
        });
        // 포지션당 2명 초과분 방출
        [pt, ct].forEach(function (t) {
          POS.forEach(function (pos) {
            var arr = t.players.filter(function (id) { return id !== 'PLAYER' && w.npcs[id].pos === pos; }).map(function (id) { return w.npcs[id]; }).sort(function (a, b) { return ovrOf(b.stats) - ovrOf(a.stats); });
            while (arr.length > 2) { var x = arr.pop(); removeFrom(state, t, x.id); x.team = null; x.tier = 'fa'; w.fa.push(x.id); }
          });
        });
        fillVacancies(state, rng, pt);
        fillVacancies(state, rng, ct);
        // 2군 신인(가상) 보충: 포지션별로 어린 선수가 없으면 하나 채운다
      });
    });
    if (w.fa.length > 120) { w.fa.splice(0, w.fa.length - 120).forEach(function (id) { w.npcs[id].tier = 'retired'; }); }
    // 오래 지난 은퇴 선수 정리 (세이브 크기)
    Object.keys(w.npcs).forEach(function (id) { var n = w.npcs[id]; if (n.tier === 'retired' && !n.keep) delete w.npcs[id]; });
    if (retired.length) S.addFeed(state, 'retire', { names: retired.slice(0, 5) }, '시즌 종료. ' + retired.slice(0, 3).join(', ') + (retired.length > 3 ? ' 등' : '') + ' 선수가 은퇴를 발표했다.');
  };
  function cnt(w, team, pos) { return team.players.filter(function (id) { return id !== 'PLAYER' && w.npcs[id].pos === pos; }).length; }

  // ---------- 입단 제안·계약 ----------
  L.offers = function (state, kind, n, checkOnly, transfer) {
    var w = state.world, rng = S.rng(state), p = state.p, ovr = R.ovr(p.stats), year = +state.date.slice(0, 4), out = [], cand = [];
    var stage = kind === 'academy' ? 'academy' : kind;
    R.LEAGUES.forEach(function (lg) { w.leagues[lg].forEach(function (tid) { cand.push(tid); }); });
    rng.shuffle(cand);
    for (var i = 0; i < cand.length && out.length < n; i++) {
      var pt = w.teams[cand[i]];
      if (transfer && state.career.team && (state.career.team === pt.id || state.career.team === pt.cl)) continue;
      if (!transfer && state.career.team === pt.id) continue;
      var team = pt;
      if (stage === 'cl') team = w.teams[pt.cl];
      var cur = null;
      team.players.forEach(function (id) { if (id === 'PLAYER') return; var x = w.npcs[id]; if (x.pos === p.pos && (!cur || ovrOf(x.stats) > ovrOf(cur.stats))) cur = x; });
      var curO = cur ? ovrOf(cur.stats) : 0;
      if (stage === 'pro' && curO > ovr + 12) continue;       // 팀 수요가 있는 곳만
      if (stage === 'cl' && curO > ovr + 40) continue;
      var role = stage === 'academy' ? 'sub' : (ovr >= curO - 5 ? 'starter' : 'sub');
      if (stage === 'pro' && role === 'sub' && !transfer && rng.chance(50)) continue;
      var lgn = pt.league, years = stage === 'academy' ? 1 : rng.range(1, 3);
      var sal = R.rollSalary(rng, lgn, year, ovr, stage === 'pro' ? 'pro' : stage, role, state.fame);
      out.push({ team: team.id, teamName: team.name, league: lgn, stage: stage, role: role, salary: sal, years: years });
    }
    return out;
  };
  L.join = function (state, offer) {
    var w = state.world, c = state.career, p = state.p, date = state.date, year = +date.slice(0, 4), month = +date.slice(5, 7);
    L.leaveTeam(state);
    var endYear = month >= 11 ? year + offer.years : year + offer.years - 1;
    var team = w.teams[offer.team];
    if (offer.stage === 'academy') team.academy.push('PLAYER'); else team.players.push('PLAYER');
    c.stage = offer.stage; c.team = offer.team; c.league = offer.league;
    c.contract = { start: date, end: endYear + '-11-15', salary: offer.salary, role: offer.role };
    c.fa = false;
    p.subWeeks = 0;
    if (offer.stage === 'cl' && !p.adapt.cl) p.adapt.cl = null;
    return offer.teamName + (offer.stage === 'academy' ? ' 연습생' : offer.stage === 'cl' ? ' 2군' : ' 1군') + ' 입단 (' + (offer.role === 'starter' ? '주전' : '후보') + ', 연봉 ' + R.fmtMoney(offer.salary) + ', ' + offer.years + '년)';
  };
  L.leaveTeam = function (state) {
    var c = state.career, w = state.world;
    if (c.team && w.teams[c.team]) {
      var t = w.teams[c.team];
      removeFrom(state, t, 'PLAYER');
      var ai = t.academy ? t.academy.indexOf('PLAYER') : -1; if (ai >= 0) t.academy.splice(ai, 1);
    }
    c.team = null; c.contract = null;
  };
  L.refreshRole = function (state) {
    // 월간 점검: 후보가 주전보다 강해지면 승격, 주전이 크게 밀리면 강등
    var c = state.career, w = state.world;
    if (!c.contract || !c.team || (c.stage !== 'pro' && c.stage !== 'cl')) return null;
    var cur = null, ovr = R.ovr(state.p.stats);
    w.teams[c.team].players.forEach(function (id) { if (id === 'PLAYER') return; var x = w.npcs[id]; if (x.pos === state.p.pos && (!cur || ovrOf(x.stats) > ovrOf(cur.stats))) cur = x; });
    var co = cur ? ovrOf(cur.stats) : 0;
    if (c.contract.role === 'sub' && ovr >= co + 3) { c.contract.role = 'starter'; return 'up'; }
    if (c.contract.role === 'starter' && ovr < co - 15) { c.contract.role = 'sub'; return 'down'; }
    return null;
  };

  LP.league = L;
  L._internal = { quickSeries: quickSeries, mkBracket: mkBracket, genVirtual: genVirtual, ageNpc: ageNpc, getReg: getReg, getPo: getPo };
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
