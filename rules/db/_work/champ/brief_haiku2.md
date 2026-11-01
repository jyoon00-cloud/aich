# 근거 수집 지시 v2 (Haiku 워커용)

1차 수집은 검색 결과 제목만 모아서 쓸 수 없었다. 이번에는 **반드시 페이지 본문을 열어서** 읽는다.

챔피언마다:
1. WebSearch로 `metabot {영문명} guide` 를 검색해 `metabot.gg/ko_KR/league/guides/{영문명}` 결과를 찾고 WebFetch로 연다. (예: https://metabot.gg/ko_KR/league/guides/Aatrox — 가이드 본문에 초반/중반/후반 강약, 라인전·교전·한타 서술, 역할이 있다.)
2. 그 페이지에서 못 찾은 항목은 다른 결과(op.gg, 나무위키, u.gg, mobalytics, leagueoflegends.fandom.com 등)를 WebFetch로 열어 찾는다.
3. `ev2/cXX.md`에 아래 형식으로, **페이지에 실제로 적힌 내용을 짧게 인용·요약**한다.

## {id}
- 한글명: … — URL
- 난이도: … — URL (없으면 못 찾음)
- 강한 시기: 초반/중반/후반에 대한 서술 — URL
- 라인전: … / 소규모 교전: … / 한타: … — URL
- 조합 역할: … — URL

규칙: 페이지를 열지 않은 URL은 쓰지 않는다. 지어내지 않는다. 못 찾으면 `못 찾음`.
`/mnt/project-files`는 네트워크 마운트: 폴더 전체 검색 금지, 자기 파일만 쓰기, 저장 10초 뒤 다시 읽어 확인. 챔피언 10명 끝날 때마다 중간 저장한다.
