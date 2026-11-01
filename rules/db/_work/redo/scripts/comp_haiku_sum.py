import sys, re, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lp import get_wt
KEY = re.compile(r"Peerless|[Rr]elegat|[Pp]romot|[Cc]ircuit|[Cc]hampionship [Pp]oints|[Rr]egional [Ff]inal|Challengers|LCK CL|LDL|[Aa]cademy|[Ss]eeds?\b|[Ss]eeded|[Pp]lay-?[Ii]n|[Ss]wiss|[Ss]tage|Groups?\b|Best of|[Bb]o\d", re.I)
for pg in sys.argv[1:]:
    wt = get_wt(pg)
    print("##", pg)
    if wt.startswith("__ERR__"):
        print("  ", wt); continue
    def f(k):
        m = re.search(r"^\|" + k + r"\s*=\s*(.*)$", wt, re.M)
        return m.group(1).strip() if m else None
    print("   name:", f("name"), "| sdate:", f("sdate"), "| edate:", f("edate"), "| format:", f("format"))
    # Format section
    m = re.search(r"^===?\s*Format\s*===?\s*$(.*?)(?=^==|\Z)", wt, re.M | re.S)
    if m:
        lines = [l.strip() for l in m.group(1).split("\n") if l.strip()]
        for l in lines[: int(os.environ.get("F","12"))]:
            print("   F>", l[:220])
    else:
        print("   F> (no Format section)")
    seen = []
    for line in wt.split("\n"):
        s = line.strip()
        if KEY.search(s) and not s.startswith("|{{") and len(s) < 300 and s not in seen and not (m and s in m.group(1)):
            seen.append(s)
    for s in seen[: int(os.environ.get("H","6"))]:
        print("   K>", s[:220])
