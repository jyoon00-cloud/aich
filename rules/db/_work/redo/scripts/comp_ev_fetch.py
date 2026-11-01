import json, sys, os, time, urllib.parse, subprocess
W="/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/comp_ev/wt"
def fname(p): return os.path.join(W, p.replace('/','__').replace(' ','_')+'.json')
def get(p):
    f=fname(p)
    if os.path.exists(f):
        return json.load(open(f))
    url="https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page="+urllib.parse.quote(p.replace(' ','_'))
    res={'page':p,'err':'fail','text':''}
    for attempt in range(4):
        out=subprocess.run(['curl','-sS','-m','60',url],capture_output=True,text=True).stdout
        try:
            d=json.loads(out)
        except Exception:
            time.sleep(10); continue
        code=d.get('error',{}).get('code')
        if code=='ratelimited':
            time.sleep(30); continue
        res={'page':p,'err':code,'text':d.get('parse',{}).get('wikitext',{}).get('*','')}
        json.dump(res, open(f,'w'))
        time.sleep(3)
        return res
    time.sleep(3)
    return res
if __name__=='__main__':
    for p in sys.argv[1:]:
        r=get(p)
        print('##',p, r['err'], len(r['text']), flush=True)
