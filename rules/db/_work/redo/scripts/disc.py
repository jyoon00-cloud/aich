import json, subprocess, time, urllib.parse, sys
def ps(q):
    url="https://lol.fandom.com/api.php?action=query&list=prefixsearch&pslimit=100&format=json&pssearch="+urllib.parse.quote(q)
    for i in range(3):
        out=subprocess.run(['curl','-sS','-m','60',url],capture_output=True,text=True).stdout
        try:
            d=json.loads(out); return [x['title'] for x in d['query']['prefixsearch']]
        except Exception:
            time.sleep(30)
    return []
prefs=[]
for y in range(2013,2020):
    prefs += [f"LCK/{y} Season", f"Champions/{y} Season", f"LPL/{y} Season", f"EU LCS/{y} Season", f"LEC/{y} Season", f"NA LCS/{y} Season", f"LCS/{y} Season", f"EU LCS/Season {y-2010}", f"NA LCS/Season {y-2010}", f"{y} Season World Championship", f"{y} Mid-Season Invitational"]
out={}
for q in prefs:
    t=ps(q); out[q]=t; print(q, len(t), flush=True); time.sleep(3)
json.dump(out, open(f"{S}/disc.json","w"), ensure_ascii=False, indent=1)
