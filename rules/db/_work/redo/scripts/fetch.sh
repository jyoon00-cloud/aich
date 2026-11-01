#!/bin/bash
# usage: fetch.sh <page> <prop> <outfile>
SP=/tmp/claude-0/-home-user/c8159541-2544-5b5b-8bf7-99f3f695737b/scratchpad
for try in 1 2 3; do
  curl -sS -G "https://lol.fandom.com/api.php" --data-urlencode "action=parse" --data-urlencode "format=json" --data-urlencode "prop=$2" --data-urlencode "page=$1" -o "$3"
  if grep -q ratelimited "$3" 2>/dev/null; then sleep 30; else break; fi
done
sleep 3
