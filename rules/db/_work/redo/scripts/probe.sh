for p in "$@"; do
 e=$(curl -sS -m 30 "https://lol.fandom.com/api.php?action=query&titles=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$p")&format=json" | python3 -c "import json,sys;d=json.load(sys.stdin);print('MISSING' if any('missing' in v for v in d['query']['pages'].values()) else 'OK')")
 echo "$e  $p"; sleep 1
done
