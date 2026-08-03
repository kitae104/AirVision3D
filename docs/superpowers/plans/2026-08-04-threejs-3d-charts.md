# three.js 3D 애니메이션 차트 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 대시보드의 시계열 차트 2개와 모델 정확도 화면의 산점도를 three.js 기반 3D 애니메이션 차트로 교체하고, WebGL을 못 쓰는 환경에서는 기존 recharts 차트로 자동 폴백한다.

**Architecture:** `frontend/src/components/chart3d/` 한 폴더 안에만 three를 import 한다. 페이지는 데이터 배열과 계열 정의만 넘긴다. 씬 생명주기(렌더러·카메라·리사이즈·드래그 회전·호버 레이캐스트)는 `useChart3DScene` 훅 하나가 맡고, 차트 컴포넌트는 그 훅에 "씬을 어떻게 채울지"만 알려준다. 진입 애니메이션이 끝나면 렌더 루프를 멈춰 유휴 GPU 사용을 0으로 만든다.

**Tech Stack:** React 19.2, TypeScript, Vite 8, three 0.185, Vitest + jsdom + Testing Library, Tailwind CSS 4

**설계 문서:** `docs/superpowers/specs/2026-08-04-threejs-3d-charts-design.md`

## Global Constraints

- 새로 추가하는 의존성은 `three@^0.185.1`과 `@types/three@^0.185.3` **둘뿐**이다. `@react-three/fiber`, `drei`, `OrbitControls` 등은 쓰지 않는다.
- `three` import는 `frontend/src/components/chart3d/` 밖으로 나가지 않는다.
- 기존 `frontend/src/components/ui/chartTheme.ts`는 **수정하지 않는다**. 3D 코드는 그 토큰을 읽기만 한다.
- 기존 recharts 차트 코드는 **삭제하지 않는다**. `fallback` prop으로 넘겨 안전망으로 남긴다.
- 색 규칙: 값 자체(PM2.5 수치)는 등급색(`config/grades.ts`의 `GRADES[].chart`), 데이터 종류·계열 구분은 종류색(`config/dataKinds.ts`)을 쓴다. 산점도의 점은 기존 `MODEL_COLORS`를 그대로 쓴다.
- 주석은 한국어로 쓰고, 기존 파일들의 주석 밀도(파일 상단에 목적 한두 줄, 비자명한 결정에만 인라인)를 따른다.
- 월드 좌표 상수: 폭 `10`, 높이 `5`, 계열 간 깊이 `1.2`. `scale.ts`의 `WORLD`에서만 정의한다.
- 카메라 회전 제한: azimuth `±35°`, polar `55°~80°`. 줌·팬 없음.
- `devicePixelRatio`는 최대 2로 제한한다.
- 테스트 명령은 `npm run test`(= `vitest run`), 타입 검사는 `npx tsc -b`, 빌드는 `npm run build`. 모두 `frontend/` 디렉터리에서 실행한다.

## 파일 구조

| 파일 | 책임 |
|---|---|
| `frontend/src/components/chart3d/scale.ts` | 데이터 → 월드 좌표 정규화. 눈금 계산. 순수 함수만. |
| `frontend/src/components/chart3d/scale.test.ts` | 위 순수 함수 테스트 |
| `frontend/src/components/chart3d/chart3dTheme.ts` | `ChartTheme` 토큰 → 3D 재질 색 매핑 |
| `frontend/src/components/chart3d/axes.ts` | 바닥면·가이드선·눈금 라벨 스프라이트 생성, 오브젝트 폐기 유틸 |
| `frontend/src/components/chart3d/axes.test.ts` | 축 그룹 구성 테스트 |
| `frontend/src/components/chart3d/useChart3DScene.ts` | 렌더러·씬·카메라 생명주기, 리사이즈, 드래그 회전, 호버, 렌더 루프 |
| `frontend/src/components/chart3d/Chart3DCanvas.tsx` | WebGL 지원 검사 / 폴백 전환 / 캔버스·툴팁 DOM |
| `frontend/src/components/chart3d/Chart3DCanvas.test.tsx` | 폴백 경로 테스트 |
| `frontend/src/components/chart3d/Bar3DChart.tsx` | 3D 막대 그리드 (1~2계열 시계열) |
| `frontend/src/components/chart3d/Bar3DChart.test.tsx` | 폴백 렌더 테스트 |
| `frontend/src/components/chart3d/Scatter3DChart.tsx` | 3D 산점도 + y=x 기준면 |
| `frontend/src/components/chart3d/Scatter3DChart.test.tsx` | 폴백 렌더 테스트 |
| `frontend/src/components/chart3d/index.ts` | `React.lazy` + `Suspense`로 감싼 공개 진입점 |
| `frontend/src/pages/DashboardPage.tsx` (수정) | 차트 2개를 3D로 교체 |
| `frontend/src/pages/MetricsPage.tsx` (수정) | 산점도를 3D로 교체 |

---

## Task 1: 의존성 추가와 스케일 순수 함수

**Files:**
- Modify: `frontend/package.json` (npm 명령으로 자동 수정)
- Create: `frontend/src/components/chart3d/scale.ts`
- Test: `frontend/src/components/chart3d/scale.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `WORLD: { width: 10; height: 5; seriesDepth: 1.2 }`
  - `niceCeil(value: number): number`
  - `axisMaxFor(values: number[], minimum?: number): number`
  - `axisTicks(max: number, count?: number): number[]`
  - `barSlot(index: number, count: number): { x: number; width: number }`
  - `seriesZ(seriesIndex: number, seriesCount: number): number`
  - `pickLabelIndexes(count: number, max: number): number[]`

- [ ] **Step 1: three 설치**

`frontend/` 에서 실행:

```bash
npm install three@^0.185.1
npm install -D @types/three@^0.185.3
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/src/components/chart3d/scale.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  WORLD,
  axisMaxFor,
  axisTicks,
  barSlot,
  niceCeil,
  pickLabelIndexes,
  seriesZ,
} from './scale'

describe('niceCeil', () => {
  it('1·2·5 × 10^n 중 하나로 올림한다', () => {
    expect(niceCeil(0.7)).toBe(1)
    expect(niceCeil(12)).toBe(20)
    expect(niceCeil(23)).toBe(50)
    expect(niceCeil(51)).toBe(100)
    expect(niceCeil(100)).toBe(100)
  })

  it('0 이하는 1을 돌려준다', () => {
    expect(niceCeil(0)).toBe(1)
    expect(niceCeil(-5)).toBe(1)
  })
})

describe('axisMaxFor', () => {
  it('최대값에 10% 여유를 준 뒤 보기 좋은 눈금으로 올린다', () => {
    expect(axisMaxFor([10, 32, 18])).toBe(50)
  })

  it('null·NaN을 무시한다', () => {
    expect(axisMaxFor([10, Number.NaN, 32])).toBe(50)
  })

  it('값이 없으면 최소값을 돌려준다', () => {
    expect(axisMaxFor([], 20)).toBe(20)
  })

  it('데이터가 작아도 최소값 아래로 내려가지 않는다', () => {
    expect(axisMaxFor([1, 2], 20)).toBe(20)
  })
})

describe('axisTicks', () => {
  it('0부터 최대값까지 균등하게 나눈다', () => {
    expect(axisTicks(100, 4)).toEqual([0, 25, 50, 75, 100])
  })
})

describe('barSlot', () => {
  it('막대를 월드 폭 안에 균등 배치한다', () => {
    const first = barSlot(0, 4)
    const last = barSlot(3, 4)
    expect(first.x).toBeCloseTo(-WORLD.width / 2 + WORLD.width / 8)
    expect(last.x).toBeCloseTo(WORLD.width / 2 - WORLD.width / 8)
    expect(first.width).toBeGreaterThan(0)
    expect(first.width).toBeLessThan(WORLD.width / 4)
  })

  it('막대가 하나면 가운데에 둔다', () => {
    expect(barSlot(0, 1).x).toBeCloseTo(0)
  })
})

describe('seriesZ', () => {
  it('계열이 하나면 z는 0이다', () => {
    expect(seriesZ(0, 1)).toBe(0)
  })

  it('계열이 둘이면 앞뒤로 갈라놓는다', () => {
    expect(seriesZ(0, 2)).toBeCloseTo(WORLD.seriesDepth / 2)
    expect(seriesZ(1, 2)).toBeCloseTo(-WORLD.seriesDepth / 2)
  })
})

describe('pickLabelIndexes', () => {
  it('개수가 상한 이하면 전부 고른다', () => {
    expect(pickLabelIndexes(4, 6)).toEqual([0, 1, 2, 3])
  })

  it('상한을 넘으면 균등 간격으로 솎아내고 마지막을 포함한다', () => {
    const picked = pickLabelIndexes(24, 6)
    // 균등 간격으로 6개를 고른 뒤 마지막 항목을 덧붙이므로 최대 7개가 된다
    expect(picked).toEqual([0, 4, 8, 12, 16, 20, 23])
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm run test -- scale`
Expected: FAIL — `Failed to resolve import "./scale"`

- [ ] **Step 4: 구현 작성**

`frontend/src/components/chart3d/scale.ts`:

```ts
/**
 * 데이터 값을 3D 월드 좌표로 옮기는 순수 함수 모음.
 * three에 의존하지 않으므로 단위 테스트가 그대로 된다.
 */

/** 모든 3D 차트가 공유하는 월드 크기. 카메라 거리도 이 값을 기준으로 잡는다. */
export const WORLD = {
  width: 10,
  height: 5,
  /** 계열을 앞뒤로 갈라놓을 때 쓰는 간격 */
  seriesDepth: 1.2,
} as const

/** 1·2·5 × 10^n 중 value 이상인 가장 작은 값 */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  for (const step of [1, 2, 5, 10]) {
    const candidate = step * base
    // 부동소수 오차로 100이 100.00000000000001보다 작다고 판정되는 것을 막는다
    if (candidate >= value - candidate * 1e-9) return candidate
  }
  return 10 * base
}

/** 데이터 최대값에 10% 여유를 준 축 상한 */
export function axisMaxFor(values: number[], minimum = 10): number {
  const valid = values.filter((v) => Number.isFinite(v))
  if (valid.length === 0) return minimum
  return Math.max(minimum, niceCeil(Math.max(...valid) * 1.1))
}

/** 0부터 max까지 count 등분한 눈금값 (양 끝 포함) */
export function axisTicks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i)
}

/** index번째 막대의 중심 x와 막대 폭 */
export function barSlot(index: number, count: number): { x: number; width: number } {
  const safeCount = Math.max(1, count)
  const slot = WORLD.width / safeCount
  return {
    x: -WORLD.width / 2 + slot * (index + 0.5),
    // 막대 사이에 틈을 둬야 개수를 셀 수 있다
    width: slot * 0.62,
  }
}

/** 계열을 앞뒤로 갈라놓는 z 좌표. 인덱스가 작을수록 앞(카메라 쪽)이다. */
export function seriesZ(seriesIndex: number, seriesCount: number): number {
  if (seriesCount <= 1) return 0
  const span = WORLD.seriesDepth * (seriesCount - 1)
  return span / 2 - WORLD.seriesDepth * seriesIndex
}

/** 축 라벨이 겹치지 않도록 최대 max개만 균등 간격으로 고른다 (마지막 항목은 항상 포함) */
export function pickLabelIndexes(count: number, max: number): number[] {
  if (count <= 0) return []
  if (count <= max) return Array.from({ length: count }, (_, i) => i)
  const step = Math.ceil(count / max)
  const picked: number[] = []
  for (let i = 0; i < count; i += step) picked.push(i)
  if (picked[picked.length - 1] !== count - 1) picked.push(count - 1)
  return picked
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- scale`
Expected: PASS (13 tests)

- [ ] **Step 6: 커밋**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/chart3d/
git commit -m "3D 차트 기반: three 의존성과 스케일 순수 함수 추가"
```

---

## Task 2: 3D 테마 매핑과 축 구성

**Files:**
- Create: `frontend/src/components/chart3d/chart3dTheme.ts`
- Create: `frontend/src/components/chart3d/axes.ts`
- Test: `frontend/src/components/chart3d/axes.test.ts`

**Interfaces:**
- Consumes: `WORLD`, `axisTicks`, `pickLabelIndexes` (Task 1)
- Produces:
  - `Chart3DPalette { grid, axis, label, floor, tooltipBg, tooltipBorder, tooltipInk }`
  - `useChart3DPalette(): Chart3DPalette`
  - `makeTextSprite(text: string, color: string): THREE.Sprite`
  - `buildAxes(opts: BuildAxesOptions): THREE.Group`
  - `BuildAxesOptions { max: number; depth: number; xLabels: string[]; palette: Chart3DPalette; zLabels?: string[] }`
  - `disposeObject(root: THREE.Object3D): void`

- [ ] **Step 1: 테마 매핑 작성 (테스트 없음 — 상수 매핑뿐)**

`frontend/src/components/chart3d/chart3dTheme.ts`:

```ts
import { useChartTheme } from '../ui'
import { useThemeStore } from '../../store/theme'

/**
 * 2D 차트 토큰(chartTheme.ts)을 3D 씬에서 쓸 색으로 옮긴다.
 * chartTheme.ts는 건드리지 않고 읽기만 한다.
 */
export interface Chart3DPalette {
  grid: string
  axis: string
  label: string
  /** 바닥면 색 */
  floor: string
  tooltipBg: string
  tooltipBorder: string
  tooltipInk: string
}

export function useChart3DPalette(): Chart3DPalette {
  const theme = useChartTheme()
  const dark = useThemeStore((s) => s.mode) === 'dark'
  return {
    grid: theme.grid,
    axis: theme.axis,
    label: theme.axis,
    // 바닥은 카드 배경보다 아주 살짝 눌러 입체감의 기준면을 만든다
    floor: dark ? '#171b22' : '#f4f6f9',
    tooltipBg: theme.tooltipBg,
    tooltipBorder: theme.tooltipBorder,
    tooltipInk: theme.tooltipInk,
  }
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`frontend/src/components/chart3d/axes.test.ts`:

```ts
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildAxes, disposeObject, makeTextSprite } from './axes'
import type { Chart3DPalette } from './chart3dTheme'

const PALETTE: Chart3DPalette = {
  grid: '#e9ecf1',
  axis: '#8a93a2',
  label: '#8a93a2',
  floor: '#f4f6f9',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e4e7ec',
  tooltipInk: '#12161c',
}

describe('makeTextSprite', () => {
  it('2D 컨텍스트가 없는 환경(jsdom)에서도 스프라이트를 돌려준다', () => {
    const sprite = makeTextSprite('12', '#000000')
    expect(sprite).toBeInstanceOf(THREE.Sprite)
    disposeObject(sprite)
  })
})

describe('buildAxes', () => {
  it('바닥면·가이드선·라벨을 담은 그룹을 만든다', () => {
    const group = buildAxes({
      max: 100,
      depth: 2,
      xLabels: ['00', '06', '12', '18'],
      palette: PALETTE,
    })
    expect(group).toBeInstanceOf(THREE.Group)
    // 바닥면 1개 + 가이드선 1개 + y눈금 5개 + x라벨 4개
    expect(group.children.length).toBe(11)
    disposeObject(group)
  })

  it('x 라벨이 많으면 솎아낸다', () => {
    const labels = Array.from({ length: 24 }, (_, i) => String(i))
    const group = buildAxes({ max: 50, depth: 2, xLabels: labels, palette: PALETTE })
    const sprites = group.children.filter((c) => c instanceof THREE.Sprite)
    // y눈금 5개 + 솎아낸 x라벨(최대 7개)
    expect(sprites.length).toBeLessThanOrEqual(12)
    expect(sprites.length).toBeGreaterThan(5)
    disposeObject(group)
  })
})

describe('disposeObject', () => {
  it('자식의 geometry와 material을 정리한다', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const mesh = new THREE.Mesh(geometry, material)
    let disposed = 0
    geometry.addEventListener('dispose', () => (disposed += 1))
    material.addEventListener('dispose', () => (disposed += 1))
    disposeObject(mesh)
    expect(disposed).toBe(2)
  })
})
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm run test -- axes`
Expected: FAIL — `Failed to resolve import "./axes"`

- [ ] **Step 4: 구현 작성**

`frontend/src/components/chart3d/axes.ts`:

```ts
import * as THREE from 'three'
import { WORLD, axisTicks, pickLabelIndexes } from './scale'
import type { Chart3DPalette } from './chart3dTheme'

/** x축 라벨 최대 개수 — 이보다 많으면 솎아낸다 */
const MAX_X_LABELS = 6
/** y축 눈금 구간 수 (라벨은 +1개) */
const Y_TICK_STEPS = 4

/**
 * 글자를 캔버스에 그려 스프라이트로 만든다.
 * 스프라이트는 항상 카메라를 향하므로 회전해도 글자가 읽힌다.
 *
 * jsdom에는 2D 컨텍스트가 없다. 그때는 빈 텍스처로 돌려주고 예외를 내지 않는다.
 */
export function makeTextSprite(text: string, color: string): THREE.Sprite {
  const scale = 2 // 확대해도 흐려지지 않게 2배로 그린다
  const fontSize = 26 * scale
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  let widthPx = text.length * fontSize * 0.6
  if (ctx) {
    ctx.font = `500 ${fontSize}px Pretendard, sans-serif`
    widthPx = Math.ceil(ctx.measureText(text).width) + 8
  }
  canvas.width = Math.max(2, widthPx)
  canvas.height = fontSize * 1.4

  if (ctx) {
    ctx.font = `500 ${fontSize}px Pretendard, sans-serif`
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(material)
  // 월드 단위로 환산 — 높이 0.34가 카드 안에서 11px 정도로 보인다
  const worldHeight = 0.34
  sprite.scale.set((canvas.width / canvas.height) * worldHeight, worldHeight, 1)
  sprite.renderOrder = 10
  return sprite
}

export interface BuildAxesOptions {
  /** y축 상한 */
  max: number
  /** 씬 깊이 (z 방향 폭) */
  depth: number
  xLabels: string[]
  palette: Chart3DPalette
}

/**
 * 바닥면, y축 가이드선, 눈금·x축 라벨을 담은 그룹을 만든다.
 * 반환한 그룹은 씬에 add 한 뒤 disposeObject로 정리한다.
 */
export function buildAxes({ max, depth, xLabels, palette }: BuildAxesOptions): THREE.Group {
  const group = new THREE.Group()
  const halfW = WORLD.width / 2
  const halfD = Math.max(depth, 1) / 2

  // 바닥면
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.width + 0.6, depth + 1.2),
    new THREE.MeshBasicMaterial({ color: palette.floor, transparent: true, opacity: 0.9 }),
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  group.add(floor)

  // y 눈금 위치의 가로 가이드선 — 뒷벽에 하나씩 긋는다
  const ticks = axisTicks(max, Y_TICK_STEPS)
  const points: number[] = []
  for (const tick of ticks) {
    const y = (tick / max) * WORLD.height
    points.push(-halfW, y, -halfD - 0.6, halfW, y, -halfD - 0.6)
  }
  const guideGeometry = new THREE.BufferGeometry()
  guideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
  group.add(
    new THREE.LineSegments(
      guideGeometry,
      new THREE.LineBasicMaterial({ color: palette.grid, transparent: true, opacity: 0.9 }),
    ),
  )

  // y 눈금 라벨
  for (const tick of ticks) {
    const sprite = makeTextSprite(formatTick(tick), palette.label)
    sprite.position.set(-halfW - 0.45, (tick / max) * WORLD.height, -halfD - 0.6)
    group.add(sprite)
  }

  // x축 라벨 (겹치지 않게 솎아낸다)
  for (const i of pickLabelIndexes(xLabels.length, MAX_X_LABELS)) {
    const slot = WORLD.width / Math.max(1, xLabels.length)
    const sprite = makeTextSprite(xLabels[i], palette.label)
    sprite.position.set(-halfW + slot * (i + 0.5), -0.28, halfD + 0.35)
    group.add(sprite)
  }

  return group
}

/** 눈금 숫자를 짧게 — 정수면 소수점을 붙이지 않는다 */
function formatTick(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

/** 오브젝트 트리의 geometry·material·texture를 모두 폐기한다 */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as Partial<THREE.Mesh> & Partial<THREE.Sprite>
    mesh.geometry?.dispose?.()
    const material = mesh.material
    const materials = Array.isArray(material) ? material : material ? [material] : []
    for (const m of materials) {
      const map = (m as THREE.SpriteMaterial).map
      map?.dispose?.()
      m.dispose()
    }
  })
  root.removeFromParent()
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- axes`
Expected: PASS (4 tests)

`buildAxes` 첫 테스트의 자식 수 11개가 맞지 않으면, 실제 구성(바닥 1 + 가이드선 1 + y라벨 5 + x라벨 4)을 세어 테스트 숫자를 맞춘다. 구현을 바꾸지 말고 기대값을 맞춘다.

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/chart3d/
git commit -m "3D 차트 기반: 테마 매핑과 축·라벨 구성 추가"
```

---

## Task 3: 씬 생명주기 훅

**Files:**
- Create: `frontend/src/components/chart3d/useChart3DScene.ts`

**Interfaces:**
- Consumes: `WORLD` (Task 1), `disposeObject` (Task 2)
- Produces:
  - `Chart3DContext { scene, camera, invalidate, raycaster, pointer }`
  - `Chart3DBuild { animate?, hover?, dispose }`
  - `Chart3DTooltip { x, y, title, rows }`
  - `detectWebGL2(): boolean`
  - `prefersReducedMotion(): boolean`
  - `useChart3DScene(options: UseChart3DSceneOptions): UseChart3DSceneResult`
  - `UseChart3DSceneOptions { build: (ctx: Chart3DContext) => Chart3DBuild; deps: unknown[]; enabled: boolean }`
  - `UseChart3DSceneResult { canvasRef, containerRef, failed, tooltip }`

이 훅은 jsdom에 WebGL이 없어 단위 테스트로 씬을 검증할 수 없다. 대신 `detectWebGL2`가 false를 돌려주는 경로를 Task 4의 `Chart3DCanvas` 테스트에서 확인한다.

- [ ] **Step 1: 구현 작성**

`frontend/src/components/chart3d/useChart3DScene.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { WORLD } from './scale'

/** 차트 구현이 씬을 채울 때 받는 도구 */
export interface Chart3DContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  /** 한 프레임 다시 그리도록 요청한다 */
  invalidate: () => void
  raycaster: THREE.Raycaster
  /** 캔버스 기준 NDC 포인터 (-1~1) */
  pointer: THREE.Vector2
}

/** 캔버스 위에 띄울 툴팁 내용 */
export interface Chart3DTooltip {
  /** 캔버스 좌상단 기준 px */
  x: number
  y: number
  title: string
  rows: Array<{ label: string; value: string; color: string }>
}

/** 차트 구현이 훅에 돌려주는 것 */
export interface Chart3DBuild {
  /**
   * 진입·보간 애니메이션. 씬을 만든 뒤 흐른 시간(ms)을 받는다.
   * 아직 진행 중이면 true를 돌려주고, 그러면 훅이 다음 프레임을 예약한다.
   */
  animate?: (elapsedMs: number) => boolean
  /** 포인터가 움직였을 때 호출. 툴팁 내용을 돌려주거나 없으면 null */
  hover?: (ctx: Chart3DContext) => Chart3DTooltip | null
  dispose: () => void
}

export interface UseChart3DSceneOptions {
  build: (ctx: Chart3DContext) => Chart3DBuild
  /** 이 값이 바뀌면 씬을 다시 만든다 */
  deps: unknown[]
  /** false면 아무것도 만들지 않는다 (폴백 중) */
  enabled: boolean
}

export interface UseChart3DSceneResult {
  containerRef: React.RefObject<HTMLDivElement | null>
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  /** WebGL을 쓸 수 없게 되면 true — 폴백으로 전환한다 */
  failed: boolean
  tooltip: Chart3DTooltip | null
}

/** WebGL2 컨텍스트를 만들 수 있는지 확인한다 */
export function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const canvas = document.createElement('canvas')
    return canvas.getContext('webgl2') != null
  } catch {
    return false
  }
}

/** 사용자가 모션 최소화를 켰는지 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// 카메라 회전 제한 (라디안)
const AZIMUTH_LIMIT = THREE.MathUtils.degToRad(35)
const POLAR_MIN = THREE.MathUtils.degToRad(55)
const POLAR_MAX = THREE.MathUtils.degToRad(80)
const CAMERA_RADIUS = 14.5

/**
 * three 렌더러·씬·카메라의 생명주기를 한곳에서 맡는다.
 *
 * 렌더 루프는 상시 돌지 않는다. 진입 애니메이션 중, 드래그 중, 호버 시,
 * 리사이즈·테마 변경 시에만 그린다. 유휴 상태에서는 GPU를 쓰지 않는다.
 */
export function useChart3DScene({
  build,
  deps,
  enabled,
}: UseChart3DSceneOptions): UseChart3DSceneResult {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [failed, setFailed] = useState(false)
  const [tooltip, setTooltip] = useState<Chart3DTooltip | null>(null)

  // build는 매 렌더마다 새 함수가 되므로 ref로 최신값만 들고 간다
  const buildRef = useRef(build)
  buildRef.current = build

  const fail = useCallback(() => setFailed(true), [])

  useEffect(() => {
    if (!enabled || failed) return
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    } catch {
      setFailed(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearAlpha(0)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    const target = new THREE.Vector3(0, WORLD.height * 0.35, 0)

    // 초기 시점 — 살짝 왼쪽 위에서 내려다본다
    let azimuth = THREE.MathUtils.degToRad(-20)
    let polar = THREE.MathUtils.degToRad(68)

    function placeCamera() {
      camera.position.set(
        target.x + CAMERA_RADIUS * Math.sin(polar) * Math.sin(azimuth),
        target.y + CAMERA_RADIUS * Math.cos(polar),
        target.z + CAMERA_RADIUS * Math.sin(polar) * Math.cos(azimuth),
      )
      camera.lookAt(target)
    }
    placeCamera()

    scene.add(new THREE.AmbientLight(0xffffff, 1.6))
    const key = new THREE.DirectionalLight(0xffffff, 2.1)
    key.position.set(6, 12, 8)
    scene.add(key)

    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2(-2, -2)

    let frame = 0
    let pending = false
    const startedAt = performance.now()

    function draw() {
      pending = false
      renderer.render(scene, camera)
      if (built.animate?.(performance.now() - startedAt)) invalidate()
    }

    function invalidate() {
      if (pending) return
      pending = true
      frame = requestAnimationFrame(draw)
    }

    const ctx: Chart3DContext = { scene, camera, invalidate, raycaster, pointer }
    const built = buildRef.current(ctx)

    // ── 크기 맞추기 ─────────────────────────────
    function resize() {
      const { clientWidth, clientHeight } = container!
      if (clientWidth === 0 || clientHeight === 0) return
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      camera.updateProjectionMatrix()
      invalidate()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    // ── 화면 밖이면 그리지 않는다 ────────────────
    let visible = true
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting
        if (visible) invalidate()
      },
      { threshold: 0 },
    )
    io.observe(container)

    // ── 드래그 회전 ─────────────────────────────
    let dragging = false
    let lastX = 0
    let lastY = 0

    function onPointerDown(e: PointerEvent) {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      canvas!.setPointerCapture(e.pointerId)
      canvas!.style.cursor = 'grabbing'
    }

    function onPointerMove(e: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      if (dragging) {
        azimuth = THREE.MathUtils.clamp(
          azimuth - (e.clientX - lastX) * 0.005,
          -AZIMUTH_LIMIT,
          AZIMUTH_LIMIT,
        )
        polar = THREE.MathUtils.clamp(
          polar - (e.clientY - lastY) * 0.004,
          POLAR_MIN,
          POLAR_MAX,
        )
        lastX = e.clientX
        lastY = e.clientY
        placeCamera()
        setTooltip(null)
        invalidate()
        return
      }
      if (!built.hover || !visible) return
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      const next = built.hover(ctx)
      setTooltip(next)
      invalidate()
    }

    function endDrag(e: PointerEvent) {
      if (!dragging) return
      dragging = false
      canvas!.releasePointerCapture(e.pointerId)
      canvas!.style.cursor = 'grab'
    }

    function onPointerLeave() {
      pointer.set(-2, -2)
      if (built.hover) built.hover(ctx)
      setTooltip(null)
      invalidate()
    }

    canvas.style.cursor = 'grab'
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('webglcontextlost', fail)

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      io.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('webglcontextlost', fail)
      built.dispose()
      renderer.dispose()
      setTooltip(null)
    }
    // deps가 바뀌면 씬을 통째로 다시 만든다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, failed, fail, ...deps])

  return { containerRef, canvasRef, failed, tooltip }
}
```

- [ ] **Step 2: 타입 검사**

Run: `npx tsc -b`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/chart3d/useChart3DScene.ts
git commit -m "3D 차트 기반: 씬 생명주기 훅 추가"
```

---

## Task 4: 캔버스 껍데기와 폴백

**Files:**
- Create: `frontend/src/components/chart3d/Chart3DCanvas.tsx`
- Test: `frontend/src/components/chart3d/Chart3DCanvas.test.tsx`

**Interfaces:**
- Consumes: `useChart3DScene`, `detectWebGL2`, `prefersReducedMotion`, `Chart3DBuild`, `Chart3DContext` (Task 3), `useChart3DPalette` (Task 2)
- Produces:
  - `Chart3DCanvasProps { height: number; ariaLabel: string; fallback: ReactNode; build: (ctx: Chart3DContext) => Chart3DBuild; deps: unknown[]; legend?: ReactNode }`
  - `export default function Chart3DCanvas(props: Chart3DCanvasProps)`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/chart3d/Chart3DCanvas.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Chart3DCanvas from './Chart3DCanvas'

/** jsdom에는 WebGL이 없다. getContext를 명시적으로 null로 막아 로그를 조용히 한다. */
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

describe('Chart3DCanvas', () => {
  it('WebGL을 못 쓰면 폴백을 렌더한다', () => {
    render(
      <Chart3DCanvas
        height={260}
        ariaLabel="테스트 차트"
        fallback={<p>2D 차트</p>}
        build={() => ({ dispose: () => {} })}
        deps={[]}
      />,
    )
    expect(screen.getByText('2D 차트')).toBeInTheDocument()
    expect(screen.queryByLabelText('테스트 차트')).not.toBeInTheDocument()
  })

  it('WebGL을 못 쓰면 build를 호출하지 않는다', () => {
    const build = vi.fn(() => ({ dispose: () => {} }))
    render(
      <Chart3DCanvas
        height={260}
        ariaLabel="테스트 차트"
        fallback={<p>2D 차트</p>}
        build={build}
        deps={[]}
      />,
    )
    expect(build).not.toHaveBeenCalled()
  })

  it('모션 최소화 설정이면 폴백을 렌더한다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as RenderingContext,
    )
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query.includes('prefers-reduced-motion'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          onchange: null,
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList,
    )
    render(
      <Chart3DCanvas
        height={260}
        ariaLabel="테스트 차트"
        fallback={<p>2D 차트</p>}
        build={() => ({ dispose: () => {} })}
        deps={[]}
      />,
    )
    expect(screen.getByText('2D 차트')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test -- Chart3DCanvas`
Expected: FAIL — `Failed to resolve import "./Chart3DCanvas"`

- [ ] **Step 3: 구현 작성**

`frontend/src/components/chart3d/Chart3DCanvas.tsx`:

```tsx
import { useMemo, type ReactNode } from 'react'
import { useChart3DPalette } from './chart3dTheme'
import {
  detectWebGL2,
  prefersReducedMotion,
  useChart3DScene,
  type Chart3DBuild,
  type Chart3DContext,
} from './useChart3DScene'

export interface Chart3DCanvasProps {
  height: number
  /** 스크린리더가 읽을 요약 (최대·최소·평균 등) */
  ariaLabel: string
  /** WebGL을 못 쓸 때 대신 보여줄 기존 2D 차트 */
  fallback: ReactNode
  build: (ctx: Chart3DContext) => Chart3DBuild
  deps: unknown[]
  /** 캔버스 아래에 붙일 범례 */
  legend?: ReactNode
}

/**
 * 3D 차트의 공통 껍데기.
 *
 * WebGL2를 못 쓰거나, 사용자가 모션 최소화를 켰거나, 렌더 도중 컨텍스트를 잃으면
 * fallback(기존 recharts 차트)을 그대로 렌더한다. 2D 코드는 지우지 않고 안전망으로 남긴다.
 */
export default function Chart3DCanvas({
  height,
  ariaLabel,
  fallback,
  build,
  deps,
  legend,
}: Chart3DCanvasProps) {
  const palette = useChart3DPalette()
  // 검사 결과는 마운트 시점에 한 번만 굳힌다
  const supported = useMemo(() => detectWebGL2() && !prefersReducedMotion(), [])
  const { containerRef, canvasRef, failed, tooltip } = useChart3DScene({
    build,
    deps,
    enabled: supported,
  })

  if (!supported || failed) return <>{fallback}</>

  return (
    <div>
      <div ref={containerRef} className="relative w-full" style={{ height }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={ariaLabel}
          className="block h-full w-full touch-none"
        />
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-[10px] px-2.5 py-1.5 text-xs shadow-lg"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              backgroundColor: palette.tooltipBg,
              border: `1px solid ${palette.tooltipBorder}`,
              color: palette.tooltipInk,
            }}
          >
            <p className="font-semibold">{tooltip.title}</p>
            {tooltip.rows.map((row) => (
              <p key={row.label} className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span>{row.label}</span>
                <span className="num ml-auto font-medium">{row.value}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      {legend}
      <p className="mt-1 text-center text-[0.6875rem] text-ink-faint">
        드래그하면 각도를 바꿀 수 있습니다
      </p>
    </div>
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- Chart3DCanvas`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/components/chart3d/Chart3DCanvas.tsx frontend/src/components/chart3d/Chart3DCanvas.test.tsx
git commit -m "3D 차트 기반: 캔버스 껍데기와 2D 폴백 추가"
```

---

## Task 5: 3D 막대 차트

**Files:**
- Create: `frontend/src/components/chart3d/Bar3DChart.tsx`
- Test: `frontend/src/components/chart3d/Bar3DChart.test.tsx`

**Interfaces:**
- Consumes: `Chart3DCanvas` (Task 4), `WORLD`·`axisMaxFor`·`barSlot`·`seriesZ` (Task 1), `buildAxes`·`disposeObject` (Task 2), `useChart3DPalette` (Task 2), `gradeOf` (`config/grades.ts`)
- Produces:
  - `Bar3DSeries { key: string; name: string; color?: string }` — `color`가 없으면 막대마다 값의 등급색을 쓴다
  - `Bar3DChartProps { data, xKey, series, height, unit, fallback }`
  - `export default function Bar3DChart(props: Bar3DChartProps)`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/chart3d/Bar3DChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Bar3DChart from './Bar3DChart'

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

const DATA = [
  { time: '00', avgPm25: 12 },
  { time: '01', avgPm25: 31 },
]

describe('Bar3DChart', () => {
  it('WebGL이 없으면 넘겨받은 2D 차트를 그대로 렌더한다', () => {
    render(
      <Bar3DChart
        data={DATA}
        xKey="time"
        series={[{ key: 'avgPm25', name: '평균 PM2.5' }]}
        height={260}
        unit="㎍/㎥"
        fallback={<p>기존 2D 차트</p>}
      />,
    )
    expect(screen.getByText('기존 2D 차트')).toBeInTheDocument()
  })

  it('데이터가 비면 폴백을 렌더한다', () => {
    render(
      <Bar3DChart
        data={[]}
        xKey="time"
        series={[{ key: 'avgPm25', name: '평균 PM2.5' }]}
        height={260}
        fallback={<p>기존 2D 차트</p>}
      />,
    )
    expect(screen.getByText('기존 2D 차트')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test -- Bar3DChart`
Expected: FAIL — `Failed to resolve import "./Bar3DChart"`

- [ ] **Step 3: 구현 작성**

`frontend/src/components/chart3d/Bar3DChart.tsx`:

```tsx
import { useCallback, type ReactNode } from 'react'
import * as THREE from 'three'
import { gradeOf } from '../../config/grades'
import Chart3DCanvas from './Chart3DCanvas'
import { buildAxes, disposeObject } from './axes'
import { useChart3DPalette } from './chart3dTheme'
import { WORLD, axisMaxFor, barSlot, seriesZ } from './scale'
import type { Chart3DBuild, Chart3DContext, Chart3DTooltip } from './useChart3DScene'

export interface Bar3DSeries {
  /** 데이터 객체에서 값을 꺼낼 필드명 */
  key: string
  name: string
  /** 비우면 막대마다 그 값의 등급색을 쓴다 */
  color?: string
}

export interface Bar3DChartProps {
  data: Array<Record<string, unknown>>
  /** x축 라벨로 쓸 필드명 */
  xKey: string
  /** 1~2개 */
  series: Bar3DSeries[]
  height: number
  unit?: string
  fallback: ReactNode
}

/** 진입 애니메이션 — 막대 하나당 지연(ms)과 상승 시간(ms) */
const STAGGER_MS = 20
const RISE_MS = 500
/** 호버 시 밝기를 이만큼 올린다 */
const HOVER_LIFT = 0.35

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function numberAt(row: Record<string, unknown>, key: string): number {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * 시계열을 3D 막대 그리드로 그린다.
 * 계열이 둘이면 Z축 앞뒤로 갈라 겹치지 않게 비교한다.
 */
export default function Bar3DChart({
  data,
  xKey,
  series,
  height,
  unit = '',
  fallback,
}: Bar3DChartProps) {
  const palette = useChart3DPalette()

  const build = useCallback(
    (ctx: Chart3DContext): Chart3DBuild => {
      const values = series.flatMap((s) => data.map((row) => numberAt(row, s.key)))
      const max = axisMaxFor(values)
      const xLabels = data.map((row) => String(row[xKey] ?? ''))
      const depth = Math.max(WORLD.seriesDepth * series.length, 1.2)

      const axes = buildAxes({ max, depth, xLabels, palette })
      ctx.scene.add(axes)

      // 원점이 밑면에 오도록 옮긴다 — scale.y가 곧 막대 높이가 된다
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      geometry.translate(0, 0.5, 0)

      const dummy = new THREE.Object3D()
      const color = new THREE.Color()

      /** 계열별 인스턴스 메시와, 각 인스턴스의 목표 높이·기본색 */
      const layers = series.map((s, si) => {
        const material = new THREE.MeshLambertMaterial()
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(data.length, 1))
        mesh.count = data.length
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

        const targets: number[] = []
        const baseColors: THREE.Color[] = []
        const z = seriesZ(si, series.length)

        data.forEach((row, i) => {
          const value = numberAt(row, s.key)
          targets.push((value / max) * WORLD.height)
          // 계열색이 없으면 값 자체를 등급색으로 칠한다
          baseColors.push(new THREE.Color(s.color ?? gradeOf(value).chart))
          const slot = barSlot(i, data.length)
          dummy.position.set(slot.x, 0, z)
          dummy.scale.set(slot.width, 0.0001, Math.min(slot.width, WORLD.seriesDepth * 0.7))
          dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
          mesh.setColorAt(i, baseColors[i])
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        ctx.scene.add(mesh)
        return { series: s, mesh, targets, baseColors, z }
      })

      /** 인스턴스 i의 높이를 h로 다시 그린다 */
      function applyHeight(layerIndex: number, i: number, h: number) {
        const layer = layers[layerIndex]
        const slot = barSlot(i, data.length)
        dummy.position.set(slot.x, 0, layer.z)
        dummy.scale.set(slot.width, Math.max(h, 0.0001), Math.min(slot.width, WORLD.seriesDepth * 0.7))
        dummy.updateMatrix()
        layer.mesh.setMatrixAt(i, dummy.matrix)
      }

      let hovered: { layer: number; index: number } | null = null

      const buildResult: Chart3DBuild = {
        animate(elapsed) {
          let running = false
          layers.forEach((layer, li) => {
            layer.targets.forEach((target, i) => {
              const t = Math.min(Math.max((elapsed - i * STAGGER_MS) / RISE_MS, 0), 1)
              if (t < 1) running = true
              applyHeight(li, i, target * easeOutCubic(t))
            })
            layer.mesh.instanceMatrix.needsUpdate = true
          })
          return running
        },

        hover() {
          ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera)
          const hits = layers.flatMap((layer, li) =>
            ctx.raycaster
              .intersectObject(layer.mesh)
              .map((hit) => ({ hit, li, index: hit.instanceId ?? -1 })),
          )
          hits.sort((a, b) => a.hit.distance - b.hit.distance)
          const top = hits.find((h) => h.index >= 0) ?? null

          // 이전 강조를 되돌린다
          if (hovered && (!top || hovered.layer !== top.li || hovered.index !== top.index)) {
            const prev = layers[hovered.layer]
            prev.mesh.setColorAt(hovered.index, prev.baseColors[hovered.index])
            if (prev.mesh.instanceColor) prev.mesh.instanceColor.needsUpdate = true
            hovered = null
          }
          if (!top) return null

          if (!hovered) {
            const layer = layers[top.li]
            color.copy(layer.baseColors[top.index]).lerp(new THREE.Color(0xffffff), HOVER_LIFT)
            layer.mesh.setColorAt(top.index, color)
            if (layer.mesh.instanceColor) layer.mesh.instanceColor.needsUpdate = true
            hovered = { layer: top.li, index: top.index }
          }

          // 막대 꼭대기를 화면 좌표로 옮겨 툴팁 위치를 잡는다
          const projected = top.hit.point.clone().project(ctx.camera)
          const canvas = ctx.camera.userData.canvasSize as { w: number; h: number } | undefined
          const w = canvas?.w ?? 1
          const h = canvas?.h ?? 1
          const index = top.index
          const tooltip: Chart3DTooltip = {
            x: ((projected.x + 1) / 2) * w,
            y: ((1 - projected.y) / 2) * h,
            title: String(data[index]?.[xKey] ?? ''),
            rows: layers.map((layer) => ({
              label: layer.series.name,
              value: `${numberAt(data[index], layer.series.key).toFixed(1)}${unit ? ` ${unit}` : ''}`,
              color: layer.series.color ?? gradeOf(numberAt(data[index], layer.series.key)).chart,
            })),
          }
          return tooltip
        },

        dispose() {
          disposeObject(axes)
          for (const layer of layers) {
            layer.mesh.removeFromParent()
            layer.mesh.dispose()
            ;(layer.mesh.material as THREE.Material).dispose()
          }
          geometry.dispose()
        },
      }
      return buildResult
    },
    [data, xKey, series, unit, palette],
  )

  if (data.length === 0) return <>{fallback}</>

  const flat = series.flatMap((s) => data.map((row) => numberAt(row, s.key)))
  const summary =
    flat.length > 0
      ? `최소 ${Math.min(...flat).toFixed(1)}, 최대 ${Math.max(...flat).toFixed(1)}, 평균 ${(
          flat.reduce((a, b) => a + b, 0) / flat.length
        ).toFixed(1)}${unit ? ` ${unit}` : ''}`
      : '데이터 없음'

  return (
    <Chart3DCanvas
      height={height}
      ariaLabel={`${series.map((s) => s.name).join(', ')} 3차원 막대 그래프. ${summary}`}
      fallback={fallback}
      build={build}
      deps={[data, xKey, series, palette]}
      legend={
        series.length > 1 ? (
          <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-ink-muted">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: s.color ?? '#94a3b8' }}
                />
                {s.name}
              </span>
            ))}
          </div>
        ) : undefined
      }
    />
  )
}
```

- [ ] **Step 4: 캔버스 크기를 카메라에 실어 보내기**

툴팁 위치 계산이 캔버스 픽셀 크기를 필요로 한다. `useChart3DScene.ts`의 `resize()` 안에서 `camera.userData.canvasSize`를 갱신하도록 한 줄 추가한다.

`useChart3DScene.ts`의 `resize` 함수에서 `camera.updateProjectionMatrix()` 바로 앞에 넣는다:

```ts
      // 툴팁 위치 계산에 쓰라고 캔버스 픽셀 크기를 실어 보낸다
      camera.userData.canvasSize = { w: clientWidth, h: clientHeight }
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test -- Bar3DChart`
Expected: PASS (2 tests)

- [ ] **Step 6: 타입 검사**

Run: `npx tsc -b`
Expected: 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add frontend/src/components/chart3d/
git commit -m "3D 막대 차트 컴포넌트 추가"
```

---

## Task 6: 3D 산점도

**Files:**
- Create: `frontend/src/components/chart3d/Scatter3DChart.tsx`
- Test: `frontend/src/components/chart3d/Scatter3DChart.test.tsx`

**Interfaces:**
- Consumes: `Chart3DCanvas` (Task 4), `WORLD`·`axisTicks` (Task 1), `makeTextSprite`·`disposeObject` (Task 2), `useChart3DPalette` (Task 2). 산점도는 축 구성이 막대와 달라 `buildAxes`를 쓰지 않고 자체로 그린다.
- Produces:
  - `Scatter3DPoint { x: number; y: number; z: number; label?: string }` — `z`는 0~1로 정규화된 시간 위치 (1이 최신)
  - `Scatter3DSeries { name: string; color: string; points: Scatter3DPoint[] }`
  - `Scatter3DChartProps { series, axisMax, height, xLabel, yLabel, zLabel, fallback }`
  - `export default function Scatter3DChart(props: Scatter3DChartProps)`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/src/components/chart3d/Scatter3DChart.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Scatter3DChart from './Scatter3DChart'

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

const SERIES = [
  {
    name: 'cnn-lite',
    color: '#4f46e5',
    points: [
      { x: 12, y: 14, z: 0, label: '남동구' },
      { x: 30, y: 27, z: 1, label: '연수구' },
    ],
  },
]

describe('Scatter3DChart', () => {
  it('WebGL이 없으면 넘겨받은 2D 차트를 그대로 렌더한다', () => {
    render(
      <Scatter3DChart
        series={SERIES}
        axisMax={50}
        height={360}
        xLabel="실측"
        yLabel="예측"
        zLabel="시간"
        fallback={<p>기존 산점도</p>}
      />,
    )
    expect(screen.getByText('기존 산점도')).toBeInTheDocument()
  })

  it('점이 하나도 없으면 폴백을 렌더한다', () => {
    render(
      <Scatter3DChart
        series={[{ name: 'cnn-lite', color: '#4f46e5', points: [] }]}
        axisMax={50}
        height={360}
        xLabel="실측"
        yLabel="예측"
        zLabel="시간"
        fallback={<p>기존 산점도</p>}
      />,
    )
    expect(screen.getByText('기존 산점도')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `npm run test -- Scatter3DChart`
Expected: FAIL — `Failed to resolve import "./Scatter3DChart"`

- [ ] **Step 3: 구현 작성**

`frontend/src/components/chart3d/Scatter3DChart.tsx`:

```tsx
import { useCallback, type ReactNode } from 'react'
import * as THREE from 'three'
import Chart3DCanvas from './Chart3DCanvas'
import { disposeObject, makeTextSprite } from './axes'
import { useChart3DPalette } from './chart3dTheme'
import { WORLD, axisTicks } from './scale'
import type { Chart3DBuild, Chart3DContext, Chart3DTooltip } from './useChart3DScene'

export interface Scatter3DPoint {
  /** 실측값 */
  x: number
  /** 예측값 */
  y: number
  /** 0~1로 정규화된 시간 위치. 1이 가장 최근이다. */
  z: number
  label?: string
}

export interface Scatter3DSeries {
  name: string
  color: string
  points: Scatter3DPoint[]
}

export interface Scatter3DChartProps {
  series: Scatter3DSeries[]
  axisMax: number
  height: number
  xLabel: string
  yLabel: string
  zLabel: string
  fallback: ReactNode
}

/** 씬의 z 방향 폭 — 시간축이므로 계열 간격보다 넉넉히 준다 */
const TIME_DEPTH = 5
const POINT_RADIUS = 0.13
const GROW_MS = 600
const STAGGER_MS = 4
const HOVER_LIFT = 0.4

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * 예측 vs 실측 산점도를 3D로 그린다.
 * X=실측, Y=예측, Z=시간이라서 2D에서 겹쳐 보이던 점이 시간축으로 풀린다.
 * y=x 기준면에 가까울수록 정확한 예측이다.
 */
export default function Scatter3DChart({
  series,
  axisMax,
  height,
  xLabel,
  yLabel,
  zLabel,
  fallback,
}: Scatter3DChartProps) {
  const palette = useChart3DPalette()

  const build = useCallback(
    (ctx: Chart3DContext): Chart3DBuild => {
      const group = new THREE.Group()
      const half = WORLD.width / 2
      const halfD = TIME_DEPTH / 2
      const toX = (v: number) => (v / axisMax) * WORLD.width - half
      const toY = (v: number) => (v / axisMax) * WORLD.height
      const toZ = (v: number) => halfD - v * TIME_DEPTH

      // y=x 기준면 — 이 면에 붙어 있을수록 정확하다
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.hypot(WORLD.width, WORLD.height), TIME_DEPTH),
        new THREE.MeshBasicMaterial({
          color: palette.axis,
          transparent: true,
          opacity: 0.14,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      )
      plane.rotation.y = Math.PI / 2
      plane.rotation.z = Math.atan2(WORLD.height, WORLD.width)
      plane.position.set(0, WORLD.height / 2, 0)
      group.add(plane)

      // 바닥면
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(WORLD.width + 0.6, TIME_DEPTH + 0.6),
        new THREE.MeshBasicMaterial({ color: palette.floor, transparent: true, opacity: 0.9 }),
      )
      floor.rotation.x = -Math.PI / 2
      floor.position.y = -0.01
      group.add(floor)

      // x·y 눈금 가이드선과 라벨
      const ticks = axisTicks(axisMax, 4)
      const guide: number[] = []
      for (const tick of ticks) {
        guide.push(-half, toY(tick), -halfD, half, toY(tick), -halfD)
        guide.push(toX(tick), 0, -halfD, toX(tick), 0, halfD)
      }
      const guideGeometry = new THREE.BufferGeometry()
      guideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(guide, 3))
      group.add(
        new THREE.LineSegments(
          guideGeometry,
          new THREE.LineBasicMaterial({ color: palette.grid, transparent: true, opacity: 0.9 }),
        ),
      )

      for (const tick of ticks) {
        const ySprite = makeTextSprite(String(Math.round(tick)), palette.label)
        ySprite.position.set(-half - 0.45, toY(tick), -halfD)
        group.add(ySprite)

        const xSprite = makeTextSprite(String(Math.round(tick)), palette.label)
        xSprite.position.set(toX(tick), -0.28, halfD + 0.35)
        group.add(xSprite)
      }

      // 축 이름
      const xName = makeTextSprite(xLabel, palette.label)
      xName.position.set(0, -0.72, halfD + 0.35)
      group.add(xName)
      const yName = makeTextSprite(yLabel, palette.label)
      yName.position.set(-half - 0.45, WORLD.height + 0.4, -halfD)
      group.add(yName)
      const zName = makeTextSprite(`${zLabel} →`, palette.label)
      zName.position.set(half + 0.7, -0.28, 0)
      group.add(zName)

      ctx.scene.add(group)

      // 점 — 계열마다 인스턴스 메시 하나
      const geometry = new THREE.SphereGeometry(POINT_RADIUS, 12, 8)
      const dummy = new THREE.Object3D()
      const color = new THREE.Color()

      const layers = series.map((s) => {
        const material = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.88 })
        const mesh = new THREE.InstancedMesh(geometry, material, Math.max(s.points.length, 1))
        mesh.count = s.points.length
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        const base = new THREE.Color(s.color)
        s.points.forEach((_, i) => mesh.setColorAt(i, base))
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        ctx.scene.add(mesh)
        return { series: s, mesh, base }
      })

      function place(layerIndex: number, i: number, scale: number) {
        const layer = layers[layerIndex]
        const p = layer.series.points[i]
        dummy.position.set(toX(p.x), toY(p.y), toZ(p.z))
        dummy.scale.setScalar(Math.max(scale, 0.0001))
        dummy.updateMatrix()
        layer.mesh.setMatrixAt(i, dummy.matrix)
      }

      let hovered: { layer: number; index: number } | null = null

      return {
        animate(elapsed) {
          let running = false
          layers.forEach((layer, li) => {
            layer.series.points.forEach((_, i) => {
              const t = Math.min(Math.max((elapsed - i * STAGGER_MS) / GROW_MS, 0), 1)
              if (t < 1) running = true
              place(li, i, easeOutCubic(t))
            })
            layer.mesh.instanceMatrix.needsUpdate = true
          })
          return running
        },

        hover() {
          ctx.raycaster.setFromCamera(ctx.pointer, ctx.camera)
          const hits = layers.flatMap((layer, li) =>
            ctx.raycaster
              .intersectObject(layer.mesh)
              .map((hit) => ({ hit, li, index: hit.instanceId ?? -1 })),
          )
          hits.sort((a, b) => a.hit.distance - b.hit.distance)
          const top = hits.find((h) => h.index >= 0) ?? null

          if (hovered && (!top || hovered.layer !== top.li || hovered.index !== top.index)) {
            const prev = layers[hovered.layer]
            prev.mesh.setColorAt(hovered.index, prev.base)
            if (prev.mesh.instanceColor) prev.mesh.instanceColor.needsUpdate = true
            hovered = null
          }
          if (!top) return null

          const layer = layers[top.li]
          if (!hovered) {
            color.copy(layer.base).lerp(new THREE.Color(0xffffff), HOVER_LIFT)
            layer.mesh.setColorAt(top.index, color)
            if (layer.mesh.instanceColor) layer.mesh.instanceColor.needsUpdate = true
            hovered = { layer: top.li, index: top.index }
          }

          const point = layer.series.points[top.index]
          const projected = top.hit.point.clone().project(ctx.camera)
          const size = ctx.camera.userData.canvasSize as { w: number; h: number } | undefined
          const tooltip: Chart3DTooltip = {
            x: ((projected.x + 1) / 2) * (size?.w ?? 1),
            y: ((1 - projected.y) / 2) * (size?.h ?? 1),
            title: point.label ?? layer.series.name,
            rows: [
              { label: xLabel, value: point.x.toFixed(1), color: layer.series.color },
              { label: yLabel, value: point.y.toFixed(1), color: layer.series.color },
              {
                label: '오차',
                value: (point.y - point.x).toFixed(1),
                color: palette.axis,
              },
            ],
          }
          return tooltip
        },

        dispose() {
          disposeObject(group)
          for (const layer of layers) {
            layer.mesh.removeFromParent()
            layer.mesh.dispose()
            ;(layer.mesh.material as THREE.Material).dispose()
          }
          geometry.dispose()
        },
      }
    },
    [series, axisMax, xLabel, yLabel, zLabel, palette],
  )

  const total = series.reduce((a, s) => a + s.points.length, 0)
  if (total === 0) return <>{fallback}</>

  const errors = series.flatMap((s) => s.points.map((p) => Math.abs(p.y - p.x)))
  const mae = errors.reduce((a, b) => a + b, 0) / errors.length

  return (
    <Chart3DCanvas
      height={height}
      ariaLabel={`예측값과 실측값의 3차원 산점도. 점 ${total}개, 평균 절대오차 ${mae.toFixed(1)}. 기준면에 가까울수록 정확합니다.`}
      fallback={fallback}
      build={build}
      deps={[series, axisMax, palette]}
      legend={
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs text-ink-muted">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </span>
          ))}
        </div>
      }
    />
  )
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm run test -- Scatter3DChart`
Expected: PASS (2 tests)

- [ ] **Step 5: 타입 검사**

Run: `npx tsc -b`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/components/chart3d/
git commit -m "3D 산점도 컴포넌트 추가"
```

---

## Task 7: 지연 로딩 진입점

**Files:**
- Create: `frontend/src/components/chart3d/index.tsx`

**Interfaces:**
- Consumes: `Bar3DChart` (Task 5), `Scatter3DChart` (Task 6)
- Produces:
  - `LazyBar3DChart(props: Bar3DChartProps)` — three 번들을 내려받는 동안 `fallback`(2D 차트)을 보여준다
  - `LazyScatter3DChart(props: Scatter3DChartProps)`
  - 타입 재수출: `Bar3DSeries`, `Bar3DChartProps`, `Scatter3DPoint`, `Scatter3DSeries`, `Scatter3DChartProps`

- [ ] **Step 1: 구현 작성**

`frontend/src/components/chart3d/index.tsx`:

```tsx
import { Suspense, lazy } from 'react'
import type { Bar3DChartProps } from './Bar3DChart'
import type { Scatter3DChartProps } from './Scatter3DChart'

/**
 * three는 무겁다. 초기 번들에서 빼고, 내려받는 동안에는 각 차트가 이미 들고 있는
 * 2D 폴백을 그대로 보여준다. 그래서 화면이 비는 순간이 없다.
 */
const Bar3D = lazy(() => import('./Bar3DChart'))
const Scatter3D = lazy(() => import('./Scatter3DChart'))

export function LazyBar3DChart(props: Bar3DChartProps) {
  return (
    <Suspense fallback={props.fallback}>
      <Bar3D {...props} />
    </Suspense>
  )
}

export function LazyScatter3DChart(props: Scatter3DChartProps) {
  return (
    <Suspense fallback={props.fallback}>
      <Scatter3D {...props} />
    </Suspense>
  )
}

export type { Bar3DChartProps, Bar3DSeries } from './Bar3DChart'
export type {
  Scatter3DChartProps,
  Scatter3DPoint,
  Scatter3DSeries,
} from './Scatter3DChart'
```

- [ ] **Step 2: 타입 검사**

Run: `npx tsc -b`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add frontend/src/components/chart3d/index.tsx
git commit -m "3D 차트 지연 로딩 진입점 추가"
```

---

## Task 8: 대시보드 차트 2개 교체

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `LazyBar3DChart` (Task 7)
- Produces: 없음 (화면 변경)

기존 recharts 차트는 **지우지 않는다.** `fallback` prop으로 그대로 넘긴다.

- [ ] **Step 1: import 추가**

`frontend/src/pages/DashboardPage.tsx`의 `import RegionSelector ...` 아래에 넣는다:

```tsx
import { LazyBar3DChart } from '../components/chart3d'
```

- [ ] **Step 2: "시간별 평균 PM2.5" 차트를 3D로 감싸기**

현재 코드(`DashboardPage.tsx` 약 375~397행)의 `<ResponsiveContainer width="100%" height={260}> ... </ResponsiveContainer>` 블록 전체를 아래로 바꾼다. 기존 `ResponsiveContainer` 블록은 `fallback`으로 그대로 옮겨 담는다.

```tsx
            <LazyBar3DChart
              data={hourly}
              xKey="time"
              series={[{ key: 'avgPm25', name: '평균 PM2.5' }]}
              height={280}
              unit="㎍/㎥"
              fallback={
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={hourly}>
                    <defs>
                      <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={obsColor} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={obsColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="time" fontSize={11} stroke={chart.axis} tickLine={false} />
                    <YAxis fontSize={11} stroke={chart.axis} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipProps(chart)} />
                    <Area
                      type="monotone"
                      dataKey="avgPm25"
                      name="평균 PM2.5"
                      stroke={obsColor}
                      strokeWidth={2}
                      fill="url(#hourlyFill)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              }
            />
```

이 차트는 `series[].color`를 주지 않는다. 그래야 막대마다 값의 등급색이 칠해진다.

- [ ] **Step 3: "관측값과 AI 예측값 비교" 차트를 3D로 감싸기**

현재 코드(약 444~467행)의 `<ResponsiveContainer width="100%" height={260}> ... </ResponsiveContainer>` 블록을 아래로 바꾼다.

```tsx
            <LazyBar3DChart
              data={predictions.map((p, i) => ({ ...p, idx: String(i + 1) }))}
              xKey="idx"
              series={[
                { key: 'actualPm25', name: '관측값', color: obsColor },
                { key: 'predictedPm25', name: 'AI 예측값', color: aiColor },
              ]}
              height={300}
              unit="㎍/㎥"
              fallback={
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={predictions.map((p, i) => ({ ...p, idx: i + 1 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="idx" fontSize={11} stroke={chart.axis} tickLine={false} />
                    <YAxis fontSize={11} stroke={chart.axis} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipProps(chart)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      dataKey="actualPm25"
                      name="관측값"
                      stroke={obsColor}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      dataKey="predictedPm25"
                      name="AI 예측값"
                      stroke={aiColor}
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              }
            />
```

- [ ] **Step 4: 타입 검사와 테스트**

Run: `npx tsc -b && npm run test`
Expected: 타입 에러 없음, 기존 테스트 전부 통과

- [ ] **Step 5: 커밋**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "대시보드 시계열 차트 2개를 3D 막대로 교체"
```

---

## Task 9: 모델 정확도 산점도 교체

**Files:**
- Modify: `frontend/src/pages/MetricsPage.tsx`

**Interfaces:**
- Consumes: `LazyScatter3DChart`, `Scatter3DSeries` (Task 7)
- Produces: 없음 (화면 변경)

- [ ] **Step 1: import 추가**

`frontend/src/pages/MetricsPage.tsx` 상단 import 블록에 넣는다:

```tsx
import { LazyScatter3DChart } from '../components/chart3d'
import type { Scatter3DSeries } from '../components/chart3d'
```

- [ ] **Step 2: 시간축 정규화 계산 추가**

`const pointsShown = ...` (약 169행) 바로 아래에 넣는다. 모델이 여러 개여도 시간축이 서로 비교되도록 **전체 예측 시각**을 기준으로 정규화한다.

```tsx
  // Z축(시간) 정규화 — 모든 모델의 예측 시각을 한 범위에 놓아야 앞뒤 비교가 된다
  const allTimes = accuracy.models.flatMap((m) =>
    m.points.map((p) => new Date(p.predictedAt).getTime()),
  )
  const minTime = allTimes.length > 0 ? Math.min(...allTimes) : 0
  const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : 0
  const timeSpan = maxTime - minTime
  const scatterSeries: Scatter3DSeries[] = accuracy.models.map((m, i) => ({
    name: m.modelName,
    color: MODEL_COLORS[i % MODEL_COLORS.length],
    points: m.points.map((p) => ({
      x: p.actualPm25,
      y: p.predictedPm25,
      // 시각이 모두 같으면 한 면에 모아 놓는다
      z: timeSpan > 0 ? (new Date(p.predictedAt).getTime() - minTime) / timeSpan : 0.5,
      label: p.siteName,
    })),
  }))
```

- [ ] **Step 3: 산점도를 3D로 감싸기**

현재 코드(약 225~282행)의 `<ResponsiveContainer width="100%" height={360}> ... </ResponsiveContainer>` 블록을 아래로 바꾼다. 기존 블록은 `fallback`으로 그대로 옮겨 담는다.

```tsx
        <LazyScatter3DChart
          series={scatterSeries}
          axisMax={axisMax}
          height={400}
          xLabel="실측"
          yLabel="예측"
          zLabel="시간"
          fallback={
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis
                  type="number"
                  dataKey="actualPm25"
                  name="실측 PM2.5"
                  domain={[0, axisMax]}
                  stroke={chart.axis}
                  fontSize={11}
                  label={{
                    value: '실측 PM2.5 (㎍/㎥)',
                    position: 'insideBottom',
                    offset: -5,
                    fontSize: 12,
                    fill: chart.axis,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="predictedPm25"
                  name="예측 PM2.5"
                  domain={[0, axisMax]}
                  stroke={chart.axis}
                  fontSize={11}
                  label={{
                    value: '예측 (㎍/㎥)',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 12,
                    fill: chart.axis,
                  }}
                />
                <Tooltip
                  {...tooltipProps(chart)}
                  formatter={(value) => (typeof value === 'number' ? value.toFixed(1) : value)}
                  labelFormatter={() => ''}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: axisMax, y: axisMax },
                  ]}
                  stroke={chart.axis}
                  strokeDasharray="4 4"
                />
                {accuracy.models.map((m, i) => (
                  <Scatter
                    key={m.modelName}
                    name={m.modelName}
                    data={m.points}
                    fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                    fillOpacity={0.7}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          }
        />
```

- [ ] **Step 4: 카드 힌트에 Z축 설명 추가**

`CardHeader`의 `hint`에서 `대각선(y=x)에 가까울수록 정확합니다` 문구를 아래로 바꾼다.

```tsx
              기준면(y=x)에 가까울수록 정확합니다 · 안쪽에서 바깥쪽이 시간 순서입니다
```

- [ ] **Step 5: 타입 검사와 테스트**

Run: `npx tsc -b && npm run test`
Expected: 타입 에러 없음, 기존 테스트 전부 통과

- [ ] **Step 6: 커밋**

```bash
git add frontend/src/pages/MetricsPage.tsx
git commit -m "모델 정확도 산점도를 시간축을 가진 3D 산점도로 교체"
```

---

## Task 10: 전체 검증과 문서 갱신

**Files:**
- Modify: `docs/progress.md`
- Modify: `docs/user-guide.html`

- [ ] **Step 1: 전체 검증**

`frontend/`에서 순서대로 실행한다.

```bash
npx tsc -b
npm run lint
npm run test
npm run build
```

Expected: 전부 성공. 실패하면 그 원인을 고치고 다시 돌린다.

- [ ] **Step 2: dev 서버 육안 확인**

```bash
npm run dev
```

브라우저에서 확인할 항목:

1. 대시보드 "시간별 평균 PM2.5" — 막대가 왼쪽부터 순차로 솟아오르는가, 값이 나쁨 구간이면 막대가 주황·빨강으로 칠해지는가
2. 대시보드 "관측값과 AI 예측값 비교" — 관측(인디고)과 예측(바이올렛) 두 줄이 앞뒤로 갈라져 보이는가, 범례가 나오는가
3. 두 차트 모두 드래그로 각도가 바뀌는가, 좌우 35°·상하 범위를 넘지 않는가
4. 막대에 마우스를 올리면 밝아지고 툴팁에 시각과 값이 나오는가
5. 모델 정확도 화면 산점도 — 점이 커지며 나타나고, 기준면이 반투명하게 보이고, 시간축으로 점이 앞뒤로 퍼지는가
6. 우상단 테마 토글로 라이트/다크를 바꿨을 때 바닥·눈금·툴팁 색이 따라 바뀌는가
7. 스크롤로 차트를 화면 밖으로 내렸다가 다시 올렸을 때 정상 렌더되는가

확인되지 않은 항목은 다음 단계 문서에 그대로 적는다. **동작을 확인하지 않은 항목을 정상이라고 적지 않는다.**

- [ ] **Step 3: `docs/progress.md` 갱신**

3D 차트 항목을 추가한다. 상태는 실제로 확인한 만큼만 적는다. 빌드·테스트만 돌리고 브라우저 확인을 못 했으면 `COMPLETED`, 브라우저에서 7개 항목을 모두 확인했으면 `VERIFIED`로 적는다.

- [ ] **Step 4: `docs/user-guide.html` 갱신**

- 대시보드 절: 시간별 평균 차트와 예측 비교 차트가 3D 막대로 바뀌었고, 드래그로 각도를 바꾸고 마우스를 올리면 값이 나온다는 설명을 추가한다.
- 모델 정확도 절: 산점도가 3D가 되었고 안쪽에서 바깥쪽이 시간 순서라는 설명을 추가한다.
- 두 절 모두 "모션 최소화 설정을 켜두었거나 그래픽 가속을 못 쓰는 환경에서는 기존 2D 그래프가 나온다"는 한 줄을 넣는다.
- 하단 "업데이트 이력" 표에 2026-08-04 행을 추가한다.

- [ ] **Step 5: 커밋**

```bash
git add docs/progress.md docs/user-guide.html
git commit -m "3D 차트 도입 반영 — 진행 상태와 사용자 안내서 갱신"
```

---

## 자체 점검 결과

**설계 문서 대비 커버리지**

| 설계 절 | 담당 태스크 |
|---|---|
| 2. 적용 범위 (차트 3개) | Task 8, 9 |
| 3. 라이브러리 선택 (three 단독) | Task 1 |
| 4. 구조 (파일 7개) | Task 1~7 |
| 5. 좌표계와 스케일 | Task 1 |
| 6. 색 규칙 | Task 2 (팔레트), Task 5 (등급색), Task 9 (모델색) |
| 7. 애니메이션 (stagger·정지 렌더) | Task 3 (렌더 루프), Task 5·6 (animate) |
| 8. 상호작용 (회전·호버) | Task 3 (회전), Task 5·6 (hover) |
| 9. 폴백과 접근성 | Task 4 |
| 10. 성능 (lazy·DPR 제한) | Task 3 (DPR), Task 7 (lazy) |
| 11. 검증 | Task 10 |
| 12. 문서 갱신 | Task 10 |

**미해결로 남긴 것**

- 데이터가 바뀔 때의 400ms 보간(설계 7절)은 구현하지 않는다. `deps`가 바뀌면 씬을 다시 만들고 진입 애니메이션을 다시 재생한다. 이 화면들의 데이터는 사용자가 지역을 바꿀 때만 갱신되므로 재생이 오히려 자연스럽다. 별도 보간 경로를 만들면 코드만 늘어난다.
