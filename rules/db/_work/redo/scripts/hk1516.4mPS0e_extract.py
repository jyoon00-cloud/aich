import json,sys,re
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk1516.4mPS0e')
from tbl import tables
def clean(x): return re.sub(r'[⁠​]','',x).strip()
def stats(path):
    ts=tables(path)
    big=max(ts,key=lambda t:len(t['rows']))
    rows=big['rows']
    hi=[i for i,r in enumerate(rows) if 'KDA' in r][0]
    hdr=rows[hi]
    out=[]
    for r in rows[hi+1:]:
        r=[clean(c) for c in r]
        if len(r)<len(hdr): r+=['']*(len(hdr)-len(r))
        name=r[1]
        if not name: continue
        d={'name':name}
        # positions: 2 G,3 W,4 L,5 WR,6 K,7 D,8 A,9 KDA,10 CS,11 CS/M,... 17 DMG/M,18 KPAR
        d.update(G=r[2],W=r[3],L=r[4],KDA=r[9],CSM=r[11],DMGM=r[17],KP=r[18])
        out.append(d)
    return hdr,out
def standings(path):
    ts=tables(path)
    for t in ts:
        r=t['rows']
        if len(r)>=6 and r[0] and r[0][0]=='Place' and 'Team' in r[0]:
            teams=[]
            for x in r[1:]:
                x=[clean(c) for c in x if clean(c)]
                if x and re.match(r'^(\d+|\d+-\d+|\d+(st|nd|rd|th))$',x[0]) and len(x)>=1:
                    teams.append((x[0], x[-1]))
            return 'placement',teams
    for t in ts:
        r=t['rows']
        if len(r)>=6 and any(c=='Team' for c in r[0]+(r[1] if len(r)>1 else [])) and any('Str' in x for x in r[:2]):
            teams=[]
            for x in r:
                x=[clean(c) for c in x if clean(c)]
                if x and x[0].isdigit() and len(x)>=3:
                    teams.append((x[0], x[1]))
            if len(teams)>=6: return 'regular',teams
    return None,[]
if __name__=='__main__':
    for i in range(1,9):
        kind,teams=standings('p%d.json'%i)
        print('p%d'%i, kind, teams[:10])
