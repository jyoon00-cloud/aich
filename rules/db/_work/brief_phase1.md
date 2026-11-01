# Phase 1 작업 지시 (연도별 능력치 + 선수 목록)

먼저 `/mnt/project-files/rules/db/README.md`와 샘플 `/mnt/project-files/rules/db/2024/LCK.csv`를 읽고 수치 기준을 맞춘다.

## 할 일
배정받은 리그·연도마다:
1. 그해 **스프링 스플릿 개막 시점** 1부 리그 로스터를 정리한다. 팀당 주전 5명 + 그 스플릿에 실제 출전한 교체 선수(팀당 최대 7명).
   - 2013~2014 한국: OGN Champions 스프링 참가팀(형제팀 각각 별도 팀).
   - 2025 북미: LTA North (북미 팀만).
   - 확실하지 않은 로스터는 웹 검색(Leaguepedia lol.fandom.com 등)으로 확인한다. 아는 건 검색하지 않는다.
2. `/mnt/project-files/rules/db/{연도}/{리그}.csv`에 작성:
   `id,team,pos,lan,phy,skr,tf,vis,style` (멘탈은 히든 스탯이라 여기 없음)
   - id = 닉네임 소문자, 영문/숫자만(공백·특수문자 제거). 같은 선수는 모든 연도에서 같은 id.
   - pos: TOP/JUNGLE/MID/AD/SUP
   - 능력치는 README 기준표로, **그해 그 리그 안의 상대적 위치**와 선수 특징(라인전 강자, 한타형, 시야 좋은 서폿 등)을 반영. 5개 평균(OVR)이 위치 기준에 맞게. LEC −10, LCS −20.
   - 같은 선수의 연도 간 변화도 자연스럽게(전성기 → 하락 등).
   - 각 능력치 최대 490 (Faker만 500까지, Uzi·Caps 495까지).
   - style은 한 단어 한국어.
3. `/mnt/project-files/rules/db/_work/players_{리그}_{시작연도}-{끝연도}.csv`에 이번에 다룬 모든 고유 선수를 작성:
   `id,name,pos,birth_year,first_year_seen,leagues_seen,note`
   - birth_year 모르면 검색, 그래도 모르면 비움. note는 커리어 특징 한 줄(선택).

## 파일 규칙
- `/mnt/project-files`는 네트워크 마운트. 경로에 끝 슬래시를 붙이고 폴더 전체 검색을 하지 않는다. 자기 담당 파일만 쓴다.
- CSV는 UTF-8, 헤더 포함, 따옴표 없이(쉼표 들어가는 note는 쉼표를 빼고 작성).
- 작성 후 약 10초 뒤 파일을 다시 읽어 저장 확인.
- 끝나면 파일 목록, 팀 수/선수 수, 불확실했던 부분을 짧게 보고.
