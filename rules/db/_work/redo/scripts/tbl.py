import json,sys
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.stack=[]; s.cur=None; s.row=None; s.cell=None
    def handle_starttag(s,t,a):
        if t=='table': s.stack.append(len(s.tables)); s.tables.append([])
        elif t=='tr' and s.stack: s.row=[]
        elif t in('td','th') and s.row is not None: s.cell=[]
        elif t=='br' and s.cell is not None: s.cell.append(' ')
    def handle_endtag(s,t):
        if t=='table' and s.stack: s.stack.pop()
        elif t=='tr' and s.row is not None and s.stack:
            s.tables[s.stack[-1]].append(s.row); s.row=None
        elif t in('td','th') and s.cell is not None and s.row is not None:
            s.row.append(' '.join(''.join(s.cell).split())); s.cell=None
    def handle_data(s,d):
        if s.cell is not None: s.cell.append(d)
d=json.load(open(sys.argv[1]))
p=P(); p.feed(d['parse']['text']['*'])
for i,t in enumerate(p.tables):
    if not t: continue
    print(f"### TABLE {i} rows={len(t)}")
    for r in t:
        if any(r): print(' | '.join(r))
