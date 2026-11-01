import sys,json,re,urllib.parse
sys.path.insert(0,'.')
from match import load
from extract import standings
EV={
 '2015_LCK':('Champions/2015 Season/Spring Season','p1','s1'),
 '2015_LCS':('NA LCS/2015 Season/Spring Season','p2','s2'),
 '2015_LEC':('EU LCS/2015 Season/Spring Season','p3','s3'),
 '2015_LPL':('LPL/2015 Season/Spring Season','p4','s4'),
 '2016_LCK':('LCK/2016 Season/Spring Season','p5','s5'),
 '2016_LCS':('NA LCS/2016 Season/Spring Season','p6','s6'),
 '2016_LEC':('EU LCS/2016 Season/Spring Season','p7','s7'),
 '2016_LPL':('LPL/2016 Season/Spring Season','p8','s8'),
}
def wiki(p): return 'https://lol.fandom.com/wiki/'+urllib.parse.quote(p.replace(' ','_'),safe='/_():-')
def fmt(v): return v if v not in ('',None) else '-'
def split_line(st,url):
    dm=st['DMGM']
    dm = 'DMG/M 미집계' if dm in ('-','') else 'DMG/M '+dm
    kp = st['KP'] if st['KP'] not in ('-','') else 'KP -'
    kp = kp if kp.startswith('KP') else 'KP '+kp
    return f"스플릿: G {st['G']}, W {st['W']}, L {st['L']}, KDA {st['KDA']}, {kp}, {dm}, CS/M {st['CSM']} — {url}"
def standing_line(key):
    ev,pk,sk=EV[key]
    kind,teams=standings(pk+'.json')
    return ', '.join(f"{p} {t}" for p,t in teams), kind
if __name__=='__main__':
    key=sys.argv[1]
    ev,pk,sk=EV[key]
    res,extra,rows=load(key)
    url=wiki(ev)+'/Player_Statistics'
    st,kind=standing_line(key)
    print(key, kind, st[:300])
    print(split_line(res[0]['stat'],url) if res[0]['stat'] else 'nostat')
