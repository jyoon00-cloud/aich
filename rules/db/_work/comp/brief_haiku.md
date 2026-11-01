# 대회 방식 근거 수집 (Haiku)
`frame.md`의 항목을 배정 연도마다 조사한다. **기억으로 채우지 않는다.**
- 조회는 Bash curl로 Leaguepedia API: `https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=<페이지>` (공백은 `_`). 대회 페이지 위키텍스트의 infobox에 시작일·종료일·팀 수·방식(format)이 있다.
  페이지 예: `LCK/2024 Season/Spring Season`, `LCK/2024 Season/Spring Playoffs`, `LPL/2025 Season/Split 1`, `LEC/2024 Season/Winter Season`, `LCS/2024 Season/Spring Season`, `2024 Season World Championship`, `2024 Mid-Season Invitational`, 시즌 개요 `LCK/2024 Season`. 이름을 모르면 `action=query&list=prefixsearch&pssearch=<접두어>`로 찾는다.
- 요청 사이 3초. ratelimited면 30초 뒤 재시도. WebFetch는 쓰지 않는다(시간당 제한). 필요하면 WebSearch 결과 요약까지만.
- 출력: `ev/{연도}.md` — frame 항목마다 값과 출처 페이지 이름. 못 찾으면 `못 찾음`.
- `/mnt/project-files`는 네트워크 마운트: 폴더 전체 검색 금지, 자기 파일만 쓰기, 저장 10초 뒤 확인.
