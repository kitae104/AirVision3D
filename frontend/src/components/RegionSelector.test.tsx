import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import RegionSelector from './RegionSelector'

describe('RegionSelector', () => {
  it('인천 전역과 핵심 3구 버튼을 렌더링한다', () => {
    render(<RegionSelector value={null} onChange={() => {}} />)
    for (const label of ['인천 전역', '미추홀구', '남동구', '연수구']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  it('구 버튼 클릭 시 구 이름으로 onChange를 호출한다', () => {
    const onChange = vi.fn()
    render(<RegionSelector value={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '남동구' }))
    expect(onChange).toHaveBeenCalledWith('남동구')
  })

  it('인천 전역 클릭 시 null로 onChange를 호출한다', () => {
    const onChange = vi.fn()
    render(<RegionSelector value="연수구" onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '인천 전역' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
