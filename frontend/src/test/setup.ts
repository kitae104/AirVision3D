// jest-dom 매처(toBeInTheDocument 등)를 Vitest expect에 등록하고,
// 각 테스트 후 렌더 결과를 정리한다.
import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})
