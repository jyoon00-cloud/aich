import sys, time, json, urllib.parse, subprocess, os
# usage: hk_fetch.py OUTFILE PAGE PROP
out, page, prop = sys.argv[1], sys.argv[2], sys.argv[3]
url = "https://lol.fandom.com/api.php?action=parse&format=json&prop=%s&page=%s" % (prop, urllib.parse.quote(page.replace(' ', '_')))
for attempt in range(4):
    time.sleep(3)
    r = subprocess.run(["curl", "-sS", "--max-time", "60", url], capture_output=True, text=True)
    if r.returncode != 0:
        print("curl fail", page, r.stderr.strip()); continue
    if "ratelimited" in r.stdout:
        print("ratelimited", page); time.sleep(30); continue
    try:
        d = json.loads(r.stdout)
    except Exception:
        print("bad json", page, r.stdout[:200]); continue
    if "error" in d:
        print("api error", page, d["error"].get("info", "")[:200]); sys.exit(2)
    open(out, "w", encoding="utf-8").write(r.stdout)
    print("ok", page, len(r.stdout)); sys.exit(0)
print("FAILED", page); sys.exit(1)
