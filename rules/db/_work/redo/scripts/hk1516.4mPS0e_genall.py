import sys,json,os
sys.path.insert(0,'/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk1516.4mPS0e')
from match import load
from gen import EV, wiki, split_line, standing_line
from rep2 import prior
W='/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk1516.4mPS0e'
OUT='/mnt/project-files/rules/db/_work/redo/ev/'
titles=[l.strip() for l in open(W+'/titles.txt',encoding='utf-8') if l.strip()]
tidx={t:i+1 for i,t in enumerate(titles)}
st=json.load(open(W+'/starters.json'))
report={}
for key in EV:
    year=key[:4]; prev=str(int(year)-1)
    ev,pk,sk=EV[key]
    res,extra,rows=load(key)
    url=wiki(ev)+'/Player_Statistics'
    standing,kind=standing_line(key)
    if key=='2016_LPL':
        standing='그룹 A(정규): Qiao Gu Reapers, Team WE, Snake Esports, LGD Gaming, Energy Pacemaker.All, Masters 3 / 그룹 B(정규): Royal Never Give Up, EDward Gaming, Vici Gaming, Invictus Gaming, Oh My God, Hyper Youth Gaming (플레이오프 최종 순위 표 없음)'
    elif kind=='regular':
        standing='정규시즌 순위(플레이오프 최종 순위 표 미확인): '+standing
    lines=[f'# {year} {key.split("_")[1]} ({ev})','',f'순위: {standing}','']
    found=0; prior_done=0
    for x in res:
        s=x['skel']; sid=s['id']; team=s['team']; pos=s['pos']
        lines.append(f'## {sid} ({team}, {pos})')
        if x['stat']:
            lines.append('- '+split_line(x['stat'],url)); found+=1
        else:
            lines.append('- 스플릿: 못 찾음 (스플릿 표에 해당 선수 없음)')
        if sid in st[key]:
            t=x['lp'] or sid
            n=tidx.get(t)
            f=W+'/wt/%03d.json'%n if n else None
            sn=None
            if f and os.path.exists(f) and os.path.getsize(f)>0:
                try: sn=prior(f,prev)
                except Exception: sn=None
            if sn is None:
                lines.append('- 직전 해: 미수집 (선수 페이지 조회 중단)')
            elif not sn:
                lines.append(f'- 직전 해: 못 찾음 (선수 페이지 {prev} 관련 기록 문장 없음) — {wiki(t)}')
            else:
                prior_done+=1
                lines.append(f'- 직전 해({prev} 기록 발췌): '+' / '.join(sn)+f' — {wiki(t)}')
        else:
            lines.append('- 직전 해: 미수집 (비주전, 미조회)')
        lines.append('')
    report[key]=(found,len(res),prior_done)
    open(OUT+f'{year}_{key.split("_")[1]}.md','w',encoding='utf-8').write('\n'.join(lines))
print(report)
