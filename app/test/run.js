/* 엔진 테스트 (node app/test/run.js): 시드 고정 3년 자동 진행, 예외 없음, 능력치 0~500, 날짜 연속, 세이브 왕복 동일 */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..', '..');
globalThis.LP = {};
['rng', 'rules', 'data', 'state', 'league', 'match', 'create', 'narrate', 'week'].forEach(f => require(path.join(ROOT, 'app', 'js', f + '.js')));
const LP = globalThis.LP, R = LP.rules, S = LP.state;
LP.data.setLoader(p => Promise.resolve(fs.readFileSync(path.join(ROOT, p), 'utf8')));

const INPUT = (year, pos, stats) => ({ name: '테스트', nick: 'Tester', pos, startYear: year, seed: 'seed-' + year, personality: ['침착', '승부욕'],
  stats: stats || { lan: 300, phy: 300, skr: 300, tf: 300, vis: 300 } });

async function runGame(year, pos, stats, weeks, opts) {
  opts = opts || {};
  await LP.data.loadAll(year);
  const inp = INPUT(year, pos, stats);
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
        const o = pd.options[pick.range(0, pd.options.length - 1)];
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
  console.log('OK');
})().catch(e => { console.error('FAIL', e && e.stack || e); process.exit(1); });
