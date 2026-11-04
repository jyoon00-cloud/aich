/* mastery.js — 챔피언 숙련도·시그니처 (SPEC 12.1). DOM 의존 없음.
   p.mastery = {championId: 0~100}, p.sig = [시그니처 id x3~5], p.lastUsed = {id: week}, p.usage = {year, c: {id: [판수, 승]}}
   NPC 숙련도는 world.mast[선수id] = {m: {...}, sig: [3]} 에 처음 필요할 때 선수 id·세이브 시드로 만들어 고정한다(연말에 초기화). */
(function (LP) {
  'use strict';
  var R = LP.rules, S = LP.state;
  var Q = {};

  var TIER_BONUS = { S: 20, A: 10, B: 5 };
  var COUNTER = { '암살': ['탱킹', '보호'], '캐리': ['암살', '돌진', '이니시'], '스플릿': ['이니시', '돌진'], '포크': ['돌진', '이니시'], '견제': ['돌진', '이니시'], '이니시': ['받아치기', '견제'],
    '돌진': ['받아치기', '탱킹'], '탱킹': ['캐리', '포크'], '운영': ['돌진', '이니시'], '보호': ['암살', '돌진'], '유틸': ['암살'], '받아치기': ['포크', '견제'] };
  Q.TIER_BONUS = TIER_BONUS;

  function db() { return LP.data.db; }
  function roles(c) { return c && c.role ? c.role.split('/') : []; }
  Q.released = function (date) { return db().champList.filter(function (c) { return c.release <= date; }); };
  Q.forPos = function (pos, date) { return Q.released(date).filter(function (c) { return c.pos.indexOf(pos) >= 0; }); };
  Q.patchedAmt = function (state, id) { return state.patched && state.patched[id] && state.patched[id] >= state.date ? 10 : 0; };
  Q.tierBonus = function (meta, id) { var m = meta[id]; return m ? (TIER_BONUS[m.tier] || 0) : 0; };

  // 능력치 성향과 챔피언의 lan/skr/tf 궁합 (평균 대비 높은 쪽 능력치와 챔피언의 강점이 맞을수록 +)
  function affinity(stats, c) {
    var avg = (stats.lan + stats.skr + stats.tf) / 3, a = 0;
    ['lan', 'skr', 'tf'].forEach(function (k) { a += (stats[k] - avg) / 100 * (c[k] - 3); });
    return a;
  }

  // 챔피언 count개를 메타 상위·궁합 가중으로 고른다. exclude: 이미 가진 id
  function genSet(rng, o) {
    var meta = LP.data.metaFor(o.date), cands = Q.forPos(o.pos, o.date).filter(function (c) { return o.exclude.indexOf(c.id) < 0; }), out = {};
    for (var i = 0; i < o.count && cands.length; i++) {
      var c = rng.weighted(cands, function (x) {
        var pb = meta[x.id] ? meta[x.id].pb : 1.5;
        return pb * Math.exp(affinity(o.stats, x)) * (x.pos[0] === o.pos ? 2 : 1);
      });
      out[c.id] = rng.range(o.lo, o.hi);
      cands.splice(cands.indexOf(c), 1);
    }
    return out;
  }
  function npcRange(ovr) { return ovr >= 450 ? [60, 85] : ovr >= 400 ? [55, 80] : ovr >= 350 ? [50, 75] : [40, 65]; }

  // ---------- 플레이어 ----------
  Q.syncPool = function (p) {
    p.pool = Object.keys(p.mastery).filter(function (id) { return p.mastery[id] >= 50; }).sort(function (a, b) { return p.mastery[b] - p.mastery[a]; });
  };
  Q.genPlayer = function (state, rng, sigIds) {
    var p = state.p, m = {};
    sigIds.forEach(function (id) { m[id] = R.SIG_MASTERY; });
    var extra = genSet(rng, { pos: p.pos, stats: p.stats, date: state.date, count: 5, lo: 40, hi: 60, exclude: sigIds });
    Object.keys(extra).forEach(function (id) { m[id] = extra[id]; });
    p.mastery = m; p.sig = sigIds.slice();
    p.lastUsed = {}; Object.keys(m).forEach(function (id) { p.lastUsed[id] = state.week; });
    p.usage = { year: +state.date.slice(0, 4), c: {} };
    Q.syncPool(p);
  };
  // 시작 연도 1월 기준으로 고를 수 있는 시그니처 후보 (내 포지션, 출시됨), 메타 순
  Q.sigChoices = function (pos, date) {
    var meta = LP.data.metaFor(date);
    return Q.forPos(pos, date).sort(function (a, b) { return (meta[b.id] ? meta[b.id].pb : 0) - (meta[a.id] ? meta[a.id].pb : 0) || (a.ko < b.ko ? -1 : 1); });
  };
  Q.ensure = function (state) {
    var p = state.p, changed = false;
    if (!LP.data.db.loaded) return false;
    if (!p.mastery) {
      var rng = S.sideRng(state, 'mastery');
      Q.genPlayer(state, rng, []);
      var top = Object.keys(p.mastery).sort(function (a, b) { return p.mastery[b] - p.mastery[a]; }).slice(0, 3);
      p.sig = top; changed = true;
    }
    if (!p.sig) { p.sig = Object.keys(p.mastery).sort(function (a, b) { return p.mastery[b] - p.mastery[a]; }).slice(0, 3); changed = true; }
    if (!p.lastUsed) { p.lastUsed = {}; Object.keys(p.mastery).forEach(function (id) { p.lastUsed[id] = state.week; }); }
    if (!p.usage) p.usage = { year: +state.date.slice(0, 4), c: {} };
    if (!state.patched) state.patched = {};
    if (!state.world.mast) state.world.mast = {};
    if (state.soloq.totW === undefined) { state.soloq.totW = state.soloq.w; state.soloq.totL = state.soloq.l; state.soloq.w = 0; state.soloq.l = 0; state.soloq.season = +state.date.slice(0, 4); }
    if (!state.record.seas) state.record.seas = { year: +state.date.slice(0, 4), lan: [0, 0], skr: [0, 0], tf: [0, 0], w: 0, l: 0, k: 0, d: 0, a: 0 };
    if (!state.record.seasons) state.record.seasons = [];
    if (!state.record.snap) state.record.snap = { w: state.record.official.w, l: state.record.official.l };
    if (!state.record.log) state.record.log = [];
    if (!state.pq) state.pq = [];
    if (!state.prefs.draft) state.prefs.draft = 'auto';
    Q.syncPool(p);
    return changed;
  };

  // ---------- NPC ----------
  Q.npc = function (state, id) {
    var w = state.world;
    w.mast = w.mast || {};
    if (w.mast[id]) return w.mast[id];
    var n = w.npcs[id], rng = LP.rng.create((state.seed >>> 0) ^ LP.rng.hash('mast|' + id + '|' + w.year));
    var out = { m: {}, sig: [] };
    if (n) {
      var r = npcRange(R.ovr(n.stats));
      out.m = genSet(rng, { pos: n.pos, stats: n.stats, date: state.date, count: 8, lo: r[0], hi: r[1], exclude: [] });
      out.sig = Object.keys(out.m).sort(function (a, b) { return out.m[b] - out.m[a]; }).slice(0, 3);
    }
    w.mast[id] = out;
    return out;
  };
  // 라인업 ref(L.ref) → {m, sig}
  Q.of = function (state, ref) {
    if (!ref) return { m: {}, sig: [] };
    if (ref.isPlayer) return { m: state.p.mastery, sig: state.p.sig };
    return Q.npc(state, ref.id);
  };

  // ---------- 성장·감소 ----------
  function grow(p, id, d) { p.mastery[id] = R.clamp((p.mastery[id] || 0) + d, 0, 100); }
  Q.use = function (state, id, win) {
    var p = state.p, d = 3;
    if (p.sig.indexOf(id) >= 0) d = Math.round(d * R.SIG_GROWTH);
    grow(p, id, d);
    p.lastUsed[id] = state.week;
    var y = +state.date.slice(0, 4);
    if (p.usage.year !== y) p.usage = { year: y, c: {} };
    var u = p.usage.c[id] = p.usage.c[id] || [0, 0];
    u[0]++; if (win) u[1]++;
    Q.syncPool(p);
  };
  Q.weekly = function (state, rng, action) {
    var p = state.p, wk = state.week, date = state.date;
    var ids = Object.keys(p.mastery).filter(function (id) { var c = db().champs[id]; return c && c.release <= date; });
    if (action !== 'rest' && ids.length) {
      ids.sort(function (a, b) { return p.mastery[b] - p.mastery[a]; });
      var top = ids.slice(0, 5), rest = ids.slice(5), main = [];
      while (main.length < 2 && top.length) { var t = rng.weighted(top, function (x) { return p.mastery[x] + 1; }); main.push(t); top.splice(top.indexOf(t), 1); }
      var pool3 = rest.length ? rest : top;
      if (pool3.length) main.push(rng.pick(pool3));
      main.forEach(function (id) {
        var d = rng.range(1, 3);
        if (p.sig.indexOf(id) >= 0) d = Math.round(d * R.SIG_GROWTH);
        grow(p, id, d); p.lastUsed[id] = wk;
      });
    }
    ids.forEach(function (id) {
      var lu = p.lastUsed[id]; if (lu === undefined) { p.lastUsed[id] = wk; return; }
      if (wk - lu >= 8) p.mastery[id] = Math.max(20, p.mastery[id] - 1);
    });
    Q.syncPool(p);
  };
  // 새 챔피언 하나를 숙련 목록에 넣는다(연습 시작). 메타 상위에서 고른다.
  Q.explore = function (state, rng) {
    var p = state.p, meta = LP.data.metaFor(state.date);
    var c = rng.weighted(Q.forPos(p.pos, state.date).filter(function (x) { return p.mastery[x.id] === undefined && meta[x.id]; }), function (x) { return meta[x.id].pb * Math.exp(affinity(p.stats, x)); });
    if (!c || !c.id) return null;
    p.mastery[c.id] = 30; p.lastUsed[c.id] = state.week;
    return c;
  };

  // ---------- 시그니처 ----------
  Q.addSig = function (state, id) {
    var p = state.p, c = db().champs[id], msg = '';
    if (!c) return '챔피언을 찾지 못했다.';
    if (p.sig.indexOf(id) >= 0) return c.ko + '은(는) 이미 시그니처다.';
    if (p.sig.length >= R.SIG_MAX) {
      var low = p.sig.slice().sort(function (a, b) { return (p.mastery[a] || 0) - (p.mastery[b] || 0); })[0];
      p.sig.splice(p.sig.indexOf(low), 1);
      msg = (db().champs[low] ? db().champs[low].ko : low) + ' 대신 ';
    }
    p.sig.push(id);
    p.mastery[id] = Math.max(p.mastery[id] || 0, 60); p.lastUsed[id] = state.week;
    Q.syncPool(p);
    return msg + c.ko + '을(를) 시그니처로 삼았다.';
  };
  Q.swapSig = function (state, rng, id) {
    var p = state.p, meta = LP.data.metaFor(state.date), i = p.sig.indexOf(id);
    if (i >= 0) p.sig.splice(i, 1);
    var cands = Q.forPos(p.pos, state.date).filter(function (c) { return p.sig.indexOf(c.id) < 0 && c.id !== id && meta[c.id] && !Q.patchedAmt(state, c.id); });
    if (!cands.length) return '새 시그니처 후보를 찾지 못해 자리가 비었다.';
    var c = rng.weighted(cands, function (x) { return meta[x.id].pb + 1; });
    p.sig.push(c.id); p.mastery[c.id] = Math.max(p.mastery[c.id] || 0, 45); p.lastUsed[c.id] = state.week;
    Q.syncPool(p);
    return c.ko + '을(를) 새 시그니처로 연습하기 시작했다.';
  };
  // '새 챔피언 연습' 이벤트 후보 목록: 최근 2년 안에 출시됐거나 메타 S·A이고 내 포지션에 맞는, 시그니처 아닌 챔피언
  Q.newChampPool = function (state) {
    var p = state.p, meta = LP.data.metaFor(state.date), lim = S.addDays(state.date, -730);
    return Q.forPos(p.pos, state.date).filter(function (c) { return p.sig.indexOf(c.id) < 0 && ((c.release >= lim) || (meta[c.id] && (meta[c.id].tier === 'S' || meta[c.id].tier === 'A'))) && !Q.patchedAmt(state, c.id); });
  };
  Q.newChampCands = function (state, rng) {
    var meta = LP.data.metaFor(state.date), lim = S.addDays(state.date, -730), list = Q.newChampPool(state), out = [];
    while (out.length < 3 && list.length) { var c = rng.weighted(list, function (x) { return (meta[x.id] ? meta[x.id].pb : 1) + (x.release >= lim ? 15 : 0); }); out.push(c); list.splice(list.indexOf(c), 1); }
    return out;
  };

  // ---------- 픽 점수 ----------
  // 상대 조합의 역할을 받아치는 정도 0~5
  Q.compBonus = function (c, oppIds, allyIds) {
    if (!c) return 0;
    var tally = {}, d = db().champs;
    oppIds.forEach(function (id) { roles(d[id]).forEach(function (r) { tally[r] = (tally[r] || 0) + 1; }); });
    var mine = roles(c), b = 0;
    Object.keys(tally).forEach(function (o) { (COUNTER[o] || []).forEach(function (r) { if (mine.indexOf(r) >= 0) b += tally[o]; }); });
    b = Math.min(3, b);
    var have = {}; allyIds.forEach(function (id) { roles(d[id]).forEach(function (r) { have[r] = 1; }); });
    if (mine.length && !mine.some(function (r) { return have[r]; })) b += 2;
    return Math.min(5, b);
  };
  Q.pickScore = function (state, c, mast, sig, meta, oppIds, allyIds, patchedPen) {
    var m = mast[c.id] || 0;
    var s = m + Q.tierBonus(meta, c.id) + Q.compBonus(c, oppIds, allyIds);
    if (sig.indexOf(c.id) >= 0) s += R.SIG_PICK;
    if (patchedPen) s -= patchedPen;
    return s;
  };

  LP.mastery = Q;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
