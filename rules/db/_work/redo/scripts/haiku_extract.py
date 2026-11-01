SCR='/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/haiku'
import json,re,html,sys
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/haiku')
import hp
def clean(s): return s.replace('⁠','').replace('​','').strip()
def stats(year,lg):
    d=json.load(open(f'{SCR}/stats_{year}_{lg}.json'))
    T=hp.tables(d['parse']['text']['*'])
    t=[t for t in T if any(len(r)>=10 and 'KDA' in r for r in t)][0]
    hdr=[r for r in t if 'KDA' in r][0]
    idx={}
    for i,h in enumerate(hdr):
        if h=='G' and 'G' not in idx: idx['G']=i
        elif h and h not in idx: idx[h]=i
    rows=[]
    for r in t:
        if len(r)<len(hdr)-2 or r is hdr: continue
        name=clean(r[1]) if len(r)>1 else ''
        if not name or name=='Player' or 'Tournament' in name: continue
        g=lambda k: clean(r[idx[k]]) if idx.get(k) is not None and idx[k]<len(r) else ''
        rows.append(dict(name=name,G=g('G'),W=g('W'),KDA=g('KDA'),KPAR=g('KPAR'),DMGM=g('DMG/M'),CSM=g('CS/M')))
    return rows
def standings(year,lg):
    d=json.load(open(f'{SCR}/ev_{year}_{lg}.json'))
    s=d['parse']['text']['*']
    t=html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',s))).replace('⁠','').replace('​','')
    i=t.find('Team Series Games Str')
    if i<0: return None
    seg=t[i+len('Team Series Games Str'):i+1200]
    out=re.findall(r'(\d+) (.+?) \d+ - \d+ \d+% \d+ - \d+ \d+% [+-]?\d+',seg)
    return out
if __name__=='__main__':
    SCR_=sys.argv[1]

def standings2(year,lg):
    d=json.load(open(f'{SCR}/ev_{year}_{lg}.json'))
    s=d['parse']['text']['*']
    t=html.unescape(re.sub(r'\s+',' ',re.sub(r'<[^>]+>',' ',s))).replace('⁠','').replace('​','').replace('\xa0',' ')
    i=t.find('Standings Legend')
    if i<0: return None
    seg=t[i:i+3000]
    k=seg.find('Games Str')
    if k<0: return None
    seg=seg[k+len('Games Str'):]
    j=seg.find('Match Schedule')
    if j>0: seg=seg[:j]
    ents=re.findall(r'(\d+)\s+(.+?)\s+\d+\s*-\s*\d+\s+\d+%\s+(?:\d+\s*-\s*\d+\s+\d+%\s+[+-]?\d+\s+)?(\d+[WL]|\S*)',seg)
    out=[]
    for rk,tm,_ in ents:
        if tm and not re.search(r'\d+ - \d+',tm): out.append((int(rk),tm.strip()))
    return out
