import csv,sys,json
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/haiku')
import extract as e
SK='/mnt/project-files/rules/db/_work/skel'
LG=['LCK','LPL','LEC','LCS']
master={r['id'].lower():r for r in csv.DictReader(open('/mnt/project-files/rules/db/_work/players_master.csv',encoding='utf-8'))}
def build(year,lg):
    sk=list(csv.DictReader(open(f'{SK}/{year}_{lg}.csv',encoding='utf-8')))
    st=e.stats(year,lg); st_by={r['name'].lower():r for r in st}
    st_names=set(st_by)
    rows=[]; unmatched=[]
    for s in sk:
        r=st_by.get(s['id'].lower())
        if r is None: unmatched.append(s['id'])
        rows.append(dict(id=s['id'],team=s['team'],pos=s['pos'],stat=r))
    # starter: stats G >= 50% of max G within team+pos
    mx={}
    for x in rows:
        if x['stat'] and x['stat']['G'].isdigit():
            k=(x['team'],x['pos']); mx[k]=max(mx.get(k,0),int(x['stat']['G']))
    for x in rows:
        g=int(x['stat']['G']) if x['stat'] and x['stat']['G'].isdigit() else 0
        x['starter']= g>=0.5*mx.get((x['team'],x['pos']),0) and g>0
    return rows,unmatched,st,st_by
if __name__=='__main__':
    allst=set()
    for y in ('2023','2024'):
        for lg in LG:
            rows,um,st,st_by=build(y,lg)
            starters=[x for x in rows if x['starter']]
            print(y,lg,'skel',len(rows),'stats',len(st),'unmatched',um,'starters',len(starters))
            # stats names not in skeleton
            sk_ids={x['id'].lower() for x in rows}
            extra=[n for n in st_by if n not in sk_ids]
            if extra: print('   stats-only names:',extra)
            for x in starters: allst.add(x['id'].lower())
    print('unique starters',len(allst))
    nm=[i for i in allst if i not in master]
    print('not in master',nm)
