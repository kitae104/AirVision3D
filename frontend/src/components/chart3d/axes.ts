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
