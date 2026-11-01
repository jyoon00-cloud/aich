import json,sys
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.stack=[]; s.cur=None; s.row=None; s.cell=None; s.depth=0
    def handle_starttag(s,t,a):
        if t=='table':
            s.depth+=1; s.stack.append(s.cur); s.cur={'rows':[],'nest':s.depth}
        elif t=='tr' and s.cur is not None: s.row=[]
        elif t in('td','th') and s.row is not None: s.cell=[]
        elif t=='br' and s.cell is not None: s.cell.append(' ')
    def handle_endtag(s,t):
        if t in('td','th') and s.cell is not None and s.row is not None:
            s.row.append(' '.join(''.join(s.cell).split())); s.cell=None
        elif t=='tr' and s.row is not None and s.cur is not None:
            if s.row: s.cur['rows'].append(s.row)
            s.row=None
        elif t=='table':
            if s.cur is not None:
                s.cur['depth']=s.depth; s.tables.append(s.cur)
            s.cur=s.stack.pop(); s.depth-=1
    def handle_data(s,d):
        if s.cell is not None: s.cell.append(d)
def tables(path):
    d=json.load(open(path)); h=d['parse']['text']['*']
    p=P(); p.feed(h); return p.tables
if __name__=='__main__':
    for n,t in enumerate(tables(sys.argv[1])):
        rows=t['rows']
        if not rows: continue
        print(n,'rows',len(rows),'nest',t.get('depth'),'|',' | '.join(rows[0])[:200])
        if len(rows)>1: print('    ',' | '.join(rows[1])[:200])
