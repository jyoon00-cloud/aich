#!/bin/bash
# usage: get.sh <outfile> key=value ...   -> prints API error code or OK
out="$1"; shift
args=()
for kv in "$@"; do args+=(--data-urlencode "$kv"); done
curl -sS -G "https://lol.fandom.com/api.php" --data-urlencode "format=json" "${args[@]}" -o "$out" || { echo CURLFAIL; exit 1; }
python3 -I -c "import json,sys;d=json.load(open(sys.argv[1]));print(d.get('error',{}).get('code','OK'))" "$out"
