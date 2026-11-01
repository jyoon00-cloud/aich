import sys; sys.path.insert(0,"/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk1516.4mPS0e")
import json,re,sys
from rep import plain
AWARD=re.compile(r'All-Pro|First Team|Second Team|Finals MVP|\bMVP\b|Rookie of|Worlds|World Championship|Mid-Season|MSI|Quarterfinal|Semifinal|Finals|Playoffs|Regional Finals|Group Stage|group stage|Champions?\b|won|placed|finished|runner',re.I)
def sentences(s):
    return re.split(r'(?<=[.!?])\s+',s)
def prior(path,Y,maxn=3,width=200):
    d=json.load(open(path))
    if 'error' in d: return None
    w=d['parse']['wikitext']['*']
    sec=None; sents=[]
    for line in w.split('\n'):
        m=re.match(r'^(={2,4})\s*(.*?)\s*\1\s*$',line)
        if m: sec=m.group(2); continue
        ysec = bool(sec and str(Y) in sec)
        if str(Y) not in line and not ysec: continue
        for s in sentences(plain(line)):
            if str(Y) in s and AWARD.search(s):
                sents.append(s.strip()[:width])
    seen=[]; 
    for s in sents:
        if s not in seen: seen.append(s)
    return seen[:maxn]
if __name__=='__main__':
    for x in (prior(sys.argv[1],sys.argv[2]) or ['NONE']): print('-',x)
