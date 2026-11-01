import sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lp import get_wt
def clean(s):
    s = re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", s)
    s = re.sub(r"\{\{RegionIcon\|([^}]*)\}\}", r"\1", s)
    s = re.sub(r"\{\{team\|([^}]*)\}\}", r"\1", s)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", s).strip(" |")
for pg in sys.argv[1:]:
    wt = get_wt(pg)
    print("##", pg)
    if wt.startswith("__ERR__"): print("  ", wt); continue
    i = wt.find("Qualified for Group Stage")
    if i < 0: print("  (no 'Qualified for Group Stage')"); continue
    seg = wt[i:i+9000]
    end = re.search(r"\n\|\}", seg)
    seg = seg[: end.start()] if end else seg
    rows = [r for r in seg.split("\n|-") ]
    out = []
    for r in rows:
        c = clean(r)
        if re.search(r"Q\b|\d{4}-\d\d-\d\d", c) and len(c) > 10:
            out.append(c[:170])
    for o in out[: int(os.environ.get("MAXR", "30"))]:
        print("  ", o)
