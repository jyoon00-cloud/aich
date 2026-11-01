#!/usr/bin/env python3
# 연도별 능력치 통일 재계산 (formula.md 그대로). 사용: python3 -I unified.py [--dry]
import re, os, sys, csv, math, json, collections
ROOT = '/home/user/aich/rules/db'
RE = ROOT + '/_work/redo'
LEAGUES = ['LCK', 'LPL', 'LEC', 'LCS']
YEARS = list(range(2013, 2027))

# ---------------------------------------------------------------- utils
def norm(s):
    s = s.lower()
    s = re.sub(r'[^a-z0-9가-힣]+', '', s)
    return s

def num(s):
    try:
        return float(s)
    except Exception:
        return None

def pct_val(s):
    m = re.search(r'([\d.]+)\s*%', s)
    return float(m.group(1)) if m else None

# ---------------------------------------------------------------- 1. league offset
def place_score(p):
    p = str(p).strip()
    if p in ('playin', '플레이인'):
        return 0
    if p == '8강생존':
        return 3
    m = re.match(r'^(\d+)(?:-(\d+))?$', p)
    if not m:
        return None
    a = int(m.group(1))
    if a == 1: return 10
    if a == 2: return 7
    if a <= 4: return 5      # 3, 4, 3-4
    if a <= 8: return 3      # 5..8, 5-6, 7-8, 7-9?, 5-8
    return 1                 # 9위 이하

def load_worlds():
    rows = list(csv.DictReader(open(RE + '/worlds.csv', encoding='utf-8')))
    alive = list(csv.DictReader(open(RE + '/worlds2026_alive.csv', encoding='utf-8')))
    out = []
    for r in rows:
        if r['year'] == '2026' and r['event'] == 'Worlds' and r['league'] == 'tbd':
            continue
        out.append(r)
    out += alive
    return out

W_WEIGHT = {'Worlds': 1.0, 'MSI': 0.3, 'FirstStand': 0.1, 'EWC': 0.1}

def compute_offsets():
    rows = load_worlds()
    res = {}
    for y in YEARS:
        S = {}
        for lg in LEAGUES:
            s = 0.0
            for ev, w in W_WEIGHT.items():
                sc = [place_score(r['place']) for r in rows
                      if int(r['year']) == y and r['event'] == ev and r['league'] == lg]
                sc = [x for x in sc if x is not None]
                if sc:
                    s += w * sum(sc) / len(sc)
            S[lg] = s
        best = max(S.values())
        for lg in LEAGUES:
            off = -round(4 * (best - S[lg]))
            off = max(-30, min(0, off))
            res[(y, lg)] = (S[lg], off)
    return res

# ---------------------------------------------------------------- 2. parse ev
HDR = re.compile(r'^## (\S+) \((.*), (TOP|JUNGLE|MID|AD|SUP)\)\s*(\[[^\]]*\])?\s*$')

def parse_stats(line):
    """스플릿 줄 -> dict(G,W,L,KDA,KP,DMG,CS) 값 없으면 None"""
    d = dict(G=None, W=None, L=None, KDA=None, KP=None, DMG=None, CS=None)
    body = line.split('스플릿:', 1)[1]
    body = re.split(r' — ', body)[0]
    if '못 찾음' in body.split(',')[0] and 'G ' not in body:
        return d
    m = re.search(r'\bG (\d+)', body);   d['G'] = int(m.group(1)) if m else None
    m = re.search(r'\bW (\d+)', body);   d['W'] = int(m.group(1)) if m else None
    m = re.search(r'\bL (\d+)', body);   d['L'] = int(m.group(1)) if m else None
    m = re.search(r'KDA ([\d.]+)', body); d['KDA'] = float(m.group(1)) if m else None
    m = re.search(r'KP(?:AR)? ([\d.]+)%', body); d['KP'] = float(m.group(1)) if m else None
    m = re.search(r'DMG/M ([\d.]+)', body); d['DMG'] = float(m.group(1)) if m else None
    m = re.search(r'CS/M ([\d.]+)', body); d['CS'] = float(m.group(1)) if m else None
    return d

def parse_ev(y, lg):
    path = f'{RE}/ev/{y}_{lg}.md'
    lines = open(path, encoding='utf-8').read().split('\n')
    head = {'rank_line': None}
    players = collections.OrderedDict()
    cur = None
    for ln in lines:
        if ln.startswith('순위') and head['rank_line'] is None:
            head['rank_line'] = ln
            continue
        if ln.startswith('## '):
            m = HDR.match(ln)
            if m:
                pid = m.group(1)
                cur = dict(id=pid, evteam=m.group(2), pos=m.group(3), mark=m.group(4) or '',
                           stats=None, prior='', prior_ev='', url_stats='', url_ev='')
                if pid in players:  # 중복 id: 첫 항목 유지
                    cur = None
                else:
                    players[pid] = cur
            else:
                cur = None
            continue
        if cur is None:
            continue
        if ln.startswith('- 스플릿:'):
            cur['stats'] = parse_stats(ln)
            mu = re.search(r'https?://\S+', ln)
            cur['url_stats'] = mu.group(0) if mu else ''
        elif ln.startswith('- 직전 해 대회'):
            cur['prior_ev'] = ln
            mu = re.findall(r'https?://\S+', ln)
            cur['url_ev'] = mu[-1] if mu else ''
        elif ln.startswith('- 직전 해'):
            cur['prior'] = ln
    return head, players

# ---------------------------------------------------------------- 3. standings
def parse_standings(rank_line):
    """-> list of groups; group = list of (name_list, avg_rank) ; None if unavailable"""
    if not rank_line:
        return None
    s = rank_line.split('순위', 1)[1]
    s = re.split(r' — ', s)[0]
    s = re.sub(r'\s*\[[^\]]*[가-힣][^\]]*\]\s*$', '', s)
    if re.match(r'^\s*:\s*(미수집|못 찾음)', s):
        return None
    if s.lstrip().startswith(':'):
        s = s.split(':', 1)[1]
    else:
        i = s.find('):')
        s = s[i + 2:] if i >= 0 else s.split(':', 1)[1]
    s = s.strip()
    groups = []
    # 2018 LPL: 동부 지역: ... | 서부 지역: ...
    if '|' in s:
        parts = [p.split(':', 1)[1] if ':' in p else p for p in s.split('|')]
    elif '/' in s and '그룹' in s:
        parts = [p.split(':', 1)[1] if ':' in p else p for p in s.split(' / ')]
    elif re.match(r'^\s*정규시즌', s) :
        s2 = s.split(':', 1)[1] if ':' in s else s
        parts = [s2]
    else:
        parts = [s]
    for part in parts:
        part = part.strip()
        part = re.sub(r'\s*\([^()]*[가-힣][^()]*\)\s*$', '', part)  # 한글 주석 괄호 제거
        items = [x.strip() for x in part.split(', ') if x.strip()]
        g = []  # (name, rank_lo, rank_hi)
        seq = 0
        cur_rng = None
        for it in items:
            m = re.match(r'^(\d+)(?:-(\d+))?\s+(.+)$', it)
            if m:
                lo = int(m.group(1)); hi = int(m.group(2) or m.group(1))
                cur_rng = (lo, hi)
                g.append((m.group(3).strip(), lo, hi))
            elif cur_rng and cur_rng[1] > cur_rng[0]:
                g.append((it, cur_rng[0], cur_rng[1]))
            else:
                seq += 1
                g.append((it, seq, seq))
        # 번호 없는 순서열이면 seq로 이미 처리됨
        groups.append(g)
    return groups

# ---------------------------------------------------------------- 4. team matching / rank
GENERIC = {'team', 'esports', 'gaming', 'club', 'e', 'sports', 'the', 'fc', 'esport', 'ex', 'korea'}
ALIAS = {  # csv/ev 팀명 정규화 -> 순위표 표기
    'get': 'ge tigers', 'kt': 'kt rolster', 'ns': 'nongshim', 'tsm': 'team solomid',
}

def toks(name):
    t = re.findall(r'[a-z0-9가-힣]+', name.lower())
    t = [x for x in t if x not in GENERIC]
    return frozenset(t)

def match_team(team, names):
    """names: list of standing names -> matched standing name or None"""
    nt = norm(team)
    for n in names:
        if norm(n) == nt:
            return n
    a = toks(team)
    if not a:
        return None
    cands = []
    for n in names:
        b = toks(n)
        if not b:
            continue
        if a == b or a <= b or b <= a:
            cands.append(n)
    # 약어/별칭
    if not cands:
        al = ALIAS.get(team.lower())
        if al:
            for n in names:
                if toks(al) <= toks(n) or toks(n) <= toks(al):
                    cands.append(n)
    if not cands:
        # 첫 토큰 일치 (예: NS RedForce ~ Nongshim RedForce: 마지막 토큰 일치)
        la = team.lower().split()[-1]
        for n in names:
            if n.lower().split()[-1] == la and len(la) >= 5:
                cands.append(n)
    if len(cands) == 1:
        return cands[0]
    if len(cands) > 1:
        cands.sort(key=lambda n: abs(len(toks(n)) - len(a)))
        return cands[0] if len(toks(cands[0])) != len(toks(cands[1])) or True else None
    return None

def team_winrates(rows, ev):
    """csv team -> (winrate, games) : 팀에서 G 가장 많은 선수 기준"""
    best = {}
    for r in rows:
        p = ev.get(r['id'])
        if not p or not p['stats'] or p['stats']['G'] is None:
            continue
        st = p['stats']
        if st['W'] is None:
            continue
        g = st['G']
        wl = st['W'] + (st['L'] if st['L'] is not None else (g - st['W']))
        if wl <= 0:
            continue
        t = r['team']
        if t not in best or g > best[t][1]:
            best[t] = (st['W'] / wl, g)
    return best

def assign_f(rows, ev, head):
    """팀 -> (f, 방식 설명). f=0 최상위, 1 최하위."""
    teams = sorted({r['team'] for r in rows})
    wr = team_winrates(rows, ev)
    # 승률 순위 (대체용)
    order = sorted([t for t in teams if t in wr], key=lambda t: -wr[t][0])
    f_wr = {}
    i = 0
    while i < len(order):
        j = i
        while j + 1 < len(order) and abs(wr[order[j + 1]][0] - wr[order[i]][0]) < 1e-9:
            j += 1
        avg = (i + j) / 2 + 1
        for k in range(i, j + 1):
            f_wr[order[k]] = (avg - 1) / (len(order) - 1) if len(order) > 1 else 0.5
        i = j + 1
    groups = parse_standings(head['rank_line'])
    out = {}
    if not groups:
        for t in teams:
            out[t] = (f_wr.get(t, None), '승률순위' if t in f_wr else '순위·승률 없음')
        return out, '순위표 없음(미수집/못 찾음) -> 팀 승률로 순위 대체'
    matched = {}
    for g_i, g in enumerate(groups):
        names = [n for n, _, _ in g]
        for t in teams:
            if t in matched:
                continue
            n = match_team(t, names)
            if n is not None:
                matched[t] = (g_i, n)
    # 같은 이름 중복 매칭 방지는 생략 (다른 팀이 같은 순위표 이름에 걸리면 동일 순위)
    # 열린 슬롯: 범위 순위에서 이름 수 < 슬롯 수
    slots = []
    for g_i, g in enumerate(groups):
        rng = collections.defaultdict(list)
        for n, lo, hi in g:
            rng[(lo, hi)].append(n)
        for (lo, hi), ns in rng.items():
            open_ = (hi - lo + 1) - len(ns)
            for _ in range(max(0, open_)):
                slots.append((g_i, lo, hi))
    unm = [t for t in teams if t not in matched]
    unm_sorted = sorted(unm, key=lambda t: -wr[t][0] if t in wr else 0)
    slots.sort(key=lambda x: (x[1], x[0]))
    note = []
    for t in teams:
        if t in matched:
            g_i, n = matched[t]
            g = groups[g_i]
            lo, hi = [(a, b) for nn, a, b in g if nn == n][0]
            N = max(h for _, _, h in g)
            avg = (lo + hi) / 2
            out[t] = ((avg - 1) / (N - 1) if N > 1 else 0.5, f'순위표 {n} {lo}' + (f'-{hi}' if hi != lo else '') + '위')
    if unm and len(unm) <= len(slots):
        for t, (g_i, lo, hi) in zip(unm_sorted, slots):
            g = groups[g_i]
            N = max(h for _, _, h in g)
            avg = (lo + hi) / 2
            out[t] = ((avg - 1) / (N - 1) if N > 1 else 0.5, f'순위표 빈 슬롯 {lo}-{hi}위(승률순 배정)')
    else:
        for t in unm:
            out[t] = (f_wr.get(t), '순위표에 팀 없음 -> 승률순위 대체' if t in f_wr else '순위·승률 없음')
    return out, '순위표 사용'

# ---------------------------------------------------------------- 5. 직전 해 실적
ENT_RE = re.compile(r'^(.*?)\s+(\d+(?:\s*-\s*\d+)?|Q|NQ)위\s*\((.*)\)\s*$')
EXCL = re.compile(r'Qualif|Promotion|Regional|Play-?In|Placements|Challenger|Academy|\bCL\b|LDL|LSPL|Rift|Showdown|Road to|Cup|Prequal|Relegation|Gauntlet', re.I)
LEAGUE_PO = re.compile(r'^(LCK|LPL|LEC|LCS|NA LCS|EU LCS|LTA \w+) (\d{4}) .*(Playoffs|Championship|Season Finals|Grand Finals)')
OLD_CHAMP = re.compile(r'^Champions (\d{4}) (Spring|Summer|Winter)$')

def first_num(pl):
    m = re.match(r'(\d+)', pl.replace(' ', ''))
    return int(m.group(1)) if m else None

def prior_perf(p, y):
    """-> (점수, 근거 목록)"""
    py = y - 1
    items = []
    best_w = best_m = None
    fs = ewc = lpo = False
    ents = []
    if p['prior_ev']:
        body = p['prior_ev'].split(': ', 1)[1] if ': ' in p['prior_ev'] else ''
        body = re.split(r' — https?://', body)[0]
        ents = [e.strip() for e in body.split(';') if e.strip()]
    seen_w = seen_m = False
    for e in ents:
        m = ENT_RE.match(e)
        if not m:
            continue
        name, pl, team = m.group(1).strip(), m.group(2), m.group(3)
        a = first_num(pl) if pl[0].isdigit() else None
        mw = re.match(r'^Worlds (\d{4})$', name)
        if mw and int(mw.group(1)) == py and a:
            best_w = a if best_w is None else min(best_w, a)
            items.append(f'Worlds {py} {pl}위 ({team})'); continue
        if name == 'Worlds Season 3' and py == 2013 and a:
            best_w = a if best_w is None else min(best_w, a)
            items.append(f'Worlds S3 {pl}위 ({team})'); continue
        if name == 'Worlds Season 2' and py == 2012 and a:
            best_w = a if best_w is None else min(best_w, a)
            items.append(f'Worlds S2 {pl}위 ({team})'); continue
        if name == f'MSI {py}' and a:
            best_m = a if best_m is None else min(best_m, a)
            items.append(f'MSI {py} {pl}위 ({team})'); continue
        if name == f'First Stand {py}' and a == 1:
            fs = True; items.append(f'First Stand {py} 우승 ({team})'); continue
        if name == f'Esports World Cup {py}' and a == 1:
            ewc = True; items.append(f'EWC {py} 우승 ({team})'); continue
        if a == 1 and not EXCL.search(name):
            mp = LEAGUE_PO.match(name)
            mo = OLD_CHAMP.match(name)
            if (mp and int(mp.group(2)) == py) or (mo and int(mo.group(1)) == py):
                lpo = True; items.append(f'{name} 우승 ({team})')
    # 보조: 직전 해 줄의 월즈/MSI 표기 (대회 줄에 없을 때만)
    pl_line = p['prior']
    if best_w is None:
        m = re.search(r'Worlds %d 팀 성적 (?:[A-Za-z0-9.]+ )?(\d+)' % py, pl_line) or re.search(r'월즈 %d (\d+)위' % py, pl_line)
        if m:
            best_w = int(m.group(1)); items.append(f'Worlds {py} {best_w}위(직전 해 줄)')
    if best_m is None:
        m = re.search(r'MSI %d 팀 성적 (?:[A-Za-z0-9.]+ )?(\d+)' % py, pl_line) or re.search(r'MSI %d (\d+)위' % py, pl_line)
        if m:
            best_m = int(m.group(1)); items.append(f'MSI {py} {best_m}위(직전 해 줄)')
    pts = 0
    if best_w is not None:
        pts += 12 if best_w == 1 else 9 if best_w == 2 else 6 if best_w <= 4 else 3 if best_w <= 8 else 0
    if best_m is not None:
        pts += 4 if best_m == 1 else 2 if best_m == 2 else 1 if best_m <= 4 else 0
    pts += (1 if fs else 0) + (1 if ewc else 0) + (1 if lpo else 0)
    # 수상 (직전 해 것만, 최고 1개)
    aw_pts = 0
    aw_txt = ''
    m = re.search(r'수상:?\s*(.*?)(?:\s*\|\s*직전해 팀|\s*\|\s*[A-Za-z가-힣 ]*(?:팀 성적)|\s+— |$)', pl_line)
    if m:
        t = m.group(1)
        for am in re.finditer(r'([A-Za-z0-9\-\. ]*?(?:All.?Pro|MVP|Player of the Split)[A-Za-z0-9\-\. ]*?)\s*(?:x\d+\s*)?\(([^)]*)\)', t):
            nm, yrs = am.group(1).strip(), am.group(2)
            if not re.search(r'\b%d\b' % py, yrs):
                continue
            v = 0
            if re.search(r'Rookie|Finals|Worlds|MSI|Week|Team of|Role', nm) and not re.search(r'All.?Pro', nm):
                v = 0
            elif re.search(r'1st', nm): v = 6
            elif re.search(r'2nd', nm): v = 4
            elif re.search(r'3rd', nm): v = 2
            elif re.search(r'MVP|Player of the Split|Most Valuable', nm): v = 6
            if v > aw_pts:
                aw_pts = v; aw_txt = f'{nm} ({yrs})'
    if aw_pts:
        items.append(f'수상 {aw_txt}')
    return pts + aw_pts, items

# ---------------------------------------------------------------- 6. main compute
POS_FRAME = {
    'TOP': (6, 4, 2, -2, -10), 'JUNGLE': (-6, 0, 6, 4, -4), 'MID': (4, 6, 2, 0, -12),
    'AD': (4, 8, -2, 4, -14), 'SUP': (-10, -12, 4, 6, 12),
}

def pctile(x, arr):
    if x is None or not arr:
        return None
    less = sum(1 for a in arr if a < x)
    eq = sum(1 for a in arr if a == x)
    return (less + 0.5 * eq) / len(arr)

def cur_ovr(r):
    return round(sum(int(r[k]) for k in ('lan', 'phy', 'skr', 'tf', 'vis')) / 5)

def process(y, lg, offsets):
    rows_path = f'{ROOT}/{y}/{lg}.csv'
    with open(rows_path, encoding='utf-8', newline='') as f:
        rd = csv.DictReader(f)
        header = rd.fieldnames
        rows = list(rd)
    head, ev = parse_ev(y, lg)
    S, off = offsets[(y, lg)]
    fmap, fnote = assign_f(rows, ev, head)
    marked = any(p['mark'] in ('[주전]', '[주전?]') for p in ev.values())
    # 팀 경기 수
    team_g = collections.defaultdict(int)
    for r in rows:
        p = ev.get(r['id'])
        if p and p['stats'] and p['stats']['G']:
            team_g[r['team']] = max(team_g[r['team']], p['stats']['G'])
    # 주전 판정
    starter = {}
    slot = collections.defaultdict(list)
    for r in rows:
        slot[(r['team'], r['pos'])].append(r)
    for r in rows:
        starter[r['id']] = False
    for (t, pos), rs in slot.items():
        if marked:
            for r in rs:
                p = ev.get(r['id'])
                if p and p['mark'] in ('[주전]', '[주전?]'):
                    starter[r['id']] = True
        else:
            gs = [(ev[r['id']]['stats']['G'] if r['id'] in ev and ev[r['id']]['stats'] and ev[r['id']]['stats']['G'] else 0, r) for r in rs]
            gs.sort(key=lambda x: -x[0])
            if gs and gs[0][0] > 0:
                starter[gs[0][1]['id']] = True
                for g, r in gs[1:]:
                    if g >= 0.5 * team_g[t] and g > 0:
                        starter[r['id']] = True
    # 분포 (주전, 포지션별)
    dist = collections.defaultdict(lambda: collections.defaultdict(list))
    for r in rows:
        if starter[r['id']] and r['id'] in ev and ev[r['id']]['stats']:
            st = ev[r['id']]['stats']
            for k in ('KDA', 'KP', 'DMG', 'CS'):
                if st[k] is not None:
                    dist[r['pos']][k].append(st[k])
    def pcts(r):
        p = ev.get(r['id'])
        if not p or not p['stats']:
            return {}
        st = p['stats']
        out = {}
        for k in ('KDA', 'KP', 'DMG', 'CS'):
            if st[k] is not None:
                out[k] = pctile(st[k], dist[r['pos']][k])
        return out
    result = {}
    notes = {}
    for r in rows:
        if not starter[r['id']]:
            continue
        pc = pcts(r)
        if not pc:
            starter[r['id']] = False  # 근거 없음 -> 비주전 규칙
            notes[r['id']] = '주전이나 스플릿 지표 없음 -> 비주전 규칙'
            continue
        p0 = sum(pc.values()) / len(pc)
        st = ev[r['id']]['stats']
        shrunk = False
        g = st['G']
        if g is not None and team_g[r['team']] and g < team_g[r['team']] / 3:
            p0 = (p0 + 0.5) / 2
            shrunk = True
        base = round(400 + 70 * p0)
        fv = fmap.get(r['team'], (None, ''))[0]
        team = round(10 - 20 * fv) if fv is not None else 0
        prior, pitems = prior_perf(ev[r['id']], y)
        ovr = max(380, min(500, base + team + prior + off))
        result[r['id']] = dict(ovr=ovr, base=base, team=team, prior=prior, pitems=pitems,
                               shrunk=shrunk, tnote=fmap.get(r['team'], (None, ''))[1], pc=pc, p0=p0)
    # 비주전
    for r in rows:
        if r['id'] in result:
            continue
        refs = [result[x['id']]['ovr'] for x in slot[(r['team'], r['pos'])] if x['id'] in result]
        cap = 415 + off
        ovr = min(max(refs) - 15, cap) if refs else cap
        ovr = max(380, min(500, ovr))
        result[r['id']] = dict(ovr=ovr, base=None, team=None, prior=None, pitems=[],
                               shrunk=False, tnote='', pc=pcts(r), p0=None, ref=(max(refs) if refs else None))
    # 능력치
    out_rows = []
    for r in rows:
        R = result[r['id']]
        ovr = R['ovr']
        pc = R['pc']
        p = ev.get(r['id'])
        shrink = 1.0
        if p and p['stats'] and p['stats']['G'] is not None and team_g[r['team']] and p['stats']['G'] < team_g[r['team']] / 3:
            shrink = 0.5
        def q(v):
            if v is None:
                return 0.5
            return (v - 0.5) * shrink + 0.5
        cs = q(pc.get('CS')); kp = q(pc.get('KP')); kda = q(pc.get('KDA'))
        dm = q(pc.get('DMG')) if pc.get('DMG') is not None else kda
        kk = (q(pc.get('KP')) + q(pc.get('KDA'))) / 2
        prof = [cs * 20 - 10, dm * 20 - 10, kp * 20 - 10, kk * 20 - 10,
                (kp * 20 - 10) if r['pos'] in ('JUNGLE', 'SUP') else 0]
        fr = POS_FRAME[r['pos']]
        raw = [ovr + fr[i] + prof[i] for i in range(5)]
        R['raw'] = raw
        vals = fit(raw, ovr)
        keys = ('lan', 'phy', 'skr', 'tf', 'vis')
        names = ['라인전형', '캐리형', '교전형', '한타형', '운영형']
        hi = max(range(5), key=lambda i: (vals[i], -i))
        style = names[hi]
        if hi == 4 and r['pos'] == 'SUP':
            style = '보호형'
        if r['pos'] in ('JUNGLE', 'SUP') and pc.get('KP') is not None and q(pc['KP']) >= 0.8:
            style = '이니시형'
        nr = dict(r)
        for i, k in enumerate(keys):
            nr[k] = str(vals[i])
        nr['style'] = style
        R['vals'] = vals
        R['style'] = style
        out_rows.append(nr)
    return dict(header=header, rows=rows, out=out_rows, result=result, starter=starter, ev=ev,
                head=head, fnote=fnote, fmap=fmap, notes=notes, off=off, S=S, marked=marked)

def fit(raw, ovr):
    lo = [ovr - 30] * 5
    hi = [min(500, ovr + 30)] * 5
    v = list(raw)
    free = [True] * 5
    for _ in range(10):
        for i in range(5):
            if v[i] < lo[i]: v[i] = lo[i]; free[i] = False
            if v[i] > hi[i]: v[i] = hi[i]; free[i] = False
        diff = 5 * ovr - sum(v)
        fi = [i for i in range(5) if free[i]]
        if abs(diff) < 1e-9 or not fi:
            break
        d = diff / len(fi)
        for i in fi:
            v[i] += d
    iv = [int(round(x)) for x in v]
    # 합계를 5*OVR에 정수로 맞춤
    diff = 5 * ovr - sum(iv)
    order = sorted(range(5), key=lambda i: -(v[i] - iv[i]) if diff > 0 else (v[i] - iv[i]))
    k = 0
    guard = 0
    while diff != 0 and guard < 50:
        i = order[k % 5]
        step = 1 if diff > 0 else -1
        if lo[i] <= iv[i] + step <= hi[i]:
            iv[i] += step; diff -= step
        k += 1; guard += 1
    return iv

# ---------------------------------------------------------------- 7. outputs
def main():
    dry = '--dry' in sys.argv
    offsets = compute_offsets()
    os.makedirs(RE + '/changes2', exist_ok=True)
    with open(RE + '/league_offset.csv', 'w', encoding='utf-8', newline='') as f:
        f.write('year,league,S,offset\n')
        for y in YEARS:
            for lg in LEAGUES:
                S, o = offsets[(y, lg)]
                f.write(f'{y},{lg},{S:.2f},{o}\n')
    summary = []
    allres = {}
    for y in YEARS:
        for lg in LEAGUES:
            P = process(y, lg, offsets)
            allres[(y, lg)] = P
            # csv
            if not dry:
                with open(f'{ROOT}/{y}/{lg}.csv', 'w', encoding='utf-8', newline='') as f:
                    w = csv.DictWriter(f, fieldnames=P['header'], lineterminator='\n', quoting=csv.QUOTE_NONE, escapechar='\\')
                    w.writeheader()
                    for r in P['out']:
                        w.writerow(r)
            write_changes(y, lg, P)
    json.dump({f'{y}_{lg}': {k: v['ovr'] for k, v in P['result'].items()} for (y, lg), P in allres.items()},
              open(sys.argv[0].rsplit('/', 1)[0] + '/../_unified_ovr.json', 'w'))
    return allres, offsets

def write_changes(y, lg, P):
    ev = P['ev']; res = P['result']
    L = []
    L.append(f'# {y} {lg} 통일 산식 재계산 (formula.md, scripts/unified.py)')
    L.append(f'- 리그 보정: S={P["S"]:.2f}, offset={P["off"]} (worlds.csv + worlds2026_alive.csv; 2026은 월즈 8강 대진표 8팀을 생존 3점 처리: https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page=2026_Season_World_Championship/Main_Event)')
    L.append(f'- 순위 근거: {P["head"]["rank_line"] or "없음"}')
    L.append(f'- 순위 처리: {P["fnote"]}')
    L.append(f'- 주전 판정: {"ev [주전] 표시" if P["marked"] else "표시 없음 -> 팀·포지션별 G 최다 + G가 팀 경기 50% 이상"}')
    for r in P['rows']:
        pid = r['id']; R = res[pid]
        old = cur_ovr(r)
        new_vals = [int(x) for x in [P['out'][P['rows'].index(r)][k] for k in ('lan', 'phy', 'skr', 'tf', 'vis')]]
        new = round(sum(new_vals) / 5)
        p = ev.get(pid)
        st = p['stats'] if p else None
        sline = '스플릿 지표 없음'
        if st and st['G'] is not None:
            sline = f'G {st["G"]}, KDA {st["KDA"]}, KP {st["KP"]}, DMG/M {st["DMG"]}, CS/M {st["CS"]}'
        urls = []
        if p:
            if p['url_stats']: urls.append(p['url_stats'])
            if p['url_ev']: urls.append(p['url_ev'])
        us = ', '.join(urls) if urls else '출처 없음(ev에 없음)'
        if R['base'] is not None:
            pr = '; '.join(R['pitems']) if R['pitems'] else '직전 해 반영 실적 없음'
            extra = ' (출전 적어 p 보정)' if R['shrunk'] else ''
            L.append(f'- {pid}: OVR {old}→{new} = base {R["base"]}(개인, p={R["p0"]:.2f}{extra}) + team {R["team"]:+d}({R["tnote"]}) + prior {R["prior"]}({pr}) + offset {P["off"]} — 주전, {sline} — {us}')
        else:
            why = P['notes'].get(pid, '비주전')
            ref = R.get('ref')
            L.append(f'- {pid}: OVR {old}→{new} = 비주전 min({"주전 "+str(ref)+"-15" if ref is not None else "주전 없음"}, 415{P["off"]:+d}) — {why}, {sline} — {us}')
    open(f'{RE}/changes2/{y}_{lg}.md', 'w', encoding='utf-8').write('\n'.join(L) + '\n')

if __name__ == '__main__':
    main()
