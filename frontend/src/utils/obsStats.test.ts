import { describe, it, expect } from 'vitest'
import { summarizeObservations } from './obsStats'
import type { Observation } from '../api/client'

function obs(siteName: string, observedAt: string, pm25: number | null): Observation {
  return {
    id: 0, siteId: 1, siteName, observedAt, pm25,
    pm10: null, temperature: null, humidity: null, windSpeed: null, windDirection: null,
  }
}

describe('summarizeObservations', () => {
  it('빈 목록이나 PM2.5가 전부 없으면 null이다', () => {
    expect(summarizeObservations([])).toBeNull()
    expect(summarizeObservations([obs('a', 't1', null)])).toBeNull()
  })

  it('평균·최고(시각·관측소)·건수를 집계한다', () => {
    const s = summarizeObservations([
      obs('송도', '2026-07-26T01:00:00Z', 10),
      obs('주안', '2026-07-26T02:00:00Z', 50),
      obs('구월', '2026-07-26T03:00:00Z', 30),
      obs('결측', '2026-07-26T04:00:00Z', null),
    ])!
    expect(s.count).toBe(4)
    expect(s.pm25Count).toBe(3)
    expect(s.avgPm25).toBeCloseTo(30, 10)
    expect(s.maxPm25).toBe(50)
    expect(s.maxSite).toBe('주안')
    expect(s.maxAt).toBe('2026-07-26T02:00:00Z')
  })

  it('등급 분포는 GRADES 순서로 비율과 함께 반환한다', () => {
    const s = summarizeObservations([
      obs('a', 't1', 10),  // 좋음
      obs('b', 't2', 20),  // 보통
      obs('c', 't3', 30),  // 보통
      obs('d', 't4', 80),  // 매우나쁨
    ])!
    expect(s.dist.map((d) => d.name)).toEqual(['좋음', '보통', '나쁨', '매우나쁨'])
    expect(s.dist.map((d) => d.count)).toEqual([1, 2, 0, 1])
    expect(s.dist[1].ratio).toBeCloseTo(0.5, 10)
  })
})
