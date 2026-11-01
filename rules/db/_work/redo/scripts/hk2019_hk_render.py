import csv, json, os, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk2019')
from hk_tbl import tables
D = '/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk2019'
MD = '/mnt/project-files/rules/db/_work'
EVENTS = {}
for line in open(MD + '/redo/events.txt', encoding='utf-8'):
    k, _, page = line.rstrip('\n').partition(' ')
    EVENTS[k] = page
master = {r['id'].lower(): r for r in csv.DictReader(open(MD + '/players_master.csv', encoding='utf-8'))}
def wiki(page): return 'https://lol.fandom.com/wiki/' + page.replace(' ', '_')
def placement(y, l):
    d = json.load(open(f'{D}/{y}_{l}_event.json', encoding='utf-8'))
    ts = tables(d['parse']['text']['*'])
    for t in ts:  # final placement table first
        if t and t[0][:1] == ['Place'] and 'Team' in t[0]:
            ti = t[0].index('Team'); res = [f'{r[0]} {r[ti]}' for r in t[1:] if len(r) > ti and r[0].isdigit() and r[ti]]
            if res: return res, 'Place 표'
    for t in ts:  # regular standings table (rank | team | series/games | str)
        if t and 'Team' in t[0] and any(h in t[0] for h in ('Games', 'Series')) and 'Str' in t[0]:
            ti = t[0].index('Team'); res = [f'{r[0]} {r[ti]}' for r in t[1:] if len(r) > ti and r[0].isdigit()]
            if res: return res, '순위표(정규 시즌 표)'
    return [], None
def wt_text(pg):
    f = f'{D}/wt/' + re.sub(r'[ /()]', '_', pg) + '.json'
    if not os.path.exists(f): return None
    d = json.load(open(f, encoding='utf-8'))
    return d['parse']['wikitext']['*']
def prior_honors(pg, year):
    w = wt_text(pg)
    if w is None: return None
    cut = w.find('== Tournament Results')
    body = w[:cut] if cut > 0 else w
    lines = [ln.strip() for ln in body.split('\n') if ln.strip().startswith('*') and str(year) in ln]
    keep = [re.sub(r'\[\[([^\]|]*\|)?([^\]]*)\]\]', r'\2', ln).lstrip('*').strip() for ln in lines
            if re.search(r'All-Pro|MVP|Worlds|World Championship|MSI|Mid-Season|Finals|Champion|Player of|Top-Laner|Jungler|Support|Mid-Laner|ADC|Rookie|Season', ln, re.I)]
    return keep
def render(y, l):
    data = json.load(open(f'{D}/build_{y}_{l}.json', encoding='utf-8'))
    key = f'{y}_{l}'
    page = EVENTS[key]
    pyr = str(int(y) - 1)
    places, src = placement(y, l)
    out = [f'# {y} {l} ({page})']
    out.append('순위: ' + (', '.join(places) if places else '못 찾음') + (f'  [{src}]' if src else ''))
    out.append(f'출처: {wiki(page)}/Player_Statistics (스플릿 성적), {wiki(page)} (순위)')
    out.append(f'직전 해({pyr}) 수상: 주전 5명/팀 기준 위키 수상(Individual Awards) 항목 확인. 템플릿으로 된 대회 성적은 wikitext에 없어 월즈·MSI 성적은 확인 불가 항목으로 둠.')
    out.append('')
    stat_found = 0
    for p in data['players']:
        st = p['st']
        mp = master.get(p['id'].lower())
        pg = mp['leaguepedia_page'] if mp else p['id']
        if st: stat_found += 1
        out.append(f"## {p['id']} ({p['team']}, {p['pos']}){' [주전]' if p['starter'] else ' [비주전]'}")
        if st:
            kp = st['KP']; dm = st['DMG/M']
            dtxt = f"DMG/M {dm}" if dm not in ('-', '') else 'DMG/M 표에 없음(-)'
            out.append(f"- 스플릿: G {st['G']}, W {st['W']}, L {st['L']}, KDA {st['KDA']}, KP {kp}, CS/M {st['CS/M']}, {dtxt} — {wiki(page)}/Player_Statistics (통계표 이름 {st['name']})")
        else:
            out.append(f"- 스플릿: 못 찾음 (통계표에 없음) — {wiki(page)}/Player_Statistics")
        if not p['starter']:
            out.append(f"- 직전 해: 미수집 (비주전, 조회 범위 밖)")
        else:
            h = prior_honors(pg, pyr)
            if h is None:
                out.append(f"- 직전 해: 미수집 (선수 페이지 조회 중단) — {wiki(pg)}")
            elif not h:
                out.append(f"- 직전 해: 못 찾음 ({pyr} 수상 항목 없음) — {wiki(pg)}")
            else:
                out.append(f"- 직전 해: {' ; '.join(h)} — {wiki(pg)}")
    return '\n'.join(out) + '\n', stat_found, len(data['players'])
if __name__ == '__main__':
    y, l = sys.argv[1], sys.argv[2]
    text, found, total = render(y, l)
    dst = f'{D}/ev_{y}_{l}.md'
    open(dst, 'w', encoding='utf-8').write(text)
    print(dst, 'stat found', found, 'of', total)
