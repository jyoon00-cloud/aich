#!/bin/bash
D=/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk2019
while IFS= read -r line; do
  y=${line%%_*}; rest=${line#*_}; l=${rest%% *}; ev=${rest#* }
  python3 -I "$D/hk_fetch.py" "$D/${y}_${l}_stats.json" "$ev/Player_Statistics" text
  python3 -I "$D/hk_fetch.py" "$D/${y}_${l}_event.json" "$ev" text
done < "$D/pages.txt"
echo ALLDONE
