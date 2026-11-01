import json,sys
sys.argv_saved=sys.argv
exec(open('/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/tools/tbl.py').read().split("f=sys.argv[1]")[0])
f=sys.argv[1]; idx=[int(x) for x in sys.argv[2:]]
d=json.load(open(f)); p=P(); p.feed(d['parse']['text']['*'])
for i in idx:
    print('--- TABLE',i)
    for r in p.tables[i]['rows']: print(' | '.join(r))
