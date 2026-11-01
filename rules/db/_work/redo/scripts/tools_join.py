import csv, json, sys
M={}
for r in csv.DictReader(open('/mnt/project-files/rules/db/_work/players_master.csv',encoding='utf-8')):
    M[r['id']]=r
out={}
for y in ['2021','2022']:
  for l in ['LCK','LCS','LEC','LPL']:
    sk=list(csv.DictReader(open(f'/mnt/project-files/rules/db/_work/skel/{y}_{l}.csv',encoding='utf-8')))
    st=json.load(open(f'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/raw/{y}_{l}_stats_x.json'))
    ev=json.load(open(f'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/raw/{y}_{l}_event_x.json'))
    byPage={}; byName={}
    for s in st['stats']:
        byPage[(s['link'] or '').lower()]=s
        byName[s['name'].lower()]=s
    rank={}
    for r in ev['standings']:
        rank[r[1].replace('⁠','').strip()]=f"{r[0]} {r[1].replace(chr(8288),'').strip()}"
    recs=[]
    used=set()
    for r in sk:
        m=M.get(r['id'],{})
        page=m.get('leaguepedia_page','')
        s=byPage.get(page.lower()) or byName.get(r['id'].lower())
        if s is None and page: s=byPage.get(page.split(' (')[0].lower())
        if s: used.add(id(s))
        g=int(r['games']) if r['games'].strip().isdigit() else 0
        cells=s['cells'] if s else None
        recs.append(dict(id=r['id'],team=r['team'],pos=r['pos'],skel_games=g,page=page,
            table_name=s['name'] if s else None, table_link=s['link'] if s else None,
            split=None if not s else dict(G=cells[2],W=cells[3],L=cells[4],WR=cells[5],KDA=cells[9],CSM=cells[11],KP=cells[18],DMGM=cells[17]),
            rank=rank.get(r['team'],'standings 없음')))
    # starters: max games per team-pos
    best={}
    for x in recs:
        gg=int(x['split']['G']) if x['split'] and x['split']['G'].isdigit() else x['skel_games']
        x['games_eff']=gg
        k=(x['team'],x['pos'])
        if k not in best or gg>best[k][0]: best[k]=(gg,x['id'])
    starters={v[1] for v in best.values() if v[0]>0}
    for x in recs: x['starter']= x['id'] in starters
    unmatched=[s['name']+'/'+s['link'] for s in st['stats'] if id(s) not in used]
    out[f'{y}_{l}']=dict(players=recs, unmatched_table=unmatched, standings=ev['standings'])
    print(y,l,'skel',len(sk),'split found',sum(1 for x in recs if x['split']),'starters',len(starters),'table unmatched',unmatched)
json.dump(out,open('/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/joined.json','w'),ensure_ascii=False,indent=1)
