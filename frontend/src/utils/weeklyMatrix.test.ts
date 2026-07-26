import { describe, it, expect } from 'vitest'
import { parseWeeklyMatrix } from './weeklyMatrix'

describe('parseWeeklyMatrix', () => {
  it('지역×날짜 매트릭스로 변환한다', () => {
    const m = parseWeeklyMatrix([
      { date: '2026-07-29', content: '수도권: 낮음, 강원권: 높음' },
      { date: '2026-07-30', content: '수도권: 높음, 강원권: 낮음' },
    ])
    expect(m.dates).toEqual(['2026-07-29', '2026-07-30'])
    expect(m.regions).toEqual(['수도권', '강원권'])
    expect(m.grades['수도권']['2026-07-30']).toBe('높음')
    expect(m.grades['강원권']['2026-07-29']).toBe('높음')
  })

  it('형식이 어긋난 항목과 null content는 건너뛴다', () => {
    const m = parseWeeklyMatrix([
      { date: 'd1', content: '수도권: 낮음, 이상한항목, : 높음' },
      { date: 'd2', content: null },
    ])
    expect(m.dates).toEqual(['d1', 'd2'])
    expect(m.regions).toEqual(['수도권'])
    expect(m.grades['수도권']['d2']).toBeUndefined()
  })

  it('지역 순서는 첫 등장 순서를 유지한다', () => {
    const m = parseWeeklyMatrix([
      { date: 'd1', content: '영남권: 낮음' },
      { date: 'd2', content: '수도권: 낮음, 영남권: 높음' },
    ])
    expect(m.regions).toEqual(['영남권', '수도권'])
  })
})
