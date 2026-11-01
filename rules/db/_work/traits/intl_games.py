# 월즈·MSI 대회별 선수 출전 경기 수 (Opus 작성). 주전 = 그 대회에서 팀 내 최다 출전의 50% 이상.
import csv, json, re, html, subprocess, time, urllib.parse, os
DB = '/home/user/aich/rules/db'
OUT = DB + '/_work/traits/intl_games.csv'
def get(u):
    for a in range(4):
        o = subprocess.run(['curl', '-sS', '-m', '60', u], capture_output=True, text=True).stdout
        try: return json.loads(o)
        except Exception: time.sleep(20)
    return {}
ev = sorted({(r['event'], r['year'], r['source'].split('page=')[-1]) for r in csv.DictReader(open(DB + '/_work/redo/worlds.csv')) if r['event'] in ('Worlds', 'MSI') and 'page=' in r['source']})
rows = []
for e, y, page in ev:
    base = urllib.parse.unquote(page).replace('_', ' ').split('/')[0]
    q = get('https://lol.fandom.com/api.php?action=query&list=prefixsearch&format=json&pslimit=100&pssearch=' + urllib.parse.quote(base + '/'))
    titles = [x['title'] for x in q.get('query', {}).get('prefixsearch', []) if x['title'].startswith(base + '/') and x['title'].endswith('Player Statistics')]
    cum = [t for t in titles if 'Cumulative' in t]
    use = cum or [t for t in titles if t.count('/') <= 2] or [base + '/Player Statistics']
    time.sleep(2)
    for t in use:
        d = get('https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page=' + urllib.parse.quote(t.replace(' ', '_')))
        time.sleep(2)
        if 'parse' not in d: continue
        for r in re.findall(r'<tr[^>]*>(.*?)</tr>', d['parse']['text']['*'], re.S):
            cells = re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)
            if len(cells) < 4: continue
            tm = re.search(r'title="([^"]+)"', cells[0]); pl = re.search(r'title="([^"]+)"', cells[1])
            g = re.sub(r'<[^>]+>', '', cells[2]).strip()
            if tm and pl and g.isdigit():
                rows.append(dict(year=y, event=e, page=t, team=html.unescape(tm.group(1)), player=html.unescape(pl.group(1)), G=int(g)))
    print(e, y, len(use), flush=True)
# 여러 단계 합산
agg = {}
for r in rows:
    k = (r['year'], r['event'], r['team'], r['player']); agg[k] = agg.get(k, 0) + r['G']
mx = {}
for (y, e, t, p), g in agg.items(): mx[(y, e, t)] = max(mx.get((y, e, t), 0), g)
with open(OUT, 'w', newline='') as f:
    w = csv.writer(f); w.writerow(['year', 'event', 'team', 'player', 'G', 'team_max', 'starter'])
    for (y, e, t, p), g in sorted(agg.items()):
        w.writerow([y, e, t, p, g, mx[(y, e, t)], int(g * 2 >= mx[(y, e, t)])])
print('rows', len(agg))
