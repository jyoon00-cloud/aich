import csv, json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
mdir = '/mnt/project-files/rules/db/_work'
master = list(csv.DictReader(open(mdir + '/players_master.csv', encoding='utf-8')))
by_id = {r['id'].lower(): r for r in master}
by_name = {}
for r in master: by_name.setdefault(r['name'].lower(), []).append(r)
def find_master(ident, name):
    ids = set()
    if ident.lower() in by_id: ids.add(ident.lower())
    for r in by_name.get(name.lower(), []): ids.add(r['id'].lower())
    return ids
def skeleton(path):
    return list(csv.DictReader(open(path, encoding='utf-8')))
if __name__ == '__main__':
    y, l = sys.argv[1], sys.argv[2]
    skel = skeleton(f'{mdir}/skel/{y}_{l}.csv')
    st = json.load(open(sys.argv[3], encoding='utf-8'))
    rows = {}
    for s in st: rows.setdefault(s['name'].lower(), s)
    print('skeleton players', len(skel), 'stats rows', len(st))
    for p in skel:
        pid = p['id']
        cand = rows.get(pid.lower())
        if cand is None:
            for r in master:
                if r['id'].lower() == pid.lower():
                    cand = rows.get(r['name'].lower())
                    break
        print(f"{pid:12s} {p['team'][:22]:22s} {p['pos']:7s} skelG={p['games'] or '-':>3s} stat={'Y' if cand else 'N'} {cand['G'] if cand else ''} {cand['KPAR(KP)'] if cand else ''}")
