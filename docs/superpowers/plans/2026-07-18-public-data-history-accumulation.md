# 공공 데이터 시계열 축적 루프 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매시간 스케줄러로 AirKorea 실측·기상청 값을 PostgreSQL에 누적하고, 시계열 조회 API와 대시보드 차트, AI 추정-실측 오차 이력을 제공한다.

**Architecture:** 기존 `AirKoreaService`·`KmaWeatherService`·`ComparisonService`를 재사용해 수집하고, Flyway `V3` 신규 3테이블에 upsert(멱등)로 저장한다. `@EnableScheduling`을 신규 도입하되 스케줄 메서드는 설정 플래그로 켜고 끈다. 인메모리 캐시(TtlCache)는 실시간 조회용으로 그대로 둔다.

**Tech Stack:** Spring Boot 4.1 / Java 21 / Gradle, PostgreSQL + Flyway, React 19 + Recharts, JUnit5 + Mockito + AssertJ.

**설계 문서:** `docs/superpowers/specs/2026-07-18-public-data-history-accumulation-design.md`

## Global Constraints

- 패키지: 신규 코드는 `com.airvision.backend.publicdata.history` / `...collector` (기존 수직 슬라이스 관례).
- 시각: 전부 `java.time.Instant` + DB `TIMESTAMPTZ`. `LocalDateTime`/`OffsetDateTime` 사용 금지.
- 응답: 컨트롤러는 `ApiResponse<T>` 직접 반환. springdoc `@Tag`/`@Operation` 부여.
- 엔티티: `ObservationSite` 패턴 — protected 기본 생성자, `@PrePersist`로 `collectedAt`, getter만, geom 미사용.
- 보안: 신규 경로는 기존 `/api/**` 규칙에 자동 적용(GET=USER/ADMIN, POST=ADMIN). SecurityConfig 무수정.
- 설정: 기존 `PublicDataProperties`는 **수정하지 않는다**(기존 테스트 4곳 생성자 보호). 수집 설정은 신규 `CollectionProperties`(prefix `airvision.public-data.collection`)로 분리. `@ConfigurationPropertiesScan`이 자동 등록.
- 트랜잭션: 수집기 `collectOnce()`는 `@Transactional`을 붙이지 않는다. 각 리포지토리 upsert(네이티브 `ON CONFLICT`)가 개별 트랜잭션으로 실행되어야 한 건 실패가 다른 건을 오염시키지 않는다.
- 결측 처리: `PollutantValue`가 `valid=false`면 값은 null로 저장(0과 결측 구분은 상위에서 이미 처리됨).
- 테스트 관례: 이 저장소는 DB 통합 테스트(@SpringBootTest/@DataJpaTest)가 없다. 수집기·서비스·컨트롤러는 목킹으로 단위/슬라이스 테스트하고, 네이티브 쿼리·마이그레이션·엔티티는 실기동 + `integration-test.ps1`로 검증한다.

---

### Task 1: V3 마이그레이션 + 엔티티 3종 + CollectionProperties + 설정

**Files:**
- Create: `backend/src/main/resources/db/migration/V3__public_data_history.sql`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/PublicAirMeasurement.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/PublicWeatherObservation.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/ComparisonHistory.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/collector/CollectionProperties.java`
- Modify: `backend/src/main/resources/application.yml` (airvision.public-data.collection 추가)

**Interfaces:**
- Produces: 테이블 `public_air_measurement`(uq: station_name, measured_at), `public_weather_observation`(uq: grid_x, grid_y, base_time), `comparison_history`(uq: site_id, predicted_at, station_name, measured_at). 엔티티는 조회 결과 매핑용. `CollectionProperties` — `enabled()`, `cron()`, `cleanupCron()`, `retentionDays()`, `collectOnStartup()`, `sidos()`, `weatherPoints()`(List<WeatherPoint(sido, latitude, longitude)>).

- [ ] **Step 1: 마이그레이션 SQL 작성**

`V3__public_data_history.sql`:

```sql
-- 공공 데이터 시계열 누적 (설계: docs/superpowers/specs/2026-07-18-public-data-history-accumulation-design.md)
CREATE TABLE public_air_measurement (
    id             BIGSERIAL PRIMARY KEY,
    station_name   VARCHAR(100) NOT NULL,
    sido           VARCHAR(20),
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    measured_at    TIMESTAMPTZ NOT NULL,
    pm10           DOUBLE PRECISION,
    pm25           DOUBLE PRECISION,
    o3             DOUBLE PRECISION,
    no2            DOUBLE PRECISION,
    co             DOUBLE PRECISION,
    so2            DOUBLE PRECISION,
    khai           DOUBLE PRECISION,
    pm10_grade     VARCHAR(10),
    pm25_grade     VARCHAR(10),
    collected_mock BOOLEAN NOT NULL DEFAULT FALSE,
    collected_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_pam_station_time UNIQUE (station_name, measured_at)
);
CREATE INDEX idx_pam_sido_time ON public_air_measurement (sido, measured_at);

CREATE TABLE public_weather_observation (
    id             BIGSERIAL PRIMARY KEY,
    sido           VARCHAR(20),
    grid_x         INT NOT NULL,
    grid_y         INT NOT NULL,
    latitude       DOUBLE PRECISION,
    longitude      DOUBLE PRECISION,
    base_time      TIMESTAMPTZ NOT NULL,
    temperature    DOUBLE PRECISION,
    humidity       DOUBLE PRECISION,
    wind_speed     DOUBLE PRECISION,
    wind_direction_deg DOUBLE PRECISION,
    precipitation_type VARCHAR(20),
    collected_mock BOOLEAN NOT NULL DEFAULT FALSE,
    collected_at   TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_pwo_grid_time UNIQUE (grid_x, grid_y, base_time)
);
CREATE INDEX idx_pwo_sido_time ON public_weather_observation (sido, base_time);

CREATE TABLE comparison_history (
    id                 BIGSERIAL PRIMARY KEY,
    site_id            BIGINT,
    site_name          VARCHAR(100),
    predicted_at       TIMESTAMPTZ NOT NULL,
    predicted_pm25     DOUBLE PRECISION NOT NULL,
    station_name       VARCHAR(100),
    measured_at        TIMESTAMPTZ,
    measured_pm25      DOUBLE PRECISION,
    distance_km        DOUBLE PRECISION,
    time_diff_minutes  BIGINT,
    absolute_error     DOUBLE PRECISION,
    error_rate_percent DOUBLE PRECISION,
    matched            BOOLEAN NOT NULL DEFAULT TRUE,
    computed_at        TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_ch_snapshot UNIQUE (site_id, predicted_at, station_name, measured_at)
);
CREATE INDEX idx_ch_computed ON comparison_history (computed_at);
```

- [ ] **Step 2: 엔티티 `PublicAirMeasurement` 작성**

```java
package com.airvision.backend.publicdata.history;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/** 누적된 AirKorea 실측 1건 (조회 결과 매핑용). upsert는 리포지토리 네이티브 쿼리로 수행한다. */
@Entity
@Table(name = "public_air_measurement")
public class PublicAirMeasurement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "station_name", nullable = false, length = 100)
    private String stationName;

    private String sido;
    private Double latitude;
    private Double longitude;

    @Column(name = "measured_at", nullable = false)
    private Instant measuredAt;

    private Double pm10;
    private Double pm25;
    private Double o3;
    private Double no2;
    private Double co;
    private Double so2;
    private Double khai;

    @Column(name = "pm10_grade", length = 10)
    private String pm10Grade;

    @Column(name = "pm25_grade", length = 10)
    private String pm25Grade;

    @Column(name = "collected_mock", nullable = false)
    private boolean collectedMock;

    @Column(name = "collected_at", nullable = false)
    private Instant collectedAt;

    protected PublicAirMeasurement() {
    }

    @PrePersist
    void onCreate() {
        if (collectedAt == null) {
            collectedAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getStationName() {
        return stationName;
    }

    public String getSido() {
        return sido;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public Instant getMeasuredAt() {
        return measuredAt;
    }

    public Double getPm10() {
        return pm10;
    }

    public Double getPm25() {
        return pm25;
    }

    public Double getO3() {
        return o3;
    }

    public Double getNo2() {
        return no2;
    }

    public Double getCo() {
        return co;
    }

    public Double getSo2() {
        return so2;
    }

    public Double getKhai() {
        return khai;
    }

    public String getPm10Grade() {
        return pm10Grade;
    }

    public String getPm25Grade() {
        return pm25Grade;
    }

    public boolean isCollectedMock() {
        return collectedMock;
    }

    public Instant getCollectedAt() {
        return collectedAt;
    }
}
```

- [ ] **Step 3: 엔티티 `PublicWeatherObservation` 작성**

```java
package com.airvision.backend.publicdata.history;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/** 누적된 기상청 초단기실황 1건. */
@Entity
@Table(name = "public_weather_observation")
public class PublicWeatherObservation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sido;

    @Column(name = "grid_x", nullable = false)
    private int gridX;

    @Column(name = "grid_y", nullable = false)
    private int gridY;

    private Double latitude;
    private Double longitude;

    @Column(name = "base_time", nullable = false)
    private Instant baseTime;

    private Double temperature;
    private Double humidity;

    @Column(name = "wind_speed")
    private Double windSpeed;

    @Column(name = "wind_direction_deg")
    private Double windDirectionDeg;

    @Column(name = "precipitation_type", length = 20)
    private String precipitationType;

    @Column(name = "collected_mock", nullable = false)
    private boolean collectedMock;

    @Column(name = "collected_at", nullable = false)
    private Instant collectedAt;

    protected PublicWeatherObservation() {
    }

    @PrePersist
    void onCreate() {
        if (collectedAt == null) {
            collectedAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public String getSido() {
        return sido;
    }

    public int getGridX() {
        return gridX;
    }

    public int getGridY() {
        return gridY;
    }

    public Double getLatitude() {
        return latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public Instant getBaseTime() {
        return baseTime;
    }

    public Double getTemperature() {
        return temperature;
    }

    public Double getHumidity() {
        return humidity;
    }

    public Double getWindSpeed() {
        return windSpeed;
    }

    public Double getWindDirectionDeg() {
        return windDirectionDeg;
    }

    public String getPrecipitationType() {
        return precipitationType;
    }

    public boolean isCollectedMock() {
        return collectedMock;
    }

    public Instant getCollectedAt() {
        return collectedAt;
    }
}
```

- [ ] **Step 4: 엔티티 `ComparisonHistory` 작성**

```java
package com.airvision.backend.publicdata.history;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.Instant;

/** AI 추정-실측 비교 스냅샷 1건 (matched 결과만 저장). */
@Entity
@Table(name = "comparison_history")
public class ComparisonHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "site_id")
    private Long siteId;

    @Column(name = "site_name", length = 100)
    private String siteName;

    @Column(name = "predicted_at", nullable = false)
    private Instant predictedAt;

    @Column(name = "predicted_pm25", nullable = false)
    private double predictedPm25;

    @Column(name = "station_name", length = 100)
    private String stationName;

    @Column(name = "measured_at")
    private Instant measuredAt;

    @Column(name = "measured_pm25")
    private Double measuredPm25;

    @Column(name = "distance_km")
    private Double distanceKm;

    @Column(name = "time_diff_minutes")
    private Long timeDiffMinutes;

    @Column(name = "absolute_error")
    private Double absoluteError;

    @Column(name = "error_rate_percent")
    private Double errorRatePercent;

    @Column(nullable = false)
    private boolean matched;

    @Column(name = "computed_at", nullable = false)
    private Instant computedAt;

    protected ComparisonHistory() {
    }

    @PrePersist
    void onCreate() {
        if (computedAt == null) {
            computedAt = Instant.now();
        }
    }

    public Long getId() {
        return id;
    }

    public Long getSiteId() {
        return siteId;
    }

    public String getSiteName() {
        return siteName;
    }

    public Instant getPredictedAt() {
        return predictedAt;
    }

    public double getPredictedPm25() {
        return predictedPm25;
    }

    public String getStationName() {
        return stationName;
    }

    public Instant getMeasuredAt() {
        return measuredAt;
    }

    public Double getMeasuredPm25() {
        return measuredPm25;
    }

    public Double getDistanceKm() {
        return distanceKm;
    }

    public Long getTimeDiffMinutes() {
        return timeDiffMinutes;
    }

    public Double getAbsoluteError() {
        return absoluteError;
    }

    public Double getErrorRatePercent() {
        return errorRatePercent;
    }

    public boolean isMatched() {
        return matched;
    }

    public Instant getComputedAt() {
        return computedAt;
    }
}
```

- [ ] **Step 5: `CollectionProperties` 작성**

```java
package com.airvision.backend.publicdata.collector;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** application.yml의 airvision.public-data.collection 바인딩 (수집 스케줄·범위·보존). */
@ConfigurationProperties(prefix = "airvision.public-data.collection")
public record CollectionProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("0 10 * * * *") String cron,
        @DefaultValue("0 30 3 * * *") String cleanupCron,
        @DefaultValue("180") int retentionDays,
        @DefaultValue("true") boolean collectOnStartup,
        @DefaultValue({"서울", "인천", "경기"}) List<String> sidos,
        @DefaultValue List<WeatherPoint> weatherPoints
) {

    public record WeatherPoint(String sido, double latitude, double longitude) {
    }
}
```

- [ ] **Step 6: `application.yml`에 수집 설정 추가**

`airvision.public-data:` 블록 안(mock-enabled/cache/comparison와 형제 레벨)에 추가:

```yaml
    collection:
      enabled: ${PUBLIC_DATA_COLLECTION_ENABLED:true}
      cron: "0 10 * * * *"
      cleanup-cron: "0 30 3 * * *"
      retention-days: ${PUBLIC_DATA_RETENTION_DAYS:180}
      collect-on-startup: ${PUBLIC_DATA_COLLECT_ON_STARTUP:true}
      sidos: [서울, 인천, 경기]
      weather-points:
        - { sido: 서울, latitude: 37.5665, longitude: 126.9780 }
        - { sido: 인천, latitude: 37.4563, longitude: 126.7052 }
        - { sido: 경기, latitude: 37.2636, longitude: 127.0286 }
```

- [ ] **Step 7: 컴파일 확인 (엔티티/설정은 실기동 검증은 Task 7에서)**

Run: `cd backend; .\gradlew.bat compileJava --console=plain`
Expected: BUILD SUCCESSFUL

- [ ] **Step 8: 커밋**

```bash
git add backend/src/main/resources/db/migration/V3__public_data_history.sql \
        backend/src/main/java/com/airvision/backend/publicdata/history/PublicAirMeasurement.java \
        backend/src/main/java/com/airvision/backend/publicdata/history/PublicWeatherObservation.java \
        backend/src/main/java/com/airvision/backend/publicdata/history/ComparisonHistory.java \
        backend/src/main/java/com/airvision/backend/publicdata/collector/CollectionProperties.java \
        backend/src/main/resources/application.yml
git commit -m "축적 1: V3 마이그레이션·엔티티·수집 설정"
```

---

### Task 2: 리포지토리 3종 (upsert + 조회 쿼리)

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/PublicAirMeasurementRepository.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/PublicWeatherObservationRepository.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/ComparisonHistoryRepository.java`

**Interfaces:**
- Consumes: 엔티티 3종(Task 1).
- Produces:
  - `PublicAirMeasurementRepository.upsert(stationName, sido, latitude, longitude, measuredAt, pm10, pm25, o3, no2, co, so2, khai, pm10Grade, pm25Grade, mock, collectedAt)` → int
  - `findHourlyAvg(sido, from, to)` → `List<HourlyAvg>`(projection: `Instant getHour()`, `Double getAvgPm10()`, `Double getAvgPm25()`, `Long getCnt()`)
  - `findByStationNameAndMeasuredAtBetweenOrderByMeasuredAt(stationName, from, to)` → `List<PublicAirMeasurement>`
  - `deleteByMeasuredAtBefore(cutoff)` → void, `findFirstByOrderByCollectedAtAsc()` → `Optional<PublicAirMeasurement>`, `count()`(상속)
  - `PublicWeatherObservationRepository.upsert(sido, gridX, gridY, latitude, longitude, baseTime, temperature, humidity, windSpeed, windDirectionDeg, precipitationType, mock, collectedAt)` → int; `findBySidoAndBaseTimeBetweenOrderByBaseTime(sido, from, to)`; `deleteByBaseTimeBefore(cutoff)`
  - `ComparisonHistoryRepository.insertSnapshot(siteId, siteName, predictedAt, predictedPm25, stationName, measuredAt, measuredPm25, distanceKm, timeDiffMinutes, absoluteError, errorRatePercent, computedAt)` → int; `findByComputedAtBetweenOrderByComputedAt(from, to)` → `List<ComparisonHistory>`

- [ ] **Step 1: `PublicAirMeasurementRepository` 작성**

```java
package com.airvision.backend.publicdata.history;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PublicAirMeasurementRepository extends JpaRepository<PublicAirMeasurement, Long> {

    /** 시간별 평균 (차트용). sido가 null이면 전체. */
    interface HourlyAvg {
        Instant getHour();

        Double getAvgPm10();

        Double getAvgPm25();

        Long getCnt();
    }

    @Modifying
    @Query(value = """
            INSERT INTO public_air_measurement
              (station_name, sido, latitude, longitude, measured_at,
               pm10, pm25, o3, no2, co, so2, khai, pm10_grade, pm25_grade,
               collected_mock, collected_at)
            VALUES (:stationName, :sido, :latitude, :longitude, :measuredAt,
               :pm10, :pm25, :o3, :no2, :co, :so2, :khai, :pm10Grade, :pm25Grade,
               :mock, :collectedAt)
            ON CONFLICT (station_name, measured_at) DO UPDATE SET
               pm10 = EXCLUDED.pm10, pm25 = EXCLUDED.pm25, o3 = EXCLUDED.o3,
               no2 = EXCLUDED.no2, co = EXCLUDED.co, so2 = EXCLUDED.so2,
               khai = EXCLUDED.khai, pm10_grade = EXCLUDED.pm10_grade,
               pm25_grade = EXCLUDED.pm25_grade, collected_mock = EXCLUDED.collected_mock,
               collected_at = EXCLUDED.collected_at
            """, nativeQuery = true)
    int upsert(@Param("stationName") String stationName, @Param("sido") String sido,
               @Param("latitude") Double latitude, @Param("longitude") Double longitude,
               @Param("measuredAt") Instant measuredAt,
               @Param("pm10") Double pm10, @Param("pm25") Double pm25, @Param("o3") Double o3,
               @Param("no2") Double no2, @Param("co") Double co, @Param("so2") Double so2,
               @Param("khai") Double khai, @Param("pm10Grade") String pm10Grade,
               @Param("pm25Grade") String pm25Grade, @Param("mock") boolean mock,
               @Param("collectedAt") Instant collectedAt);

    @Query(value = """
            SELECT date_trunc('hour', measured_at) AS hour,
                   AVG(pm10) AS avgPm10, AVG(pm25) AS avgPm25, COUNT(*) AS cnt
            FROM public_air_measurement
            WHERE measured_at BETWEEN :from AND :to
              AND (:sido IS NULL OR sido = :sido)
            GROUP BY 1 ORDER BY 1
            """, nativeQuery = true)
    List<HourlyAvg> findHourlyAvg(@Param("sido") String sido,
                                  @Param("from") Instant from, @Param("to") Instant to);

    List<PublicAirMeasurement> findByStationNameAndMeasuredAtBetweenOrderByMeasuredAt(
            String stationName, Instant from, Instant to);

    @Modifying
    void deleteByMeasuredAtBefore(Instant cutoff);

    Optional<PublicAirMeasurement> findFirstByOrderByCollectedAtAsc();
}
```

- [ ] **Step 2: `PublicWeatherObservationRepository` 작성**

```java
package com.airvision.backend.publicdata.history;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PublicWeatherObservationRepository
        extends JpaRepository<PublicWeatherObservation, Long> {

    @Modifying
    @Query(value = """
            INSERT INTO public_weather_observation
              (sido, grid_x, grid_y, latitude, longitude, base_time,
               temperature, humidity, wind_speed, wind_direction_deg,
               precipitation_type, collected_mock, collected_at)
            VALUES (:sido, :gridX, :gridY, :latitude, :longitude, :baseTime,
               :temperature, :humidity, :windSpeed, :windDirectionDeg,
               :precipitationType, :mock, :collectedAt)
            ON CONFLICT (grid_x, grid_y, base_time) DO UPDATE SET
               temperature = EXCLUDED.temperature, humidity = EXCLUDED.humidity,
               wind_speed = EXCLUDED.wind_speed, wind_direction_deg = EXCLUDED.wind_direction_deg,
               precipitation_type = EXCLUDED.precipitation_type,
               collected_mock = EXCLUDED.collected_mock, collected_at = EXCLUDED.collected_at
            """, nativeQuery = true)
    int upsert(@Param("sido") String sido, @Param("gridX") int gridX, @Param("gridY") int gridY,
               @Param("latitude") Double latitude, @Param("longitude") Double longitude,
               @Param("baseTime") Instant baseTime, @Param("temperature") Double temperature,
               @Param("humidity") Double humidity, @Param("windSpeed") Double windSpeed,
               @Param("windDirectionDeg") Double windDirectionDeg,
               @Param("precipitationType") String precipitationType,
               @Param("mock") boolean mock, @Param("collectedAt") Instant collectedAt);

    List<PublicWeatherObservation> findBySidoAndBaseTimeBetweenOrderByBaseTime(
            String sido, Instant from, Instant to);

    @Modifying
    void deleteByBaseTimeBefore(Instant cutoff);
}
```

- [ ] **Step 3: `ComparisonHistoryRepository` 작성**

```java
package com.airvision.backend.publicdata.history;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ComparisonHistoryRepository extends JpaRepository<ComparisonHistory, Long> {

    @Modifying
    @Query(value = """
            INSERT INTO comparison_history
              (site_id, site_name, predicted_at, predicted_pm25, station_name,
               measured_at, measured_pm25, distance_km, time_diff_minutes,
               absolute_error, error_rate_percent, matched, computed_at)
            VALUES (:siteId, :siteName, :predictedAt, :predictedPm25, :stationName,
               :measuredAt, :measuredPm25, :distanceKm, :timeDiffMinutes,
               :absoluteError, :errorRatePercent, TRUE, :computedAt)
            ON CONFLICT (site_id, predicted_at, station_name, measured_at) DO NOTHING
            """, nativeQuery = true)
    int insertSnapshot(@Param("siteId") Long siteId, @Param("siteName") String siteName,
                       @Param("predictedAt") Instant predictedAt,
                       @Param("predictedPm25") double predictedPm25,
                       @Param("stationName") String stationName,
                       @Param("measuredAt") Instant measuredAt,
                       @Param("measuredPm25") Double measuredPm25,
                       @Param("distanceKm") Double distanceKm,
                       @Param("timeDiffMinutes") Long timeDiffMinutes,
                       @Param("absoluteError") Double absoluteError,
                       @Param("errorRatePercent") Double errorRatePercent,
                       @Param("computedAt") Instant computedAt);

    List<ComparisonHistory> findByComputedAtBetweenOrderByComputedAt(Instant from, Instant to);
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `cd backend; .\gradlew.bat compileJava --console=plain`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/history/PublicAirMeasurementRepository.java \
        backend/src/main/java/com/airvision/backend/publicdata/history/PublicWeatherObservationRepository.java \
        backend/src/main/java/com/airvision/backend/publicdata/history/ComparisonHistoryRepository.java
git commit -m "축적 2: 리포지토리 3종 (네이티브 upsert + 조회)"
```

---

### Task 3: PublicDataHistoryService + DTO (TDD)

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/dto/MeasurementHourlyPoint.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/dto/MeasurementSeriesPoint.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/dto/WeatherSeriesPoint.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/dto/ComparisonHistoryPoint.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/PublicDataHistoryService.java`
- Test: `backend/src/test/java/com/airvision/backend/publicdata/history/PublicDataHistoryServiceTest.java`

**Interfaces:**
- Consumes: 리포지토리 3종(Task 2), `HourlyAvg` projection.
- Produces:
  - `PublicDataHistoryService.hourly(sido, from, to)` → `List<MeasurementHourlyPoint>`
  - `stationSeries(stationName, from, to)` → `List<MeasurementSeriesPoint>`
  - `weatherSeries(sido, from, to)` → `List<WeatherSeriesPoint>`
  - `comparisonHistory(from, to)` → `List<ComparisonHistoryPoint>`
  - `accumulatedCount()` → long, `earliestCollectedAt()` → `Instant`(nullable)
  - 기간 미지정(null) 시 기본 최근 48시간, `from >= to`면 `IllegalArgumentException`.

- [ ] **Step 1: 실패 테스트 작성**

`PublicDataHistoryServiceTest.java`:

```java
package com.airvision.backend.publicdata.history;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.history.PublicAirMeasurementRepository.HourlyAvg;
import com.airvision.backend.publicdata.history.dto.ComparisonHistoryPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementHourlyPoint;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PublicDataHistoryServiceTest {

    private static final Instant NOW = Instant.parse("2026-07-18T05:00:00Z");

    private PublicAirMeasurementRepository measurementRepo;
    private PublicWeatherObservationRepository weatherRepo;
    private ComparisonHistoryRepository comparisonRepo;
    private PublicDataHistoryService service;

    private static HourlyAvg hourly(Instant hour, double pm10, double pm25, long cnt) {
        return new HourlyAvg() {
            public Instant getHour() {
                return hour;
            }

            public Double getAvgPm10() {
                return pm10;
            }

            public Double getAvgPm25() {
                return pm25;
            }

            public Long getCnt() {
                return cnt;
            }
        };
    }

    @BeforeEach
    void setUp() {
        measurementRepo = mock(PublicAirMeasurementRepository.class);
        weatherRepo = mock(PublicWeatherObservationRepository.class);
        comparisonRepo = mock(ComparisonHistoryRepository.class);
        service = new PublicDataHistoryService(measurementRepo, weatherRepo, comparisonRepo,
                Clock.fixed(NOW, ZoneId.of("UTC")));
    }

    @Test
    void 시간별_평균_projection을_DTO로_매핑한다() {
        when(measurementRepo.findHourlyAvg(eq("인천"), any(), any())).thenReturn(List.of(
                hourly(Instant.parse("2026-07-18T04:00:00Z"), 40.0, 22.5, 8)));

        List<MeasurementHourlyPoint> points = service.hourly("인천",
                Instant.parse("2026-07-18T00:00:00Z"), NOW);

        assertThat(points).hasSize(1);
        assertThat(points.get(0).avgPm25()).isEqualTo(22.5);
        assertThat(points.get(0).count()).isEqualTo(8);
    }

    @Test
    void 기간_미지정이면_최근_48시간을_기본으로_쓴다() {
        when(measurementRepo.findHourlyAvg(isNull(), any(), any())).thenReturn(List.of());

        service.hourly(null, null, null);

        // from = NOW - 48h, to = NOW 로 리포지토리를 호출한다
        org.mockito.ArgumentCaptor<Instant> fromCap =
                org.mockito.ArgumentCaptor.forClass(Instant.class);
        org.mockito.Mockito.verify(measurementRepo)
                .findHourlyAvg(isNull(), fromCap.capture(), eq(NOW));
        assertThat(fromCap.getValue()).isEqualTo(NOW.minusSeconds(48 * 3600));
    }

    @Test
    void from이_to보다_같거나_크면_예외다() {
        assertThatThrownBy(() -> service.hourly(null, NOW, NOW.minusSeconds(3600)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void 비교_이력_엔티티를_DTO로_매핑한다() {
        ComparisonHistory h = mock(ComparisonHistory.class);
        when(h.getComputedAt()).thenReturn(NOW);
        when(h.getSiteName()).thenReturn("인천송도");
        when(h.getPredictedAt()).thenReturn(NOW.minusSeconds(600));
        when(h.getPredictedPm25()).thenReturn(30.0);
        when(h.getStationName()).thenReturn("송도");
        when(h.getMeasuredPm25()).thenReturn(25.0);
        when(h.getAbsoluteError()).thenReturn(5.0);
        when(h.getErrorRatePercent()).thenReturn(20.0);
        when(comparisonRepo.findByComputedAtBetweenOrderByComputedAt(any(), any()))
                .thenReturn(List.of(h));

        List<ComparisonHistoryPoint> points = service.comparisonHistory(null, null);

        assertThat(points).hasSize(1);
        assertThat(points.get(0).siteName()).isEqualTo("인천송도");
        assertThat(points.get(0).absoluteError()).isEqualTo(5.0);
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend; .\gradlew.bat test --tests "*PublicDataHistoryServiceTest" --console=plain`
Expected: 컴파일 실패(DTO·서비스 미존재)

- [ ] **Step 3: DTO 4종 작성**

`MeasurementHourlyPoint.java`:
```java
package com.airvision.backend.publicdata.history.dto;

import java.time.Instant;

public record MeasurementHourlyPoint(Instant hour, Double avgPm10, Double avgPm25, long count) {
}
```

`MeasurementSeriesPoint.java`:
```java
package com.airvision.backend.publicdata.history.dto;

import com.airvision.backend.publicdata.history.PublicAirMeasurement;
import java.time.Instant;

public record MeasurementSeriesPoint(Instant measuredAt, Double pm10, Double pm25,
                                     String pm25Grade) {

    public static MeasurementSeriesPoint from(PublicAirMeasurement m) {
        return new MeasurementSeriesPoint(m.getMeasuredAt(), m.getPm10(), m.getPm25(),
                m.getPm25Grade());
    }
}
```

`WeatherSeriesPoint.java`:
```java
package com.airvision.backend.publicdata.history.dto;

import com.airvision.backend.publicdata.history.PublicWeatherObservation;
import java.time.Instant;

public record WeatherSeriesPoint(Instant baseTime, Double temperature, Double humidity,
                                 Double windSpeed, Double windDirectionDeg,
                                 String precipitationType) {

    public static WeatherSeriesPoint from(PublicWeatherObservation w) {
        return new WeatherSeriesPoint(w.getBaseTime(), w.getTemperature(), w.getHumidity(),
                w.getWindSpeed(), w.getWindDirectionDeg(), w.getPrecipitationType());
    }
}
```

`ComparisonHistoryPoint.java`:
```java
package com.airvision.backend.publicdata.history.dto;

import com.airvision.backend.publicdata.history.ComparisonHistory;
import java.time.Instant;

public record ComparisonHistoryPoint(Instant computedAt, String siteName, Instant predictedAt,
                                     double predictedPm25, String stationName,
                                     Double measuredPm25, Double absoluteError,
                                     Double errorRatePercent) {

    public static ComparisonHistoryPoint from(ComparisonHistory h) {
        return new ComparisonHistoryPoint(h.getComputedAt(), h.getSiteName(), h.getPredictedAt(),
                h.getPredictedPm25(), h.getStationName(), h.getMeasuredPm25(),
                h.getAbsoluteError(), h.getErrorRatePercent());
    }
}
```

- [ ] **Step 4: `PublicDataHistoryService` 작성**

```java
package com.airvision.backend.publicdata.history;

import com.airvision.backend.publicdata.history.dto.ComparisonHistoryPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementHourlyPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementSeriesPoint;
import com.airvision.backend.publicdata.history.dto.WeatherSeriesPoint;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 누적된 공공 데이터 시계열 조회. */
@Service
@Transactional(readOnly = true)
public class PublicDataHistoryService {

    private static final Duration DEFAULT_WINDOW = Duration.ofHours(48);
    private static final Duration MAX_WINDOW = Duration.ofDays(31);

    private final PublicAirMeasurementRepository measurementRepo;
    private final PublicWeatherObservationRepository weatherRepo;
    private final ComparisonHistoryRepository comparisonRepo;
    private final Clock clock;

    // Spring에는 Clock 빈이 없으므로 @Autowired 생성자는 Clock 없이 위임한다
    // (기존 AirKoreaService/KmaWeatherService와 동일 패턴). Clock 생성자는 테스트용.
    @org.springframework.beans.factory.annotation.Autowired
    public PublicDataHistoryService(PublicAirMeasurementRepository measurementRepo,
                                    PublicWeatherObservationRepository weatherRepo,
                                    ComparisonHistoryRepository comparisonRepo) {
        this(measurementRepo, weatherRepo, comparisonRepo, Clock.systemUTC());
    }

    PublicDataHistoryService(PublicAirMeasurementRepository measurementRepo,
                             PublicWeatherObservationRepository weatherRepo,
                             ComparisonHistoryRepository comparisonRepo, Clock clock) {
        this.measurementRepo = measurementRepo;
        this.weatherRepo = weatherRepo;
        this.comparisonRepo = comparisonRepo;
        this.clock = clock;
    }

    public List<MeasurementHourlyPoint> hourly(String sido, Instant from, Instant to) {
        Instant[] range = range(from, to);
        return measurementRepo.findHourlyAvg(blankToNull(sido), range[0], range[1]).stream()
                .map(h -> new MeasurementHourlyPoint(h.getHour(), h.getAvgPm10(),
                        h.getAvgPm25(), h.getCnt() == null ? 0 : h.getCnt()))
                .toList();
    }

    public List<MeasurementSeriesPoint> stationSeries(String stationName, Instant from, Instant to) {
        Instant[] range = range(from, to);
        return measurementRepo.findByStationNameAndMeasuredAtBetweenOrderByMeasuredAt(
                        stationName, range[0], range[1]).stream()
                .map(MeasurementSeriesPoint::from)
                .toList();
    }

    public List<WeatherSeriesPoint> weatherSeries(String sido, Instant from, Instant to) {
        Instant[] range = range(from, to);
        return weatherRepo.findBySidoAndBaseTimeBetweenOrderByBaseTime(sido, range[0], range[1])
                .stream()
                .map(WeatherSeriesPoint::from)
                .toList();
    }

    public List<ComparisonHistoryPoint> comparisonHistory(Instant from, Instant to) {
        Instant[] range = range(from, to);
        return comparisonRepo.findByComputedAtBetweenOrderByComputedAt(range[0], range[1]).stream()
                .map(ComparisonHistoryPoint::from)
                .toList();
    }

    public long accumulatedCount() {
        return measurementRepo.count();
    }

    public Instant earliestCollectedAt() {
        return measurementRepo.findFirstByOrderByCollectedAtAsc()
                .map(PublicAirMeasurement::getCollectedAt)
                .orElse(null);
    }

    /** null 기본(최근 48h) + 검증. */
    private Instant[] range(Instant from, Instant to) {
        Instant end = to != null ? to : clock.instant();
        Instant start = from != null ? from : end.minus(DEFAULT_WINDOW);
        if (!start.isBefore(end)) {
            throw new IllegalArgumentException("from은 to보다 앞서야 합니다");
        }
        if (Duration.between(start, end).compareTo(MAX_WINDOW) > 0) {
            throw new IllegalArgumentException("조회 기간은 최대 31일입니다");
        }
        return new Instant[]{start, end};
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend; .\gradlew.bat test --tests "*PublicDataHistoryServiceTest" --console=plain`
Expected: BUILD SUCCESSFUL (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/history/dto/ \
        backend/src/main/java/com/airvision/backend/publicdata/history/PublicDataHistoryService.java \
        backend/src/test/java/com/airvision/backend/publicdata/history/PublicDataHistoryServiceTest.java
git commit -m "축적 3: 이력 조회 서비스 + DTO (TDD)"
```

---

### Task 4: PublicDataCollector + SchedulingConfig + CollectionResult (TDD)

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/publicdata/collector/dto/CollectionResult.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/collector/SchedulingConfig.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/collector/PublicDataCollector.java`
- Test: `backend/src/test/java/com/airvision/backend/publicdata/collector/PublicDataCollectorTest.java`

**Interfaces:**
- Consumes: `AirKoreaService.current(sido)`→`CurrentAirQualityResponse`(`.stations()`→`List<StationAirQuality>`), `AirKoreaService.isMock()`; `KmaWeatherService.current(lat,lon)`→`WeatherNowResponse`; `ComparisonService.latest()`→`ComparisonResponse`(`.rows()`→`List<ComparisonRow>`); 리포지토리 3종(Task 2); `CollectionProperties`(Task 1).
- Produces: `PublicDataCollector.collectOnce()`→`CollectionResult(int measurementsUpserted, int weatherUpserted, int comparisonSnapshots, boolean mock, Instant collectedAt)`; `collectHourly()`, `cleanup()`, `onStartup()`. 패키지-프라이빗 생성자는 `Clock` 주입 가능.

- [ ] **Step 1: 실패 테스트 작성**

`PublicDataCollectorTest.java`:

```java
package com.airvision.backend.publicdata.collector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.collector.dto.CollectionResult;
import com.airvision.backend.publicdata.comparison.ComparisonService;
import com.airvision.backend.publicdata.comparison.dto.ComparisonResponse;
import com.airvision.backend.publicdata.comparison.dto.ComparisonRow;
import com.airvision.backend.publicdata.history.ComparisonHistoryRepository;
import com.airvision.backend.publicdata.history.PublicAirMeasurementRepository;
import com.airvision.backend.publicdata.history.PublicWeatherObservationRepository;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import com.airvision.backend.publicdata.kma.dto.WeatherNowResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PublicDataCollectorTest {

    private static final Instant NOW = Instant.parse("2026-07-18T05:10:00Z");

    private AirKoreaService airKoreaService;
    private KmaWeatherService weatherService;
    private ComparisonService comparisonService;
    private PublicAirMeasurementRepository measurementRepo;
    private PublicWeatherObservationRepository weatherRepo;
    private ComparisonHistoryRepository comparisonRepo;
    private PublicDataCollector collector;

    private static PollutantValue pv(Double value, String grade, boolean valid) {
        return new PollutantValue(value, "µg/m³", grade, valid,
                valid ? "NORMAL" : "NO_DATA");
    }

    private static StationAirQuality station(String name, Instant measuredAt, Double pm25) {
        PollutantValue v = pv(pm25, "보통", pm25 != null);
        return new StationAirQuality(name, "인천", 37.4, 126.7, true, measuredAt,
                pv(40.0, "보통", true), v, v, v, v, v, v);
    }

    private static CollectionProperties props(boolean enabled) {
        return new CollectionProperties(enabled, "0 10 * * * *", "0 30 3 * * *", 180, false,
                List.of("서울", "인천"),
                List.of(new CollectionProperties.WeatherPoint("인천", 37.4563, 126.7052)));
    }

    private static WeatherNowResponse weather() {
        return new WeatherNowResponse(37.4563, 126.7052, 55, 124,
                Instant.parse("2026-07-18T05:00:00Z"), "KMA", true, false,
                27.0, 60.0, 0.0, "없음", 2.4, 315.0, "북서풍", 135.0);
    }

    private void bootstrap(boolean enabled) {
        collector = new PublicDataCollector(airKoreaService, weatherService, comparisonService,
                measurementRepo, weatherRepo, comparisonRepo, props(enabled),
                Clock.fixed(NOW, ZoneId.of("UTC")));
    }

    @BeforeEach
    void setUp() {
        airKoreaService = mock(AirKoreaService.class);
        weatherService = mock(KmaWeatherService.class);
        comparisonService = mock(ComparisonService.class);
        measurementRepo = mock(PublicAirMeasurementRepository.class);
        weatherRepo = mock(PublicWeatherObservationRepository.class);
        comparisonRepo = mock(ComparisonHistoryRepository.class);
        when(airKoreaService.isMock()).thenReturn(true);
        when(weatherService.current(anyDouble(), anyDouble())).thenReturn(weather());
        when(comparisonService.latest()).thenReturn(
                new ComparisonResponse(5, 60, "인천", true, List.of()));
    }

    @Test
    void 시도별_측정소를_수집하고_measuredAt이_null이면_건너뛴다() {
        bootstrap(true);
        when(airKoreaService.current("서울")).thenReturn(new CurrentAirQualityResponse(
                "서울", "AIRKOREA", true, false, NOW, null,
                List.of(station("서울역", Instant.parse("2026-07-18T05:00:00Z"), 20.0),
                        station("빈측정소", null, 30.0))));  // measuredAt null → 건너뜀
        when(airKoreaService.current("인천")).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null,
                List.of(station("송도", Instant.parse("2026-07-18T05:00:00Z"), 12.0))));

        CollectionResult result = collector.collectOnce();

        assertThat(result.measurementsUpserted()).isEqualTo(2);  // 서울역 + 송도 (빈측정소 제외)
        assertThat(result.weatherUpserted()).isEqualTo(1);
        assertThat(result.mock()).isTrue();
        verify(measurementRepo, times(2)).upsert(any(), any(), any(), any(), any(),
                any(), any(), any(), any(), any(), any(), any(), any(), any(),
                anyBoolean(), any());
    }

    @Test
    void 한_시도_수집이_실패해도_다른_시도는_계속한다() {
        bootstrap(true);
        when(airKoreaService.current("서울")).thenThrow(new RuntimeException("API 오류"));
        when(airKoreaService.current("인천")).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null,
                List.of(station("송도", Instant.parse("2026-07-18T05:00:00Z"), 12.0))));

        CollectionResult result = collector.collectOnce();

        assertThat(result.measurementsUpserted()).isEqualTo(1);  // 인천만 성공
        assertThat(result.weatherUpserted()).isEqualTo(1);       // 기상은 영향 없음
    }

    @Test
    void 매칭된_비교_행만_스냅샷으로_저장한다() {
        bootstrap(true);
        when(airKoreaService.current(any())).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null, List.of()));
        ComparisonRow matched = new ComparisonRow(1L, "인천송도",
                Instant.parse("2026-07-18T05:00:00Z"), 30.0, "송도",
                Instant.parse("2026-07-18T05:00:00Z"), 25.0, 1.2, 0L, 5.0, 20.0, true, null);
        ComparisonRow unmatched = new ComparisonRow(2L, "먼지점",
                Instant.parse("2026-07-18T05:00:00Z"), 40.0, null, null, null, null, null,
                null, null, false, "허용 거리 초과");
        when(comparisonService.latest()).thenReturn(
                new ComparisonResponse(5, 60, "인천", true, List.of(matched, unmatched)));

        CollectionResult result = collector.collectOnce();

        assertThat(result.comparisonSnapshots()).isEqualTo(1);
        verify(comparisonRepo, times(1)).insertSnapshot(eq(1L), any(), any(), eq(30.0),
                any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void enabled가_false면_아무것도_하지_않는다() {
        bootstrap(false);

        collector.collectHourly();

        verifyNoInteractions(airKoreaService, weatherService, comparisonService,
                measurementRepo, weatherRepo, comparisonRepo);
    }

    @Test
    void 실측_유효하지_않으면_null로_저장한다() {
        bootstrap(true);
        when(airKoreaService.current("서울")).thenReturn(new CurrentAirQualityResponse(
                "서울", "AIRKOREA", true, false, NOW, null,
                List.of(station("점검소", Instant.parse("2026-07-18T05:00:00Z"), null))));
        when(airKoreaService.current("인천")).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, NOW, null, List.of()));

        collector.collectOnce();

        // pm25 파라미터(7번째)가 null로 전달됨
        verify(measurementRepo).upsert(eq("점검소"), any(), any(), any(), any(),
                any(), org.mockito.ArgumentMatchers.isNull(), any(), any(), any(), any(),
                any(), any(), any(), anyBoolean(), any());
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend; .\gradlew.bat test --tests "*PublicDataCollectorTest" --console=plain`
Expected: 컴파일 실패(CollectionResult·PublicDataCollector 미존재)

- [ ] **Step 3: `CollectionResult` 작성**

```java
package com.airvision.backend.publicdata.collector.dto;

import java.time.Instant;

/** 1회 수집 결과 요약. */
public record CollectionResult(int measurementsUpserted, int weatherUpserted,
                               int comparisonSnapshots, boolean mock, Instant collectedAt) {
}
```

- [ ] **Step 4: `SchedulingConfig` 작성**

```java
package com.airvision.backend.publicdata.collector;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 공공 데이터 수집 스케줄러 활성화 (신규 인프라). */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
```

- [ ] **Step 5: `PublicDataCollector` 작성**

```java
package com.airvision.backend.publicdata.collector;

import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.collector.dto.CollectionResult;
import com.airvision.backend.publicdata.comparison.ComparisonService;
import com.airvision.backend.publicdata.comparison.dto.ComparisonRow;
import com.airvision.backend.publicdata.history.ComparisonHistoryRepository;
import com.airvision.backend.publicdata.history.PublicAirMeasurementRepository;
import com.airvision.backend.publicdata.history.PublicWeatherObservationRepository;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import com.airvision.backend.publicdata.kma.dto.WeatherNowResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 공공 데이터를 매시간 수집해 DB에 누적한다.
 * 각 단위는 개별 try/catch로 격리되며(한 건 실패가 전체를 막지 않음),
 * 리포지토리 upsert가 ON CONFLICT로 멱등이므로 재수집·중복이 안전하다.
 * collectOnce()에 @Transactional을 붙이지 않아 각 upsert가 개별 트랜잭션으로 커밋된다.
 */
@Component
public class PublicDataCollector {

    private static final Logger log = LoggerFactory.getLogger(PublicDataCollector.class);

    private final AirKoreaService airKoreaService;
    private final KmaWeatherService weatherService;
    private final ComparisonService comparisonService;
    private final PublicAirMeasurementRepository measurementRepo;
    private final PublicWeatherObservationRepository weatherRepo;
    private final ComparisonHistoryRepository comparisonRepo;
    private final CollectionProperties props;
    private final Clock clock;

    public PublicDataCollector(AirKoreaService airKoreaService, KmaWeatherService weatherService,
                               ComparisonService comparisonService,
                               PublicAirMeasurementRepository measurementRepo,
                               PublicWeatherObservationRepository weatherRepo,
                               ComparisonHistoryRepository comparisonRepo,
                               CollectionProperties props, Clock clock) {
        this.airKoreaService = airKoreaService;
        this.weatherService = weatherService;
        this.comparisonService = comparisonService;
        this.measurementRepo = measurementRepo;
        this.weatherRepo = weatherRepo;
        this.comparisonRepo = comparisonRepo;
        this.props = props;
        this.clock = clock;
    }

    @org.springframework.beans.factory.annotation.Autowired
    public PublicDataCollector(AirKoreaService airKoreaService, KmaWeatherService weatherService,
                               ComparisonService comparisonService,
                               PublicAirMeasurementRepository measurementRepo,
                               PublicWeatherObservationRepository weatherRepo,
                               ComparisonHistoryRepository comparisonRepo,
                               CollectionProperties props) {
        this(airKoreaService, weatherService, comparisonService, measurementRepo, weatherRepo,
                comparisonRepo, props, Clock.systemUTC());
    }

    @Scheduled(cron = "${airvision.public-data.collection.cron:0 10 * * * *}")
    public void collectHourly() {
        if (!props.enabled()) {
            return;
        }
        collectOnce();
    }

    @Scheduled(cron = "${airvision.public-data.collection.cleanup-cron:0 30 3 * * *}")
    public void cleanup() {
        if (!props.enabled()) {
            return;
        }
        Instant cutoff = clock.instant().minus(Duration.ofDays(props.retentionDays()));
        measurementRepo.deleteByMeasuredAtBefore(cutoff);
        weatherRepo.deleteByBaseTimeBefore(cutoff);
        log.info("공공 데이터 정리: {} 이전 삭제", cutoff);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onStartup() {
        if (props.enabled() && props.collectOnStartup()) {
            try {
                collectOnce();
            } catch (RuntimeException e) {
                log.warn("기동 수집 실패: {}", e.getMessage());
            }
        }
    }

    public CollectionResult collectOnce() {
        Instant now = clock.instant();
        boolean mock = airKoreaService.isMock();
        int measurements = 0;
        int weather = 0;
        int comparisons = 0;

        for (String sido : props.sidos()) {
            try {
                for (StationAirQuality s : airKoreaService.current(sido).stations()) {
                    if (s.measuredAt() == null) {
                        continue;
                    }
                    measurementRepo.upsert(s.stationName(), s.sidoName(),
                            s.latitude(), s.longitude(), s.measuredAt(),
                            val(s.pm10()), val(s.pm25()), val(s.o3()), val(s.no2()),
                            val(s.co()), val(s.so2()), val(s.khai()),
                            grade(s.pm10()), grade(s.pm25()), mock, now);
                    measurements++;
                }
            } catch (RuntimeException e) {
                log.warn("측정 수집 실패 ({}): {}", sido, e.getMessage());
            }
        }

        for (CollectionProperties.WeatherPoint p : props.weatherPoints()) {
            try {
                WeatherNowResponse w = weatherService.current(p.latitude(), p.longitude());
                if (w.baseTime() != null) {
                    weatherRepo.upsert(p.sido(), w.gridX(), w.gridY(),
                            w.latitude(), w.longitude(), w.baseTime(),
                            w.temperature(), w.humidity(), w.windSpeed(),
                            w.windDirectionDegree(), w.precipitationType(), w.mock(), now);
                    weather++;
                }
            } catch (RuntimeException e) {
                log.warn("기상 수집 실패 ({}): {}", p.sido(), e.getMessage());
            }
        }

        try {
            for (ComparisonRow row : comparisonService.latest().rows()) {
                if (!row.matched()) {
                    continue;
                }
                comparisonRepo.insertSnapshot(row.siteId(), row.siteName(), row.predictedAt(),
                        row.predictedPm25(), row.stationName(), row.measuredAt(),
                        row.measuredPm25(), row.distanceKm(), row.timeDiffMinutes(),
                        row.absoluteError(), row.errorRatePercent(), now);
                comparisons++;
            }
        } catch (RuntimeException e) {
            log.warn("비교 스냅샷 실패: {}", e.getMessage());
        }

        log.info("공공 데이터 수집: 측정 {}, 기상 {}, 비교 {} (mock={})",
                measurements, weather, comparisons, mock);
        return new CollectionResult(measurements, weather, comparisons, mock, now);
    }

    /** 유효한 측정값만 숫자로, 그 외(결측·장애)는 null. */
    private static Double val(PollutantValue v) {
        return v != null && v.valid() ? v.value() : null;
    }

    private static String grade(PollutantValue v) {
        return v == null ? null : v.grade();
    }
}
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd backend; .\gradlew.bat test --tests "*PublicDataCollectorTest" --console=plain`
Expected: BUILD SUCCESSFUL (5 tests)

- [ ] **Step 7: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/collector/
git add backend/src/test/java/com/airvision/backend/publicdata/collector/PublicDataCollectorTest.java
git commit -m "축적 4: 수집 스케줄러 + 결과 요약 (TDD, 장애 격리·멱등)"
```

---

### Task 5: 컨트롤러 (이력 조회 + 수동 수집) + 비교 이력 경로

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/publicdata/history/PublicDataHistoryController.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/collector/PublicDataCollectController.java`
- Modify: `backend/src/main/java/com/airvision/backend/publicdata/comparison/ComparisonController.java` (`/history` 추가)
- Test: `backend/src/test/java/com/airvision/backend/publicdata/history/PublicDataHistoryControllerTest.java`
- Test: `backend/src/test/java/com/airvision/backend/publicdata/collector/PublicDataCollectControllerTest.java`

**Interfaces:**
- Consumes: `PublicDataHistoryService`(Task 3), `PublicDataCollector`(Task 4).
- Produces (모두 `ApiResponse<T>`):
  - `GET /api/public-data/history/measurements/hourly?sido=&from=&to=`
  - `GET /api/public-data/history/measurements?stationName=&from=&to=`
  - `GET /api/public-data/history/weather?sido=&from=&to=`
  - `GET /api/public-data/history/summary` → `{accumulatedCount, earliestCollectedAt}`
  - `GET /api/air-quality/comparison/history?from=&to=`
  - `POST /api/public-data/collect` → `CollectionResult`

날짜 파라미터는 `@RequestParam(required=false) @DateTimeFormat(iso = ISO.DATE_TIME) Instant`.
**중요**: 기존 `VizController` 관례대로 `@DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)`을
반드시 붙여야 ISO-8601 문자열이 `Instant`로 바인딩된다(누락 시 400/바인딩 실패).

- [ ] **Step 1: 실패 테스트 작성 (`PublicDataHistoryControllerTest`)**

```java
package com.airvision.backend.publicdata.history;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.publicdata.history.dto.MeasurementHourlyPoint;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(PublicDataHistoryController.class)
class PublicDataHistoryControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    PublicDataHistoryService historyService;

    @Test
    void 시간별_평균을_공통_응답으로_반환한다() throws Exception {
        when(historyService.hourly(any(), any(), any())).thenReturn(List.of(
                new MeasurementHourlyPoint(Instant.parse("2026-07-18T04:00:00Z"),
                        40.0, 22.5, 8)));

        mockMvc.perform(get("/api/public-data/history/measurements/hourly"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data[0].avgPm25").value(22.5))
                .andExpect(jsonPath("$.data[0].count").value(8));
    }

    @Test
    void 잘못된_기간은_400이다() throws Exception {
        when(historyService.hourly(any(), any(), any()))
                .thenThrow(new IllegalArgumentException("from은 to보다 앞서야 합니다"));

        mockMvc.perform(get("/api/public-data/history/measurements/hourly"))
                .andExpect(status().isBadRequest());
    }
}
```

- [ ] **Step 2: 실패 테스트 작성 (`PublicDataCollectControllerTest`)**

```java
package com.airvision.backend.publicdata.collector;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.publicdata.collector.dto.CollectionResult;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(PublicDataCollectController.class)
class PublicDataCollectControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    PublicDataCollector collector;

    @Test
    void 수동_수집을_트리거하고_결과_요약을_반환한다() throws Exception {
        when(collector.collectOnce()).thenReturn(
                new CollectionResult(43, 3, 2, false, Instant.parse("2026-07-18T05:10:00Z")));

        mockMvc.perform(post("/api/public-data/collect"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.measurementsUpserted").value(43))
                .andExpect(jsonPath("$.data.mock").value(false));
    }
}
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd backend; .\gradlew.bat test --tests "*PublicDataHistoryControllerTest" --tests "*PublicDataCollectControllerTest" --console=plain`
Expected: 컴파일 실패(컨트롤러 미존재)

- [ ] **Step 4: `PublicDataHistoryController` 작성**

```java
package com.airvision.backend.publicdata.history;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.history.dto.ComparisonHistoryPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementHourlyPoint;
import com.airvision.backend.publicdata.history.dto.MeasurementSeriesPoint;
import com.airvision.backend.publicdata.history.dto.WeatherSeriesPoint;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 누적된 공공 데이터 시계열 조회 API. */
@Tag(name = "Public Data History", description = "공공 데이터 누적 시계열 조회")
@RestController
@RequestMapping("/api/public-data/history")
public class PublicDataHistoryController {

    private final PublicDataHistoryService historyService;

    public PublicDataHistoryController(PublicDataHistoryService historyService) {
        this.historyService = historyService;
    }

    @Operation(summary = "누적 실측 시간별 평균 (sido 생략=전체)")
    @GetMapping("/measurements/hourly")
    public ApiResponse<List<MeasurementHourlyPoint>> hourly(
            @RequestParam(required = false) String sido,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(historyService.hourly(sido, from, to));
    }

    @Operation(summary = "측정소별 누적 실측 시계열")
    @GetMapping("/measurements")
    public ApiResponse<List<MeasurementSeriesPoint>> stationSeries(
            @RequestParam String stationName,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(historyService.stationSeries(stationName, from, to));
    }

    @Operation(summary = "시도별 누적 기상 시계열")
    @GetMapping("/weather")
    public ApiResponse<List<WeatherSeriesPoint>> weatherSeries(
            @RequestParam String sido,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(historyService.weatherSeries(sido, from, to));
    }

    @Operation(summary = "누적 현황 요약 (건수·최초 수집시각)")
    @GetMapping("/summary")
    public ApiResponse<Map<String, Object>> summary() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("accumulatedCount", historyService.accumulatedCount());
        body.put("earliestCollectedAt", historyService.earliestCollectedAt());
        return ApiResponse.ok(body);
    }

    @Operation(summary = "AI 추정-실측 오차 이력")
    @GetMapping("/comparison")
    public ApiResponse<List<ComparisonHistoryPoint>> comparisonHistory(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to) {
        return ApiResponse.ok(historyService.comparisonHistory(from, to));
    }
}
```

- [ ] **Step 5: `PublicDataCollectController` 작성**

```java
package com.airvision.backend.publicdata.collector;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.collector.dto.CollectionResult;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 수동 수집 트리거 (ADMIN — POST /api/** 규칙). 데모 시 즉시 1회 수집용. */
@Tag(name = "Public Data History", description = "공공 데이터 누적 시계열 조회")
@RestController
@RequestMapping("/api/public-data")
public class PublicDataCollectController {

    private final PublicDataCollector collector;

    public PublicDataCollectController(PublicDataCollector collector) {
        this.collector = collector;
    }

    @Operation(summary = "공공 데이터 1회 수동 수집")
    @PostMapping("/collect")
    public ApiResponse<CollectionResult> collect() {
        return ApiResponse.ok(collector.collectOnce());
    }
}
```

- [ ] **Step 6: `ComparisonController`에 `/history` 추가**

`ComparisonController.java`를 수정한다. 필드·생성자에 `PublicDataHistoryService` 추가:

```java
    private final ComparisonService comparisonService;
    private final com.airvision.backend.publicdata.history.PublicDataHistoryService historyService;

    public ComparisonController(ComparisonService comparisonService,
            com.airvision.backend.publicdata.history.PublicDataHistoryService historyService) {
        this.comparisonService = comparisonService;
        this.historyService = historyService;
    }
```

그리고 메서드 추가(기존 `bySite` 아래):

```java
    @Operation(summary = "AI 추정-실측 오차 이력 (누적)")
    @GetMapping("/history")
    public ApiResponse<java.util.List<
            com.airvision.backend.publicdata.history.dto.ComparisonHistoryPoint>> history(
            @org.springframework.web.bind.annotation.RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            java.time.Instant from,
            @org.springframework.web.bind.annotation.RequestParam(required = false)
            @org.springframework.format.annotation.DateTimeFormat(
                    iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE_TIME)
            java.time.Instant to) {
        return ApiResponse.ok(historyService.comparisonHistory(from, to));
    }
```

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd backend; .\gradlew.bat test --tests "*PublicDataHistoryControllerTest" --tests "*PublicDataCollectControllerTest" --console=plain`
Expected: BUILD SUCCESSFUL (3 tests)

- [ ] **Step 8: 전체 백엔드 테스트 (회귀 확인)**

Run: `cd backend; .\gradlew.bat test --console=plain`
Expected: BUILD SUCCESSFUL, 기존 103건 + 신규 12건 통과

- [ ] **Step 9: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/history/PublicDataHistoryController.java \
        backend/src/main/java/com/airvision/backend/publicdata/collector/PublicDataCollectController.java \
        backend/src/main/java/com/airvision/backend/publicdata/comparison/ComparisonController.java \
        backend/src/test/java/com/airvision/backend/publicdata/history/PublicDataHistoryControllerTest.java \
        backend/src/test/java/com/airvision/backend/publicdata/collector/PublicDataCollectControllerTest.java
git commit -m "축적 5: 이력 조회·수동 수집 컨트롤러 + comparison/history"
```

---

### Task 6: 프론트엔드 대시보드 차트 2종

**Files:**
- Modify: `frontend/src/api/client.ts` (타입 추가)
- Modify: `frontend/src/pages/DashboardPage.tsx` (차트 2개 + 누적 건수)

**Interfaces:**
- Consumes: `GET /api/public-data/history/measurements/hourly`, `GET /api/air-quality/comparison/history`, `GET /api/public-data/history/summary`.
- Produces: 대시보드에 "공공 실측 PM2.5 추이", "AI 추정-실측 절대오차 추이" 차트.

- [ ] **Step 1: `client.ts`에 타입 추가**

`PublicDataStatus` 인터페이스 아래(또는 공공 타입 블록 끝)에 추가:

```ts
export interface MeasurementHourlyPoint {
  hour: string
  avgPm10: number | null
  avgPm25: number | null
  count: number
}

export interface ComparisonHistoryPoint {
  computedAt: string
  siteName: string
  predictedAt: string
  predictedPm25: number
  stationName: string | null
  measuredPm25: number | null
  absoluteError: number | null
  errorRatePercent: number | null
}

export interface PublicHistorySummary {
  accumulatedCount: number
  earliestCollectedAt: string | null
}
```

- [ ] **Step 2: `DashboardPage.tsx`에 데이터 로드 추가**

기존 import 블록의 타입 import에 `MeasurementHourlyPoint, ComparisonHistoryPoint`를 추가하고,
상태·로드를 추가한다. 공공 카드 로드 `useEffect` 안(또는 새 `useEffect`)에 다음을 추가:

```tsx
  const [airHistory, setAirHistory] = useState<{ time: string; pm25: number | null }[]>([])
  const [errorHistory, setErrorHistory] =
    useState<{ time: string; error: number | null }[]>([])
  const [accumulated, setAccumulated] = useState<number | null>(null)

  useEffect(() => {
    const now = Date.now()
    const from = new Date(now - 48 * 3600 * 1000).toISOString()
    const to = new Date(now).toISOString()
    apiClient.get<ApiResponse<MeasurementHourlyPoint[]>>(
      `/public-data/history/measurements/hourly?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((res) => setAirHistory(res.data.data.map((p) => ({
        time: new Date(p.hour).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit' }),
        pm25: p.avgPm25 != null ? Math.round(p.avgPm25 * 10) / 10 : null,
      }))))
      .catch(() => setAirHistory([]))
    apiClient.get<ApiResponse<ComparisonHistoryPoint[]>>('/air-quality/comparison/history')
      .then((res) => setErrorHistory(res.data.data.map((p) => ({
        time: new Date(p.computedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit' }),
        error: p.absoluteError,
      }))))
      .catch(() => setErrorHistory([]))
    apiClient.get<ApiResponse<{ accumulatedCount: number }>>('/public-data/history/summary')
      .then((res) => setAccumulated(res.data.data.accumulatedCount))
      .catch(() => setAccumulated(null))
  }, [])
```

- [ ] **Step 3: `DashboardPage.tsx`에 차트 UI 추가**

기존 "관측값 vs AI 예측값" 차트 블록을 담은 `<div className="grid gap-6 xl:grid-cols-2">` 바로
아래에 새 그리드 섹션을 추가:

```tsx
      <div>
        <div className="mb-2 flex items-baseline gap-3">
          <h3 className="font-semibold text-gray-900">공공 데이터 누적 추이</h3>
          <span className="text-xs text-gray-400">
            매시간 자동 수집 · 출처: AirKorea / 기상청
            {accumulated != null && ` · 누적 ${accumulated.toLocaleString()}건`}
          </span>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-700">
              공공 실측 PM2.5 추이 (수도권 시간별 평균, 최근 48h)
            </h4>
            {airHistory.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">
                아직 누적된 실측 데이터가 없습니다. 수집이 진행되면 표시됩니다.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={airHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" fontSize={11} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pm25" name="평균 PM2.5"
                    stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-700">
              AI 추정-실측 절대오차 추이 (PM2.5)
            </h4>
            {errorHistory.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">
                비교 이력이 아직 없습니다. AI 예측을 실행하면 매칭된 오차가 시간에 따라 쌓입니다.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={errorHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" fontSize={11} />
                  <YAxis fontSize={12} unit="㎍" />
                  <Tooltip />
                  <Line type="monotone" dataKey="error" name="절대오차"
                    stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
```

- [ ] **Step 4: 빌드·린트 확인**

Run: `cd frontend; npm run build`
Expected: `✓ built`
Run: `cd frontend; npm run lint`
Expected: 오류 없음

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/api/client.ts frontend/src/pages/DashboardPage.tsx
git commit -m "축적 6: 대시보드 공공 실측·오차 추이 차트"
```

---

### Task 7: 통합 검증 (실기동 + integration-test.ps1)

**Files:**
- Modify: `scripts/integration-test.ps1` (신규 항목 추가)
- Modify: `.env.example` (수집 관련 변수 주석 추가)
- Modify: `docs/progress.md` (Phase 11 기록)

**Interfaces:**
- Consumes: 전체 스택 실행 상태.
- Produces: integration-test 전체 PASS, 실 DB에 누적 데이터.

- [ ] **Step 1: `.env.example`에 수집 변수 주석 추가**

공공데이터 섹션 끝(`COMPARISON_MAX_MINUTES=60` 아래)에 추가:

```env
# 공공 데이터 자동 수집 (매시간 누적)
PUBLIC_DATA_COLLECTION_ENABLED=true
PUBLIC_DATA_COLLECT_ON_STARTUP=true
PUBLIC_DATA_RETENTION_DAYS=180
```

- [ ] **Step 2: `integration-test.ps1`에 누적 검증 항목 추가**

스크립트 마지막 "=== 결과 ===" 직전에, ADMIN 토큰으로 수동 수집→이력 조회 블록을 추가한다.
(스크립트의 기존 admin 로그인 토큰 변수명을 확인해 재사용. 없으면 로그인 추가.)

```powershell
Write-Host "=== 8. 공공 데이터 누적 ==="
# ADMIN 토큰 확보 (스크립트 상단에 이미 있으면 재사용)
$adminLogin = Invoke-RestMethod -Method Post -Uri "$base/api/auth/login" `
    -ContentType "application/json" -Body '{"username":"admin","password":"admin1234!"}'
$AH = @{ Authorization = "Bearer $($adminLogin.data.token)" }

$collect = Invoke-RestMethod -Method Post -Uri "$base/api/public-data/collect" -Headers $AH
Assert ($collect.data.measurementsUpserted -ge 1) "수동 수집: 측정 1건 이상"

$hourly = Invoke-RestMethod -Uri "$base/api/public-data/history/measurements/hourly" -Headers $AH
Assert ($hourly.data.Count -ge 1) "시간별 이력 조회 (누적)"

$summary = Invoke-RestMethod -Uri "$base/api/public-data/history/summary" -Headers $AH
Assert ($summary.data.accumulatedCount -ge 1) "누적 요약 건수"

Invoke-RestMethod -Uri "$base/api/air-quality/comparison/history" -Headers $AH | Out-Null
Assert $true "오차 이력 조회 200"
```

(스크립트의 실제 `$base`·`Assert` 헬퍼·admin 토큰 관례에 맞춰 표기를 조정한다.)

- [ ] **Step 3: 전체 스택 실행**

Run: `.\run.ps1`
대기: backend(8080)·ai(8000)·frontend(5173) 헬스 OK까지.
(스케줄러 `collect-on-startup=true`라 기동 직후 1회 수집됨 → V3 테이블 검증 겸함)

- [ ] **Step 4: 마이그레이션·누적 검증**

Run(헬스 OK 후):
```powershell
$L = Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/auth/login" -ContentType "application/json" -Body '{"username":"admin","password":"admin1234!"}'
$H = @{ Authorization = "Bearer $($L.data.token)" }
Invoke-RestMethod -Method Post -Uri "http://localhost:8080/api/public-data/collect" -Headers $H
Invoke-RestMethod -Uri "http://localhost:8080/api/public-data/history/summary" -Headers $H
```
Expected: 수집 결과 `measurementsUpserted >= 1`, summary `accumulatedCount >= 1`.
재수집 시 중복 없이 count 유지/증가(멱등) 확인.

- [ ] **Step 5: 통합 테스트 실행**

Run: `powershell -ExecutionPolicy Bypass -File .\scripts\integration-test.ps1`
Expected: 기존 29건 + 신규 4건 = 33 PASS / 0 FAIL

- [ ] **Step 6: 스택 종료**

Run: `.\run.ps1 -Stop`

- [ ] **Step 7: `progress.md` 갱신 + 커밋**

`docs/progress.md`에 Phase 11 섹션 추가(수집 루프·조회 API·비교 이력·대시보드 차트,
테스트 건수, 실기동 VERIFIED). 그리고:

```bash
git add scripts/integration-test.ps1 .env.example docs/progress.md
git commit -m "축적 7: 통합 검증 + integration-test 항목 + progress 갱신"
```

---

## Self-Review 메모

- **스펙 커버리지**: V3 스키마(Task1) · 수집기/스케줄/보존/기동/수동(Task4·5) · 조회 API 5종(Task5) ·
  대시보드 차트 2종+누적건수(Task6) · Mock 플래그(엔티티/수집기) · 비교 이력 matched-only(Task4) ·
  테스트(Task3·4·5) · 통합(Task7) — 스펙 완료조건 1~6 모두 대응.
- **기존 코드 영향**: `ComparisonController`만 수정(생성자+메서드 추가), 기존 `PublicDataProperties`·
  테스트 무변경(CollectionProperties 분리). SecurityConfig·기존 마이그레이션 무변경.
- **타입 일관성**: `HourlyAvg.getCnt()`(projection) → `MeasurementHourlyPoint.count`(long). 수집기
  upsert 파라미터 순서(measurement 16개)는 리포지토리 시그니처와 1:1 대응.
- **위험**: 네이티브 upsert 파라미터가 많아 순서 오류 위험 → Task2 작성 시 컬럼 순서와 대조.
  실 DB 검증은 Task7에서 수행(엔티티 `ddl-auto: validate` 통과 = 스키마 일치 확인).
