#!/bin/bash
SP=/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad
while IFS= read -r p; do
  fn=$(echo "$p" | sed 's#[/ ]#_#g')
  if [ ! -s "$SP/raw/wt/$fn.json" ] || grep -q ratelimited "$SP/raw/wt/$fn.json"; then
    $SP/fetch.sh "$p" wikitext "$SP/raw/wt/$fn.json"
  fi
  echo "$p" >> $SP/wt_done.txt
done < $SP/pages.txt
echo ALLDONE > $SP/wt_status.txt
