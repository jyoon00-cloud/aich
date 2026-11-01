import sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lp import get_wt
def info(pg, nb=4):
    wt = get_wt(pg)
    print("##", pg)
    if wt.startswith("__ERR__"):
        print("   ", wt); return
    def f(k):
        m = re.search(r"^\|" + k + r"\s*=\s*(.*)$", wt, re.M)
        return m.group(1).strip() if m else ""
    tc = len(set(re.findall(r"\{\{TeamRoster\|team=([^|}]*)", wt)))
    print("   teams:", tc, "| dates:", f("sdate"), "~", f("edate"), "| loc:", f("country"), "| fmt:", f("format"))
    m = re.search(r"^===?\s*Format\s*===?\s*$(.*?)(?=^==|\Z)", wt, re.M | re.S)
    if m:
        ls = [l.strip() for l in m.group(1).split("\n") if l.strip().startswith("*") and not l.strip().startswith("<!--")]
        for l in ls[:nb]:
            print("   F>", re.sub(r"\[\[([^\]|]*\|)?([^\]]*)\]\]", r"\2", l)[:170])
    flags = []
    for k in ["Peerless", "Promotion", "Relegat", "Challengers", "Circuit", "Championship Points", "Regional", "Play-In", "Swiss", "Best of five", "Best of three", "Best of one", "cancel"]:
        c = len(re.findall(k, wt, re.I))
        if c: flags.append(f"{k}:{c}")
    print("   flags:", ", ".join(flags))
if __name__ == "__main__":
    nb = int(os.environ.get("NB", "4"))
    for pg in sys.argv[1:]:
        info(pg, nb)
