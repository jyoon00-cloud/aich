import json, sys, html
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.stack=[]; s.cur=None; s.row=None; s.cell=None; s.depth=0
    def handle_starttag(s,t,a):
        if t=='table':
            s.tables.append({'rows':[], 'class':dict(a).get('class','')}); s.stack.append(len(s.tables)-1)
        elif t=='tr' and s.stack:
            s.row=[]
        elif t in('td','th') and s.row is not None:
            s.cell=[]
        elif t=='br' and s.cell is not None: s.cell.append(' ')
    def handle_endtag(s,t):
        if t=='table' and s.stack: s.stack.pop()
        elif t=='tr' and s.row is not None and s.stack:
            s.tables[s.stack[-1]]['rows'].append(s.row); s.row=None
        elif t in('td','th') and s.cell is not None:
            s.row.append(' '.join(''.join(s.cell).split())); s.cell=None
    def handle_data(s,d):
        if s.cell is not None: s.cell.append(d)
f=sys.argv[1]
d=json.load(open(f))
p=P(); p.feed(d['parse']['text']['*'])
for i,t in enumerate(p.tables):
    n=len(t['rows'])
    if n: print(f"TABLE {i} rows={n} class={t['class'][:60]}")
    if n and len(sys.argv)>2 and int(sys.argv[2])==i:
        for r in t['rows']: print(' | '.join(r))
