#!/usr/bin/env python3
"""rules/db/competition.md -> app/data/schedule.json
출처는 competition.md뿐이다. 없는 값은 null. 실행: python3 app/tools/build_schedule.py (저장소 루트에서)
"""
import re, json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(ROOT, 'rules', 'db', 'competition.md')
OUT = os.path.join(ROOT, 'app', 'data', 'schedule.json')

LEAGUE_MAP = [('LCK', 'LCK'), ('LPL', 'LPL'), ('EU LCS', 'LEC'), ('LEC', 'LEC'),
              ('NA LCS', 'LCS'), ('LTA North', 'LCS'), ('LCS', 'LCS')]
REGION = {'KR': 'LCK', 'CN': 'LPL', 'EU': 'LEC', 'NA': 'LCS', '아메리카': 'LCS'}
DATE = r'(\d{4}-\d\d-\d\d)~(\d{4}-\d\d-\d\d)'
SKIP = ('Promotion', 'Placements', 'RF', 'Qualifying')
PO_WORDS = ('Playoffs', 'Play-In', 'Road to MSI', 'Championship', 'Finals', 'Showdown', '플레이오프')


def league_of(label):
    for k, v in LEAGUE_MAP:
        if label.startswith(k):
            return v
    return None


def parse_md():
    years, y, lg, cur = {}, None, None, None
    for line in open(SRC, encoding='utf-8').read().split('\n'):
        m = re.match(r'^## (20\d\d)$', line)
        if m:
            y = m.group(1); years[y] = {'leagues': {}, 'intl': {}}; lg = None; continue
        m = re.match(r'^### (.+)$', line)
        if m and y:
            lab = m.group(1)
            if lab.startswith('국제대회'):
                lg = 'INTL'
            else:
                lg = league_of(lab)
            cur = {'label': lab}
            if lg == 'INTL':
                years[y]['intl'] = cur
            elif lg:
                years[y]['leagues'][lg] = cur
            continue
        m = re.match(r'^- ([^:]+): (.*)$', line)
        if m and y and lg and cur is not None:
            cur[m.group(1)] = m.group(2)
    return years


def segment(text, name, names):
    """text 안에서 name이 나오는 곳부터 다른 대회 이름이 나오기 전까지."""
    if not text:
        return None
    key = name.split(' ')[0] if name.startswith(('Spring', 'Summer', 'Winter')) else name
    i = text.find(key)
    if i < 0:
        return text
    ends = [text.find(n.split(' ')[0] if n.startswith(('Spring', 'Summer', 'Winter')) else n, i + len(key))
            for n in names if n != name]
    ends = [e for e in ends if e > i]
    return text[i:min(ends)] if ends else text[i:]


def parse_splits(text, year):
    """스플릿 줄 -> 대회 목록(split) + 플레이오프 기간(po)."""
    if not text:
        return []
    main = re.split(r'\(그 외', text)[0]
    items = []
    for m in re.finditer(DATE, main):
        s, e = m.group(1), m.group(2)
        pre = main[:m.start()]
        cut = max(pre.rfind(','), pre.rfind('.'), pre.rfind('('), pre.rfind(')'))
        name = pre[cut + 1:].strip()
        name = re.sub(r'^\d차\s*', '', name).strip()
        post = main[m.end():]
        pm = re.match(r'\(([^()]*?)플레이오프 (\d\d-\d\d)~(\d\d-\d\d)', post)
        po = None
        if pm:
            po = ('%s-%s' % (s[:4], pm.group(2)), '%s-%s' % (s[:4], pm.group(3)))
        items.append({'name': name, 'start': s, 'end': e, 'po': po})
    splits, pos = [], []
    for it in items:
        n = it['name']
        if any(k in n for k in SKIP) or not it['start'].startswith(year):
            continue
        if any(k in n for k in PO_WORDS) and n not in ('Playoffs',):
            pos.append(it); continue
        splits.append(it)
    for p in pos:
        host = None
        for s in splits:
            if s['start'] < p['start']:
                host = s
        if host is None:
            continue
        a, b = p['start'], p['end']
        if host['po']:
            a, b = min(a, host['po'][0]), max(b, host['po'][1])
        host['po'] = (a, b)
        host.setdefault('po_names', []).append(p['name'])
    return splits


def first_int(pat, t):
    if not t:
        return None
    m = re.search(pat, t)
    return int(m.group(1)) if m else None


def build_league(lgdata, year):
    names_all = None
    splits = parse_splits(lgdata.get('스플릿'), year)
    names = [s['name'] for s in splits]
    reg_t, po_t, rel_t, dr_t = (lgdata.get(k) for k in ('정규시즌', '플레이오프', '승강제/2군 리그', '드래프트 규칙'))
    out = []
    for i, s in enumerate(splits):
        nm = s['name']
        rseg = segment(reg_t, nm, names) if reg_t else None
        pseg = segment(po_t, nm, names) if po_t else None
        # 정규
        teams = first_int(r'(\d+)팀', rseg) or first_int(r'(\d+)팀', reg_t)
        bo = first_int(r'Bo(\d)', rseg) or first_int(r'Bo(\d)', reg_t)
        rr = None
        t = rseg or ''
        if '4회 RR' in t: rr = 4
        elif '3회 RR' in t: rr = 3
        elif '더블 RR' in t: rr = 2
        elif '싱글 RR' in t: rr = 1
        elif '더블 RR' in (reg_t or ''): rr = 2
        elif '싱글 RR' in (reg_t or ''): rr = 1
        # 플레이오프
        po_n = None
        for mm in re.finditer(r'(\d+)팀', pseg or ''):
            if re.match(r'\s*(MSI|월즈|First|EWC|직행|진출|바이|탈락)', (pseg or '')[mm.end():mm.end() + 8]):
                continue
            if 4 <= int(mm.group(1)) <= 16:
                po_n = int(mm.group(1)); break
        po_bo = first_int(r'Bo(\d)', pseg)
        if po_bo is not None and not 3 <= po_bo <= 5:
            po_bo = None
        if bo is not None and not 1 <= bo <= 3:
            bo = None
        po_bo_r1 = first_int(r'1라운드 Bo(\d)', pseg)
        # 드래프트
        draft = None
        if dr_t:
            draft = '일반'
            cup = any(k in nm for k in ('Cup', 'Lock', 'Versus', 'Winter'))
            for st in re.split(r'[.]\s*', dr_t):
                for cl in re.split(r'[,]\s*', st):
                    if '피어리스' not in cl or '언급 없음' in cl or cl.startswith('일반'):
                        continue
                    if nm in cl or nm.split(' ')[0] in cl or ('정규' in cl and not cup):
                        draft = '피어리스'
            if dr_t.startswith('피어리스') or dr_t.startswith('하드 피어리스'):
                draft = '피어리스'
        out.append({
            'id': 's%d' % i, 'name': nm, 'start': s['start'], 'end': s['end'],
            'po_start': s['po'][0] if s['po'] else None, 'po_end': s['po'][1] if s['po'] else None,
            'teams': teams, 'rr': rr, 'bo': bo,
            'po_teams': po_n, 'po_bo': po_bo, 'po_bo_r1': po_bo_r1,
            'draft': draft,
            'raw': {'regular': rseg, 'playoff': pseg},
        })
    return {
        'label': lgdata.get('label'),
        'tournaments': out,
        'relegation': rel_t,
        'raw': {k: lgdata.get(k) for k in ('스플릿', '정규시즌', '플레이오프', '승강제/2군 리그', '드래프트 규칙')},
    }


def parse_intl_event(text):
    if not text or text.startswith('없음') or text.startswith('취소'):
        return None if not text else {'held': False, 'raw': text, 'start': None, 'end': None, 'slots': None, 'teams': None}
    m = re.search(DATE, text)
    slots = {}
    for k, lg in REGION.items():
        mm = re.search(r'(?<![A-Za-z])%s\s*(\d)' % re.escape(k), text)
        if mm:
            slots[lg] = int(mm.group(1))
    teams = first_int(r'(\d+)팀', text)
    place = None
    if m:
        pm = re.search(r',\s*([^,.:]*?)[.:(]', text[m.end():])
        place = pm.group(1).strip() if pm else None
    return {'held': True, 'start': m.group(1) if m else None, 'end': m.group(2) if m else None,
            'teams': teams, 'slots': slots or None, 'place': place, 'raw': text}


def build_intl(d, leagues):
    r = {'msi': parse_intl_event(d.get('MSI')), 'worlds': parse_intl_event(d.get('월즈')),
         'selection': d.get('선발 방식'), 'first_stand': None, 'ewc': None}
    for lg in leagues.values():
        blob = ' '.join(str(lg['raw'].get(k) or '') for k in lg['raw'])
        if 'First Stand' in blob:
            r['first_stand'] = {'start': None, 'end': None, 'note': 'competition.md 리그 절에서만 언급(날짜 없음)'}
        if 'EWC' in blob:
            r['ewc'] = {'start': None, 'end': None, 'note': 'competition.md 리그 절에서만 언급(날짜 없음)'}
    return r


def main():
    years = parse_md()
    out = {'source': 'rules/db/competition.md', 'years': {}}
    for y, d in sorted(years.items()):
        lgs = {k: build_league(v, y) for k, v in d['leagues'].items()}
        out['years'][y] = {'leagues': lgs, 'intl': build_intl(d['intl'], lgs)}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', OUT, len(out['years']), 'years')


if __name__ == '__main__':
    main()
