import json, re, csv, hashlib, sys, os
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/tools')
from extract import load
S='/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad'
J=json.load(open(f'{S}/joined.json'))
R=json.load(open(f'{S}/roster.json'))
ST={}
for y in ['2021','2022']:
    for l in ['LCK','LCS','LEC','LPL']:
        ST[f'{y}_{l}']=json.load(open(f'{S}/raw/{y}_{l}_stats_x.json'))
MASTER={r['id']:r for r in csv.DictReader(open('/mnt/project-files/rules/db/_work/players_master.csv',encoding='utf-8'))}
EV={}
for line in open('/mnt/project-files/rules/db/_work/redo/events.txt',encoding='utf-8'):
    line=line.strip()
    if line:
        k,p=line.split(' ',1); EV[k]=p
def canon(t):
    t=t.replace('⁠','').strip().lower()
    alias={'dragonx':'drx','damwon gaming':'dwg kia','damwon':'dwg kia','hanwha life':'hanwha life esports','rogue (european team)':'rogue'}
    return alias.get(t,t)
def ph(ev):
    out={}
    if not os.path.exists(f'{S}/raw/{ev}'): return out
    for t in load(f'{S}/raw/{ev}'):
        if 'tournament-results' in t['class']:
            for r in t['rows'][1:]:
                if len(r)>=4: out[canon(r[3]['txt'])]=r[0]['txt']
    return out
PL={'2020':{'worlds':ph('2020_Season_World_Championship_Main_Event.ev.json'),'msi':ph('2020_Mid-Season_Invitational.ev.json')},
    '2021':{'worlds':ph('2021_Season_World_Championship_Main_Event.ev.json'),'msi':ph('2021_Mid-Season_Invitational.ev.json')}}
def wt(page):
    f=f"{S}/wt/"+hashlib.md5(page.encode()).hexdigest()+".json"
    if not os.path.exists(f): return None
    d=json.loads(json.load(open(f,encoding='utf-8'))['raw'])
    if 'parse' not in d: return 'MISSING'
    return d['parse']['wikitext']['*']
def clean(s):
    s=re.sub(r'\[\[([^\]|]*\|)?([^\]]*)\]\]',r'\2',s)
    s=re.sub(r"'''?","",s)
    s=re.sub(r'\{\{[^{}]*\}\}','',s)
    return ' '.join(s.split())
KW=re.compile(r'All-?Pro|MVP|Team|Finals|Rookie|Award|Worlds|MSI|Champion|Playoffs|Runner|Tournament|Ranked|Season',re.I)
def prior_awards(w,yr):
    hits=[]
    for l in w.split('\n'):
        if l.lstrip().startswith('*') and yr in l and KW.search(l):
            hits.append(clean(l.lstrip().lstrip('*').strip()))
    return hits
def prior_teams(id_, yr):
    res=[]
    for lg in ['LCK','LCS','LEC','LPL']:
        for r in csv.DictReader(open(f'/mnt/project-files/rules/db/_work/skel/{yr}_{lg}.csv',encoding='utf-8')):
            if r['id']==id_: res.append((lg,r['team']))
    return res
def fmt_split(s):
    return f"G {s['G']}, W {s['W']}, KDA {s['KDA']}, KP {s['KP']}, DMG/M {s['DMGM']}, CS/M {s['CSM']}"
os.makedirs('/mnt/project-files/rules/db/_work/redo/ev',exist_ok=True)
for key,v in J.items():
    y,lg=key.split('_'); prior=str(int(y)-1)
    evpage=EV[key]; evurl=evpage.replace(' ','_')
    lines=[f"# {y} {lg} ({evpage})",
           "순위: "+', '.join(f"{r[0]} {r[1].replace(chr(8288),'').strip()}" for r in v['standings']),
           f"출처: https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page={evurl}",
           f"스탯 출처: https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page={evurl}/Player_Statistics",
           ""]
    for p in v['players']:
        pid=p['id']; page=p['page']
        head=f"## {pid} ({p['team']}, {p['pos']})"+(" [주전]" if p['starter'] else "")
        lines.append(head)
        if p['split']:
            stat=f"- 스플릿: {fmt_split(p['split'])} — 출처 https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page={evurl}/Player_Statistics"
            if p['table_link'] and p['table_link']!=page: stat+=f" (스탯표 링크 {p['table_link']})"
        else:
            stat="- 스플릿: 못 찾음"
        lines.append(stat)
        if not page:
            lines.append("- 직전 해: 못 찾음 (players_master에 페이지 없음)"); lines.append(""); continue
        w=wt(page)
        url=f"https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page={page.replace(' ','_')}"
        if w is None:
            ptxt="미수집"
        elif w=='MISSING':
            ptxt=f"못 찾음 (페이지 없음) — 출처 {url}"
        else:
            aw=prior_awards(w,prior)
            pts=prior_teams(pid,prior)
            parts=[]
            parts.append('수상: '+' ; '.join(aw) if aw else f'수상 기록 없음 ({prior} 해당 줄 없음)')
            if pts:
                parts.append('직전해 팀: '+', '.join(f"{prior} {l} {t}" for l,t in pts))
                for l,t in pts[:1]:
                    c=canon(t)
                    for k,nm in [('worlds','월즈'),('msi','MSI')]:
                        tbl=PL.get(prior,{}).get(k,{})
                        if c in tbl: parts.append(f"{nm} {prior} {tbl[c]}위")
                        elif not tbl: parts.append(f"{nm} {prior} 결과표 없음")
                        else: parts.append(f"{nm} {prior} 미진출")
            else:
                parts.append(f'직전해 스켈레톤 없음')
            ptxt=' | '.join(parts)+f" — 출처 {url}"
        lines.append(f"- 직전 해: {ptxt}")
        lines.append("")
    # stats-table players not in skeleton
    un=[s for s in ST[key]['stats'] if s['name'] in v['unmatched_table'] or (s['name']+'/'+(s['link'] or '')) in v['unmatched_table']]
    if un:
        lines.append("## 스켈레톤에 없는 스탯표 선수 (참고, 분석 제외)")
        for s in un:
            c=s['cells']; lk=(s['link'] or '').lower()
            tm=next((x['team']+' (로스터)' for k,x in R[key].items() if k==lk),'팀 미확인')
            lines.append(f"- {s['link'] or s['name']} ({tm}): G {c[2]}, KDA {c[9]}, KP {c[18]}, DMG/M {c[17]}, CS/M {c[11]} — 출처 https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page={evurl}/Player_Statistics")
    open(f"/mnt/project-files/rules/db/_work/redo/ev/{key}.md",'w',encoding='utf-8').write('\n'.join(lines)+'\n')
    print('wrote',key,len(lines))
