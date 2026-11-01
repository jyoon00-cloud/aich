import csv,os,re,sys
sys.path.insert(0,'.')
from assemble import meta, events, stats_for, standings, awards, norm, S, M
import json
wt_dir=f'{S}/wt'
OUT=f'{M}/redo/ev'
def pick(d,keys):
    out=[]
    for k in keys:
        if k in d and d[k] not in ('','-'): out.append(f"{k} {d[k]}")
    return out
for y in ('2013','2014'):
  prior=str(int(y)-1)
  for lg in ('LCK','LPL','LEC','LCS'):
    key=f'{y}_{lg}'
    page=events.get(key,'?')
    st=stats_for(key)
    teams=standings(key)
    rows=list(csv.DictReader(open(f'{M}/skel/{key}.csv',encoding='utf-8')))
    lines=[f'# {y} {lg} ({page})']
    lines.append('순위: '+(', '.join(f'{i+1} {t}' for i,t in enumerate(teams)) if teams else '미수집'))
    lines.append('주의: 2013/2014 스플릿 기록은 Player_Statistics 표 기준. 직전 해 수상은 선수 wikitext 기준이며 본 조회에서 항목 없으면 "못 찾음".')
    for r in rows:
        pid=r['id']; m=meta[pid.lower()]
        lines.append(f"## {pid} ({r['team']}, {r['pos']})")
        d=None
        for cand in (norm(m['name']),norm(m['leaguepedia_page']),norm(pid)):
            if cand in st: d=st[cand]; break
        url_s=f"https://lol.fandom.com/wiki/{page.replace(' ','_')}/Player_Statistics"
        if d:
            vals=pick(d,['G','W','L','KDA','KPAR','KP','DMG/M','CS/M'])
            lines.append(f"- 스플릿: {', '.join(vals) if vals else '못 찾음'} — 출처 {url_s}")
        else:
            lines.append(f"- 스플릿: 못 찾음 — 출처 {url_s}")
        pg=m['leaguepedia_page']
        safe=re.sub(r'[^A-Za-z0-9._-]','_',pid)
        if os.path.exists(f'{wt_dir}/{safe}.json'):
            a=awards(safe,prior)
            url_p='https://lol.fandom.com/wiki/'+pg.replace(' ','_')
            if a and not isinstance(a,str):
                lines.append(f"- 직전 해({prior}): "+' / '.join(a)+f" — 출처 {url_p}")
            elif a and isinstance(a,str):
                lines.append(f"- 직전 해({prior}): 미수집 ({a})")
            else:
                lines.append(f"- 직전 해({prior}): 못 찾음 — 출처 {url_p}")
        else:
            lines.append(f"- 직전 해({prior}): 미수집")
    path=f'{OUT}/{key}.md'
    open(path,'w',encoding='utf-8').write('\n'.join(lines)+'\n')
    print(path, 'players', len(rows), 'with_stats', sum(1 for r in rows if (norm(meta[r["id"].lower()]["name"]) in st or norm(meta[r["id"].lower()]["leaguepedia_page"]) in st or norm(r["id"]) in st)))
