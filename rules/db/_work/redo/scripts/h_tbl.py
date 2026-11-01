import json,sys,re,html
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.stack=[]; s.cur=None; s.row=None; s.cell=None; s.depth=0
    def handle_starttag(s,tag,attrs):
        a=dict(attrs)
        if tag=='table':
            s.depth+=1
            if s.depth==1 and 'wikitable' in a.get('class','') or ('wikitable' in a.get('class','') and s.cur is None):
                s.cur=[]; s.tdepth=s.depth
        elif tag=='tr' and s.cur is not None and s.depth==s.tdepth:
            s.row=[]
        elif tag in('td','th') and s.row is not None and s.depth==s.tdepth:
            s.cell=[]; s.span=int(a.get('colspan',1) or 1)
        elif tag=='br' and s.cell is not None: s.cell.append(' ')
    def handle_endtag(s,tag):
        if tag=='table':
            if s.cur is not None and s.depth==s.tdepth:
                s.tables.append(s.cur); s.cur=None
            s.depth-=1
        elif tag=='tr' and s.row is not None and s.cur is not None and s.depth==s.tdepth:
            s.cur.append(s.row); s.row=None
        elif tag in('td','th') and s.cell is not None:
            s.row.append(re.sub(r'\s+',' ',''.join(s.cell)).strip()); s.cell=None
    def handle_data(s,d):
        if s.cell is not None: s.cell.append(d)
d=json.load(open(sys.argv[1]))
p=P(); p.feed(d['parse']['text']['*'])
for i,t in enumerate(p.tables):
    print(f"### table {i} rows={len(t)}")
    for r in t[:int(sys.argv[2]) if len(sys.argv)>2 else 5]: print(' | '.join(r))
