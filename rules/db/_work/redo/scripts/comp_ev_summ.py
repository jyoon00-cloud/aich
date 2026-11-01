import sys, re, json
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/comp_ev')
from fetch import get
for p in sys.argv[1:]:
    r=get(p); t=r['text']
    if r['err'] or not t:
        print('##',p,'ERR/MISSING',r['err']); continue
    g=lambda k: (re.search(r'\|\s*'+k+r'\s*=\s*([^\n|]*)', t) or [None,''])[1].strip()
    print('##',p,'| name:',g('name'),'| sdate:',g('sdate'),'| edate:',g('edate'),'| format:',g('format'),'| type:',g('type'))
    m=re.search(r'==\s*(Overview|Format)\s*==(.*?)(?=\n==[^=]|\Z)', t, re.S)
    body=m.group(2) if m else ''
    body=re.sub(r'\[\[([^|\]]*\|)?([^\]]*)\]\]', r'\2', body)
    body=re.sub(r'\{\{[^{}]*\}\}','',body)
    print(body.strip()[:450].replace('\n',' / '))
    print()
