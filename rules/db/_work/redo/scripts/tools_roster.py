import json, sys
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/tools')
from extract import load
S='/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad'
R={}
for y in ['2021','2022']:
  for l in ['LCK','LCS','LEC','LPL']:
    T=load(f'{S}/raw/{y}_{l}_event.json')
    m={}
    for t in T:
        if 'tournament-roster' not in t['class']: continue
        team=None
        for r in t['rows']:
            if not r: continue
            txt=r[0]['txt'].strip()
            if team is None:
                team=txt.replace('⁠','').strip(); continue
            if not txt or txt=='⁠⁠': continue
            link=r[0]['links'][0] if r[0]['links'] else txt
            m[link.lower()]={'team':team,'name':txt}
    R[f'{y}_{l}']=m
    print(y,l,'roster players',len(m))
json.dump(R,open(f'{S}/roster.json','w'),ensure_ascii=False,indent=1)
