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
export type { Scatter3DChartProps, Scatter3DPoint, Scatter3DSeries } from './Scatter3DChart'
