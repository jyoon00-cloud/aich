import json,subprocess,urllib.parse,time,re,html,os
st=json.load(open('stats/all.json'))
res=json.load(open('stats/roles.json')) if os.path.exists('stats/roles.json') else {}
for k,v in st.items():
  for role in ['Top','Jungle','Mid','Bot','Support']:
    key=k+'|'+role
    if key in res: continue
    txt='{{#invoke:ScoreboardPlayerStats|main|tournament=%s|preload=TournamentByChampionRole|role=%s}}'%(v['page'],role)
    q=urllib.parse.urlencode({'action':'parse','format':'json','prop':'text','title':'X','text':txt})
    for a in range(5):
      r=subprocess.run(['curl','-sS','-m','90','https://lol.fandom.com/api.php?'+q],capture_output=True,text=True).stdout
      try: d=json.loads(r)
      except Exception: time.sleep(15);continue
      if 'error' in d: time.sleep(30);continue
      t=d['parse']['text']['*'];rows={}
      for tr in re.findall(r'<tr[^>]*>(.*?)</tr>',t,re.S):
        c=[html.unescape(re.sub(r'<[^>]+>','',x)).strip() for x in re.findall(r'<td[^>]*>(.*?)</td>',tr,re.S)]
        if len(c)>5 and c[1].isdigit(): rows[c[0]]=int(c[1])
      res[key]=rows;break
    print(key,len(res.get(key,{})),flush=True)
    json.dump(res,open('stats/roles.json','w'));time.sleep(2)
