import json, sys, re, html
from html.parser import HTMLParser
d = json.load(open(sys.argv[1]))
if 'error' in d:
    print("ERROR", d['error'].get('code'), d['error'].get('info','')[:200]); sys.exit(0)
text = d['parse']['text']['*']
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.stack=[]; s.cur=None; s.row=None; s.cell=None; s.depth=0
    def handle_starttag(s, tag, attrs):
        a=dict(attrs)
        if tag=='table':
            s.depth+=1
            if 'wikitable' in a.get('class','') and s.depth==1 or ('wikitable' in a.get('class','') and s.cur is None):
                s.cur=[]; s.tdepth=s.depth
        if tag=='tr' and s.cur is not None and s.depth==s.tdepth: s.row=[]
        if tag in('td','th') and s.row is not None and s.depth==s.tdepth: s.cell=[]; s.span=int(a.get('colspan',1) or 1)
        if tag=='br' and s.cell is not None: s.cell.append(' ')
    def handle_endtag(s, tag):
        if tag=='table':
            if s.cur is not None and s.depth==s.tdepth:
                s.tables.append(s.cur); s.cur=None
            s.depth-=1
        if tag in('td','th') and s.cell is not None and s.depth==s.tdepth:
            s.row.append(re.sub(r'\s+',' ',''.join(s.cell)).strip()); s.cell=None
        if tag=='tr' and s.row is not None and s.depth==s.tdepth:
            if s.row: s.cur.append(s.row)
            s.row=None
    def handle_data(s, data):
        if s.cell is not None: s.cell.append(data)
p=P(); p.feed(text)
for i,t in enumerate(p.tables):
    print(f"### TABLE {i} rows={len(t)}")
    for r in t: print(" | ".join(r))
