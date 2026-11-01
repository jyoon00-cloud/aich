# 롤프로 AI챗 작업 안내

LoL 프로게이머 AI챗 시뮬레이터의 규칙 문서와 DB입니다. 사용자에게는 한국어로 답합니다.

## 파일
- `rules/lolpro.md`: 기본 규칙 문서. `rules/개선제안.md`: 반영 대기 목록.
- `rules/db/README.md`: DB 읽기 규칙과 기준표.
- `rules/db/_work/HANDOFF.md`: **작업 상태와 다음 순서. 이어서 작업할 때 이 파일부터 읽는다.**

## 작업 규칙 (사용자 지시, 반드시 지킴)
- 역할 분담: Opus는 구조와 틀만 설계한다. **Haiku 워커가 웹 검색으로 근거와 URL을 모으고, Sonnet 워커가 그 근거로 데이터를 교정한다.**
- DB 값은 **모델 기억으로 채우지 않는다.** 모든 워커 지시문에 "WebSearch/WebFetch로 확인"을 넣고, changes 로그에 출처 URL을 남기게 한다. "웹 검색 하지 않음" 같은 지시는 절대 쓰지 않는다.
- 저렴한 모델로 토큰을 아끼는 건 괜찮지만, 지시를 어겨서 아끼는 건 안 된다.
- Leaguepedia는 Bash `curl`로 `lol.fandom.com/api.php?action=parse`를 쓴다(cargoquery는 막힘). WebFetch는 시간당 호출 제한이 있다.
- 답변은 짧게 하고, 긴 사과는 하지 않는다.
- 시뮬레이터 실행 중 AI는 선수를 웹 검색하지 않는다(게임 규칙). 위의 검색 규칙은 DB 제작에만 해당한다.
