import json,sys
from bs4 import BeautifulSoup
d=json.load(open(sys.argv[1]))
soup=BeautifulSoup(d['parse']['text']['*'],'html.parser')
t=[t for t in soup.find_all('table') if 'spstats' in (t.get('class') or [])][0]
rows=t.find_all('tr')
hdr=[c.get_text(' ',strip=True) for c in rows[0].find_all(['th','td'])]
print('HDR',hdr)
for r in rows[1:]:
    cells=r.find_all(['td','th'])
    if not cells: continue
    vals=[c.get_text(' ',strip=True) for c in cells]
    a=r.find('a')
    href=a.get('href') if a else ''
    print('|'.join(vals), '|', href)
