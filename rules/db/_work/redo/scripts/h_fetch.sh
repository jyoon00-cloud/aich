#!/bin/bash
S=/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/h
fetch(){ # title outfile prop
  local t="$1" out="$2" prop="$3" i
  for i in 1 2 3 4 5; do
    curl -sS -G "https://lol.fandom.com/api.php" --data-urlencode "action=parse" --data-urlencode "format=json" --data-urlencode "prop=$prop" --data-urlencode "page=$t" -o "$out" || { sleep 5; continue; }
    if grep -q ratelimited "$out"; then echo "ratelimited $t, wait 30s"; sleep 30; else sleep 3; return 0; fi
  done
  return 1
}
# events
grep -E '^(2013|2014)_' /mnt/project-files/rules/db/_work/redo/events.txt | while IFS= read -r line; do
  key=${line%% *}; page=${line#* }
  pu=${page// /_}
  fetch "$page/Player_Statistics" "$S/ev/${key}_stats.json" text && echo "ok stats $key"
  fetch "$page" "$S/ev/${key}_event.json" text && echo "ok event $key"
done
# players
for f in /mnt/project-files/rules/db/_work/skel/2013_*.csv /mnt/project-files/rules/db/_work/skel/2014_*.csv; do
  y=$(basename $f | cut -c1-4)
  :
done
python3 - "$S" <<'PY' > $S/players.tsv
import csv,glob,sys
m={}
for r in csv.DictReader(open('/mnt/project-files/rules/db/_work/players_master.csv',encoding='utf-8')):
    m.setdefault(r['id'].lower(),r)
seen=set()
for f in sorted(glob.glob('/mnt/project-files/rules/db/_work/skel/2013_*.csv')+glob.glob('/mnt/project-files/rules/db/_work/skel/2014_*.csv')):
    for r in csv.DictReader(open(f,encoding='utf-8')):
        mm=m[r['id'].lower()]
        print(mm['id'],mm['leaguepedia_page'],sep='\t')
PY
while IFS=$'\t' read -r pid pg; do
  safe=$(echo "$pid" | tr -c 'A-Za-z0-9._-' '_')
  [ -s "$S/wt/$safe.json" ] && ! grep -q ratelimited "$S/wt/$safe.json" && continue
  fetch "$pg" "$S/wt/$safe.json" wikitext && echo "ok wt $pid"
done < <(sort -u $S/players.tsv)
echo DONE
