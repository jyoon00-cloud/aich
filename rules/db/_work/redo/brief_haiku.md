# 선수 DB 근거 수집 (Haiku 워커용)

배정: 한 연도의 4개 리그 파일 `_work/skel/{연도}_{리그}.csv` (선수 id·팀·포지션·출전 수).
그해 이벤트 페이지 이름은 `_work/redo/events.txt` (예: `2024_LCK LCK/2024 Season/Spring Season`).
선수의 Leaguepedia 페이지 이름은 `_work/players_master.csv`의 leaguepedia_page.

## 할 일 (반드시 실제로 조회해서 쓴다. 기억으로 채우지 않는다)
1. **그 스플릿 성적**: Bash로 다음을 실행해 그 이벤트의 선수 통계 표를 받는다.
   `curl -sS "https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page=<이벤트 페이지>/Player_Statistics"`
   (공백은 `_`로. 표에서 선수별 G, W, L, KDA, CS/M, KP%, DMG/M 등을 뽑는다.) 요청 사이 3초 쉰다. ratelimited가 나오면 30초 뒤 다시.
2. **최종 순위**: `<이벤트 페이지>` 자체를 같은 방식(prop=text)으로 받아 팀 순위를 확인한다.
3. **직전 해 평판**: 직전 해 수상(올프로/퍼스트팀, MVP, 파이널 MVP, 월즈·MSI 성적)을 확인한다. 선수 페이지를 Bash curl로 받는다: `https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=<leaguepedia_page>` (수상·커리어 결과가 있다). 주전 선수는 전원 확인한다.

**중요: WebFetch는 시간당 100회 공용 제한이 있어 쓰지 않는다. 모든 조회는 Bash curl로 lol.fandom.com api.php만 쓴다.**
4. 결과를 `_work/redo/ev/{연도}_{리그}.md`에 쓴다:

```
# {연도} {리그} ({이벤트 페이지})
순위: 1 팀A, 2 팀B, ...
## {id} ({팀}, {포지션})
- 스플릿: G 18, W 12, KDA 4.1, KP 68%, DMG/M 520, CS/M 9.1 — 출처 URL
- 직전 해: 2023 LCK 서머 올프로 2nd, 월즈 8강 — 출처 URL
```

못 찾은 항목은 `못 찾음`. 지어내지 않는다. 조회 안 한 URL은 쓰지 않는다.
`/mnt/project-files`는 네트워크 마운트: 폴더 전체 검색 금지, 자기 파일만 쓰기, 리그 하나 끝날 때마다 저장하고 10초 뒤 다시 읽어 확인.
