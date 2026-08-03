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
