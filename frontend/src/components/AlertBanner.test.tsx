import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { AirAlert } from '../api/client'

// apiClient(axios 인스턴스)를 목으로 대체 — 네트워크 없이 배너 렌더링만 검증한다.
const get = vi.fn()
vi.mock('../api/client', () => ({
  apiClient: { get: (...args: unknown[]) => get(...args) },
}))

import AlertBanner from './AlertBanner'

function alert(partial: Partial<AirAlert>): AirAlert {
  return {
    districtName: null, moveName: null, itemCode: null, issueLevel: null,
    issuedAt: null, issueValue: null, clearedAt: null, clearValue: null,
    active: true, ...partial,
  }
}

describe('AlertBanner', () => {
  beforeEach(() => get.mockReset())

  it('활성 경보가 있으면 권역·항목·단계를 표시한다', async () => {
    get.mockResolvedValue({
      data: { data: [alert({ districtName: '서울', itemCode: 'PM25', issueLevel: '주의보' })] },
    })

    render(<AlertBanner />)

    await waitFor(() =>
      expect(screen.getByText(/초미세먼지 주의보 발령 중/)).toBeInTheDocument())
    expect(screen.getByText(/\[서울\]/)).toBeInTheDocument()
  })

  it('경보가 없으면 아무것도 렌더링하지 않는다', async () => {
    get.mockResolvedValue({ data: { data: [] } })

    const { container } = render(<AlertBanner />)

    await waitFor(() => expect(get).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})
