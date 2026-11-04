/* rng.js — 시드 난수 (sfc32, splitmix32 시드). 참고 파일 rng.js를 그대로 가져와 네임스페이스만 LP로 바꿨다. */
(function (LP) {
  'use strict';

  function splitmix32(a) {
    return function () {
      a = (a + 0x9e3779b9) | 0;
      var t = a ^ (a >>> 16);
      t = Math.imul(t, 0x21f0aaad);
      t = t ^ (t >>> 15);
      t = Math.imul(t, 0x735a2d97);
      t = t ^ (t >>> 15);
      return t >>> 0;
    };
  }

  function hashString(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h;
  }

  function Rng(st) {
    this.a = st[0] | 0; this.b = st[1] | 0; this.c = st[2] | 0; this.d = st[3] | 0;
  }

  // sfc32 step → uint32
  Rng.prototype.next32 = function () {
    var a = this.a, b = this.b, c = this.c, d = this.d;
    var t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    this.a = a; this.b = b; this.c = c; this.d = d;
    return t >>> 0;
  };

  // [0,1)
  Rng.prototype.random = function () { return this.next32() / 4294967296; };
  // 1..n
  Rng.prototype.int = function (n) { return 1 + Math.floor(this.random() * n); };
  // a..b inclusive
  Rng.prototype.range = function (a, b) { return a + Math.floor(this.random() * (b - a + 1)); };
  // normal(mu, sd)
  Rng.prototype.gauss = function (mu, sd) {
    if (mu === undefined) mu = 0;
    if (sd === undefined) sd = 1;
    var u = 1 - this.random();
    var v = this.random();
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.random() * arr.length)]; };
  // p% : int(100) <= p
  Rng.prototype.chance = function (p) { return this.int(100) <= p; };
  Rng.prototype.state = function () { return [this.a >>> 0, this.b >>> 0, this.c >>> 0, this.d >>> 0]; };
  // 우리 쪽 추가
  Rng.prototype.d2x6 = function () { return this.int(6) + this.int(6); };
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  Rng.prototype.weighted = function (items, wf) {
    var tot = 0, i;
    for (i = 0; i < items.length; i++) tot += Math.max(0, wf(items[i]));
    if (tot <= 0) return this.pick(items);
    var r = this.random() * tot;
    for (i = 0; i < items.length; i++) {
      r -= Math.max(0, wf(items[i]));
      if (r < 0) return items[i];
    }
    return items[items.length - 1];
  };

  function create(seedOrState) {
    if (Array.isArray(seedOrState) && seedOrState.length === 4) {
      return new Rng(seedOrState);
    }
    var seed;
    if (typeof seedOrState === 'number' && isFinite(seedOrState)) seed = seedOrState >>> 0;
    else if (typeof seedOrState === 'string') seed = hashString(seedOrState);
    else seed = (Date.now() ^ 0x5bd1e995) >>> 0;
    var sm = splitmix32(seed);
    var r = new Rng([sm(), sm(), sm(), sm()]);
    for (var i = 0; i < 15; i++) r.next32();
    return r;
  }

  LP.rng = { create: create, hash: hashString };
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
