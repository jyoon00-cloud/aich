/* ui.js — 화면(SPEC 12.2). 데스크톱: 왼쪽 사이드바 + 탭, 모바일: 상단 한 줄 헤더 + 하단 탭 바.
   탭: 홈 / 일정 / 순위 / 선수 / 기록 (+ 메뉴). 엔진 호출은 main.js가 한다. */
(function (LP) {
  'use strict';
  var R = LP.rules, S = LP.state, L = LP.league, N = LP.narrate;
  var UI = {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  UI.esc = esc;
  function sg(n) { return (n > 0 ? '+' : '') + n; }
  function pct(a, b) { return b ? Math.round(a / b * 100) + '%' : '-'; }
  function md(d) { return d ? d.slice(5) : ''; }
  var POS_KO = R.POS_KO;

  var toastTimer;
  UI.toast = function (msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  };

  // ---------- 모달 ----------
  var stack = [];
  UI.modal = function (o) {
    var ov = document.createElement('div'); ov.className = 'overlay';
    var m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.innerHTML = (o.title ? '<h2>' + esc(o.title) + '</h2>' : '') + '<div class="mbody">' + (o.body || '') + '</div><div class="mbtns"></div>';
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
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && stack.length) { var top = stack[stack.length - 1]; if (top.el.dataset.dismiss === '1') top.close(); } });

  // ---------- 화면 상태 ----------
  var view = { tab: 'home', rankLg: null, rankSeg: null, logF: 'all', logN: 60 };
  try { var tsv = localStorage.getItem('lp2_tab'); if (tsv) view.tab = tsv; } catch (e) { }
  UI.view = view;
  UI.setView = function (o) { for (var k in o) view[k] = o[k]; if (o.tab) { try { localStorage.setItem('lp2_tab', o.tab); } catch (e) { } } };
  var TABS = [['home', '홈'], ['sched', '일정'], ['rank', '순위'], ['player', '선수'], ['log', '기록']];

  // ---------- 공통 조각 ----------
  function teamLine(st) {
    var c = st.career, team = c.team ? L.teamName(st, c.team) : null;
    if (c.fa) return 'FA';
    return (team ? team + ' · ' : '') + R.STAGE_KO[c.stage] + (c.contract && (c.stage === 'cl' || c.stage === 'pro') ? ' · ' + (c.contract.role === 'starter' ? '주전' : '후보') : '');
  }
  function statBars(p) {
    return R.STATS.map(function (k) { return '<div class="mb"><span>' + R.STAT_SHORT[k] + '</span><span class="trk"><i style="width:' + (p.stats[k] / 5) + '%"></i></span><span class="v">' + p.stats[k] + '</span></div>'; }).join('');
  }
  function sideHtml(st) {
    var p = st.p, ovr = R.ovr(p.stats), flags = [];
    if (p.status.injury > 0) flags.push('<span class="tagx bad">부상 ' + p.status.injury + '주</span>');
    if (p.status.slump > 0) flags.push('<span class="tagx warn">슬럼프 ' + p.status.slump + '주</span>');
    return '<div><div class="nm">' + esc(p.nick) + '</div><div class="sub">' + esc(p.name) + ' · ' + POS_KO[p.pos] + ' · 만 ' + S.age(st) + '세</div><div class="sub">' + esc(teamLine(st)) + '</div></div>' +
      '<div class="ovr-row"><span class="muted small">OVR</span><span class="big">' + ovr + '</span></div>' +
      '<div>' + statBars(p) + '</div>' +
      (flags.length ? '<div class="row">' + flags.join('') + '</div>' : '') +
      '<div class="small muted">' + st.date + ' (' + S.dow(st.date) + ') · ' + (st.week + 1) + '주차</div>' +
      '<div class="grow"></div><div class="foot"><button class="btn sec" id="btn-menu-side">메뉴</button></div>';
  }
  function tabsHtml() {
    return TABS.map(function (t) { return '<button data-tab="' + t[0] + '"' + (view.tab === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + '</button>'; }).join('') + '<button id="btn-menu">메뉴</button>';
  }

  // ---------- 홈 ----------
  var ACTS = [
    { id: 'train', t: '훈련', d: '집중 능력치 2개 성장 · 솔랭 ' + R.SOLO_GAMES.train + '판' },
    { id: 'solo', t: '솔랭 집중', d: '집중 능력치 1개 성장 · 솔랭 ' + R.SOLO_GAMES.solo + '판' },
    { id: 'stream', t: '방송', d: '인지도 상승 · 집중 1개 · 솔랭 ' + R.SOLO_GAMES.stream + '판' },
    { id: 'rest', t: '휴식', d: '성장 없음 · 슬럼프·부상 회복' }
  ];
  function nextCard(st) {
    var up = L.upcoming(st), nm = null, i;
    for (i = 0; i < up.length; i++) if (up[i].kind === 'match') { nm = up[i]; break; }
    var cur = null;
    for (i = 0; i < up.length; i++) if (up[i].kind === 'period' && up[i].date <= S.addDays(st.date, 6)) { cur = up[i]; break; }
    var html = '<div class="panel next-card"><div class="hd"><h3>다음 일정</h3><span class="small muted">' + esc(L.phaseLabel(st)) + '</span></div>';
    if (nm) {
      var wk = Math.max(0, Math.round(S.diffDays(st.date, nm.date) / 7));
      html += '<div class="when">' + md(nm.date) + ' 주 · ' + (wk === 0 ? '이번 주' : wk + '주 후') + ' · ' + esc(nm.name) + (nm.note ? ' ' + esc(nm.note) : '') + ' · Bo' + nm.bo + '</div><div class="what">vs ' + esc(nm.opp) + '</div>';
      var up2 = up.filter(function (x) { return x.kind === 'match' && x !== nm; }).slice(0, 2);
      if (up2.length) html += '<div class="small muted">이후 ' + up2.map(function (x) { return md(x.date) + ' ' + esc(x.opp); }).join(' · ') + '</div>';
    } else if (cur) {
      html += '<div class="what">' + esc(cur.name) + '</div><div class="when">' + md(cur.date) + ' ~ ' + md(cur.end) + (cur.note ? ' · ' + cur.note : '') + '</div>';
    } else {
      var f = up[0];
      html += f ? '<div class="when">' + md(f.date) + ' 시작</div><div class="what">' + esc(f.name) + '</div>' : '<div class="muted">예정된 일정이 없습니다.</div>';
    }
    if (st.career.stage === 'amateur' || st.career.stage === 'academy') html += '<div class="small muted" style="margin-top:8px">1군·2군 소속이 되면 내 경기 일정이 표시됩니다.</div>';
    return html + '</div>';
  }
  function focusChips(man) {
    var n = man.action === 'train' ? 2 : 1;
    return '<div class="chips" data-focus="manual">' + R.STATS.map(function (k) { return '<button class="chip' + (!man.auto && man.focus.indexOf(k) >= 0 ? ' on' : '') + '" data-k="' + k + '">' + R.STAT_SHORT[k] + '</button>'; }).join('') +
      '<button class="chip' + (man.auto ? ' on' : '') + '" data-k="auto" title="가장 낮은 능력치를 자동으로 집중">낮은 순 자동</button></div>' +
      '<div class="note" style="margin-top:4px">집중 ' + n + '개' + (man.auto ? ' · 가장 낮은 능력치를 자동으로 고릅니다' : '') + '</div>';
  }
  function homeTab(st) {
    var sp = st.prefs.speed, man = sp.manual || (sp.manual = { action: 'train', focus: ['lan', 'phy'], auto: false });
    var act = ACTS.filter(function (a) { return a.id === man.action; })[0];
    var html = nextCard(st);
    html += '<div class="panel"><div class="hd"><h3>이번 주 행동</h3><span class="small muted">' + st.date + ' · ' + (st.week + 1) + '주차</span></div>' +
      '<div class="seg" data-seg="act">' + ACTS.map(function (a) { return '<button data-act="' + a.id + '" class="' + (man.action === a.id ? 'on' : '') + '">' + a.t + '</button>'; }).join('') + '</div>' +
      '<div class="note" style="margin:6px 0 12px">' + act.d + '</div>' +
      (man.action !== 'rest' ? '<div style="margin-bottom:16px">' + focusChips(man) + '</div>' : '') +
      '<div class="go"><button class="btn" id="go-week">진행</button><select id="auto-go" aria-label="자동 진행"><option value="">자동 진행</option><option value="1">1주</option><option value="4">4주</option><option value="match">다음 경기까지</option><option value="season">시즌 끝까지</option></select></div>' +
      '<div class="note" style="margin-top:8px">자동 진행은 위에서 고른 행동으로 이어서 진행합니다. 멈춤 조건은 메뉴의 설정에서 바꿉니다.</div></div>';
    var recent = st.feed.filter(function (e) { return e.kind !== 'adapt'; }).slice(-5).reverse();
    html += '<div class="panel"><div class="hd"><h3>최근 소식</h3><button class="link small" data-tab="log" style="min-height:24px">전체 기록</button></div>' +
      (recent.length ? '<ul class="news">' + recent.map(function (e) { return '<li><span class="d">' + md(e.date) + '</span><span class="s">' + esc(oneLine(e)) + '</span></li>'; }).join('') + '</ul>' : '<div class="muted">아직 기록이 없습니다.</div>') + '</div>';
    return html;
  }

  // ---------- 일정 ----------
  function schedTab(st) {
    var year = +st.date.slice(0, 4), past = st.record.log.filter(function (x) { return x.date.slice(0, 4) === String(year); });
    var up = L.upcoming(st), firstMatch = true, rows = [];
    past.forEach(function (x) { rows.push({ date: x.date, name: x.name, opp: x.opp, res: (x.draw ? '무 ' : x.win ? '승 ' : '패 ') + x.score, cls: x.win ? 'good' : x.draw ? '' : 'bad', past: true, bo: x.bo }); });
    up.forEach(function (x) {
      if (x.kind === 'match') { rows.push({ date: x.date, name: x.name + (x.note ? ' · ' + x.note : ''), opp: x.opp, res: 'Bo' + x.bo, next: firstMatch }); firstMatch = false; }
      else rows.push({ date: x.date, name: x.name, opp: md(x.date) + ' ~ ' + md(x.end), res: x.note || '', period: true });
    });
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var html = '<div class="panel"><div class="hd"><h3>' + year + '년 일정</h3><span class="small muted">' + esc(teamLine(st)) + '</span></div>';
    if (!rows.length) html += '<div class="muted">표시할 일정이 없습니다.</div>';
    else html += '<table class="t fixed"><colgroup><col style="width:58px"><col><col style="width:30%"><col style="width:64px"></colgroup><thead><tr><th>날짜</th><th>대회</th><th>상대·기간</th><th class="n">결과</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr class="' + (r.next ? 'next' : '') + '"><td class="nw">' + md(r.date) + '</td><td class="ell">' + esc(r.name) + '</td><td class="ell ' + (r.period ? 'muted' : '') + '">' + esc(r.opp) + '</td><td class="n ' + (r.cls || '') + (r.period ? ' muted' : '') + '">' + esc(r.res) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="note" style="margin-top:8px">날짜는 해당 경기가 열리는 주의 시작일입니다. 굵게 표시된 줄이 다음 경기입니다.</div>';
    return html + '</div>';
  }

  // ---------- 순위 ----------
  function rankTab(st) {
    var c = st.career, lg = view.rankLg || c.league || 'LCK', tier = (c.stage === 'cl' && lg === c.league) ? 'cl' : 'pro';
    var tabs = L.tables(st, lg, tier), cur = null, i;
    for (i = 0; i < tabs.length; i++) if (tabs[i].key === view.rankSeg) cur = tabs[i];
    if (!cur) { for (i = 0; i < tabs.length; i++) if (tabs[i].started && tabs[i].rows) cur = tabs[i]; if (!cur) cur = tabs[0]; }
    var html = '<div class="panel"><div class="hd"><h3>순위</h3></div><div class="seg" data-seg="lg" style="margin-bottom:12px">' +
      R.LEAGUES.map(function (l) { return '<button data-lg="' + l + '" class="' + (l === lg ? 'on' : '') + '">' + l + '</button>'; }).join('') + '</div>';
    if (tabs.length > 1) html += '<div class="chips" style="margin-bottom:12px">' + tabs.map(function (t) { return '<button class="chip' + (cur && t.key === cur.key ? ' on' : '') + '" data-seg-key="' + esc(t.key) + '">' + esc(t.name) + '</button>'; }).join('') + '</div>';
    if (cur) {
      html += '<div class="hd"><span class="strong">' + (cur.name.indexOf(lg) === 0 ? '' : lg + ' ') + esc(cur.name) + (tier === 'cl' ? ' (2군)' : '') + '</span><span class="small muted">' + cur.status + ' · ' + md(cur.start) + ' ~ ' + md(cur.end) + '</span></div>';
      if (cur.rows) html += '<table class="t fixed"><colgroup><col style="width:36px"><col><col style="width:72px"><col style="width:56px"></colgroup><thead><tr><th>순위</th><th>팀</th><th class="n">승-패</th><th class="n">세트 득실</th></tr></thead><tbody>' +
        cur.rows.map(function (r, i) { return '<tr class="' + (r.id === c.team || r.id === (c.team && st.world.teams[c.team] && st.world.teams[c.team].cl) ? 'me' : '') + '"><td>' + (i + 1) + '</td><td class="ell">' + esc(r.name) + '</td><td class="n">' + r.w + '-' + r.l + '</td><td class="n">' + sg(r.gd) + '</td></tr>'; }).join('') + '</tbody></table>';
      else html += '<div class="muted">아직 경기가 없습니다.</div>';
    } else html += '<div class="muted">이 리그의 정규 대회 정보가 없습니다.</div>';
    html += '</div>';
    var hist = L.yearHistory(st);
    if (hist.length) html += '<div class="panel"><h3>' + st.date.slice(0, 4) + '년 플레이오프·국제대회 결과</h3><table class="t"><thead><tr><th>대회</th><th>우승</th><th>준우승</th></tr></thead><tbody>' +
      hist.map(function (h) { return '<tr><td>' + esc(h.name) + (h.tier === 'cl' ? ' (2군)' : '') + '</td><td>' + esc(h.champion) + '</td><td>' + esc(h.runnerUp) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    return html;
  }

  // ---------- 선수 ----------
  function recentChange(st, k) {
    var from = S.addDays(st.date, -28), sum = 0;
    st.growthLog.forEach(function (g) { if (g[1] === k && g[0] >= from) sum += g[2]; });
    return sum;
  }
  function playerTab(st) {
    var p = st.p, c = st.career, q = st.soloq, ovr = R.ovr(p.stats), html = '';
    html += '<div class="panel"><div class="hd"><h3>능력치</h3><span class="small muted">OVR <span class="strong">' + ovr + '</span></span></div><table class="t"><thead><tr><th>능력치</th><th class="n">값</th><th>등급</th><th class="hide-m" style="width:30%"></th><th class="n">최근 4주</th></tr></thead><tbody>' +
      R.STATS.map(function (k) { var d = recentChange(st, k); return '<tr><td class="nw">' + R.STAT_SHORT[k] + '</td><td class="n strong">' + p.stats[k] + '</td><td class="nw">' + R.gradeName(p.stats[k]) + '</td><td class="hide-m"><span class="bar"><i style="width:' + (p.stats[k] / 5) + '%"></i></span></td><td class="n ' + (d > 0 ? 'good' : d < 0 ? 'bad' : 'muted') + '">' + (d ? sg(d) : '0') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    // 숙련도
    var yr = +st.date.slice(0, 4), us = p.usage && p.usage.year === yr ? p.usage.c : {};
    var ids = Object.keys(p.mastery).sort(function (a, b) { return (p.sig.indexOf(b) >= 0) - (p.sig.indexOf(a) >= 0) || p.mastery[b] - p.mastery[a]; }).slice(0, 15);
    html += '<div class="panel"><div class="hd"><h3>챔피언 숙련도</h3><span class="small muted">시그니처 ' + p.sig.length + '/' + R.SIG_MAX + ' · 상위 ' + ids.length + '개</span></div><table class="t fixed"><colgroup><col style="width:34%"><col><col style="width:76px"></colgroup><thead><tr><th>챔피언</th><th>숙련</th><th class="n">시즌 사용</th></tr></thead><tbody>' +
      ids.map(function (id) {
        var c0 = LP.data.db.champs[id], u = us[id] || [0, 0], isSig = p.sig.indexOf(id) >= 0, pt = st.patched && st.patched[id] && st.patched[id] >= st.date;
        return '<tr><td>' + esc(c0 ? c0.ko : id) + (isSig ? '<br><span class="tagx sig">시그니처</span>' : '') + (pt ? ' <span class="tagx warn">약화</span>' : '') + '</td><td><div class="row" style="flex-wrap:nowrap"><span class="bar" style="flex:1"><i style="width:' + p.mastery[id] + '%"></i></span><span class="strong" style="width:24px;text-align:right">' + p.mastery[id] + '</span></div></td><td class="n">' + (u[0] ? u[0] + '판 ' + pct(u[1], u[0]) : '-') + '</td></tr>';
      }).join('') + '</tbody></table><div class="note" style="margin-top:8px">숙련 50 미만은 풀 밖으로 봅니다. 8주 넘게 쓰지 않으면 조금씩 줄어듭니다.</div></div>';
    // 계약·상태
    html += '<div class="panel"><h3>계약·상태</h3>' +
      '<div class="kv"><span>소속</span><span>' + esc(teamLine(st)) + '</span></div>' +
      '<div class="kv"><span>계약</span><span>' + (c.contract ? R.fmtMoney(c.contract.salary) + ' · ~' + c.contract.end.slice(0, 7) : '없음') + '</span></div>' +
      '<div class="kv"><span>자산</span><span>' + R.fmtMoney(c.money) + '</span></div>' +
      '<div class="kv"><span>인지도 / 여론</span><span>' + st.fame + ' / ' + sg(st.community) + '</span></div>' +
      '<div class="kv"><span>배경</span><span>' + esc(p.bg.name) + '</span></div>' +
      '<div class="kv"><span>성격</span><span>' + esc(p.personality.join(' · ')) + '</span></div>' +
      '<div class="kv"><span>특성</span><span>' + (p.traits.length ? p.traits.map(function (t) { return esc(R.traitName(t)); }).join(', ') : '없음') + '</span></div>' +
      (p.status.injury > 0 ? '<div class="kv"><span>부상</span><span class="bad">' + p.status.injury + '주 남음</span></div>' : '') +
      (p.status.slump > 0 ? '<div class="kv"><span>슬럼프</span><span class="warn">' + p.status.slump + '주 남음</span></div>' : '') + '</div>';
    // 솔로랭크
    var tinfo = R.tierInfo(q.mmr);
    html += '<div class="panel"><div class="hd"><h3>솔로랭크</h3><span class="small muted">' + (q.season || yr) + ' 시즌</span></div>' +
      '<div class="kv"><span>티어</span><span class="strong">' + tinfo.text + '</span></div>' +
      '<div class="kv"><span>이번 시즌 전적</span><span>' + q.w + '승 ' + q.l + '패 (' + pct(q.w, q.w + q.l) + ')</span></div>' +
      '<div class="kv"><span>누적 전적</span><span>' + (q.totW || 0) + '승 ' + (q.totL || 0) + '패</span></div>' +
      '<div class="note" style="margin-top:4px">매년 1월 1일에 전적이 초기화되고 MMR이 평균 쪽으로 조금 당겨집니다.</div></div>';
    // 커리어 기록
    var rec = st.record, cur = rec.seas, seasons = rec.seasons.slice().reverse();
    html += '<div class="panel"><h3>커리어 기록</h3><table class="t"><thead><tr><th>시즌</th><th>소속</th><th class="n">공식전</th><th>솔랭 최종</th></tr></thead><tbody>' +
      '<tr class="me"><td>' + yr + '</td><td class="ell">' + esc(c.team ? L.teamName(st, c.team) : '무소속') + '</td><td class="n">' + cur.w + '-' + cur.l + '</td><td>' + tinfo.text + ' (진행 중)</td></tr>' +
      seasons.map(function (s) { return '<tr><td>' + s.year + '</td><td class="ell">' + esc(s.team) + '</td><td class="n">' + s.w + '-' + s.l + '</td><td>' + esc(s.tier) + '</td></tr>' + (s.titles && s.titles.length ? '<tr><td></td><td colspan="3" class="small muted">' + esc(s.titles.join(', ')) + '</td></tr>' : ''); }).join('') + '</tbody></table>' +
      '<div class="kv" style="margin-top:8px"><span>통산 공식전</span><span>' + rec.official.w + '승 ' + rec.official.l + '패 · 스크림 ' + rec.scrim.w + '-' + rec.scrim.l + '</span></div>' +
      (rec.titles.length ? '<div class="kv"><span>타이틀</span><span>' + esc(rec.titles.join(', ')) + '</span></div>' : '') + '</div>';
    return html;
  }

  // ---------- 기록 ----------
  function oneLine(e) {
    var f = e.facts || {};
    switch (e.kind) {
      case 'match': return (f.draw ? '무' : f.win ? '승' : '패') + ' ' + (f.name || '') + ' vs ' + f.opp + ' ' + f.score + (f.mvp ? ' · 시리즈 MVP' : '');
      case 'week': return e.text;
      case 'event': return f.title + (f.choice ? ' → ' + f.choice : '');
      case 'season': return f.year + '년 시즌 결산 · ' + f.record.w + '승 ' + f.record.l + '패';
      case 'start': return '커리어 시작';
      case 'adapt': return '';
    }
    var t = (e.text || '').replace(/\s+/g, ' ');
    var i = t.search(/[.!?](\s|$)/);
    if (i > 0 && i < 70) return t.slice(0, i + 1);
    return t.length > 70 ? t.slice(0, 68) + '…' : t;
  }
  UI.oneLine = oneLine;
  function setsTable(f) {
    if (!f.sets) return '';
    return '<table class="t fixed sb"><colgroup><col style="width:9%"><col style="width:10%"><col style="width:30%"><col style="width:18%"><col style="width:14%"><col style="width:19%"></colgroup><thead><tr><th>세트</th><th>결과</th><th>챔피언</th><th>KDA</th><th class="n">시간</th><th>상대</th></tr></thead><tbody>' +
      f.sets.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td class="' + (s.win ? 'good' : 'bad') + ' strong">' + (s.win ? '승' : '패') + '</td><td class="ell">' + esc(s.champ) + (s.pom ? ' <span class="tagx">POM</span>' : '') + '</td><td>' + s.kda + '</td><td class="n nw">' + s.dur + '분</td><td class="ell">' + esc(s.vs) + '</td></tr>'; }).join('') + '</tbody></table>';
  }
  function logTab(st) {
    var fl = view.logF, list = st.feed.filter(function (e) {
      if (e.kind === 'adapt') return false;
      if (fl === 'match') return e.kind === 'match';
      if (fl === 'event') return ['event', 'contract', 'trait', 'role', 'career', 'aging', 'stove', 'retire', 'league', 'season', 'start'].indexOf(e.kind) >= 0;
      if (fl === 'week') return e.kind === 'week';
      return true;
    }).reverse();
    var shown = list.slice(0, view.logN);
    var html = '<div class="panel"><div class="hd"><h3>연대기</h3><span class="small muted">' + list.length + '건</span></div><div class="chips" style="margin-bottom:8px">' +
      [['all', '전체'], ['match', '경기'], ['event', '이벤트·계약'], ['week', '주간']].map(function (o) { return '<button class="chip' + (fl === o[0] ? ' on' : '') + '" data-logf="' + o[0] + '">' + o[1] + '</button>'; }).join('') + '</div>';
    if (!shown.length) html += '<div class="muted">기록이 없습니다.</div>';
    html += shown.map(function (e) {
      var one = oneLine(e);
      if (e.kind === 'week') return '<div class="lg oneline"><div class="sm"><span class="d">' + e.date + '</span><span class="s">' + esc(one) + '</span></div></div>';
      var body = '';
      if (e.text && e.text !== one) body += '<p>' + esc(e.text) + '</p>';
      if (e.kind === 'match') body += setsTable(e.facts);
      return '<details class="lg"><summary><span class="d">' + e.date + '</span><span class="s">' + esc(one) + '</span></summary><div class="body">' + (body || '<p>' + esc(e.text) + '</p>') + '</div></details>';
    }).join('');
    if (list.length > shown.length) html += '<button class="btn sec block" id="log-more" style="margin-top:8px">더 보기</button>';
    return html + '</div>';
  }

  // ---------- 화면 조립 ----------
  UI.renderGame = function (st) {
    document.body.dataset.mode = 'game';
    $('#side').innerHTML = sideHtml(st);
    $('#mhead').innerHTML = '<span class="l">' + md(st.date) + ' · ' + esc(st.career.team ? L.teamName(st, st.career.team) : R.STAGE_KO[st.career.stage]) + '</span><span class="r">OVR ' + R.ovr(st.p.stats) + '</span>';
    $('#tabs').innerHTML = tabsHtml();
    var fn = { home: homeTab, sched: schedTab, rank: rankTab, player: playerTab, log: logTab }[view.tab] || homeTab;
    $('#main').innerHTML = fn(st);
  };
  UI.renderTitle = function (hasSave) {
    document.body.dataset.mode = 'plain';
    $('#main').innerHTML = '<div class="panel stack"><h2>롤프로 시뮬레이터</h2><p class="muted">15세 무소속 아마추어에서 출발해 아카데미, 2군, 1군 프로, 월즈까지. 모든 결과는 규칙이 정하고 AI는 묘사만 합니다. AI 키가 없어도 끝까지 플레이됩니다.</p>' +
      '<button class="btn block" id="t-new">새 게임</button>' + (hasSave ? '<button class="btn sec block" id="t-cont">이어하기</button>' : '') +
      '<button class="btn sec block" id="t-import">세이브 불러오기 (JSON)</button><button class="btn ghost block" id="t-set">AI 묘사 설정 (선택)</button></div>';
  };

  // ---------- 생성 ----------
  UI.renderCreate = function (cbs) {
    document.body.dataset.mode = 'plain';
    var chosen = [], sig = [], inp = { stats: { lan: 250, phy: 250, skr: 250, tf: 250, vis: 250 }, pos: 'MID', startYear: 2026, personality: [] };
    var yrs = ''; for (var y = 2013; y <= 2026; y++) yrs += '<option value="' + y + '"' + (y === 2026 ? ' selected' : '') + '>' + y + '년 1월</option>';
    $('#main').innerHTML = '<div class="panel stack" id="cform"><h2>캐릭터 만들기</h2>' +
      '<div class="grid2"><div><label class="f" for="c-name">이름</label><input type="text" id="c-name" maxlength="20"></div><div><label class="f" for="c-nick">닉네임</label><input type="text" id="c-nick" maxlength="16"></div></div>' +
      '<div class="grid2"><div><label class="f" for="c-pos">포지션</label><select id="c-pos">' + R.POS.map(function (p) { return '<option value="' + p + '"' + (p === 'MID' ? ' selected' : '') + '>' + POS_KO[p] + '</option>'; }).join('') + '</select></div>' +
      '<div><label class="f" for="c-year">시작 시점</label><select id="c-year">' + yrs + '</select></div></div>' +
      '<div><label class="f">5개 능력치 (0~500, 합계 제한 없음) · OVR <span id="c-ovr" class="strong">250</span></label><div class="stack">' +
      R.STATS.map(function (k) { return '<div class="row" style="flex-wrap:nowrap"><span style="width:64px;flex:none">' + R.STAT_SHORT[k] + '</span><input type="number" min="0" max="500" value="250" data-st="' + k + '" style="width:88px;flex:none" aria-label="' + R.STAT_SHORT[k] + '"><input type="range" min="0" max="500" value="250" data-sr="' + k + '" style="flex:1;min-width:0;min-height:44px" aria-label="' + R.STAT_SHORT[k] + ' 슬라이더"></div>'; }).join('') + '</div>' +
      '<div class="note" style="margin-top:4px">높게 시작하면 스카우트가 빨리 오지만 나이 조건(리그 출전 만 17세)과 데뷔 적응 페널티는 그대로입니다.</div></div>' +
      '<div><label class="f">시그니처 챔피언 3개 <span id="c-sigc" class="strong">0/3</span> · 숙련 70으로 시작</label><div class="chips" id="c-sigsel" style="margin-bottom:8px"></div><input type="search" id="c-sigq" placeholder="챔피언 이름 검색" autocomplete="off"><div class="sig-list" id="c-siglist"></div>' +
      '<div class="note" style="margin-top:4px">내 포지션에 맞고 시작 시점에 출시된 챔피언만 보입니다. 나머지 숙련 챔피언은 자동으로 정해집니다.</div></div>' +
      '<div><label class="f">성격 키워드 (2~3개)</label><div class="chips" id="c-kw">' + R.PERSONALITY.map(function (k) { return '<button class="chip" data-kw="' + k + '">' + k + '</button>'; }).join('') + '</div></div>' +
      '<div><label class="f" for="c-seed">시드 (비우면 무작위)</label><input type="text" id="c-seed" placeholder="같은 시드 = 같은 배경·히든 스탯"></div>' +
      '<div class="note bad" id="c-err" role="alert"></div><button class="btn block" id="c-next">다음: 배경 고르기</button><button class="btn ghost block" id="c-back">처음으로</button></div>';
    var f = $('#cform');
    function readStats() { R.STATS.forEach(function (k) { inp.stats[k] = Math.max(0, Math.min(500, +f.querySelector('[data-st=' + k + ']').value || 0)); }); $('#c-ovr').textContent = R.ovr(inp.stats); }
    function sigPool() { return LP.mastery.sigChoices($('#c-pos').value, $('#c-year').value + '-01-01'); }
    function drawSig() {
      var pool = sigPool(), ids = pool.map(function (c) { return c.id; }), meta = LP.data.metaFor($('#c-year').value + '-01-01'), q = $('#c-sigq').value.trim().toLowerCase();
      sig = sig.filter(function (id) { return ids.indexOf(id) >= 0; });
      $('#c-sigc').textContent = sig.length + '/3';
      $('#c-sigsel').innerHTML = sig.map(function (id) { var c = LP.data.db.champs[id]; return '<button class="chip on" data-sigx="' + id + '" aria-label="' + esc(c.ko) + ' 선택 해제">' + esc(c.ko) + ' ×</button>'; }).join('');
      var list = pool.filter(function (c) { return !q || c.ko.toLowerCase().indexOf(q) >= 0 || (c.en || '').toLowerCase().indexOf(q) >= 0; });
      $('#c-siglist').innerHTML = list.length ? list.map(function (c) {
        return '<button data-sig="' + c.id + '" class="' + (sig.indexOf(c.id) >= 0 ? 'on' : '') + '"><span>' + esc(c.ko) + ' <span class="muted small">' + esc(c.en || '') + '</span></span><span class="small muted">' + (meta[c.id] ? '메타 ' + meta[c.id].tier : '') + '</span><span class="small muted">난이도 ' + c.diff + '</span></button>';
      }).join('') : '<div class="muted" style="padding:12px">검색 결과가 없습니다.</div>';
    }
    f.addEventListener('input', function (ev) {
      var t = ev.target;
      if (t.dataset.sr) { f.querySelector('[data-st=' + t.dataset.sr + ']').value = t.value; }
      if (t.dataset.st) { f.querySelector('[data-sr=' + t.dataset.st + ']').value = t.value; }
      if (t.id === 'c-sigq') drawSig();
      readStats();
    });
    f.addEventListener('change', function (ev) { if (ev.target.id === 'c-pos' || ev.target.id === 'c-year') { sig = []; drawSig(); } });
    f.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-kw]');
      if (b) { var k = b.dataset.kw, i = chosen.indexOf(k); if (i >= 0) chosen.splice(i, 1); else if (chosen.length < 3) chosen.push(k); b.parentNode.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('on', chosen.indexOf(c.dataset.kw) >= 0); }); return; }
      var s = ev.target.closest('[data-sig]');
      if (s) { var id = s.dataset.sig, j = sig.indexOf(id); if (j >= 0) sig.splice(j, 1); else if (sig.length < 3) sig.push(id); else UI.toast('시그니처는 3개까지입니다'); drawSig(); return; }
      var x = ev.target.closest('[data-sigx]');
      if (x) { sig.splice(sig.indexOf(x.dataset.sigx), 1); drawSig(); }
    });
    drawSig();
    $('#c-back').onclick = cbs.back;
    $('#c-next').onclick = function () {
      readStats();
      var i2 = { name: $('#c-name').value, nick: $('#c-nick').value, pos: $('#c-pos').value, startYear: +$('#c-year').value, stats: inp.stats, personality: chosen.slice(), sig: sig.slice(), seed: $('#c-seed').value.trim() };
      var err = LP.create.validate(i2);
      if (err.length) { $('#c-err').textContent = err.join(' · '); return; }
      $('#c-err').textContent = '';
      cbs.next(i2);
    };
  };

  var BG_TYPE = { '판정': '경기형', '성장': '성장형', '이색': '이색형' };
  UI.chooseBackground = function (inp, offer, onPick) {
    var sel = null;
    var m = UI.modal({ title: '배경을 고르세요', body: '<p class="muted small">언변 ' + offer.speech + '/5. 히든 스탯은 비공개로 정해집니다. 배경은 확정 후 바뀌지 않습니다.</p>' + offer.bgIds.map(function (id) {
      var b = R.BACKGROUNDS.filter(function (x) { return x.id === id; })[0];
      return '<div class="bg-card" data-bg="' + id + '" tabindex="0"><div class="row between"><b>' + esc(b.name) + '</b><span class="small muted">' + (BG_TYPE[b.type] || b.type) + '</span></div><div class="small muted" style="margin:4px 0">' + esc(b.story) + '</div>' +
        b.merits.map(function (e) { return '<div class="eff m">' + esc(R.effLabel(e)) + '</div>'; }).join('') + b.costs.map(function (e) { return '<div class="eff c">' + esc(R.effLabel(e)) + '</div>'; }).join('') + '</div>';
    }).join(''), buttons: [{ label: '이 배경으로 시작', disabled: true, onClick: function () { m.close(); onPick(sel); } }, { label: '취소', cls: 'sec', onClick: function (a) { a.close(); } }] });
    m.body.addEventListener('click', function (ev) {
      var c = ev.target.closest('[data-bg]'); if (!c) return;
      sel = c.dataset.bg; m.body.querySelectorAll('.bg-card').forEach(function (x) { x.classList.toggle('sel', x === c); });
      m.btns.firstChild.disabled = false;
    });
  };

  // ---------- 이벤트·경기 모달 ----------
  UI.eventModal = function (pend, onPick) {
    var m = UI.modal({ title: pend.title, body: '<p>' + esc(pend.text) + '</p>' + pend.options.map(function (o) { return '<button class="opt" data-o="' + o.id + '"><b>' + esc(o.label) + '</b>' + (o.sub ? '<span class="sub">' + esc(o.sub) + '</span>' : '') + '</button>'; }).join('') });
    m.body.addEventListener('click', function (ev) { var b = ev.target.closest('[data-o]'); if (b) { m.close(); onPick(b.dataset.o); } });
  };

  var KIND_KO = { reg: '정규', po: '플레이오프', msi: 'MSI', worlds: '월드 챔피언십' };
  UI.matchModal = function (st, pend, onStart) {
    var pr = pend.prep, prefs = st.prefs;
    var lineup = '<table class="t"><thead><tr><th>상대 라인업</th><th></th><th class="n">OVR</th></tr></thead><tbody>' + pr.lineup.map(function (x) { return '<tr><td>' + POS_KO[x.pos] + '</td><td>' + esc(x.name) + '</td><td class="n">' + x.ovr + '</td></tr>'; }).join('') + '</tbody></table>';
    var manual = prefs.draft === 'always' || (prefs.draft === 'important' && pr.important);
    var body = '<div class="sb-head"><div class="tm">' + esc(pr.myName) + '</div><div class="muted">vs</div><div class="tm r">' + esc(pr.oppName) + '</div></div>' +
      '<div class="sb-sub">' + esc(pr.name || '') + ' ' + (KIND_KO[pend.series.kind] || '') + ' · Bo' + pr.bo + (pr.final ? ' · 결승' : '') + (pr.fearless ? ' · 피어리스' : '') + ' · 전력 ' + pr.myPower + ' : ' + pr.oppPower + '</div>' + lineup +
      '<div class="kv"><span>밴픽</span><span>' + (manual ? '직접 선택' : '자동 (숙련도·메타)') + '</span></div>' +
      '<label class="ck"><input type="checkbox" id="m-watch"' + (prefs.matchView === 'watch' ? ' checked' : '') + '> 관전 (미니맵·문자중계)</label>';
    UI.modal({ title: '경기 준비', body: body, buttons: [{ label: '경기 시작', onClick: function (a) { var w = a.el.querySelector('#m-watch').checked; a.close(); onStart(w, manual); } }] });
  };

  // 세트 시작 전 밴픽 (직접 선택 설정일 때)
  UI.draftModal = function (st, ctx, dv, onPick) {
    var pr = ctx.prep, pick = dv.rec, sigs = st.p.sig;
    function ko(id) { var c = LP.data.db.champs[id]; return c ? c.ko : '-'; }
    var oppPicks = R.POS.map(function (ps) { return POS_KO[ps] + ' ' + ko(dv.picks.theirs[ps]); }).join(' · ');
    var allyPicks = R.POS.filter(function (ps) { return ps !== st.p.pos; }).map(function (ps) { return POS_KO[ps] + ' ' + ko(dv.picks.mine[ps]); }).join(' · ');
    var body = '<div class="sb-sub" style="text-align:left">' + esc(pr.myName) + ' ' + dv.sa + ' : ' + dv.sb + ' ' + esc(pr.oppName) + (pr.fearless ? ' · 피어리스 (사용한 챔피언은 다시 못 씀)' : '') + '</div>' +
      '<div class="draft-bans"><div><div class="small muted">우리 밴</div><div>' + dv.bans.mine.map(ko).join(', ') + '</div></div><div><div class="small muted">상대 밴</div><div>' + dv.bans.theirs.map(ko).join(', ') + '</div></div></div>' +
      '<div class="small muted">상대 픽</div><div style="margin-bottom:8px">' + esc(oppPicks) + '</div><div class="small muted">아군 픽</div><div>' + esc(allyPicks) + '</div>' +
      '<div class="small muted" style="margin-top:12px">내 챔피언 (시그니처 → 숙련 순)</div><div class="pick-list">' +
      dv.list.map(function (x) {
        return '<button class="pick-row' + (x.id === pick ? ' sel' : '') + '" data-pick="' + x.id + '"' + (x.ok ? '' : ' disabled') + '><span class="nmx">' + esc(x.ko) + (x.sig ? ' <span class="tagx sig">시그니처</span>' : '') + (x.patched ? ' <span class="tagx warn">약화</span>' : '') + (x.ok ? '' : ' <span class="why">' + esc(x.why) + '</span>') + '</span>' +
          '<span class="small"><span class="bar"><i style="width:' + x.mastery + '%"></i></span></span><span class="small num">' + x.mastery + ' · ' + x.tier + (x.outPool ? ' · 풀 밖' : '') + '</span></button>';
      }).join('') + '</div>';
    var m = UI.modal({ title: dv.no + '세트 챔피언 선택', body: body, buttons: [{ label: '이 챔피언으로 진행', onClick: function (a) { a.close(); onPick(pick); } }, { label: '추천으로 진행 (' + ko(dv.rec) + ')', cls: 'sec', onClick: function (a) { a.close(); onPick(dv.rec); } }] });
    m.body.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-pick]'); if (!b || b.disabled) return;
      pick = b.dataset.pick; m.body.querySelectorAll('.pick-row').forEach(function (x) { x.classList.toggle('sel', x === b); });
    });
  };

  // 경기 결과 — 스코어보드. 판정 근거는 '판정 상세'를 열었을 때만 보인다.
  var RES_KO = { critS: '대성공', S: '성공', F: '실패', critF: '대실패' };
  UI.resultModal = function (res, st, onClose) {
    var win = res.sMine > res.sOpp, draw = res.winner === null;
    var poms = res.sets.map(function (s, i) { return s.pom ? (i + 1) : 0; }).filter(Boolean);
    var body = '<div class="sb-head"><div class="tm">' + esc(res.meName) + '</div><div class="sc">' + res.sMine + ' : ' + res.sOpp + '</div><div class="tm r">' + esc(res.oppName) + '</div></div>' +
      '<div class="sb-sub">' + esc(res.name || '') + ' ' + (KIND_KO[res.kind] || '') + ' · Bo' + res.bo + (res.fearless ? ' · 피어리스' : '') + ' · <span class="' + (draw ? '' : win ? 'good' : 'bad') + ' strong">' + (draw ? '무승부' : win ? '승리' : '패배') + '</span></div>' +
      '<table class="t fixed sb"><colgroup><col style="width:9%"><col style="width:10%"><col style="width:25%"><col style="width:18%"><col style="width:15%"><col style="width:23%"></colgroup><thead><tr><th>세트</th><th>결과</th><th>내 챔피언</th><th>KDA</th><th class="n">시간</th><th>상대 라이너</th></tr></thead><tbody>' +
      res.sets.map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td class="' + (s.win ? 'good' : 'bad') + ' strong">' + (s.win ? '승' : '패') + '</td><td class="ell">' + esc(LP.match.champKo(s.myChamp)) + '</td><td>' + s.kda.k + '/' + s.kda.d + '/' + s.kda.a + '</td><td class="n nw">' + s.dur + '분</td><td class="ell">' + esc(LP.match.champKo(s.oppChamp)) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<div class="sb-note small">' + (poms.length ? '<span class="strong">POM</span> ' + poms.map(function (n) { return n + '세트'; }).join(', ') : '<span class="muted">POM 없음</span>') + (res.mvp ? ' · <span class="strong">시리즈 MVP</span>' : '') +
      ' · 시리즈 KDA ' + res.kda.k + '/' + res.kda.d + '/' + res.kda.a + '</div>' +
      '<button class="link" id="r-toggle" aria-expanded="false">판정 상세 보기</button><div class="detail" id="r-detail" hidden>' +
      '<div class="small muted" style="margin-bottom:8px">컨디션 ' + esc(res.cond.label) + ' (2d6=' + res.cond.roll + ')' + (res.adapt ? ' · 적응 ' + esc(res.adapt.label) + ' ' + res.adapt.pen : '') + (res.intlPen ? ' · 첫 큰 무대 −10' : '') + '</div>' +
      res.sets.map(function (s, i) {
        return '<div class="strong" style="margin-top:8px">' + (i + 1) + '세트 · 밴 ' + esc(s.bans.mine.map(LP.match.champKo).join(', ')) + ' / ' + esc(s.bans.theirs.map(LP.match.champKo).join(', ')) + (s.sigPick ? ' · 시그니처 +10' : '') + '</div>' +
          '<table class="t fixed"><colgroup><col style="width:25%"><col style="width:25%"><col style="width:16%"><col style="width:14%"><col style="width:20%"></colgroup><thead><tr><th>장면</th><th>능력치 비교</th><th class="n">성공률</th><th class="n">주사위</th><th class="n">결과</th></tr></thead><tbody>' +
          s.scenes.map(function (sc) { return '<tr><td>' + esc(sc.label) + '</td><td>' + sc.me + ' : ' + sc.opp + '</td><td class="n">' + sc.rate + '%</td><td class="n">' + sc.roll + '</td><td class="n res-' + sc.res + '">' + RES_KO[sc.res] + '</td></tr>'; }).join('') + '</tbody></table>';
      }).join('') + '</div>';
    var m = UI.modal({ title: draw ? '무승부' : '경기 결과', body: body, buttons: [{ label: '확인', onClick: function (a) { a.close(); onClose && onClose(); } }] });
    var tg = m.body.querySelector('#r-toggle'), dt = m.body.querySelector('#r-detail');
    tg.onclick = function () { var open = dt.hidden; dt.hidden = !open; tg.textContent = open ? '판정 상세 닫기' : '판정 상세 보기'; tg.setAttribute('aria-expanded', open ? 'true' : 'false'); };
  };

  // ---------- 관전 ----------
  var MAP_SVG = '<svg class="map" viewBox="0 0 100 100" role="img" aria-label="미니맵">' +
    '<path d="M2 98 L98 2" stroke="var(--line)" stroke-width="8" stroke-linecap="round" fill="none" opacity=".7"/>' +
    '<polyline points="8,92 12,12 92,8" fill="none" stroke="var(--line)" stroke-width="3" stroke-linejoin="round"/>' +
    '<polyline points="8,92 88,88 92,8" fill="none" stroke="var(--line)" stroke-width="3" stroke-linejoin="round"/>' +
    '<line x1="8" y1="92" x2="92" y2="8" stroke="var(--line)" stroke-width="3"/>' +
    '<circle cx="8" cy="92" r="6" fill="var(--accent)" opacity=".3"/><circle cx="92" cy="8" r="6" fill="var(--neutral)" opacity=".3"/>' +
    '<circle cx="68" cy="68" r="2.2" fill="var(--muted)"/><circle cx="32" cy="32" r="2.8" fill="var(--muted)"/>' +
    '<g id="flash"><circle class="flash" cx="50" cy="50" r="3"/></g><g id="pieces"></g></svg>';

  // view: {meName, oppName, sets:[세트...], last: 마지막 세트인가}  — 세트마다 한 번씩 호출한다
  UI.watch = function (st, vw, opts, onDone) {
    var timer = null, fi = -1, playing = true, fast = opts.speed === 'fast', frames = [], pieces = [], showDt = false;
    var set = vw.sets[0];
    var m = UI.modal({ title: '', body: '', onClose: function () { clearInterval(timer); } });
    function me(i) { return i === R.POS.indexOf(st.p.pos); }
    function build() {
      frames = set.frames; fi = -1;
      m.body.innerHTML = '<div class="watch-head"><div class="tm a">' + esc(vw.meName) + '</div><div class="clk" id="w-clk">00:00</div><div class="tm b">' + esc(vw.oppName) + '</div></div>' +
        '<div class="small muted" style="text-align:center">' + set.no + '세트 · ' + esc(LP.match.champKo(set.myChamp)) + ' vs ' + esc(LP.match.champKo(set.oppChamp)) + '</div>' +
        '<div class="goldbar"><div class="a" id="w-ga" style="width:50%"></div></div>' +
        '<div class="counts"><div id="w-ca"></div><div id="w-cb"></div></div>' + MAP_SVG +
        '<label class="ck"><input type="checkbox" id="w-dt"> 판정 상세 보기</label><div class="log" id="w-log" aria-live="off"></div><div id="w-res"></div>';
      var g = m.body.querySelector('#pieces'); pieces = [];
      for (var i = 0; i < 10; i++) {
        var gi = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        gi.setAttribute('class', 'piece ' + (i < 5 ? 'a' : 'b') + (me(i) ? ' me' : ''));
        gi.innerHTML = '<circle r="3.4" cx="0" cy="0"></circle><text>' + R.POS_LETTER[R.POS[i % 5]] + '</text>';
        gi.style.transform = 'translate(' + (i < 5 ? 8 : 92) + 'px,' + (i < 5 ? 92 : 8) + 'px)';
        g.appendChild(gi); pieces.push(gi);
      }
      m.el.querySelector('.map').classList.toggle('fast', fast);
      m.body.querySelector('#w-dt').onchange = function (e) { showDt = e.target.checked; m.body.querySelector('#w-log').classList.toggle('show-dt', showDt); };
      m.setButtons([
        { label: playing ? '일시정지' : '재생', cls: 'sec', onClick: function (a, e) { playing = !playing; e.textContent = playing ? '일시정지' : '재생'; } },
        { label: fast ? '속도 빠르게' : '속도 보통', cls: 'sec', onClick: function (a, e) { fast = !fast; e.textContent = fast ? '속도 빠르게' : '속도 보통'; m.el.querySelector('.map').classList.toggle('fast', fast); restart(); } },
        { label: '건너뛰기', cls: 'sec', onClick: function () { while (fi < frames.length - 1) show(fi + 1, true); } }
      ]);
      restart(); show(0);
    }
    function restart() { clearInterval(timer); timer = setInterval(function () { if (playing && fi < frames.length - 1) show(fi + 1); }, fast ? 450 : 1100); }
    var lastClock = null, lastTx = null;
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
      // 같은 시각 사건은 한 줄로 묶는다
      var log = m.body.querySelector('#w-log'), line = '<div class="' + esc(f.cls || '') + '">' + esc(f.text) + (f.detail ? '<span class="dt"> (' + esc(f.detail) + ')</span>' : '') + '</div>';
      if (lastClock === f.clock && lastTx) lastTx.insertAdjacentHTML('beforeend', line);
      else {
        var ln = document.createElement('div'); ln.className = 'ln'; ln.innerHTML = '<span class="c">' + f.clock + '</span><span class="tx">' + line + '</span>';
        log.appendChild(ln); lastTx = ln.querySelector('.tx'); lastClock = f.clock;
      }
      log.scrollTop = log.scrollHeight;
      if (i === frames.length - 1) finishSet();
    }
    function finishSet() {
      clearInterval(timer);
      m.body.querySelector('#w-res').innerHTML = '<div class="panel" style="margin:8px 0 0"><span class="strong ' + (set.win ? 'good' : 'bad') + '">' + (set.win ? '승리' : '패배') + '</span> · ' + set.kda.k + '/' + set.kda.d + '/' + set.kda.a + (set.pom ? ' · POM' : '') +
        '<div class="muted small" id="w-hl">' + (N.hasAI() ? '하이라이트를 정리하는 중…' : '') + '</div></div>';
      if (N.hasAI()) N.highlight(st, set).then(function (t) { var e = m.body.querySelector('#w-hl'); if (e) e.textContent = t || ''; });
      m.setButtons([{ label: vw.last ? '결과 보기' : '다음 세트', onClick: function (a) { a.close(); onDone(); } }]);
    }
    build();
  };

  // ---------- 설정·메뉴 ----------
  UI.settings = function (st, onSave) {
    var s = N.getSettings(), pr = st ? st.prefs : null;
    var body = '<h3>AI 묘사 (선택)</h3><p class="note" style="margin-bottom:8px">키가 없으면 템플릿 문장을 씁니다.</p><label class="f" for="s-prov">제공자</label><select id="s-prov">' + Object.keys(N.PRESETS).map(function (k) { return '<option value="' + k + '"' + (s.provider === k ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select>' +
      '<label class="f" for="s-url" style="margin-top:8px">Base URL</label><input type="text" id="s-url" value="' + esc(s.baseUrl) + '"><label class="f" for="s-key" style="margin-top:8px">API 키 (이 기기 브라우저에만 저장)</label><input type="text" id="s-key" value="' + esc(s.apiKey) + '" autocomplete="off"><label class="f" for="s-model" style="margin-top:8px">모델</label><input type="text" id="s-model" value="' + esc(s.model) + '" placeholder="' + (s.provider === 'anthropic' ? 'claude-opus-5-5' : '모델 ID') + '">';
    if (pr) {
      var stops = pr.stops;
      body += '<h3 style="margin-top:16px">경기 보기</h3><label class="f" for="s-watch">관전</label><select id="s-watch">' + [['all', '내 경기 전부'], ['important', '중요 경기만 (플레이오프·국제대회)'], ['none', '결과만']].map(function (o) { return '<option value="' + o[0] + '"' + (pr.watch === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        '<label class="f" for="s-speed" style="margin-top:8px">관전 속도</label><select id="s-speed"><option value="normal"' + (pr.watchSpeed === 'normal' ? ' selected' : '') + '>보통</option><option value="fast"' + (pr.watchSpeed === 'fast' ? ' selected' : '') + '>빠르게</option></select>' +
        '<label class="f" for="s-draft" style="margin-top:8px">밴픽</label><select id="s-draft">' + [['auto', '자동 (숙련도·메타로 고름)'], ['important', '중요 경기만 직접'], ['always', '항상 직접']].map(function (o) { return '<option value="' + o[0] + '"' + (pr.draft === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
        '<h3 style="margin-top:16px">자동 진행 멈춤 조건</h3><label class="ck"><input type="checkbox" checked disabled> 선택이 필요한 이벤트 (항상)</label>' +
        [['match', '공식 경기 주'], ['grade', '능력치 등급 상승'], ['tier', '솔로랭크 티어 변화'], ['season', '시즌 종료'], ['weekly', '매주 요약 보기']].map(function (o) { return '<label class="ck"><input type="checkbox" data-stop="' + o[0] + '"' + (stops[o[0]] ? ' checked' : '') + '> ' + o[1] + '</label>'; }).join('');
    }
    var m = UI.modal({ title: '설정', body: body, buttons: [{ label: '저장', onClick: function (a) {
      var o = { provider: a.el.querySelector('#s-prov').value, baseUrl: a.el.querySelector('#s-url').value.trim(), apiKey: a.el.querySelector('#s-key').value.trim(), model: a.el.querySelector('#s-model').value.trim() };
      N.saveSettings(o);
      if (pr) {
        pr.watch = a.el.querySelector('#s-watch').value; pr.watchSpeed = a.el.querySelector('#s-speed').value; pr.draft = a.el.querySelector('#s-draft').value;
        a.el.querySelectorAll('[data-stop]').forEach(function (c) { pr.stops[c.dataset.stop] = c.checked; });
      }
      a.close(); onSave && onSave(); UI.toast('설정을 저장했습니다');
    } }, { label: '닫기', cls: 'sec', onClick: function (a) { a.close(); } }] });
    m.el.querySelector('#s-prov').addEventListener('change', function (e) {
      var pz = N.PRESETS[e.target.value]; m.el.querySelector('#s-url').value = pz.baseUrl; if (pz.model) m.el.querySelector('#s-model').value = pz.model;
    });
  };

  LP.ui = UI;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
