# 공공 실측 기반 IDW 격자 표면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** AirKorea 실시간 실측을 소스로 시도 영역을 N×N IDW 보간해 "현재" PM2.5 표면을 만들고 3D 지도에 색상 면 레이어로 표시한다.

**Architecture:** 기존 `IdwInterpolator`·`AirKoreaService.current()`·`GradeProperties` 재사용. 저장 없이 즉석 계산(GET). 신규 테이블·마이그레이션 없음.

**Tech Stack:** Spring Boot 4.1/Java 21, React 19 + CesiumJS, JUnit5+Mockito+AssertJ.

**설계:** `docs/superpowers/specs/2026-07-19-public-idw-grid-surface-design.md`

## Global Constraints

- 패키지: `com.airvision.backend.publicdata.interpolation` (+ `.dto`).
- `ApiResponse<T>` 직접 반환, `@Tag`/`@Operation`. GET이라 보안 자동(USER/ADMIN). SecurityConfig 무수정.
- `IdwInterpolator`(`com.airvision.backend.interpolation`)와 `GradeProperties`(`com.airvision.backend.dashboard`)는 변경 없이 재사용.
- power 기본 2.0(0.1~10), resolution 기본 12(2~20). 범위 밖 → `IllegalArgumentException`(→400). 유효 소스 0곳 → `IllegalStateException`(→400, 기존 GlobalExceptionHandler가 처리).
- 소스 필터: `locationAvailable && latitude!=null && longitude!=null && pm25.valid && pm25.value!=null`.
- 기존 119개 백엔드 테스트 회귀 없음. 프론트 `npm run build`+`oxlint` 통과.

---

### Task 1: 백엔드 PublicIdwService + DTO + 컨트롤러 (TDD)

**Files:**
- Create: `backend/src/main/java/com/airvision/backend/publicdata/interpolation/dto/IdwGridCell.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/interpolation/dto/IdwGridResponse.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/interpolation/PublicIdwService.java`
- Create: `backend/src/main/java/com/airvision/backend/publicdata/interpolation/PublicIdwController.java`
- Test: `backend/src/test/java/com/airvision/backend/publicdata/interpolation/PublicIdwServiceTest.java`
- Test: `backend/src/test/java/com/airvision/backend/publicdata/interpolation/PublicIdwControllerTest.java`

**Interfaces:**
- Consumes: `AirKoreaService.current(sido)`→`CurrentAirQualityResponse`(`.sido()`,`.mock()`,`.stale()`,`.stations()`→`List<StationAirQuality>`); `StationAirQuality`(`stationName,sidoName,latitude,longitude,locationAvailable,measuredAt,pm10..khai`); `PollutantValue`(`value,unit,grade,valid,status`); `IdwInterpolator.interpolate(List<SourcePoint>,lat,lon,power)` + `SourcePoint(lat,lon,value)`; `GradeProperties.gradeOf(double)`.
- Produces: `PublicIdwService.grid(String sido, Double power, Integer resolution)`→`IdwGridResponse`; `GET /api/air-quality/interpolation/grid`.

- [ ] **Step 1: DTO 2종 작성**

`IdwGridCell.java`:
```java
package com.airvision.backend.publicdata.interpolation.dto;

public record IdwGridCell(double latitude, double longitude, double pm25, String grade) {
}
```

`IdwGridResponse.java`:
```java
package com.airvision.backend.publicdata.interpolation.dto;

import java.util.List;

public record IdwGridResponse(String sido, double power, int resolution, String source,
                              boolean mock, boolean stale, int sourceCount,
                              Bbox bbox, List<IdwGridCell> cells) {

    public record Bbox(double minLatitude, double minLongitude,
                       double maxLatitude, double maxLongitude) {
    }
}
```

- [ ] **Step 2: 실패 테스트 작성 (`PublicIdwServiceTest`)**

```java
package com.airvision.backend.publicdata.interpolation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.PollutantValue;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridResponse;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class PublicIdwServiceTest {

    private AirKoreaService airKoreaService;
    private PublicIdwService service;

    private static PollutantValue pm25(Double value, boolean valid) {
        return new PollutantValue(value, "µg/m³", valid ? "보통" : null, valid,
                valid ? "NORMAL" : "NO_DATA");
    }

    private static StationAirQuality station(String name, Double lat, Double lon,
                                             boolean locAvail, Double pm25Value, boolean valid) {
        PollutantValue v = pm25(pm25Value, valid);
        return new StationAirQuality(name, "인천", lat, lon, locAvail, Instant.now(),
                v, v, v, v, v, v, v);
    }

    private void givenStations(StationAirQuality... stations) {
        when(airKoreaService.current(any())).thenReturn(new CurrentAirQualityResponse(
                "인천", "AIRKOREA", true, false, Instant.now(), null, List.of(stations)));
    }

    @BeforeEach
    void setUp() {
        airKoreaService = mock(AirKoreaService.class);
        GradeProperties grades = new GradeProperties(List.of(
                new GradeProperties.Grade("좋음", 15.0),
                new GradeProperties.Grade("보통", 35.0),
                new GradeProperties.Grade("나쁨", 75.0),
                new GradeProperties.Grade("매우나쁨", null)));
        service = new PublicIdwService(airKoreaService, grades);
    }

    @Test
    void 격자는_resolution_제곱개_셀을_만들고_소스수를_보고한다() {
        givenStations(
                station("송도", 37.38, 126.65, true, 12.0, true),
                station("부평", 37.50, 126.72, true, 40.0, true),
                station("검단", 37.60, 126.68, true, 25.0, true));

        IdwGridResponse res = service.grid("인천", 2.0, 10);

        assertThat(res.resolution()).isEqualTo(10);
        assertThat(res.cells()).hasSize(100);
        assertThat(res.sourceCount()).isEqualTo(3);
        assertThat(res.source()).isEqualTo("AIRKOREA");
        // 모든 셀이 bbox 안에 있다
        assertThat(res.cells()).allSatisfy(c -> {
            assertThat(c.latitude()).isBetween(res.bbox().minLatitude(), res.bbox().maxLatitude());
            assertThat(c.longitude()).isBetween(res.bbox().minLongitude(), res.bbox().maxLongitude());
        });
    }

    @Test
    void 무좌표_및_무효_pm25_측정소는_소스에서_제외한다() {
        givenStations(
                station("정상", 37.4, 126.7, true, 20.0, true),
                station("좌표없음", null, null, false, 30.0, true),
                station("통신장애", 37.5, 126.7, true, null, false));

        IdwGridResponse res = service.grid("인천", 2.0, 8);

        assertThat(res.sourceCount()).isEqualTo(1);
    }

    @Test
    void 유효_소스가_없으면_예외다() {
        givenStations(station("통신장애", 37.5, 126.7, true, null, false));

        assertThatThrownBy(() -> service.grid("인천", 2.0, 8))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void 단일_소스면_모든_셀이_그_값이다() {
        givenStations(station("송도", 37.4, 126.7, true, 33.0, true));

        IdwGridResponse res = service.grid("인천", 2.0, 6);

        // IDW 소스가 1곳이면 가중평균은 항상 그 값 (IdwInterpolator 위임)
        assertThat(res.cells()).allSatisfy(c -> assertThat(c.pm25()).isEqualTo(33.0));
        assertThat(res.cells().get(0).grade()).isEqualTo("보통");
    }

    @Test
    void power와_resolution_범위를_검증하고_null이면_기본값을_쓴다() {
        givenStations(station("송도", 37.4, 126.7, true, 20.0, true));

        assertThatThrownBy(() -> service.grid("인천", 0.0, 8))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.grid("인천", 2.0, 1))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.grid("인천", 2.0, 21))
                .isInstanceOf(IllegalArgumentException.class);

        IdwGridResponse res = service.grid("인천", null, null);
        assertThat(res.power()).isEqualTo(2.0);
        assertThat(res.resolution()).isEqualTo(12);
        assertThat(res.cells()).hasSize(144);
    }
}
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd backend; .\gradlew.bat test --tests "*PublicIdwServiceTest" --console=plain`
Expected: 컴파일 실패(PublicIdwService 미존재)

- [ ] **Step 4: `PublicIdwService` 작성**

```java
package com.airvision.backend.publicdata.interpolation;

import com.airvision.backend.dashboard.GradeProperties;
import com.airvision.backend.interpolation.IdwInterpolator;
import com.airvision.backend.publicdata.airkorea.AirKoreaService;
import com.airvision.backend.publicdata.airkorea.dto.CurrentAirQualityResponse;
import com.airvision.backend.publicdata.airkorea.dto.StationAirQuality;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridCell;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * AirKorea 실시간 실측을 소스로 시도 영역을 N×N IDW 보간해 현재 PM2.5 격자 표면을 만든다.
 * 저장하지 않고 매 요청마다 즉석 계산한다. IdwInterpolator(교차검증 완료)를 그대로 재사용한다.
 */
@Service
public class PublicIdwService {

    static final double DEFAULT_POWER = 2.0;
    static final int DEFAULT_RESOLUTION = 12;
    static final int MAX_RESOLUTION = 20;
    private static final double MIN_MARGIN_DEG = 0.05;
    private static final double MARGIN_RATIO = 0.10;

    private final AirKoreaService airKoreaService;
    private final GradeProperties gradeProperties;

    public PublicIdwService(AirKoreaService airKoreaService, GradeProperties gradeProperties) {
        this.airKoreaService = airKoreaService;
        this.gradeProperties = gradeProperties;
    }

    public IdwGridResponse grid(String sido, Double power, Integer resolution) {
        double p = validatePower(power);
        int n = validateResolution(resolution);
        CurrentAirQualityResponse current = airKoreaService.current(sido);

        List<IdwInterpolator.SourcePoint> sources = new ArrayList<>();
        for (StationAirQuality s : current.stations()) {
            if (s.locationAvailable() && s.latitude() != null && s.longitude() != null
                    && s.pm25() != null && s.pm25().valid() && s.pm25().value() != null) {
                sources.add(new IdwInterpolator.SourcePoint(
                        s.latitude(), s.longitude(), s.pm25().value()));
            }
        }
        if (sources.isEmpty()) {
            throw new IllegalStateException(
                    "유효한 실측 측정소가 없어 보간할 수 없습니다 (sido=" + current.sido() + ")");
        }

        double minLat = sources.stream().mapToDouble(IdwInterpolator.SourcePoint::latitude)
                .min().getAsDouble();
        double maxLat = sources.stream().mapToDouble(IdwInterpolator.SourcePoint::latitude)
                .max().getAsDouble();
        double minLon = sources.stream().mapToDouble(IdwInterpolator.SourcePoint::longitude)
                .min().getAsDouble();
        double maxLon = sources.stream().mapToDouble(IdwInterpolator.SourcePoint::longitude)
                .max().getAsDouble();
        double latMargin = Math.max(MIN_MARGIN_DEG, (maxLat - minLat) * MARGIN_RATIO);
        double lonMargin = Math.max(MIN_MARGIN_DEG, (maxLon - minLon) * MARGIN_RATIO);
        minLat -= latMargin;
        maxLat += latMargin;
        minLon -= lonMargin;
        maxLon += lonMargin;

        double latSpan = maxLat - minLat;
        double lonSpan = maxLon - minLon;
        List<IdwGridCell> cells = new ArrayList<>(n * n);
        for (int i = 0; i < n; i++) {
            double cellLat = minLat + (i + 0.5) * latSpan / n;
            for (int j = 0; j < n; j++) {
                double cellLon = minLon + (j + 0.5) * lonSpan / n;
                double pm25 = Math.round(
                        IdwInterpolator.interpolate(sources, cellLat, cellLon, p) * 10.0) / 10.0;
                cells.add(new IdwGridCell(cellLat, cellLon, pm25, gradeProperties.gradeOf(pm25)));
            }
        }

        return new IdwGridResponse(current.sido(), p, n, "AIRKOREA",
                current.mock(), current.stale(), sources.size(),
                new IdwGridResponse.Bbox(minLat, minLon, maxLat, maxLon), cells);
    }

    private static double validatePower(Double power) {
        double p = power == null ? DEFAULT_POWER : power;
        if (p < 0.1 || p > 10) {
            throw new IllegalArgumentException("power는 0.1~10 범위여야 합니다");
        }
        return p;
    }

    private static int validateResolution(Integer resolution) {
        int n = resolution == null ? DEFAULT_RESOLUTION : resolution;
        if (n < 2 || n > MAX_RESOLUTION) {
            throw new IllegalArgumentException("resolution은 2~" + MAX_RESOLUTION + " 범위여야 합니다");
        }
        return n;
    }
}
```

- [ ] **Step 5: 서비스 테스트 통과 확인**

Run: `cd backend; .\gradlew.bat test --tests "*PublicIdwServiceTest" --console=plain`
Expected: BUILD SUCCESSFUL (5 tests)

- [ ] **Step 6: 컨트롤러 + 슬라이스 테스트 작성**

`PublicIdwController.java`:
```java
package com.airvision.backend.publicdata.interpolation;

import com.airvision.backend.common.ApiResponse;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 공공 실측 기반 IDW 격자 표면 API. */
@Tag(name = "Public Air Quality", description = "공공 대기질 (AirKorea) 연동 API")
@RestController
@RequestMapping("/api/air-quality/interpolation")
public class PublicIdwController {

    private final PublicIdwService service;

    public PublicIdwController(PublicIdwService service) {
        this.service = service;
    }

    @Operation(summary = "공공 실측 기반 IDW 격자 표면 (현재 PM2.5)")
    @GetMapping("/grid")
    public ApiResponse<IdwGridResponse> grid(
            @RequestParam(required = false) String sido,
            @RequestParam(required = false) Double power,
            @RequestParam(required = false) Integer resolution) {
        return ApiResponse.ok(service.grid(sido, power, resolution));
    }
}
```

`PublicIdwControllerTest.java`:
```java
package com.airvision.backend.publicdata.interpolation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.airvision.backend.publicdata.interpolation.dto.IdwGridCell;
import com.airvision.backend.publicdata.interpolation.dto.IdwGridResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc(addFilters = false)
@WebMvcTest(PublicIdwController.class)
class PublicIdwControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockitoBean
    PublicIdwService service;

    @Test
    void 격자_표면을_공통_응답으로_반환한다() throws Exception {
        IdwGridResponse res = new IdwGridResponse("인천", 2.0, 2, "AIRKOREA", true, false, 3,
                new IdwGridResponse.Bbox(37.3, 126.6, 37.7, 126.8),
                List.of(new IdwGridCell(37.4, 126.65, 22.5, "보통"),
                        new IdwGridCell(37.6, 126.75, 18.0, "보통")));
        when(service.grid(any(), any(), any())).thenReturn(res);

        mockMvc.perform(get("/api/air-quality/interpolation/grid").param("sido", "인천"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.source").value("AIRKOREA"))
                .andExpect(jsonPath("$.data.sourceCount").value(3))
                .andExpect(jsonPath("$.data.cells[0].pm25").value(22.5))
                .andExpect(jsonPath("$.data.cells[0].grade").value("보통"));
    }

    @Test
    void 유효_소스가_없으면_400이다() throws Exception {
        when(service.grid(any(), any(), any()))
                .thenThrow(new IllegalStateException("유효한 실측 측정소가 없어 보간할 수 없습니다"));

        mockMvc.perform(get("/api/air-quality/interpolation/grid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false));
    }
}
```

- [ ] **Step 7: 컨트롤러 슬라이스 테스트 통과 + 전체 회귀**

Run: `cd backend; .\gradlew.bat test --tests "*PublicIdwControllerTest" --console=plain`
Expected: BUILD SUCCESSFUL (2 tests)
Run: `cd backend; .\gradlew.bat test --console=plain`
Expected: BUILD SUCCESSFUL, 기존 119 + 신규 7 = 126 tests, 0 failures

- [ ] **Step 8: 커밋**

```bash
git add backend/src/main/java/com/airvision/backend/publicdata/interpolation/ \
        backend/src/test/java/com/airvision/backend/publicdata/interpolation/
git commit -m "실측 IDW 1: 격자 표면 서비스·컨트롤러 (TDD, IdwInterpolator 재사용)"
```

---

### Task 2: 프론트엔드 MapPage idwSurface 레이어

**Files:**
- Modify: `frontend/src/api/client.ts` (타입 추가)
- Modify: `frontend/src/config/mapConfig.ts` (markers.idwSurface 색)
- Modify: `frontend/src/pages/MapPage.tsx` (레이어 추가)

**Interfaces:**
- Consumes: `GET /api/air-quality/interpolation/grid?sido=`.
- Produces: 지도에 `idwSurface` 레이어(색상 격자 표면), 체크박스 토글.

- [ ] **Step 1: `client.ts` 타입 추가**

`PublicHistorySummary` 아래(공공 타입 블록 끝)에 추가:
```ts
export interface IdwGridCell {
  latitude: number
  longitude: number
  pm25: number
  grade: string
}

export interface IdwGridResponse {
  sido: string
  power: number
  resolution: number
  source: string
  mock: boolean
  stale: boolean
  sourceCount: number
  bbox: { minLatitude: number; minLongitude: number; maxLatitude: number; maxLongitude: number }
  cells: IdwGridCell[]
}
```

- [ ] **Step 2: `mapConfig.ts`에 레이어 색 추가**

`markers` 객체에 `idwSurface` 키 추가(기존 `airkorea: '#0ea5e9'` 다음):
```ts
    airkorea: '#0ea5e9',
    idwSurface: '#14b8a6',
```

- [ ] **Step 3: `MapPage.tsx` — 타입 import + LayerKey + 라벨 + dataSource**

(a) 타입 import에 `IdwGridResponse` 추가:
```ts
import type {
  ApiResponse, CurrentAirQuality, IdwGridResponse, InterpolationResult, PageResponse,
  PollutantValue, PublicStationAir, Site, WeatherNow,
} from '../api/client'
```

(b) `LayerKey`와 `LAYER_LABELS`:
```ts
type LayerKey = 'observation' | 'prediction' | 'interpolation' | 'airkorea' | 'idwSurface'

const LAYER_LABELS: Record<LayerKey, string> = {
  observation: '관측값',
  prediction: 'AI 예측값',
  interpolation: 'IDW 보간값',
  airkorea: '공공 대기질',
  idwSurface: '실측 IDW 표면',
}
```

(c) `layers` 초기 상태에 `idwSurface: false` 추가(기본 꺼짐 — 사용자가 토글):
```ts
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    observation: true,
    prediction: true,
    interpolation: true,
    airkorea: true,
    idwSurface: false,
  })
```

(d) Viewer 생성 `useEffect`의 `dataSources` 객체에 추가:
```ts
      airkorea: new Cesium.CustomDataSource('airkorea'),
      idwSurface: new Cesium.CustomDataSource('idwSurface'),
```

- [ ] **Step 4: `MapPage.tsx` — 표면 렌더 함수 + 로드**

(a) 모듈 상단(다른 add* 함수 근처)에 렌더 함수 추가:
```ts
/** 공공 실측 IDW 격자 표면: 셀별 색상 상자로 타일링 (높이 아닌 색으로 농도 표현). */
function addIdwSurface(ds: Cesium.CustomDataSource, grid: IdwGridResponse) {
  const n = grid.resolution
  const cellLatDeg = (grid.bbox.maxLatitude - grid.bbox.minLatitude) / n
  const cellLonDeg = (grid.bbox.maxLongitude - grid.bbox.minLongitude) / n
  const mPerDegLat = 111_320
  for (const c of grid.cells) {
    const mPerDegLon = 111_320 * Math.cos((c.latitude * Math.PI) / 180)
    const color = Cesium.Color.fromCssColorString(
      PUBLIC_GRADE_COLORS[c.grade] ?? gradeOf(c.pm25).chart).withAlpha(0.45)
    ds.entities.add({
      position: Cesium.Cartesian3.fromDegrees(c.longitude, c.latitude, 40),
      box: {
        dimensions: new Cesium.Cartesian3(cellLonDeg * mPerDegLon, cellLatDeg * mPerDegLat, 60),
        material: color,
      },
      name: `실측 IDW 표면`,
      description: `<table class="cesium-infoBox-defaultTable"><tbody>
        <tr><th>보간 PM2.5</th><td><b>${c.pm25.toFixed(1)}</b> ㎍/㎥ (${c.grade})</td></tr>
        <tr><th>좌표</th><td>${c.latitude.toFixed(4)}, ${c.longitude.toFixed(4)}</td></tr>
        <tr><th>방식</th><td>AirKorea 실측 ${grid.sourceCount}곳 IDW (색으로 농도 표현)</td></tr>
        </tbody></table>`,
    })
  }
}
```

(b) 컴포넌트 안에 로드 함수 추가(다른 load 함수 근처):
```ts
  /** 공공 실측 IDW 격자 표면 로드 (실패해도 다른 레이어 무영향) */
  const loadIdwSurface = async (sido?: string) => {
    const ds = dataSourcesRef.current
    if (!ds) return
    try {
      const q = sido ? `?sido=${encodeURIComponent(sido)}` : ''
      const res = await apiClient.get<ApiResponse<IdwGridResponse>>(
        `/air-quality/interpolation/grid${q}`)
      ds.idwSurface.entities.removeAll()
      addIdwSurface(ds.idwSurface, res.data.data)
    } catch {
      ds.idwSurface?.entities.removeAll()
    }
  }
```

(c) 공공 sido가 정해지면 표면도 로드 — 기존 공공 대기질 렌더 `useEffect`(publicAir 의존)에서 호출 추가. `addPublicStation` 루프 뒤에:
```ts
    if (publicAir) {
      loadIdwSurface(publicAir.sido)
    }
```
(주: 이미 `publicAir` 의존 useEffect 안이므로 sido 변경 시 표면 갱신)

- [ ] **Step 5: 빌드·린트**

Run: `cd frontend; npm run build`
Expected: `✓ built`
Run: `cd frontend; npm run lint`
Expected: 오류 없음

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/api/client.ts frontend/src/config/mapConfig.ts frontend/src/pages/MapPage.tsx
git commit -m "실측 IDW 2: 3D 지도 실측 IDW 표면 레이어"
```

---

### Task 3: 통합 검증 + 문서

**Files:**
- Modify: `docs/progress.md`, `docs/user-guide.html`

- [ ] **Step 1: 스택 기동 + 엔드포인트 검증**

`.\run.ps1 -Stop` 후 포트 확인 → `.\run.ps1` → 3개 health OK 대기.
로그인(user) 후:
```
GET /api/air-quality/interpolation/grid?sido=인천&resolution=10
```
Expected: `data.cells` 길이 100, `data.sourceCount >= 1`, 각 cell에 pm25·grade. mock/실 데이터 모두 확인.
잘못된 resolution(예: 25)은 400 확인.

- [ ] **Step 2: `progress.md` Phase 12 기록**

2순위 첫 기능(실측 IDW 격자 표면) 추가 — 서비스·컨트롤러·지도 레이어·테스트 건수. 실기동 검증 결과 기록(셀 수·소스 수). VERIFIED(2026-07-19).

- [ ] **Step 3: `user-guide.html` 갱신 (CLAUDE.md 9항)**

7장(3D 지도) 레이어 설명에 "실측 IDW 표면" 한 줄 추가(체크박스로 켜면 AirKorea 실측 다수를 IDW 보간한 색상 농도 면이 표시됨, 색=등급). 헤더 버전 v1.3·날짜 2026-07-19, 업데이트 이력 표에 한 줄 추가.

- [ ] **Step 4: 스택 종료 + 커밋**

`.\run.ps1 -Stop`
```bash
git add docs/progress.md docs/user-guide.html
git commit -m "실측 IDW 3: 통합 검증 + 문서 갱신"
```

---

## Self-Review 메모

- 스펙 커버리지: 서비스(bbox·격자·필터·검증)·컨트롤러·DTO(Task1) / 지도 레이어·타입(Task2) / 통합·문서(Task3) — 스펙 완료조건 1~4 대응.
- 기존 코드 영향: `IdwInterpolator`·`GradeProperties`·`AirKoreaService` 무변경(주입만). MapPage는 레이어 추가라 기존 레이어 동작 불변. 마이그레이션·SecurityConfig 무변경.
- 타입 일관성: `IdwGridResponse.Bbox` 필드명(min/maxLatitude·Longitude)이 백엔드 record와 프론트 인터페이스 동일. `gradeOf`(프론트)·`GradeProperties.gradeOf`(백엔드)는 각각 색/등급명 용도로 별개.
- 위험: 단일 소스 테스트는 IdwInterpolator 1-소스 동작(값 그대로)에 의존 — 기존 구현이 그러함(0거리 아니어도 가중평균=단일 값). resolution² 셀 응답 크기는 최대 400으로 제한.
