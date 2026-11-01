import csv, json, os, re, subprocess, sys, time, urllib.parse
from bs4 import BeautifulSoup

W = '/mnt/project-files/rules/db/_work'
OUT = W + '/redo/ev'
S = '/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/haiku'
CACHE = S + '/cache'
BASE = 'https://lol.fandom.com/api.php'
ZW = '⁠'
_last = [0.0]

def fname(url):
    return CACHE + '/' + re.sub(r'[^A-Za-z0-9]+', '_', url)[-180:] + '.json'

def fetch(url):
    """Return parsed JSON; uses cache, else curl with >=3s spacing and ratelimit retry."""
    fp = fname(url)
    if os.path.exists(fp):
        try:
            return json.load(open(fp, encoding='utf-8'))
        except Exception:
            pass
    for attempt in range(4):
        wait = 3 - (time.time() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.time()
        r = subprocess.run(['curl', '-sS', '--max-time', '90', url], capture_output=True, text=True)
        body = r.stdout
        try:
            d = json.loads(body)
        except Exception:
            print('BADRESP', url, r.stderr[:200], body[:200], flush=True)
            time.sleep(10)
            continue
        if 'error' in d and 'ratelimit' in json.dumps(d['error']).lower():
            print('RATELIMITED, sleeping 30s', flush=True)
            time.sleep(30)
            continue
        if 'error' in d:
            print('APIERR', url, d['error'].get('info', '')[:150], flush=True)
            return None
        json.dump(d, open(fp, 'w', encoding='utf-8'))
        return d
    return None

def clean_txt(s):
    return re.sub(r'\s+', ' ', s.replace(ZW, '').replace('\xa0', ' ')).strip()

def page_url(page, prop):
    p = page.replace(' ', '_')
    return BASE + '?action=parse&format=json&prop=' + prop + '&page=' + urllib.parse.quote(p, safe='/_:-().')

def team_short(s):
    s = clean_txt(s)
    return re.sub(r'\s\d$', '', s)  # "Samsung Galaxy 1" -> "Samsung Galaxy"

# ---- event list
events = {}
for line in open(W + '/redo/events.txt', encoding='utf-8'):
    line = line.rstrip('\n')
    if not line.strip():
        continue
    key, page = line.split(' ', 1)
    events[key] = page

# ---- players master
pm = {}
with open(W + '/players_master.csv', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        pm[r['id']] = r['leaguepedia_page']

def stats_table(d):
    soup = BeautifulSoup(d['parse']['text']['*'], 'html.parser')
    for t in soup.find_all('table'):
        if 'spstats' in (t.get('class') or []):
            return t
    for t in soup.find_all('table'):
        if 'KDA' in t.get_text(' ', strip=True) and 'CS/M' in t.get_text(' ', strip=True):
            return t
    return None

def parse_stats(d):
    t = stats_table(d)
    if t is None:
        return None, {}
    rows = t.find_all('tr')
    hdr_i = None
    for i, r in enumerate(rows):
        names = [clean_txt(c.get_text(' ', strip=True)) for c in r.find_all(['td', 'th'])]
        if 'KDA' in names and 'CS/M' in names:
            hdr_i = i
            hdr = names
            break
    if hdr_i is None:
        return None, {}
    def idx(name, nth=0):
        hits = [i for i, h in enumerate(hdr) if h == name]
        return hits[nth] if len(hits) > nth else None
    cols = {
        'G': idx('G', 0), 'W': idx('W'), 'L': idx('L'), 'KDA': idx('KDA'), 'CSM': idx('CS/M'),
        'KP': idx('KPAR') if idx('KPAR') is not None else idx('KP%'), 'DMGM': idx('DMG/M'),
    }
    out = {}
    href_team = {}
    for r in rows[hdr_i + 1:]:
        cells = r.find_all(['td', 'th'])
        if not cells:
            continue
        vals = [clean_txt(c.get_text(' ', strip=True)) for c in cells]
        if len(vals) < 3:
            continue
        name = vals[1]
        if not name:
            continue
        a = r.find('a', href=re.compile(r'^/wiki/'))
        team_link = a['href'].replace('/wiki/', '').replace('_', ' ') if a else ''
        rec = {}
        for k, i in cols.items():
            v = vals[i] if (i is not None and i < len(vals)) else ''
            rec[k] = v if v not in ('', '-') else None
        rec['team_link'] = team_link
        out[name.lower()] = rec
    return out, cols

def parse_standings(d):
    soup = BeautifulSoup(d['parse']['text']['*'], 'html.parser')
    for t in soup.find_all('table'):
        rows = t.find_all('tr')
        if len(rows) < 3:
            continue
        hdr = [clean_txt(c.get_text(' ', strip=True)) for c in rows[0].find_all(['td', 'th'])]
        if 'Team' in hdr and 'Series' in hdr:
            res = []
            for r in rows[1:]:
                cells = [clean_txt(c.get_text(' ', strip=True)) for c in r.find_all(['td', 'th'])]
                if len(cells) >= 3 and cells[0].isdigit():
                    res.append((cells[0], team_short(cells[1]), cells[2]))
            return res
    # fallback: standings table with legend header row
    for t in soup.find_all('table'):
        if 'standings' in (t.get('class') or []):
            res = []
            for r in t.find_all('tr'):
                cells = [clean_txt(c.get_text(' ', strip=True)) for c in r.find_all(['td', 'th'])]
                if len(cells) >= 3 and cells[0].isdigit() and '-' in cells[2]:
                    res.append((cells[0], team_short(cells[1]), cells[2]))
            if res:
                return res
    return None

def strip_wiki(s):
    s = re.sub(r'<ref[^>]*/>|<ref[^>]*>.*?</ref>', '', s, flags=re.S)
    for _ in range(4):
        s = re.sub(r'\{\{[^{}]*\}\}', '', s)
    s = re.sub(r'\[\[(?:[^\]|]*\|)?([^\]]*)\]\]', r'\1', s)
    s = s.replace("'''", '').replace("''", '')
    s = re.sub(r'<[^>]+>', '', s)
    return clean_txt(s)

def awards_for_year(wt, year):
    out = []
    in_sec = False
    for ln in wt.split('\n'):
        s = ln.strip()
        m = re.match(r'^(=+)\s*(.*?)\s*\1$', s)
        if m:
            in_sec = bool(re.search(r'Individual Awards|Awards|Honou?rs', m.group(2), re.I))
            continue
        if in_sec and s.startswith('*') and re.search(r'\b%d\b' % year, s):
            out.append(strip_wiki(s.lstrip('*')))
    return out

def team_history_for_year(d, year):
    soup = BeautifulSoup(d['parse']['text']['*'], 'html.parser')
    res = []
    for t in soup.find_all('table'):
        if 'player-team-history' not in (t.get('class') or []):
            continue
        for r in t.find_all('tr')[1:]:
            cells = [clean_txt(c.get_text(' ', strip=True)) for c in r.find_all(['td', 'th'])]
            if len(cells) < 5:
                continue
            dates = re.findall(r'\d{4}-\d{2}-\d{2}', cells[3])
            start = dates[0] if dates else None
            ends = re.findall(r'\d{4}-\d{2}-\d{2}', cells[4])
            end = ends[0] if ends else '9999-12-31'
            if start is None:
                continue
            if start[:4] <= str(year) and end[:4] >= str(year):
                res.append(team_short(cells[1]))
    return list(dict.fromkeys(res))

def tournaments_for_year(d, year):
    soup = BeautifulSoup(d['parse']['text']['*'], 'html.parser')
    out = []
    for t in soup.find_all('table'):
        rows = t.find_all('tr')
        if len(rows) < 2:
            continue
        cap = clean_txt(rows[0].get_text(' ', strip=True))
        if 'Tournament Results' not in cap or 'Showmatch' in cap or '1v1' in cap:
            continue
        for r in rows[2:]:
            cells = [clean_txt(c.get_text(' ', strip=True)) for c in r.find_all(['td', 'th'])]
            if len(cells) < 5:
                continue
            if cells[0].startswith(str(year)):
                out.append('%s (%s, 팀 %s)' % (cells[2], cells[1], team_short(cells[4])))
    return out


PLACE_PAGES = {
    ('Worlds', 2016): ('2016 Season World Championship', '2016_Season_World_Championship'),
    ('Worlds', 2017): ('2017 Season World Championship', '2017_Season_World_Championship'),
    ('MSI', 2016): ('2016 Mid-Season Invitational', '2016_Mid-Season_Invitational'),
    ('MSI', 2017): ('2017 Mid-Season Invitational', '2017_Mid-Season_Invitational'),
}

def placement_map(kind, year):
    """team(lower) -> (place, team_name, url) from the Worlds/MSI placement table."""
    title, slug = PLACE_PAGES[(kind, year)]
    url = page_url(title, 'text')
    d = fetch(url)
    if d is None:
        return None, url
    soup = BeautifulSoup(d['parse']['text']['*'], 'html.parser')
    res = {}
    for t in soup.find_all('table'):
        rows = t.find_all('tr')
        if not rows:
            continue
        hdr = [clean_txt(c.get_text(' ', strip=True)) for c in rows[0].find_all(['td', 'th'])]
        if not hdr or hdr[0] != 'Place' or 'Team' not in hdr:
            continue
        place = None
        for r in rows[1:]:
            cells = [clean_txt(c.get_text(' ', strip=True)) for c in r.find_all(['td', 'th'])]
            if not cells:
                continue
            if len(cells) >= 4:
                place = cells[0]
                team = cells[3]
            else:
                team = cells[-1]
            if team and place:
                res.setdefault(team_short(team).lower(), (place, team_short(team), url))
        break
    return res, url

_PM_CACHE = {}
def placement_lookup(kind, year, team):
    k = (kind, year)
    if k not in _PM_CACHE:
        _PM_CACHE[k] = placement_map(kind, year)
    m, url = _PM_CACHE[k]
    if m is None:
        return '못 찾음 (%s 표 조회 실패)' % kind, url
    hit = m.get(team_short(team).lower())
    if hit is None:
        return '목록에 없음', url
    return hit[0], url

def run_league(key):
    year, league = key.split('_')
    year = int(year)
    prior = year - 1
    skel_path = W + '/skel/%s_%s.csv' % (year, league)
    skel = list(csv.DictReader(open(skel_path, encoding='utf-8')))
    page = events[key]
    purl = page_url(page + '/Player_Statistics', 'text')
    eurl = page_url(page, 'text')
    sd = fetch(purl)
    ed = fetch(eurl)
    stats, cols = parse_stats(sd) if sd else (None, {})
    standings = parse_standings(ed) if ed else None
    print(key, 'stats rows', len(stats) if stats else None, 'standings', len(standings) if standings else None, flush=True)

    # starters: top 5 by games per team (ties at boundary included)
    by_team = {}
    for r in skel:
        by_team.setdefault(r['team'], []).append(r)
    starters = set()
    for team, rs in by_team.items():
        def g(r):
            try:
                return int(r['games'])
            except Exception:
                return 0
        rs_sorted = sorted(rs, key=g, reverse=True)
        cutoff = g(rs_sorted[4]) if len(rs_sorted) > 4 else 0
        for i, r in enumerate(rs_sorted):
            if i < 5 or (cutoff > 0 and g(r) == cutoff):
                starters.add(r['id'])

    lines = []
    lines.append('# %d %s (%s)' % (year, league, page))
    lines.append('순위 (정규 시즌 standings 기준, 플레이오프 결과 미반영): ' +
                 (', '.join('%s %s' % (p, t) for p, t, _ in standings) if standings else '못 찾음'))
    lines.append('출처: ' + eurl)
    lines.append('')

    stats_hits = 0
    for team, rs in by_team.items():
        for r in rs:
            pass
    # print per team in skel order
    seen_team = []
    for r in skel:
        if r['team'] not in seen_team:
            seen_team.append(r['team'])
    player_info = {}
    for team in seen_team:
        for r in by_team[team]:
            pid = r['id']
            is_st = pid in starters
            page_name = pm.get(pid, pid)
            st = stats.get(pid.lower()) if stats else None
            if st:
                stats_hits += 1
            lines.append('## %s (%s, %s)%s' % (pid, team, r['pos'], ' [주전]' if is_st else ''))
            if st:
                gval = st['G'] or '못 찾음'
                lines.append('- 스플릿: G %s, W %s, L %s, KDA %s, KP %s, DMG/M %s, CS/M %s — %s' % (
                    gval, st['W'] or '못 찾음', st['L'] or '못 찾음', st['KDA'] or '못 찾음',
                    (st['KP'] + '') if st['KP'] else '못 찾음', st['DMGM'] or '못 찾음 (원본 -)',
                    st['CSM'] or '못 찾음', purl))
            else:
                lines.append('- 스플릿: 못 찾음 (Player_Statistics 표에 없음) — %s' % purl)
            if not is_st:
                lines.append('- 직전 해: 비주전, 미조회')
                lines.append('')
                continue
            wurl = page_url(page_name, 'wikitext')
            turl = page_url(page_name, 'text')
            wd = fetch(wurl)
            td = fetch(turl)
            if wd is None or td is None:
                lines.append('- 직전 해(%d): 못 찾음 (선수 페이지 조회 실패) — %s' % (prior, wurl))
                lines.append('')
                continue
            wt = wd['parse']['wikitext']['*']
            aw = awards_for_year(wt, prior)
            tr = tournaments_for_year(td, prior)
            hist = team_history_for_year(td, prior)
            parts = []
            parts.append('소속 %s' % (', '.join(hist) if hist else '못 찾음'))
            if hist and prior in (2016, 2017):
                for kind in ('Worlds', 'MSI'):
                    pl, pu = placement_lookup(kind, prior, hist[0])
                    parts.append('%s %d 팀 성적 %s' % (kind, prior, pl))
            parts.append('대회 표 ' + ('; '.join(tr) if tr else '해당 연도 행 없음'))
            parts.append('수상 ' + ('; '.join(aw) if aw else '해당 연도 수상 못 찾음'))
            lines.append('- 직전 해(%d): %s — %s, %s' % (prior, ' | '.join(parts), wurl, turl))
            lines.append('')
            player_info[pid] = True
    out = '\n'.join(lines) + '\n'
    path = OUT + '/%d_%s.md' % (year, league)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(out)
    time.sleep(10)
    chk = open(path, encoding='utf-8').read()
    print('WROTE', path, len(chk), 'bytes; stats hits', stats_hits, 'of', len(skel), flush=True)
    return stats_hits, len(skel), len(starters)

if __name__ == '__main__':
    keys = sys.argv[1:]
    for k in keys:
        run_league(k)
    print('DONE', flush=True)
