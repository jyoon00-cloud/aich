# ③ 포텐·히든 산정용 선수별 커리어 요약 생성 (Opus 작성, 수집된 캐시만 사용)
import json, re, html, glob, os, csv, statistics, urllib.parse
SP = '/tmp/claude-0/-home-user-aich/e4b6817c-fe77-5839-b8af-7cf6b261834e/scratchpad'
DB = '/home/user/aich/rules/db'
TR = SP + '/opus_tr/cache'; WT = SP + '/pot_wt'
OUT = DB + '/_work/pot2/dossier'; os.makedirs(OUT, exist_ok=True)
key = lambda p: urllib.parse.quote(p.replace(' ', '_'), safe='')
api = lambda prop, p: 'https://lol.fandom.com/api.php?action=parse&format=json&prop=%s&page=%s' % (prop, urllib.parse.quote(p.replace(' ', '_')))
master = {r['id']: r for r in csv.DictReader(open(DB + '/_work/players_master.csv'))}
pot = {}
for f in sorted(glob.glob(DB + '/potential/*.csv')):
    for r in csv.DictReader(open(f)): pot.setdefault(r['id'], r)
# 연도별 OVR (교정된 값). 리그 보정 되돌림: LEC +10, LCS +20
ADJ = {'LCK': 0, 'LPL': 0, 'LEC': 10, 'LCS': 20}
ovr = {}
for f in sorted(glob.glob(DB + '/20*/*.csv')):
    y = int(f.split('/')[-2]); lg = os.path.basename(f)[:-4]
    for r in csv.DictReader(open(f)):
        v = [int(r[k]) for k in ('lan', 'phy', 'skr', 'tf', 'vis')]
        ovr.setdefault(r['id'], []).append((y, lg, r['team'], round(sum(v) / 5), round(sum(v) / 5) + ADJ[lg]))
TOP = re.compile(r'^(LCK|LPL|LEC|EU LCS|NA LCS|LCS|Champions|LTA|OGN|LoL Champions)', re.I)
INTL = re.compile(r'^(Worlds|MSI|Mid-Season|First Stand|Rift Rivals|IEM|All-Star)', re.I)
def tx(s): return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).replace('⁠', '').strip()
def tr_rows(p):
    f = TR + '/' + key(p) + '.json'
    if not os.path.exists(f): return None
    d = json.load(open(f))
    if 'error' in d: return []
    out = []
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>', d['parse']['text']['*'], re.S):
        tds = re.findall(r'<td([^>]*)>(.*?)</td>(?=<td|$)', r, re.S)
        if len(tds) < 5 or 'achievements-date' not in tds[0][0]: continue
        tm = re.search(r'title="([^"]+)"', tds[4][1])
        out.append((tx(tds[0][1]), tx(tds[1][1]), tx(tds[2][1]), html.unescape(tm.group(1)) if tm else tx(tds[4][1])))
    return out
AW = re.compile(r'All-Pro|All Pro|MVP|Player of the|of the Year|Rookie of|Finals MVP|Most Valuable', re.I)
def awards(p):
    f = WT + '/' + key(p) + '.json'
    if not os.path.exists(f): return None
    d = json.load(open(f))
    if 'error' in d: return []
    out = []
    for line in d['parse']['wikitext']['*'].split('\n'):
        if not AW.search(line) or len(line) > 400: continue
        c = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', line)
        c = re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', c); c = re.sub(r"'''?|\{\{[^{}]*\}\}|<[^>]+>", '', c)
        c = re.sub(r'\s+', ' ', c.lstrip('*|!: ')).strip()
        if c and c not in out: out.append(c[:200])
    return out[:15]
def place_num(pl):
    m = re.match(r'(\d+)', pl); return int(m.group(1)) if m else 99
ids = sorted(pot)
groups = [ids[i::6] for i in range(6)]
for gi, g in enumerate(groups, 1):
    lines = ['# 포텐·히든 산정 근거 묶음 p%d (자동 생성: build_dossier.py)' % gi, '']
    for i in g:
        m = master[i]; p = m['leaguepedia_page']; pr = pot[i]
        lines.append('## %s (%s, %s, %s년생, 데뷔 %s)' % (i, pr['name'], pr['pos'], pr['birth_year'], pr['debut_year'] or '없음'))
        lines.append('- 시즌: ' + m['seasons'])
        o = sorted(ovr.get(i, []))
        if o:
            lines.append('- 연도별 OVR(교정값, 괄호=리그보정 되돌린 값): ' + ', '.join('%d %s %d(%d)' % (y, lg, v, a) for y, lg, t, v, a in o))
            vals = [a for *_, a in o]
            lines.append('- 최고 %d, 평균 %d, 연도 간 변동(표준편차) %s' % (max(vals), round(statistics.mean(vals)), round(statistics.pstdev(vals), 1) if len(vals) > 1 else '-'))
        else:
            lines.append('- 연도별 OVR: 1부 연도별 파일에 없음 (CL 등)')
        if p == '' or (p == 'MISSING' and i != 'missing'):
            lines.append('- Leaguepedia 페이지 없음'); lines.append(''); continue
        rows = tr_rows(p)
        if rows is None: lines.append('- 대회 성적: 미수집')
        else:
            intl = [r for r in rows if INTL.match(r[2]) and 'Qualif' not in r[2]]
            dom = [r for r in rows if TOP.match(r[2]) and ('Playoff' in r[2] or 'Final' in r[2] or 'Cup' in r[2]) and place_num(r[1]) <= 2]
            yrs = sorted({r[0][:4] for r in rows if r[0][:4].isdigit()})
            lines.append('- 출전 기간: %s~%s, 대회 행 %d개' % (yrs[0] if yrs else '-', yrs[-1] if yrs else '-', len(rows)))
            lines.append('- 국제대회: ' + ('; '.join('%s %s위(%s)' % (e, pl, t) for d, pl, e, t in reversed(intl)) or '없음'))
            w = sum(1 for r in dom if place_num(r[1]) == 1); f2 = sum(1 for r in dom if place_num(r[1]) == 2)
            lines.append('- 1부 리그 플레이오프/컵 우승 %d회, 준우승 %d회: ' % (w, f2) + ('; '.join('%s %s위' % (e, pl) for d, pl, e, t in reversed(dom)) or '없음'))
        aw = awards(p)
        lines.append('- 수상(위키 원문): ' + ('미수집' if aw is None else ('; '.join(aw) or '없음')))
        lines.append('- 출처: %s , %s' % (api('text', p + '/Tournament_Results'), api('wikitext', p)))
        lines.append('- 기존 값(기억 기반, 참고만): potential %s, men %s, clutch %s, pro %s, vol %s' % (pr['potential'], pr['men'], pr['clutch'], pr['pro'], pr['vol']))
        lines.append('')
    open(OUT + '/p%d.md' % gi, 'w').write('\n'.join(lines))
print('written', [len(g) for g in groups])
