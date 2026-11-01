# 챔피언 정보 교정 지시 (Sonnet 워커용, Opus 설계)

목표: `champions/champions.csv`의 기억 기반 칸을 수집된 근거로 고치고, note의 `(추정)`을 없앤다.

## 고정 (수정 금지)
id, name_en, release, class, attack, resource — Leaguepedia 사실 값.

## 입력
- 현재 값: `rules/db/champions/champions.csv`
- `_work/champ/v2/c*.csv` + `c*_changes.md`: 리워크 연도를 위키로 대조한 2차 값. rework 칸은 v2 값을 우선한다.
- `_work/champ/ev2/*.md`: 공략 페이지 본문 근거. `## {id}`로 찾는다. 한 챔피언이 c*와 d* 두 곳에 있을 수 있다.
- `_work/champ/pro_pos.csv`: 프로 대회(2013~2026 4대 리그·국제대회) 포지션별 출전 비율. `pos_calc`는 비율 15% 이상 포지션을 많은 순으로 이은 값이다.

## 칸별 규칙
- **name_ko**: ev2의 한글명 줄.
- **pos**
  - total_games 20 이상: `pos_calc`를 그대로 쓴다.
  - 20 미만: ev2·op.gg·lolalytics의 주 포지션을 쓰고 note에 `(솔랭 기준)`을 붙인다.
- **diff (1~5)**: 공식 난이도로 정한다. leagueoflegends.com 챔피언 페이지의 난이도 표기(낮음/보통/높음)이고, `curl -sSL -A "Mozilla/5.0" https://www.leagueoflegends.com/ko-kr/champions/{slug}/`로 확인한다.
  - 낮음 → 1~2, 보통 → 3, 높음 → 4~5
  - 같은 등급 안에서는 ev2 서술(메카닉 요구)로 나눈다.
  - 확인한 URL을 changes에 남긴다.
- **curve, lan, skr, tf (1~5, 3=같은 포지션 평균), role**: ev2의 강한 시기·라인전·교전·한타·조합 역할 서술로 정한다. 모든 값을 3·4로 몰지 말고 근거에 따라 개성을 준다. role 태그는 README 목록에서만 고른다.
- **note**: 한국어 30자 이내. 근거 서술에 맞춘다.
  - `(추정)`은 지운다.
  - 근거를 찾을 수 없는 칸만 `(미확인)`.
- **근거가 부족한 칸**
  - WebSearch/WebFetch로 확인한다(공식 사이트, Leaguepedia api.php curl, op.gg, lolalytics, 기사 등 여러 곳).
  - 일반 웹페이지는 Bash curl로 열 수 있다. WebFetch는 시간당 공용 제한이 있어 curl이 막힐 때만 쓴다.
  - **기억으로 채우지 않는다.**

## 출력
- `_work/champ/v3/{배정이름}.csv`: champions.csv와 같은 헤더(전체 16열), 배정 행만 같은 순서로. 쉼표가 든 칸은 큰따옴표.
- `_work/champ/v3/{배정이름}_changes.md`: 바뀐 칸만 `id: 열 이전→이후 (근거 URL 또는 ev2 파일·줄)`.
- 배정 파일만 쓴다. git 명령은 하지 않는다.
- 끝나면 짧게 보고: 행 수, 바뀐 칸 수, (미확인) 칸 목록.
