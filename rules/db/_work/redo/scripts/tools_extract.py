import json, sys, re
from html.parser import HTMLParser
class P(HTMLParser):
    def __init__(s):
        super().__init__(); s.tables=[]; s.stack=[]; s.row=None; s.cell=None; s.cls=''
    def handle_starttag(s,t,a):
        a=dict(a)
        if t=='table':
            s.tables.append({'rows':[], 'class':a.get('class','')}); s.stack.append(len(s.tables)-1)
        elif t=='tr' and s.stack: s.row=[]
        elif t in('td','th') and s.row is not None: s.cell={'txt':[], 'links':[]}
        elif t=='a' and s.cell is not None and a.get('href','').startswith('/wiki/'):
            s.cell['links'].append(a.get('title') or a['href'])
        elif t=='br' and s.cell is not None: s.cell['txt'].append(' ')
    def handle_endtag(s,t):
        if t=='table' and s.stack: s.stack.pop()
        elif t=='tr' and s.row is not None and s.stack:
            s.tables[s.stack[-1]]['rows'].append(s.row); s.row=None
        elif t in('td','th') and s.cell is not None:
            s.cell['txt']=' '.join(''.join(s.cell['txt']).split()); s.row.append(s.cell); s.cell=None
    def handle_data(s,d):
        if s.cell is not None: s.cell['txt'].append(d)
def load(f):
    d=json.load(open(f)); p=P(); p.feed(d['parse']['text']['*']); return p.tables
if __name__=='__main__':
    f=sys.argv[1]; T=load(f)
    out={'standings':[], 'stats':[], 'stats_header':None}
    for t in T:
        rows=t['rows']
        if 'spstats' in t['class']:
            hdr=[c['txt'] for c in rows[0]] if rows else []
            # find header row containing KDA
            hi=None
            for i,r in enumerate(rows):
                if any(c['txt']=='KDA' for c in r): hi=i; break
            H=[c['txt'] for c in rows[hi]]
            out['stats_header']=H
            for r in rows[hi+1:]:
                if len(r)<5: continue
                txt=[c['txt'] for c in r]
                name=txt[1]
                links=r[1]['links']
                rec={'name':name,'link':links[0] if links else None,'cells':txt}
                out['stats'].append(rec)
        if t['class'].strip().endswith('standings') and 'mvp' not in t['class']:
            for r in rows:
                txt=[c['txt'] for c in r]
                if txt and re.fullmatch(r'\d+',txt[0] or ''):
                    out['standings'].append(txt)
    json.dump(out, open(sys.argv[2],'w'), ensure_ascii=False, indent=0)
    print(f, 'stats rows', len(out['stats']), 'standings', len(out['standings']))
    print('header', out['stats_header'])
