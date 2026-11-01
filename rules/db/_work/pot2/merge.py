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
# vol(기복) 재계산 (Opus 수정): 총 OVR은 직전 해 실적·팀 순위 가산 때문에 해마다 크게 출렁여 기복 지표로 부적합.
# 대신 개인 성적 백분위 p(redo/changes2의 'base N(개인, p=x)') 시계열에서 선형 추세를 뺀 잔차 표준편차를 쓴다.
# 기준(분포 분위수에 맞춤): sd<=0.05 → 2, <=0.12 → 3, <=0.17 → 4, 그 이상 → 5. 3시즌 이상 모두 p>=0.7 → 1. 3시즌 미만 → 3.
import re
ser = {}
for f in glob.glob(DB + '/_work/redo/changes2/*.md'):
    y = int(os.path.basename(f)[:4])
    for l in open(f):
        m = re.match(r'- (\S+): .*?base \d+\(개인, p=([\d.]+)\)', l)
        if m: ser.setdefault(m.group(1), []).append((y, float(m.group(2))))
volchg = []
for i, r in new.items():
    s_ = sorted(ser.get(i, []))
    if len(s_) < 3: v = 3
    else:
        xs = [a for a, b in s_]; ys = [b for a, b in s_]; n = len(xs); mx = sum(xs)/n; my = sum(ys)/n
        sl = sum((x-mx)*(y-my) for x, y in zip(xs, ys)) / (sum((x-mx)**2 for x in xs) or 1)
        res = [y - (my + sl*(x-mx)) for x, y in zip(xs, ys)]
        sd = (sum(e*e for e in res)/n) ** 0.5
        v = 2 if sd <= 0.05 else 3 if sd <= 0.12 else 4 if sd <= 0.17 else 5
        if all(y >= 0.7 for y in ys): v = 1
    if str(v) != r['vol']: volchg.append((i, r['vol'], v))
    r['vol'] = str(v)
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
    o.write('\n## vol 재계산 (추세 제거 잔차 기준, %d명 변경)\n' % len(volchg))
    for c in volchg: o.write('- %s %s→%s\n' % c)
print(len(new), 'missing', sorted(miss), 'clipped', len(clipped))
