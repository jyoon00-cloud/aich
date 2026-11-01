/* data.js — rules/ 아래 CSV·MD와 app/data/schedule.json 로드·파싱.
   로더는 주입할 수 있다: LP.data.setLoader(path => Promise<string>)  (path는 저장소 루트 기준: 'rules/db/...') */
(function (LP) {
  'use strict';
  var loader = null;
  var cache = {};

  function defaultLoader(path) {
    // app/index.html 에서 저장소 루트는 한 단계 위
    return fetch('../' + path).then(function (r) {
      if (!r.ok) throw new Error(path + ' ' + r.status);
      return r.text();
    });
  }
  function setLoader(fn) { loader = fn; cache = {}; }
  function read(path) {
    if (!cache[path]) cache[path] = Promise.resolve((loader || defaultLoader)(path));
    return cache[path];
  }

  function parseCSV(text) {
    var rows = [], row = [], f = '', q = false, i, c;
    text = text.replace(/^﻿/, '');
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f.length || row.length) { row.push(f); rows.push(row); }
    var head = rows.shift() || [];
    return rows.filter(function (r) { return r.length > 1 || (r[0] || '').length; }).map(function (r) {
      var o = {};
      head.forEach(function (h, k) { o[h.trim()] = (r[k] === undefined ? '' : r[k]); });
      return o;
    });
  }

  var LEAGUES = ['LCK', 'LPL', 'LEC', 'LCS'];
  var db = { pot: {}, yearRows: {}, champs: {}, champList: [], meta: {}, traits: { general: {}, unique: {} }, schedule: null, loaded: false };

  function normPos(p) { return p === 'SUPPORT' ? 'SUP' : p; }

  function parseTraits(md) {
    var lines = md.split('\n');
    lines.forEach(function (ln) {
      var m = ln.match(/^\|\s*([a-z0-9_]+)\s*\|\s*([^|]+?)\s*\|\s*(.*)$/);
      if (!m || m[1] === 'id') return;
      var id = m[1];
      var cells = ln.split('|').map(function (s) { return s.trim(); });
      // cells[0] 공백, 1 id, 2 이름, 3..
      if (/_u$/.test(id)) {
        db.traits.unique[id] = { id: id, name: cells[2], text: cells[3], fx: LP.rules.parseUniqueFx(cells[3]) };
      } else if (cells.length >= 6) {
        db.traits.general[id] = { id: id, name: cells[2], cond: cells[3], text: cells[4] };
      }
    });
  }

  function loadAll(startYear) {
    var jobs = [];
    var potFiles = ['LCK', 'LPL', 'LEC', 'LCS', 'CL'];
    potFiles.forEach(function (lg) {
      jobs.push(read('rules/db/potential/' + lg + '.csv').then(function (t) {
        parseCSV(t).forEach(function (r) {
          if (db.pot[r.id]) return;
          db.pot[r.id] = {
            id: r.id, name: r.name, pos: normPos(r.pos), birth: +r.birth_year, potential: +r.potential,
            hidden: { men: +r.men || 3, clutch: +r.clutch || 0, pro: +r.pro || 3, vol: +r.vol || 3 },
            debut: r.debut_year ? +r.debut_year : null,
            traits: r.traits ? r.traits.split(';').filter(Boolean) : [],
            lg: lg === 'CL' ? 'LCK' : lg
          };
        });
      }));
    });
    jobs.push(read('rules/db/champions/champions.csv').then(function (t) {
      db.champList = parseCSV(t).map(function (r) {
        return {
          id: r.id, ko: r.name_ko, en: r.name_en, release: r.release,
          pos: (r.pos || '').split('/').map(normPos), diff: +r.diff || 3, curve: r.curve,
          lan: +r.lan || 3, skr: +r.skr || 3, tf: +r.tf || 3, role: r.role, cls: r.class, note: r.note
        };
      });
      db.champList.forEach(function (c) { db.champs[c.id] = c; });
    }));
    for (var y = 2013; y <= 2026; y++) {
      (function (y) {
        jobs.push(read('rules/db/champions/meta/' + y + '.csv').then(function (t) {
          var m = {};
          parseCSV(t).forEach(function (r) {
            m[r.id] = {
              spring: { pb: +r.spring_pb || 0, tier: r.spring_tier || '' },
              worlds: { pb: +r.worlds_pb || 0, tier: r.worlds_tier || '' }
            };
          });
          db.meta[y] = m;
        }));
      })(y);
    }
    jobs.push(read('rules/db/traits.md').then(parseTraits));
    jobs.push(read('app/data/schedule.json').then(function (t) { db.schedule = JSON.parse(t); }));
    if (startYear) {
      LEAGUES.forEach(function (lg) {
        jobs.push(read('rules/db/' + startYear + '/' + lg + '.csv').then(function (t) {
          db.yearRows[startYear] = db.yearRows[startYear] || {};
          db.yearRows[startYear][lg] = parseCSV(t).map(function (r) {
            return {
              id: r.id, team: r.team, pos: normPos(r.pos), style: r.style,
              stats: { lan: +r.lan, phy: +r.phy, skr: +r.skr, tf: +r.tf, vis: +r.vis }
            };
          });
        }));
      });
    }
    return Promise.all(jobs).then(function () { db.loaded = true; return db; });
  }

  // 메타: 그 날짜의 챔피언별 tier (README 4: 1~6월 spring, 7~12월 worlds, 한쪽이 0이면 다른 쪽)
  function metaFor(date) {
    var y = Math.min(2026, Math.max(2013, +date.slice(0, 4)));
    var half = +date.slice(5, 7) <= 6 ? 'spring' : 'worlds';
    var other = half === 'spring' ? 'worlds' : 'spring';
    var m = db.meta[y] || {}, out = {};
    Object.keys(m).forEach(function (id) {
      var h = m[id][half];
      if (!h.pb) h = m[id][other];
      if (h && h.pb) out[id] = { pb: h.pb, tier: h.tier };
    });
    return out;
  }

  LP.data = { db: db, setLoader: setLoader, loadAll: loadAll, parseCSV: parseCSV, metaFor: metaFor, LEAGUES: LEAGUES };
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
