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
