# competition.md 작성 지시 (Sonnet 워커용, Opus 설계)

입력: `_work/comp/frame.md`(형식), `_work/comp/ev/2013.md` ~ `2026.md`(하이쿠 근거, 출처 포함).
출력: `rules/db/competition.md`

## 규칙
- frame.md 형식을 연도마다 똑같이 쓴다. 문서 맨 위에 짧은 사용 안내를 둔다(AI 디렉터가 시작 연도의 대회 일정·방식을 여기서 읽는다. 시뮬레이터 실행 중에는 웹 검색하지 않는다).
- 값은 ev 파일에서만 가져온다.
  - ev가 `못 찾음`인 칸: 먼저 WebSearch/WebFetch 또는 Bash curl로 Leaguepedia(`https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=<페이지>`)를 확인한다.
  - 그래도 없으면 `미확인`으로 둔다. **기억으로 채우지 않는다.**
  - 새로 확인한 값은 `_work/comp/sonnet_changes.md`에 `연도 항목: 값 — URL`로 남긴다.
- 리그 명칭은 그해 명칭으로 쓴다(Champions/LCK, NA LCS/LCS/LTA North, EU LCS/LEC). 날짜는 YYYY-MM-DD.
- 2026 월즈는 진행 중이다(2026-11-01 기준). 확정된 방식·일정만 쓰고 결과는 쓰지 않는다.
- 연도별 본문에는 출처 URL을 넣지 않는다(읽기용 문서). 출처는 ev 파일과 sonnet_changes.md에 있다.
- git 명령은 하지 않는다. 끝나면 짧게 보고: 미확인 칸 목록.
