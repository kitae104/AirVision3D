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
