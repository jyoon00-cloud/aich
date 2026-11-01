import json, sys, csv, re
sys.path.insert(0, sys.argv[1])  # dir with tblparse module
from hk_tbl import tables
mdir = '/mnt/project-files/rules/db/_work'
# master name map
master = {}
with open(mdir + '/players_master.csv', encoding='utf-8') as f:
    for r in csv.DictReader(f):
        master.setdefault(r['name'].lower(), []).append(r['id'])
        master.setdefault(r['id'].lower(), []).append(r['id'])
d = json.load(open(sys.argv[2], encoding='utf-8'))
tbls = tables(d['parse']['text']['*'])
out = []
for t in tbls:
    hdr = None
    for r in t:
        if 'KDA' in r and 'CS/M' in r: hdr = r; break
    if not hdr: continue
    for r in t:
        if len(r) < len(hdr) or r is hdr: continue
        name = r[1].strip()
        if not name or name == hdr[1]: continue
        rec = {hdr[i] if hdr[i] else str(i): r[i] for i in range(2, len(hdr))}
        # headers: G appears twice (games, gold); assign by position
        vals = r
        rec2 = {'name': name, 'G': r[2], 'W': r[3], 'L': r[4], 'WR': r[5], 'KDA': r[9], 'CS/M': r[11], 'GOLD/M': r[15], 'DMG/M': r[17], 'KPAR(KP)': r[18], 'CP': r[21], 'Champs': r[22] if len(r) > 22 else ''}
        out.append(rec2)
    break
json.dump(out, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(out), 'rows')
for o in out[:3]: print(o)
