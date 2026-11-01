import json, subprocess, time, urllib.parse
W="/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/comp_ev"
def ps(q):
    url="https://lol.fandom.com/api.php?action=query&list=prefixsearch&pslimit=100&format=json&pssearch="+urllib.parse.quote(q)
    for i in range(3):
        out=subprocess.run(['curl','-sS','-m','60',url],capture_output=True,text=True).stdout
        try:
            d=json.loads(out); return [x['title'] for x in d['query']['prefixsearch']]
        except Exception:
            time.sleep(30)
    return []
out={}
for y in range(2013,2020):
    for q in [f"LCK/{y} Season", f"Champions/{y} Season", f"LPL/{y} Season", f"EU LCS/{y} Season", f"LEC/{y} Season", f"NA LCS/{y} Season", f"LCS/{y} Season", f"EU LCS/Season {y-2010}", f"NA LCS/Season {y-2010}", f"{y} Season World Championship", f"{y} Mid-Season Invitational"]:
        out[q]=ps(q); print(q, len(out[q]), flush=True); time.sleep(3)
        json.dump(out, open(f"{W}/disc.json","w"), ensure_ascii=False, indent=1)
print("FINISHED", flush=True)
