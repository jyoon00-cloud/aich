import json,sys,html,re
from html.parser import HTMLParser
d=json.load(open(sys.argv[1]))
if 'error' in d: print("ERR",d['error'].get('code'),d['error'].get('info','')[:200]); sys.exit()
src=d['parse']['text']['*']
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.stack=[]; s.cell=None; s.row=None
        s.depth=0
    def handle_starttag(s,t,a):
        if t=='table': s.tables.append([]); s.stack.append(len(s.tables)-1)
        elif t=='tr' and s.stack: s.row=[]
        elif t in('td','th') and s.row is not None: s.cell=[]
        elif t=='br' and s.cell is not None: s.cell.append(' ')
    def handle_endtag(s,t):
        if t=='table' and s.stack: s.stack.pop()
        elif t=='tr' and s.row is not None and s.stack:
            s.tables[s.stack[-1]].append(s.row); s.row=None
        elif t in('td','th') and s.cell is not None and s.row is not None:
            s.row.append(re.sub(r'\s+',' ',''.join(s.cell)).strip()); s.cell=None
    def handle_data(s,data):
        if s.cell is not None: s.cell.append(data)
p=P(); p.feed(src)
for i,t in enumerate(p.tables):
    if len(t)<3: continue
    print(f"=== TABLE {i} rows={len(t)}")
    for r in t: print(" | ".join(html.unescape(c) for c in r))
