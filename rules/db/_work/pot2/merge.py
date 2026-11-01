# ③ 포텐·히든 결과를 potential/*.csv에 병합 (Opus 작성)
# 규칙: 명예의 전당(faker 500, uzi 495, caps 495)만 490 초과. 나머지 potential 상한 490.
#       연도별 파일의 단일 능력치가 그 선수 potential을 넘으면 potential로 자른다.
import csv, glob, os
DB = '/home/user/aich/rules/db'
HOF = {'faker': 500, 'uzi': 495, 'caps': 495}
new = {}
for f in sorted(glob.glob(DB + '/_work/pot2/out/p*.csv')):
    for r in csv.DictReader(open(f)):
        new[r['id']] = r
for i, r in new.items():
    p = int(r['potential'])
    r['potential'] = str(HOF[i] if i in HOF else min(p, 490))
# 연도별 능력치 자르기
clipped = []
for f in sorted(glob.glob(DB + '/20*/*.csv')):
    rows = list(csv.DictReader(open(f, newline='')))
    hdr = list(rows[0].keys()); ch = False
    for r in rows:
        if r['id'] not in new: continue
        cap = int(new[r['id']]['potential'])
        for k in ('lan', 'phy', 'skr', 'tf', 'vis'):
            if int(r[k]) > cap:
                clipped.append((f.split('/db/')[1], r['id'], k, r[k], cap)); r[k] = str(cap); ch = True
    if ch:
        w = csv.DictWriter(open(f, 'w', newline=''), fieldnames=hdr, lineterminator='\n'); w.writeheader(); w.writerows(rows)
# potential 파일 갱신
miss = set()
for f in sorted(glob.glob(DB + '/potential/*.csv')):
    rows = list(csv.DictReader(open(f, newline='')))
    hdr = list(rows[0].keys())
    for r in rows:
        n = new.get(r['id'])
        if not n: miss.add(r['id']); continue
        for k in ('potential', 'men', 'clutch', 'pro', 'vol'): r[k] = n[k]
    w = csv.DictWriter(open(f, 'w', newline=''), fieldnames=hdr, lineterminator='\r\n'); w.writeheader(); w.writerows(rows)
with open(DB + '/_work/pot2/merge_log.md', 'w') as o:
    o.write('# merge.py 결과\n\n- 산정 선수 %d명, potential 파일에 있으나 산정 결과 없음: %s\n- 490 초과: %s\n\n## 연도별 능력치 자름 (potential 초과)\n' % (
        len(new), sorted(miss) or '없음', {i: new[i]['potential'] for i in new if int(new[i]['potential']) > 490}))
    for c in clipped: o.write('- %s %s %s %s→%s\n' % c)
print(len(new), 'missing', sorted(miss), 'clipped', len(clipped))
