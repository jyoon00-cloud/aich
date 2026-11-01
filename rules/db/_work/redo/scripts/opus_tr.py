import json,re,html,glob,os,sys,csv,time,subprocess,urllib.parse
SP='/tmp/claude-0/-home-user-aich/e4b6817c-fe77-5839-b8af-7cf6b261834e/scratchpad'
EV='/home/user/aich/rules/db/_work/redo/ev'
C=SP+'/opus_tr/cache'
master={r['id']:r['leaguepedia_page'] for r in csv.DictReader(open('/home/user/aich/rules/db/_work/players_master.csv'))}
def key(p): return urllib.parse.quote(p.replace(' ','_'),safe='')
# 1) reuse caches of other workers
if sys.argv[1]=='seed':
    n=0
    for f in glob.glob(SP+'/**/*.json',recursive=True):
        if '/opus_tr/' in f: continue
        try: d=json.load(open(f))
        except Exception: continue
        t=d.get('parse',{}).get('title','') if isinstance(d,dict) else ''
        t=t.replace(' ','_')
        if t.endswith('/Tournament_Results'):
            out=C+'/'+key(t[:-len('/Tournament_Results')])+'.json'
            if not os.path.exists(out): json.dump(d,open(out,'w')); n+=1
    print('seeded',n)
def sections():
    for f in sorted(glob.glob(EV+'/*.md')):
        y=int(os.path.basename(f)[:4])
        for m in re.finditer(r'^## (\S+)',open(f).read(),re.M): yield f,y,m.group(1)
if sys.argv[1]=='fetch':
    pages=sorted({master.get(i,'') for f,y,i in sections()} - {'','MISSING'})
    todo=[p for p in pages if not os.path.exists(C+'/'+key(p)+'.json')]
    print('pages',len(pages),'todo',len(todo),flush=True)
    for k,p in enumerate(todo):
        url='https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page='+urllib.parse.quote(p.replace(' ','_')+'/Tournament_Results')
        for a in range(4):
            o=subprocess.run(['curl','-sS','-m','60',url],capture_output=True,text=True).stdout
            if '"parse"' in o or '"missingtitle"' in o: break
            time.sleep(30)
        if '"parse"' in o or '"missingtitle"' in o: open(C+'/'+key(p)+'.json','w').write(o)
        if k%50==0: print(k,flush=True)
        time.sleep(2)
    print('done',flush=True)
def rows(p):
    f=C+'/'+key(p)+'.json'
    if not os.path.exists(f): return None
    d=json.load(open(f))
    if 'error' in d: return 'missing'
    h=d['parse']['text']['*']; out=[]
    for r in re.findall(r'<tr[^>]*>(.*?)</tr>',h,re.S):
        tds=re.findall(r'<td([^>]*)>(.*?)</td>(?=<td|$)',r,re.S)
        if len(tds)<5 or 'achievements-date' not in tds[0][0]: continue
        tx=lambda s: re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',s))).replace('⁠','').strip()
        date=tx(tds[0][1]); place=tx(tds[1][1]); ev=tx(tds[2][1])
        tm=re.search(r'title="([^"]+)"',tds[4][1]); team=html.unescape(tm.group(1)) if tm else tx(tds[4][1])
        out.append((date,place,ev,team))
    return out
if sys.argv[1]=='apply':
    stat={}
    for f in sorted(glob.glob(EV+'/*.md')):
        y=int(os.path.basename(f)[:4]); py=y-1
        lines=[l for l in open(f).read().split('\n') if not l.startswith('- 직전 해 대회(')]
        out=[]; cur=None
        for l in lines:
            out.append(l)
            m=re.match(r'^## (\S+)',l)
            if m: cur=m.group(1)
            if l.startswith('- 직전 해') and cur:
                p=master.get(cur,'')
                if p in ('','MISSING'): stat['nopage']=stat.get('nopage',0)+1; continue
                rs=rows(p)
                if rs is None: stat['nofetch']=stat.get('nofetch',0)+1; continue
                url='https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page='+urllib.parse.quote(p.replace(' ','_')+'/Tournament_Results')
                if rs=='missing': out.append(f'- 직전 해 대회({py}): 선수 대회 성적 페이지 없음 — {url}'); stat['missing']=stat.get('missing',0)+1; continue
                sel=[r for r in rs if r[0].startswith(str(py))]
                if not sel: out.append(f'- 직전 해 대회({py}): 성적 표에 {py}년 행 없음 — {url}'); stat['none']=stat.get('none',0)+1
                else:
                    s='; '.join(f'{ev} {pl}위 ({tm})' for d,pl,ev,tm in reversed(sel))
                    out.append(f'- 직전 해 대회({py}): {s} — {url}'); stat['ok']=stat.get('ok',0)+1
                cur=None
        open(f,'w').write('\n'.join(out))
    print(stat)
