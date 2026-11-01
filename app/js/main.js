/* main.js — 턴 루프·화면 전환·입력 처리 */
(function (LP) {
  'use strict';
  var S = LP.state, W = LP.week, UI = LP.ui, R = LP.rules, N = LP.narrate;
  var state = null, busy = false;
  var $ = function (s) { return document.querySelector(s); };

  function persist() { try { S.save(state); } catch (e) { UI.toast('저장 공간이 부족합니다. 내보내기로 백업하세요'); } }
  function render() { UI.renderGame(state); }

  // 새 피드 중 AI 묘사 대상을 묘사로 바꾼다(수동 진행 때만)
  function enhanceRecent() {
    if (!N.hasAI()) return;
    state.feed.slice(-4).forEach(function (e) {
      if (e.ai && !e.aiDone) N.enhance(state, e).then(function (ok) { if (ok && state) { persist(); render(); } });
    });
  }

  function afterStep(r, fromAuto) {
    persist();
    if (state.pending) { handlePending(); return; }
    render();
    if (!fromAuto) enhanceRecent();
  }

  function handlePending() {
    var pend = state.pending;
    if (pend.kind === 'event') {
      render();
      UI.eventModal(pend, function (opt) {
        var r = W.resolve(state, { option: opt });
        afterStep(r);
      });
    } else if (pend.kind === 'match') {
      render();
      UI.matchModal(state, pend, function (pick, watch) {
        var prefs = state.prefs, prep = pend.prep;
        prefs.matchView = watch ? 'watch' : 'instant';
        var r = W.resolve(state, { pick: pick });
        var res = r.match;
        var showWatch = watch && prefs.watch !== 'none' && (prefs.watch === 'all' || prep.important);
        var done = function () { UI.resultModal(res, state, function () { afterStep(r); }); };
        persist();
        if (showWatch) UI.watch(state, res, { speed: prefs.watchSpeed }, done); else done();
      });
    }
  }

  function stepManual() {
    var man = state.prefs.speed.manual;
    var need = man.action === 'train' ? 2 : man.action === 'rest' ? 0 : 1;
    if (man.focus.length < need) { UI.toast('집중 능력치를 ' + need + '개 고르세요'); return; }
    var r = W.step(state, { action: man.action, focus: man.focus.slice(0, need) });
    afterStep(r);
  }
  function runAuto() {
    var sp = state.prefs.speed, plan = sp.plan;
    var need = plan.action === 'train' ? 2 : 1;
    if (!plan.auto && plan.action !== 'rest' && plan.focus.length < need) { UI.toast('자동 계획의 집중 능력치를 ' + need + '개 고르세요'); return; }
    var span = sp.span === 'match' || sp.span === 'season' ? sp.span : +sp.span;
    var out = W.autoRun(state, { span: span, plan: plan, stops: state.prefs.stops });
    var why = { event: '선택이 필요한 이벤트', match: '공식 경기 주', matchDone: '경기를 치렀습니다', grade: '능력치 등급이 올랐습니다', tier: '솔로랭크 티어가 바뀌었습니다', season: '시즌이 끝났습니다', weekly: '주간 요약', done: '완료' }[out.reason] || '';
    UI.toast(out.weeks + '주 진행 · ' + why);
    persist();
    if (out.weeks > 1 && N.hasAI()) {
      N.digest(state, W.digestFacts(state, out.from)).then(function (t) {
        if (t) { var e = S.addFeed(state, 'digest', {}, t); e.aiDone = true; persist(); if (!state.pending) render(); }
      });
    }
    afterStep(null, true);
  }

  // ---------- 화면 전환 ----------
  function showTitle() { state = null; UI.renderTitle(S.hasSave()); }
  function startNew() {
    UI.renderCreate({
      back: showTitle,
      next: function (inp) {
        if (busy) return; busy = true;
        LP.data.loadAll(inp.startYear).then(function () {
          busy = false;
          var offer = LP.create.offer(inp);
          UI.chooseBackground(inp, offer, function (bg) {
            try { state = LP.create.finish(inp, offer, bg); } catch (e) { UI.toast(e.message); return; }
            persist(); render(); UI.toast('게임을 시작합니다');
          });
        }).catch(function (e) { busy = false; UI.toast('데이터를 불러오지 못했습니다: ' + e.message); });
      }
    });
  }
  function doImport() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = function () {
      var f = inp.files[0]; if (!f) return;
      var rd = new FileReader();
      rd.onload = function () { try { state = S.importJSON(rd.result); persist(); render(); UI.toast('불러왔습니다'); } catch (e) { UI.toast('불러오기 실패: ' + e.message); } };
      rd.readAsText(f);
    };
    inp.click();
  }
  function doExport() {
    var blob = new Blob([S.exportJSON(state)], { type: 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'lolpro-' + state.p.nick + '-' + state.date + '.json'; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  function theme() {
    var cur = null; try { cur = localStorage.getItem('lp2_theme'); } catch (e) { }
    var nx = cur === 'dark' ? 'light' : cur === 'light' ? null : 'dark';
    try { if (nx) localStorage.setItem('lp2_theme', nx); else localStorage.removeItem('lp2_theme'); } catch (e) { }
    applyTheme(); UI.toast('테마: ' + (nx === 'dark' ? '다크' : nx === 'light' ? '라이트' : '시스템'));
  }
  function applyTheme() { var t = null; try { t = localStorage.getItem('lp2_theme'); } catch (e) { } if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme'); }
  function menu() {
    var m = UI.modal({ title: '메뉴', dismiss: true, body: '', buttons: [] });
    var items = [
      ['저장하기 (자동 저장도 됩니다)', function () { persist(); UI.toast('저장했습니다'); }],
      ['세이브 내보내기 (JSON)', doExport], ['세이브 불러오기 (JSON)', doImport],
      ['설정 (AI 묘사·관전)', function () { UI.settings(state, function () { persist(); }); }],
      ['라이트/다크 전환', theme],
      ['새 게임 (현재 세이브 삭제)', function () { if (confirm('현재 세이브를 지우고 새로 시작할까요?')) { S.clear(); startNew(); } }],
      ['처음 화면으로', showTitle]
    ];
    m.body.innerHTML = items.map(function (it, i) { return '<button class="opt" data-i="' + i + '">' + UI.esc(it[0]) + '</button>'; }).join('');
    m.body.addEventListener('click', function (ev) { var b = ev.target.closest('[data-i]'); if (b) { m.close(); items[+b.dataset.i][1](); } });
    m.setButtons([{ label: '닫기', cls: 'ghost', onClick: function (a) { a.close(); } }]);
  }

  // ---------- 입력 위임 ----------
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var id = t.closest('[id]') && t.closest('[id]').id;
    if (t.closest('#btn-menu')) return menu();
    if (t.closest('#btn-table')) return UI.table(state);
    if (t.closest('#t-new')) { return startNew(); }
    if (t.closest('#t-cont')) { try { state = S.load(); render(); } catch (e) { UI.toast('세이브를 읽지 못했습니다: ' + e.message); } return; }
    if (t.closest('#t-import')) return doImport();
    if (t.closest('#t-set')) return UI.settings(null);
    if (!state) return;
    var sp = state.prefs.speed, man = sp.manual || (sp.manual = { action: 'train', focus: ['lan', 'phy'] });
    var seg = t.closest('[data-seg] button');
    if (seg) { sp.mode = seg.dataset.v; persist(); return render(); }
    var act = t.closest('[data-act]');
    if (act) { man.action = act.dataset.act; var n = man.action === 'train' ? 2 : 1; man.focus = man.focus.slice(0, n); persist(); return render(); }
    var pl = t.closest('[data-plan]');
    if (pl) { sp.plan.action = pl.dataset.plan; persist(); return render(); }
    var ch = t.closest('[data-focus] .chip');
    if (ch) {
      var which = ch.parentNode.dataset.focus, tgt = which === 'plan' ? sp.plan : man, k = ch.dataset.k, cap = tgt.action === 'train' ? 2 : 1;
      var i = tgt.focus.indexOf(k);
      if (i >= 0) tgt.focus.splice(i, 1); else { tgt.focus.push(k); if (tgt.focus.length > cap) tgt.focus.shift(); }
      persist(); return render();
    }
    if (t.closest('#go-week')) return stepManual();
    if (t.closest('#go-auto')) return runAuto();
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!state) return;
    if (t.id === 'auto-span') { state.prefs.speed.span = t.value; persist(); }
    else if (t.id === 'plan-auto') { state.prefs.speed.plan.auto = t.checked; persist(); render(); }
    else if (t.dataset && t.dataset.stop) { state.prefs.stops[t.dataset.stop] = t.checked; persist(); }
  });

  // ---------- 시작 ----------
  applyTheme();
  LP.data.loadAll(null).then(function () {
    showTitle();
    if (/[?&]continue=1/.test(location.search) && S.hasSave()) { try { state = S.load(); render(); } catch (e) { } }
  }).catch(function (e) {
    $('#main').innerHTML = '<div class="card"><h2>데이터를 불러오지 못했습니다</h2><p class="muted">' + UI.esc(e.message) + '</p><p class="small">저장소 루트에서 <code>python3 -m http.server</code>를 실행하고 <code>/app/</code>으로 접속하세요.</p></div>';
  });
  LP.main = { get state() { return state; } };
})(typeof window !== 'undefined' ? window.LP : globalThis.LP);
