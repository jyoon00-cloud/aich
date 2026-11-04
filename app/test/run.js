/* 엔진 테스트 (node app/test/run.js): 시드 고정 3년 자동 진행, 예외 없음, 능력치 0~500, 날짜 연속, 세이브 왕복 동일 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..');
globalThis.LP = {};
['rng', 'rules', 'data', 'state', 'mastery', 'league', 'match', 'create', 'narrate', 'week'].forEach(f => require(path.join(ROOT, 'app', 'js', f + '.js')));
const LP = globalThis.LP, R = LP.rules, S = LP.state;
LP.data.setLoader(p => Promise.resolve(fs.readFileSync(path.join(ROOT, p), 'utf8')));

const INPUT = (year, pos, stats) => ({ name: '테스트', nick: 'Tester', pos, startYear: year, seed: 'seed-' + year, personality: ['침착', '승부욕'],
  stats: stats || { lan: 300, phy: 300, skr: 300, tf: 300, vis: 300 } });

// 모든 시리즈 결과를 모아 피어리스·밴 규칙을 검사한다
const SERIES = [];
{ const M = LP.match, fin = M.finish; M.finish = function (ctx) { const r = fin(ctx); SERIES.push({ res: r, fearless: !!ctx.series.fearless, p: ctx.state.p.pos }); return r; }; }
function checkSeries(list) {
  let fearless = 0, sigPicks = 0, sets = 0;
  list.forEach(({ res, fearless: fl, p: pos }) => {
    const seen = {}, mine = {};
    res.sets.forEach(set => {
      sets++;
      const inSet = {};
      ['mine', 'theirs'].forEach(side => R.POS.forEach(ps => {
        const id = set.champs[side][ps]; if (!id) return;
        assert(!inSet[id], 'same champion twice in a set: ' + id);
        inSet[id] = 1;
        assert(set.bans.mine.indexOf(id) < 0 && set.bans.theirs.indexOf(id) < 0, 'banned champion picked: ' + id);
        if (fl) { assert(!seen[id], 'fearless reuse: ' + id + ' (set ' + set.no + ')'); seen[id] = 1; }
      }));
      assert(set.bans.mine.length === 3 && set.bans.theirs.length === 3, 'bans 3 each');
      if (fl) { const c = set.myChamp; assert(!mine[c], 'player reuse in fearless'); mine[c] = 1; }
      if (set.sigPick) sigPicks++;
    });
    if (fl) fearless++;
  });
  return { fearless, sigPicks, sets };
}
function checkMastery(st) {
  const p = st.p;
  assert(p.mastery && p.sig && p.sig.length >= 3 && p.sig.length <= 5, 'sig count ' + (p.sig && p.sig.length));
  Object.keys(p.mastery).forEach(id => assert(p.mastery[id] >= 0 && p.mastery[id] <= 100, 'mastery range'));
  p.sig.forEach(id => assert(p.mastery[id] !== undefined, 'sig in mastery'));
}

async function runGame(year, pos, stats, weeks, opts) {
  opts = opts || {};
  await LP.data.loadAll(year);
  const inp = INPUT(year, pos, stats);
  inp.sig = LP.mastery.sigChoices(pos, year + '-01-01').slice(0, 3).map(c => c.id);
  const offer = LP.create.offer(inp);
  const st = LP.create.finish(inp, offer, offer.bgIds[opts.bg || 0]);
  const pick = LP.rng.create('choices');
  const log = { events: 0, matches: 0, offers: 0, stages: {} };
  let prev = st.date;
  for (let i = 0; i < weeks; i++) {
    const r = LP.week.autoRun(st, { span: 1, stops: { event: true, match: false, grade: false, tier: false, season: false, weekly: false }, plan: { action: i % 9 === 8 ? 'rest' : 'train', focus: [], auto: true } });
    let guard = 0;
    while (st.pending && guard++ < 50) {
      const pd = st.pending;
      if (pd.kind === 'event') {
        log.events++;
        const o = pd.id.indexOf('trait_') === 0 ? pd.options[0] : pd.options[pick.range(0, pd.options.length - 1)];
        LP.week.resolve(st, { option: o.id, autoMatch: true });
      } else { log.matches++; LP.week.resolve(st, { pick: 'auto', autoMatch: true }); }
      if (!st.pending && st.wk === null) break;
    }
    // 날짜 연속(+7일)
    if (!st.pending) {
      assert.strictEqual(S.diffDays(prev, st.date) % 7, 0, 'date step ' + prev + ' -> ' + st.date);
      assert(S.diffDays(prev, st.date) === 7 || S.diffDays(prev, st.date) === 0, 'date jump ' + prev + ' -> ' + st.date);
    }
    prev = st.date;
    R.STATS.forEach(k => { assert(st.p.stats[k] >= 0 && st.p.stats[k] <= 500, 'stat range ' + k + '=' + st.p.stats[k]); assert(st.p.stats[k] <= st.p.potential); });
    log.stages[st.career.stage] = (log.stages[st.career.stage] || 0) + 1;
  }
  checkMastery(st);
  return { st, log };
}

(async () => {
  // 1) 3년 자동 진행
  let a = await runGame(2024, 'MID', { lan: 380, phy: 380, skr: 380, tf: 380, vis: 380 }, 156);
  const j1 = S.serialize(a.st);
  console.log('2024 MID: date', a.st.date, 'stage', a.st.career.stage, 'ovr', R.ovr(a.st.p.stats), 'official', JSON.stringify(a.st.record.official), 'titles', a.st.record.titles.length, 'events', a.log.events, 'matches', a.log.matches, JSON.stringify(a.log.stages));
  assert(S.diffDays('2024-01-01', a.st.date) === 156 * 7, 'total days');
  // 2) 세이브 왕복
  const re = S.deserialize(j1);
  assert.strictEqual(S.serialize(re), j1, 'save roundtrip');
  // 3) 결정성: 같은 입력 -> 같은 결과
  LP.league._internal; // 달력 캐시는 상태 없음
  let b = await runGame(2024, 'MID', { lan: 380, phy: 380, skr: 380, tf: 380, vis: 380 }, 156);
  assert.strictEqual(S.serialize(b.st), j1, 'determinism');
  // 4) 이어서 진행해도 동일 (저장 -> 불러오기 -> 더 진행)
  const c1 = S.deserialize(j1), c2 = S.deserialize(j1);
  const step = st => { LP.week.autoRun(st, { span: 4, stops: { event: false, match: false, grade: false, tier: false, season: false, weekly: false }, plan: { action: 'train', focus: [], auto: true } }); while (st.pending) { if (st.pending.kind === 'event') LP.week.resolve(st, { option: st.pending.options[0].id, autoMatch: true }); else LP.week.resolve(st, { pick: 'auto', autoMatch: true }); } };
  step(c1); step(c2);
  assert.strictEqual(S.serialize(c1), S.serialize(c2), 'resume determinism');
  // 5) 약한 아마추어 시작 + 다른 연도·포지션
  for (const [y, pos, v] of [[2013, 'TOP', 150], [2019, 'JUNGLE', 260], [2026, 'SUP', 330], [2016, 'AD', 420]]) {
    const r = await runGame(y, pos, { lan: v, phy: v, skr: v, tf: v, vis: v }, 110);
    console.log(y, pos, 'v' + v, '->', r.st.date, r.st.career.stage, 'ovr', R.ovr(r.st.p.stats), 'soloq', r.st.soloq.tier, r.st.soloq.lp, 'events', r.log.events, 'matches', r.log.matches, JSON.stringify(r.log.stages));
  }
  // 5b) 2027년 이후(2026 일정 반복)까지
  { const r = await runGame(2026, 'TOP', { lan: 400, phy: 400, skr: 400, tf: 400, vis: 400 }, 160); assert(r.st.date > '2028-12-01'); console.log('2026 TOP -> ', r.st.date, r.st.career.stage, 'titles', r.st.record.titles.length); }
  // 6) 일정표: 연도별 달력이 만들어지고 2027 이후도 된다
  for (const y of [2013, 2020, 2025, 2026, 2030]) { const cal = LP.league.calendar(y); assert(cal.worlds.start && cal.leagues.LCK.length, 'cal ' + y); }
  const ck = checkSeries(SERIES);
  console.log('series', SERIES.length, 'sets', ck.sets, 'fearless series', ck.fearless, 'signature picks', ck.sigPicks);
  assert(SERIES.length > 20 && ck.fearless > 0, 'no fearless series sampled');
  // 7) 솔로랭크 시즌 초기화: 이번 시즌 전적은 누적보다 작다
  assert(a.st.soloq.totW + a.st.soloq.totL > a.st.soloq.w + a.st.soloq.l, 'soloq season reset');
  assert(a.st.record.seasons.length >= 2, 'season records');
  // 8) 예전 세이브 마이그레이션: 숙련도·시그니처 없이 저장된 세이브를 읽으면 자동 생성
  { const old = JSON.parse(j1); delete old.p.mastery; delete old.p.sig; delete old.p.lastUsed; delete old.p.usage; delete old.soloq.totW; delete old.record.seas; delete old.record.seasons;
    const mg = S.deserialize(JSON.stringify(old)); checkMastery(mg); assert(mg.p.sig.length === 3 && mg.record.seas && mg.soloq.totW !== undefined, 'migration'); }
  // 9) 시즌 종료 특성: 조건을 채우면 선택 대기 이벤트(근거 포함)로 뜬다. 칸이 가득 차면 교체 선택이 이어진다.
  for (const full of [false, true]) {
    const t = S.deserialize(j1);
    t.record.seas.lan = [40, 50]; t.p.traits = full ? ['iron', 'survivor', 'intl_champ'] : []; t.record.intlTitles = 0; t.record.leagueTitles = 0;
    const seen = []; let guard = 0;
    while (S.diffDays(t.date, '2027-01-01') > 0 || t.pending) {
      if (guard++ > 40) throw new Error('year end not reached');
      if (t.pending) {
        const pd = t.pending; seen.push(pd.id);
        if (pd.id === 'trait_pick') { assert(pd.options[0].sub.indexOf('라인전 성공률') >= 0, 'evidence text'); LP.week.resolve(t, { option: pd.options[0].id, autoMatch: true }); }
        else if (pd.id === 'trait_replace') LP.week.resolve(t, { option: pd.options[0].id, autoMatch: true });
        else if (pd.kind === 'event') LP.week.resolve(t, { option: pd.options[0].id, autoMatch: true }); else LP.week.resolve(t, { pick: 'auto', autoMatch: true });
        continue;
      }
      LP.week.step(t, { action: 'train', focus: ['lan', 'phy'], autoMatch: true });
    }
    assert(seen.indexOf('trait_pick') >= 0, 'trait_pick event');
    assert(t.p.traits.indexOf('lane_king') >= 0, 'lane_king granted');
    if (full) assert(seen.indexOf('trait_replace') >= 0 && t.p.traits.length === 3, 'trait replace flow');
    assert(t.record.seas.lan[1] === 0, 'season stats reset');
  }
  console.log('OK');
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
