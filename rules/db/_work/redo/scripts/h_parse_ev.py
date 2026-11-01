import json,sys,re
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/h')
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.depth=0; s.cur=None; s.row=None; s.cell=None; s.tdepth=None
    def handle_starttag(s,tag,attrs):
        a=dict(attrs)
        if tag=='table':
            s.depth+=1
            if s.cur is None and 'wikitable' in a.get('class',''):
                s.cur=[]; s.tdepth=s.depth
        elif tag=='tr' and s.cur is not None and s.depth==s.tdepth: s.row=[]
        elif tag in('td','th') and s.row is not None and s.depth==s.tdepth: s.cell=[]
        elif tag=='br' and s.cell is not None: s.cell.append(' ')
    def handle_endtag(s,tag):
        if tag=='table':
            if s.cur is not None and s.depth==s.tdepth: s.tables.append(s.cur); s.cur=None
            s.depth-=1
        elif tag=='tr' and s.row is not None and s.cur is not None and s.depth==s.tdepth:
            s.cur.append(s.row); s.row=None
        elif tag in('td','th') and s.cell is not None and s.row is not None:
            s.row.append(re.sub(r'\s+',' ',''.join(s.cell)).replace('⁠','').strip()); s.cell=None
    def handle_data(s,d):
        if s.cell is not None: s.cell.append(d)
def tables(path):
    d=json.load(open(path)); p=P(); p.feed(d['parse']['text']['*']); return p.tables
if __name__=='__main__':
    for i,t in enumerate(tables(sys.argv[1])):
        print('### table',i,'rows',len(t))
        for r in t[:int(sys.argv[2]) if len(sys.argv)>2 else 3]: print(' | '.join(r))
