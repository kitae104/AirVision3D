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
