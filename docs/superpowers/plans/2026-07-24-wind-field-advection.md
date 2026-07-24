# 바람길 시각화 + PM2.5 이류 예측 (Phase 28) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인천권 바람장(기상청 초단기예보)을 수집·보간해 CesiumJS 지도에 Windy 스타일 파티클 애니메이션으로 표시하고, 현재 PM2.5 분포를 semi-Lagrangian 이류로 +1h~+6h 예측해 시간 슬라이더로 재생한다.

**Architecture:** 기존 `KmaWeatherClient.ultraFcst()`를 재사용해 인천권 9개 격자점의 UUU/VVV 바람 성분을 수집하고, `IdwInterpolator`로 25×25 정규 격자에 보간해 `/api/wind/field`로 제공한다. `/api/wind/advection`은 AirKorea 실측을 초기 농도장으로 같은 격자에서 시간별 역추적 이류를 수행한다. 프론트는 `cesium-wind-layer`(GPU 파티클)로 바람을, 기존 셀 타일링 방식으로 이류 프레임을 그린다.

**Tech Stack:** Spring Boot 4.1 / Java 21 / JUnit5+Mockito+AssertJ, React 19 / TypeScript / Cesium 1.143 / cesium-wind-layer 0.10.1

**Spec:** `docs/superpowers/specs/2026-07-24-wind-field-advection-design.md`

## Global Constraints

- 비밀키 하드코딩 금지 — 기존 `KMA_SERVICE_KEY` 환경변수와 Mock 폴백을 그대로 사용한다.
- 외부 API 없이(Mock 모드) 전체 기능이 동작해야 한다. Mock에서는 전 격자점이 동일 fixture를 반환하므로 균일 바람장이 되며, 이는 허용된 동작이다.
- 커밋 메시지는 프로젝트 관례(한국어, "기능 요약 (Phase 28)")를 따르고 아래 서명을 붙인다:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- 백엔드 테스트 명은 기존처럼 한글 스네이크(`초단기실황_카테고리를_피벗해_...`)로 작성한다.
- 좌표 영역(인천권): west=126.45, south=37.25, east=126.95, north=37.60. 격자 해상도 25×25, 배열은 row 0 = 남쪽(row-major, index = row*width+col).
- 이류 모델은 순수 이류(`model: "advection-only"`)이며 확산·배출 미포함. UI에 "단순 이류 추정" 배지를 반드시 표시한다.
- 도메인이 작아(약 44km) 강풍 시 수 시간 만에 경계 유입값(clamp)이 지배한다 — 알려진 한계로 문서에 기록한다.

---

### Task 1: WindUtils UV 성분 변환

**Files:**
- Modify: `backend/src/main/java/com/airvision/backend/publicdata/kma/WindUtils.java`
- Test: `backend/src/test/java/com/airvision/backend/publicdata/kma/WindUtilsTest.java` (기존 파일에 추가)

**Interfaces:**
- Produces: `WindUtils.toU(double speedMs, double meteorologicalDeg): double`, `WindUtils.toV(double speedMs, double meteorologicalDeg): double` — 기상학적 풍향(불어오는 방향)·풍속 → 동서(U, 동쪽 양수)/남북(V, 북쪽 양수) 성분 m/s. Task 2가 사용.

- [ ] **Step 1: 실패하는 테스트 작성** — `WindUtilsTest`에 추가:

```java
@Test
void 풍향_풍속을_UV_성분으로_변환한다() {
    // 서풍(VEC=270, 서에서 불어옴) → 동쪽으로 이동: u=+speed, v=0
    assertThat(WindUtils.toU(3.0, 270)).isCloseTo(3.0, within(1e-9));
    assertThat(WindUtils.toV(3.0, 270)).isCloseTo(0.0, within(1e-9));
    // 북풍(VEC=0) → 남쪽으로 이동: u=0, v=-speed
    assertThat(WindUtils.toU(2.0, 0)).isCloseTo(0.0, within(1e-9));
    assertThat(WindUtils.toV(2.0, 0)).isCloseTo(-2.0, within(1e-9));
    // 남동풍(VEC=135) → 북서로 이동: u<0, v>0
    assertThat(WindUtils.toU(1.0, 135)).isLessThan(0);
    assertThat(WindUtils.toV(1.0, 135)).isGreaterThan(0);
}
```

import 추가: `import static org.assertj.core.api.Assertions.within;`

- [ ] **Step 2: 실패 확인**

Run: `cd backend && ./gradlew test --tests WindUtilsTest`
Expected: FAIL — `toU` 심볼 없음 (컴파일 오류)

- [ ] **Step 3: 최소 구현** — `WindUtils`에 추가:

```java
/** 기상학적 풍향(불어오는 방향)·풍속 → 동서 성분 U (m/s, 동쪽 양수). */
public static double toU(double speedMs, double meteorologicalDeg) {
    return -speedMs * Math.sin(Math.toRadians(meteorologicalDeg));
}

/** 기상학적 풍향(불어오는 방향)·풍속 → 남북 성분 V (m/s, 북쪽 양수). */
public static double toV(double speedMs, double meteorologicalDeg) {
    return -speedMs * Math.cos(Math.toRadians(meteorologicalDeg));
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd backend && ./gradlew test --tests WindUtilsTest`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/kma/WindUtils.java backend/src/test/java/com/airvision/backend/publicdata/kma/WindUtilsTest.java
git commit -m "풍향·풍속 → UV 성분 변환 유틸 (Phase 28)"
```

---

### Task 2: 바람장 수집·보간 서비스 (WindFieldService)

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/publicdata/wind/WindGridPoints.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/wind/dto/WindFieldResponse.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/wind/WindFieldService.java`
- Modify: `backend/src/main/java/com/airvision/backend/publicdata/kma/KmaWeatherService.java` — `parseValue`를 `public static`으로 변경 (현재 package-private, wind 패키지에서 재사용)
- Test: `backend/src/test/java/com/airvision/backend/publicdata/wind/WindFieldServiceTest.java`

**Interfaces:**
- Consumes: `KmaWeatherClient.ultraFcst(KmaBaseTime.BaseDateTime, int nx, int ny): List<KmaRaw.Item>`, `KmaGridConverter.toGrid(lat, lon)`, `IdwInterpolator.interpolate(sources, lat, lon, power)`, `WindUtils.toU/toV` (Task 1), `KmaWeatherService.parseValue(String): Double`
- Produces: `WindFieldService.field(): WindFieldResponse` — Task 3, 4가 사용.
  - `WindFieldResponse(Bounds bounds, int width, int height, Instant baseTime, String source, boolean mock, boolean stale, List<HourField> hours)`
  - `Bounds(double west, double south, double east, double north)`
  - `HourField(Instant time, List<Double> u, List<Double> v, double speedMin, double speedMax)` — u/v는 row 0=남쪽 row-major 배열

- [ ] **Step 1: DTO·격자점 상수 작성**

`WindGridPoints.java`:

```java
package com.airvision.backend.publicdata.wind;

import java.util.List;

/**
 * 바람장 수집 대상 인천권 영역과 KMA 격자 샘플 지점.
 * 핵심 3구(미추홀·남동·연수)를 중심으로 이류 계산에 필요한 상류(주변부)까지 포함한다.
 */
public final class WindGridPoints {

    public static final double WEST = 126.45;
    public static final double SOUTH = 37.25;
    public static final double EAST = 126.95;
    public static final double NORTH = 37.60;

    public record Point(double latitude, double longitude) {
    }

    /** 3×3 샘플 격자 (경도 3 × 위도 3). 각 지점은 KMA 5km 격자로 변환해 예보를 조회한다. */
    public static final List<Point> POINTS = List.of(
            new Point(37.31, 126.51), new Point(37.31, 126.70), new Point(37.31, 126.89),
            new Point(37.43, 126.51), new Point(37.43, 126.70), new Point(37.43, 126.89),
            new Point(37.55, 126.51), new Point(37.55, 126.70), new Point(37.55, 126.89));

    private WindGridPoints() {
    }
}
```

`dto/WindFieldResponse.java`:

```java
package com.airvision.backend.publicdata.wind.dto;

import java.time.Instant;
import java.util.List;

/** 정규 격자 바람장. u/v는 row 0=남쪽, index = row*width+col (cesium-wind-layer 입력 순서). */
public record WindFieldResponse(Bounds bounds, int width, int height, Instant baseTime,
                                String source, boolean mock, boolean stale,
                                List<HourField> hours) {

    public record Bounds(double west, double south, double east, double north) {
    }

    public record HourField(Instant time, List<Double> u, List<Double> v,
                            double speedMin, double speedMax) {
    }

    public WindFieldResponse asStale() {
        return new WindFieldResponse(bounds, width, height, baseTime, source, mock, true, hours);
    }
}
```

- [ ] **Step 2: 실패하는 테스트 작성** — `WindFieldServiceTest.java`:

```java
package com.airvision.backend.publicdata.wind;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.kma.KmaRaw;
import com.airvision.backend.publicdata.kma.KmaWeatherClient;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class WindFieldServiceTest {

    private KmaWeatherClient client;
    private WindFieldService service;

    private static KmaRaw.Item fcstItem(String category, String fcstTime, String value) {
        return new KmaRaw.Item("20260718", "1330", category, 55, 124, null,
                "20260718", fcstTime, value);
    }

    @BeforeEach
    void setUp() {
        client = mock(KmaWeatherClient.class);
        when(client.isMock()).thenReturn(true);
        PublicDataProperties props = new PublicDataProperties("auto",
                new PublicDataProperties.Cache(1800, 86400, 3600, 1800, 1800),
                new PublicDataProperties.Comparison(5, 60));
        service = new WindFieldService(client, props,
                Clock.fixed(Instant.parse("2026-07-18T05:55:00Z"), ZoneId.of("UTC")));
    }

    @Test
    void UUU_VVV_성분으로_시간별_바람장을_만든다() {
        when(client.ultraFcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                fcstItem("UUU", "1500", "3.0"), fcstItem("VVV", "1500", "-1.0"),
                fcstItem("UUU", "1600", "2.0"), fcstItem("VVV", "1600", "0.5")));

        WindFieldResponse field = service.field();

        assertThat(field.width()).isEqualTo(25);
        assertThat(field.height()).isEqualTo(25);
        assertThat(field.hours()).hasSize(2);
        WindFieldResponse.HourField h0 = field.hours().get(0);
        assertThat(h0.u()).hasSize(25 * 25);
        // 전 격자점 동일 응답 → 균일 바람장: 모든 셀 u=3.0, v=-1.0
        assertThat(h0.u().get(0)).isCloseTo(3.0, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(h0.v().get(312)).isCloseTo(-1.0, org.assertj.core.data.Offset.offset(1e-6));
        double speed = Math.sqrt(3.0 * 3.0 + 1.0 * 1.0);
        assertThat(h0.speedMax()).isCloseTo(speed, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(field.bounds().west()).isEqualTo(WindGridPoints.WEST);
    }

    @Test
    void UUU_VVV가_없으면_VEC_WSD에서_변환한다() {
        // 서풍 2.0 m/s → u=+2.0, v=0
        when(client.ultraFcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                fcstItem("WSD", "1500", "2.0"), fcstItem("VEC", "1500", "270")));

        WindFieldResponse field = service.field();

        assertThat(field.hours()).hasSize(1);
        assertThat(field.hours().get(0).u().get(100))
                .isCloseTo(2.0, org.assertj.core.data.Offset.offset(1e-6));
        assertThat(field.hours().get(0).v().get(100))
                .isCloseTo(0.0, org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void 바람_카테고리가_전혀_없으면_hours가_비어있다() {
        when(client.ultraFcst(any(), anyInt(), anyInt())).thenReturn(List.of(
                fcstItem("T1H", "1500", "27.0")));

        assertThat(service.field().hours()).isEmpty();
    }
}
```

- [ ] **Step 3: 실패 확인**

Run: `cd backend && ./gradlew test --tests WindFieldServiceTest`
Expected: FAIL — `WindFieldService` 심볼 없음

- [ ] **Step 4: 구현** — 먼저 `KmaWeatherService.parseValue`의 접근자를 `static` → `public static`으로 변경. 그다음 `WindFieldService.java`:

```java
package com.airvision.backend.publicdata.wind;

import com.airvision.backend.common.KstTimes;
import com.airvision.backend.common.TtlCache;
import com.airvision.backend.interpolation.IdwInterpolator;
import com.airvision.backend.publicdata.PublicDataProperties;
import com.airvision.backend.publicdata.kma.KmaBaseTime;
import com.airvision.backend.publicdata.kma.KmaGridConverter;
import com.airvision.backend.publicdata.kma.KmaRaw;
import com.airvision.backend.publicdata.kma.KmaWeatherClient;
import com.airvision.backend.publicdata.kma.KmaWeatherService;
import com.airvision.backend.publicdata.kma.WindUtils;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.springframework.stereotype.Service;

/**
 * 인천권 KMA 격자점들의 초단기예보 바람(UUU/VVV)을 수집해
 * 25×25 정규 위경도 격자로 IDW 보간한 시간별 바람장을 만든다.
 */
@Service
public class WindFieldService {

    static final int WIDTH = 25;
    static final int HEIGHT = 25;
    static final double IDW_POWER = 2.0;

    private final KmaWeatherClient client;
    private final Clock clock;
    private final TtlCache<String, WindFieldResponse> cache;

    @org.springframework.beans.factory.annotation.Autowired
    public WindFieldService(KmaWeatherClient client, PublicDataProperties publicDataProps) {
        this(client, publicDataProps, Clock.systemUTC());
    }

    WindFieldService(KmaWeatherClient client, PublicDataProperties publicDataProps, Clock clock) {
        this.client = client;
        this.clock = clock;
        this.cache = new TtlCache<>(
                Duration.ofSeconds(publicDataProps.cache().weatherSeconds()), clock);
    }

    public WindFieldResponse field() {
        TtlCache.CachedValue<WindFieldResponse> cached = cache.get("field", this::load);
        return cached.stale() ? cached.value().asStale() : cached.value();
    }

    private WindFieldResponse load() {
        KmaBaseTime.BaseDateTime base = KmaBaseTime.forUltraFcst(clock);
        // KMA 격자(nx_ny)별 예보는 한 번만 조회하고, 샘플 지점마다 소속 격자의 시간별 (u,v)를 매핑
        Map<String, Map<Instant, double[]>> byGrid = new HashMap<>();
        // 시각 → 해당 시각에 값이 있는 샘플 지점들의 u/v IDW 소스
        Map<Instant, List<IdwInterpolator.SourcePoint>> uSources = new TreeMap<>();
        Map<Instant, List<IdwInterpolator.SourcePoint>> vSources = new TreeMap<>();

        for (WindGridPoints.Point p : WindGridPoints.POINTS) {
            KmaGridConverter.GridXY grid = KmaGridConverter.toGrid(p.latitude(), p.longitude());
            Map<Instant, double[]> hourly = byGrid.computeIfAbsent(
                    grid.nx() + "_" + grid.ny(), k -> fetchUv(base, grid));
            hourly.forEach((time, uv) -> {
                uSources.computeIfAbsent(time, t -> new ArrayList<>())
                        .add(new IdwInterpolator.SourcePoint(p.latitude(), p.longitude(), uv[0]));
                vSources.computeIfAbsent(time, t -> new ArrayList<>())
                        .add(new IdwInterpolator.SourcePoint(p.latitude(), p.longitude(), uv[1]));
            });
        }

        List<WindFieldResponse.HourField> hours = new ArrayList<>();
        for (Map.Entry<Instant, List<IdwInterpolator.SourcePoint>> entry : uSources.entrySet()) {
            if (hours.size() >= 6) {
                break;
            }
            Instant time = entry.getKey();
            hours.add(interpolateHour(time, entry.getValue(), vSources.get(time)));
        }

        return new WindFieldResponse(
                new WindFieldResponse.Bounds(WindGridPoints.WEST, WindGridPoints.SOUTH,
                        WindGridPoints.EAST, WindGridPoints.NORTH),
                WIDTH, HEIGHT,
                KstTimes.parseKmaDateTime(base.baseDate(), base.baseTime()),
                "KMA", client.isMock(), false, hours);
    }

    /** 격자점 1곳의 초단기예보를 시각별 (u, v)로 피벗. UUU/VVV 우선, 없으면 VEC/WSD 변환. */
    private Map<Instant, double[]> fetchUv(KmaBaseTime.BaseDateTime base,
                                           KmaGridConverter.GridXY grid) {
        List<KmaRaw.Item> items = client.ultraFcst(base, grid.nx(), grid.ny());
        Map<String, Map<String, String>> byTime = new LinkedHashMap<>();
        for (KmaRaw.Item item : items) {
            if (item.fcstDate() == null || item.fcstTime() == null || item.category() == null) {
                continue;
            }
            byTime.computeIfAbsent(item.fcstDate() + item.fcstTime(), k -> new HashMap<>())
                    .put(item.category(), item.fcstValue());
        }
        Map<Instant, double[]> result = new TreeMap<>();
        byTime.forEach((dateTime, categories) -> {
            Double u = KmaWeatherService.parseValue(categories.get("UUU"));
            Double v = KmaWeatherService.parseValue(categories.get("VVV"));
            if (u == null || v == null) {
                Double wsd = KmaWeatherService.parseValue(categories.get("WSD"));
                Double vec = KmaWeatherService.parseValue(categories.get("VEC"));
                if (wsd == null || vec == null) {
                    return; // 이 시각은 바람 정보 없음 → 제외
                }
                u = WindUtils.toU(wsd, vec);
                v = WindUtils.toV(wsd, vec);
            }
            Instant at = KstTimes.parseKmaDateTime(
                    dateTime.substring(0, 8), dateTime.substring(8));
            if (at != null) {
                result.put(at, new double[]{u, v});
            }
        });
        return result;
    }

    /** 샘플 지점 → 25×25 정규 격자 IDW 보간 (row 0 = 남쪽). */
    private static WindFieldResponse.HourField interpolateHour(
            Instant time, List<IdwInterpolator.SourcePoint> uSrc,
            List<IdwInterpolator.SourcePoint> vSrc) {
        List<Double> u = new ArrayList<>(WIDTH * HEIGHT);
        List<Double> v = new ArrayList<>(WIDTH * HEIGHT);
        double speedMin = Double.MAX_VALUE;
        double speedMax = 0;
        for (int row = 0; row < HEIGHT; row++) {
            double lat = WindGridPoints.SOUTH
                    + (row + 0.5) * (WindGridPoints.NORTH - WindGridPoints.SOUTH) / HEIGHT;
            for (int col = 0; col < WIDTH; col++) {
                double lon = WindGridPoints.WEST
                        + (col + 0.5) * (WindGridPoints.EAST - WindGridPoints.WEST) / WIDTH;
                double cu = IdwInterpolator.interpolate(uSrc, lat, lon, IDW_POWER);
                double cv = IdwInterpolator.interpolate(vSrc, lat, lon, IDW_POWER);
                u.add(cu);
                v.add(cv);
                double speed = Math.hypot(cu, cv);
                speedMin = Math.min(speedMin, speed);
                speedMax = Math.max(speedMax, speed);
            }
        }
        return new WindFieldResponse.HourField(time, u, v,
                speedMin == Double.MAX_VALUE ? 0 : speedMin, speedMax);
    }
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd backend && ./gradlew test --tests WindFieldServiceTest --tests KmaWeatherServiceTest`
Expected: PASS (parseValue 접근자 변경이 기존 테스트를 깨지 않는지 함께 확인)

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/wind backend/src/main/java/com/airvision/backend/publicdata/kma/KmaWeatherService.java backend/src/test/java/com/airvision/backend/publicdata/wind
git commit -m "인천권 바람장 수집·IDW 보간 서비스 (Phase 28)"
```

---

### Task 3: PM2.5 이류 예측 서비스 (AdvectionService)

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/publicdata/wind/dto/AdvectionResponse.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/wind/AdvectionService.java`
- Test: `backend/src/test/java/com/airvision/backend/publicdata/wind/AdvectionServiceTest.java`

**Interfaces:**
- Consumes: `WindFieldService.field(): WindFieldResponse` (Task 2), `AirKoreaService.current(String sido): CurrentAirQualityResponse` (기존 — `stations()` 각각 `locationAvailable()/latitude()/longitude()/pm25().valid()/pm25().value()` 보유), `IdwInterpolator`
- Produces: `AdvectionService.advect(int hours): AdvectionResponse` — Task 4가 사용.
  - `AdvectionResponse(WindFieldResponse.Bounds bounds, int width, int height, String model, boolean mock, List<Frame> frames)`
  - `Frame(Instant time, List<Double> pm25)` — row 0=남쪽 row-major
  - 핵심 수치 로직 `advectStep(double[] field, List<Double> u, List<Double> v, int width, int height, WindFieldResponse.Bounds bounds): double[]`는 package-private static으로 두고 직접 단위 테스트한다.

- [ ] **Step 1: DTO 작성** — `dto/AdvectionResponse.java`:

```java
package com.airvision.backend.publicdata.wind.dto;

import java.time.Instant;
import java.util.List;

/** 단순 이류(advection-only) PM2.5 예측. pm25는 row 0=남쪽 row-major 배열. */
public record AdvectionResponse(WindFieldResponse.Bounds bounds, int width, int height,
                                String model, boolean mock, List<Frame> frames) {

    public record Frame(Instant time, List<Double> pm25) {
    }
}
```

- [ ] **Step 2: 실패하는 테스트 작성** — `AdvectionServiceTest.java`:

```java
package com.airvision.backend.publicdata.wind;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;

class AdvectionServiceTest {

    /** 5×5, 경도 1도 폭 격자. 셀 폭 ≈ 17.7km, u=5m/s(동진)면 1시간에 약 1셀 이동. */
    private static final WindFieldResponse.Bounds BOUNDS =
            new WindFieldResponse.Bounds(126.0, 37.0, 127.0, 38.0);

    @Test
    void 서풍장에서_농도_피크가_동쪽으로_이동한다() {
        int w = 5;
        int h = 5;
        double[] field = new double[w * h];
        field[2 * w + 2] = 100.0; // 중앙(row2, col2) 피크
        List<Double> u = Collections.nCopies(w * h, 5.0); // 서풍(동쪽으로 이동)
        List<Double> v = Collections.nCopies(w * h, 0.0);

        double[] next = AdvectionService.advectStep(field, u, v, w, h, BOUNDS);

        // 피크가 col3 쪽으로 이동: (2,3)이 커지고 (2,1)은 거의 0
        assertThat(next[2 * w + 3]).isGreaterThan(50.0);
        assertThat(next[2 * w + 1]).isLessThan(5.0);
    }

    @Test
    void 무풍이면_농도장이_유지된다() {
        int w = 5;
        int h = 5;
        double[] field = new double[w * h];
        field[12] = 42.0;
        List<Double> zero = Collections.nCopies(w * h, 0.0);

        double[] next = AdvectionService.advectStep(field, zero, zero, w, h, BOUNDS);

        assertThat(next[12]).isCloseTo(42.0, org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void 도메인_밖_역추적은_경계값으로_클램프된다() {
        int w = 5;
        int h = 5;
        double[] field = new double[w * h];
        for (int col = 0; col < w; col++) {
            field[0 * w + col] = 10.0; // 남쪽 경계 행만 10
        }
        // 강한 북진(v=+50m/s): 남쪽 밖에서 유입 → 남쪽 경계값 유지
        List<Double> u = Collections.nCopies(w * h, 0.0);
        List<Double> v = Collections.nCopies(w * h, 50.0);

        double[] next = AdvectionService.advectStep(field, u, v, w, h, BOUNDS);

        assertThat(next[0 * w + 2]).isCloseTo(10.0, org.assertj.core.data.Offset.offset(1e-6));
    }

    @Test
    void hours_범위를_검증한다() {
        AdvectionService service = new AdvectionService(null, null);
        assertThatThrownBy(() -> service.advect(0)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.advect(7)).isInstanceOf(IllegalArgumentException.class);
    }
}
```

- [ ] **Step 3: 실패 확인**

Run: `cd backend && ./gradlew test --tests AdvectionServiceTest`
Expected: FAIL — `AdvectionService` 심볼 없음

- [ ] **Step 4: 구현** — `AdvectionService.java`:

```java
package com.airvision.backend.publicdata.wind;

import com.airvision.backend.interpolation.IdwInterpolator;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.wind.dto.AdvectionResponse;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 현재 PM2.5 분포(AirKorea 실측 IDW)를 바람장으로 이동시키는 semi-Lagrangian 이류 예측.
 * 확산·배출·침적은 포함하지 않는 순수 이류(advection-only) 모델이다.
 * 도메인이 작아 강풍 시 경계 유입값(clamp)이 수 시간 내 지배하는 한계가 있다.
 */
@Service
public class AdvectionService {

    static final String MODEL = "advection-only";
    static final double IDW_POWER = 2.0;
    static final double M_PER_DEG_LAT = 111_320.0;
    static final double STEP_SECONDS = 3600.0;

    private final WindFieldService windFieldService;
    private final AirKoreaService airKoreaService;

    public AdvectionService(WindFieldService windFieldService, AirKoreaService airKoreaService) {
        this.windFieldService = windFieldService;
        this.airKoreaService = airKoreaService;
    }

    public AdvectionResponse advect(int hours) {
        if (hours < 1 || hours > 6) {
            throw new IllegalArgumentException("hours는 1~6 범위여야 합니다");
        }
        WindFieldResponse wind = windFieldService.field();
        if (wind.hours().isEmpty()) {
            throw new IllegalStateException("바람 예보가 없어 이동 예측을 할 수 없습니다");
        }
        CurrentAirQualityResponse current = airKoreaService.current("인천");
        List<IdwInterpolator.SourcePoint> sources = new ArrayList<>();
        for (StationAirQuality s : current.stations()) {
            if (s.locationAvailable() && s.latitude() != null && s.longitude() != null
                    && s.pm25() != null && s.pm25().valid() && s.pm25().value() != null) {
                sources.add(new IdwInterpolator.SourcePoint(
                        s.latitude(), s.longitude(), s.pm25().value()));
            }
        }
        if (sources.isEmpty()) {
            throw new IllegalStateException("유효한 실측 측정소가 없어 이동 예측을 할 수 없습니다");
        }

        int w = wind.width();
        int h = wind.height();
        WindFieldResponse.Bounds b = wind.bounds();
        double[] field = new double[w * h];
        for (int row = 0; row < h; row++) {
            double lat = b.south() + (row + 0.5) * (b.north() - b.south()) / h;
            for (int col = 0; col < w; col++) {
                double lon = b.west() + (col + 0.5) * (b.east() - b.west()) / w;
                field[row * w + col] = IdwInterpolator.interpolate(sources, lat, lon, IDW_POWER);
            }
        }

        List<AdvectionResponse.Frame> frames = new ArrayList<>();
        for (int step = 1; step <= hours; step++) {
            WindFieldResponse.HourField hour =
                    wind.hours().get(Math.min(step - 1, wind.hours().size() - 1));
            field = advectStep(field, hour.u(), hour.v(), w, h, b);
            List<Double> rounded = new ArrayList<>(field.length);
            for (double value : field) {
                rounded.add(Math.round(value * 10.0) / 10.0);
            }
            frames.add(new AdvectionResponse.Frame(hour.time(), rounded));
        }
        return new AdvectionResponse(b, w, h, MODEL,
                wind.mock() || current.mock(), frames);
    }

    /** 1시간 semi-Lagrangian 역추적: 각 셀에서 바람을 거슬러 출발점 농도를 bilinear 샘플링. */
    static double[] advectStep(double[] field, List<Double> u, List<Double> v,
                               int width, int height, WindFieldResponse.Bounds bounds) {
        double[] next = new double[width * height];
        for (int row = 0; row < height; row++) {
            double lat = bounds.south() + (row + 0.5) * (bounds.north() - bounds.south()) / height;
            for (int col = 0; col < width; col++) {
                double lon = bounds.west() + (col + 0.5) * (bounds.east() - bounds.west()) / width;
                int idx = row * width + col;
                double mPerDegLon = M_PER_DEG_LAT * Math.cos(Math.toRadians(lat));
                double depLat = lat - v.get(idx) * STEP_SECONDS / M_PER_DEG_LAT;
                double depLon = lon - u.get(idx) * STEP_SECONDS / mPerDegLon;
                next[idx] = bilinear(field, width, height, bounds, depLat, depLon);
            }
        }
        return next;
    }

    /** 격자 밖 좌표는 경계 셀로 클램프한 bilinear 샘플링. */
    static double bilinear(double[] field, int width, int height,
                           WindFieldResponse.Bounds bounds, double lat, double lon) {
        double x = (lon - bounds.west()) / (bounds.east() - bounds.west()) * width - 0.5;
        double y = (lat - bounds.south()) / (bounds.north() - bounds.south()) * height - 0.5;
        x = Math.min(Math.max(x, 0), width - 1);
        y = Math.min(Math.max(y, 0), height - 1);
        int x0 = (int) Math.floor(x);
        int y0 = (int) Math.floor(y);
        int x1 = Math.min(x0 + 1, width - 1);
        int y1 = Math.min(y0 + 1, height - 1);
        double fx = x - x0;
        double fy = y - y0;
        return field[y0 * width + x0] * (1 - fx) * (1 - fy)
                + field[y0 * width + x1] * fx * (1 - fy)
                + field[y1 * width + x0] * (1 - fx) * fy
                + field[y1 * width + x1] * fx * fy;
    }
}
```

- [ ] **Step 5: 통과 확인**

Run: `cd backend && ./gradlew test --tests AdvectionServiceTest`
Expected: PASS (4개 테스트)

- [ ] **Step 6: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/wind backend/src/test/java/com/airvision/backend/publicdata/wind
git commit -m "semi-Lagrangian PM2.5 이류 예측 서비스 (Phase 28)"
```

---

### Task 4: Wind API 컨트롤러 + 백엔드 전체 검증

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/publicdata/wind/WindController.java`

**Interfaces:**
- Consumes: `WindFieldService.field()`, `AdvectionService.advect(int)` (Task 2, 3)
- Produces: `GET /api/wind/field` → `ApiResponse<WindFieldResponse>`, `GET /api/wind/advection?hours=6` → `ApiResponse<AdvectionResponse>`. 인증은 기존 SecurityConfig 규칙(GET /api/** → USER/ADMIN)을 그대로 따르므로 추가 설정 불필요. `IllegalArgumentException/IllegalStateException`은 기존 `GlobalExceptionHandler`가 400으로 변환.

- [ ] **Step 1: 컨트롤러 작성**

```java
package com.airvision.backend.publicdata.wind;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.wind.dto.AdvectionResponse;
import com.airvision.backend.publicdata.wind.dto.WindFieldResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 바람장·이류 예측 API (출처: 기상청 초단기예보 + AirKorea 실측). */
@Tag(name = "Wind", description = "인천권 바람장과 PM2.5 이동 예측 API")
@RestController
@RequestMapping("/api/wind")
public class WindController {

    private final WindFieldService windFieldService;
    private final AdvectionService advectionService;

    public WindController(WindFieldService windFieldService, AdvectionService advectionService) {
        this.windFieldService = windFieldService;
        this.advectionService = advectionService;
    }

    @Operation(summary = "인천권 시간별 바람장 (25×25 격자, 최대 +6시간)")
    @GetMapping("/field")
    public ApiResponse<WindFieldResponse> field() {
        return ApiResponse.ok(windFieldService.field());
    }

    @Operation(summary = "PM2.5 단순 이류 예측 (advection-only, 1~6시간)")
    @GetMapping("/advection")
    public ApiResponse<AdvectionResponse> advection(
            @RequestParam(defaultValue = "6") int hours) {
        return ApiResponse.ok(advectionService.advect(hours));
    }
}
```

- [ ] **Step 2: 백엔드 전체 빌드·테스트**

Run: `cd backend && ./gradlew build`
Expected: BUILD SUCCESSFUL, 전체 테스트 통과

- [ ] **Step 3: Mock 모드 스모크 확인** — 백엔드를 띄우고(원격 PostgreSQL 연결 필요) 로그인 토큰으로 두 API를 호출:

```bash
cd backend && ./gradlew bootRun   # 별도 터미널
TOKEN=$(curl -s -X POST http://localhost:8080/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"admin1234"}' | python -c "import json,sys; print(json.load(sys.stdin)['data']['token'])")
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/wind/field" | head -c 400
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8080/api/wind/advection?hours=6" | head -c 400
```

Expected: 두 응답 모두 `"success":true`, hours/frames 배열 존재. (계정 정보가 다르면 `.env`/시드 계정을 따른다. DB 미기동 등으로 실행이 불가하면 사유를 기록하고 다음 태스크로 진행.)

- [ ] **Step 4: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/wind/WindController.java
git commit -m "바람장·이류 예측 API 엔드포인트 (Phase 28)"
```

---

### Task 5: 프론트 — cesium-wind-layer 파티클 레이어

**Files:**
- Modify: `frontend/package.json` (cesium-wind-layer 설치)
- Modify: `frontend/src/api/client.ts` (타입 추가)
- Modify: `frontend/src/config/mapConfig.ts` (마커색·파티클 옵션)
- Modify: `frontend/src/pages/MapPage.tsx`

**Interfaces:**
- Consumes: `GET /wind/field` (Task 4). `cesium-wind-layer`의 `WindLayer(viewer, data, options)`, `updateWindData(data)`, `show` 속성, `destroy()`. `WindData = { u: {array: Float32Array}, v: {array: Float32Array}, width, height, bounds: {west, south, east, north} }`
- Produces: `LayerKey`에 `'wind' | 'advection'` 추가(advection 렌더링은 Task 6), 상태 `windField/advection/hourOffset`, 로더 `loadWind()` — Task 6이 사용.

- [ ] **Step 1: 라이브러리 설치**

Run: `cd frontend && npm install cesium-wind-layer@^0.10.1`
Expected: package.json dependencies에 추가, 설치 성공

- [ ] **Step 2: API 타입 추가** — `frontend/src/api/client.ts`의 `IdwGridResponse` 인터페이스 뒤에:

```ts
export interface WindFieldHour {
  time: string
  u: number[]
  v: number[]
  speedMin: number
  speedMax: number
}

export interface WindFieldResponse {
  bounds: { west: number; south: number; east: number; north: number }
  width: number
  height: number
  baseTime: string | null
  source: string
  mock: boolean
  stale: boolean
  hours: WindFieldHour[]
}

export interface AdvectionFrame {
  time: string
  pm25: number[]
}

export interface AdvectionResponse {
  bounds: { west: number; south: number; east: number; north: number }
  width: number
  height: number
  model: string
  mock: boolean
  frames: AdvectionFrame[]
}
```

- [ ] **Step 3: mapConfig 확장** — `markers`에 두 색상 추가, 파일 끝 `windArrow` 항목 뒤에 `windLayer` 추가:

```ts
  markers: {
    observation: '#2563eb',
    prediction: '#f97316',
    interpolation: '#8b5cf6',
    airkorea: '#0ea5e9',
    idwSurface: '#14b8a6',
    alertRegion: '#dc2626',
    odor: '#a16207',
    wind: '#06b6d4',
    advection: '#64748b',
  },
```

```ts
  /** 바람길 파티클 애니메이션 (cesium-wind-layer) */
  windLayer: {
    /** 파티클 수 = size² (100 → 10,000개) */
    particlesTextureSize: 100,
    /** 파티클 표시 고도 (m) */
    particleHeight: 120,
    speedFactor: 0.5,
    lineWidth: { min: 1, max: 2.5 },
    lineLength: { min: 30, max: 120 },
    dropRate: 0.003,
    dropRateBump: 0.001,
    /** 풍속 저→고 색상 램프 (Windy 스타일) */
    colors: ['#3b82f6', '#22d3ee', '#4ade80', '#facc15', '#fb923c', '#ef4444'],
  },
```

- [ ] **Step 4: MapPage에 wind 레이어 통합** — `frontend/src/pages/MapPage.tsx` 수정:

(a) import 추가 (파일 상단):

```ts
import { WindLayer } from 'cesium-wind-layer'
import type { WindData } from 'cesium-wind-layer'
```

타입 import 목록(`AirAlert, ApiResponse, ...`)에 `AdvectionResponse`, `WindFieldResponse` 추가.

(b) `LayerKey`/`LAYER_LABELS` 확장 (L55~67):

```ts
type LayerKey =
  | 'observation' | 'prediction' | 'interpolation' | 'airkorea' | 'idwSurface' | 'alertRegion'
  | 'odor' | 'wind' | 'advection'

const LAYER_LABELS: Record<LayerKey, string> = {
  observation: '관측값',
  prediction: 'AI 예측값',
  interpolation: 'IDW 보간값',
  airkorea: '공공 대기질',
  idwSurface: '실측 IDW 표면',
  alertRegion: '경보 권역',
  odor: '악취 측정(인천)',
  wind: '바람길 (기상청 예보)',
  advection: 'PM2.5 이동 예측',
}
```

(c) 모듈 레벨 헬퍼 추가 (`addIdwSurface` 함수 뒤):

```ts
/** 백엔드 바람장 시각 1개 → cesium-wind-layer 입력 형식 */
function toWindData(field: WindFieldResponse, hourIndex: number): WindData {
  const h = field.hours[hourIndex]
  return {
    u: { array: new Float32Array(h.u), min: Math.min(...h.u), max: Math.max(...h.u) },
    v: { array: new Float32Array(h.v), min: Math.min(...h.v), max: Math.max(...h.v) },
    width: field.width,
    height: field.height,
    bounds: field.bounds,
  }
}
```

(d) 컴포넌트 내부 상태·ref 추가 (`const [weather, setWeather] = ...` 부근):

```ts
const windLayerRef = useRef<WindLayer | null>(null)
const [windField, setWindField] = useState<WindFieldResponse | null>(null)
const [advection, setAdvection] = useState<AdvectionResponse | null>(null)
/** 0 = +1시간 예보 … 5 = +6시간 예보 */
const [hourOffset, setHourOffset] = useState(0)
```

(e) 로더 추가 (`loadOdor` 함수 뒤). 바람장과 이류 예측을 개별 catch로 분리해 한쪽 실패가 다른 쪽을 막지 않게 한다:

```ts
/** 바람장 + 이류 예측 로드 (인천권 고정, 실패해도 다른 레이어 무영향) */
const loadWind = async () => {
  try {
    const res = await apiClient.get<ApiResponse<WindFieldResponse>>('/wind/field')
    setWindField(res.data.data.hours.length > 0 ? res.data.data : null)
  } catch {
    setWindField(null)
  }
  try {
    const res = await apiClient.get<ApiResponse<AdvectionResponse>>('/wind/advection?hours=6')
    setAdvection(res.data.data)
  } catch {
    setAdvection(null)
  }
}
```

(f) Viewer 생성 effect(L892 부근)의 `loadOdor()` 호출 뒤에 `loadWind()` 추가. 같은 effect의 `dataSources` Record(L852~860)에 두 항목 추가:

```ts
      wind: new Cesium.CustomDataSource('wind'),
      advection: new Cesium.CustomDataSource('advection'),
```

(`wind` 데이터소스는 Record<LayerKey, …> 타입을 만족시키기 위한 자리로 엔티티는 넣지 않는다 — 파티클은 WindLayer가 직접 그린다.)
같은 effect의 cleanup(L897~902)에서 `viewer.destroy()` 전에:

```ts
      windLayerRef.current = null // viewer.destroy()가 프리미티브를 함께 정리한다
```

(g) `layers` 초기 상태(L570~578)에 `wind: true, advection: true` 추가. 레이어 표시/숨김 effect(L907~913)에 WindLayer 동기화 추가:

```ts
  // 레이어 표시/숨김
  useEffect(() => {
    const ds = dataSourcesRef.current
    if (!ds) return
    ;(Object.keys(layers) as LayerKey[]).forEach((key) => {
      ds[key].show = layers[key]
    })
    if (windLayerRef.current) windLayerRef.current.show = layers.wind
  }, [layers])
```

(h) WindLayer 생성·갱신 effect 추가 (레이어 표시/숨김 effect 뒤):

```ts
  // 바람길 파티클 레이어: 데이터 로드 시 생성, 시간 변경 시 데이터 교체
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !windField) return
    const data = toWindData(windField, Math.min(hourOffset, windField.hours.length - 1))
    if (!windLayerRef.current) {
      // as const로 readonly가 된 colors를 mutable 배열로 복사해 전달
      const layer = new WindLayer(viewer, data,
        { ...MAP_CONFIG.windLayer, colors: [...MAP_CONFIG.windLayer.colors] })
      layer.show = layers.wind
      windLayerRef.current = layer
    } else {
      windLayerRef.current.updateWindData(data)
    }
    // layers.wind는 (g)의 표시/숨김 effect가 관리 — 여기 의존성에 넣지 않는다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windField, hourOffset])
```

- [ ] **Step 5: 타입 검사 + 빌드**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: 오류 없음. (`WindData`의 `min/max`가 optional이 아니거나 옵션 타입이 다르면 `node_modules/cesium-wind-layer/dist/index.d.ts`를 열어 실제 타입에 맞춰 조정하고 조정 내용을 기록한다.)

- [ ] **Step 6: 기존 프론트 테스트 확인**

Run: `cd frontend && npx vitest run`
Expected: 기존 테스트 전부 통과 (MapPage 직접 테스트는 없음)

- [ ] **Step 7: 커밋**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api/client.ts frontend/src/config/mapConfig.ts frontend/src/pages/MapPage.tsx
git commit -m "Windy 스타일 바람길 파티클 레이어 (Phase 28)"
```

---

### Task 6: 프론트 — 이류 예측 레이어 + 시간 슬라이더

**Files:**
- Modify: `frontend/src/pages/MapPage.tsx`

**Interfaces:**
- Consumes: Task 5의 `advection`/`hourOffset` 상태, `dataSourcesRef.current.advection`, `gradeOf` (기존 import)
- Produces: 사용자 기능 — 이류 예측 셀 표면 + "+1h~+6h" 슬라이더 + "단순 이류 추정" 배지

- [ ] **Step 1: 이류 프레임 렌더 함수 추가** — 모듈 레벨, `toWindData` 뒤:

```ts
/** 이류 예측 프레임 1개를 셀 타일링으로 렌더 (addIdwSurface와 동일한 표현 방식) */
function addAdvectionFrame(ds: Cesium.CustomDataSource, resp: AdvectionResponse,
                           frameIndex: number) {
  ds.entities.removeAll()
  const frame = resp.frames[Math.min(frameIndex, resp.frames.length - 1)]
  if (!frame) return
  const cellLatDeg = (resp.bounds.north - resp.bounds.south) / resp.height
  const cellLonDeg = (resp.bounds.east - resp.bounds.west) / resp.width
  const mPerDegLat = 111_320
  const timeText = new Date(frame.time).toLocaleString('ko-KR')
  for (let row = 0; row < resp.height; row++) {
    const lat = resp.bounds.south + (row + 0.5) * cellLatDeg
    const mPerDegLon = 111_320 * Math.cos((lat * Math.PI) / 180)
    for (let col = 0; col < resp.width; col++) {
      const pm25 = frame.pm25[row * resp.width + col]
      const lon = resp.bounds.west + (col + 0.5) * cellLonDeg
      ds.entities.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 40),
        box: {
          dimensions: new Cesium.Cartesian3(
            cellLonDeg * mPerDegLon, cellLatDeg * mPerDegLat, 60),
          material: pm25Color(pm25, 0.4),
        },
        name: 'PM2.5 이동 예측',
        description: `<table class="cesium-infoBox-defaultTable"><tbody>
          <tr><th>예측 PM2.5</th><td><b>${pm25.toFixed(1)}</b> ㎍/㎥ (${gradeOf(pm25).name})</td></tr>
          <tr><th>예측 시각</th><td>${timeText}</td></tr>
          <tr><th>방식</th><td>단순 이류 추정 (바람 이동만 반영, 확산·배출 미포함)</td></tr>
          </tbody></table>`,
      })
    }
  }
}
```

- [ ] **Step 2: 렌더 effect 추가** — Task 5-(h)의 WindLayer effect 뒤:

```ts
  // 이류 예측 표면: 데이터 로드·시간 변경 시 해당 프레임 재렌더
  useEffect(() => {
    const ds = dataSourcesRef.current
    if (!ds) return
    if (!advection) {
      ds.advection.entities.removeAll()
      return
    }
    addAdvectionFrame(ds.advection, advection, hourOffset)
  }, [advection, hourOffset])
```

- [ ] **Step 3: 시간 슬라이더 UI 추가** — JSX에서 "시계열 컨트롤" div(L1404 `{/* 시계열 컨트롤 */}`) 바로 위에:

```tsx
      {/* 바람·이동 예측 시간 컨트롤 */}
      {windField && (layers.wind || layers.advection) && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm">
          <span className="font-medium text-gray-700">바람·이동 예측</span>
          <input
            type="range"
            min={0}
            max={windField.hours.length - 1}
            value={Math.min(hourOffset, windField.hours.length - 1)}
            onChange={(e) => setHourOffset(Number(e.target.value))}
            className="w-40"
          />
          <span className="text-gray-700">
            +{Math.min(hourOffset, windField.hours.length - 1) + 1}시간 (
            {new Date(windField.hours[
              Math.min(hourOffset, windField.hours.length - 1)].time)
              .toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })} 예보)
          </span>
          {layers.advection && advection && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700"
              title="바람에 의한 이동만 반영한 추정입니다. 확산·배출·침적은 포함하지 않습니다.">
              단순 이류 추정
            </span>
          )}
          {windField.mock && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
              Mock 바람 데이터 (균일 바람장)
            </span>
          )}
          <span className="text-xs text-gray-400">
            기상청 초단기예보 기반 · 인천권 격자 {windField.width}×{windField.height}
          </span>
        </div>
      )}
```

- [ ] **Step 4: 타입 검사 + 빌드 + 화면 확인**

Run: `cd frontend && npx tsc -b && npm run build`
Expected: 오류 없음

이어서 실제 화면 검증 (백엔드 기동 상태에서):

Run: `cd frontend && npm run dev`
확인 항목: (1) 지도에 파티클 애니메이션이 흐르는지, (2) 바람길·이동 예측 체크박스 on/off, (3) 슬라이더로 +1h~+6h 이동 시 이류 표면·파티클이 갱신되는지, (4) 파티클 이동 방향이 상단 상태줄의 풍향 텍스트와 일치하는지 (불일치하면 `flipY: true`를 windLayer 옵션에 추가해 재확인), (5) 콘솔 오류 없음.

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/pages/MapPage.tsx
git commit -m "PM2.5 이동 예측 레이어와 시간 슬라이더 (Phase 28)"
```

---

### Task 7: 문서 갱신 + 최종 검증

**Files:**
- Modify: `docs/progress.md` (Phase 28 절 추가)
- Modify: `docs/user-guide.html` (지도 사용법 절 + 업데이트 이력 표)

**Interfaces:**
- Consumes: Task 1~6의 실제 검증 결과 (실행하지 못한 항목은 사유와 함께 COMPLETED로, 직접 실행·확인한 항목만 VERIFIED로 기록)

- [ ] **Step 1: progress.md 갱신** — 기존 Phase 27 절 형식을 따라 Phase 28 절을 추가한다. 포함 내용: 바람장 API·이류 예측 API·파티클 레이어·시간 슬라이더 각각의 상태(VERIFIED는 실제 실행 확인한 것만), 알려진 한계(도메인 크기 대비 강풍 시 경계 유입 지배, Mock은 균일 바람장, 이류 초기장은 AirKorea 인천 실측 IDW), 실키 스모크 결과.

- [ ] **Step 2: user-guide.html 갱신** — 3D 지도 절에 "바람길·PM2.5 이동 예측" 사용법(레이어 체크박스 2종, 시간 슬라이더, 단순 이류 추정의 의미) 추가, 하단 "업데이트 이력" 표에 2026-07-24 행 추가.

- [ ] **Step 3: 전체 회귀 확인**

Run: `cd backend && ./gradlew build`
Run: `cd frontend && npx tsc -b && npm run build && npx vitest run`
Expected: 모두 성공

- [ ] **Step 4: 실키 스모크 (가능한 경우)** — `.env`에 실제 `KMA_SERVICE_KEY`가 있으면 `PUBLIC_DATA_MOCK_ENABLED` 미설정 상태로 백엔드를 띄워 `/api/wind/field` 응답의 `"mock":false`와 시간별 u/v가 실제로 변하는지 확인한다. 키가 없으면 사유를 progress.md에 기록.

- [ ] **Step 5: 커밋**

```bash
git add docs/progress.md docs/user-guide.html
git commit -m "바람길·이류 예측 문서화 및 검증 기록 (Phase 28)"
```
