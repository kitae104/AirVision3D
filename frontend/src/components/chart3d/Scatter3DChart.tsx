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
      // 평면의 가로축을 (실측=예측) 대각선 방향에, 세로축을 시간축에 맞춘다.
      // 오일러 각으로는 두 축을 동시에 맞추기 어려워 기저를 직접 세운다.
      const diagonal = new THREE.Vector3(WORLD.width, WORLD.height, 0).normalize()
      const timeAxis = new THREE.Vector3(0, 0, 1)
      const normal = new THREE.Vector3().crossVectors(diagonal, timeAxis).normalize()
      plane.quaternion.setFromRotationMatrix(
        new THREE.Matrix4().makeBasis(diagonal, timeAxis, normal),
      )
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
        ySprite.position.set(-half - 0.95, toY(tick), -halfD)
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
      yName.position.set(-half - 0.95, WORLD.height + 0.4, -halfD)
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

      const place = (layerIndex: number, i: number, scale: number) => {
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
              { label: '오차', value: (point.y - point.x).toFixed(1), color: palette.axis },
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
  const errors = series.flatMap((s) => s.points.map((p) => Math.abs(p.y - p.x)))
  const mae = errors.length > 0 ? errors.reduce((a, b) => a + b, 0) / errors.length : 0

  if (total === 0) return <>{fallback}</>

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
