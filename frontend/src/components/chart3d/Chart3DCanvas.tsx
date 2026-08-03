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
