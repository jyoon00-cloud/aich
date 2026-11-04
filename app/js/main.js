/* main.js — 턴 루프·화면 전환·입력 처리 */
(function (LP) {
  'use strict';
  var S = LP.state, W = LP.week, UI = LP.ui, R = LP.rules, N = LP.narrate, M = LP.match;
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
      UI.matchModal(state, pend, function (watch, manual) { runSeries(pend, watch, manual); });
    }
  }

  // 시리즈를 세트 단위로 진행한다: (직접 밴픽이면 선택) → 세트 계산 → (관전) → 다음 세트 → 결과
  function runSeries(pend, watch, manual) {
    var prefs = state.prefs, prep = pend.prep;
    prefs.matchView = watch ? 'watch' : 'instant';
    var showWatch = watch && prefs.watch !== 'none' && (prefs.watch === 'all' || prep.important);
    var ctx = M.begin(state, pend.series, prep);
    function finish() {
      var res = M.finish(ctx);
      var r = W.resolve(state, { res: res });
      persist();
      UI.resultModal(res, state, function () { afterStep(r); });
    }
    function next() {
      if (M.isDone(ctx)) { finish(); return; }
      var dv = M.draft(ctx);
      var go = function (pick) {
        var set = M.playSet(ctx, pick);
        if (showWatch) UI.watch(state, { meName: prep.myName, oppName: prep.oppName, sets: [set], last: M.isDone(ctx) }, { speed: prefs.watchSpeed }, next);
        else next();
      };
      if (manual) UI.draftModal(state, ctx, dv, go); else go('auto');
    }
    next();
  }

  function manualPlan() {
    var man = state.prefs.speed.manual;
    var need = man.action === 'train' ? 2 : man.action === 'rest' ? 0 : 1;
    if (!man.auto && man.focus.length < need) { UI.toast('집중 능력치를 ' + need + '개 고르세요'); return null; }
    return { man: man, need: need };
  }
  function stepManual() {
    var mp = manualPlan(); if (!mp) return;
    var focus = mp.man.auto ? W.lowestTwo(state) : mp.man.focus.slice(0, mp.need);
    var r = W.step(state, { action: mp.man.action, focus: focus });
    afterStep(r);
  }
  function runAuto(spanSel) {
    var mp = manualPlan(); if (!mp) return;
    var sp = spanSel === 'match' || spanSel === 'season' ? spanSel : +spanSel;
    var plan = { action: mp.man.action, focus: mp.man.focus.slice(), auto: !!mp.man.auto };
    var out = W.autoRun(state, { span: sp, plan: plan, stops: state.prefs.stops });
    var why = { event: '선택이 필요한 이벤트', match: '공식 경기 주', matchDone: '경기를 치렀습니다', grade: '능력치 등급이 올랐습니다', tier: '솔로랭크 티어가 바뀌었습니다', season: '시즌이 끝났습니다', weekly: '주간 요약', done: '완료' }[out.reason] || '';
    UI.toast(out.weeks >= 1 ? out.weeks + '주 진행 · ' + why : why);
    persist();
    if (out.weeks >= 2 && N.hasAI()) {
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
            UI.setView({ tab: 'home' });
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
    var m = UI.modal({ title: '메뉴', body: '', buttons: [] });
    m.el.dataset.dismiss = '1';
    var items = [
      ['저장하기 (자동 저장도 됩니다)', function () { persist(); UI.toast('저장했습니다'); }],
      ['세이브 내보내기 (JSON)', doExport], ['세이브 불러오기 (JSON)', doImport],
      ['설정 (AI 묘사·관전·밴픽·자동 진행)', function () { UI.settings(state, function () { persist(); render(); }); }],
      ['라이트/다크 전환', theme],
      ['새 게임 (현재 세이브 삭제)', function () { if (confirm('현재 세이브를 지우고 새로 시작할까요?')) { S.clear(); startNew(); } }],
      ['처음 화면으로', showTitle]
    ];
    m.body.innerHTML = items.map(function (it, i) { return '<button class="opt" data-i="' + i + '">' + UI.esc(it[0]) + '</button>'; }).join('');
    m.body.addEventListener('click', function (ev) { var b = ev.target.closest('[data-i]'); if (b) { m.close(); items[+b.dataset.i][1](); } });
    m.setButtons([{ label: '닫기', cls: 'sec', onClick: function (a) { a.close(); } }]);
  }

  // ---------- 입력 위임 ----------
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t.closest('#btn-menu') || t.closest('#btn-menu-side')) return menu();
    if (t.closest('#t-new')) { return startNew(); }
    if (t.closest('#t-cont')) { try { state = S.load(); render(); } catch (e) { UI.toast('세이브를 읽지 못했습니다: ' + e.message); } return; }
    if (t.closest('#t-import')) return doImport();
    if (t.closest('#t-set')) return UI.settings(null);
    if (!state) return;
    var tab = t.closest('[data-tab]');
    if (tab) { UI.setView({ tab: tab.dataset.tab }); render(); window.scrollTo(0, 0); return; }
    var sp = state.prefs.speed, man = sp.manual || (sp.manual = { action: 'train', focus: ['lan', 'phy'], auto: false });
    var act = t.closest('[data-act]');
    if (act) { man.action = act.dataset.act; var n = man.action === 'train' ? 2 : 1; man.focus = man.focus.slice(0, n); persist(); return render(); }
    var ch = t.closest('[data-focus] .chip');
    if (ch) {
      var k = ch.dataset.k, cap = man.action === 'train' ? 2 : 1;
      if (k === 'auto') man.auto = !man.auto;
      else {
        man.auto = false;
        var i = man.focus.indexOf(k);
        if (i >= 0) man.focus.splice(i, 1); else { man.focus.push(k); if (man.focus.length > cap) man.focus.shift(); }
      }
      persist(); return render();
    }
    var lg = t.closest('[data-lg]');
    if (lg) { UI.setView({ rankLg: lg.dataset.lg, rankSeg: null }); return render(); }
    var sk = t.closest('[data-seg-key]');
    if (sk) { UI.setView({ rankSeg: sk.dataset.segKey }); return render(); }
    var lf = t.closest('[data-logf]');
    if (lf) { UI.setView({ logF: lf.dataset.logf, logN: 60 }); return render(); }
    if (t.closest('#log-more')) { UI.setView({ logN: UI.view.logN + 60 }); return render(); }
    if (t.closest('#go-week')) return stepManual();
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (!state) return;
    if (t.id === 'auto-go' && t.value) { var v = t.value; t.value = ''; runAuto(v); }
  });

  // ---------- 시작 ----------
  applyTheme();
  LP.data.loadAll(null).then(function () {
    showTitle();
    if (/[?&]continue=1/.test(location.search) && S.hasSave()) { try { state = S.load(); render(); } catch (e) { } }
  }).catch(function (e) {
    $('#main').innerHTML = '<div class="panel"><h2>데이터를 불러오지 못했습니다</h2><p class="muted">' + UI.esc(e.message) + '</p><p class="small">저장소 루트에서 <code>python3 -m http.server</code>를 실행하고 <code>/app/</code>으로 접속하세요.</p></div>';
  });
  LP.main = { get state() { return state; }, set state(v) { state = v; }, render: render, runAuto: runAuto };
})(typeof window !== 'undefined' ? window.LP : globalThis.LP);
