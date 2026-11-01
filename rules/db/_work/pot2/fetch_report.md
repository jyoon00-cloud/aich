# 포텐·히든 근거 수집 결과 (fetch_pot.py)

## fetch 로그 요약
```
todo 839
FAIL 건수: 0
done
```

## report 최종 출력
```
pages 1327 wt missing 0 [] tr missing 0 []
no page ids ['missing']
```

## 이름 교정
교정 없음 (누락 0건이라 api.php prefixsearch 재조회를 하지 않았다).

## 끝내 못 받은 페이지
없음 (wikitext 0건, Tournament_Results 0건 누락).

## 참고
- players_master.csv에서 leaguepedia_page가 비어 있거나 MISSING인 선수 id: missing (1명). 이 선수는 조회 대상에서 빠져 있다.
- 조회 URL 형식: https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=<이름> (Tournament_Results는 prop=text, page=<이름>/Tournament_Results)
