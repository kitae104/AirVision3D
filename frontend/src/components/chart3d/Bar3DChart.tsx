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

function numberAt(row: Record<string, unknown> | undefined, key: string): number {
  const value = row?.[key]
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
      const applyHeight = (layerIndex: number, i: number, h: number) => {
        const layer = layers[layerIndex]
        const slot = barSlot(i, data.length)
        dummy.position.set(slot.x, 0, layer.z)
        dummy.scale.set(
          slot.width,
          Math.max(h, 0.0001),
          Math.min(slot.width, WORLD.seriesDepth * 0.7),
        )
        dummy.updateMatrix()
        layer.mesh.setMatrixAt(i, dummy.matrix)
      }

      let hovered: { layer: number; index: number } | null = null

      return {
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
          const size = ctx.camera.userData.canvasSize as { w: number; h: number } | undefined
          const index = top.index
          const tooltip: Chart3DTooltip = {
            x: ((projected.x + 1) / 2) * (size?.w ?? 1),
            y: ((1 - projected.y) / 2) * (size?.h ?? 1),
            title: String(data[index]?.[xKey] ?? ''),
            rows: layers.map((layer) => {
              const value = numberAt(data[index], layer.series.key)
              return {
                label: layer.series.name,
                value: `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`,
                color: layer.series.color ?? gradeOf(value).chart,
              }
            }),
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
    },
    [data, xKey, series, unit, palette],
  )

  const flat = series.flatMap((s) => data.map((row) => numberAt(row, s.key)))
  const summary =
    flat.length > 0
      ? `최소 ${Math.min(...flat).toFixed(1)}, 최대 ${Math.max(...flat).toFixed(1)}, 평균 ${(
          flat.reduce((a, b) => a + b, 0) / flat.length
        ).toFixed(1)}${unit ? ` ${unit}` : ''}`
      : '데이터 없음'

  if (data.length === 0) return <>{fallback}</>

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
