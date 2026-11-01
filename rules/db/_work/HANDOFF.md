# 선수 DB 작업 상태 (2026-10-31 완료)
- 연도별 56개 파일, potential 5개 파일 완성. 규칙은 ../README.md.
- 재생성 자료: skel/(Leaguepedia 로스터 뼈대), players_master.csv(선수별 출생연도·시즌), standings.txt, pot_in/·pot_out/(포텐 작업 입출력), brief_stats.md·brief_potential.md(워커 지시).
- old/ 와 players_{리그}_*.csv 는 이전 스레드의 기억 기반 값(폐기, 참고용).
- 알려진 한계: 팀당 7명 제한 때문에 교체가 잦았던 팀의 일부 선수 누락(예: 2021 T1 Zeus). LCK 2013~2019, LCS 2013~2019는 분포가 좁아 선형 보정함. 무명 선수 포텐·히든은 공식 추정치.

# 챔피언 DB (2026-11-01 완료)
- champions/champions.csv(173종), champions/meta/2013~2026.csv, champions/README.md.
- _work/champ/: Leaguepedia infobox·대회 통계 원본, fetch/stats/build.py, brief.md, in/·out/(Sonnet 워커 입출력).
- 2026 월즈는 11-01 기준 51경기까지만 반영 → 월즈 종료 후 stats.py 재실행(2026_WORLDS 키 삭제 후) + build.py로 meta/2026.csv 갱신.

# 2026-11-01 재작업 일시정지 상태 (사용자 요청으로 중지)
원칙: Opus는 틀만, **하이쿠가 검색 → 소넷이 교정**. 기억으로 채우지 않는다. WebFetch는 시간당 100회 공용 제한 → Leaguepedia는 Bash curl(api.php)로 조회.

## 챔피언 (db/champions/)
- 완료(사실 데이터): champions.csv의 release/class/attack/resource, meta/2013~2026.csv.
- champ/v2/cXX.csv + cXX_changes.md: 소넷이 리워크 연도를 위키로 대조한 2차 값 (아직 champions.csv에 미반영).
- champ/ev2/cXX.md: 하이쿠가 공략 페이지(metabot.gg) 본문을 연 근거. 약 77/173종. 미수집 목록은 각 파일 안에 있음.
- champ/pro_roles_raw.json + roles.py: Leaguepedia 이벤트·포지션별 챔피언 출전 수. pos 열은 이걸로 계산(포지션별 비율 순, 15%↑). 미반영.
- 남은 일: ev2 미수집 챔피언 근거 수집(하이쿠) → 소넷이 v2+ev2+pro_roles로 교정 → champions.csv 갱신(note의 '(추정)' 제거).

## 선수 DB 재작업 (redo/)
- 능력치·포텐·히든은 기억 기반이었음 → 근거 기반으로 다시 매기는 중.
- redo/brief_haiku.md, redo/events.txt(연도·리그별 이벤트 페이지), redo/ev/{연도}_{리그}.md(하이쿠 근거: 스플릿 성적·순위·직전 해 수상). 일부만 수집됨, 파일 안 '미수집' 표시 참고.
- 남은 일: 나머지 연도·리그 근거 수집 → 소넷 brief 작성(근거로 lan/phy/skr/tf/vis·style 재산정, README 기준표 유지) → 포텐·히든 재산정(수상·커리어 근거).

## 대회 방식 / 연봉 (신규 문서)
- comp/frame.md(형식), comp/brief_haiku.md, comp/ev/{연도}.md(일부). 완성본은 db/competition.md로 소넷이 작성.
- salary/brief_haiku.md, salary/ev.md(근거 4/10 항목). 완성본은 db/salary.md로 소넷이 작성(리그·위치별 가이드라인).
- 결정사항: 코치 DB 없음(AI 즉흥). 팀·계약은 연도별 선수단으로 대체(선수단은 경향일 뿐 강제 아님).

## 중지 시점 수집 현황 (2026-11-01 02:40)
- 선수 근거 redo/ev: 2017 LEC·LPL, 2018 전체(4개)만 미수집. 나머지는 스플릿 성적 대부분 수집(이름 불일치 소수는 파일에 표시). 순위는 LCK 외엔 정규시즌 순위인 곳이 많음. 직전 해 수상은 주전의 약 절반만 조회('미수집' 표시), 2013~14는 이 필드 신뢰 불가.
- 대회 방식 comp/ev: 2013(부분), 2020~2022 완료, 2023(부분), 2014~2019·2024~2026 미수집.
- 챔피언 포지션 원본 champ/pro_roles_raw.json: 350/350 조회 완료(아직 champions.csv 미반영).
- 워커 스크립트 사본: redo/scripts/ (스크래치 원본·캐시는 세션 종료 시 사라짐).
- 다음 순서: ①미수집분 하이쿠 수집 ②소넷이 선수 능력치·챔피언·competition.md·salary.md 작성 ③포텐·히든 재산정.


# 2026-11-01 이어서 작업 (세션 2)
## ① 근거 수집 — 완료
- redo/ev 56개 전부 수집. 직전 해 수상 '미수집' 0. 모든 선수에 `직전 해 대회(YYYY)` 줄(Tournament_Results 기반, scripts/opus_tr.py) 추가. Leaguepedia 페이지 없는 22명은 비움.
- comp/ev 2013~2026, salary/ev(Sonnet 추가 포함), champ/ev2 d1~d3(96종) + pro_pos.csv(대회 포지션 비율).
- 교훈: 대회 성적은 선수 wikitext가 아니라 `<선수>/Tournament_Results`(prop=text)에 있다. 나무위키는 클라우드 IP를 Cloudflare로 차단(설정으로 해결 불가).

## ② 소넷 교정 — 완료
- 연도별 능력치 56개 파일: 근거 산식(팀 순위 → 직전 해 실적 가산 → 같은 포지션 성적 ±10)으로 재산정. 변경 로그 redo/changes/{연도}_{리그}.md. 지시서 redo/brief_sonnet_stats.md.
- 포지션 오류 정정(원본 로스터 오류): 2020 LCK chovy MID, 2018 LEC vander SUP, 2018 LCK wolf SUP(정글 출전도 있었음, 오류 아님·주 포지션 기준), 2014 LPL jojo MID, 2017 LCS ninja MID.
  남은 의심(CS/M과 pos 불일치, 미확인): 2013 LEC samux, 2014 LCS xmithie, 2015 LEC overpow, 2015 LPL loveling, 2016 LCS gate, 2020 LPL fenfen, 2013 LPL leon/2014 LPL ycc/2013 LCS heartbeat(AD인데 CS 낮음), 2013 LPL duff.
- champions.csv: v3/g1~g3 반영(공식 난이도, 대회 포지션, (추정) 제거). locke만 일부 (미확인).
- competition.md, salary.md 작성. 승강제 폐지 시점은 검색 요약 근거(기사 본문 미확인). salary는 [번호] 근거·(보간)·근거 없음 표기.
- 알려진 한계: 로스터 7명 제한 누락(예: 2016~17 Moon, 2019 CLG Wiggily). 2025·2026 일부 리그 순위는 팀 승률로 대체.

## ②-2 능력치 통일 재계산 — 완료 (사용자 지시)
- 산식 `redo/formula.md`, 스크립트 `redo/scripts/unified.py`(원본 백업을 입력으로 재실행 가능), 내역 `redo/changes2/`.
- 주전 OVR = 개인 성적 백분위(400~470) + 팀 순위(±10) + 직전 해 실적(월즈 20/14/9/5, MSI 6/3/1, FS·EWC·리그 우승·MVP·퍼스트 올프로 +1, 합산·상한 없음) + 리그 보정.
- 리그 보정: 그해 국제대회(월즈 1.0, MSI 0.3, FS·EWC 0.1) 성적으로 매년 계산 `redo/league_offset.csv`, 순위표 `redo/worlds.csv`. README에 표.
- **2026 월즈 종료 후 할 일:** worlds.csv 2026 행 갱신 → unified.py 재실행 → pot2/merge.py 재실행 → champions meta 2026 갱신.

## ③ 포텐·히든 재산정 — 완료
- pot2/fetch_pot.py → build_dossier.py(dossier/p1~p6) → 소넷 out/p1~p6 → merge.py로 potential/*.csv 반영(merge_log.md).
- 명예의 전당(faker 500, uzi·caps 495) 외 potential 상한 490, 초과하던 연도별 능력치 20칸은 490으로 절삭.
- vol은 개인 성적 백분위 변동(추세 제거)으로 Opus가 merge.py에서 재계산. clutch는 결승·국제대회, pro는 시즌 수 기준.
- men·pro 기사 검색: 대상(최고 OVR 455↑ 또는 국제 우승) 중 약 80명은 미검색(changes에 '검색 미실시'), 검색한 선수도 대부분 근거 없음으로 기본값. 반영 예: letme·pawn·wolf·crown·broxah men 2, clid pro 1 등. Huanfeng·Xiaohu 사생활 보도, Zeus 계약 분쟁은 본문 미확인으로 미반영.
- 'missing' id 선수(MISSING, LPL 서포터)는 페이지명이 결측 표시와 겹쳐 스크립트에서 예외 처리.

## 결정사항
- 채팅 앱(사용자 API 키, OpenRouter/OrcaRouter 등 OpenAI 호환 가능) 만들 때 장기 기억은 PDF가 아니라 텍스트: 상태 카드 + 연대기 요약 + 최근 대화 몇 턴.
- 검색이 반복 실패하면 Opus가 원인·조회 방법을 정하고 하이쿠에는 단순 반복만 시킨다(CLAUDE.md).
