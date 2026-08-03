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
   * 진입 애니메이션. 씬을 만든 뒤 흐른 시간(ms)을 받는다.
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

/** 가장자리가 딱 붙지 않도록 두는 여유 (1이면 화면에 꽉 참) */
const FIT_MARGIN = 1.06
/** 맞춤 계산 반복 횟수 — 거리와 중심을 번갈아 고치므로 두세 번이면 수렴한다 */
const FIT_PASSES = 3

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
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
    const target = new THREE.Vector3(0, WORLD.height * 0.45, 0)

    // 초기 시점 — 살짝 왼쪽 위에서 내려다본다
    let azimuth = THREE.MathUtils.degToRad(-20)
    let polar = THREE.MathUtils.degToRad(68)
    let radius = 14.5

    function placeCamera() {
      camera.position.set(
        target.x + radius * Math.sin(polar) * Math.sin(azimuth),
        target.y + radius * Math.cos(polar),
        target.z + radius * Math.sin(polar) * Math.cos(azimuth),
      )
      camera.lookAt(target)
      camera.updateMatrixWorld()
    }
    placeCamera()

    const fitBox = new THREE.Box3()
    const corner = new THREE.Vector3()
    const right = new THREE.Vector3()
    const up = new THREE.Vector3()

    /**
     * 씬을 실제로 화면에 투영해 보고 카드 안에 꽉 차도록 거리와 중심을 맞춘다.
     *
     * 각도에 따라 투영된 모양이 달라지므로 공식 하나로는 맞출 수 없다.
     * 경계 상자의 여덟 꼭짓점을 투영해 화면 좌표 범위를 재고,
     * 그만큼 거리를 조정하고 중심을 옮기기를 몇 번 반복한다.
     */
    function fitCamera() {
      fitBox.makeEmpty()
      fitBox.expandByObject(scene)
      if (fitBox.isEmpty()) return

      for (let pass = 0; pass < FIT_PASSES; pass += 1) {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        for (let i = 0; i < 8; i += 1) {
          corner.set(
            i & 1 ? fitBox.max.x : fitBox.min.x,
            i & 2 ? fitBox.max.y : fitBox.min.y,
            i & 4 ? fitBox.max.z : fitBox.min.z,
          )
          corner.project(camera)
          minX = Math.min(minX, corner.x)
          maxX = Math.max(maxX, corner.x)
          minY = Math.min(minY, corner.y)
          maxY = Math.max(maxY, corner.y)
        }

        // 화면 중앙에서 벗어난 만큼 시선 중심을 옮긴다
        const visibleHeight = 2 * radius * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
        const visibleWidth = visibleHeight * camera.aspect
        camera.matrixWorld.extractBasis(right, up, new THREE.Vector3())
        target.addScaledVector(right, (((minX + maxX) / 2) * visibleWidth) / 2)
        target.addScaledVector(up, (((minY + maxY) / 2) * visibleHeight) / 2)

        // 긴 쪽이 화면을 꽉 채우도록 거리를 조정한다
        const span = Math.max((maxX - minX) / 2, (maxY - minY) / 2)
        if (span > 0) radius = THREE.MathUtils.clamp(radius * span * FIT_MARGIN, 1, 150)
        placeCamera()
      }
    }

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
    // 아래 핸들러들은 화살표 상수로 둔다. 함수 선언문은 호이스팅되어
    // TypeScript가 container·canvas의 null 검사 결과를 잃어버린다.
    const resize = () => {
      const { clientWidth, clientHeight } = container
      if (clientWidth === 0 || clientHeight === 0) return
      renderer.setSize(clientWidth, clientHeight, false)
      camera.aspect = clientWidth / clientHeight
      // 툴팁 위치 계산에 쓰라고 캔버스 픽셀 크기를 실어 보낸다
      camera.userData.canvasSize = { w: clientWidth, h: clientHeight }
      camera.updateProjectionMatrix()
      fitCamera()
      placeCamera()
      invalidate()
    }
    const resizeObserver = new ResizeObserver(() => resize())
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

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      // 포인터가 이미 사라졌으면 브라우저가 던진다. 캡처는 편의 기능이라 실패해도 회전은 계속한다.
      try {
        canvas.setPointerCapture(e.pointerId)
      } catch {
        /* 무시 */
      }
      canvas.style.cursor = 'grabbing'
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      if (dragging) {
        azimuth = THREE.MathUtils.clamp(
          azimuth - (e.clientX - lastX) * 0.005,
          -AZIMUTH_LIMIT,
          AZIMUTH_LIMIT,
        )
        polar = THREE.MathUtils.clamp(polar - (e.clientY - lastY) * 0.004, POLAR_MIN, POLAR_MAX)
        lastX = e.clientX
        lastY = e.clientY
        // 각도가 바뀌면 화면에 비치는 크기도 달라지므로 거리를 다시 맞춘다
        fitCamera()
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
      setTooltip(built.hover(ctx))
      invalidate()
    }

    const endDrag = (e: PointerEvent) => {
      if (!dragging) return
      dragging = false
      try {
        canvas.releasePointerCapture(e.pointerId)
      } catch {
        /* 무시 */
      }
      canvas.style.cursor = 'grab'
    }

    const onPointerLeave = () => {
      pointer.set(-2, -2)
      // 강조된 막대를 원래 색으로 되돌리려면 한 번 더 호출해야 한다
      built.hover?.(ctx)
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
