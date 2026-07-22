# 대시보드 지역 선택(구 단위 필터) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드 상단에서 인천 전역 / 미추홀구 / 남동구 / 연수구를 선택하면 자체 데이터 기반 통계 카드·차트가 선택 지역 기준으로 재집계되어 표시된다.

**Architecture:** Flyway V5로 `observation_sites.district` 컬럼을 추가하고, 대시보드·예측 API에 선택적 `district` 파라미터를 추가해 서버에서 집계한다. 프론트는 `RegionSelector` 컴포넌트 + `DashboardPage` 로컬 state로 재조회한다. 공공 데이터 카드(시/도 단위 자료)는 필터링하지 않고 "인천 전역" 라벨을 명시한다.

**Tech Stack:** Spring Boot(Java 21, JPA native query, MockMvc/Mockito), PostgreSQL(Flyway), React 19 + TypeScript + Vitest + Testing Library, Tailwind CSS

**스펙:** `docs/superpowers/specs/2026-07-22-dashboard-region-filter-design.md`

## Global Constraints

- 허용 구 값은 정확히 `미추홀구`, `남동구`, `연수구` 3종. 그 외 값은 400 Bad Request.
- `district` 파라미터 미지정 시 모든 API는 기존과 완전히 동일하게 동작해야 한다 (기존 호출부 무변경).
- **최근 보간 수는 항상 전체 기준** (IDW 표면은 구에 귀속되지 않음). 구 선택 시 카드에 "전체 기준" 라벨.
- 공공 데이터 카드/차트는 재조회하지 않고 "인천 전역 (시/도 단위 자료)" 라벨을 표시한다.
- 커밋 메시지는 저장소 관례(한국어 요약 + Phase 번호)를 따른다.
- 백엔드 명령은 `backend/` 디렉터리에서 `.\gradlew.bat`, 프론트 명령은 `frontend/`에서 `npm` 실행 (Windows PowerShell).
- 원격 PostgreSQL이 필요해 마이그레이션 적용·실행 검증은 Task 5에서 일괄 수행한다. 실행하지 못하면 이유를 `docs/progress.md`에 기록한다.

---

### Task 1: DB 마이그레이션 + 관측소 엔티티/DTO district 필드

**Files:**
- Create: `backend/src/main/resources/db/migration/V5__site_district.sql`
- Modify: `backend/src/main/java/com/airvision/backend/site/ObservationSite.java`
- Modify: `backend/src/main/java/com/airvision/backend/site/dto/SiteResponse.java`
- Test: `backend/src/test/java/com/airvision/backend/site/SiteControllerTest.java`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: `ObservationSite.getDistrict(): String` (nullable), `SiteResponse` record에 `String district` 필드 (description 다음, geomWkt 앞), `observation_sites.district VARCHAR(30)` 컬럼

- [ ] **Step 1: 실패하는 테스트 작성 — sites 응답에 district 노출**

`SiteControllerTest.java`의 `sample(...)` 헬퍼(38행 부근)를 찾아 `SiteResponse` 생성자에 district 인자를 추가하고, 목록 조회 테스트에 district 검증을 추가한다.

```java
// 기존
return new SiteResponse(id, "서울시청", 37.5665, 126.9780, 38.0,
        "SENSOR", "테스트 관측소", "POINT(126.978 37.5665)",
        Instant.parse("2026-07-17T00:00:00Z"), Instant.parse("2026-07-17T00:00:00Z"));
// 변경 (description 다음에 district)
return new SiteResponse(id, "서울시청", 37.5665, 126.9780, 38.0,
        "SENSOR", "테스트 관측소", "미추홀구", "POINT(126.978 37.5665)",
        Instant.parse("2026-07-17T00:00:00Z"), Instant.parse("2026-07-17T00:00:00Z"));
```

목록 조회 성공 테스트(list 계열 테스트 메서드)에 한 줄 추가:

```java
.andExpect(jsonPath("$.data[0].district").value("미추홀구"))
```

(주의: 이 파일의 다른 `new SiteResponse(...)` 호출이 있으면 모두 같은 위치에 인자를 추가한다.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend; .\gradlew.bat test --tests "com.airvision.backend.site.SiteControllerTest"`
Expected: 컴파일 에러 (SiteResponse 생성자 인자 수 불일치) — 이것이 이 단계의 "실패"다.

- [ ] **Step 3: 마이그레이션 + 엔티티 + DTO 구현**

`V5__site_district.sql` 생성:

```sql
-- =============================================================
-- 관측소 구(행정구) 컬럼 추가 (V5, Phase 25: 대시보드 구 단위 필터)
-- 자체 관측소를 구 단위로 집계하기 위해 district 컬럼을 추가하고,
-- 인천 핵심 3구 시드 관측소(V4)와 V2의 인천송도(연수구 소재)에 값을 채운다.
-- 그 외 관측소(서울·수원·성남·고양)는 NULL 유지 → 구 필터에 포함되지 않는다.
-- =============================================================

ALTER TABLE observation_sites ADD COLUMN IF NOT EXISTS district VARCHAR(30);

UPDATE observation_sites SET district = '미추홀구' WHERE name IN ('미추홀주안', '미추홀용현');
UPDATE observation_sites SET district = '남동구'   WHERE name IN ('남동구월', '남동논현');
UPDATE observation_sites SET district = '연수구'   WHERE name IN ('연수동춘', '연수송도', '인천송도');
```

`ObservationSite.java` — `description` 필드 선언 아래에 추가:

```java
/** 소속 행정구 (인천 핵심 3구만 값 존재, 그 외 NULL). 시드/마이그레이션으로만 채운다. */
@Column(length = 30)
private String district;
```

getter들 중 `getDescription()` 아래에 추가:

```java
public String getDistrict() {
    return district;
}
```

(생성자·update 메서드는 변경하지 않는다 — district는 마이그레이션으로만 관리, CRUD 편집은 YAGNI.)

`SiteResponse.java` — record 필드에 `description` 다음, `geomWkt` 앞에 `String district` 추가하고 `from` 두 곳 갱신:

```java
public record SiteResponse(
        Long id,
        String name,
        double latitude,
        double longitude,
        Double altitude,
        String siteType,
        String description,
        String district,
        String geomWkt,
        Instant createdAt,
        Instant updatedAt
) {

    public static SiteResponse from(ObservationSite site) {
        return from(site, null);
    }

    public static SiteResponse from(ObservationSite site, String geomWkt) {
        return new SiteResponse(
                site.getId(),
                site.getName(),
                site.getLatitude(),
                site.getLongitude(),
                site.getAltitude(),
                site.getSiteType(),
                site.getDescription(),
                site.getDistrict(),
                geomWkt,
                site.getCreatedAt(),
                site.getUpdatedAt()
        );
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend; .\gradlew.bat test --tests "com.airvision.backend.site.SiteControllerTest"`
Expected: BUILD SUCCESSFUL, 전체 통과

- [ ] **Step 5: 커밋**

```powershell
git add backend/src/main/resources/db/migration/V5__site_district.sql backend/src/main/java/com/airvision/backend/site/ObservationSite.java backend/src/main/java/com/airvision/backend/site/dto/SiteResponse.java backend/src/test/java/com/airvision/backend/site/SiteControllerTest.java
git commit -m "관측소 district 컬럼·응답 필드 추가 (Phase 25)"
```

---

### Task 2: 구 허용값 검증 + 대시보드 API district 파라미터

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/site/Districts.java`
- Create: `backend/src/test/java/com/airvision/backend/site/DistrictsTest.java`
- Create: `backend/src/test/java/com/airvision/backend/dashboard/DashboardControllerTest.java`
- Modify: `backend/src/main/java/com/airvision/backend/observation/ObservationRepository.java`
- Modify: `backend/src/main/java/com/airvision/backend/site/ObservationSiteRepository.java`
- Modify: `backend/src/main/java/com/airvision/backend/prediction/PredictionRepository.java`
- Modify: `backend/src/main/java/com/airvision/backend/dashboard/DashboardService.java`
- Modify: `backend/src/main/java/com/airvision/backend/dashboard/DashboardController.java`

**Interfaces:**
- Consumes: Task 1의 `observation_sites.district` 컬럼
- Produces:
  - `Districts.ALLOWED: List<String>`, `Districts.validate(String): String` (null/blank→null, 허용 외→IllegalArgumentException→전역 핸들러가 400 처리)
  - `ObservationRepository.findLatestPm25PerSite(Instant at, String district)` + 기존 시그니처는 default 오버로드로 유지 (viz·interpolation 호출부 무변경)
  - `ObservationRepository.findHourlyAveragePm25(Instant from, String district)` (기존 단일 인자 시그니처는 default 오버로드)
  - `ObservationSiteRepository.countByDistrict(String)`
  - `PredictionRepository.countByPredictedAtAfterAndSite_District(Instant, String)`
  - `DashboardService.summary(String district)`, `DashboardService.hourlyAverage(int hours, String district)` — summary 응답 맵에 `district` 키 추가

- [ ] **Step 1: 실패하는 테스트 작성 — Districts 검증**

`DistrictsTest.java` 생성:

```java
package com.airvision.backend.site;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/** 대시보드 구 필터 허용값 검증 로직. */
class DistrictsTest {

    @Test
    void validate_null이나_빈값은_전체를_뜻하는_null을_반환한다() {
        assertThat(Districts.validate(null)).isNull();
        assertThat(Districts.validate(" ")).isNull();
    }

    @Test
    void validate_허용된_구는_그대로_반환한다() {
        assertThat(Districts.validate("미추홀구")).isEqualTo("미추홀구");
        assertThat(Districts.validate("남동구")).isEqualTo("남동구");
        assertThat(Districts.validate("연수구")).isEqualTo("연수구");
    }

    @Test
    void validate_허용되지_않은_값은_IllegalArgumentException() {
        assertThatThrownBy(() -> Districts.validate("강남구"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("강남구");
    }
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend; .\gradlew.bat test --tests "com.airvision.backend.site.DistrictsTest"`
Expected: 컴파일 에러 (Districts 클래스 없음)

- [ ] **Step 3: Districts 구현**

`Districts.java` 생성:

```java
package com.airvision.backend.site;

import java.util.List;

/** 대시보드 구 단위 필터 허용값 (프로젝트 핵심 대상지: 인천 핵심 3구). */
public final class Districts {

    public static final List<String> ALLOWED = List.of("미추홀구", "남동구", "연수구");

    private Districts() {
    }

    /** null/공백이면 전체(null), 허용 목록이면 그대로 반환. 그 외는 400으로 매핑되는 예외. */
    public static String validate(String district) {
        if (district == null || district.isBlank()) {
            return null;
        }
        if (!ALLOWED.contains(district)) {
            throw new IllegalArgumentException(
                    "지원하지 않는 지역입니다: %s (허용: %s)".formatted(district, String.join(", ", ALLOWED)));
        }
        return district;
    }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend; .\gradlew.bat test --tests "com.airvision.backend.site.DistrictsTest"`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: 실패하는 테스트 작성 — 대시보드 컨트롤러 district 파라미터**

`DashboardControllerTest.java` 생성 (기존 `PredictionControllerTest`와 같은 `@WebMvcTest` 방식, DB 불필요):

```java
package com.airvision.backend.dashboard;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** 대시보드 API의 구 단위 필터 파라미터 전달·검증을 확인한다 (DB 불필요). */
@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(DashboardController.class)
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DashboardService dashboardService;

    @Test
    void summary_구지정시_검증된_구를_서비스에_전달한다() throws Exception {
        when(dashboardService.summary("미추홀구"))
                .thenReturn(Map.<String, Object>of("siteCount", 2L, "district", "미추홀구"));

        mockMvc.perform(get("/api/dashboard/summary").param("district", "미추홀구"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.siteCount").value(2))
                .andExpect(jsonPath("$.data.district").value("미추홀구"));
    }

    @Test
    void summary_구미지정시_null을_전달한다() throws Exception {
        when(dashboardService.summary(null))
                .thenReturn(Map.<String, Object>of("siteCount", 13L));

        mockMvc.perform(get("/api/dashboard/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.siteCount").value(13));
    }

    @Test
    void summary_허용되지_않은_구는_400() throws Exception {
        mockMvc.perform(get("/api/dashboard/summary").param("district", "강남구"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void hourly_구지정시_구를_서비스에_전달한다() throws Exception {
        when(dashboardService.hourlyAverage(24, "연수구")).thenReturn(List.of());

        mockMvc.perform(get("/api/dashboard/hourly")
                        .param("hours", "24").param("district", "연수구"))
                .andExpect(status().isOk());
    }
}
```

- [ ] **Step 6: 테스트 실패 확인**

Run: `cd backend; .\gradlew.bat test --tests "com.airvision.backend.dashboard.DashboardControllerTest"`
Expected: 컴파일 에러 (`summary(String)`, `hourlyAverage(int, String)` 없음)

- [ ] **Step 7: 리포지토리·서비스·컨트롤러 구현**

`ObservationRepository.java` — 두 쿼리에 district 조건을 추가하고, 기존 시그니처는 default 오버로드로 유지한다 (`(:district IS NULL OR ...)` 패턴은 `PublicAirMeasurementRepository.findHourlyAvg`에서 이미 사용 중):

```java
@Query(value = """
        SELECT date_trunc('hour', o.observed_at) AS hour,
               AVG(o.pm25)                       AS avgPm25
        FROM observations o
        JOIN observation_sites s ON s.id = o.site_id
        WHERE o.observed_at >= :from AND o.pm25 IS NOT NULL
          AND (:district IS NULL OR s.district = :district)
        GROUP BY 1
        ORDER BY 1
        """, nativeQuery = true)
List<HourlyAvg> findHourlyAveragePm25(@Param("from") Instant from,
                                      @Param("district") String district);

default List<HourlyAvg> findHourlyAveragePm25(Instant from) {
    return findHourlyAveragePm25(from, null);
}

@Query(value = """
        SELECT DISTINCT ON (o.site_id)
               o.site_id     AS siteId,
               s.name        AS siteName,
               s.latitude    AS latitude,
               s.longitude   AS longitude,
               o.pm25        AS pm25,
               o.observed_at AS observedAt
        FROM observations o
        JOIN observation_sites s ON s.id = o.site_id
        WHERE o.pm25 IS NOT NULL
          AND o.observed_at <= :at
          AND (:district IS NULL OR s.district = :district)
        ORDER BY o.site_id, o.observed_at DESC
        """, nativeQuery = true)
List<SitePm25> findLatestPm25PerSite(@Param("at") Instant at,
                                     @Param("district") String district);

default List<SitePm25> findLatestPm25PerSite(Instant at) {
    return findLatestPm25PerSite(at, null);
}
```

(기존 단일 인자 `findHourlyAveragePm25`/`findLatestPm25PerSite`의 `@Query` 선언은 위 2-인자 버전으로 교체하고, 단일 인자는 default 메서드가 된다. `VizController`·`InterpolationService` 호출부는 수정하지 않는다.)

`ObservationSiteRepository.java` — 메서드 추가:

```java
long countByDistrict(String district);
```

`PredictionRepository.java` — 메서드 추가 (`countByPredictedAtAfter` 아래):

```java
long countByPredictedAtAfterAndSite_District(java.time.Instant time, String district);
```

`DashboardService.java` — `summary()`/`hourlyAverage(int)`를 district 인자를 받도록 변경:

```java
public Map<String, Object> summary(String district) {
    Instant now = Instant.now();
    Instant dayAgo = now.minus(Duration.ofHours(24));

    // 관측소별 최신 PM2.5의 평균 (district가 null이면 전체)
    var latest = observationRepository.findLatestPm25PerSite(now, district);
    Double avgPm25 = latest.isEmpty() ? null : latest.stream()
            .mapToDouble(ObservationRepository.SitePm25::getPm25).average().orElse(0);

    Map<String, Object> result = new HashMap<>();
    result.put("latestAvgPm25", avgPm25 == null ? null : Math.round(avgPm25 * 10) / 10.0);
    result.put("grade", avgPm25 == null ? null : gradeProperties.gradeOf(avgPm25));
    result.put("siteCount", district == null
            ? siteRepository.count() : siteRepository.countByDistrict(district));
    result.put("recentPredictionCount", district == null
            ? predictionRepository.countByPredictedAtAfter(dayAgo)
            : predictionRepository.countByPredictedAtAfterAndSite_District(dayAgo, district));
    // 보간(IDW) 결과는 전체 관측소 기반 격자 표면이라 구 단위로 나눌 수 없다 → 항상 전체 건수
    result.put("recentInterpolationCount", interpolationRepository.countByCreatedAtAfter(dayAgo));
    result.put("district", district);
    return result;
}

public List<Map<String, Object>> hourlyAverage(int hours, String district) {
    Instant from = Instant.now().minus(Duration.ofHours(hours));
    return observationRepository.findHourlyAveragePm25(from, district).stream()
            .map(row -> Map.<String, Object>of(
                    "time", row.getHour(),
                    "avgPm25", row.getAvgPm25() == null ? 0
                            : Math.round(row.getAvgPm25() * 10) / 10.0))
            .toList();
}
```

주의: `Map.of`는 null 값을 허용하지 않으므로 `result.put("district", district)`는 `HashMap`인 summary에서만 사용한다 (district가 null이어도 `HashMap.put`은 안전).

`DashboardController.java` — 파라미터 추가 (`import com.airvision.backend.site.Districts;` 추가):

```java
@Operation(summary = "대시보드 요약 (최신 평균 PM2.5, 등급, 관측소 수, 최근 예측·보간 건수, 구 필터)")
@GetMapping("/summary")
public ApiResponse<Map<String, Object>> summary(
        @RequestParam(required = false) String district) {
    return ApiResponse.ok(dashboardService.summary(Districts.validate(district)));
}

@Operation(summary = "시간별 평균 PM2.5 (최근 N시간, 구 필터)")
@GetMapping("/hourly")
public ApiResponse<List<Map<String, Object>>> hourly(
        @RequestParam(defaultValue = "24") int hours,
        @RequestParam(required = false) String district) {
    return ApiResponse.ok(dashboardService.hourlyAverage(
            Math.min(Math.max(hours, 1), 168), Districts.validate(district)));
}
```

- [ ] **Step 8: 테스트 통과 확인 (백엔드 전체)**

Run: `cd backend; .\gradlew.bat test`
Expected: BUILD SUCCESSFUL — DashboardControllerTest 4건 포함 전체 통과. (전체 실행 이유: 리포지토리 시그니처 변경이 다른 테스트를 깨지 않는지 확인)

- [ ] **Step 9: 커밋**

```powershell
git add backend/src/main/java/com/airvision/backend/site/Districts.java backend/src/test/java/com/airvision/backend/site/DistrictsTest.java backend/src/test/java/com/airvision/backend/dashboard/DashboardControllerTest.java backend/src/main/java/com/airvision/backend/observation/ObservationRepository.java backend/src/main/java/com/airvision/backend/site/ObservationSiteRepository.java backend/src/main/java/com/airvision/backend/prediction/PredictionRepository.java backend/src/main/java/com/airvision/backend/dashboard/DashboardService.java backend/src/main/java/com/airvision/backend/dashboard/DashboardController.java
git commit -m "대시보드 요약·시간별 API 구 단위 필터 (Phase 25)"
```

---

### Task 3: 예측 목록 API district 필터

**Files:**
- Modify: `backend/src/main/java/com/airvision/backend/prediction/PredictionRepository.java`
- Modify: `backend/src/main/java/com/airvision/backend/prediction/PredictionService.java`
- Modify: `backend/src/main/java/com/airvision/backend/prediction/PredictionController.java`
- Test: `backend/src/test/java/com/airvision/backend/prediction/PredictionControllerTest.java`

**Interfaces:**
- Consumes: Task 2의 `Districts.validate(String)`
- Produces: `PredictionService.findRecent(Long siteId, String district, int page, int size)` — **기존 3-인자 시그니처를 4-인자로 교체** (siteId 우선, 다음 district, 없으면 전체), `GET /api/predictions?district=` 파라미터

- [ ] **Step 1: 실패하는 테스트 작성**

`PredictionControllerTest.java` — 기존 목록 테스트(105행 부근)의 목 시그니처를 4-인자로 바꾸고 district 테스트를 추가한다:

```java
// 기존
when(predictionService.findRecent(eq(null), eq(0), eq(20)))
// 변경
when(predictionService.findRecent(eq(null), eq(null), eq(0), eq(20)))
```

새 테스트 메서드 추가:

```java
@Test
void list_withDistrict_passesDistrict() throws Exception {
    when(predictionService.findRecent(eq(null), eq("남동구"), eq(0), eq(20)))
            .thenReturn(PageResponse.from(
                    new org.springframework.data.domain.PageImpl<>(List.of(sampleResponse()))));

    mockMvc.perform(get("/api/predictions").param("district", "남동구"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.data.content[0].predictedPm25").value(28.75));
}

@Test
void list_invalidDistrict_returns400() throws Exception {
    mockMvc.perform(get("/api/predictions").param("district", "부평구"))
            .andExpect(status().isBadRequest());
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend; .\gradlew.bat test --tests "com.airvision.backend.prediction.PredictionControllerTest"`
Expected: 컴파일 에러 (findRecent 4-인자 시그니처 없음)

- [ ] **Step 3: 구현**

`PredictionRepository.java` — 메서드 추가:

```java
Page<Prediction> findBySite_DistrictOrderByPredictedAtDesc(String district, Pageable pageable);
```

`PredictionService.java` — `findRecent`를 교체 (`import org.springframework.data.domain.Page;` 추가):

```java
public PageResponse<PredictionResponse> findRecent(Long siteId, String district,
                                                   int page, int size) {
    var pageable = PageRequest.of(page, size);
    Page<Prediction> result;
    if (siteId != null) {
        result = predictionRepository.findBySite_IdOrderByPredictedAtDesc(siteId, pageable);
    } else if (district != null) {
        result = predictionRepository.findBySite_DistrictOrderByPredictedAtDesc(district, pageable);
    } else {
        result = predictionRepository.findAllByOrderByPredictedAtDesc(pageable);
    }
    return PageResponse.from(result.map(PredictionResponse::from));
}
```

`PredictionController.java` — `list`에 파라미터 추가 (`import com.airvision.backend.site.Districts;` 추가):

```java
@Operation(summary = "예측 결과 목록 조회 (최신순, 관측소·구 필터)")
@GetMapping
public ApiResponse<PageResponse<PredictionResponse>> list(
        @RequestParam(required = false) Long siteId,
        @RequestParam(required = false) String district,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size) {
    return ApiResponse.ok(predictionService.findRecent(
            siteId, Districts.validate(district), page, Math.min(size, 200)));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend; .\gradlew.bat test`
Expected: BUILD SUCCESSFUL, 전체 통과

- [ ] **Step 5: 커밋**

```powershell
git add backend/src/main/java/com/airvision/backend/prediction backend/src/test/java/com/airvision/backend/prediction/PredictionControllerTest.java
git commit -m "예측 목록 API 구 단위 필터 (Phase 25)"
```

---

### Task 4: 프론트엔드 RegionSelector + DashboardPage 지역 필터

**Files:**
- Create: `frontend/src/components/RegionSelector.tsx`
- Create: `frontend/src/components/RegionSelector.test.tsx`
- Modify: `frontend/src/api/client.ts` (Site 인터페이스, 20행 부근)
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: Task 2·3의 `?district=` API 파라미터, `frontend/src/config/sido.ts`의 `INCHEON_CORE_DISTRICTS` (name: 미추홀구/남동구/연수구)
- Produces: `RegionSelector({ value: string | null, onChange: (district: string | null) => void })` 컴포넌트 — value가 null이면 "인천 전역"

- [ ] **Step 1: 실패하는 테스트 작성**

`RegionSelector.test.tsx` 생성 (기존 `AlertBanner.test.tsx`와 같은 Testing Library 방식):

```tsx
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import RegionSelector from './RegionSelector'

describe('RegionSelector', () => {
  it('인천 전역과 핵심 3구 버튼을 렌더링한다', () => {
    render(<RegionSelector value={null} onChange={() => {}} />)
    for (const label of ['인천 전역', '미추홀구', '남동구', '연수구']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('구 버튼 클릭 시 구 이름으로 onChange를 호출한다', () => {
    const onChange = vi.fn()
    render(<RegionSelector value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '남동구' }))
    expect(onChange).toHaveBeenCalledWith('남동구')
  })

  it('인천 전역 클릭 시 null로 onChange를 호출한다', () => {
    const onChange = vi.fn()
    render(<RegionSelector value="연수구" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '인천 전역' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend; npm test`
Expected: RegionSelector.test.tsx FAIL (모듈 없음), 기존 테스트는 통과 유지

- [ ] **Step 3: RegionSelector 구현**

`RegionSelector.tsx` 생성:

```tsx
import { INCHEON_CORE_DISTRICTS } from '../config/sido'

/**
 * 대시보드 지역 선택 세그먼트 버튼 (인천 전역 / 핵심 3구).
 * value가 null이면 인천 전역(필터 없음)을 뜻한다.
 */
export default function RegionSelector({
  value,
  onChange,
}: {
  value: string | null
  onChange: (district: string | null) => void
}) {
  const options: { label: string; district: string | null }[] = [
    { label: '인천 전역', district: null },
    ...INCHEON_CORE_DISTRICTS.map((d) => ({ label: d.name, district: d.name })),
  ]
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.district)}
          className={`px-3 py-1.5 text-sm transition-colors ${
            value === opt.district
              ? 'bg-blue-600 font-medium text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend; npm test`
Expected: 전체 통과 (기존 38건 + 신규 3건)

- [ ] **Step 5: client.ts Site 타입에 district 추가**

`client.ts`의 `Site` 인터페이스에서 `description` 아래에 추가:

```ts
  district: string | null
```

- [ ] **Step 6: DashboardPage에 지역 필터 적용**

`DashboardPage.tsx` 변경 사항:

(a) import 추가:

```tsx
import RegionSelector from '../components/RegionSelector'
```

(b) state 추가 (`const [accumulated, ...` 아래):

```tsx
const [district, setDistrict] = useState<string | null>(null)
```

(c) 자체 데이터 useEffect(122~145행, `/dashboard/summary` 등 3개 호출)를 district 의존으로 변경. `setLoading(true)`를 다시 호출하지 않아 구 전환 시 이전 데이터가 잠깐 유지된다 (첫 로드만 전체 로딩 표시):

```tsx
useEffect(() => {
  const dq = district ? `district=${encodeURIComponent(district)}` : ''
  Promise.all([
    apiClient.get<ApiResponse<DashboardSummary>>(`/dashboard/summary${dq ? `?${dq}` : ''}`),
    apiClient.get<ApiResponse<HourlyPoint[]>>(`/dashboard/hourly?hours=24${dq ? `&${dq}` : ''}`),
    apiClient.get<ApiResponse<PageResponse<Prediction>>>(`/predictions?size=20${dq ? `&${dq}` : ''}`),
  ])
    .then(([s, h, p]) => {
      setError(null)
      setSummary(s.data.data)
      setHourly(
        h.data.data.map((row) => ({
          ...row,
          time: new Date(row.time).toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            hour12: false,
          }),
        })),
      )
      setPredictions(
        p.data.data.content.filter((x) => x.actualPm25 != null).reverse(),
      )
    })
    .catch((err) => setError(errorMessage(err)))
    .finally(() => setLoading(false))
}, [district])
```

(d) 페이지 헤더(154행 `<h2>대시보드</h2>`)를 셀렉터가 있는 헤더로 교체:

```tsx
<div className="flex flex-wrap items-center justify-between gap-3">
  <h2 className="text-xl font-bold text-gray-900">
    대시보드
    <span className="ml-2 text-sm font-normal text-gray-500">
      {district ? `${district} 기준` : '인천 전역 기준'}
    </span>
  </h2>
  <RegionSelector value={district} onChange={setDistrict} />
</div>
```

(e) "최근 보간" StatCard(175행)의 sub를 구 선택 시 전체 기준임을 표시하도록 변경:

```tsx
<StatCard
  label="최근 보간"
  value={summary?.recentInterpolationCount ?? '-'}
  sub={district ? '24시간 · 전체 기준' : '24시간'}
/>
```

(f) 공공 데이터 두 섹션 헤더에 시/도 단위 자료임을 명시. "공공 대기질·기상" 헤더(182행 부근)의 출처 span을:

```tsx
<span className="text-xs text-gray-400">
  인천 전역 (시/도 단위 자료) · 출처: 환경부·한국환경공단 AirKorea / 기상청
</span>
```

"공공 데이터 누적 추이" 헤더(318행 부근)의 span을:

```tsx
<span className="text-xs text-gray-400">
  인천 전역 (시/도 단위 자료) · 매시간 자동 수집 · 출처: AirKorea / 기상청
  {accumulated != null && ` · 누적 ${accumulated.toLocaleString()}건`}
</span>
```

- [ ] **Step 7: 타입 검사·테스트·빌드**

Run: `cd frontend; npm test; npm run build`
Expected: 테스트 전체 통과, `tsc -b` 포함 빌드 성공

- [ ] **Step 8: 커밋**

```powershell
git add frontend/src/components/RegionSelector.tsx frontend/src/components/RegionSelector.test.tsx frontend/src/api/client.ts frontend/src/pages/DashboardPage.tsx
git commit -m "대시보드 지역 선택 UI: 인천 전역·핵심 3구 필터 (Phase 25)"
```

---

### Task 5: 실행 검증 + 문서 갱신

**Files:**
- Modify: `docs/progress.md` (Phase 25 절 추가)
- Modify: `docs/user-guide.html` (대시보드 절 + 하단 "업데이트 이력" 표)

**Interfaces:**
- Consumes: Task 1~4 전체
- Produces: VERIFIED 기록 또는 실행 불가 사유 기록

- [ ] **Step 1: 백엔드 기동 + Flyway V5 적용 확인**

백엔드를 기동해 V5 마이그레이션이 적용되는지 확인한다 (원격 PostgreSQL 필요, 기동 방법은 `docs/progress.md`의 기존 실행 명령 참조 — 통상 `cd backend; .\gradlew.bat bootRun`).

Expected: 기동 로그에 `Migrating schema ... to version "5 - site district"` 및 정상 기동. DB 연결 불가 시 이 단계와 Step 2를 건너뛰고 사유를 progress.md에 기록한다.

- [ ] **Step 2: API 실행 검증 (curl)**

```powershell
curl.exe -s "http://localhost:8080/api/dashboard/summary?district=미추홀구"
curl.exe -s "http://localhost:8080/api/dashboard/summary"
curl.exe -s "http://localhost:8080/api/dashboard/hourly?hours=24&district=연수구"
curl.exe -s "http://localhost:8080/api/dashboard/summary?district=강남구"
```

Expected: ① siteCount=2, district="미추홀구" ② siteCount=전체(13), district=null ③ 시간별 배열 ④ success=false + "지원하지 않는 지역입니다" (HTTP 400)

- [ ] **Step 3: 화면 확인**

`cd frontend; npm run dev` 후 브라우저에서 대시보드 접속. 확인 항목: 세그먼트 버튼 4개 표시, 구 클릭 시 통계 카드·차트 값 변경, "OO구 기준" 표시, 공공 카드 값 불변 + "인천 전역 (시/도 단위 자료)" 라벨, 인천 전역 복귀 동작.

- [ ] **Step 4: 문서 갱신**

`docs/progress.md`에 Phase 25 절 추가 (기존 Phase 24 형식을 따름): 상태는 실행 검증까지 완료 시 VERIFIED, 코드만 완료 시 COMPLETED와 사유. 변경 파일 목록·테스트 결과 포함.

`docs/user-guide.html`: 대시보드 절에 지역 선택 사용법(버튼 4개, 공공 데이터는 시/도 단위 유지) 추가 + 하단 "업데이트 이력" 표에 2026-07-22 행 추가.

- [ ] **Step 5: 커밋**

```powershell
git add docs/progress.md docs/user-guide.html
git commit -m "대시보드 지역 선택 문서화 (Phase 25)"
```
