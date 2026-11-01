# ③ 포텐·히든 근거 수집용 (Opus 작성). 사용: python3 fetch_pot.py seed|fetch|report
import json,glob,os,sys,csv,time,subprocess,urllib.parse
SP='/tmp/claude-0/-home-user-aich/e4b6817c-fe77-5839-b8af-7cf6b261834e/scratchpad'
DB='/home/user/aich/rules/db'
TR=SP+'/opus_tr/cache'; WT=SP+'/pot_wt'; os.makedirs(WT,exist_ok=True)
key=lambda p: urllib.parse.quote(p.replace(' ','_'),safe='')
m={r['id']:r for r in csv.DictReader(open(DB+'/_work/players_master.csv'))}
ids=sorted({r['id'] for f in glob.glob(DB+'/potential/*.csv') for r in csv.DictReader(open(f))})
pages=sorted({m[i]['leaguepedia_page'] for i in ids} - {'','MISSING'})
def api(prop,page):
    return 'https://lol.fandom.com/api.php?action=parse&format=json&prop=%s&page=%s'%(prop,urllib.parse.quote(page.replace(' ','_')))
def get(url):
    for a in range(4):
        o=subprocess.run(['curl','-sS','-m','60',url],capture_output=True,text=True).stdout
        if '"parse"' in o or '"missingtitle"' in o: return o
        time.sleep(30)
    return None
if sys.argv[1]=='seed':  # 다른 워커가 받아 둔 wikitext 재사용
    n=0
    for f in glob.glob(SP+'/**/*.json',recursive=True):
        if '/pot_wt/' in f or '/opus_tr/' in f: continue
        try: d=json.load(open(f))
        except Exception: continue
        p=d.get('parse',{}) if isinstance(d,dict) else {}
        if 'wikitext' in p and '/' not in p.get('title',''):
            out=WT+'/'+key(p['title'])+'.json'
            if not os.path.exists(out): json.dump(d,open(out,'w')); n+=1
    print('seeded',n)
if sys.argv[1]=='fetch':
    todo=[('wt',p) for p in pages if not os.path.exists(WT+'/'+key(p)+'.json')]+[('tr',p) for p in pages if not os.path.exists(TR+'/'+key(p)+'.json')]
    print('todo',len(todo),flush=True)
    for k,(t,p) in enumerate(todo):
        o=get(api('wikitext',p) if t=='wt' else api('text',p+'/Tournament_Results'))
        if o: open((WT if t=='wt' else TR)+'/'+key(p)+'.json','w').write(o)
        else: print('FAIL',t,p,flush=True)
        if k%50==0: print(k,flush=True)
        time.sleep(2)
    print('done',flush=True)
if sys.argv[1]=='report':
    mw=[p for p in pages if not os.path.exists(WT+'/'+key(p)+'.json')]
    mt=[p for p in pages if not os.path.exists(TR+'/'+key(p)+'.json')]
    print('pages',len(pages),'wt missing',len(mw),mw[:20],'tr missing',len(mt),mt[:20])
    print('no page ids',[i for i in ids if m[i]['leaguepedia_page'] in ('','MISSING')])
