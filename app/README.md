# 롤프로 시뮬레이터 (스크립트판)

15세 무소속 아마추어에서 시작해 아카데미 → 2군 → 1군 → 월즈까지 가는 커리어 시뮬레이터입니다.
**스크립트가 모든 계산과 결과를 정하고, AI는 묘사만 합니다.** AI 키가 없어도 끝까지 플레이됩니다(묘사는 문장 템플릿).
기존 AI 채팅판은 `app/chat/`에 있습니다.

## 플레이 방법
1. **새 게임**: 이름·닉네임·포지션·시작 시점(2013~2026년 1월)·5개 능력치(0~500, 합계 제한 없음)·성격 키워드 2~3개를 고르고, 배경 3지선다(판정형·성장형·이색)에서 하나를 고릅니다. 히든 스탯은 비공개로 굴려집니다.
2. **한 주가 한 턴**입니다. 훈련(집중 2개) / 솔로랭크 집중 / 방송 / 휴식 중 하나를 고르면 성장 판정, 솔로랭크, 이벤트, 경기가 순서대로 처리됩니다.
3. **자동 진행**: 1·4·12주, 다음 경기까지, 다음 시즌까지. 멈춤 조건(공식 경기 주, 능력치 등급 상승, 티어 변화, 시즌 종료, 매 주 요약)은 체크박스로 고르고, 선택이 필요한 이벤트에서는 항상 멈춥니다.
4. **경기**는 밴픽(주력 챔피언 풀에서 선택 또는 자동) 후 **관전**(미니맵 + 문자중계, 선수 말 10개) 또는 바로 결과로 봅니다. 관전 범위(전부/중요 경기/결과만)와 속도는 설정에서 바꿉니다.
5. 일정은 연도마다 다릅니다(`app/data/schedule.json`, 출처 `rules/db/competition.md`). 2027년 이후는 2026 일정을 반복합니다.
6. 세이브는 브라우저 `localStorage`에 자동 저장되고, 메뉴에서 JSON으로 내보내기/불러오기를 할 수 있습니다.

## GitHub Pages 설정
- Settings → Pages → Source: **Deploy from a branch**, Branch: `main`, Folder: `/ (root)`.
- 접속 주소: https://jyoon00-cloud.github.io/aich/app/
- 앱이 `../rules/db/...`를 읽으므로 `app/`과 `rules/`가 같은 저장소 루트에 있어야 합니다.

## AI 묘사 설정 (선택)
메뉴 → 설정에서 제공자(orcarouter / openrouter / anthropic / custom), Base URL, API 키, 모델을 넣습니다. 키는 이 기기의 `localStorage`(`lp2_settings`)에만 저장됩니다.
- OpenAI 호환: `POST {baseUrl}/chat/completions` (스트리밍 없음).
- Anthropic: `POST https://api.anthropic.com/v1/messages` (`x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`, 기본 모델 `claude-opus-5-5`, `max_tokens` 600).
- 입력은 사실 JSON뿐(수백 자)이고, 수동 진행 때 경기·이벤트·시즌 카드만 부릅니다. 자동 진행은 멈춘 시점에 요약 1회, 관전은 세트 종료 후 하이라이트 1회입니다. 실패하면 템플릿 문장을 씁니다.

## 내 PC에서 실행
저장소 루트에서 정적 서버를 띄우고 `/app/`을 엽니다(파일을 직접 열면 `fetch`가 막힙니다).

```
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000/app/
```

## 개발
- 엔진 테스트(DOM 없음): `node app/test/run.js` — 시드 고정 3년 이상 자동 진행, 능력치 0~500, 날짜 +7일 연속, 세이브 왕복·재개 결정성.
- 브라우저 테스트: `node app/test/browser.js` (Playwright, 새 게임 → 생성 → 4주 → 경기 관전까지 콘솔 오류 확인).
- 일정 데이터 재생성: `python3 app/tools/build_schedule.py` (`rules/db/competition.md` → `app/data/schedule.json`).
- 구성: `js/rng.js` 시드 난수 · `rules.js` 수치표·배경·이벤트 · `data.js` DB 로드 · `state.js` 상태·저장 · `league.js` 월드·달력·NPC · `match.js` 경기 엔진·타임라인 · `create.js` 생성 · `week.js` 주간 진행 · `narrate.js` 묘사 · `ui.js`/`main.js` 화면.
- 설계서: `app/SPEC.md`, 규칙 원문: `rules/lolpro.md`.
