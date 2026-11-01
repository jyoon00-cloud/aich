import json,re,csv,os
from datetime import datetime
info=json.load(open('dl/info.json'));st=json.load(open('stats/all.json'))
def cid(n): return 'nunu' if n.startswith('Nunu') else re.sub(r'[^a-z0-9]','',n.lower())
def dt(s):
    s=re.sub(r'(\d)(st|nd|rd|th)',r'\1',s.strip())
    for f in ('%B %d, %Y','%b %d, %Y','%Y-%m-%d','%B %d %Y'):
        try: return datetime.strptime(s,f).strftime('%Y-%m-%d')
        except: pass
    raise ValueError(s)
KO={'Assassin':'암살자','Fighter':'전사','Mage':'마법사','Marksman':'원거리딜러','Support':'서포터','Tank':'탱커','Specialist':'특수형'}
out='out/champions'; os.makedirs(out+'/meta',exist_ok=True)
rows=[]
for n,v in info.items():
    rng=int(re.sub(r'\D','',v.get('range','0')) or 0)
    rows.append(dict(id=cid(n),name_en=n,release=dt(v['releasedate']),cls='/'.join(KO.get(a.strip(),a.strip()) for a in v.get('attribute','').split(',') if a.strip()),
                     atk='근거리' if rng<=250 else '원거리',res=v.get('resource','')))
rows.sort(key=lambda r:r['id'])
assert len({r['id'] for r in rows})==len(rows)
with open(out+'/_skel.csv','w',newline='') as f:
    w=csv.writer(f);w.writerow(['id','name_en','release','class','attack','resource'])
    for r in rows: w.writerow([r['id'],r['name_en'],r['release'],r['cls'],r['atk'],r['res']])
idmap={r['name_en']:r['id'] for r in rows}
def tier(p): return 'S' if p>=50 else 'A' if p>=30 else 'B' if p>=15 else 'C' if p>=5 else ''
for y in range(2013,2027):
    agg={};G=0
    for lg in ['LCK','LPL','LEC','LCS']:
        e=st.get(f'{y}_{lg}')
        if not e: continue
        G+=e['games']
        for r in e['rows']:
            a=agg.setdefault(r['champ'],[0,0,0]);a[0]+=r['contest'];a[1]+=r['games'];a[2]+=r['wins']
    W=st[f'{y}_WORLDS'];wg=W['games'];wa={r['champ']:(r['contest'],r['games'],r['wins']) for r in W['rows']}
    res=[]
    for c in set(agg)|set(wa):
        sp=agg.get(c,[0,0,0]);wo=wa.get(c,(0,0,0))
        spb=100*sp[0]/G;wpb=100*wo[0]/wg
        if max(spb,wpb)<5: continue
        f=lambda p,g,w:('%d'%round(100*w/g)) if g>=5 else ''
        res.append([idmap[c],round(spb),f(*sp),tier(spb),round(wpb),f(*wo),tier(wpb)])
    res.sort(key=lambda r:-(r[1]+r[4]))
    with open(f'{out}/meta/{y}.csv','w',newline='') as fh:
        w=csv.writer(fh);w.writerow(['id','spring_pb','spring_wr','spring_tier','worlds_pb','worlds_wr','worlds_tier'])
        w.writerows(res)
    print(y,G,wg,len(res))
