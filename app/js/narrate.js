/* narrate.js — 묘사. 결과는 스크립트가 이미 정했고, 여기서는 말만 만든다.
   AI 키가 없거나 호출이 실패하면 템플릿 문장을 쓴다(게임 난수와 분리된 난수로 고른다). */
(function (LP) {
  'use strict';
  var S = LP.state, R = LP.rules;
  var N = {};
  var KEY = 'lp2_settings';
  var PRESETS = {
    orcarouter: { baseUrl: 'https://api.orcarouter.ai/v1', model: '' },
    openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: '' },
    anthropic: { baseUrl: 'https://api.anthropic.com', model: 'claude-opus-5-5' },
    custom: { baseUrl: '', model: '' }
  };
  N.PRESETS = PRESETS;
  var SYSTEM = '너는 롤 프로게이머 커리어 게임의 해설·내레이터다. 주어진 사실만 2~5문장 한국어로 묘사한다. 수치·결과를 바꾸거나 새 사실을 만들지 않는다.';

  N.getSettings = function () {
    var d = { provider: 'orcarouter', baseUrl: PRESETS.orcarouter.baseUrl, apiKey: '', model: '' };
    try { var t = S.store.get(KEY); if (t) { var o = JSON.parse(t); for (var k in o) d[k] = o[k]; } } catch (e) { }
    return d;
  };
  N.saveSettings = function (o) { S.store.set(KEY, JSON.stringify(o)); };
  N.hasAI = function () { var s = N.getSettings(); return !!(s.apiKey && s.baseUrl && (s.provider === 'anthropic' || s.model)); };

  function pick(r, a) { return a[Math.floor(r.random() * a.length)]; }
  function fill(t, d) { return t.replace(/\{(\w+)\}/g, function (m, k) { return d[k] === undefined ? '' : d[k]; }); }
  function eun(w) { var c = w.charCodeAt(w.length - 1); if (c < 0xac00 || c > 0xd7a3) return w + '은(는)'; return w + ((c - 0xac00) % 28 ? '은' : '는'); }
  function eul(w) { var c = w.charCodeAt(w.length - 1); if (c < 0xac00 || c > 0xd7a3) return w + '을(를)'; return w + ((c - 0xac00) % 28 ? '을' : '를'); }
  function iga(w) { var c = w.charCodeAt(w.length - 1); if (c < 0xac00 || c > 0xd7a3) return w + '이(가)'; return w + ((c - 0xac00) % 28 ? '이' : '가'); }
  N.eun = eun;

  var RES_KO = { critS: '대성공', S: '성공', F: '실패', critF: '대실패' };

  function sceneSentence(r, who, sc) {
    var good = sc.r === 'S' || sc.r === 'critS';
    var big = sc.r === 'critS' || sc.r === 'critF';
    var A = {
      '라인전': good ? ['라인전에서 ' + who + '의 주도권이 이어졌다.', who + '가 라인전 교환에서 이득을 챙겼다.'] : ['라인전에서 ' + who + '가 밀렸다.', who + '가 라인 주도권을 내줬다.'],
      '소규모 교전': good ? [who + '가 소규모 교전에서 판단 좋게 이득을 봤다.', '중반 교전에서 ' + who + '의 진입이 통했다.'] : ['소규모 교전에서 ' + who + '의 판단이 엇나갔다.', '교전에서 ' + who + '가 고립됐다.'],
      '한타': good ? ['한타에서 ' + who + '가 제 몫을 해냈다.', '한타 포지셔닝이 빛나며 승기를 잡았다.'] : ['한타에서 진형이 무너졌다.', '한타에서 ' + who + '가 힘을 쓰지 못했다.']
    };
    var s = pick(r, A[sc.l] || ['장면이 지나갔다.']);
    return big ? s.replace(/\.$/, '') + (good ? ' (대성공)' : ' (대실패)') + '.' : s;
  }

  var T = {
    match: function (r, f) {
      var who = f.player, w = f.win;
      var head = f.draw ? '{my} 대 {opp}의 경기는 {score} 무승부로 끝났다.' : w ? pick(r, ['{myI} {oppE} {score}로 꺾었다.', '{my}, {opp}에 {score} 승리.', '{opp} 상대로 {score}의 값진 승리를 거뒀다.']) : pick(r, ['{myI} {opp}에게 {score}로 졌다.', '{opp}의 벽을 넘지 못하고 {score}로 패했다.', '아쉬운 {score} 패배였다.']);
      head = fill(head, { my: f.my, opp: f.opp, score: f.score, myI: iga(f.my), oppE: eul(f.opp) });
      var set = f.sets[f.sets.length - 1], parts = [];
      if (set) {
        var sc = set.scenes.slice().sort(function (a, b) { return (b.r === 'critS' || b.r === 'critF' ? 1 : 0) - (a.r === 'critS' || a.r === 'critF' ? 1 : 0); })[0];
        if (sc) parts.push(sceneSentence(r, who, sc));
        parts.push(who + '는 ' + set.champ + '로 ' + set.kda + '을 기록했다.' + (set.pom ? ' POM에 선정됐다.' : ''));
      }
      return head + ' ' + parts.join(' ');
    },
    event: function (r, f) { return '[' + f.title + '] ' + f.text + ' → ' + f.choice + '. ' + f.result; },
    season: function (r, f) {
      return f.year + '년 시즌 결산. 공식전 ' + f.record.w + '승 ' + f.record.l + '패, OVR ' + f.ovr + ', 솔로랭크 ' + f.tier + '.' + (f.titles && f.titles.length ? ' 최근 타이틀: ' + f.titles.join(', ') + '.' : '');
    },
    adapt: function (r, f) { return '프로 무대 적응: ' + f.label + '.'; },
    contract: function () { return ''; }, role: function () { return ''; }, trait: function () { return ''; }, aging: function () { return ''; }, career: function () { return ''; }
  };
  N.template = function (state, kind, facts) {
    var r = S.sideRng(state, kind + state.date + (state.feed.length));
    return T[kind] ? T[kind](r, facts) : '';
  };

  // 주간 한 줄
  N.weekLine = function (state, s) {
    var gs = Object.keys(s.growth || {}).filter(function (k) { return s.growth[k]; }).map(function (k) { return R.STAT_SHORT[k] + ' +' + s.growth[k]; });
    var act = LP.week.ACTION_KO[s.action] + (s.focus && s.focus.length ? '(' + s.focus.map(function (k) { return R.STAT_SHORT[k]; }).join('·') + ')' : '');
    var parts = [act];
    if (gs.length) parts.push(gs.join(' '));
    if (s.solo && (s.solo.w + s.solo.l)) parts.push('솔랭 ' + s.solo.w + '승' + s.solo.l + '패 (' + (s.solo.delta >= 0 ? '+' : '') + s.solo.delta + ') → ' + s.tier);
    (s.matches || []).forEach(function (m) { parts.push((m.draw ? '무' : m.win ? '승' : '패') + ' vs ' + m.opp + ' ' + m.score); });
    if (s.notes && s.notes.length) parts.push(s.notes.join(', '));
    if (s.injured) parts.push('부상 중'); else if (s.slump) parts.push('슬럼프');
    return parts.join(' · ');
  };

  N.digestTemplate = function (state, facts) {
    if (!facts.lines.length) return '';
    return '지난 ' + facts.lines.length + '주 동안의 기록입니다. ' + (facts.others.length ? facts.others.slice(0, 3).join(' ') : '큰 사건 없이 훈련과 솔로랭크가 이어졌습니다.');
  };

  // ---------- AI 호출 ----------
  function withTimeout(ms) { var c = (typeof AbortController !== 'undefined') ? new AbortController() : null; if (c) setTimeout(function () { c.abort(); }, ms); return c; }
  N.callAI = function (userText) {
    var s = N.getSettings();
    if (!N.hasAI() || typeof fetch === 'undefined') return Promise.resolve(null);
    var ctl = withTimeout(25000), base = s.baseUrl.replace(/\/$/, '');
    var p;
    if (s.provider === 'anthropic') {
      p = fetch(base + '/v1/messages', {
        method: 'POST', signal: ctl && ctl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': s.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: s.model || 'claude-opus-5-5', max_tokens: 600, system: SYSTEM, messages: [{ role: 'user', content: userText }] })
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { return (j.content || []).map(function (b) { return b.text || ''; }).join('').trim(); });
    } else {
      var headers = { 'content-type': 'application/json', Authorization: 'Bearer ' + s.apiKey };
      if (s.provider === 'openrouter') { headers['HTTP-Referer'] = location.origin; headers['X-Title'] = 'LoL Pro Simulator'; }
      p = fetch(base + '/chat/completions', {
        method: 'POST', signal: ctl && ctl.signal, headers: headers,
        body: JSON.stringify({ model: s.model, max_tokens: 600, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userText }] })
      }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function (j) { return ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '').trim(); });
    }
    return p.then(function (t) { return t || null; }).catch(function () { return null; });
  };
  function factsText(state, kind, facts) {
    return JSON.stringify({ kind: kind, date: state.date, who: state.p.nick + '(' + R.POS_KO[state.p.pos] + ')', facts: facts });
  }
  // 피드 항목 하나를 AI 묘사로 바꾼다(실패하면 템플릿 유지)
  N.enhance = function (state, entry) {
    if (entry.aiDone || !entry.ai || !N.hasAI()) return Promise.resolve(false);
    return N.callAI(factsText(state, entry.kind, entry.facts)).then(function (t) { if (t) { entry.text = t; entry.aiDone = true; return true; } return false; });
  };
  // 세트 하이라이트 요약 1회
  N.highlight = function (state, set) {
    var facts = { champ: LP.match.champKo(set.myChamp), win: set.win, kda: set.kda, pom: set.pom, scenes: set.scenes.map(function (s) { return { l: s.label, r: RES_KO[s.res] }; }) };
    return N.callAI(factsText(state, 'setHighlight', facts));
  };
  N.digest = function (state, facts) {
    if (!N.hasAI()) return Promise.resolve(N.digestTemplate(state, facts));
    return N.callAI(factsText(state, 'digest', facts)).then(function (t) { return t || N.digestTemplate(state, facts); });
  };

  LP.narrate = N;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
