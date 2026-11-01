import csv, json, os, re, sys
sys.path.insert(0, '/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk2019')
from hk_tbl import tables
MD = '/mnt/project-files/rules/db/_work'
D = '/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk2019'
def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())
ALIAS = {'sw0rd': 'sword', 'bon0': 'bono', 'meteor': 'metoer', 'knight': 'knight9', 'chel1y': 'chelly', 'crownie': None, 'tore': None}
master = list(csv.DictReader(open(MD + '/players_master.csv', encoding='utf-8')))
mbyid = {r['id'].lower(): r for r in master}
def stats_rows(y, l):
    d = json.load(open(f'{D}/{y}_{l}_stats.json', encoding='utf-8'))
    tbls = tables(d['parse']['text']['*'])
    out = {}
    for t in tbls:
        hdr = next((r for r in t if 'KDA' in r and 'CS/M' in r), None)
        if not hdr: continue
        for r in t:
            if len(r) < 23 or r is hdr or not r[1].strip() or r[1] == hdr[1]: continue
            out.setdefault(norm(r[1]), {'name': r[1], 'G': r[2], 'W': r[3], 'L': r[4], 'KDA': r[9], 'CS/M': r[11], 'GOLD/M': r[15], 'DMG/M': r[17], 'KP': r[18], 'CP': r[21]})
        break
    return out
def place(y, l):
    d = json.load(open(f'{D}/{y}_{l}_event.json', encoding='utf-8'))
    ts = tables(d['parse']['text']['*'])
    res = []
    for t in ts:
        if not t: continue
        hdr = t[0]
        if hdr and hdr[0] == 'Place' and 'Team' in hdr:
            ti = hdr.index('Team')
            for r in t[1:]:
                if len(r) > ti and r[0].isdigit() and r[ti]:
                    res.append(f'{r[0]} {r[ti]}')
            if res: return res
    return res
def skeleton(y, l):
    return list(csv.DictReader(open(f'{MD}/skel/{y}_{l}.csv', encoding='utf-8')))
def starters(y, l, rows):
    skel = skeleton(y, l)
    recs = []
    for p in skel:
        pid = p['id']
        base = pid[:-2] if pid.endswith('_2') else pid
        key = norm(ALIAS.get(pid, base) or base)
        st = rows.get(key)
        if st is None and pid in ALIAS and ALIAS[pid]: st = rows.get(norm(ALIAS[pid]))
        if st is None and base != pid: st = rows.get(norm(base))
        if st is None and pid in ALIAS and ALIAS[pid] is None: st = None
        g = int(st['G']) if st and st['G'].isdigit() else (int(p['games']) if p['games'].isdigit() else 0)
        recs.append({'id': pid, 'team': p['team'], 'pos': p['pos'], 'G': g, 'st': st, 'skelG': p['games']})
    teams = {}
    for r in recs: teams.setdefault(r['team'], []).append(r)
    for t, rs in teams.items():
        rs.sort(key=lambda r: -r['G'])
        cut = rs[4]['G'] if len(rs) > 4 else 0
        for r in rs:
            r['starter'] = r['G'] > 0 and (rs.index(r) < 5 or r['G'] == cut and cut > 0)
    return recs
if __name__ == '__main__':
    y, l = sys.argv[1], sys.argv[2]
    rows = stats_rows(y, l)
    recs = starters(y, l, rows)
    print(json.dumps({'places': place(y, l), 'players': recs, 'stat_rows': len(rows)}, ensure_ascii=False))
