import json,sys,time,urllib.parse,urllib.request,subprocess
# usage: fetch.py <prop=text|wikitext> <outfile> <page>  (uses curl via subprocess)
prop,out,page=sys.argv[1],sys.argv[2],sys.argv[3]
url="https://lol.fandom.com/api.php?action=parse&format=json&prop=%s&page=%s"%(prop,urllib.parse.quote(page.replace(' ','_'),safe='/_:()-.'))
for attempt in range(6):
    r=subprocess.run(["curl","-sS",url,"-o",out,"-w","%{http_code}"],capture_output=True,text=True)
    body=open(out,encoding='utf-8',errors='replace').read()
    if 'ratelimited' in body:
        print("RATELIMIT",page,flush=True); time.sleep(30); continue
    print("OK",r.stdout,len(body),page,flush=True); break
time.sleep(3)
