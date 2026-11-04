/* create.js — 캐릭터 생성 (lolpro 2장). 배경 3지선다·히든 스탯 굴림·언변 굴림은 시드로 결정되고 DOM에 의존하지 않는다. */
(function (LP) {
  'use strict';
  var R = LP.rules, S = LP.state, L = LP.league;
  var C = {};

  C.validate = function (inp) {
    var err = [];
    if (!inp.name || !inp.name.trim()) err.push('이름을 입력하세요');
    if (!inp.nick || !inp.nick.trim()) err.push('닉네임을 입력하세요');
    if (R.POS.indexOf(inp.pos) < 0) err.push('포지션을 고르세요');
    if (!(inp.startYear >= 2013 && inp.startYear <= 2026)) err.push('시작 연도는 2013~2026');
    if (!inp.personality || inp.personality.length < 2 || inp.personality.length > 3) err.push('성격 키워드는 2~3개');
    R.STATS.forEach(function (k) { var v = inp.stats && inp.stats[k]; if (!(v >= 0 && v <= 500)) err.push(R.STAT_SHORT[k] + ' 능력치는 0~500'); });
    var sig = inp.sig || [];
    if (sig.length !== 3 || sig.some(function (id, i) { return sig.indexOf(id) !== i; })) err.push('시그니처 챔피언 3개를 고르세요');
    else if (R.POS.indexOf(inp.pos) >= 0 && inp.startYear >= 2013) {
      var ok = LP.mastery.sigChoices(inp.pos, inp.startYear + '-01-01').map(function (c) { return c.id; });
      if (sig.some(function (id) { return ok.indexOf(id) < 0; })) err.push('시그니처는 내 포지션에 맞고 시작 시점에 출시된 챔피언이어야 합니다');
    }
    return err;
  };

  // 시드 -> 언변 굴림 + 배경 후보 3개 (판정형, 성장형, 이색)
  C.offer = function (inp) {
    var seed = (inp.seed === undefined || inp.seed === null || inp.seed === '') ? (Date.now() & 0x7fffffff) : (typeof inp.seed === 'number' ? inp.seed : LP.rng.hash(String(inp.seed)));
    var rng = LP.rng.create(seed), speech = R.rollSpeech(rng);
    var bgs = ['판정', '성장', '이색'].map(function (t) { return rng.pick(R.BACKGROUNDS.filter(function (b) { return b.type === t; })).id; });
    return { seed: seed, rngState: rng.state(), speech: speech, bgIds: bgs };
  };

  C.finish = function (inp, offer, bgId) {
    var err = C.validate(inp);
    if (err.length) throw new Error(err.join(', '));
    var db = LP.data.db, st = S.blank(offer.seed);
    st.rng = offer.rngState.slice();
    var rng = S.rng(st), year = inp.startYear, bgDef = R.BACKGROUNDS.filter(function (b) { return b.id === bgId; })[0];
    if (!bgDef) throw new Error('배경을 고르세요');
    st.startYear = year; st.date = year + '-01-01'; st.week = 0;
    var by = year - 16, bm = rng.range(1, 12), bd = rng.range(1, 28);
    if (bm === 1 && bd === 1) bd = 2;
    var stats = {};
    R.STATS.forEach(function (k) { stats[k] = R.clamp(Math.round(+inp.stats[k]), 0, R.POTENTIAL); });
    bgDef.merits.concat(bgDef.costs).forEach(function (e) { if (e.t === 'start') stats[e.stat] = R.clamp(stats[e.stat] + e.val, 0, R.POTENTIAL); });
    var exp = (year + 1) + '-01-01';
    st.p = {
      name: inp.name.trim(), nick: inp.nick.trim(), pos: inp.pos, birth: by + '-' + String(bm).padStart(2, '0') + '-' + String(bd).padStart(2, '0'),
      stats: stats, potential: R.POTENTIAL, hidden: R.rollHidden(rng), personality: inp.personality.slice(), speech: offer.speech,
      bg: { id: bgDef.id, name: bgDef.name, type: bgDef.type, story: bgDef.story, merits: JSON.parse(JSON.stringify(bgDef.merits)), costs: JSON.parse(JSON.stringify(bgDef.costs)), expires: exp },
      traits: [], pool: [], mastery: null, sig: [], adapt: { cl: null, pro: null, intlKey: null, finalSeen: false }, status: { slump: 0, injury: 0 }, subWeeks: 0, trainWeeks: 0
    };
    bgDef.merits.concat(bgDef.costs).forEach(function (e) { if (e.t === 'fame') st.fame = R.clamp(st.fame + e.val, 0, 100); });
    // 챔피언 숙련도: 시그니처 3개(숙련 70) + 자동 5개(40~60)
    LP.mastery.genPlayer(st, rng, inp.sig.slice());
    st.record.seas.year = year; st.startDate = year + '-01-01';
    // 솔로랭크: OVR에 맞는 MMR에서 시작
    st.soloq = { tier: '', lp: 0, mmr: Math.round(R.clamp(R.ovrToMmr(R.ovr(stats)) + rng.range(-100, 100), 0, R.RP_MAX)), w: 0, l: 0, totW: 0, totL: 0, season: year };
    LP.week.syncTier(st);
    L.buildWorld(st, db, year, rng);
    var txt = st.p.nick + '(' + st.p.name + '), 만 15세. ' + R.POS_KO[inp.pos] + ' 포지션의 무소속 아마추어로 ' + year + '년 1월을 맞았다. 배경은 "' + bgDef.name + '".';
    S.addFeed(st, 'start', { bg: bgDef.name, year: year, pos: inp.pos }, txt);
    S.sync(st);
    return st;
  };

  LP.create = C;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
