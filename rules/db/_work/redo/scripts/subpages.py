import sys, re
sys.path.insert(0, "/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad")
from fetch import get_wt
for pg in sys.argv[1:]:
    wt = get_wt(pg)
    if wt.startswith("__ERR__"):
        print(pg, wt); continue
    found = []
    for m in re.finditer(r"(?:page=|\[\[)([^\|\]\n}]+)", wt):
        t = m.group(1).strip()
        if "/" in t and t not in found:
            found.append(t)
    print("===", pg, "->", found[:30])
