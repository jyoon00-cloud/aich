import json, re, sys, csv, os, urllib.parse
sys.path.insert(0, '/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/parse')
import build_stats as b
SP='/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad'
MOUNT='/mnt/project-files/rules/db/_work/redo/ev'
ZW=re.compile(r'[⁠​‌‍﻿]')
def wiki_url(page): return 'https://lol.fandom.com/wiki/'+page.replace(' ','_')
def fn(page): return re.sub(r'[/ ]','_',page)
def unwiki(s):
    s=re.sub(r'\[\[(?:[^|\]]*\|)?([^\]]*)\]\]', r'\1', s)
    s=re.sub(r'\{\{[^{}]*\}\}', '', s)
    s=re.sub(r"'''?", '', s)
    s=re.sub(r'<ref[^>]*>.*?</ref>|<ref[^>]*/>', '', s)
    s=re.sub(r'<[^>]+>', '', s)
    return re.sub(r'\s+',' ', s).strip()
def awards(page, year):
    p=f'{SP}/raw/wt/{fn(page)}.json'
    if not os.path.exists(p) or os.path.getsize(p)==0: return None
    d=json.load(open(p))
    if 'error' in d: return None
    t=d['parse']['wikitext']['*']
    m=re.search(r'=== ?Individual Awards ?===(.*?)(?===|\Z)', t, re.S)
    sec=m.group(1) if m else ''
    out=[]
    for ln in sec.split('\n'):
        ln=ln.strip()
        if not ln.startswith('*') or ln.startswith('{{') : continue
        if re.search(r'\b%d\b' % year, ln):
            out.append(unwiki(ln.lstrip('*').strip()))
    # Worlds / MSI results mentioned in notable achievements, trivia etc (bullets with year)
    wm=[]
    for ln in t.split('\n'):
        s=ln.strip()
        if not s.startswith('*'): continue
        if re.search(r'\b%d\b' % year, s) and re.search(r'Worlds|World Championship|MSI|Mid-Season Invitational', s) and not re.search(r'Reached|Featured|milestone', s):
            wm.append(unwiki(s.lstrip('*').strip()))
    return {'awards':out,'worlds_msi':wm,'has_section':bool(m)}
def stats_for(year, lg):
    k=f'{year}_{lg}'
    p=f'{SP}/raw/{k}_stats.json'
    return b.stats(p)
def run(year, lg, page):
    k=f'{year}_{lg}'
    st=stats_for(year, lg)
    standings=b.standings(f'{SP}/raw/{k}_event.json')
    prior=year-1
    lines=[]
    lines.append(f'# {year} {lg} ({page})')
    if standings:
        lines.append('순위: '+', '.join(f'{pl} {"/".join(tm)}' for pl,tm in standings)+f' — 출처 {wiki_url(page)}')
    else:
        lines.append(f'순위: 못 찾음 — 출처 {wiki_url(page)}')
    lines.append('')
    rows=[l.split('\t') for l in open(f'{SP}/roster.tsv',encoding='utf-8').read().splitlines()]
    rows=[r for r in rows if r[0]==str(year) and r[1]==lg]
    cur=None
    stats_url=wiki_url(page+'/Player_Statistics')
    found_split=0; found_prior=0
    for (y,l,pid,team,pos,pg) in rows:
        if team!=cur:
            lines.append(f'### {team}'); cur=team
        lines.append(f'## {pid} ({team}, {pos})')
        s=st.get(pid.lower().replace(' ',''))
        if s:
            found_split+=1
            lines.append(f"- 스플릿: G {s['games']}, W {s['W']}, L {s['L']}, KDA {s['KDA']}, KP {s['KPAR']}, DMG/M {s['DMGM']}, CS/M {s['CSM']}, CP {s['CP']} — 출처 {stats_url}")
        else:
            lines.append(f'- 스플릿: 못 찾음 — 출처 {stats_url}')
        a=awards(pg, prior)
        if a is None:
            lines.append(f'- 직전 해: 미수집 (작업 중단으로 위키 조회 전) — 출처 {wiki_url(pg)}')
        else:
            found_prior+=1
            parts=[]
            if a['awards']: parts.append(f'{prior} 수상: '+'; '.join(a['awards']))
            if a['worlds_msi']: parts.append(f'{prior} 월즈·MSI 관련: '+'; '.join(a['worlds_msi']))
            if not parts: parts.append(f'{prior} 수상 기록 없음 (Individual Awards 섹션 기준)')
            lines.append(f'- 직전 해: '+' / '.join(parts)+f' — 출처 {wiki_url(pg)}')
        lines.append('')
    return '\n'.join(lines)+'\n', found_split, found_prior, len(rows)
if __name__=='__main__':
    year=int(sys.argv[1]); lg=sys.argv[2]
    page=dict(l.rstrip('\n').split('\t') for l in open(f'{SP}/events_map.txt'))[f'{year}_{lg}']
    text,fs,fp,n=run(year,lg,page)
    out=f'{MOUNT}/{year}_{lg}.md'
    open(f'{SP}/ev_{year}_{lg}.md','w',encoding='utf-8').write(text)
    print(f'{year}_{lg}: players={n} split_found={fs} prior_checked={fp}')
