import json,subprocess,urllib.request,urllib.parse,time,re,sys
names=[x['title'] for x in json.load(open('dl/cat.json'))['query']['categorymembers'] if not x['title'].startswith('Category:')]
out={}
for i in range(0,len(names),45):
    chunk=names[i:i+45]
    q=urllib.parse.urlencode({'action':'query','prop':'revisions','rvprop':'content','rvslots':'main','titles':'|'.join(chunk),'format':'json'})
    r=json.loads(subprocess.run(["curl","-sS","-m","60","https://lol.fandom.com/api.php?"+q],capture_output=True,text=True).stdout)
    for p in r['query']['pages'].values():
        t=p['revisions'][0]['slots']['main']['*']
        m=re.search(r'\{\{Infobox Champion(.*?)\n\}\}',t,re.S)
        f=dict(re.findall(r'\|(\w+)=([^\n]*)',m.group(1))) if m else {}
        out[p['title']]=f
    time.sleep(3)
json.dump(out,open('dl/info.json','w'),ensure_ascii=False,indent=0)
print(len(out))
