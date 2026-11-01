import json,re,sys,os
KW=re.compile(r'All-Pro|All-Pro|First Team|Second Team|1st Team|2nd Team|MVP|Worlds|World Championship|MSI|Mid-Season|Finals|Quarterfinal|Semifinal|Champion|Rookie|Playoffs|Regional|Summer|Spring|Winter|Split|Award|finish|placed|Group',re.I)
def plain(s):
    s=re.sub(r'<ref[^>]*?/>|<ref.*?</ref>','',s,flags=re.S)
    s=re.sub(r'\{\{[^{}]*\}\}','',s)
    s=re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]',r'\1',s)
    s=re.sub(r"'''?",'',s)
    return re.sub(r'\s+',' ',s).strip()
def snippets(path,Y,maxn=8,width=260):
    d=json.load(open(path))
    if 'error' in d: return None
    w=d['parse']['wikitext']['*']
    out=[]
    sec=None
    for line in w.split('\n'):
        m=re.match(r'^(={2,4})\s*(.*?)\s*\1\s*$',line)
        if m: sec=m.group(2)
        if str(Y) in line or (sec and str(Y) in sec):
            p=plain(line)
            if not p: continue
            if KW.search(p) or (sec and str(Y) in sec):
                out.append(p[:width])
    return out[:maxn]
if __name__=='__main__':
    for x in snippets(sys.argv[1],sys.argv[2]) or ['NONE']: print('-',x)
