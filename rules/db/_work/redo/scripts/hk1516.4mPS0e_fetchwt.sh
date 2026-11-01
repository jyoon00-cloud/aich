#!/bin/bash
cd "$(dirname "$0")"
i=0
while IFS= read -r t; do
  i=$((i+1)); f="wt/$(printf '%03d' $i).json"
  [ -s "$f" ] && ! grep -q ratelimited "$f" && { echo "$i cached $t"; continue; }
  for try in 1 2 3; do
    ./get.sh "$f" action=parse prop=wikitext "page=$t" > last.txt 2>&1 ; r=$(cat last.txt)
    if [ "$r" = "ratelimited" ] || grep -q ratelimited "$f"; then sleep 30; continue; fi
    break
  done
  echo "$i $r $t"
  sleep 3
done < titles.txt
echo DONE
