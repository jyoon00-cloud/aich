import sys, os, json, time, urllib.parse, subprocess, hashlib, re
W = "/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/comp_haiku"
CACHE = W + "/wt"
_last = [0.0]
def _api(params):
    url = "https://lol.fandom.com/api.php?format=json&" + params
    gap = 3 - (time.time() - _last[0])
    if gap > 0: time.sleep(gap)
    _last[0] = time.time()
    out = subprocess.run(["curl", "-sS", "--max-time", "60", url], capture_output=True, text=True).stdout
    return json.loads(out)
def get_wt(page):
    key = hashlib.md5(page.encode()).hexdigest()
    p = os.path.join(CACHE, key + ".txt")
    if os.path.exists(p):
        return open(p, encoding="utf-8").read()
    for attempt in range(4):
        try:
            d = _api("action=parse&prop=wikitext&page=" + urllib.parse.quote(page.replace(" ", "_")))
        except Exception as e:
            d = {"error": {"code": "exc", "info": str(e)}}
        if "error" in d:
            if d["error"].get("code") == "ratelimited":
                time.sleep(30); continue
            return "__ERR__ " + str(d["error"].get("info"))
        wt = d["parse"]["wikitext"]["*"]
        open(p, "w", encoding="utf-8").write(wt)
        return wt
    return "__ERR__ gave up"
def search(prefix):
    d = _api("action=query&list=prefixsearch&pssearch=" + urllib.parse.quote(prefix) + "&pslimit=50")
    return [x["title"] for x in d["query"]["prefixsearch"]]
def subpages(pg):
    wt = get_wt(pg)
    if wt.startswith("__ERR__"): return wt
    found = []
    for m in re.finditer(r"(?:page=|\[\[)([^\|\]\n}]+)", wt):
        t = m.group(1).strip()
        if "/" in t and t not in found: found.append(t)
    return found
if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "subs":
        for pg in sys.argv[2:]:
            print("===", pg, "->", subpages(pg))
    elif cmd == "search":
        for pg in sys.argv[2:]:
            print(pg, "->", search(pg))
    elif cmd == "get":
        N = int(os.environ.get("N", "2500"))
        for pg in sys.argv[2:]:
            wt = get_wt(pg)
            print("=== " + pg + " (" + str(len(wt)) + ")")
            print(wt[:N])
