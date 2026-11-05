/* state.js — 상태 객체 생성·저장·불러오기·내보내기 */
(function (LP) {
  'use strict';
  var S = {};
  var SAVE_KEY = 'lp2_save';
  var FEED_MAX = 400;

  var mem = {};
  var store = {
    get: function (k) { try { if (typeof localStorage !== 'undefined') return localStorage.getItem(k); } catch (e) { } return mem[k] === undefined ? null : mem[k]; },
    set: function (k, v) { try { if (typeof localStorage !== 'undefined') { localStorage.setItem(k, v); return; } } catch (e) { } mem[k] = v; },
    del: function (k) { try { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); } catch (e) { } delete mem[k]; }
  };
  S.store = store;

  S.DEFAULT_PREFS = {
    speed: { mode: 'manual', span: 4, plan: { action: 'train', focus: ['lan', 'phy'], auto: true }, manual: { action: 'train', focus: ['lan', 'phy'], auto: false } },
    stops: { event: true, match: true, grade: true, tier: true, season: true, weekly: false },
    watch: 'all', watchSpeed: 'normal', matchView: 'watch', draft: 'auto'
  };

  S.blank = function (seed) {
    var st = {
      version: 1, seed: seed, rng: LP.rng.create(seed).state(),
      date: '', week: 0, startYear: 0,
      p: null,
      career: { stage: 'amateur', team: null, league: null, contract: null, money: 0 },
      soloq: { tier: '', lp: 0, mmr: 0, w: 0, l: 0, totW: 0, totL: 0, season: 0 },
      fame: 0, community: 0,
      record: { official: { w: 0, l: 0 }, series: { w: 0, l: 0 }, scrim: { w: 0, l: 0 }, kda: { k: 0, d: 0, a: 0 }, titles: [], awards: [], scenes: { lan: [0, 0], skr: [0, 0], tf: [0, 0] }, finalsLost: 0, intlTitles: 0, leagueTitles: 0, seas: { year: 0, lan: [0, 0], skr: [0, 0], tf: [0, 0], w: 0, l: 0, k: 0, d: 0, a: 0 }, seasons: [], snap: { w: 0, l: 0, t: 0 }, log: [] },
      world: null,
      feed: [], pending: null, pq: [], patched: {}, wk: null, cooldown: {}, growthLog: [],
      prefs: JSON.parse(JSON.stringify(S.DEFAULT_PREFS)),
      notes: ''
    };
    return st;
  };

  // 상태에 붙은 난수 객체(저장에는 포함되지 않음)
  S.rng = function (st) {
    if (!st.__r) Object.defineProperty(st, '__r', { value: LP.rng.create(st.rng), enumerable: false, writable: true, configurable: true });
    return st.__r;
  };
  S.sync = function (st) { if (st.__r) st.rng = st.__r.state(); };
  // 같은 상태에서 같은 결과를 내려면 묘사용 난수는 게임 난수와 분리한다
  S.sideRng = function (st, tag) { return LP.rng.create((st.seed >>> 0) ^ LP.rng.hash(String(tag))); };

  S.addFeed = function (st, kind, facts, text, opts) {
    var e = { id: (st.feedSeq = (st.feedSeq || 0) + 1), date: st.date, kind: kind, facts: facts || {}, text: text || '' };
    if (opts) for (var k in opts) e[k] = opts[k];
    st.feed.push(e);
    if (st.feed.length > FEED_MAX) st.feed.splice(0, st.feed.length - FEED_MAX);
    return e;
  };

  S.serialize = function (st) { S.sync(st); return JSON.stringify(st); };
  S.deserialize = function (txt) {
    var st = JSON.parse(txt);
    if (!st || st.version !== 1 || !st.p || !st.world) throw new Error('세이브 형식이 맞지 않습니다');
    if (LP.mastery) LP.mastery.ensure(st);     // 예전 세이브: 숙련도·시그니처·시즌 기록 자동 생성
    return st;
  };
  S.save = function (st, key) { store.set(key || SAVE_KEY, S.serialize(st)); };
  S.hasSave = function (key) { return !!store.get(key || SAVE_KEY); };
  S.load = function (key) { var t = store.get(key || SAVE_KEY); return t ? S.deserialize(t) : null; };
  S.clear = function (key) { store.del(key || SAVE_KEY); };
  S.exportJSON = function (st) { return S.serialize(st); };
  S.importJSON = function (txt) { return S.deserialize(txt); };

  // 날짜 도우미 (UTC 기준 YYYY-MM-DD)
  S.parseDate = function (d) { var a = d.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); };
  S.fmtDate = function (ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
  S.addDays = function (d, n) { return S.fmtDate(S.parseDate(d) + n * 86400000); };
  S.diffDays = function (a, b) { return Math.round((S.parseDate(b) - S.parseDate(a)) / 86400000); };
  S.ageAt = function (birth, date) {
    var b = birth.split('-'), d = date.split('-'), a = +d[0] - +b[0];
    if (+d[1] < +b[1] || (+d[1] === +b[1] && +d[2] < +b[2])) a--;
    return a;
  };
  S.age = function (st) { return S.ageAt(st.p.birth, st.date); };
  S.DOW = ['일', '월', '화', '수', '목', '금', '토'];
  S.dow = function (d) { return S.DOW[new Date(S.parseDate(d)).getUTCDay()]; };

  LP.state = S;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
