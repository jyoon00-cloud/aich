import sys,csv,re
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk1516.4mPS0e')
from extract import stats
BASE='/mnt/project-files/rules/db/_work/'
pm={r['id'].lower():r for r in csv.DictReader(open(BASE+'players_master.csv',encoding='utf-8'))}
LEET=str.maketrans({'1':'l','4':'a','0':'o','3':'e','5':'s','8':'b'})
def norm(s): return re.sub(r'[^a-z0-9]','',s.lower()).translate(LEET)
FILES={'2015_LCK':'s1','2015_LCS':'s2','2015_LEC':'s3','2015_LPL':'s4','2016_LCK':'s5','2016_LCS':'s6','2016_LEC':'s7','2016_LPL':'s8'}
def load(key):
    sk=list(csv.DictReader(open(BASE+'skel/'+key+'.csv',encoding='utf-8')))
    hdr,rows=stats(FILES[key]+'.json')
    res=[]
    used=set()
    for r in sk:
        pid=r['id']; p=pm.get(pid.lower(),{})
        cands=[pid, p.get('leaguepedia_page',''), p.get('name','')]
        cn=[norm(c) for c in cands if c]
        hit=None
        for st in rows:
            if st['name'] in used: continue
            if norm(st['name']) in cn: hit=st; break
        if hit: used.add(hit['name'])
        res.append({'skel':r,'stat':hit,'lp':p.get('leaguepedia_page','')})
    extra=[s['name'] for s in rows if s['name'] not in used]
    return res,extra,rows
if __name__=='__main__':
    for k in FILES:
        res,extra,rows=load(k)
        miss=[x['skel']['id'] for x in res if not x['stat']]
        print(k,'skel',len(res),'matched',len(res)-len(miss),'| skel-miss',miss,'| unused stats',extra)
