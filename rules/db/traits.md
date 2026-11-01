# 특성 (lolpro §2.9)

선수 특성은 두 종류다.
- **일반 특성:** 아래 목록에서 근거 조건을 만족하면 붙는다.
- **유니크 특성:** 한 선수에게만 있다.

선수별 보유 특성은 `potential/*.csv`의 `traits` 열에 `;`로 이어 적는다(예: `lane_king;iron`, 유니크 대상은 `faker_u`). 효과는 5.3 판정에 더하고, 수치는 공개하지 않고 서사로 드러낸다.

## 1. 일반 특성
부여 조건은 근거 데이터로만 판정한다.
- `_work/redo/changes2`의 개인 성적 백분위·지표
- `_work/pot2/dossier`의 대회·수상 기록
- 연도별 파일

"주전 시즌"은 연도별 파일에서 그 선수가 주전으로 계산된 해를 말한다. 한 선수의 일반 특성은 최대 3개이고, 조건을 많이 넘은 순으로 고른다.

| id | 이름 | 부여 조건 (근거) | 효과 |
|---|---|---|---|
| lane_king | 라인전 지배자 | 주전 시즌 3개 이상, 같은 포지션 CS/M 백분위 0.8 이상인 시즌이 절반 이상 (서폿 제외) | 라인전 장면 +10 |
| skirmisher | 교전 귀신 | 주전 시즌 3개 이상, KP 백분위 0.8 이상인 시즌이 절반 이상 | 소규모 교전 장면 +10 |
| teamfighter | 한타 장인 | 주전 시즌 3개 이상, (KP+KDA)/2 백분위 0.8 이상인 시즌이 절반 이상 | 한타 장면 +10 |
| carry | 캐리 엔진 | 주전 시즌 3개 이상, DMG/M 백분위 0.8 이상인 시즌이 절반 이상 (서폿 제외, DMG/M 없는 해 제외) | 25분 이후 한타 +10 |
| survivor | 생존왕 | 주전 시즌 3개 이상, KDA 백분위 0.85 이상인 시즌이 절반 이상 | 대실패 범위 96~100 → 99~100 |
| big_stage | 빅게임 플레이어 | 월즈·MSI 결승 진출(주전) 3회 이상 | 국제대회 승부처 +10 (클러치와 별도) |
| intl_champ | 세계 정상 경험 | 월즈 우승 주전 1회 이상 | 국제대회 첫 출전 압박 없음, 국제대회 장면 +5 |
| domestic_king | 리그의 왕 | 리그 플레이오프 우승 5회 이상, 월즈 우승 0회 | 지역 리그 승부처 +10 |
| iron | 철인 | 1부 주전 시즌 10개 이상 | 에이징 하락 확률 −10%p |
| late_bloomer | 대기만성 | 첫 주전 시즌 OVR보다 최고 OVR이 40 이상 높고, 최고 OVR이 데뷔 3년 차 이후 | 훈련 성장량 ×1.2 |
| prodigy | 천재 신인 | 데뷔(첫 1부) 시즌 OVR 455 이상, 또는 리그 신인상 수상 | 데뷔 후 2년간 훈련 성장량 ×1.3 |
| globetrotter | 해외파 | 4대 리그 중 2개 이상에서 주전 | 해외 이적 적응 이벤트 완화, 언어·문화 적응 기간 절반 |
| flex | 멀티 포지션 | 연도별 파일에서 2개 이상 포지션으로 주전 | 다른 포지션으로 뛸 때 능력치 페널티 절반 |
| steady | 꾸준함의 대명사 | vol 1~2, 주전 시즌 5개 이상 | 컨디션 '최악'을 '나쁨'으로 처리 |
| choker | 큰 무대 울렁증 | clutch −1 이하이고 결승 패배 3회 이상 | 결승 장면 −10 (부정 특성) |
| dade_award | 다데상 | (커뮤니티 집계는 참고만: `_work/traits/dade_award.md`) Leaguepedia 'dade Award' 공식 수상(Summoning Insight 선정): dade 2013, NaMei 2014, GodV 2015, Clearlove 2016, Doinb 2021 — [Dade Award](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Dade_Award) | 월즈 토너먼트 장면 −10, 월즈 기간 압박 상황 멘탈 −10 (부정 특성) |
| intl_choke | 월즈의 벽 | **우승 후보로 나간** 월즈 3회 이상이고, 커리어 월즈 결승(주전) 0회. 우승 후보 = 그해 월즈 직전 파워랭킹 상위 3팀(`_work/redo/power_rankings.csv`), 파워랭킹을 못 찾은 해(2013·2014·2015·2018)는 강한 리그(리그 보정 −5 이상) 우승팀 또는 MSI 우승팀 | 월즈 토너먼트(8강 이상) 장면 −10 (부정 특성) |

## 2. 유니크 특성
한 선수 전용 특성이다. 이름 하나에 **여러 효과(능력치 보정, 주사위 범위, 컨디션·멘탈 처리 등)**를 짧게 붙인다.

- **대상:** 다음 중 하나에 해당하는 선수.
  - potential 490 이상
  - 월즈 우승 주전 2회 이상
  - 리그 MVP(시즌) 3회 이상
- **id:** `{id}_u`
- **traits 열:** `{id}_u`와 일반 특성(최대 3개)을 함께 적는다.
- **효과 크기:** 효과는 3~5개이고, 각 ±5~20 범위다. Faker만 예외로 더 강하다.
- **부정 효과:** (부정 일반 특성은 3개 제한에서 우선 포함) 다데상 수상, 또는 우승 후보로 나간 월즈에서 반복 탈락한 경우에만 넣는다. 결승 패배 자체는 부정 근거가 아니다. 일반 특성이 부정 특성이어도 traits 열에 그대로 둔다.
- **효과 근거:** 그 선수의 기록(우승·결승, 강한 지표)에 맞춰 고른다.

효과 표기 약어:

| 약어 | 뜻 |
|---|---|
| 승부처 | 2.8 정의 |
| 큰 무대 | 국제대회 토너먼트·결승 |
| 열세 | 골드·오브젝트 뒤처짐 |
| 대성공 | 1d100 대성공 범위 |
| 대실패 | 1d100 대실패 범위 |
| 컨디션 | 5.3 2d6 |
| 에이징 | 4.2 하락 판정 (무효·확률 감소·하락량 절반 등) |
| 성장 | 4.1 훈련 성장량 배율 |

| id | 이름 | 효과 | 근거 |
|---|---|---|---|
| faker_u | 불사대마왕 | 승부처 각 능력치를 max(현재, 480)으로 판정 / 승부처 +20 / 큰 무대 +15 / 열세 시 +15 / 승부처 대성공 1~15, 대실패 없음 / 승부처 컨디션 '나쁨·최악'을 '보통'으로 / 마지막 세트 한타 때 팀원 4명 +10 / 맞상대는 승부처에서 압박 판정 / 에이징 하락 확률 절반·하락량 절반 | 월즈 우승 6회(2013·2015·2016·2023·2024·2025), 2023~25는 OVR 450대에서 우승 — [Tournament_Results](https://lol.fandom.com/api.php?action=parse&format=json&prop=text&page=Faker/Tournament_Results) |

| uzi_u | 小狗 (Puppy) [명예의 전당] | 라인전 +20 / 소규모 교전 +15 / 큰 무대 +10 / 성장 ×1.3 | CS/M 백분위 0.93, KP 0.69; 월즈 준우승 2회 — [Uzi_(Jian_Zi-Hao)](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Uzi_(Jian_Zi-Hao)) |
| caps_u | Baby Faker [명예의 전당] | 지역 리그 승부처 +20 / 큰 무대 +15 / 소규모 교전 +10 / 에이징 하락 확률 −15%p / 다른 포지션 페널티 없음 | 리그 MVP 4회, MSI 2019 우승, 월즈 준우승 2회(2018·2019), 미드·원딜 출전 — [Caps](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Caps) |
| chovy_u | Anchovy | 라인전 +20 / 25분 이후 한타 +15 / 지역 리그 승부처 +15 / 컨디션 최악→나쁨 / **월즈 토너먼트 승부처 −20** | 리그 MVP 5회, DMG/M 0.95·CS/M 0.90; 파워랭킹 상위 3팀으로 나간 월즈 4회(2022·2023·2024·2025) 결승 0회, 다데상 2023(커뮤니티 투표, 비공식 — https://zh.moegirl.org.cn/%E5%A4%A7%E5%B8%9D%E5%A5%96) — [Chovy](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Chovy) |
| knight_u | Knight | 지역 리그 승부처 +15 / 25분 이후 한타 +10 / 큰 무대 +10 / 대실패 99~100 | 리그 MVP 5회, KDA 0.85·DMG/M 0.82 — [Knight_(Zhuo_Ding)](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Knight_(Zhuo_Ding)) |
| rookie_u | Faker Junior | 25분 이후 한타 +15 / 라인전 +10 / 에이징 하락 확률 −15%p / 해외 적응 기간 없음 | 리그 MVP 4회, 월즈 우승 1회, DMG/M 0.84 — [Rookie](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Rookie) |
| doinb_u | Doinb | 소규모 교전 +15 / 마지막 세트 한타 때 팀원 4명 +5 / 큰 무대 +10 / 성장 ×1.2 / **월즈 토너먼트 −10 (다데상 2021)** | 리그 MVP 4회, 월즈 우승 1회, KP 0.74; 다데상 2021(공식) — [Doinb](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Doinb) |
| rekkles_u | 欧洲成哥 (European WeiXiao) | 라인전 +15 / 대실패 99~100 / 지역 리그 승부처 +10 / 컨디션 최악→나쁨 | 리그 MVP 4회, CS/M 0.87·KDA 0.78 — [Rekkles](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Rekkles) |
| bdd_u | 보똥 (Boddong) | 라인전 +10 / 지역 리그 승부처 +10 / 대실패 98~100 | 리그 MVP 3회 — [Bdd](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Bdd) |
| bang_u | Bang | 큰 무대 +15 / 한타 +10 / 대실패 99~100 / 성장 ×1.2 | 월즈 우승 2회 — [Bang](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Bang) |
| bengi_u | Bengi | 큰 무대 +15 / 마지막 세트 한타 때 팀원 4명 +5 / 압박 상황 멘탈 +10 | 월즈 우승 2회 — [Bengi](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Bengi) |
| wolf_u | Wolf | 큰 무대 +15 / 한타 때 팀원 4명 +5 / 성장 ×1.2 | 월즈 우승 2회 — [Wolf_(Lee_Jae-wan)](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Wolf_(Lee_Jae-wan)) |
| beryl_u | BeryL | 큰 무대 +15 / 소규모 교전 +10 / 성장 ×1.2 | 월즈 우승 2회, 서폿 DMG/M 0.63 — [BeryL](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=BeryL) |
| gumayusi_u | Unkillable Demon Prince | 큰 무대 +15 / 승부처 +10 / 라인전 +10 | 월즈 우승 주전 3회(2023·2024·2025) — [Gumayusi](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Gumayusi) |
| zeus_u | Zeus | 소규모 교전 +15 / 큰 무대 +15 / 25분 이후 한타 +10 / 데뷔 후 2년 성장 ×1.3 | 월즈 우승 2회, DMG/M 0.77 — [Zeus](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Zeus) |
| oner_u | Oner | 큰 무대 +15 / 소규모 교전 +10 / 대실패 99~100 | 월즈 우승 3회, KDA 0.81 — [Oner](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Oner) |
| keria_u | Keria | 한타 +15 / 큰 무대 +15 / 대실패 99~100 / 데뷔 후 2년 성장 ×1.3 | 월즈 우승 3회, KDA 0.91·DMG/M 0.85 — [Keria](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Keria) |
| canyon_u | Canyon | 소규모 교전 +15 / 큰 무대 +10 / 대실패 99~100 / 성장 ×1.2 | 월즈 우승 1회, DMG/M 0.83·KDA 0.77 — [Canyon](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Canyon) |
| showmaker_u | ShowMaker | 큰 무대 +15 / 소규모 교전 +10 / 대실패 99~100 | 월즈 우승 1회, KDA 0.73 — [ShowMaker](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=ShowMaker) |
| deft_u | 알파카 (Alpaca) | 에이징 하락 확률 −20%p / 25분 이후 한타 +15 / 큰 무대 +10 / 성장 ×1.2 | 월즈 우승 1회, 장기 주전, DMG/M 0.78 — [Deft](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Deft) |
| ruler_u | Ruler | 25분 이후 한타 +15 / 라인전 +10 / 큰 무대 +10 / 에이징 하락 확률 −10%p | 월즈 우승 1회, DMG/M 0.75·CS/M 0.73 — [Ruler](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Ruler) |
| imp_u | Doubleimp | 라인전 +15 / 큰 무대 +10 / 데뷔 후 2년 성장 ×1.3 / 해외 적응 기간 없음 | 월즈 우승 1회, 데뷔 시즌 상위권 — [Imp](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Imp) |
| kiin_u | Kiinsante | 대실패 99~100 / 라인전 +10 / 성장 ×1.3 / 에이징 하락 확률 −10%p | potential 490, DMG/M 0.77·KDA 0.72 — [Kiin](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Kiin) |
| teddy_u | Walking Nexus | 열세 시 +15 / 소규모 교전 +10 / 라인전 +10 | potential 490, KP 0.76 — [Teddy](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Teddy) |
| mikyx_u | Mikyx | 지역 리그 승부처 +15 / 에이징 하락 확률 −10%p / 성장 ×1.2 | potential 490, 리그 우승 다수 — [Mikyx](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Mikyx) |
| 369_u | The Dice Man | 25분 이후 한타 +15 / 대성공 1~10 / 대실패 99~100 | potential 490, DMG/M 0.78 — [369](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=369) |
| doran_u | Doran | 25분 이후 한타 +15 / 지역 리그 승부처 +10 / 큰 무대 +10 / 에이징 하락 확률 −10%p | potential 490(2026 능력치 최댓값), 월즈 우승 1회(2025), LCK 우승 4회, DMG/M 0.80 — [Doran](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Doran_%28Choi_Hyeon-jun%29) |
| duro_u | Duro | 한타 +10 / 큰 무대 +10 / 성장 ×1.3 | potential 490 (2026 LCK 서폿 최상위) — [Duro](https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=Duro) |

이름은 Leaguepedia 별명(없으면 닉네임). 근거 상세는 `_work/traits/unique_targets.md`, 일반 특성 판정은 `_work/traits/log.md`.
