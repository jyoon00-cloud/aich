#!/bin/bash
D=/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad/hk2019
mkdir -p "$D/wt"
while IFS=$'\t' read -r pg yrs; do
  f="$D/wt/$(echo "$pg" | tr ' /()' '____').json"
  [ -s "$f" ] && continue
  python3 -I "$D/hk_fetch.py" "$f" "$pg" wikitext
done < "$D/wt_pages.txt"
echo WTDONE
