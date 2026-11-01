import sys,json; sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk1516.4mPS0e')
from match import load, pm
from collections import defaultdict
KEYS=['2015_LCK','2015_LCS','2015_LEC','2015_LPL','2016_LCK','2016_LCS','2016_LEC','2016_LPL']
out={}
for k in KEYS:
    res,extra,rows=load(k)
    best={}
    for x in res:
        if not x['stat']: continue
        g=int(x['stat']['G'] or 0); key=(x['skel']['team'],x['skel']['pos'])
        if key not in best or g>best[key][0]: best[key]=(g,x)
    teamtop=defaultdict(int)
    for (t,p),(g,x) in best.items(): teamtop[t]=max(teamtop[t],g)
    st=[]
    for (t,p),(g,x) in best.items():
        if g>=max(1,0.5*teamtop[t]): st.append(x['skel']['id'])
    out[k]=st
    print(k,len(st))
json.dump(out,open('starters.json','w'))
titles=set()
for k in KEYS:
    for sid in out[k]:
        r=[x for x in load(k)[0] if x['skel']['id']==sid][0]
        titles.add(r['lp'] or sid)
print('unique titles',len(titles))
