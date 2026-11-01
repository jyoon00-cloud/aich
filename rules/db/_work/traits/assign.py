#!/usr/bin/env python3
# 특성 부여 (traits.md 일반 특성 표·유니크 규칙 그대로). 사용: python3 -I assign.py [--write]
import re, csv, glob, os, sys, io, collections, json
ROOT = '/home/user/aich/rules/db'
LG = ['LCK', 'LPL', 'LEC', 'LCS']
YEARS = range(2013, 2027)
SCR = '/tmp/claude-0/-home-user-aich/e4b6817c-fe77-5839-b8af-7cf6b261834e/scratchpad/traits'
WRITE = '--write' in sys.argv

def pct(x, arr):
    less = sum(1 for a in arr if a < x); eq = sum(1 for a in arr if a == x)
    return (less + 0.5 * eq) / len(arr)

# ---- potential
pot = collections.OrderedDict(); potfile = {}
for f in ['CL', 'LCK', 'LCS', 'LEC', 'LPL']:
    for r in csv.DictReader(open(f'{ROOT}/potential/{f}.csv', encoding='utf-8', newline='')):
        pot[(f, r['id'])] = r
# id가 여러 파일에 있을 수 있음: id -> 첫 행 (potential 값은 동일해야 함)
byid = {}
for (f, i), r in pot.items():
    byid.setdefault(i, r)

# ---- yearly csv + changes2
def ovr(r): return round(sum(int(r[k]) for k in ('lan', 'phy', 'skr', 'tf', 'vis')) / 5)
seasons = collections.defaultdict(list)   # id -> list of dict(year, lg, pos, ovr, starter, m)
yrow = collections.defaultdict(list)      # id -> all rows (any year)
for y in YEARS:
    for lg in LG:
        rows = list(csv.DictReader(open(f'{ROOT}/{y}/{lg}.csv', encoding='utf-8', newline='')))
        info = {}
        for ln in open(f'{ROOT}/_work/redo/changes2/{y}_{lg}.md', encoding='utf-8'):
            m = re.match(r'^- ([^:]+): OVR .*? = base .*? — 주전, G (\d+)(.*?) — (?:https?://|출처)', ln)
            if not m: continue
            tail = m.group(3)
            g = lambda k: (float(re.search(k + r' ([\d.]+)', tail).group(1)) if re.search(k + r' ([\d.]+)', tail) else None)
            info[m.group(1)] = dict(KDA=g('KDA'), KP=g('KP'), DMG=g('DMG/M'), CS=g('CS/M'))
        dist = collections.defaultdict(lambda: collections.defaultdict(list))
        pos = {r['id']: r['pos'] for r in rows}
        for i, mt in info.items():
            for k, v in mt.items():
                if v is not None and i in pos: dist[pos[i]][k].append(v)
        for r in rows:
            i = r['id']; s = dict(year=y, lg=lg, pos=r['pos'], ovr=ovr(r), starter=i in info, p={})
            if s['starter']:
                for k, v in info[i].items():
                    if v is not None: s['p'][k] = pct(v, dist[r['pos']][k])
            yrow[i].append(s)
            if s['starter']: seasons[i].append(s)

# ---- dossier
D = {}
cur = None
for f in sorted(glob.glob(f'{ROOT}/_work/pot2/dossier/p*.md')):
    for ln in open(f, encoding='utf-8'):
        m = re.match(r'## (\S+) \(', ln)
        if m: cur = m.group(1); D[cur] = dict(intl=[], win=[], runner=[], award='', src='')
        elif cur:
            if ln.startswith('- 국제대회:'):
                for e in ln.split(':', 1)[1].strip().split('; '):
                    mm = re.match(r'^(.*?) (\d+(?: - \d+)?)위\((.*)\)$', e.strip())
                    if mm: D[cur]['intl'].append((mm.group(1), mm.group(2).replace(' ', ''), mm.group(3)))
            elif ln.startswith('- 1부 리그 플레이오프/컵'):
                body = ln.split(':', 1)[1].strip()
                for e in body.split('; '):
                    mm = re.match(r'^(.*?) (\d+)위$', e.strip())
                    if mm and 'Regional' not in mm.group(1) and 'Qualif' not in mm.group(1):
                        D[cur]['win' if mm.group(2) == '1' else 'runner'].append(mm.group(1)) if mm.group(2) in ('1', '2') else None
            elif ln.startswith('- 수상(위키 원문):'):
                D[cur]['award'] = ln.split(':', 1)[1].strip()
            elif ln.startswith('- 출처:'):
                D[cur]['src'] = ln

# 월즈·MSI 주전 판정: 그 대회 출전 경기 수 기준(intl_games.csv, 팀 내 최다의 50% 이상). 없으면 연도별 파일 주전 여부.
_IG = {}
for _r in csv.DictReader(open(ROOT + '/_work/traits/intl_games.csv')):
    _IG[(int(_r['year']), _r['event'], _r['player'].replace('_', ' ').lower())] = _r['starter'] == '1'
_MP = {r['id']: r['leaguepedia_page'] for r in csv.DictReader(open(ROOT + '/_work/players_master.csv'))}
def intl_starter(i, y, ev):
    k = (y, ev, _MP.get(i, '').replace('_', ' ').lower())
    return _IG[k] if k in _IG else is_starter_in(i, y)

def is_starter_in(i, y):
    return any(s['year'] == y for s in seasons.get(i, []))

def year_of(name, ev):
    if name == 'Worlds Season 3': return 2013
    if name == 'Worlds Season 2': return 2012
    m = re.search(r'(20\d\d)', name)
    return int(m.group(1)) if m else None

MVP = {'chovy': 5, 'knight': 5, 'doinb': 4, 'rekkles': 4, 'rookie': 4, 'caps': 4, 'bdd': 3}  # 위키 수상 원문 'MVP xN (...)' 목록, 리그 시즌 MVP (Finals MVP 제외)

res = {}; why = {}; ranks = {}
uniq = {}
for (f, i), pr in pot.items():
    if f == 'CL': pass
    d = D.get(i, dict(intl=[], win=[], runner=[], award='', src=''))
    ss = seasons.get(i, [])
    cand = {}  # trait -> (ratio, tiebreak, reason)
    def pt(key, name, filt, th, excl_sup=False, rel=None):
        use = [s for s in ss if not (excl_sup and s['pos'] == 'SUP')]
        if key == 'carry': use = [s for s in use if 'DMG' in s['p']]
        if len(use) < 3: return
        def val(s):
            if key == 'teamfighter':
                return (s['p']['KP'] + s['p']['KDA']) / 2 if 'KP' in s['p'] and 'KDA' in s['p'] else None
            return s['p'].get(filt)
        vs = [val(s) for s in use]; vs2 = [v for v in vs if v is not None]
        if len(vs2) < 3: return
        q = sum(1 for v in vs2 if v >= th)
        if q * 2 >= len(vs2):
            cand[key] = ((q / len(vs2)) / 0.5, sum(vs2) / len(vs2), f'{q}/{len(vs2)}시즌 백분위 {th}↑(평균 {sum(vs2)/len(vs2):.2f})')
    pt('lane_king', '', 'CS', 0.8, True)
    pt('skirmisher', '', 'KP', 0.8)
    pt('teamfighter', '', 'KP', 0.8)
    pt('carry', '', 'DMG', 0.8, True)
    pt('survivor', '', 'KDA', 0.85)
    # 대회
    def fin(places):
        out = []
        for name, pl, team in d['intl']:
            if not (name.startswith('Worlds') or name.startswith('MSI')): continue
            if pl not in places: continue
            y = year_of(name, d)
            if y and intl_starter(i, y, 'Worlds' if name.startswith('Worlds') else 'MSI'): out.append(name)
        return out
    finals = fin(('1', '2')); wins = fin(('1',)); loses_intl = fin(('2',))
    anyworld = [1 for n, p, t in d['intl'] if (n.startswith('Worlds') and p == '1')]
    if len(finals) >= 3: cand['big_stage'] = (len(finals) / 3, 0, f'월즈·MSI 결승 진출 {len(finals)}회(' + ', '.join(finals) + ')')
    wwins = [n for n in wins if n.startswith('Worlds')]
    if wwins: cand['intl_champ'] = (len(wwins) / 1, 0, f'월즈 우승 주전 {len(wwins)}회(' + ', '.join(wwins) + ')')
    dw = [n for n in d['win'] if year_of(n, d) and is_starter_in(i, year_of(n, d))]
    if len(dw) >= 5 and not anyworld: cand['domestic_king'] = (len(dw) / 5, 0, f'리그 플레이오프 우승 {len(dw)}회, 월즈 우승 0')
    yrs = sorted({s['year'] for s in ss})
    if len(yrs) >= 10: cand['iron'] = (len(yrs) / 10, 0, f'1부 주전 {len(yrs)}시즌')
    # late bloomer
    if ss:
        first = min(ss, key=lambda s: s['year']); best = max(ss, key=lambda s: (s['ovr'], -s['year']))
        deb = int(pr['debut_year']) if pr['debut_year'] else first['year']
        if best['ovr'] - first['ovr'] >= 40 and best['year'] >= deb + 2:
            cand['late_bloomer'] = ((best['ovr'] - first['ovr']) / 40, 0, f"첫 주전 {first['year']} OVR {first['ovr']} → 최고 {best['year']} OVR {best['ovr']}(데뷔 {deb})")
    # prodigy
    pr_reason = None; pr_ratio = 0
    deb = int(pr['debut_year']) if pr['debut_year'] else None
    if deb:
        dr = [s for s in yrow.get(i, []) if s['year'] == deb]
        if dr and max(s['ovr'] for s in dr) >= 455:
            o = max(s['ovr'] for s in dr); pr_reason = f'데뷔({deb}) OVR {o}'; pr_ratio = o / 455
    rk = [p.strip() for p in re.split(r';|\. ', d['award']) if 'Rookie' in p and re.search(r'LCK|LPL|LEC|LCS|EU |NA |KR |LTA', p) and not re.search(r'CL|Esports|runner', p)]
    if rk and not pr_reason:
        pr_reason = '신인상: ' + rk[0][:60]; pr_ratio = 1.0
    if pr_reason: cand['prodigy'] = (pr_ratio, 0, pr_reason)
    # globetrotter
    lgs = sorted({s['lg'] for s in ss})
    if len(lgs) >= 2: cand['globetrotter'] = (len(lgs) / 2, 0, '주전 리그 ' + '/'.join(lgs))
    ps = sorted({s['pos'] for s in ss})
    if len(ps) >= 2: cand['flex'] = (len(ps) / 2, 0, '주전 포지션 ' + '/'.join(ps))
    if pr['vol'] in ('1', '2') and len(yrs) >= 5: cand['steady'] = (len(yrs) / 5, 0, f"vol {pr['vol']}, 주전 {len(yrs)}시즌")
    loss = len(loses_intl) + sum(1 for n in d['runner'] if year_of(n, d) and is_starter_in(i, year_of(n, d)))
    if int(pr['clutch']) <= -1 and loss >= 3: cand['choker'] = (loss / 3, 0, f"clutch {pr['clutch']}, 결승 패배 {loss}회")
    order = sorted(cand, key=lambda k: (-cand[k][0], -cand[k][1], k))
    ranks[(f, i)] = order
    res[(f, i)] = order
    why[(f, i)] = {k: cand[k][2] for k in order}
    # 유니크 대상
    wc = len(wwins)
    mv = MVP.get(i, 0)
    reasons = []
    if int(pr['potential']) >= 490: reasons.append(f"potential {pr['potential']}")
    if wc >= 2: reasons.append(f'월즈 우승 주전 {wc}회')
    if mv >= 3: reasons.append(f'리그 MVP {mv}회')
    if reasons: uniq[(f, i)] = (reasons, wc, mv, [(k, cand[k][2]) for k in order])

# ---- 출력
CAP = lambda k: res[k][:3]
if WRITE:
    for f in ['CL', 'LCK', 'LCS', 'LEC', 'LPL']:
        p = f'{ROOT}/potential/{f}.csv'
        raw = open(p, 'rb').read().decode('utf-8')
        crlf = '\r\n' in raw
        rd = list(csv.reader(io.StringIO(raw, newline='')))
        hdr = rd[0]
        if hdr[-1] == 'traits': hdr = hdr[:-1]; rd = [r[:-1] for r in rd]
        out = [hdr + ['traits']]
        for r in rd[1:]:
            k = (f, r[0]); t = list(CAP(k))
            tr = ([r[0] + '_u'] if k in uniq else []) + t
            out.append(r + [';'.join(tr)])
        buf = io.StringIO(); w = csv.writer(buf, lineterminator='\r\n' if crlf else '\n'); w.writerows(out)
        open(p, 'wb').write(buf.getvalue().encode('utf-8'))
json.dump({'res': {f'{k[0]}:{k[1]}': v for k, v in res.items()}, 'uniq': {f'{k[0]}:{k[1]}': v for k, v in uniq.items()}, 'why': {f'{k[0]}:{k[1]}': v for k, v in why.items()}}, open(SCR + '/result.json', 'w'), ensure_ascii=False)
cnt = collections.Counter(t for k, v in res.items() for t in v[:3])
full = collections.Counter(t for k, v in res.items() for t in v)
print('부여(상위3):', dict(cnt)); print('조건충족(전체):', dict(full))
print('유니크:', len(uniq)); 
for k, v in uniq.items(): print(k[1], v[0], [x[0] for x in v[3]])

# ---- 로그·유니크 대상 문서
NICK = {  # id: (별명, 출처 페이지)  Leaguepedia 선수 페이지 wikitext의 nickname 문구. 없으면 「닉네임」
    '369': ('The Dice Man', '369'), 'bdd': ('Boddong (보똥)', 'Bdd'), 'caps': ('Baby Faker', 'Caps'),
    'chovy': ('Anchovy', 'Chovy'), 'deft': ('Alpaca (알파카)', 'Deft'), 'faker': ('불사대마왕 (Unkillable Demon King)', 'Faker'),
    'gumayusi': ('Unkillable Demon Prince', 'Gumayusi'), 'imp': ('Doubleimp', 'Imp'), 'kiin': ('Kiinsante', 'Kiin'),
    'rekkles': ('欧洲成哥 (European WeiXiao)', 'Rekkles'), 'rookie': ('Faker Junior', 'Rookie'),
    'teddy': ('Walking Nexus', 'Teddy'), 'uzi': ('小狗 (Puppy)', 'Uzi_(Jian_Zi-Hao)'),
}
PAGE = {}
cur = None
for f in glob.glob(f'{ROOT}/_work/pot2/dossier/p*.md'):
    for ln in open(f, encoding='utf-8'):
        m = re.match(r'## (\S+) \(', ln)
        if m: cur = m.group(1)
        mm = re.search(r'prop=wikitext&page=(\S+)', ln)
        if ln.startswith('- 출처:') and mm: PAGE[cur] = mm.group(1)
PAGE.update({'uzi': 'Uzi_(Jian_Zi-Hao)', 'wolf': 'Wolf_(Lee_Jae-wan)', 'knight': 'Knight_(Zhuo_Ding)'})
NAMES = {'ruler': 'Ruler'}
HOF = {'faker', 'uzi', 'caps'}
if WRITE:
    byname = {}
    for (f, i), pr in pot.items(): byname.setdefault(i, pr)
    # 특성별 인원(사람 단위)
    persons = {}
    for (f, i), v in res.items(): persons.setdefault(i, v)
    L = ['# 특성 부여 판정 근거 (assign.py)', '',
         '해석: 백분위는 같은 연도·리그 파일의 같은 포지션 주전끼리(unified.py 방식, 동률은 중간 순위). 주전은 changes2에서 "주전, G n" 표기 + 지표가 있는 시즌.',
         '월즈·MSI 결승·우승은 그 대회 출전 경기 수가 팀 내 최다의 50% 이상일 때 주전으로 센다(intl_games.csv). 리그 결승·우승은 해당 연도 파일에서 주전일 때만 센다. 연도별 파일이 없는 해(2012 등)는 세지 않는다. 리그 플레이오프 집계에서 Regional Finals는 제외했다.',
         'late_bloomer의 "3년 차"는 데뷔 연도+2년 이후, 최고 OVR은 주전 시즌 중에서 본다. prodigy 신인상은 LCK·LPL·LEC/EU·LCS/NA·LTA 신인상(CL·Esports Awards 제외).',
         '선택: 조건을 만족한 특성이 4개 이상이면 (달성 수치/기준치) 큰 순으로 3개. 백분위형은 (조건을 넘은 시즌 비율/0.5), 횟수형은 (횟수/기준), late_bloomer는 (OVR 상승/40), prodigy는 (OVR/455 또는 신인상 1.0). 동률은 평균 백분위.',
         '리그 MVP 3회 이상은 위키 수상 원문의 "MVP xN (시즌 목록)" 문구로 직접 판정: chovy 5, knight 5, doinb 4, rekkles 4, rookie 4, caps 4(split MVP x3 + season MVP x1), bdd 3. (dade는 시즌 MVP 2회, smeb 2회 등 3회 미만)', '']
    tc = collections.Counter(t for v in persons.values() for t in v[:3])
    fc = collections.Counter(t for v in persons.values() for t in v)
    L.append('## 특성별 부여 인원 (선수 수, 중복 id 한 번만)')
    L.append('| 특성 | 부여(상위3 채택) | 조건 충족 전체 |'); L.append('|---|---|---|')
    for t in ['lane_king','skirmisher','teamfighter','carry','survivor','big_stage','intl_champ','domestic_king','iron','late_bloomer','prodigy','globetrotter','flex','steady','choker']:
        L.append(f'| {t} | {tc[t]} | {fc[t]} |')
    L += ['', f'유니크 대상 {len({k[1] for k in uniq})}명. 특성이 하나라도 있는 선수 {sum(1 for v in persons.values() if v)}명 / 전체 {len(persons)}명.', '', '## 선수별 부여 이유']
    for i, v in persons.items():
        if not v: continue
        k = [kk for kk in res if kk[1] == i][0]
        L.append(f"- {i}: " + ' / '.join(f"{t}({why[k][t]})" for t in v[:3]) + (' [4위 이하 탈락: ' + ', '.join(v[3:]) + ']' if len(v) > 3 else ''))
    open(f'{ROOT}/_work/traits/log.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    U = ['# 유니크 대상 (assign.py 판정)', '',
         '형식: id | 이름(별명) | 근거 요약 | 출처 URL. traits 열에는 `{id}_u` + 만족한 일반 특성 최대 3개를 적었다. 별명은 Leaguepedia 선수 페이지 wikitext의 nickname 문구, 없으면 「닉네임」.', '']
    seen = set()
    for (f, i), (reasons, wc, mv, tr) in uniq.items():
        if i in seen: continue
        seen.add(i)
        ss = seasons.get(i, [])
        avg = {}
        for k2, lab in (('KDA','KDA'),('KP','KP'),('DMG','DMG/M'),('CS','CS/M')):
            vs = [s['p'][k2] for s in ss if k2 in s['p'] and not (k2 == 'CS' and s['pos'] == 'SUP')]
            if len(vs) >= 3: avg[lab] = sum(vs) / len(vs)
        top = sorted(avg.items(), key=lambda x: -x[1])[:2]
        nick = NICK.get(i, None)
        nm = byname[i]['name']
        disp = f'{nm} ({nick[0]})' if nick else f'{nm} 「{nm}」'
        pg = PAGE.get(i, nm)
        gen = ', '.join(t for t, _ in tr[:3]) or '없음'
        allg = ', '.join(t for t, _ in tr) or '없음'
        base = '; '.join(reasons) + ('' if wc >= 2 else f'; 월즈 우승 주전 {wc}회') + ('' if mv >= 3 else f'; 리그 MVP {mv}회')
        tops = ', '.join(f'{a} 평균 백분위 {b:.2f}' for a, b in top) or '지표 부족'
        src = f'https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page={pg}'
        U.append(f"{i} | {disp} | {base}; 대표 지표: {tops}; 만족 일반 특성(우선순위순): {allg}, traits 열 채택: {gen}" + (' (명예의 전당)' if i in HOF else '') + f' | {src}')
    open(f'{ROOT}/_work/traits/unique_targets.md', 'w', encoding='utf-8').write('\n'.join(U) + '\n')
