# three.js 기반 3D 애니메이션 차트 설계

작성일: 2026-08-04
상태: 설계 승인 완료

## 1. 목적

대시보드와 모델 정확도 화면의 주요 차트를 three.js 기반 3D로 교체해,
정지된 2D 그래프가 아니라 진입 애니메이션과 회전이 가능한 입체 시각화를 제공한다.

3D는 장식이 아니라 정보를 더 담기 위해 쓴다.

- 다계열 시계열은 Z축으로 계열을 앞뒤 분리해 겹침을 없앤다.
- 산점도는 Z축에 시간 순서를 넣어 "예측 정확도가 시간에 따라 개선되는가"를 드러낸다.

## 2. 적용 범위

3D로 교체하는 차트는 3개다.

| 위치 | 기존 | 3D 형태 |
|---|---|---|
| `pages/DashboardPage.tsx` · 시간별 평균 PM2.5 | AreaChart (h=260) | 막대 24개 1열 |
| `pages/DashboardPage.tsx` · 관측값과 AI 예측값 비교 | LineChart 2계열 (h=260) | 막대 2열 (Z축 앞뒤) |
| `pages/MetricsPage.tsx` · 예측 vs 실측 산점도 | ScatterChart (h=360) | 3D 산점 + y=x 기준면 |

범위 밖(recharts 그대로 유지):

- DashboardPage 히어로 스파크라인 (h=64) — 너무 작아 3D 이점이 없다
- DashboardPage 공공 실측 추이 / AI 절대오차 추이 (h=230) — 보조 차트
- ObservationsPage 관측 추이

## 3. 라이브러리 선택

`three` + `@types/three`만 추가한다. (검토안: @react-three/fiber + drei, echarts-gl)

선택 이유:

- 필요한 기능이 인스턴스 메시, 제한된 드래그 회전, 레이캐스트 호버 세 가지뿐이라
  R3F의 선언형 추상화가 순이득이 아니다.
- React 19.2 호환 버전을 핀으로 고정할 의존성을 늘리지 않는다.
- 번들이 얇다 (three core 약 150KB gzip).
- echarts-gl은 recharts와 차트 라이브러리를 2중화하고, 기존 디자인 토큰 통제가 어렵다.

## 4. 구조

```
frontend/src/components/chart3d/
  Chart3DCanvas.tsx   공통 껍데기 — WebGL 지원 검사 / 폴백 전환 / 캔버스·툴팁 레이어
  useChart3DScene.ts  렌더러·씬·카메라 생명주기, 리사이즈, 화면 밖 정지
  Bar3DChart.tsx      3D 막대 그리드 (1~2계열 시계열)
  Scatter3DChart.tsx  3D 산점도 + y=x 기준면
  axes.ts             바닥 그리드·축·눈금 라벨(CanvasTexture 스프라이트)
  chart3dTheme.ts     chartTheme 토큰 → three 재질 색 매핑
  scale.ts            데이터 → 월드 좌표 정규화 (순수 함수)
  index.ts
```

경계 규칙:

- three import는 `components/chart3d/` 밖으로 나가지 않는다.
  페이지는 데이터 배열과 계열 정의만 넘긴다.
- 기존 `components/ui/chartTheme.ts`는 수정하지 않는다.
  `chart3dTheme.ts`가 그 토큰을 소비만 한다.
- 테마 전환 시 재질의 색만 갱신하고 씬을 재생성하지 않는다.

### 컴포넌트 인터페이스

```ts
// Bar3DChart
interface Bar3DSeries {
  key: string          // 데이터 필드명
  name: string         // 범례 라벨
  color?: string       // 미지정이면 값의 등급색을 막대마다 적용
}
interface Bar3DChartProps {
  data: Array<Record<string, unknown>>
  xKey: string         // 축 라벨로 쓸 필드 (예: 'time')
  series: Bar3DSeries[]   // 1~2개
  height?: number
  unit?: string
  ariaSummary?: string
}

// Scatter3DChart
interface Scatter3DPoint {
  x: number            // 실측
  y: number            // 예측
  label?: string
}
interface Scatter3DChartProps {
  points: Scatter3DPoint[]   // 배열 순서가 곧 Z축(시간) 순서, 마지막이 최신
  axisMax: number
  height?: number
  xLabel: string
  yLabel: string
  zLabel: string
}
```

## 5. 좌표계와 스케일

`scale.ts`가 담당하는 순수 함수다.

- 데이터 값을 `[0, 1]`로 정규화한 뒤 고정 크기 월드에 매핑한다.
  X 폭 10, Y 높이 5, Z 깊이 계열 수에 따라 1.2~3.
- Y축 상한은 데이터 최대값에 10% 여유를 준 뒤 사람이 읽기 좋은 눈금
  (1 / 2 / 5 × 10^n)으로 올림한다.
- 카메라는 원근 투영, 고정 거리. 초기 시점은 azimuth 약 -20°, polar 약 68°.
- 데이터가 비면 3D를 그리지 않고 기존 `EmptyState`를 그대로 쓴다.

## 6. 색 규칙

프로젝트의 기존 디자인 시스템 규칙을 그대로 따른다.

- 값 자체(PM2.5 수치)는 **등급색**으로 칠한다.
- 데이터 종류·계열 구분은 **종류색**(`config/dataKinds.ts`)을 쓴다.

| 차트 | 색 |
|---|---|
| 시간별 평균 PM2.5 | 막대마다 그 값의 등급색 (`config/grades.ts`의 `GRADES[].chart`) |
| 관측값 vs AI 예측 | 관측 = 인디고(observation), 예측 = 바이올렛(prediction) |
| 산점도 | 점 = 실측값의 등급색, y=x 기준면 = 축 회색 반투명 |

바닥 그리드·축선·눈금 텍스트는 `chartTheme`의 `grid` / `axis` 값을 그대로 쓴다.

## 7. 애니메이션

- **진입**: 막대 높이 0 → 실값. 인덱스당 20ms stagger, easeOutCubic, 전체 약 800ms.
  산점도는 점 스케일 0 → 1을 같은 방식으로 적용한다.
- **데이터 변경**: 재시작이 아니라 현재 높이에서 새 값으로 400ms 보간한다.
- **정지 렌더**: 진입 애니메이션이 끝나면 rAF 루프를 멈춘다.
  드래그, 호버, 데이터 변경, 리사이즈, 테마 전환 때만 다시 그린다.
  유휴 상태의 GPU 사용은 0이다.
- **화면 밖**: IntersectionObserver로 뷰포트를 벗어나면 렌더 루프를 멈춘다.

## 8. 상호작용

- **회전**: 자체 포인터 이벤트로 구현한다. azimuth ±35°, polar 55~80°로 제한하고
  줌과 팬은 없다. three/examples의 OrbitControls를 쓰면 줌·팬을 붙였다가 다시
  막는 코드가 더 길어진다.
- **호버**: raycaster로 인스턴스를 판정해 해당 막대(또는 점)만 밝기를 올리고,
  캔버스 위에 절대 위치 HTML 툴팁 div를 띄운다.
  툴팁 스타일은 기존 `tooltipProps(chart)`의 값을 재사용해 2D 차트와 동일하게 보이게 한다.
- **드로우콜**: 계열당 `InstancedMesh` 1개. 24개 막대 2계열이면 드로우콜 2개.

## 9. 폴백과 접근성

`Chart3DCanvas`는 기존 recharts 차트를 `children`으로 받아, 다음 조건 중 하나면
3D를 포기하고 children을 그대로 렌더한다.

1. WebGL2 컨텍스트 생성 실패
2. `prefers-reduced-motion: reduce`
3. 렌더러 초기화 중 예외 발생
4. `webglcontextlost` 이벤트 수신

즉 기존 2D 차트 코드는 삭제하지 않고 안전망으로 남긴다.

접근성:

- canvas에 `role="img"`와 `aria-label`을 붙인다.
  라벨에는 최대·최소·평균과 단위를 문장으로 담는다.
- 회전은 보조 수단이며, 회전하지 않아도 초기 시점에서 모든 데이터가 보인다.

## 10. 성능

- three 3개 차트 컴포넌트를 `React.lazy`로 분리해 초기 번들에서 뺀다.
- 한 화면에 동시에 뜨는 WebGL 컨텍스트는 대시보드 2개, Metrics 1개다.
- MapPage(Cesium)와 3D 차트가 같이 뜨는 화면은 없다.
- `antialias`는 켜되 `powerPreference: 'default'`, `devicePixelRatio`는 최대 2로 제한한다.

## 11. 검증

- `scale.ts` 정규화·눈금 계산 순수 함수 vitest 단위 테스트
- jsdom에는 WebGL이 없으므로 **폴백 경로가 recharts를 렌더하는지** 테스트로 고정
- `npx tsc -b`, `npm run build`, `npm run test`
- dev 서버에서 대시보드 2개 차트와 Metrics 산점도 육안 확인
  (진입 애니메이션, 드래그 회전, 호버 툴팁, 라이트/다크 전환)

## 12. 문서 갱신

- `docs/progress.md`에 해당 단계를 기록한다.
- 사용자가 보는 화면 동작(회전·호버)이 바뀌므로
  `docs/user-guide.html`의 대시보드·모델 정확도 절과 하단 업데이트 이력 표를 갱신한다.
