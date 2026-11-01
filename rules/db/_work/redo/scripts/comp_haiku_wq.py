import sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lp import get_wt
# Worlds qualification paths: lines with team + "Qualified from"/path text
for pg in sys.argv[1:]:
    wt = get_wt(pg)
    print("##", pg, len(wt))
    if wt.startswith("__ERR__"): print("  ", wt); continue
    n = 0
    regs = {}
    for l in wt.split("\n"):
        if re.search(r"\{\{team\||\{\{TeamRoster", l) and re.search(r"Qualif|Champion|Points|Regional|Finals|Playoffs|Stage|Winner|Seed|Qualified|Circuit|Path|Spot|Season|Wildcard", l) and "Qualified for" not in l:
            s = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", l)
            s = re.sub(r"\{\{[^{}]*\|team=([^|}]*)[^{}]*\}\}", r"[\1]", s)
            s = re.sub(r"\{\{RegionIcon\|([^}]*)\}\}", r"\1", s)
            s = re.sub(r"<[^>]+>", "", s)
            if len(s) < 330:
                print("  ", s[:260]); n += 1
        if n > int(os.environ.get("MAXL", "40")): break
