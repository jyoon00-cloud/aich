# Phase 1 작업 지시 (LCK CL 선수 목록)
`/mnt/project-files/rules/db/README.md`를 먼저 읽는다.
LCK CL 2021~2026 각 시즌 스프링 로스터의 선수 중 **그해 LCK 1부에 없던 선수**를 정리한다(웹 검색으로 확인, Leaguepedia 등).
`/mnt/project-files/rules/db/_work/players_CL_2021-2026.csv`에 작성:
`id,name,pos,birth_year,first_year_seen,leagues_seen,note`
- id = 닉네임 소문자 영문/숫자. leagues_seen = CL (나중에 1부 올라간 걸 알면 CL|LCK).
- 팀당 주전 5명 정도. 모르는 birth_year는 비움.
- `/mnt/project-files`는 네트워크 마운트: 끝 슬래시, 폴더 전체 검색 금지, 자기 파일만 쓰기, 저장 10초 뒤 재확인.
끝나면 선수 수와 불확실한 부분을 짧게 보고.
