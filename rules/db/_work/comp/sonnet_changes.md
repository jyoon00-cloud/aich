# Sonnet 변경 로그 (competition.md)

새로 확인한 값만 적는다. 나머지는 ev/ 파일 근거.

- 2020 LPL 플레이오프 Bo: 8팀 SE, 1·2위 준결승 직행, 3·4위 8강 직행, 전 경기 Bo5 (결승 Bo5) — https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=LPL/2020_Season/Summer_Playoffs
- 2022 MSI 11번째 초청 팀 지역: 베트남 (VCS Spring Playoffs) — https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=2022_Mid-Season_Invitational
- 2023 LCK/LPL/LEC/LCS 드래프트: 시즌 페이지(LCK/2023 Season/Spring Season, LPL/2023 Season/Spring Season, LEC/2023 Season/Winter Groups, LCS/2023 Season/Spring Season) wikitext에 fearless/peerless/draft 언급 없음 확인 → 규칙 확정 못 해 `미확인`으로 둠 — https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=LCK/2023_Season/Spring_Season (나머지 페이지도 같은 형식)
- 2020 LPL 승강제, 2021 LCK 승강제: LPL/2020 Season/Spring Season, LCK/2021 Season/Spring Season wikitext에 relegation/promotion 언급 없음 → `미확인` 유지 — https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=LPL/2020_Season/Spring_Season

미조회(시간 제약으로 재조사하지 않음, `미확인` 유지): 2013 LPL/EU/NA 드래프트, 2017 NA Summer 7·8위 처리, 2017·2019 월즈 플레이인 일부 지역 선발, 2018 LPL 승강, 2016 MSI 조별 Bo, 2026 LPL 2군 LDL.

## 보완 조회 (2차)
기준 URL 형식: https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=<페이지>

- 2013 LPL/EU/NA 드래프트, 2015·2016 LPL 드래프트, 2023 LCK/LPL/LEC/LCS 드래프트: 시즌 페이지 wikitext에 fearless/peerless 없음 → `일반(피어리스 언급 없음)` (2023 LEC는 Winter Groups, 나머지는 Spring Season 페이지 조회) — page=LPL/2013_Season/Spring_Season, EU_LCS/Season_3/Spring_Season, NA_LCS/Season_3/Spring_Season, LPL/2015_Season/Spring_Season, LPL/2016_Season/Spring_Season, LCK/2023_Season/Spring_Season, LPL/2023_Season/Spring_Season, LEC/2023_Season/Winter_Groups, LCS/2023_Season/Spring_Season
- 2016 MSI 조별: 더블 라운드로빈, 경기 Bo1 (AutoStandings preload=bo1), 브래킷 Bo5 — page=2016_Mid-Season_Invitational
- 2017 월즈 플레이인 참가 12팀 시드: NA#3 C9, EU#3 FNC, LMS#3 HKA, CN#3 WE, TR#1 Fenerbahce, CIS#1 Gambit, BR#1 Team oNe, SEA#2 YG, OCE#1 Dire Wolves, LAS#1 Kaos, LAN#1 Lyon, JP#1 Rampage — page=2017_Season_World_Championship/Play-In
- 2019 월즈 플레이인 12팀 시드: NA#3, KR#3, LMS#3, EU#3, LAT#1, VN#2, TR#1, CIS#1, JP#1(DFM), BR#1, OCE#1(MMM), SEA#1(MEGA) — page=2019_Season_World_Championship/Play-In
- 2021 MSI 선발: LPL/LEC/LCK/PCS/LCL Spring PO, LCS Mid-Season Showdown, LLA Opening PO, TCL Winter PO, CBLOL Split 1 PO, LJL Spring PO, LCO Split 1 PO 우승 (11팀 참가). VCS 우승 GAM은 진출했으나 코로나19 입국 제한으로 불참 (이전 ev의 "12팀, 보상 초청"을 수정) — page=2021_Mid-Season_Invitational
- 2017 NA LCS Summer 7·8위: 해당 문구가 HTML 주석 처리됨 → 미확인 유지 (9·10위 Promotion은 명시) — page=NA_LCS/2017_Season/Summer_Season
- 2014 LPL Spring 하위팀: 7·8위 Autorelegate(Summer 자동 탈락), 상위 6팀 Summer 시드 — page=LPL/2014_Season/Spring_Season
- 2군 리그 존재(prefixsearch): LCK CL 2021~2026 (LCK_CL/2021_Season/Spring_Season ... LCK_CL/2026_Season), LDL 2018~2025 (LDL/2018_Season ... LDL/2025_Season, LDL/2026 접두어 검색 결과 없음), NA Academy League 2018~2022 (NA_Academy_League/2018_Season ... /2022_Season), North American Challengers League 2023~2026 (/2024_Season, /2025_Season, /2026_Season 확인), European Masters 2018~2022 (European_Masters/2018_Season ... /2022_Season), EMEA Masters 2023~2026 (EMEA_Masters/2023_Season ... /2026_Season)
- LCK 프랜차이즈: 2020-04-05 발표, 2021부터 — https://lol.fandom.com/api.php?action=parse&format=json&prop=wikitext&page=2021_LCK_Partnership (페이지 인용: https://www.espn.co.uk/esports/story/_/id/28998589/lck-announces-franchise-2021-season, 이 호스트는 세션에서 열리지 않아 직접 확인 못 함)
- LPL 프랜차이즈: 2017-04 발표, 12팀 승강 폐지(2017 Summer부터), 2018 14팀 — WebSearch 요약: https://www.espn.com.au/gaming/story/_/id/19287373/lpl-implement-franchising-system , https://hkesports.com/no-more-relegation-in-the-lpl-as-the-league-moves-to-a-franchising-system (직접 열람 못 함, 검색 결과 요약 기준) + Leaguepedia LPL/2017 Season/Summer Season(ev: 12팀 고정 슬롯)
- NA LCS 프랜차이즈: 2017-06 발표, 2018부터 10개 상시 팀 — WebSearch 요약: https://mcvuk.com/riot-announces-franchising-is-coming-to-the-na-lcs-in-2018-buy-in-is-10-million/ , https://esports.yahoo.com/riot-games-reveals-details-permanent-partners-na-lcs-replaces-challenger-series-announces-players-association-plans-160016973.html (직접 열람 못 함)
- EU LCS/LEC 프랜차이즈: 2019 프랜차이즈 전환, 2018 midseason부터 승강 폐지, Challenger Series 폐지 후 European Masters — WebSearch 요약: https://africa.espn.com/esports/story/_/id/21225798/league-legends-european-championship-series-move-franchise-partnership-model-abandon-promotion-relegation (직접 열람 못 함)
- 리그 개요 페이지(LoL_Pro_League, League_Championship_Series, League_of_Legends_Champions_Korea, LoL_EMEA_Championship)는 우승 기록 표뿐이어서 franchis/relegation 문구 없음.

한계: ESPN 등 외부 호스트가 세션 네트워크에서 열리지 않아 프랜차이즈 시점은 검색 요약과 Leaguepedia 페이지 기준이다.
미확인으로 남은 칸: 2017 NA LCS Summer 7·8위, 2026 LPL 2군(LDL 2026 페이지 없음)과 탈락 팀 행선지.
