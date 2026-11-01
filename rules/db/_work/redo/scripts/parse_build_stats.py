import json, sys, re
from html.parser import HTMLParser
ZW = re.compile(r'[⁠​‌‍﻿  ]+')
def clean(s): return '\n'.join(re.sub(r'[ \t\r\f\v]+',' ',ln).strip() for ln in ZW.sub(' ', s).split('\n')).strip()
class P(HTMLParser):
    # stack of open tables; each frame: {'rows':[], 'row':None, 'cell':None}
    def __init__(s):
        super().__init__(); s.stack=[]; s.done=[]
    def handle_starttag(s, tag, attrs):
        if tag=='table': s.stack.append({'rows':[],'row':None,'cell':None})
        elif not s.stack: return
        f=s.stack[-1]
        if tag=='tr': f['row']=[]
        if tag in('td','th') and f['row'] is not None: f['cell']=[]
        if tag=='br' and f['cell'] is not None: f['cell'].append('\n')
    def handle_endtag(s, tag):
        if not s.stack: return
        f=s.stack[-1]
        if tag in('td','th') and f['cell'] is not None and f['row'] is not None:
            f['row'].append(clean(''.join(f['cell']))); f['cell']=None
        elif tag=='tr' and f['row'] is not None:
            if f['row']: f['rows'].append(f['row'])
            f['row']=None
        elif tag=='table':
            s.done.append(f['rows']); s.stack.pop()
    def handle_data(s, d):
        if s.stack and s.stack[-1]['cell'] is not None: s.stack[-1]['cell'].append(d)
def tables(path):
    d=json.load(open(path))
    if 'error' in d: raise SystemExit('ERR '+path+' '+str(d['error'].get('code')))
    p=P(); p.feed(d['parse']['text']['*']); return p.done
def stats(path):
    out={}
    for t in tables(path):
        hdr=None
        for i,r in enumerate(t):
            if 'KDA' in r and 'DMG/M' in r: hdr=r; hi=i; break
        if hdr is None: continue
        gl=[i for i,c in enumerate(hdr) if c=='G']
        for r in t[hi+1:]:
            if len(r)!=len(hdr) or len(r)<5: continue
            name=r[1]
            if not name: continue
            g=lambda c: r[hdr.index(c)]
            out[name.lower().replace(' ','')]={'name':name,'games':r[gl[0]],'W':g('W'),'L':g('L'),'KDA':g('KDA'),
                 'CSM':g('CS/M'),'KPAR':g('KPAR'),'DMGM':g('DMG/M'),'CP':g('CP')}
    return out
def standings(path):
    for t in tables(path):
        if t and t[0][:1]==['Place'] or (t and 'Place' in t[0]):
            res=[]
            for r in t[1:]:
                if len(r)<3: continue
                res.append((r[0], [x.strip() for x in r[2].split('\n') if x.strip()]))
            return res
    return []
if __name__=='__main__':
    mode=sys.argv[1]; path=sys.argv[2]
    if mode=='stats':
        for k,v in stats(path).items(): print(v)
    else:
        for pl,tm in standings(path): print(pl, tm)
