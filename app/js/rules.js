/* rules.js — lolpro.md 수치표를 상수·함수로 옮긴 것. '설계 추정'이라고 적힌 것은 lolpro.md/SPEC에 수치가 없어 정한 값이다. */
(function (LP) {
  'use strict';
  var R = {};

  R.STATS = ['lan', 'phy', 'skr', 'tf', 'vis'];
  R.STAT_KO = { lan: '라인전·동선', phy: '피지컬', skr: '소규모 교전', tf: '한타', vis: '시야' };
  R.STAT_SHORT = { lan: '라인전', phy: '피지컬', skr: '교전', tf: '한타', vis: '시야' };
  R.POS = ['TOP', 'JUNGLE', 'MID', 'AD', 'SUP'];
  R.POS_KO = { TOP: '탑', JUNGLE: '정글', MID: '미드', AD: '원딜', SUP: '서포터' };
  R.POS_LETTER = { TOP: 'T', JUNGLE: 'J', MID: 'M', AD: 'A', SUP: 'S' };
  R.LEAGUES = ['LCK', 'LPL', 'LEC', 'LCS'];
  R.MIN_AGE = 17;            // 리그 출전 연령(LCK 만 17세, SPEC 3장: 상수 하나)
  R.POTENTIAL = 500;
  R.STAGE_KO = { amateur: '무소속 아마추어', academy: '아카데미 연습생', cl: '2군', pro: '1군', retired: '은퇴' };

  R.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  R.ovr = function (s) { return Math.floor((s.lan + s.phy + s.skr + s.tf + s.vis) / 5); };

  // 2.3 등급
  var GRADE_AT = [0, 100, 200, 250, 300, 350, 400, 450, 500];
  var GRADE_NAME = ['초보', '초급~중급', '상급', '마스터급', '그랜드마스터급', '챌린저급', '프로 최상위권', '1군 프로급', '최상위 한계치'];
  R.gradeIdx = function (v) { var i = 0; while (i + 1 < GRADE_AT.length && v >= GRADE_AT[i + 1]) i++; return i; };
  R.gradeName = function (v) { return GRADE_NAME[R.gradeIdx(v)]; };

  // ---------- 4.1 성장 ----------
  R.growthBase = function (v, rng) {
    if (v < 200) return rng.int(4) + 2;
    if (v < 300) return rng.int(3) + 1;
    if (v < 400) return rng.int(2);
    if (v < 450) return rng.chance(50) ? 1 : 0;
    return rng.chance(25) ? 1 : 0;
  };
  R.PRO_GROWTH = { 1: -0.2, 2: -0.1, 3: 0, 4: 0.1, 5: 0.2 };
  R.STAGE_GROWTH = { amateur: 0, academy: 0.25, cl: 0.5, pro: 0.5 };
  R.BEGINNER_BONUS = 0.5;
  R.OFF_FOCUS_CHANCE = 30;

  // ---------- 4.2 에이징 ----------
  R.agingRow = function (age) {
    if (age < 25) return null;
    if (age <= 26) return { p: 10, roll: function (r) { return r.int(6); } };
    if (age <= 28) return { p: 20, roll: function (r) { return r.int(10); } };
    if (age <= 30) return { p: 30, roll: function (r) { return r.int(10) + 2; } };
    if (age <= 32) return { p: 45, roll: function (r) { return r.int(8) + r.int(8); } };
    return { p: 60, roll: function (r) { return r.int(10) + r.int(10); } };
  };
  R.AGING_STAT_ADJ = { phy: 10, skr: 5, vis: -10, tf: -10, lan: 0 };
  R.AGING_PRO_ADJ = { 5: -10, 4: -5, 3: 0, 2: 5, 1: 10 };

  // ---------- 5.3 컨디션 ----------
  R.condition = function (roll) {
    if (roll <= 3) return { key: 0, label: '최악', adj: -30 };
    if (roll <= 5) return { key: 1, label: '나쁨', adj: -15 };
    if (roll <= 8) return { key: 2, label: '보통', adj: 0 };
    if (roll <= 10) return { key: 3, label: '좋음', adj: 15 };
    return { key: 4, label: '최상', adj: 30 };
  };
  R.CONDITION_BY_KEY = [{ key: 0, label: '최악', adj: -30 }, { key: 1, label: '나쁨', adj: -15 }, { key: 2, label: '보통', adj: 0 }, { key: 3, label: '좋음', adj: 15 }, { key: 4, label: '최상', adj: 30 }];
  R.VOL_MULT = { 1: 0.5, 2: 0.75, 3: 1, 4: 1.25, 5: 1.5 };
  R.MENTAL_PRESSURE = { 1: -20, 2: -10, 3: 0, 4: 10, 5: 20 };

  // ---------- 3.1 데뷔 적응 ----------
  R.adaptRow = function (roll) {
    if (roll <= 3) return { label: '무대 공포', pro: -35, cl: -20 };
    if (roll <= 5) return { label: '헤맴', pro: -25, cl: -15 };
    if (roll <= 8) return { label: '보통', pro: -15, cl: -10 };
    if (roll <= 10) return { label: '빠른 적응', pro: -5, cl: 0 };
    return { label: '괴물 신인', pro: 0, cl: 0, monster: true };
  };
  R.ADAPT_RECOVER = { 1: 3, 2: 3, 3: 5, 4: 8, 5: 8 };   // 공식 5세트마다 줄어드는 양(프로의식)

  // ---------- 2.8 히든 스탯 ----------
  R.rollHidden = function (rng) {
    var c = rng.d2x6(), clutch = c === 2 ? -2 : c <= 4 ? -1 : c <= 9 ? 0 : c <= 11 ? 1 : 2;
    function d6() { var v = rng.int(6); return v === 1 ? 1 : v === 2 ? 2 : v <= 4 ? 3 : v === 5 ? 4 : 5; }
    return { men: d6(), clutch: clutch, pro: d6(), vol: d6() };
  };
  // 언변 2d6 표 — 설계 추정(lolpro.md에 표 없음)
  R.rollSpeech = function (rng) {
    var r = rng.d2x6();
    return r === 2 ? 1 : r <= 5 ? 2 : r <= 8 ? 3 : r <= 11 ? 4 : 5;
  };

  // ---------- 솔로랭크 ----------
  R.TIERS = [
    { k: 'IRON', ko: '아이언', base: 0, div: true }, { k: 'BRONZE', ko: '브론즈', base: 400, div: true },
    { k: 'SILVER', ko: '실버', base: 800, div: true }, { k: 'GOLD', ko: '골드', base: 1200, div: true },
    { k: 'PLATINUM', ko: '플래티넘', base: 1600, div: true }, { k: 'EMERALD', ko: '에메랄드', base: 2000, div: true },
    { k: 'DIAMOND', ko: '다이아', base: 2400, div: true }, { k: 'MASTER', ko: '마스터', base: 2800 },
    { k: 'GRANDMASTER', ko: '그랜드마스터', base: 3200 }, { k: 'CHALLENGER', ko: '챌린저', base: 3600 }
  ];
  R.RP_MAX = 5000;
  R.tierIdx = function (rp) { var i = 0; while (i + 1 < R.TIERS.length && rp >= R.TIERS[i + 1].base) i++; return i; };
  R.tierInfo = function (rp) {
    var i = R.tierIdx(rp), t = R.TIERS[i];
    if (t.div) {
      var off = rp - t.base, d = 4 - Math.floor(off / 100);
      return { idx: i, tier: t.k, ko: t.ko, div: d, lp: off % 100, text: t.ko + ' ' + ['', 'I', 'II', 'III', 'IV'][d] + ' ' + (off % 100) + 'LP' };
    }
    return { idx: i, tier: t.k, ko: t.ko, div: 0, lp: rp - t.base, text: t.ko + ' ' + (rp - t.base) + 'LP' };
  };
  // MMR(=래더 점수) → 그 구간 평균 OVR. 설계 추정 (챌린저 상위 ≈ 380~420).
  var MMR_OVR = [[0, 60], [400, 110], [800, 160], [1200, 200], [1600, 235], [2000, 265], [2400, 295], [2800, 325], [3200, 355], [3600, 385], [4400, 420], [5000, 430]];
  R.mmrToOvr = function (rp) {
    for (var i = 1; i < MMR_OVR.length; i++) {
      if (rp <= MMR_OVR[i][0]) { var a = MMR_OVR[i - 1], b = MMR_OVR[i]; return a[1] + (b[1] - a[1]) * (rp - a[0]) / (b[0] - a[0]); }
    }
    return 430;
  };
  R.ovrToMmr = function (ovr) {
    for (var i = 1; i < MMR_OVR.length; i++) {
      if (ovr <= MMR_OVR[i][1]) { var a = MMR_OVR[i - 1], b = MMR_OVR[i]; return a[0] + (b[0] - a[0]) * (ovr - a[1]) / (b[1] - a[1]); }
    }
    return 5000;
  };
  R.SOLO_BASE_MMR = 1200;   // 새 시즌 배치 때 당겨지는 평균 MMR (설계 추정)
  R.SIG_MAX = 5; R.SIG_MASTERY = 70; R.SIG_PICK = 15; R.SIG_EFF = 10; R.SIG_GROWTH = 1.5;
  R.SOLO_GAMES = { train: 15, solo: 35, stream: 10, rest: 3 };      // 주당 판수 (SPEC 3장)
  R.SOLO_WINRATE_SLOPE = 0.3;
  // 스카우트 문턱 (SPEC 3장)
  R.SCOUT = {
    academy: { rp: 2800, ovr: 280, base: 12, perOvr: 0.4, cap: 45, minAge: 15 },
    cl: { ovr: 350, base: 8, perOvr: 0.5, cap: 40 },
    pro: { ovr: 400, base: 6, perOvr: 0.6, cap: 40 }
  };

  // ---------- 연봉 (salary.md 3·4절) ----------
  // 단위 만원(KRW). 환산: 1위안≈190원, €1≈1450원, $1≈1230원 (salary.md 상단).
  // OVR 구간: <425 하위, <445 중위, <465 상위, 이상 최상위.
  var SAL = {
    LCK_c: [[6000, 12000], [12000, 25000], [25000, 50000], [50000, 150000]],          // 2020~ (salary.md 3.1)
    LCK_b: [[2000, 6000], [6000, 12000], [12000, 30000], [30000, 60000]],             // 2015~2019 — 설계 추정(최저 0.2억, 평균 1.7억 [2])
    LCK_a: [[1500, 2500], [2000, 3000], [2500, 5000], [30000, 40000]],                // 2013~2014 — salary.md 1절(일반 0.2억, 최상위 3~4억)
    LPL: [[4560, 9500], [9500, 22800], [22800, 57000], [57000, 190000]],              // 3.2 (24만~50만, 50~120만, 120~300만, 300~1000만 위안)
    LEC: [[8700, 17400], [17400, 36250], [36250, 58000], [58000, 145000]],            // 3.3 (€60~120k ...)
    LCS: [[9225, 18450], [18450, 36900], [36900, 50430], [50430, 123000]]             // 3.4 ($75~150k ...)
  };
  // 시대 배율(LCK 제외) — 설계 추정: LCS 평균 $150k(2017) → $327k(2018) [21] 근거로 2017 이전은 절반
  R.eraMul = function (year) { return year <= 2014 ? 0.3 : year <= 2017 ? 0.5 : 1; };
  R.salaryRange = function (league, year, ovr, stage, role) {
    var tab = league === 'LCK' ? (year >= 2020 ? SAL.LCK_c : year >= 2015 ? SAL.LCK_b : SAL.LCK_a) : SAL[league] || SAL.LCK_c;
    var mul = league === 'LCK' ? 1 : R.eraMul(year);
    var b = ovr < 425 ? 0 : ovr < 445 ? 1 : ovr < 465 ? 2 : 3;
    var lo0 = tab[0][0] * mul;
    if (stage === 'academy') return [960, 2040];                       // 연습생 월 80~170만 원 (4절)
    if (stage === 'cl') return [Math.round(lo0 * 0.35), Math.round(lo0 * 0.7)];   // CL 최저 0.2억 (LCK 2020~: 6000×0.35≈2100)
    var lo = tab[b][0] * mul, hi = tab[b][1] * mul;
    if (role === 'sub') return [Math.round(lo0), Math.round(lo0 * 1.5)];          // 비주전: 최저~1.5배
    return [Math.round(lo), Math.round(hi)];
  };
  R.rollSalary = function (rng, league, year, ovr, stage, role, fame) {
    var r = R.salaryRange(league, year, ovr, stage, role);
    var t = R.clamp(rng.random() * 0.8 + (fame || 0) / 500, 0, 1);
    return Math.round((r[0] + (r[1] - r[0]) * t) / 100) * 100;
  };
  R.fmtMoney = function (m) {
    if (m === null || m === undefined) return '-';
    var a = Math.abs(m);
    if (a >= 10000) return (m / 10000).toFixed(a >= 100000 ? 0 : 1).replace(/\.0$/, '') + '억';
    return Math.round(m) + '만';
  };

  // ---------- 성격 ----------
  R.PERSONALITY = ['침착', '승부욕', '호기심', '내향적', '외향적', '장난기', '완벽주의', '낙천적', '신중', '도전적', '끈기', '냉철'];

  // ---------- 2.7 배경 ----------
  // 효과 형식: {t:'scene', scene:'lan|skr|tf|all', val, cond:'any|duel|early|late|clutch|pressure'} / {t:'growth', stats:[..]|'all', mult, months} /
  //            {t:'start', stat, val} / {t:'event', ev, mult} / {t:'men', val} / {t:'fame', val} / {t:'solo', mult}
  R.BACKGROUNDS = [
    { id: 'fgc', type: '판정', name: '격투게임 대회 출신', story: '동네 오락실 격투게임 대회를 휩쓸다 롤로 넘어왔다. 1:1 감각은 일품이지만 팀 단위 판단은 서툴다.',
      merits: [{ t: 'scene', scene: 'skr', val: 30, cond: 'duel' }], costs: [{ t: 'scene', scene: 'tf', val: -15, cond: 'any' }] },
    { id: 'fps', type: '판정', name: 'FPS 랭커', story: '슈팅게임 랭커 출신이다. 조준과 회피에는 자신 있지만 맵을 보는 눈을 따로 키워야 한다.',
      merits: [{ t: 'scene', scene: 'skr', val: 30, cond: 'any' }], costs: [{ t: 'growth', stats: ['vis'], mult: -0.1, months: 12 }] },
    { id: 'rts', type: '판정', name: 'RTS 마니아', story: '스타크래프트로 운영을 배웠다. 후반 교전 판단은 날카롭지만 손이 느리다.',
      merits: [{ t: 'scene', scene: 'tf', val: 30, cond: 'late' }], costs: [{ t: 'start', stat: 'phy', val: -20 }] },
    { id: 'chess', type: '판정', name: '체스 영재 출신', story: '어린 시절 체스 대회를 휩쓸었다. 승부처 수읽기는 좋지만 초반이 느리다.',
      merits: [{ t: 'scene', scene: 'tf', val: 30, cond: 'clutch' }], costs: [{ t: 'scene', scene: 'lan', val: -15, cond: 'early' }] },
    { id: 'rhythm', type: '판정', name: '리듬게임 고수', story: '리듬게임 올퍼펙트 기록 보유자다. 라인전 CS 타이밍은 정확하지만 교전은 감으로 한다.',
      merits: [{ t: 'scene', scene: 'lan', val: 30, cond: 'early' }], costs: [{ t: 'scene', scene: 'skr', val: -15, cond: 'any' }] },
    { id: 'taekwondo', type: '판정', name: '태권도 선수 출신', story: '도장에서 큰 대회 경험을 쌓았다. 승부처에 강하지만 팀플레이에는 서툴다.',
      merits: [{ t: 'scene', scene: 'skr', val: 30, cond: 'clutch' }], costs: [{ t: 'scene', scene: 'tf', val: -15, cond: 'any' }] },
    { id: 'viewer', type: '성장', name: '프로 경기 시청 덕후', story: '프로 경기를 수천 시간 보며 배웠다. 라인전과 한타 이해가 빠르지만 손은 따라가지 못한다.',
      merits: [{ t: 'growth', stats: ['lan', 'tf'], mult: 0.2, months: 12 }], costs: [{ t: 'growth', stats: ['phy'], mult: -0.1, months: 12 }] },
    { id: 'pcbang_coach', type: '성장', name: 'PC방 코치의 제자', story: '단골 PC방 사장님이 전 프로 출신이었다. 기본기를 제대로 배웠지만 한타 감각은 아직 어설프다.',
      merits: [{ t: 'growth', stats: 'all', mult: 0.1, months: 12 }, { t: 'scene', scene: 'lan', val: 15, cond: 'early' }], costs: [{ t: 'scene', scene: 'tf', val: -15, cond: 'any' }] },
    { id: 'debate', type: '성장', name: '토론부 에이스', story: '학교 토론부에서 상대 의도를 읽는 법을 익혔다. 시야 훈련이 잘 붙지만 손 훈련은 더디다.',
      merits: [{ t: 'growth', stats: ['vis'], mult: 0.2, months: 12 }, { t: 'event', ev: 'interview', mult: 1.3 }], costs: [{ t: 'growth', stats: ['phy'], mult: -0.1, months: 12 }] },
    { id: 'engineer', type: '성장', name: '영재학교 학생', story: '공부도 게임도 놓지 않는 영재학교 학생이다. 분석력이 좋지만 부모님 걱정이 이어진다.',
      merits: [{ t: 'growth', stats: ['vis', 'tf'], mult: 0.2, months: 12 }], costs: [{ t: 'event', ev: 'family', mult: 1.8 }] },
    { id: 'mobile', type: '성장', name: '모바일게임 랭커', story: '모바일 MOBA 랭커였다. 라인 감각이 빠르게 붙지만 PC 조작에 적응하는 데 시간이 든다.',
      merits: [{ t: 'growth', stats: ['lan'], mult: 0.2, months: 12 }], costs: [{ t: 'start', stat: 'phy', val: -20 }] },
    { id: 'veteran_dup', type: '성장', name: '복귀한 옛 연습생', story: '한 번 꿈을 접었다 돌아왔다. 압박 속에서도 침착하지만 감각이 녹슬어 있다.',
      merits: [{ t: 'men', val: 10 }, { t: 'growth', stats: 'all', mult: 0.1, months: 12 }], costs: [{ t: 'start', stat: 'tf', val: -20 }] },
    { id: 'pcbang_son', type: '이색', name: '시골 PC방 사장 아들', story: '가게 컴퓨터로 하루 종일 랭크를 돌렸다. 판수는 압도적이지만 이름은 아무도 모른다.',
      merits: [{ t: 'solo', mult: 2 }], costs: [{ t: 'event', ev: 'scout', mult: 0.7 }] },
    { id: 'idol', type: '이색', name: '아이돌 연습생 출신', story: '데뷔 직전 팀이 무산되고 롤로 진로를 틀었다. 카메라 앞에서는 여유롭지만 구설이 따라다닌다.',
      merits: [{ t: 'event', ev: 'broadcast', mult: 1.4 }, { t: 'men', val: 10 }], costs: [{ t: 'event', ev: 'flame', mult: 1.6 }] },
    { id: 'variety', type: '이색', name: "예능 '롤 고수 찾기' 우승자", story: '예능 프로그램 우승으로 얼굴이 알려졌다. 스카우터의 시선은 쏠리지만 방송용이라는 꼬리표가 붙었다.',
      merits: [{ t: 'event', ev: 'scout', mult: 1.3 }, { t: 'fame', val: 20 }], costs: [{ t: 'event', ev: 'rumor', mult: 1.6, months: 12 }] },
    { id: 'sibling', type: '이색', name: '유명 스트리머의 동생', story: '형의 방송에 자주 등장했다. 시청자가 많이 오지만 늘 형과 비교당한다.',
      merits: [{ t: 'event', ev: 'broadcast', mult: 1.5 }, { t: 'fame', val: 10 }], costs: [{ t: 'event', ev: 'flame', mult: 1.4 }] },
    { id: 'retired_pro_sib', type: '이색', name: '은퇴한 프로의 동생', story: '형이 프로 무대에서 짧게 뛰고 은퇴했다. 업계 인맥이 닿지만 비교의 부담이 크다.',
      merits: [{ t: 'event', ev: 'scout', mult: 1.3 }, { t: 'fame', val: 5 }], costs: [{ t: 'men', val: -10 }] },
    { id: 'dancer', type: '이색', name: '댄스 대회 입상자', story: '무대 위 경험이 많아 큰 자리에서도 떨지 않는다. 대신 연습 시간이 부족하다.',
      merits: [{ t: 'men', val: 10 }, { t: 'event', ev: 'interview', mult: 1.3 }], costs: [{ t: 'growth', stats: 'all', mult: -0.1, months: 12 }] }
  ];

  R.effLabel = function (e) {
    var sc = { lan: '라인전', skr: '소규모 교전', tf: '한타', all: '모든 장면' };
    var cond = { any: '', duel: '1:1 딜교환·진입 때 ', early: '초반(라인전) ', late: '25분 이후 ', clutch: '승부처 ', pressure: '압박 상황 ' };
    var sg = function (v) { return (v > 0 ? '+' : '') + v; };
    if (e.t === 'scene') return (cond[e.cond] || '') + sc[e.scene] + ' ' + sg(e.val);
    if (e.t === 'growth') return (e.stats === 'all' ? '전 능력치' : e.stats.map(function (s) { return R.STAT_SHORT[s]; }).join('·')) + ' 훈련 성장량 ' + sg(Math.round(e.mult * 100)) + '%' + (e.months ? ' (' + e.months + '개월)' : '');
    if (e.t === 'start') return '초기 ' + R.STAT_SHORT[e.stat] + ' ' + sg(e.val);
    if (e.t === 'men') return '압박 상황 멘탈 ' + sg(e.val);
    if (e.t === 'fame') return '인지도 ' + sg(e.val) + '로 시작';
    if (e.t === 'solo') return '솔로랭크 판수 ×' + e.mult;
    if (e.t === 'event') {
      var n = { scout: '스카우트 접촉', broadcast: '방송 성과', flame: '악성 여론 이벤트', rumor: '의심 루머', interview: '인터뷰 결과', family: '가족 갈등 이벤트' }[e.ev] || e.ev;
      return n + (e.mult >= 1 ? ' 유리(×' : ' 불리(×') + e.mult + ')';
    }
    return '';
  };

  // ---------- 특성 (traits.md) ----------
  function blankFx() {
    return { scene: { lan: 0, skr: 0, tf: 0 }, late: 0, clutch: 0, domClutch: 0, big: 0, intl: 0, behind: 0, finalPen: 0, worldsT: 0, worldsClutch: 0, worldsKO: 0,
      pressure: 0, failMin: 96, succMax: 5, noFail: false, clutchSucc: 0, clutchNoFail: false, clutchFloor: 0, clutchCond: false, condWorstBad: false,
      teamBoost: 0, teamBoostLast: false, enemyPressure: false, agingProb: 0, agingHalf: false, growth: 1, worldsPressure: 0 };
  }
  R.blankFx = blankFx;
  // 일반 특성 (traits.md 1절 효과 열)
  R.TRAIT_FX = {
    lane_king: function (f) { f.scene.lan += 10; },
    skirmisher: function (f) { f.scene.skr += 10; },
    teamfighter: function (f) { f.scene.tf += 10; },
    carry: function (f) { f.late += 10; },
    survivor: function (f) { f.failMin = Math.max(f.failMin, 99); },
    big_stage: function (f) { f.big += 10; },
    intl_champ: function (f) { f.intl += 5; },
    domestic_king: function (f) { f.domClutch += 10; },
    iron: function (f) { f.agingProb -= 10; },
    late_bloomer: function (f) { f.growth *= 1.2; },
    prodigy: function (f) { f.growth *= 1.3; },
    globetrotter: function () { }, flex: function () { },
    steady: function (f) { f.condWorstBad = true; },
    choker: function (f) { f.finalPen -= 10; },
    dade_award: function (f) { f.worldsT -= 10; f.worldsPressure -= 10; },
    intl_choke: function (f) { f.worldsKO -= 10; }
  };
  // 유니크 특성 효과 문장(traits.md 2절) → fx 조각 목록. 효과를 ' / '로 나눠 하나씩 해석한다.
  R.parseUniqueFx = function (text) {
    var parts = String(text || '').replace(/\*\*/g, '').replace(/\([^)]*\)/g, '').split(' / ');
    var list = [];
    parts.forEach(function (raw) {
      var s = raw.trim(), m, M = '[−\\-]';
      var re = function (rx) { m = s.match(rx); return m; };
      if (re(/^승부처 각 능력치를 max\(현재, (\d+)\)/)) list.push({ k: 'clutchFloor', v: +m[1] });
      else if (re(/^승부처 대성공 1~(\d+), 대실패 없음/)) { list.push({ k: 'clutchSucc', v: +m[1] }); list.push({ k: 'clutchNoFail', v: true }); }
      else if (/^승부처 컨디션/.test(s)) list.push({ k: 'clutchCond', v: true });
      else if (re(/^마지막 세트 한타 때 팀원 4명 \+(\d+)/)) { list.push({ k: 'teamBoost', v: +m[1] }); list.push({ k: 'teamBoostLast', v: true }); }
      else if (re(/^한타 때 팀원 4명 \+(\d+)/)) list.push({ k: 'teamBoost', v: +m[1] });
      else if (/^맞상대는 승부처에서 압박/.test(s)) list.push({ k: 'enemyPressure', v: true });
      else if (/^에이징 하락 확률 절반/.test(s)) list.push({ k: 'agingHalf', v: true });
      else if (re(new RegExp('^에이징 하락 확률 ' + M + '(\\d+)%p'))) list.push({ k: 'agingProb', v: -m[1] });
      else if (re(/성장 ×([\d.]+)/)) list.push({ k: 'growth', v: +m[1] });
      else if (/^컨디션 최악→나쁨/.test(s)) list.push({ k: 'condWorstBad', v: true });
      else if (re(/^압박 상황 멘탈 \+(\d+)/)) list.push({ k: 'pressure', v: +m[1] });
      else if (re(new RegExp('^월즈 토너먼트 승부처 ' + M + '(\\d+)'))) list.push({ k: 'worldsClutch', v: -m[1] });
      else if (re(new RegExp('^월즈 토너먼트 ' + M + '(\\d+)'))) list.push({ k: 'worldsT', v: -m[1] });
      else if (re(/^지역 리그 승부처 \+(\d+)/)) list.push({ k: 'domClutch', v: +m[1] });
      else if (re(/^25분 이후 한타 \+(\d+)/)) list.push({ k: 'late', v: +m[1] });
      else if (re(/^큰 무대 \+(\d+)/)) list.push({ k: 'big', v: +m[1] });
      else if (re(/^승부처 \+(\d+)/)) list.push({ k: 'clutch', v: +m[1] });
      else if (re(/^열세 시 \+(\d+)/)) list.push({ k: 'behind', v: +m[1] });
      else if (/^대실패 없음/.test(s)) list.push({ k: 'noFail', v: true });
      else if (re(/^대실패 (\d+)~100/)) list.push({ k: 'failMin', v: +m[1] });
      else if (re(/^대성공 1~(\d+)/)) list.push({ k: 'succMax', v: +m[1] });
      else if (re(/^라인전 \+(\d+)/)) list.push({ k: 'scene.lan', v: +m[1] });
      else if (re(/^소규모 교전 \+(\d+)/)) list.push({ k: 'scene.skr', v: +m[1] });
      else if (re(/^한타 \+(\d+)/)) list.push({ k: 'scene.tf', v: +m[1] });
    });
    return list;
  };
  var ADD = { late: 1, clutch: 1, domClutch: 1, big: 1, behind: 1, worldsT: 1, worldsClutch: 1, pressure: 1, clutchSucc: 0, teamBoost: 1, agingProb: 1, worldsKO: 1 };
  function applyPieces(f, list) {
    list.forEach(function (p) {
      var k = p.k, v = p.v;
      if (k.indexOf('scene.') === 0) f.scene[k.slice(6)] += v;
      else if (k === 'failMin') f.failMin = Math.max(f.failMin, v);
      else if (k === 'succMax') f.succMax = Math.max(f.succMax, v);
      else if (k === 'clutchSucc') f.clutchSucc = Math.max(f.clutchSucc, v);
      else if (k === 'clutchFloor') f.clutchFloor = Math.max(f.clutchFloor, v);
      else if (k === 'growth') f.growth *= v;
      else if (ADD[k]) f[k] += v;
      else f[k] = v;
    });
  }
  // 특성 id 목록 → 합친 효과. db는 LP.data.db
  R.fxOf = function (traitIds) {
    var f = blankFx(), db = LP.data && LP.data.db;
    (traitIds || []).forEach(function (id) {
      if (R.TRAIT_FX[id]) R.TRAIT_FX[id](f);
      else if (db && db.traits.unique[id]) applyPieces(f, db.traits.unique[id].fx);
    });
    if (f.noFail) f.failMin = 101;
    return f;
  };
  R.traitName = function (id) {
    var db = LP.data && LP.data.db;
    if (db && db.traits.general[id]) return db.traits.general[id].name;
    if (db && db.traits.unique[id]) return db.traits.unique[id].name;
    return id;
  };
  // 장면 보정 합 (ctx 플래그: scene, late, clutch, domestic, big, intl, behind, final, worlds, worldsKO)
  R.traitScene = function (fx, ctx) {
    var b = fx.scene[ctx.scene] || 0;
    if (ctx.scene === 'tf' && ctx.late) b += fx.late;
    if (ctx.clutch) { b += fx.clutch; if (ctx.domestic) b += fx.domClutch; if (ctx.worlds) b += fx.worldsClutch; }
    if (ctx.big) b += fx.big;
    if (ctx.intl) b += fx.intl;
    if (ctx.behind) b += fx.behind;
    if (ctx.final) b += fx.finalPen;
    if (ctx.worlds) b += fx.worldsT;
    if (ctx.worldsKO) b += fx.worldsKO;
    return b;
  };

  // ---------- 배경 효과 합산 ----------
  function condOk(c, ctx) {
    if (!c || c === 'any') return true;
    if (c === 'duel') return ctx.scene === 'skr';
    if (c === 'early') return ctx.scene === 'lan';
    if (c === 'late') return !!ctx.late;
    if (c === 'clutch') return !!ctx.clutch;
    if (c === 'pressure') return !!ctx.pressure;
    return false;
  }
  R.bgScene = function (bg, ctx) {
    var tot = 0;
    if (!bg) return 0;
    (bg.merits.concat(bg.costs)).forEach(function (e) {
      if (e.t === 'scene' && (e.scene === 'all' || e.scene === ctx.scene) && condOk(e.cond, ctx)) tot += e.val;
      if (e.t === 'men' && ctx.pressure) tot += e.val;
    });
    return tot;
  };
  R.bgEventMult = function (bg, ev, date) {
    var m = 1;
    if (!bg) return m;
    (bg.merits.concat(bg.costs)).forEach(function (e) {
      if (e.t === 'event' && e.ev === ev) {
        if (e.months && bg.expires && date > bg.expires) return;
        m *= e.mult;
      }
    });
    return m;
  };

  // ---------- 이벤트 (SPEC 7장). api는 week.js가 만든다 ----------
  // 정의: {id,title,cd(쿨다운 주),prob(s,api)->확률%, data?(s,api)->객체|null, text(s,d), options(s,d)->[{id,label,apply(api,d)->문장}]}
  var E = [];
  R.EVENTS = E;
  function ev(o) { E.push(o); }
  var inPro = function (s) { return s.career.stage === 'cl' || s.career.stage === 'pro'; };

  ev({ id: 'scout_academy', title: '아카데미 스카우트', cd: 8, scout: true,
    prob: function (s, api) { var c = R.SCOUT.academy, o = api.ovr();
      if (s.career.stage !== 'amateur' || s.soloq.mmr < c.rp || o < c.ovr || api.age() < c.minAge) return 0;
      return Math.min(c.cap, (c.base + (o - c.ovr) * c.perOvr + s.fame * 0.1) * api.evMult('scout')); },
    data: function (s, api) { return { offers: api.offers('academy', 1) }; },
    text: function (s, d) { var o = d.offers[0]; return o ? o.teamName + '(' + o.league + ')의 스카우터가 솔로랭크 기록을 보고 연락해 왔다. 연습생 입단 제안이다.' : ''; },
    options: function (s, d) { return [
      { id: 'yes', label: '제안을 수락한다', apply: function (api) { return api.join(d.offers[0]); } },
      { id: 'no', label: '정중히 거절한다', apply: function (api) { api.fame(1); return '더 해 보겠다며 제안을 거절했다.'; } }]; } });

  ev({ id: 'scout_cl', title: '2군 입단 제안', cd: 8, scout: true,
    prob: function (s, api) { var c = R.SCOUT.cl, o = api.ovr();
      if (s.career.stage === 'cl' || s.career.stage === 'pro' || api.age() < R.MIN_AGE || o < c.ovr) return 0;
      return Math.min(c.cap, (c.base + (o - c.ovr) * c.perOvr + s.fame * 0.1) * api.evMult('scout')); },
    data: function (s, api) { var of = api.offers('cl', 3); return of.length ? { offers: of } : null; },
    text: function (s, d) { return '2군 정식 계약 제안이 도착했다. 조건이 다른 ' + d.offers.length + '개 구단이 손을 내밀었다.'; },
    options: function (s, d) { return d.offers.map(function (o, i) { return { id: 'o' + i, label: o.teamName + ' (' + o.league + ') · 연봉 ' + R.fmtMoney(o.salary) + ' · ' + (o.role === 'starter' ? '주전' : '후보') + ' · ' + o.years + '년',
      apply: function (api) { return api.join(o); } }; }).concat([{ id: 'no', label: '모두 거절한다', apply: function () { return '아직 때가 아니라며 모든 제안을 거절했다.'; } }]); } });

  ev({ id: 'scout_pro', title: '1군 입단 제안', cd: 8, scout: true,
    prob: function (s, api) { var c = R.SCOUT.pro, o = api.ovr();
      if (s.career.stage === 'pro' || api.age() < R.MIN_AGE || o < c.ovr) return 0;
      var of = api.offers('pro', 1, true); if (!of.length) return 0;
      return Math.min(c.cap, (c.base + (o - c.ovr) * c.perOvr + s.fame * 0.1) * api.evMult('scout')); },
    data: function (s, api) { var of = api.offers('pro', 3); return of.length ? { offers: of } : null; },
    text: function (s, d) { return '1군 구단들이 영입 의사를 전해 왔다. ' + d.offers.length + '개 팀이 포지션 보강을 원한다.'; },
    options: function (s, d) { return d.offers.map(function (o, i) { return { id: 'o' + i, label: o.teamName + ' (' + o.league + ') · 연봉 ' + R.fmtMoney(o.salary) + ' · ' + (o.role === 'starter' ? '주전' : '후보') + ' · ' + o.years + '년',
      apply: function (api) { return api.join(o); } }; }).concat([{ id: 'no', label: '모두 거절한다', apply: function () { return '2군/연습생 신분을 유지하기로 했다.'; } }]); } });

  ev({ id: 'interview', title: '인터뷰 제의', cd: 12,
    prob: function (s, api) { return s.fame >= 15 ? 4 * api.evMult('interview') : 0; },
    text: function () { return '한 매체가 인터뷰를 요청했다. 요즘 성적과 포부를 묻겠다고 한다.'; },
    options: function () { return [
      { id: 'humble', label: '겸손하고 차분하게 답한다', apply: function (api) { if (api.check(60)) { api.fame(3); api.comm(6); return '차분한 태도가 호평을 받았다.'; } api.fame(1); return '무난하게 넘어갔지만 인상이 약했다.'; } },
      { id: 'bold', label: '자신감 있게 포부를 밝힌다', apply: function (api) { if (api.check(45)) { api.fame(6); api.comm(3); return '당찬 발언이 화제가 됐다.'; } api.fame(4); api.comm(-8); return '발언이 도발로 읽혀 논란이 됐다.'; } },
      { id: 'skip', label: '정중히 사양한다', apply: function () { return '인터뷰는 사양했다.'; } }]; } });

  ev({ id: 'stream_offer', title: '방송 제의', cd: 14,
    prob: function (s, api) { return s.fame >= 20 ? 4 * api.evMult('broadcast') : 0; },
    text: function () { return '플랫폼 담당자가 정규 방송 계약을 제안했다. 수입은 생기지만 연습 시간이 줄어든다.'; },
    options: function () { return [
      { id: 'yes', label: '정규 방송 계약을 맺는다', apply: function (api) { api.fame(6); api.money(300); api.slumpDrift(1); return '정규 방송을 시작했다. 인지도와 수입이 늘었다.'; } },
      { id: 'part', label: '가끔만 켜는 조건으로 한다', apply: function (api) { api.fame(2); api.money(80); return '가끔 방송하는 조건으로 합의했다.'; } },
      { id: 'no', label: '거절하고 연습에 집중한다', apply: function (api) { api.stat('vis', 1); return '제의를 거절하고 연습에 집중했다.'; } }]; } });

  ev({ id: 'rumor', title: '대리·핵 의심 루머', cd: 20,
    prob: function (s, api) { return (s.soloq.mmr >= 2800 && s.fame >= 5 && s.career.stage !== 'pro') ? 2.5 * api.evMult('rumor') : 0; },
    text: function () { return '커뮤니티에 "저 실력이 말이 되냐"며 대리·핵 의심 글이 올라왔다.'; },
    options: function () { return [
      { id: 'live', label: '해명 방송으로 실력을 직접 보여 준다', apply: function (api) { if (api.check(55)) { api.fame(5); api.comm(10); return '해명 방송에서 실력으로 의혹을 잠재웠다.'; } api.comm(-8); return '해명이 설득력이 약해 논란이 길어졌다.'; } },
      { id: 'ignore', label: '무시한다', apply: function (api) { api.comm(-4); return '무대응으로 일관했다. 논란은 서서히 가라앉았다.'; } },
      { id: 'legal', label: '법적 대응을 예고한다', apply: function (api) { api.money(-100); api.comm(4); return '강경 대응에 글들이 내려갔다. 변호사 비용이 들었다.'; } }]; } });

  ev({ id: 'flame', title: '커뮤니티 박제', cd: 10,
    prob: function (s, api) { var b = 1.5 + (s.community < 0 ? 1.5 : 0); return s.fame >= 10 ? b * api.evMult('flame') : 0; },
    text: function () { return '경기 중 장면이 커뮤니티에서 박제되어 비난이 이어지고 있다.'; },
    options: function () { return [
      { id: 'apology', label: '짧게 사과한다', apply: function (api) { api.comm(5); api.fame(-1); return '사과문으로 여론이 한풀 꺾였다.'; } },
      { id: 'silent', label: '침묵하고 경기로 증명한다', apply: function (api) { api.comm(-5); api.men(1); return '반응하지 않았다. 여론은 당분간 싸늘하다.'; } },
      { id: 'reply', label: '직접 반박한다', apply: function (api) { if (api.check(40)) { api.comm(6); api.fame(3); return '조리 있는 반박이 공감을 얻었다.'; } api.comm(-12); return '반박이 오히려 기름을 부었다.'; } }]; } });

  ev({ id: 'slump', title: '슬럼프', cd: 16,
    prob: function (s) { return s.p.status.slump > 0 ? 0 : 2 + (3 - s.p.hidden.men) * 1.5; },
    text: function () { return '요즘 손에 안 잡히고 자신감이 떨어졌다. 슬럼프가 시작되는 느낌이다.'; },
    options: function (s) { var o = [
      { id: 'rest', label: '며칠 쉬며 머리를 식힌다', apply: function (api) { api.slump(2); return '짧은 휴식을 택했다. 컨디션이 서서히 돌아올 것이다.'; } },
      { id: 'push', label: '버티며 더 연습한다', apply: function (api) { if (api.check(40)) { api.stat('tf', 2); api.slump(1); return '이를 악물고 버텨 슬럼프를 빨리 벗어났다.'; } api.slump(5); return '무리하다 슬럼프가 길어졌다.'; } }];
      if (s.career.stage !== 'amateur') o.push({ id: 'coach', label: '코치·멘토와 상담한다', apply: function (api) { api.slump(2); api.men(1); return '상담 후 마음이 한결 가벼워졌다.'; } });
      return o; } });

  ev({ id: 'injury', title: '손목 부상', cd: 20,
    prob: function (s) { return s.p.status.injury > 0 ? 0 : 1.2; },
    text: function () { return '손목에 통증이 왔다. 계속 하면 악화될 수 있다.'; },
    options: function () { return [
      { id: 'treat', label: '치료에 전념한다', apply: function (api) { api.injury(2); return '2주 정도 치료에 집중하기로 했다.'; } },
      { id: 'play', label: '참고 계속 뛴다', apply: function (api) { if (api.check(45)) { return '다행히 통증은 곧 가라앉았다.'; } api.injury(5); api.stat('phy', -3); return '무리한 탓에 부상이 악화돼 피지컬이 떨어졌다.'; } }]; } });

  ev({ id: 'coach_conflict', title: '감독과의 불화', cd: 20,
    prob: function (s) { return inPro(s) ? 2 + (s.p.hidden.pro <= 2 ? 2 : 0) : 0; },
    text: function () { return '전술 문제로 감독과 의견이 부딪혔다. 분위기가 어색하다.'; },
    options: function () { return [
      { id: 'talk', label: '면담으로 풀어 본다', apply: function (api) { if (api.check(55)) { api.stat('tf', 2); api.coach(8); return '면담에서 서로의 입장을 정리했다. 팀 호흡이 좋아졌다.'; } api.slump(2); api.coach(-4); return '대화가 겉돌아 서먹함이 남았다.'; } },
      { id: 'fight', label: '내 주장을 밀어붙인다', apply: function (api) { api.comm(-3); api.slump(3); api.coach(-15); return '정면충돌로 분위기가 얼어붙었다.'; } },
      { id: 'bear', label: '참고 따른다', apply: function (api) { api.men(-1); api.coach(3); return '감정을 누르고 지시를 따랐다.'; } }]; } });

  // ---------- 팀 케미·코치 신뢰 ----------
  ev({ id: 'team_dinner', title: '팀 회식', cd: 16,
    prob: function (s) { return inPro(s) ? 3 : 0; },
    text: function () { return '연패를 끊자며 주장이 팀 회식을 잡았다. 마침 개인 연습 계획도 있다.'; },
    options: function () { return [
      { id: 'go', label: '회식에 끝까지 남는다', apply: function (api) { api.chem(8); return '늦게까지 이야기를 나누며 팀원들과 가까워졌다.'; } },
      { id: 'early', label: '얼굴만 비추고 연습하러 간다', apply: function (api) { api.chem(2); api.stat('lan', 1); return '잠깐 어울리고 연습실로 돌아왔다.'; } },
      { id: 'skip', label: '연습 때문에 빠진다', apply: function (api) { api.chem(-6); api.stat('lan', 2); return '연습은 했지만 몇몇 팀원은 서운해했다.'; } }]; } });

  ev({ id: 'teammate_clash', title: '팀원과의 언쟁', cd: 18,
    prob: function (s, api) { return inPro(s) ? 2 + (api.rel().chem < 40 ? 3 : 0) : 0; },
    text: function () { return '스크림 도중 콜 문제로 같은 팀 선수와 언성이 높아졌다.'; },
    options: function () { return [
      { id: 'sorry', label: '먼저 사과하고 콜 방식을 정리한다', apply: function (api) { if (api.check(60)) { api.chem(10); return '서로 사과하고 콜 순서를 정리했다. 오히려 합이 좋아졌다.'; } api.chem(2); return '사과는 했지만 어색함이 조금 남았다.'; } },
      { id: 'coach', label: '코치에게 중재를 부탁한다', apply: function (api) { api.chem(4); api.coach(3); return '코치가 나서서 역할을 다시 나눠 줬다.'; } },
      { id: 'hold', label: '내가 맞다고 버틴다', apply: function (api) { api.chem(-12); api.men(1); return '물러서지 않았다. 팀 분위기는 가라앉았다.'; } }]; } });

  ev({ id: 'coach_feedback', title: '코치의 VOD 피드백', cd: 14,
    prob: function (s) { return inPro(s) ? 3 : 0; },
    text: function () { return '코치가 지난 경기 VOD를 보며 내 플레이의 문제를 짚었다. 받아들이기 어려운 지적도 있다.'; },
    options: function () { return [
      { id: 'accept', label: '전부 받아들이고 고친다', apply: function (api) { api.coach(6); api.stat('vis', 2); return '지적받은 부분을 하나씩 고쳤다. 코치가 만족스러워했다.'; } },
      { id: 'argue', label: '납득이 안 되는 부분은 반박한다', apply: function (api) { if (api.check(45)) { api.coach(4); api.stat('skr', 2); return '근거를 대며 설명했고, 코치도 일리가 있다며 받아들였다.'; } api.coach(-6); return '반박이 변명처럼 들렸다.'; } }]; } });

  ev({ id: 'mentor', title: '선배의 조언', cd: 26,
    prob: function (s, api) { return (inPro(s) && api.age() <= 19) ? 3 : 0; },
    text: function () { return '팀의 고참 선배가 따로 불러 프로 생활에 대해 이야기해 줬다.'; },
    options: function () { return [
      { id: 'listen', label: '진지하게 듣고 따라 한다', apply: function (api) { api.chem(5); api.men(1); return '루틴과 멘탈 관리법을 배웠다.'; } },
      { id: 'duo', label: '같이 솔랭 듀오를 부탁한다', apply: function (api) { api.chem(4); api.soloMmr(30); return '선배와 듀오로 밤새 랭크를 돌렸다.'; } }]; } });

  ev({ id: 'synergy', title: '손발이 맞기 시작했다', cd: 30,
    prob: function (s, api) { return (inPro(s) && api.rel().chem >= 70) ? 4 : 0; },
    text: function () { return '팀원들과 말하지 않아도 움직임이 맞는다. 다들 이 조합으로 오래 가고 싶어 한다.'; },
    options: function () { return [
      { id: 'ok', label: '이 분위기를 이어 간다', apply: function (api) { api.chem(3); api.stat('tf', 3); return '한타 호흡이 한층 좋아졌다.'; } }]; } });

  ev({ id: 'attitude', title: '태도 논란', cd: 24,
    prob: function (s) { return (inPro(s) && s.p.hidden.pro <= 2) ? 3 : 0; },
    text: function () { return '연습 지각과 불성실한 태도가 도마에 올랐다.'; },
    options: function () { return [
      { id: 'sorry', label: '반성하고 규칙을 지킨다', apply: function (api) { api.comm(4); return '반성문과 함께 태도를 바로잡았다.'; } },
      { id: 'ignore', label: '신경 쓰지 않는다', apply: function (api) { api.comm(-8); api.slump(2); return '무시하다 구단 경고까지 받았다.'; } }]; } });

  ev({ id: 'duo', title: '프로 선수의 듀오 제안', cd: 10,
    prob: function (s) { return (s.career.stage === 'amateur' && s.soloq.mmr >= 1600) ? 4 : 0; },
    text: function () { return '현역 프로가 듀오를 제안했다. 높은 티어에서 함께 돌려 보자고 한다.'; },
    options: function () { return [
      { id: 'yes', label: '듀오를 한다', apply: function (api) { api.soloMmr(80); api.stat('vis', 2); api.fame(2); return '듀오로 높은 티어를 경험하며 배우는 점이 많았다.'; } },
      { id: 'no', label: '혼자 올라가겠다고 한다', apply: function (api) { api.soloMmr(20); return '솔로로 꾸준히 올라가기로 했다.'; } }]; } });

  ev({ id: 'sponsor', title: '후원 제의', cd: 20,
    prob: function (s) { return (inPro(s) && s.fame >= 40) ? 3 : 0; },
    text: function () { return '주변기기 브랜드가 후원을 제안했다.'; },
    options: function () { return [
      { id: 'yes', label: '후원 계약을 맺는다', apply: function (api) { api.money(1200); api.fame(3); return '후원 계약으로 부수입이 생겼다.'; } },
      { id: 'no', label: '정중히 거절한다', apply: function (api) { api.comm(2); return '경기에 집중하겠다며 거절했다.'; } }]; } });

  ev({ id: 'bench', title: '벤치 강등 위기', cd: 16,
    prob: function (s) { return (inPro(s) && s.career.contract && s.career.contract.role === 'sub' && s.p.subWeeks >= 6) ? 6 : 0; },
    text: function () { return '한동안 출전하지 못했다. 코치진이 앞으로의 계획을 물었다.'; },
    options: function () { return [
      { id: 'train', label: '개인 연습에 매진한다', apply: function (api) { api.stat('lan', 2); api.stat('skr', 2); return '출전 기회를 위해 개인 연습에 매진했다.'; } },
      { id: 'ask', label: '출전 기회를 요청한다', apply: function (api) { if (api.check(50)) { api.promoteStarter(); return '요청이 받아들여져 주전 경쟁 기회를 얻었다.'; } api.comm(-2); return '지금은 때가 아니라는 답을 들었다.'; } },
      { id: 'wait', label: '묵묵히 기다린다', apply: function () { return '기회를 기다리기로 했다.'; } }]; } });

  ev({ id: 'transfer', title: '이적 제안', cd: 24, scout: true,
    prob: function (s, api) { return (inPro(s) && s.fame >= 20 && api.month() === 6) ? 7 : 0; },  // 여름 이적 시장(MSI 뒤 6월)만. 스토브리그 이적은 계약 만료 이벤트가 맡는다
    data: function (s, api) { var of = api.offers(s.career.stage, 2, false, true); return of.length ? { offers: of } : null; },
    text: function (s, d) { return '다른 팀에서 이적 제안이 왔다. 지금 팀과의 계약을 깨야 할 수 있다.'; },
    options: function (s, d) { return d.offers.map(function (o, i) { return { id: 'o' + i, label: o.teamName + ' (' + o.league + ') · 연봉 ' + R.fmtMoney(o.salary) + ' · ' + (o.role === 'starter' ? '주전' : '후보'),
      apply: function (api) { return api.join(o); } }; }).concat([{ id: 'no', label: '지금 팀에 남는다', apply: function (api) { api.comm(2); return '지금 팀에 남기로 했다.'; } }]); } });

  ev({ id: 'fanmeet', title: '팬 사인회', cd: 20,
    prob: function (s) { return (s.fame >= 30 && s.community >= 15) ? 3 : 0; },
    text: function () { return '팬 사인회에 초대받았다.'; },
    options: function () { return [
      { id: 'go', label: '참석해 팬과 소통한다', apply: function (api) { api.fame(4); api.comm(5); return '팬들과 즐거운 시간을 보냈다.'; } },
      { id: 'skip', label: '연습 때문에 사양한다', apply: function (api) { api.stat('lan', 1); return '연습에 집중했다.'; } }]; } });

  ev({ id: 'rival', title: '라이벌의 도발', cd: 14,
    prob: function (s) { return inPro(s) ? 3 : 0; },
    text: function () { return '같은 포지션의 라이벌이 SNS에서 은근히 도발했다.'; },
    options: function () { return [
      { id: 'reply', label: '재치 있게 받아친다', apply: function (api) { if (api.check(50)) { api.fame(3); return '재치 있는 대응에 팬들이 열광했다.'; } api.comm(-4); return '대응이 어색해 분위기가 가라앉았다.'; } },
      { id: 'ignore', label: '무시하고 경기로 보여 준다', apply: function (api) { api.men(1); return '대꾸하지 않고 투지를 불태웠다.'; } }]; } });

  ev({ id: 'patch', title: '패치로 약해진 시그니처', cd: 20,
    prob: function (s) { return (s.p.sig && s.p.sig.length) ? 3 : 0; },
    text: function (s, d) { return '패치로 시그니처 ' + d.name + '의 입지가 약해졌다. 당분간 메타 점수가 떨어진다.'; },
    data: function (s, api) { return api.patchVictim(); },
    options: function (s, d) { return [
      { id: 'swap', label: '시그니처를 새 챔피언으로 교체한다', apply: function (api) { api.markPatched(d.id); return api.swapSig(d.id); } },
      { id: 'keep', label: '시그니처를 유지하고 숙련으로 버틴다', apply: function (api) { api.markPatched(d.id); api.mastery(d.id, 3); return d.name + '을(를) 그대로 시그니처로 두기로 했다.'; } }]; } });

  ev({ id: 'newchamp', title: '새 챔피언 연습', cd: 16,
    prob: function (s, api) { return api.canNewChamp() ? 4 : 0; },
    text: function () { return '신챔피언 출시와 메타 변화로 새로 눈에 띄는 챔피언이 생겼다. 시그니처 자리를 줄 챔피언을 고를 수 있다.'; },
    data: function (s, api) { var c = api.newChampCands(); return c.length ? { cands: c } : null; },
    options: function (s, d) {
      var full = s.p.sig.length >= R.SIG_MAX;
      return d.cands.map(function (c) { return { id: 'c_' + c.id, label: c.ko + (full ? ' 추가 (숙련이 가장 낮은 시그니처와 교체)' : ' 을(를) 시그니처에 추가'), apply: function (api) { return api.addSig(c.id); } }; })
        .concat([{ id: 'no', label: '지금 구성으로 충분하다', apply: function () { return '시그니처 구성을 바꾸지 않았다.'; } }]); } });

  ev({ id: 'streak', title: '한 챔피언으로 연승', cd: 12,
    prob: function (s, api) { return api.streakChamp() ? 100 : 0; },
    text: function (s, d) { return d.name + '(으)로 공식전 ' + d.n + '연승을 달렸다. 이 챔피언을 시그니처로 올릴 수 있다.'; },
    data: function (s, api) { return api.streakChamp(true); },
    options: function (s, d) { return [
      { id: 'up', label: d.name + ' 을(를) 시그니처로 올린다' + (s.p.sig.length >= R.SIG_MAX ? ' (숙련이 가장 낮은 시그니처와 교체)' : ''), apply: function (api) { return api.addSig(d.id); } },
      { id: 'no', label: '지금은 그대로 둔다', apply: function () { return '시그니처를 바꾸지 않았다.'; } }]; } });

  ev({ id: 'family', title: '학업과 게임 사이', cd: 20,
    prob: function (s, api) { return (s.career.stage === 'amateur' && api.age() <= 17) ? 3 * api.evMult('family') : 0; },
    text: function () { return '부모님이 성적표를 보시고 게임을 줄이라고 하셨다.'; },
    options: function () { return [
      { id: 'study', label: '학업과 병행하기로 약속한다', apply: function (api) { api.slumpDrift(0); api.comm(0); api.stat('vis', 1); return '약속을 지키며 시간을 쪼개 연습하기로 했다.'; } },
      { id: 'persuade', label: '진지하게 설득한다', apply: function (api) { if (api.check(50)) { api.men(1); return '진심이 통해 응원을 받게 됐다.'; } api.slump(3); return '설득에 실패해 한동안 마음이 무거웠다.'; } }]; } });

  ev({ id: 'collab', title: '합방 제안', cd: 14,
    prob: function (s) { return s.fame >= 25 ? 3 : 0; },
    text: function () { return '유명 스트리머가 합동 방송을 제안했다.'; },
    options: function () { return [
      { id: 'yes', label: '합방한다', apply: function (api) { api.fame(5); api.money(100); return '합방으로 새 시청자를 만났다.'; } },
      { id: 'no', label: '거절한다', apply: function () { return '일정이 빠듯해 거절했다.'; } }]; } });

  // ---------- 챔피언 풀 이름 ----------
  R.CONDITION_LABELS = ['최악', '나쁨', '보통', '좋음', '최상'];

  LP.rules = R;
})(typeof window !== 'undefined' ? (window.LP = window.LP || {}) : (globalThis.LP = globalThis.LP || {}));
