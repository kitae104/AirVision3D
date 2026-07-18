# 공공 실측 기반 IDW 격자 표면 설계

> 상태: 승인됨 (2026-07-19). 2순위 첫 기능. 구현 계획은 `docs/superpowers/plans/`에 별도.

## 1. 목표

AirKorea 실시간 실측(시도당 다수 측정소, 예: 인천 43곳)을 소스로 시도 영역을 N×N 격자로
IDW 보간해 "현재" PM2.5 농도 표면을 만들고, 3D 지도에 색상 면 레이어로 표시한다. 기존 자체
관측소 7곳 IDW보다 훨씬 조밀하다. **즉석 계산(저장 없음), 신규 알고리즘·테이블·마이그레이션 0.**

## 2. 결정 사항 (사용자 확정)

| 항목 | 결정 |
|---|---|
| 산출물 형태 | 3D 지도 격자 표면 레이어 (신규 `idwSurface`) |
| 소스 데이터 | 실시간 `AirKoreaService.current(sido)` (누적 테이블 미사용, 신규 쿼리 없음) |
| 저장 | 없음 (매 조회마다 즉석 계산, 읽기 전용 GET) |

## 3. 재사용 / 신규

**재사용(변경 없음)**: `IdwInterpolator.interpolate(sources, lat, lon, power)`(Python 교차검증 완료),
`GeoUtils.haversineKm`, `AirKoreaService.current(sido)`→`CurrentAirQualityResponse.stations()`,
`GradeProperties.gradeOf(pm25)`(등급명), `ApiResponse`, 기존 `/api/**` 보안 규칙(GET=USER/ADMIN),
MapPage 레이어 패턴(`LayerKey`/`CustomDataSource`/체크박스), `publicGrades.ts` 색상.

**신규**: 백엔드 `publicdata/interpolation/` 슬라이스(서비스·컨트롤러·DTO 2종),
프론트 MapPage `idwSurface` 레이어 + `client.ts` 타입.

## 4. 백엔드

### PublicIdwService
```
IdwGridResponse grid(String sido, Double power, Integer resolution)
```
1. `power` 검증: 기본 2.0, 범위 0.1~10 벗어나면 `IllegalArgumentException`.
2. `resolution` 검증: 기본 12, 범위 2~20(최대 400셀) 벗어나면 예외.
3. `current = airKoreaService.current(sido)` — 잘못된 sido는 여기서 `IllegalArgumentException`.
4. 소스 필터: `locationAvailable && latitude!=null && longitude!=null && pm25.valid && pm25.value!=null`
   → `IdwInterpolator.SourcePoint(lat, lon, pm25.value)`. 0곳이면 `IllegalStateException("유효한 실측 측정소 없음")`.
5. bbox: 소스들의 min/max lat·lon. 각 축 span의 10% 여백 추가(span이 0이면 고정 0.05도 여백).
6. 격자: 각 축 N개 셀, 셀 중심 = `min + (idx + 0.5) * span/N`. 총 N² 셀.
7. 각 셀: `pm25 = round(IdwInterpolator.interpolate(sources, cellLat, cellLon, power), 1)`,
   `grade = gradeProperties.gradeOf(pm25)`.
8. 반환: `IdwGridResponse(sido, power, resolution, "AIRKOREA", current.mock(), current.stale(),
   sourceCount, bbox, cells)`.

### DTO
```
record IdwGridResponse(String sido, double power, int resolution, String source,
    boolean mock, boolean stale, int sourceCount, Bbox bbox, List<IdwGridCell> cells) {
  record Bbox(double minLatitude, double minLongitude, double maxLatitude, double maxLongitude) {}
}
record IdwGridCell(double latitude, double longitude, double pm25, String grade) {}
```

### 컨트롤러
`GET /api/air-quality/interpolation/grid?sido=&power=&resolution=` (모두 선택) →
`ApiResponse<IdwGridResponse>`. GET이라 USER/ADMIN 자동. `@Tag`/`@Operation` 부여.

## 5. 프론트엔드 (MapPage)

- `LayerKey`에 `'idwSurface'` 추가, `LAYER_LABELS['idwSurface']='실측 IDW 표면'`,
  `MAP_CONFIG.markers.idwSurface`(체크박스 점 색, 예: `#14b8a6`).
- `dataSources`에 `idwSurface` CustomDataSource 추가.
- `loadIdwSurface()`: `GET /api/air-quality/interpolation/grid?sido=<현재 공공 sido>` →
  각 셀을 색상 상자로 렌더. 셀 크기(도) = `(max-min)/resolution`을 m로 환산해 box dimensions,
  얇은 높이(예: 60m)·낮은 고도, `material = PUBLIC_GRADE_COLORS[grade]` withAlpha(~0.45).
  타일링되어 히트맵 표면처럼 보인다. 독립 `.catch`(실패해도 다른 레이어 무영향).
- 레이어 토글은 기존 useEffect가 `ds.idwSurface.show`로 처리.
- `client.ts`에 `IdwGridResponse`/`IdwGridCell`/`Bbox` 타입 추가.
- Mock/stale 상태는 기존 공공 배지와 동일 방식으로 표시(선택).

## 6. 엣지 케이스

- 잘못된 sido/power/resolution → 400. 유효 소스 0곳 → 400(명확 메시지).
- 외부 API 장애 → `AirKoreaService`가 stale 캐시 또는 502. mock 모드에서도 동작.
- 단일 소스 → 모든 셀이 그 값(IdwInterpolator 0거리 규칙). 정상.

## 7. 테스트

- `PublicIdwServiceTest`(단위, AirKoreaService·GradeProperties 목킹):
  격자 셀 수=resolution², 셀이 bbox 내, sourceCount 정확, 무좌표·무효 pm25 측정소 제외,
  소스 0곳 예외, power/resolution 범위 검증·기본값, 단일 소스면 전 셀=그 값(IdwInterpolator 위임 확인).
- `PublicIdwControllerTest`(@WebMvcTest 슬라이스): 응답 형태, IllegalState→400.
- 프론트: `npm run build` + `oxlint`.
- 통합: 스택 기동 후 `/grid` 실호출(실 데이터 또는 mock)로 셀 수·값 확인, 브라우저 육안은 선택.

## 8. 완료 조건

1. `/api/air-quality/interpolation/grid`가 소스 수·bbox·resolution²개 셀을 반환.
2. 3D 지도에 `idwSurface` 레이어가 색상 표면으로 표시, 체크박스 토글 동작.
3. 백엔드 단위·슬라이스 테스트 + 프론트 빌드 통과, 기존 119 테스트 회귀 없음.
4. Mock/실 데이터 양쪽에서 동작.
