# 공공 대기환경 API 연동 가이드

AirVision 3D의 AirKorea(환경부·한국환경공단)·기상청 공공데이터 연동 문서.
(2026-07-18 작성. 구현 계획: [implementation-plan.md](implementation-plan.md)의
"Public Air Quality API Integration" 섹션)

데이터 출처 표기: **대기질 데이터: 환경부·한국환경공단 AirKorea / 기상 데이터: 기상청**

## 1. 사용 API 목록

| 데이터 | 공공데이터포털 상품 | 서비스 / Operation |
|---|---|---|
| 측정소 정보 | 한국환경공단_에어코리아_측정소정보 (15073877) | `B552584/MsrstnInfoInqireSvc/getMsrstnList` |
| 실시간 대기질 | 한국환경공단_에어코리아_대기오염정보 (15073861) | `B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty` (ver=1.3) |
| 대기질 예보 | 〃 | `getMinuDustFrcstDspth`, `getMinuDustWeekFrcstDspth` |
| 미세먼지 경보 | 한국환경공단_에어코리아_미세먼지 경보 발령 현황 (15073885) | `B552584/UlfptcaAlarmInqireSvc/getUlfptcaAlarmInfo` |
| 기상 실황·예보 | 기상청_단기예보 조회서비스 (15084084) | `1360000/VilageFcstInfoService_2.0/getUltraSrtNcst`, `getUltraSrtFcst` |

모든 호출은 JSON(`returnType=json` / `dataType=JSON`)을 사용한다.

## 2. 공공데이터포털 활용 신청 방법

1. [data.go.kr](https://www.data.go.kr) 회원가입 후 로그인
2. 위 표의 상품명을 검색해 각 상세 페이지에서 **[활용신청]** (자동승인, 개발계정 트래픽 일 10,000건 내외)
3. 마이페이지 → 오픈API → 개발계정에서 **일반 인증키(Decoding)** 확인
4. 승인 직후에는 키 반영에 최대 1시간 정도 걸릴 수 있음 (`SERVICE_KEY_IS_NOT_REGISTERED_ERROR`)

**주의**: `.env`에는 **디코딩(원본) 키**를 넣는 것을 표준으로 한다.
인코딩 키(`%2B` 등 포함)를 넣어도 자동으로 1회 디코드해 이중 인코딩을 방지한다.

## 3. 필요한 환경변수 (루트 `.env`)

```env
AIRKOREA_SERVICE_KEY=your_airkorea_service_key
KMA_SERVICE_KEY=your_kma_service_key
AIRKOREA_BASE_URL=https://apis.data.go.kr/B552584
KMA_BASE_URL=https://apis.data.go.kr/1360000
AIRKOREA_DEFAULT_SIDO=인천
PUBLIC_DATA_MOCK_ENABLED=auto
AIR_QUALITY_CACHE_TTL=1800
WEATHER_CACHE_TTL=1800
COMPARISON_MAX_DISTANCE_KM=5
COMPARISON_MAX_MINUTES=60
```

실제 키를 코드·문서·Git에 넣지 않는다. 로그에도 키를 출력하지 않는다.

## 4. Mock 모드 (키 없이 실행)

`PUBLIC_DATA_MOCK_ENABLED`:

- `auto`(기본): 서비스키가 비어 있으면 Mock, 실키를 넣으면 자동으로 실 API 전환
- `true`: 항상 Mock / `false`: 항상 실 API (키 없으면 503 설정 오류 반환)

Mock 데이터는 실제 API 원본 구조 그대로의 fixture
(`backend/src/main/resources/fixtures/airkorea/raw/`, `fixtures/kma/raw/`)를
동일한 파싱·정규화 경로로 통과시켜 반환한다. 좋음~매우나쁨 4개 등급, 값 없음(`-`),
통신장애, 점검, 좌표 누락 측정소, 활성 경보 시나리오를 포함하며,
날짜 플레이스홀더(`__DATA_TIME__` 등)는 조회 시점의 KST로 치환된다.
화면에는 "Mock 데이터 (서비스키 미설정)" 배지가 표시된다.

## 5. API별 제공 데이터

- **실시간 대기질**: PM10·PM2.5·O3·NO2·CO·SO2·KHAI 값/등급/플래그, 측정시각
- **측정소**: 측정소명·주소·측정망·WGS84 좌표(`dmX`=위도, `dmY`=경도)
- **예보**: 오늘·내일·모레 권역별 등급, 예보 개황·원인·행동요령·예측 이미지 URL, 주간예보(4일)
- **경보**: 지역·권역·항목·주의보/경보·발령/해제 시각·농도
- **기상**: 기온(T1H)·습도(REH)·1시간 강수량(RN1)·강수형태(PTY)·풍향(VEC)·풍속(WSD),
  초단기예보 6시간(+하늘상태 SKY)

## 6. 내부 API 명세 (모두 GET, 로그인 필요: USER/ADMIN)

| 경로 | 설명 |
|---|---|
| `/api/air-quality/stations?addr=&stationName=` | 측정소 검색 |
| `/api/air-quality/stations/nearby?latitude=&longitude=&radiusKm=` | 근접 측정소 (거리순) |
| `/api/air-quality/current?sido=` | 시도별 실시간 (좌표 결합, 지도용) |
| `/api/air-quality/current/stations/{stationName}` | 측정소별 실시간 |
| `/api/air-quality/current/regions/{sido}` | 시도별 실시간 (경로 변수형) |
| `/api/air-quality/forecast?informCode=PM10|PM25|O3` | 대기질 예보통보 |
| `/api/air-quality/forecast/weekly` | 초미세먼지 주간예보 |
| `/api/air-quality/alerts?year=&region=` | 경보 이력 |
| `/api/air-quality/alerts/active` | 발령 중 경보 |
| `/api/air-quality/comparison/latest` | AI 추정 vs 실측 비교 |
| `/api/air-quality/comparison/sites/{siteId}` | 지점별 비교 |
| `/api/weather/current?latitude=&longitude=` | 현재 기상 (초단기실황) |
| `/api/weather/forecast?latitude=&longitude=` | 6시간 기상 예보 (초단기예보) |
| `/api/weather/stations/{stationName}` | 측정소 좌표 기준 기상 |
| `/api/public-data/status` | 연동 상태 (Mock·수집시각) |

측정소 식별자는 공식 API가 안정적 숫자 ID를 제공하지 않아 `stationName`을 사용한다.
응답은 공통 형식 `{success, data, message, timestamp}`.

## 7. 데이터 갱신주기·캐시 정책

프론트엔드는 공공 API를 직접 호출하지 않고 항상 백엔드를 경유한다
(키를 브라우저 번들에 포함하지 않기 위함).

| 데이터 | 캐시 TTL | 비고 |
|---|---|---|
| 실시간 대기질 | 30분 (`AIR_QUALITY_CACHE_TTL`) | AirKorea 갱신주기(1시간)의 절반 |
| 측정소 목록 | 24시간 | 변동 드묾 |
| 예보/주간예보 | 1시간 | 일 4회 발표 |
| 경보 | 30분 | |
| 기상 | 30분 (`WEATHER_CACHE_TTL`) | 실황은 매시 40분 발표 |

- 저장 전략: **DB 미저장, 서버 인메모리 TTL 캐시** (조회·시연 중심 MVP 결정).
  다중 서버 배포 시 인스턴스별 캐시가 분리되는 한계가 있다.
  연구용 장기 저장이 필요해지면 Flyway `V3__public_data.sql`로 확장한다 (TODO).
- 캐시 재조회 실패 시 마지막 정상 데이터를 `stale=true` + 안내 메시지와 함께 반환한다.

## 8. 데이터 유효성 정책

- 응답의 `-`, 빈 문자열, `null`은 숫자로 변환하지 않고 `valid=false`, `status=NO_DATA`
- 데이터 플래그: 통신장애→`COMM_ERROR`, 점검→`MAINTENANCE`, 자료이상→`INVALID`
- **0은 정상 측정값**이며 값 없음과 구분된다
- `measuredAt`(AirKorea 측정시각) ≠ `collectedAt`(백엔드 수집시각)을 분리 관리
- 시각: 공공 API의 KST 문자열("24:00" 표기 포함)을 UTC `Instant`로 변환해 저장·전송,
  화면은 브라우저 로캘(ko-KR)로 표시
- 기상값 |값|≥900은 결측(공식 규칙), 예보의 "강수없음" 같은 문자열 값은 null 처리
- 좌표 없는 측정소는 `locationAvailable=false`로 목록에 표시하되 지도에서 제외
  (임의 좌표 생성 금지)
- 시도명·좌표·연도 등 입력값은 백엔드에서 허용 목록/범위 검증 후 외부 API에 전달

## 9. 3D 시각화 의미

- 공공 측정소 막대(원기둥)의 **높이는 농도 비교용 정규화 값**
  (`frontend/src/config/publicGrades.ts`의 `displayHeightM`)이며,
  실제 오염층의 물리적 높이가 아니다 — 화면에 고정 안내 문구 표시
- 색상 + 텍스트 등급 + △기호(데이터 없음)를 병행해 색상만으로 구분하지 않는다
- 등급 구간(에어코리아 공식): PM2.5 15/35/75, PM10 30/80/150, KHAI 50/100/250
- 풍향 화살표는 **바람의 이동 방향**(기상학적 풍향의 180도 반전)으로 그린다

## 10. AI 비교 기준

- 지점별 최신 AI 예측 ↔ 가장 가까운 AirKorea 유효(PM2.5) 측정소
- 허용 범위: 기본 거리 5km·시간 60분 (`COMPARISON_MAX_*`로 조정)
- `absoluteError = |AI 추정 - 실측|`, 오차율은 실측이 0이거나 유효하지 않으면 생략
- 허용 범위를 벗어나면 비교값을 만들지 않고 `matched=false` + 사유 반환
- 본 프로젝트의 AI 입력은 CCTV가 아닌 업로드 이미지이므로 스펙의 "카메라" 단위는
  관측 지점(`siteId`) 단위로 대응한다

## 11. 알려진 제한사항

- 실 서비스키 미보유 상태에서 개발·검증했으므로 **실 API 응답은 미검증**
  (Mock은 공식 문서의 필드 구조 기준). 키 입력 후 실데이터 확인 필요
- 경보 조회는 올해 연도 기준 (해 넘김 직후 전년도 말 발령 경보는 조회되지 않을 수 있음)
- 경보 "지도 강조"는 권역 폴리곤 데이터가 없어 배너·목록 표시로 대체
- 기상은 측정소 밀집 지역 특성상 지역(측정소 중심점) 단위 1건으로 표시
- 인메모리 캐시라 백엔드 재시작 시 캐시가 비워진다
- 예보 이미지는 URL만 전달 (프록시하지 않음)

## 12. 문제 해결

| 증상 | 원인/조치 |
|---|---|
| "Mock 데이터 (서비스키 미설정)" 배지 | `.env`에 키 입력 후 백엔드 재시작 |
| 503 "서비스키가 설정되지 않았습니다" | `PUBLIC_DATA_MOCK_ENABLED=false`인데 키 없음 → 키 입력 또는 auto |
| 502 + SERVICE_KEY_IS_NOT_REGISTERED_ERROR | 잘못된 키 또는 승인 직후 반영 대기(최대 1시간) |
| 502 + LIMITED_NUMBER_OF_SERVICE_REQUESTS | 일일 트래픽 초과 → 다음 날 또는 운영계정 신청 |
| "마지막 정상 데이터를 표시합니다" | 외부 API 일시 장애 → 캐시 stale 표시, 자동 복구 |
| 키에 % 포함 여부 혼동 | 디코딩 키 권장. 인코딩 키도 자동 1회 디코드됨 |
| 기상 데이터 없음 (매시 40~45분경) | 발표 전 시각 → 이전 시각 자료 자동 사용, NO_DATA면 빈 값 |

## 13. 관련 코드 위치

- 백엔드: `backend/src/main/java/com/airvision/backend/publicdata/`
  (`airkorea/`, `kma/`, `comparison/`, 설정·예외·fixture 로더)
- 공통 유틸: `common/TtlCache.java`, `common/KstTimes.java`, `common/GeoUtils.java`(기존 재사용)
- 프론트엔드: `pages/PublicAirPage.tsx`, `components/AlertBanner.tsx`,
  `config/publicGrades.ts`, `pages/MapPage.tsx`(airkorea 레이어), `pages/DashboardPage.tsx`(공공 카드)
- 테스트: `backend/src/test/java/com/airvision/backend/publicdata/**` (총 63건 중 공공 연동분)
