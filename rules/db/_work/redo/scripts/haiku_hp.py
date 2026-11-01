import re,html
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.stack=[]; s.cell=None; s.row=None
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
            s.row.append(html.unescape(re.sub(r'\s+',' ',''.join(s.cell)).strip())); s.cell=None
    def handle_data(s,data):
        if s.cell is not None: s.cell.append(data)
def tables(src):
    p=P(); p.feed(src); return p.tables
