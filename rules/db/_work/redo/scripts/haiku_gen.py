import sys,csv,os,re,json
S='/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/haiku'
sys.path.insert(0,S)
import build, extract as e, awards
OUT='/mnt/project-files/rules/db/_work/redo/ev'
MASTER={r['id'].lower():r for r in csv.DictReader(open('/mnt/project-files/rules/db/_work/players_master.csv',encoding='utf-8'))}
EVENTS={}
for line in open('/mnt/project-files/rules/db/_work/redo/events.txt',encoding='utf-8'):
    line=line.strip()
    if not line: continue
    k,ev=line.split(' ',1); EVENTS[k]=ev
def U(x): return x.replace(' ','_')
def stats_url(ev): return f"https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page={U(ev)}/Player_Statistics"
def ev_url(ev): return f"https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page={U(ev)}"
def wt_url(p): return f"https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page={U(p)}"
# name aliases (spelling variants only, confirmed by identical game counts)
ALIAS={('2023','LCS'):{'ryoma':'ry0ma'},('2023','LEC'):{'hanssama':'hans sama'},('2024','LEC'):{'hanssama':'hans sama'}}
# unresolved candidates: skeleton id -> note (not matched to stats)
UNRES={('2023','LEC'):{'execute':"'exakick' 행(9G)이 있으나 동일인 확인 안 됨",'3xa':"'jeonghoon' 행(9G)이 있으나 동일인 확인 안 됨"},
       ('2023','LPL'):{'dream_2':"'dream' 행(22G)이 있으나 동일인 확인 안 됨"},
       ('2023','LCS'):{},
       ('2024','LEC'):{'3xa':"'exakick' 행(9G)이 있으나 동일인 확인 안 됨",'hanssama':''}}
# prior-year Worlds / MSI prize-table placements (team names as printed on the event page)
PRIZE={
 '2022':[('Worlds 2022 Main Event','2022 Season World Championship/Main Event',[('1','DRX'),('2','T1'),('3-4','JD Gaming, Gen.G'),('5-8','Rogue, RNG, DWG KIA, EDward Gaming'),('9-10','Fnatic, Top Esports'),('11-14','Evil Geniuses, G2 Esports, 100 Thieves, CTBC Flying Oyster'),('15-16','Cloud9, GAM Esports')]),
         ('MSI 2022','2022 Mid-Season Invitational',[('1','RNG'),('2','T1'),('3-4','Evil Geniuses, G2 Esports'),('5-6','PSG Talon, Saigon Buffalo'),('7-8','RED Canids, ORDER'),('9-10','DetonatioN FM, Team Aze'),('11','İstanbul Wildcats')])],
 '2023':[('Worlds 2023 Main Event','2023 Season World Championship/Main Event',[('1','T1'),('2','Weibo Gaming'),('3-4','Bilibili Gaming, JD Gaming'),('5-8','NRG, Gen.G, KT Rolster, LNG Esports'),('9-11','Dplus Kia, Fnatic, G2 Esports'),('12-14','Cloud9, MAD Lions, GAM Esports'),('15-16','Team Liquid, Team BDS')]),
         ('MSI 2023','2023 Mid-Season Invitational',[('1','JD Gaming'),('2','Bilibili Gaming'),('3','T1'),('4','Gen.G'),('5-6','G2 Esports, Cloud9'),('7-8','MAD Lions, Golden Guardians'),('9','PSG Talon'),('10-11','Movistar R7, LOUD'),('12-13','GAM Esports, DetonatioN FM')])],
}
def fmt_stat(r):
    return f"G {r['G']}, W {r['W']}, KDA {r['KDA']}, KP {r['KPAR']}, DMG/M {r['DMGM']}, CS/M {r['CSM']}"
def wt_file(pid): return f"{S}/wt/{pid}.json"
def gen(year,lg):
    prev=str(int(year)-1)
    ev=EVENTS[f'{year}_{lg}']
    rows,um,st,sb=build.build(year,lg)
    L=[]
    L.append(f"# {year} {lg} ({ev})")
    std=e.standings2(year,lg)
    if std: L.append("순위: "+", ".join(f"{a} {b}" for a,b in std)+f" — 출처 {ev_url(ev)} (스탠딩 표)")
    else: L.append("순위: 못 찾음")
    L.append(f"직전 해({prev}) 월즈·MSI 입상 (팀명 원문 그대로, 선수별 소속팀은 확인 안 함): " + " / ".join(f"{t}: " + ", ".join(f"{p} {n}" for p,n in items) + f" — 출처 {ev_url(src)}" for t,src,items in [(a,b,c) for a,b,c in [(x[0],x[1],x[2]) for x in PRIZE[prev]]]))
    L.append("")
    used=set(); found=0; total=0
    al=ALIAS.get((year,lg),{})
    for x in rows:
        sid=x['id'].lower(); key=al.get(sid,sid)
        r=x['stat'] or sb.get(key)
        if r is not None and x['stat'] is None: used.add(key)
        if x['stat'] is not None: used.add(sid)
        L.append(f"## {x['id']} ({x['team']}, {x['pos']})")
        if r is not None:
            found+=1; total+=1
            L.append(f"- 스플릿: {fmt_stat(r)} — 출처 {stats_url(ev)}")
        else:
            total+=1
            note=UNRES.get((year,lg),{}).get(sid,'')
            L.append("- 스플릿: 못 찾음" + (f" ({note})" if note else ""))
        if x['starter']:
            pg=MASTER.get(key,{}).get('leaguepedia_page',key)
            fp=wt_file(sid)
            aw=None
            if os.path.exists(fp):
                aw=awards.prev_awards(fp,prev)
            if aw is None:
                L.append(f"- 직전 해: 미수집 (중단 전 선수 페이지 미조회) — 출처 {wt_url(pg)}")
            elif not aw:
                L.append(f"- 직전 해: 못 찾음 (선수 페이지에 {prev} 수상 줄 없음) — 출처 {wt_url(pg)}")
            else:
                L.append(f"- 직전 해: " + "; ".join(aw) + f" — 출처 {wt_url(pg)}")
        else:
            L.append("- 직전 해: 미조회 (교체 선수, 주전 기준 밖)")
        L.append("")
    # stats rows with no skeleton entry
    extra=[n for n in sb if n not in used and n not in {x['id'].lower() for x in rows} and n not in {al.get(x['id'].lower()) for x in rows}]
    for n in extra:
        r=sb[n]; found+=1; total+=1
        L.append(f"## {r['name']} (스켈레톤 미등재, 팀·포지션 미상)")
        L.append(f"- 스플릿: {fmt_stat(r)} — 출처 {stats_url(ev)}")
        L.append("- 직전 해: 미조회 (스켈레톤 미등재)")
        L.append("")
    return "\n".join(L)+"\n", found, len(rows)+len(extra)
if __name__=='__main__':
    res={}
    for y in ('2023','2024'):
        for lg in build.LG:
            txt,found,tot=gen(y,lg)
            res[f'{y}_{lg}']=(found,tot)
            if len(sys.argv)>1 and sys.argv[1]=='write':
                fn=f"{OUT}/{y}_{lg}.md"
                with open(fn,'w',encoding='utf-8') as f: f.write(txt)
            else:
                print(txt[:1500]); print('...')
    print(res, sum(v[0] for v in res.values()))
