import json,subprocess,urllib.parse,time,re,os,html
def S(y): return 'Season 3' if y==2013 else f'{y} Season'
def cands(lg,y):
    s=S(y)
    if lg=='WORLDS':
        n='Season 3 World Championship' if y==2013 else f'{y} Season World Championship'
        return [n+'/Main Event',n]
    if lg=='LCK':
        if y<=2015: return [f'Champions/{y} Season/Spring',f'Champions/{y} Season/Spring Season']
        if y>=2025: return [f'LCK/{y} Season/Cup']
        return [f'LCK/{y} Season/Spring Season']
    if lg=='LPL':
        if y>=2025: return [f'LPL/{y} Season/Split 1']
        return [f'LPL/{y} Season/Spring Season',f'LPL/{y} Season/Spring Playoffs']
    if lg=='LEC':
        if y<=2018: return [f'EU LCS/{s}/Spring Season',f'EU LCS/{s}/Spring Split']
        if y==2026: return ['LEC/2026 Season/Versus Season','LEC/2026 Season/Winter Season']
        if y>=2023: return [f'LEC/{y} Season/Winter Season']
        return [f'LEC/{y} Season/Spring Season']
    if lg=='LCS':
        if y<=2018: return [f'NA LCS/{s}/Spring Season',f'NA LCS/{s}/Spring Split']
        if y==2025: return ['LTA North/2025 Season/Split 1']
        if y==2026: return ['LCS/2026 Season/Lock-In','LCS/2026 Season/Lock In']
        return [f'LCS/{y} Season/Spring Season']
def get(page):
    q=urllib.parse.urlencode({'action':'parse','page':page+'/Champion Statistics','format':'json','prop':'text'})
    for a in range(4):
        r=subprocess.run(['curl','-sS','-m','60','https://lol.fandom.com/api.php?'+q],capture_output=True,text=True).stdout
        try: d=json.loads(r)
        except Exception: time.sleep(10);continue
        if 'error' in d:
            if d['error']['code']=='ratelimited': time.sleep(30);continue
            return None
        return d['parse']['text']['*']
def parse(t):
    rows=[]
    for tr in re.findall(r'<tr[^>]*>(.*?)</tr>',t,re.S):
        cells=[html.unescape(re.sub(r'<[^>]+>','',c)).strip() for c in re.findall(r'<td[^>]*>(.*?)</td>',tr,re.S)]
        if len(cells)>8 and re.match(r'^\d+$',cells[1] or 'x'):
            # Champion G PB% B G By W L WR
            I=lambda x:int(x) if x.isdigit() else 0
            rows.append(dict(champ=cells[0],contest=I(cells[1]),bans=I(cells[3]),games=I(cells[4]),wins=I(cells[6])))
    m=re.search(r'(\d+) Total Games Played',re.sub(r'<[^>]+>',' ',t))
    return int(m.group(1)) if m else None,rows
res={}
if os.path.exists('stats/all.json'): res=json.load(open('stats/all.json'))
for y in range(2013,2027):
  for lg in ['LCK','LPL','LEC','LCS','WORLDS']:
    k=f'{y}_{lg}'
    if k in res: continue
    for c in cands(lg,y):
        t=get(c); time.sleep(3)
        if t:
            n,rows=parse(t); res[k]=dict(page=c,games=n,rows=rows); print(k,c,n,len(rows),flush=True); break
    else: print(k,'MISSING',flush=True)
    json.dump(res,open('stats/all.json','w'),ensure_ascii=False)
