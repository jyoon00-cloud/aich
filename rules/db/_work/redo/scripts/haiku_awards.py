import re,json
KW=re.compile(r'All-Pro|All-Star|MVP|Rookie|of the Year|Player of the|Finals?|Champion|Worlds|World Championship|MSI|Mid-Season|Finalist|Semifinal|Quarterfinal|Playoffs|Swiss|Group Stage|Second Team|First Team|Third Team|Top Laner|Jungler|Mid Laner|ADC|Support', re.I)
REJ=re.compile(r'Reached|appearances|Featured|milestone|becoming|became|Has the|He is the|His |history|promotional|documentary|Esports Awards|assists|kills|wins in|games in|first player|Ever|records?', re.I)
def clean(s):
    s=re.sub(r'<ref[^>]*/>','',s); s=re.sub(r'<ref[^>]*>.*?</ref>','',s,flags=re.S)
    s=re.sub(r'<[^>]+>','',s)
    s=re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]',r'\1',s)
    s=re.sub(r"'''?","",s); s=re.sub(r'\{\{[^{}]*\|([^{}|]*)\}\}',r'\1',s); s=re.sub(r'\{\{([^{}|]*)\}\}',r'\1',s)
    s=re.sub(r'\{\{[^{}]*\}\}','',s)
    return re.sub(r'\s+',' ',s).strip()
def prev_awards(wt_json, year):
    d=json.load(open(wt_json))
    if 'error' in d: return None
    w=d['parse']['wikitext']['*']
    out=[]
    for line in w.split('\n'):
        if not line[:1] in ('*','|','!'): continue
        if str(year) not in line: continue
        if not KW.search(line): continue
        if REJ.search(line): continue
        c=clean(line.lstrip('*|! '))
        if c and c not in out: out.append(c[:220])
    return out
if __name__=='__main__':
    import sys
    for l in prev_awards(sys.argv[1], sys.argv[2]) or []: print('-',l)
