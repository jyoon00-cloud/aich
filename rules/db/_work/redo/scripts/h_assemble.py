import json,csv,re,sys,os
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/h')
from parse_ev import tables
S='/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/h'
M='/mnt/project-files/rules/db/_work'
meta={}
for r in csv.DictReader(open(f'{M}/players_master.csv',encoding='utf-8')): meta.setdefault(r['id'].lower(),r)
events={}
for line in open(f'{M}/redo/events.txt',encoding='utf-8'):
    line=line.strip()
    if line[:4] in('2013','2014'):
        k,page=line.split(' ',1); events[k]=page
def norm(s): return re.sub(r'[^a-z0-9]','',s.lower())
def stats_for(key):
    out={}
    for t in tables(f'{S}/ev/{key}_stats.json'):
        hdr=None
        for r in t:
            if 'KDA' in r and 'G' in r and 'W' in r: hdr=r; break
        if not hdr: continue
        i=t.index(hdr)
        for r in t[i+1:]:
            if len(r)<4: continue
            name=r[1]
            if not name: continue
            d={}
            for j,h in enumerate(hdr):
                if h and h not in d: d[h]=(r[j] if j<len(r) else '')
            out.setdefault(norm(name),d)
        break
    return out
def standings(key):
    for t in tables(f'{S}/ev/{key}_event.json'):
        if t and t[0][:1]==['Place'] or (t and 'Place' in t[0] and 'Team' in t[0]):
            rows=[r for r in t[1:] if len(r)>=2]
            teams=[]
            for r in rows:
                team=r[-1]
                if team and team not in teams: teams.append(team)
            return teams
    return None
def awards(pg,year):
    p=f'{S}/wt/{pg}.json'
    if not os.path.exists(p): return None
    d=json.load(open(p))
    if 'error' in d: return 'ERR '+d['error'].get('code','')
    txt=d['parse']['wikitext']['*']
    hits=[]
    for ln in txt.split('\n'):
        if str(year) in ln and re.search(r'All-Pro|All-Rookie|First|Second|Team|MVP|Finals|Worlds|MSI|All-Star|Champion|Award|Finalist|Quarterfinal|Semifinal|Final|Playoff|Group|Quarter|Semi|Winner|Runner',ln,re.I):
            hits.append(re.sub(r'\s+',' ',re.sub(r'<[^>]+>|\{\{|\}\}|\[\[|\]\]','',ln)).strip()[:220])
    return hits
if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='standings':
        for k in sorted(events):
            print(k, standings(k))
    if mode=='stats':
        for k in sorted(events):
            s=stats_for(k); print(k,len(s),sorted(s)[:5])
