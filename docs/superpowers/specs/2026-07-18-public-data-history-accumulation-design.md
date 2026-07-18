# 공공 데이터 시계열 축적 루프 설계

> 상태: 승인됨 (2026-07-18). 구현 계획은 `docs/superpowers/plans/`에 별도 작성.
> 상위 맥락: 1순위 "실측 기반 학습 데이터 축적"의 첫 단계 (이미지 없는 실측+기상 시계열 축적).

## 1. 목표와 범위

매시간 스케줄러로 AirKorea 실측 대기질과 기상청 기상값을 PostgreSQL에 **누적 저장**하고,
그 위에 시계열 조회 API와 대시보드 차트를 얹는다. 이 프로젝트에서 **처음으로 공공 데이터를
영구 저장**하고 **처음으로 스케줄러(@EnableScheduling)를 도입**하는 변경이다.

**이번 범위에 포함**
- 수도권(서울·인천·경기) 실측 + 시도별 대표좌표 1점 기상, 매시간 수집·누적
- AI 추정-실측 오차 스냅샷 누적(비교 이력)
- 시계열 조회 API + 대시보드 차트 2개(실측 추이, 오차 추이)
- 수동 수집 트리거(ADMIN), 기동 시 1회 자동 수집, 보존정책 정리 스케줄

**범위 밖 (후속)**
- 이미지 기반 AI 재학습 — 실제 대기 이미지 공급원이 없어 불가. 별도 단계.
- 지도 공공 측정소 시계열 재생, 실측 43곳 기반 IDW — 2순위. 본 축적이 그 전제.
- 공간쿼리용 `geom` 컬럼 — 2순위 실측 IDW 착수 시 후속 마이그레이션으로 추가.

## 2. 결정 사항 (사용자 확정)

| 항목 | 결정 |
|---|---|
| 축적 대상 | 실측 대기질 + 기상 (이미지 없음, 재학습 없음) |
| 수집 범위 | 수도권 서울·인천·경기, 매시간 |
| 기상 수집 | 시도별 대표좌표 1점씩 |
| 계획 범위 | 축적 루프 + 조회 API + 비교 이력 + 대시보드 차트 |

## 3. 아키텍처

기존 `AirKoreaService`·`KmaWeatherService`·`ComparisonService`를 **그대로 호출해 재사용**한다.
실시간 조회용 인메모리 캐시(`TtlCache`)는 손대지 않고, 누적은 별도 경로(DB)로 흐른다.

```
@Scheduled(매시간 10분)  ──┐
POST /api/public-data/collect (ADMIN, 수동) ──┤→ PublicDataCollector
기동 후 1회 (설정) ────────┘        │
                                    ├─ for sido in [서울,인천,경기]:
                                    │     AirKoreaService.current(sido) → upsert public_air_measurement
                                    ├─ for coord in 대표좌표[3]:
                                    │     KmaWeatherService.current(lat,lon) → upsert public_weather_observation
                                    └─ ComparisonService.latest() → insert(멱등) comparison_history
   (각 단계 try/catch, 실패는 로그만·비치명적, upsert 멱등)

프론트 대시보드 → /api/public-data/history/* , /api/air-quality/comparison/history → Recharts
```

패키지(기존 수직 슬라이스 관례 유지, `com.airvision.backend.publicdata` 하위):
- `history/` — 엔티티 3, 리포지토리 3, `PublicDataHistoryService`, `PublicDataHistoryController`, dto
- `collector/` — `PublicDataCollector`, `SchedulingConfig`(@EnableScheduling),
  `PublicDataCollectController`(수동 트리거), 수집 결과 dto

## 4. DB 스키마 (Flyway `V3__public_data_history.sql`)

기존 테이블 무변경. 시각은 전부 `TIMESTAMPTZ`(엔티티는 `Instant`, 기존 관례). 좌표는 lat/lon만.

```sql
CREATE TABLE public_air_measurement (
    id            BIGSERIAL PRIMARY KEY,
    station_name  VARCHAR(100) NOT NULL,
    sido          VARCHAR(20),
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    measured_at   TIMESTAMPTZ NOT NULL,
    pm10          DOUBLE PRECISION,
    pm25          DOUBLE PRECISION,
    o3            DOUBLE PRECISION,
    no2           DOUBLE PRECISION,
    co            DOUBLE PRECISION,
    so2           DOUBLE PRECISION,
    khai          DOUBLE PRECISION,
    pm10_grade    VARCHAR(10),
    pm25_grade    VARCHAR(10),
    collected_mock BOOLEAN NOT NULL DEFAULT FALSE,
    collected_at  TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_pam_station_time UNIQUE (station_name, measured_at)
);
CREATE INDEX idx_pam_sido_time ON public_air_measurement (sido, measured_at);

CREATE TABLE public_weather_observation (
    id            BIGSERIAL PRIMARY KEY,
    sido          VARCHAR(20),
    grid_x        INT NOT NULL,
    grid_y        INT NOT NULL,
    latitude      DOUBLE PRECISION,
    longitude     DOUBLE PRECISION,
    base_time     TIMESTAMPTZ NOT NULL,
    temperature   DOUBLE PRECISION,
    humidity      DOUBLE PRECISION,
    wind_speed    DOUBLE PRECISION,
    wind_direction_deg DOUBLE PRECISION,
    precipitation_type VARCHAR(20),
    collected_mock BOOLEAN NOT NULL DEFAULT FALSE,
    collected_at  TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_pwo_grid_time UNIQUE (grid_x, grid_y, base_time)
);

CREATE TABLE comparison_history (
    id             BIGSERIAL PRIMARY KEY,
    site_id        BIGINT,
    site_name      VARCHAR(100),
    predicted_at   TIMESTAMPTZ NOT NULL,
    predicted_pm25 DOUBLE PRECISION NOT NULL,
    station_name   VARCHAR(100),
    measured_at    TIMESTAMPTZ,
    measured_pm25  DOUBLE PRECISION,
    distance_km    DOUBLE PRECISION,
    time_diff_minutes BIGINT,
    absolute_error DOUBLE PRECISION,
    error_rate_percent DOUBLE PRECISION,
    matched        BOOLEAN NOT NULL,
    computed_at    TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_ch_snapshot UNIQUE (site_id, predicted_at, station_name, measured_at)
);
CREATE INDEX idx_ch_computed ON comparison_history (computed_at);
```

**멱등성**: 측정/기상은 `ON CONFLICT (unique) DO UPDATE`로 upsert(늦은 정정 반영).
비교 이력은 `ON CONFLICT (uq_ch_snapshot) DO NOTHING`(같은 예측·매칭 조합은 한 번만 저장 →
새 예측이 실행되거나 매칭 측정값이 바뀔 때만 새 점이 생겨 의미 있는 추이가 됨).

## 5. 백엔드 컴포넌트

**엔티티** (`ObservationSite` 패턴: `Instant`, `@PrePersist`로 `collectedAt`, protected 기본 생성자,
getter만, geom 미사용): `PublicAirMeasurement`, `PublicWeatherObservation`, `ComparisonHistory`.

**리포지토리** (`JpaRepository`) — upsert는 네이티브 `@Modifying @Query(... ON CONFLICT ...)`.
시계열/집계는 인터페이스 projection + 네이티브 쿼리(기존 `ObservationRepository` 관례):
- `PublicAirMeasurementRepository`
  - `upsert(...)` — 네이티브 upsert
  - `HourlyAvg findHourlyAvg(sido, from, to)` — `date_trunc('hour', measured_at)` 평균(차트용)
  - `List<Series> findSeries(stationName, from, to)`
  - `long count()`, `Instant findMinCollectedAt()` (상태 카드용)
- `PublicWeatherObservationRepository` — `upsert(...)`, `findSeries(sido, from, to)`
- `ComparisonHistoryRepository` — `insertIfAbsent(...)`(네이티브 DO NOTHING),
  `List<Row> findByComputedAtBetween(from, to)`

**서비스**
- `PublicDataCollector`(@Component)
  - `@Scheduled(cron = ${airvision.public-data.collection.cron})` `collectHourly()` —
    `properties.collection().enabled()`가 false면 즉시 반환
  - `@Scheduled` 일 1회 `cleanup()` — `measured_at < now - retentionDays` 삭제
  - `CollectionResult collectOnce()` — 실제 수집 로직(스케줄·수동·기동에서 공용).
    각 시도/좌표/비교를 개별 try/catch로 감싸 하나가 실패해도 나머지 진행.
  - `@EventListener(ApplicationReadyEvent)` `onStartup()` — `collectOnStartup` 플래그면 1회
- `PublicDataHistoryService` — 리포지토리 projection → DTO 매핑, 파라미터 검증(from<to, 기간 상한)

**설정** — `PublicDataProperties`에 `collection` 중첩 레코드 추가:
```
collection:
  enabled: true
  cron: "0 10 * * * *"        # 매시간 10분
  cleanup-cron: "0 30 3 * * *"
  retention-days: 180
  collect-on-startup: true
  sidos: [서울, 인천, 경기]
  weather-points:            # 시도별 대표좌표
    - { sido: 서울, latitude: 37.5665, longitude: 126.9780 }
    - { sido: 인천, latitude: 37.4563, longitude: 126.7052 }
    - { sido: 경기, latitude: 37.2636, longitude: 127.0286 }
```

## 6. 내부 API

| 메서드·경로 | 설명 | 권한 |
|---|---|---|
| `GET /api/public-data/history/measurements/hourly?sido=&from=&to=` | 시간별 평균 PM10/PM2.5 (sido 생략=전체) | USER |
| `GET /api/public-data/history/measurements?stationName=&from=&to=` | 측정소 상세 시계열 | USER |
| `GET /api/public-data/history/weather?sido=&from=&to=` | 기상 시계열 | USER |
| `GET /api/air-quality/comparison/history?from=&to=` | AI 추정-실측 오차 추이 | USER |
| `POST /api/public-data/collect` | 수동 1회 수집(결과 요약 반환) | ADMIN |

`from`/`to` 미지정 시 기본 최근 48시간. 응답은 공통 `ApiResponse<T>`.
수집 결과 요약: `{ measurementsUpserted, weatherUpserted, comparisonSnapshots, mock, collectedAt }`.

## 7. 프론트엔드

- `client.ts`: `MeasurementHourlyPoint{hour, avgPm10, avgPm25, count}`,
  `WeatherSeriesPoint`, `ComparisonHistoryPoint{computedAt, siteName, predictedPm25,
  measuredPm25, absoluteError, matched}` 타입 추가
- `DashboardPage`: Recharts 라인차트 2개 추가 —
  ① 공공 실측 PM2.5 추이(수도권 시간별 평균, 최근 48h)
  ② AI 추정-실측 절대오차 추이(비교 이력)
  두 API 실패는 개별 처리(기존 공공 카드처럼 나머지에 영향 없음). 빈 데이터면 안내 문구.
- 공공 데이터 상태 카드에 "누적 N건" 표시
- 색상은 `grades.ts`/`publicGrades.ts` 팔레트 재사용

## 8. 오류 처리

- 스케줄러는 절대 앱을 죽이지 않는다: `collectOnce()` 내부 각 단위 try/catch, 실패는 `log.warn`
- 외부 API 장애 → 이번 주기 건너뜀(시계열에 빈 구간). upsert 멱등이라 재시도·중복 안전
- Mock 모드에서도 수집하되 `collected_mock=true`로 표시(실키 전환 후 실데이터와 구분 가능)
- `collection.enabled=false`면 스케줄·기동·수동 모두 무동작(설정만으로 기능 정지 가능)

## 9. 테스트

기존 관례(슬라이스·순수 단위, DB 없는 테스트) 유지. 네이티브 쿼리는 실 DB로 사후 검증.
- `PublicDataCollectorTest` — 서비스·리포지토리 목킹: 시도별 `current()` 호출·upsert 호출,
  좌표별 기상 수집, 비교 스냅샷 insert, **한 시도 실패 시 나머지 진행(격리)**,
  `enabled=false` 시 무동작, Mock 플래그 전달
- `PublicDataHistoryServiceTest` — projection → DTO 매핑, 기간 검증
- `PublicDataHistoryControllerTest`, `PublicDataCollectControllerTest` — `@WebMvcTest`+`@MockitoBean` 슬라이스
- `scripts/integration-test.ps1` 항목 추가: ADMIN 로그인 → `POST /collect` → hourly 이력 비어있지 않음 →
  comparison/history 조회 (실 DB·실 서비스 기동 상태에서 검증)

## 10. 위험과 대응

| 위험 | 대응 |
|---|---|
| 스케줄러가 슬라이스 테스트에 영향 | `@SpringBootTest` 없음 → @Scheduled 미로딩. `@WebMvcTest`엔 영향 없음 |
| Mock 데이터가 실데이터와 섞임 | `collected_mock` 컬럼으로 구분, 차트에서 필요 시 필터 |
| 비교 이력 희소(예측 드묾) | 예측 이벤트마다 1점 — 정직한 표현. 빈 차트는 안내 문구 |
| 데이터 무한 증가 | 보존정책 정리 스케줄(기본 180일), 규모 자체가 작음 |
| 기동 수집이 부팅 지연 | `ApplicationReadyEvent` 이후 실행(부팅 완료 후), 실패 비치명적 |
| 경기 측정소 다수 | 시간당 수백 행 수준, Postgres 부담 없음 |

## 11. 완료 조건

1. `V3` 마이그레이션 적용, 3테이블 생성 확인
2. 수동 트리거 1회 → 3테이블에 행 누적, 재실행 시 중복 없음(멱등)
3. hourly/series/weather/comparison-history API가 누적 데이터를 반환
4. 대시보드에 실측 추이·오차 추이 차트 표시
5. 백엔드 단위·슬라이스 테스트 + 프론트 빌드 통과, integration-test 신규 항목 포함 전체 PASS
6. Mock/실 양쪽에서 수집 동작(실키 시 `collected_mock=false`)
