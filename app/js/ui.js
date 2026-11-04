/* ui.js — 화면. 허브·피드 카드·모달·관전(미니맵 SVG + 문자중계). 엔진 호출은 main.js가 한다. */
(function (LP) {
  'use strict';
  var R = LP.rules, S = LP.state, L = LP.league, N = LP.narrate;
  var UI = {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  UI.esc = esc;

  var toastTimer;
  UI.toast = function (msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  };

  // ---------- 모달 ----------
  var stack = [];
  UI.modal = function (o) {
    var ov = document.createElement('div'); ov.className = 'overlay';
    var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog');
    m.innerHTML = (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') + '<div class="mbody">' + (o.body || '') + '</div><div class="ctrl mbtns"></div>';
    ov.appendChild(m);
    $('#modal-root').appendChild(ov);
    var api = { el: m, body: m.querySelector('.mbody'), btns: m.querySelector('.mbtns'), close: function () { if (o.onClose) o.onClose(); ov.remove(); stack = stack.filter(function (x) { return x !== api; }); } };
    api.setButtons = function (bs) {
      api.btns.innerHTML = '';
      (bs || []).forEach(function (b) {
        var e = document.createElement('button'); e.className = 'btn ' + (b.cls || ''); e.textContent = b.label; if (b.disabled) e.disabled = true;
        e.onclick = function () { b.onClick && b.onClick(api, e); }; api.btns.appendChild(e);
      });
    };
    api.setButtons(o.buttons);
    if (o.dismiss) ov.addEventListener('click', function (ev) { if (ev.target === ov) api.close(); });
    stack.push(api);
    return api;
  };
  UI.closeAll = function () { stack.slice().forEach(function (m) { m.close(); }); };

  // ---------- 상태 카드 ----------
  function statusCard(st) {
    var p = st.p, c = st.career, ovr = R.ovr(p.stats), age = S.age(st);
    var team = c.team ? L.teamName(st, c.team) : null;
    var stage = R.STAGE_KO[c.stage] + (team ? ' · ' + team : '') + (c.contract && (c.stage === 'cl' || c.stage === 'pro') ? ' · ' + (c.contract.role === 'starter' ? '주전' : '후보') : '');
    if (c.fa) stage = 'FA (계약 없음)';
    var q = R.tierInfo(st.soloq.mmr);
    var statsHtml = R.STATS.map(function (k) {
      return '<div class="stat"><div class="k">' + R.STAT_SHORT[k] + '</div><div class="v">' + p.stats[k] + '</div><div class="g">' + R.gradeName(p.stats[k]) + '</div></div>';
    }).join('');
    var ad = p.adapt[c.stage === 'cl' ? 'cl' : 'pro'];
    var status = [];
    if (p.status.injury > 0) status.push('<span class="badge bad">부상 ' + p.status.injury + '주</span>');
    if (p.status.slump > 0) status.push('<span class="badge warn">슬럼프 ' + p.status.slump + '주</span>');
    if (ad && ad.pen < 0 && (c.stage === 'cl' || c.stage === 'pro')) status.push('<span class="badge warn">적응 ' + ad.label + ' ' + ad.pen + '</span>');
    var ctr = c.contract ? R.fmtMoney(c.contract.salary) + ' · ~' + c.contract.end.slice(0, 7) : '-';
    return '<div class="card status"><div class="row between"><div><div class="name">' + esc(p.nick) + ' <span class="muted small">' + esc(p.name) + ' · ' + R.POS_KO[p.pos] + '</span></div>' +
      '<div class="meta">' + st.date + ' (' + S.dow(st.date) + ') · ' + (st.week + 1) + '주차 · 만 ' + age + '세</div></div><div style="text-align:right"><div class="ovr" style="font-size:22px">OVR ' + ovr + '</div><div class="muted small">' + esc(L.phaseLabel(st)) + '</div></div></div>' +
      '<div class="meta" style="margin-top:4px">' + esc(stage) + '</div>' +
      '<div class="stats">' + statsHtml + '</div>' +
      '<div class="row" style="margin-bottom:6px">' + status.join(' ') + p.traits.map(function (t) { return '<span class="badge good">' + esc(R.traitName(t)) + '</span>'; }).join(' ') + '</div>' +
      '<div class="kv"><span>솔로랭크</span><span>' + q.text + ' (' + st.soloq.w + '승 ' + st.soloq.l + '패)</span></div>' +
      '<div class="kv"><span>인지도 / 여론</span><span>' + st.fame + ' / ' + (st.community > 0 ? '+' : '') + st.community + '</span></div>' +
      '<div class="kv"><span>계약</span><span>' + ctr + '</span></div>' +
      '<div class="kv"><span>자산</span><span>' + R.fmtMoney(st.career.money) + '</span></div>' +
      '<div class="kv"><span>공식전 / 스크림</span><span>' + st.record.official.w + '승 ' + st.record.official.l + '패 / ' + st.record.scrim.w + '승 ' + st.record.scrim.l + '패</span></div>' +
      (st.record.titles.length ? '<div class="kv"><span>타이틀</span><span>' + esc(st.record.titles.slice(-2).join(', ')) + (st.record.titles.length > 2 ? ' 외 ' + (st.record.titles.length - 2) : '') + '</span></div>' : '') +
      '<div class="muted small" style="margin-top:6px">배경: ' + esc(p.bg.name) + ' · 성격: ' + esc(p.personality.join('·')) + '</div></div>';
  }

  // ---------- 허브 ----------
  var ACTS = [
    { id: 'train', t: '훈련', d: '집중 능력치 2개 성장 · 솔랭 15판' },
    { id: 'solo', t: '솔로랭크 집중', d: '집중 1개 · 솔랭 35판' },
    { id: 'stream', t: '방송', d: '인지도 + · 집중 1개 · 솔랭 10판' },
    { id: 'rest', t: '휴식', d: '성장 없음 · 슬럼프·부상 회복' }
  ];
  function focusChips(sel, n, dataKey) {
    return '<div class="chips" data-focus="' + dataKey + '">' + R.STATS.map(function (k) { return '<button class="chip' + (sel.indexOf(k) >= 0 ? ' on' : '') + '" data-k="' + k + '">' + R.STAT_SHORT[k] + '</button>'; }).join('') + '</div>';
  }
  function hub(st) {
    var sp = st.prefs.speed, man = sp.manual || (sp.manual = { action: 'train', focus: ['lan', 'phy'] }), plan = sp.plan;
    var html = '<div class="card hub"><h3>이번 주 (' + st.date + ')</h3><div class="seg" data-seg="mode"><button data-v="manual" class="' + (sp.mode === 'manual' ? 'on' : '') + '">수동 (한 주씩)</button><button data-v="auto" class="' + (sp.mode === 'auto' ? 'on' : '') + '">자동 진행</button></div><div style="height:10px"></div>';
    if (sp.mode === 'manual') {
      html += '<div class="actions">' + ACTS.map(function (a) { return '<button class="act' + (man.action === a.id ? ' on' : '') + '" data-act="' + a.id + '"><b>' + a.t + '</b><span>' + a.d + '</span></button>'; }).join('') + '</div>';
      if (man.action !== 'rest') html += '<div style="margin-top:10px"><div class="muted small" style="margin-bottom:4px">집중 능력치 ' + (man.action === 'train' ? '(2개)' : '(1개)') + '</div>' + focusChips(man.focus, man.action === 'train' ? 2 : 1, 'manual') + '</div>';
      html += '<div style="margin-top:12px"><button class="btn block" id="go-week">이번 주 진행</button></div>';
    } else {
      html += '<label class="f">기간</label><select id="auto-span">' + [['1', '1주'], ['4', '4주'], ['12', '12주'], ['match', '다음 경기까지'], ['season', '다음 시즌까지']].map(function (o) { return '<option value="' + o[0] + '"' + (String(sp.span) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
      html += '<label class="f" style="margin-top:10px">자동 계획</label><div class="actions">' + ACTS.map(function (a) { return '<button class="act' + (plan.action === a.id ? ' on' : '') + '" data-plan="' + a.id + '"><b>' + a.t + '</b></button>'; }).join('') + '</div>';
      html += '<div style="margin-top:8px"><label class="checks" style="display:flex;gap:6px"><input type="checkbox" id="plan-auto"' + (plan.auto ? ' checked' : '') + '> 가장 낮은 능력치 자동 집중</label></div>';
      if (!plan.auto && plan.action !== 'rest') html += '<div style="margin-top:8px">' + focusChips(plan.focus, plan.action === 'train' ? 2 : 1, 'plan') + '</div>';
      var s = st.prefs.stops;
      html += '<label class="f" style="margin-top:10px">멈춤 조건</label><div class="checks">' +
        '<label><input type="checkbox" checked disabled> 선택 대기 이벤트</label>' +
        [['match', '공식 경기 주'], ['grade', '능력치 등급 상승'], ['tier', '티어 변화'], ['season', '시즌 종료'], ['weekly', '매 주 요약 보기']].map(function (o) { return '<label><input type="checkbox" data-stop="' + o[0] + '"' + (s[o[0]] ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('') + '</div>';
      html += '<div style="margin-top:12px"><button class="btn block" id="go-auto">자동 진행 시작</button></div>';
    }
    return html + '</div>';
  }

  // ---------- 피드 ----------
  var KIND_KO = { match: '경기', event: '이벤트', week: '주간', league: '리그', stove: '스토브', retire: '은퇴', contract: '계약', role: '역할', trait: '특성', aging: '에이징', career: '커리어', season: '시즌', start: '시작', adapt: '적응', digest: '요약' };
  var RES_KO = { critS: '대성공', S: '성공', F: '실패', critF: '대실패' };
  function feedItem(e) {
    if (e.kind === 'adapt') return '';
    if (e.kind === 'week' && e.oneLine) return '<div class="item"><div class="one"><span class="d">' + e.date + '</span> ' + esc(e.text) + '</div></div>';
    var extra = '';
    if (e.kind === 'match' && e.facts && e.facts.sets) {
      extra = '<details><summary>장면별 결과 보기</summary>' + e.facts.sets.map(function (s, i) {
        return '<div style="margin-top:6px"><b>' + (i + 1) + '세트 ' + (s.win ? '승' : '패') + '</b> · ' + esc(s.champ) + ' vs ' + esc(s.vs) + ' · ' + s.kda + (s.pom ? ' · POM' : '') + ' · ' + s.dur + '분' +
          s.scenes.map(function (sc) { return '<div class="sc"><span>' + esc(sc.l) + '</span><span class="muted">성공률 ' + sc.rate + '% · 주사위 ' + sc.roll + '</span><span class="res-' + sc.r + '">' + RES_KO[sc.r] + '</span></div>'; }).join('') + '</div>';
      }).join('') + '<div class="muted small" style="margin-top:6px">컨디션 ' + esc(e.facts.cond) + '</div></details>';
    }
    return '<div class="item"><div class="d"><span class="badge">' + (KIND_KO[e.kind] || e.kind) + '</span> ' + e.date + '</div><div class="t">' + esc(e.text) + '</div>' + extra + '</div>';
  }

  // ---------- 화면 ----------
  UI.renderGame = function (st) {
    var feed = st.feed.slice(-80).reverse().map(feedItem).join('');
    $('#main').innerHTML = statusCard(st) + hub(st) + '<div class="card feed"><h3>연대기</h3>' + (feed || '<div class="muted">아직 기록이 없습니다.</div>') + '</div>';
    $('#btn-menu').hidden = false; $('#btn-table').hidden = false;
  };

  UI.renderTitle = function (hasSave) {
    $('#main').innerHTML = '<div class="card stack"><h2>프로게이머가 되어 보세요</h2><p class="muted">15세 무소속 아마추어에서 출발해 아카데미, 2군, 1군 프로, 월즈까지. 모든 결과는 규칙과 주사위가 정하고, AI는 묘사만 합니다. AI 키가 없어도 끝까지 플레이됩니다.</p>' +
      '<button class="btn block" id="t-new">새 게임</button>' + (hasSave ? '<button class="btn sec block" id="t-cont">이어하기</button>' : '') +
      '<button class="btn ghost block" id="t-import">세이브 불러오기 (JSON)</button><button class="btn ghost block" id="t-set">AI 묘사 설정 (선택)</button></div>';
    $('#btn-menu').hidden = true; $('#btn-table').hidden = true;
  };

  // ---------- 생성 ----------
  UI.renderCreate = function (cbs) {
    var chosen = [], inp = { stats: { lan: 250, phy: 250, skr: 250, tf: 250, vis: 250 }, pos: 'MID', startYear: 2026, personality: [] };
    var yrs = ''; for (var y = 2013; y <= 2026; y++) yrs += '<option value="' + y + '"' + (y === 2026 ? ' selected' : '') + '>' + y + '년 1월</option>';
    $('#main').innerHTML = '<div class="card stack" id="cform"><h2>캐릭터 만들기</h2>' +
      '<div class="grid2"><div><label class="f">이름</label><input type="text" id="c-name" maxlength="20"></div><div><label class="f">닉네임</label><input type="text" id="c-nick" maxlength="16"></div></div>' +
      '<div class="grid2"><div><label class="f">포지션</label><select id="c-pos">' + R.POS.map(function (p) { return '<option value="' + p + '"' + (p === 'MID' ? ' selected' : '') + '>' + R.POS_KO[p] + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="f">시작 시점</label><select id="c-year">' + yrs + '</select></div></div>' +
      '<div><label class="f">5개 능력치 (0~500, 합계 제한 없음) — OVR <span id="c-ovr" class="ovr">250</span></label><div class="stack">' +
      R.STATS.map(function (k) { return '<div class="row"><span style="width:84px">' + R.STAT_SHORT[k] + '</span><input type="number" min="0" max="500" value="250" data-st="' + k + '" style="width:90px"><input type="range" min="0" max="500" value="250" data-sr="' + k + '" style="flex:1"></div>'; }).join('') + '</div>' +
      '<div class="muted small">높게 시작하면 스카우트가 빨리 오지만 나이 조건(리그 출전 만 17세)과 데뷔 적응 페널티는 그대로입니다.</div></div>' +
      '<div><label class="f">성격 키워드 (2~3개)</label><div class="chips" id="c-kw">' + R.PERSONALITY.map(function (k) { return '<button class="chip" data-kw="' + k + '">' + k + '</button>'; }).join('') + '</div></div>' +
      '<div><label class="f">시드 (비우면 무작위)</label><input type="text" id="c-seed" placeholder="같은 시드 = 같은 배경·히든 스탯"></div>' +
      '<div class="muted small" id="c-err"></div><button class="btn block" id="c-next">다음: 배경 고르기</button><button class="btn ghost block" id="c-back">처음으로</button></div>';
    var f = $('#cform');
    function readStats() { R.STATS.forEach(function (k) { inp.stats[k] = Math.max(0, Math.min(500, +f.querySelector('[data-st=' + k + ']').value || 0)); }); $('#c-ovr').textContent = R.ovr(inp.stats); }
    f.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.dataset.sr) { f.querySelector('[data-st=' + t.dataset.sr + ']').value = t.value; }
      if (t.dataset.st) { f.querySelector('[data-sr=' + t.dataset.st + ']').value = t.value; }
      readStats();
    });
    f.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-kw]');
      if (b) { var k = b.dataset.kw, i = chosen.indexOf(k); if (i >= 0) chosen.splice(i, 1); else if (chosen.length < 3) chosen.push(k); b.parentNode.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', chosen.indexOf(c.dataset.kw) >= 0); }); }
    });
    $('#c-back').onclick = cbs.back;
    $('#c-next').onclick = function () {
      readStats();
      var i2 = { name: $('#c-name').value, nick: $('#c-nick').value, pos: $('#c-pos').value, startYear: +$('#c-year').value, stats: inp.stats, personality: chosen.slice(), seed: $('#c-seed').value.trim() };
      var err = LP.create.validate(i2);
      if (err.length) { $('#c-err').textContent = err.join(' · '); return; }
      $('#c-err').textContent = '';
      cbs.next(i2);
    };
  };

  UI.chooseBackground = function (inp, offer, onPick) {
    var sel = null;
    var m = UI.modal({ title: '배경을 고르세요', body: '<p class="muted small">언변(2d6) ' + offer.speech + '/5. 히든 스탯은 비공개로 굴려집니다. 배경은 확정 후 바뀌지 않습니다.</p>' + offer.bgIds.map(function (id) {
      var b = R.BACKGROUNDS.filter(function (x) { return x.id === id; })[0];
      return '<div class="bg-card" data-bg="' + id + '"><div class="row between"><b>' + esc(b.name) + '</b><span class="badge">' + b.type + '형</span></div><div class="small muted" style="margin:4px 0">' + esc(b.story) + '</div>' +
        b.merits.map(function (e) { return '<div class="eff m">' + esc(R.effLabel(e)) + '</div>'; }).join('') + b.costs.map(function (e) { return '<div class="eff c">' + esc(R.effLabel(e)) + '</div>'; }).join('') + '</div>';
    }).join(''), buttons: [{ label: '이 배경으로 시작', disabled: true, onClick: function () { m.close(); onPick(sel); } }, { label: '취소', cls: 'ghost', onClick: function (a) { a.close(); } }] });
    m.body.addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-bg]'); if (!c) return;
      sel = c.dataset.bg; m.body.querySelectorAll('.bg-card').forEach(function (x) { x.classList.toggle('sel', x === c); });
      m.btns.firstChild.disabled = false;
    });
  };

  // ---------- 이벤트·경기 모달 ----------
  UI.eventModal = function (pend, onPick) {
    var m = UI.modal({ title: pend.title, body: '<p>' + esc(pend.text) + '</p>' + pend.options.map(function (o) { return '<button class="opt" data-o="' + o.id + '">' + esc(o.label) + '</button>'; }).join('') });
    m.body.addEventListener('click', function (ev) { var b = ev.target.closest('[data-o]'); if (b) { m.close(); onPick(b.dataset.o); } });
  };

  UI.matchModal = function (st, pend, onStart) {
    var pr = pend.prep, pick = 'auto';
    var kindKo = { reg: '정규', po: '플레이오프', msi: 'MSI', worlds: '월드 챔피언십' }[pend.series.kind] || '';
    var prefs = st.prefs;
    var lineup = pr.lineup.map(function (x) { return x.pos.charAt(0) + ' ' + esc(x.name) + ' ' + x.ovr; }).join(' · ');
    var body = '<div class="row between"><b>' + esc(pr.myName) + '</b><span class="muted">vs</span><b>' + esc(pr.oppName) + '</b></div>' +
      '<div class="muted small">' + esc(pr.name || '') + ' ' + kindKo + ' · Bo' + pr.bo + (pr.final ? ' · 결승' : '') + (pr.fearless ? ' · 피어리스' : '') + ' · 전력 ' + pr.myPower + ' vs ' + pr.oppPower + '</div>' +
      '<div class="muted small" style="margin-top:4px">상대 라인업: ' + lineup + '</div>' +
      (pr.banned.length ? '<div class="badge bad" style="margin-top:6px">상대가 ' + esc(LP.match.champKo(pr.banned[0])) + '을(를) 밴했습니다</div>' : '') +
      '<label class="f" style="margin-top:10px">챔피언 선택 (풀 안: 숙련 보정 없음 / 풀 밖 −15)</label>' +
      '<button class="opt sel" data-p="auto"><b>자동</b> <span class="muted small">풀에서 점수가 가장 높은 챔피언</span></button>' +
      pr.options.map(function (o) { return '<button class="opt' + (o.banned ? ' off' : '') + '" data-p="' + o.id + '"' + (o.banned ? ' disabled' : '') + '><b>' + esc(o.ko) + '</b> <span class="muted small">난이도 ' + o.diff + ' · ' + esc(o.curve) + ' · 메타 ' + o.tier + ' · 보정 ' + (o.score >= 0 ? '+' : '') + o.score + '</span></button>'; }).join('') +
      '<div class="row" style="margin-top:10px"><label class="checks" style="display:flex;gap:6px"><input type="checkbox" id="m-watch"' + (prefs.matchView === 'watch' ? ' checked' : '') + '> 관전 (미니맵·문자중계)</label></div>';
    var m = UI.modal({ title: '경기 준비', body: body, buttons: [{ label: '경기 시작', onClick: function (a) { var w = a.el.querySelector('#m-watch').checked; a.close(); onStart(pick, w); } }] });
    m.body.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-p]'); if (!b || b.disabled) return;
      pick = b.dataset.p; m.body.querySelectorAll('.opt').forEach(function (x) { x.classList.toggle('sel', x === b); });
    });
  };

  UI.resultModal = function (res, st, onClose) {
    var body = '<div class="row between"><b>' + esc(res.meName) + '</b><b style="font-size:20px">' + res.sMine + ' : ' + res.sOpp + '</b><b>' + esc(res.oppName) + '</b></div>' +
      '<div class="muted small">컨디션 ' + res.cond.label + ' (2d6=' + res.cond.roll + ')' + (res.adapt ? ' · 적응 ' + res.adapt.label + ' ' + res.adapt.pen : '') + '</div>' +
      res.sets.map(function (s, i) {
        return '<div class="card" style="margin-top:8px"><div class="row between"><b>' + (i + 1) + '세트 ' + (s.win ? '승리' : '패배') + (s.pom ? ' · POM' : '') + '</b><span class="muted small">' + esc(LP.match.champKo(s.myChamp)) + ' · ' + s.kda.k + '/' + s.kda.d + '/' + s.kda.a + ' · ' + s.dur + '분</span></div>' +
          s.scenes.map(function (sc) { return '<div class="sc small"><span>' + esc(sc.label) + '</span><span class="muted">' + sc.me + ' vs ' + sc.opp + ' → ' + sc.rate + '% · 주사위 ' + sc.roll + '</span><span class="res-' + sc.res + '">' + RES_KO[sc.res] + '</span></div>'; }).join('') + '</div>';
      }).join('');
    UI.modal({ title: res.winner === null ? '무승부' : (res.winner === (res.sMine > res.sOpp ? res.winner : null) ? '경기 결과' : '경기 결과'), body: body, buttons: [{ label: '확인', onClick: function (a) { a.close(); onClose && onClose(); } }] });
  };

  // ---------- 관전 ----------
  var MAP_SVG = '<svg class="map" viewBox="0 0 100 100" role="img" aria-label="미니맵">' +
    '<rect x="0" y="0" width="100" height="100" fill="color-mix(in srgb, var(--good) 10%, var(--surface2))"/>' +
    '<path d="M2 98 L98 2" stroke="color-mix(in srgb, var(--blue) 40%, transparent)" stroke-width="9" stroke-linecap="round" fill="none"/>' +
    '<polyline points="8,92 12,12 92,8" fill="none" stroke="var(--line)" stroke-width="3.4" stroke-linejoin="round"/>' +
    '<polyline points="8,92 88,88 92,8" fill="none" stroke="var(--line)" stroke-width="3.4" stroke-linejoin="round"/>' +
    '<line x1="8" y1="92" x2="92" y2="8" stroke="var(--line)" stroke-width="3.4"/>' +
    '<circle cx="8" cy="92" r="6" fill="var(--blue)" opacity=".35"/><circle cx="92" cy="8" r="6" fill="var(--red)" opacity=".35"/>' +
    '<circle cx="68" cy="68" r="2.4" fill="var(--warn)"/><circle cx="32" cy="32" r="2.8" fill="#8a55d6"/>' +
    '<g id="flash"><circle class="flash" cx="50" cy="50" r="3"/></g><g id="pieces"></g></svg>';

  UI.watch = function (st, res, opts, onDone) {
    var setIdx = 0, timer = null, fi = -1, playing = true, fast = opts.speed === 'fast', frames = [], pieces = [];
    var m = UI.modal({ title: '', body: '', onClose: function () { clearInterval(timer); } });
    function me(i) { return i === R.POS.indexOf(st.p.pos); }
    function build() {
      var set = res.sets[setIdx]; frames = set.frames; fi = -1;
      m.body.innerHTML = '<div class="watch-head"><div class="tm a">' + esc(res.meName) + '</div><div class="clk" id="w-clk">00:00</div><div class="tm b">' + esc(res.oppName) + '</div></div>' +
        '<div class="muted small" style="text-align:center">' + (setIdx + 1) + '세트 · ' + esc(LP.match.champKo(set.myChamp)) + ' vs ' + esc(LP.match.champKo(set.oppChamp)) + '</div>' +
        '<div class="goldbar"><div class="a" id="w-ga" style="width:50%"></div><div class="b"></div></div>' +
        '<div class="counts"><div id="w-ca"></div><div id="w-cm">골드</div><div id="w-cb"></div></div>' + MAP_SVG +
        '<div class="log" id="w-log"></div><div id="w-res"></div>';
      var g = m.body.querySelector('#pieces'); pieces = [];
      for (var i = 0; i < 10; i++) {
        var gi = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gi.setAttribute('class', 'piece ' + (i < 5 ? 'a' : 'b') + (me(i) ? ' me' : ''));
        gi.innerHTML = '<circle r="3.4" cx="0" cy="0"></circle><text>' + R.POS_LETTER[R.POS[i % 5]] + '</text>';
        gi.style.transform = 'translate(' + (i < 5 ? 8 : 92) + 'px,' + (i < 5 ? 92 : 8) + 'px)';
        g.appendChild(gi); pieces.push(gi);
      }
      m.el.querySelector('.map').classList.toggle('fast', fast);
      m.setButtons([
        { label: playing ? '일시정지' : '재생', cls: 'sec', onClick: function (a, e) { playing = !playing; e.textContent = playing ? '일시정지' : '재생'; } },
        { label: fast ? '속도: 빠르게' : '속도: 보통', cls: 'sec', onClick: function (a, e) { fast = !fast; e.textContent = fast ? '속도: 빠르게' : '속도: 보통'; m.el.querySelector('.map').classList.toggle('fast', fast); restart(); } },
        { label: '건너뛰기', cls: 'sec', onClick: function () { while (fi < frames.length - 1) show(fi + 1, true); } }
      ]);
      restart(); show(0);
    }
    function restart() { clearInterval(timer); timer = setInterval(function () { if (playing && fi < frames.length - 1) show(fi + 1); }, fast ? 450 : 1100); }
    function show(i, quiet) {
      fi = i; var f = frames[i];
      m.body.querySelector('#w-clk').textContent = f.clock;
      var tot = f.gold[0] + f.gold[1];
      m.body.querySelector('#w-ga').style.width = (tot ? f.gold[0] / tot * 100 : 50).toFixed(1) + '%';
      m.body.querySelector('#w-ca').textContent = '킬 ' + f.kills[0] + ' · 타워 ' + f.towers[0] + ' · 용 ' + f.dragons[0] + ' · ' + f.gold[0] + 'k';
      m.body.querySelector('#w-cb').textContent = f.gold[1] + 'k · 용 ' + f.dragons[1] + ' · 타워 ' + f.towers[1] + ' · 킬 ' + f.kills[1];
      pieces.forEach(function (g, k) {
        var p = f.pos[k]; g.style.transform = 'translate(' + p[0] + 'px,' + p[1] + 'px)';
        g.classList.toggle('dead', f.dead.indexOf(k) >= 0);
      });
      if (f.flash && !quiet) {
        var fl = m.body.querySelector('.flash'); fl.setAttribute('cx', f.flash.x); fl.setAttribute('cy', f.flash.y);
        fl.classList.remove('go'); void fl.getBoundingClientRect(); fl.classList.add('go');
      }
      var log = m.body.querySelector('#w-log'), ln = document.createElement('div');
      ln.className = 'ln ' + (f.cls || ''); ln.innerHTML = '<span class="c">' + f.clock + '</span>' + esc(f.text) + (f.detail ? '<span class="dt">' + esc(f.detail) + '</span>' : '');
      log.appendChild(ln); log.scrollTop = log.scrollHeight;
      if (i === frames.length - 1) finishSet();
    }
    function finishSet() {
      clearInterval(timer);
      var set = res.sets[setIdx], last = setIdx === res.sets.length - 1;
      m.body.querySelector('#w-res').innerHTML = '<div class="card" style="margin-top:8px"><b>' + (set.win ? '승리' : '패배') + '</b> · ' + set.kda.k + '/' + set.kda.d + '/' + set.kda.a + (set.pom ? ' · POM' : '') +
        '<div class="muted small" id="w-hl">' + (N.hasAI() ? '하이라이트를 정리하는 중…' : '') + '</div></div>';
      if (N.hasAI()) N.highlight(st, set).then(function (t) { var e = m.body.querySelector('#w-hl'); if (e) e.textContent = t || ''; });
      m.setButtons([{ label: last ? '결과 보기' : '다음 세트', onClick: function (a) { if (last) { a.close(); onDone(); } else { setIdx++; playing = true; build(); } } }]);
    }
    build();
  };

  // ---------- 메뉴·설정·순위 ----------
  UI.table = function (st) {
    var t = L.currentTable(st);
    UI.modal({ title: t ? t.name + ' 순위' : '순위', dismiss: true, body: t ? '<div class="small">' + t.rows.map(function (r, i) { return '<div class="kv"><span>' + (i + 1) + '. ' + esc(r.name) + (r.id === st.career.team ? ' ★' : '') + '</span><span>' + r.w + '승 ' + r.l + '패' + (r.d ? ' ' + r.d + '무' : '') + ' (' + (r.gd >= 0 ? '+' : '') + r.gd + ')</span></div>'; }).join('') + '</div>' : '<p class="muted">아직 순위가 없습니다.</p>', buttons: [{ label: '닫기', cls: 'ghost', onClick: function (a) { a.close(); } }] });
  };

  UI.settings = function (st, onSave) {
    var s = N.getSettings(), pr = st ? st.prefs : null;
    var body = '<h3 class="muted small">AI 묘사 (선택) — 키가 없으면 템플릿 문장을 씁니다</h3><label class="f">제공자</label><select id="s-prov">' + Object.keys(N.PRESETS).map(function (k) { return '<option value="' + k + '"' + (s.provider === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
      '<label class="f" style="margin-top:8px">Base URL</label><input type="text" id="s-url" value="' + esc(s.baseUrl) + '"><label class="f" style="margin-top:8px">API 키 (이 기기 브라우저에만 저장)</label><input type="text" id="s-key" value="' + esc(s.apiKey) + '" autocomplete="off"><label class="f" style="margin-top:8px">모델</label><input type="text" id="s-model" value="' + esc(s.model) + '" placeholder="' + (s.provider === 'anthropic' ? 'claude-opus-5-5' : '모델 ID') + '">';
    if (pr) body += '<h3 class="muted small" style="margin-top:14px">경기 보기</h3><label class="f">관전</label><select id="s-watch">' + [['all', '내 경기 전부'], ['important', '중요 경기만 (플레이오프·국제대회)'], ['none', '결과만']].map(function (o) { return '<option value="' + o[0] + '"' + (pr.watch === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<label class="f" style="margin-top:8px">관전 속도</label><select id="s-speed"><option value="normal"' + (pr.watchSpeed === 'normal' ? ' selected' : '') + '>보통</option><option value="fast"' + (pr.watchSpeed === 'fast' ? ' selected' : '') + '>빠르게</option></select>';
    var m = UI.modal({ title: '설정', body: body, buttons: [{ label: '저장', onClick: function (a) {
      var o = { provider: a.el.querySelector('#s-prov').value, baseUrl: a.el.querySelector('#s-url').value.trim(), apiKey: a.el.querySelector('#s-key').value.trim(), model: a.el.querySelector('#s-model').value.trim() };
      N.saveSettings(o);
      if (pr) { pr.watch = a.el.querySelector('#s-watch').value; pr.watchSpeed = a.el.querySelector('#s-speed').value; }
      a.close(); onSave && onSave(); UI.toast('설정을 저장했습니다');
    } }, { label: '닫기', cls: 'ghost', onClick: function (a) { a.close(); } }] });
    m.el.querySelector('#s-prov').addEventListener('change', function (e) {
      var pz = N.PRESETS[e.target.value]; m.el.querySelector('#s-url').value = pz.baseUrl; if (pz.model) m.el.querySelector('#s-model').value = pz.model;
    });
  };

  LP.ui = UI;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
