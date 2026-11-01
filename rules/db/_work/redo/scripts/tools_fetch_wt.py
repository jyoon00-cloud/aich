import json, os, time, urllib.parse, urllib.request, sys, hashlib
S='/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad'
J=json.load(open(f'{S}/joined.json'))
pages=[]
for k,v in J.items():
    for p in v['players']:
        if p['page'] and p['page'] not in pages: pages.append(p['page'])
print('pages',len(pages),flush=True)
def fn(p): return f"{S}/wt/"+hashlib.md5(p.encode()).hexdigest()+".json"
for p in pages:
    f=fn(p)
    if os.path.exists(f) and '"parse"' in open(f,encoding='utf-8').read(): continue
    for attempt in range(5):
        url='https://lol.fandom.com/api.php?'+urllib.parse.urlencode({'action':'parse','format':'json','prop':'wikitext','page':p})
        txt=os.popen(f'curl -sS -G "https://lol.fandom.com/api.php" --data-urlencode "action=parse" --data-urlencode "format=json" --data-urlencode "prop=wikitext" --data-urlencode "page={p}"').read()
        if 'ratelimited' in txt:
            print('ratelimited',p,flush=True); time.sleep(30); continue
        break
    open(f,'w',encoding='utf-8').write(json.dumps({'page':p,'raw':txt},ensure_ascii=False))
    print('ok',p,len(txt),flush=True)
    time.sleep(3)
print('DONE',flush=True)
