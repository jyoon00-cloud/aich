#!/bin/bash
cd /tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/haiku
while IFS=$'\t' read -r id page; do
  [ -s "wt/$id.json" ] && ! grep -q '"error"' "wt/$id.json" && continue
  python3 -I fetch.py wikitext "wt/$id.json" "$page" >> wt_log.txt 2>&1
done < wt_list.txt
echo DONE >> wt_log.txt
