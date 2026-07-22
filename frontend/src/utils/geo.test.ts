import { describe, it, expect } from 'vitest'
import { haversineKm, pathDistanceKm } from './geo'

describe('haversineKm', () => {
  it('동일 좌표는 0이다', () => {
    expect(haversineKm(37.5, 127.0, 37.5, 127.0)).toBe(0)
  })

  it('서울시청-부산시청 거리는 약 325km다', () => {
    const d = haversineKm(37.5665, 126.978, 35.1796, 129.0756)
    expect(d).toBeGreaterThan(315)
    expect(d).toBeLessThan(335)
  })

  it('거리는 대칭이다', () => {
    const ab = haversineKm(37.45, 126.7, 37.56, 126.97)
    const ba = haversineKm(37.56, 126.97, 37.45, 126.7)
    expect(ab).toBeCloseTo(ba, 10)
  })
})

describe('pathDistanceKm', () => {
  it('점이 0~1개면 0이다', () => {
    expect(pathDistanceKm([])).toBe(0)
    expect(pathDistanceKm([{ latitude: 37.5, longitude: 127.0 }])).toBe(0)
  })

  it('경유점을 지나는 경로는 구간 거리의 합이다', () => {
    const a = { latitude: 37.45, longitude: 126.7 }
    const b = { latitude: 37.5, longitude: 126.8 }
    const c = { latitude: 37.55, longitude: 126.9 }
    const expected =
      haversineKm(a.latitude, a.longitude, b.latitude, b.longitude) +
      haversineKm(b.latitude, b.longitude, c.latitude, c.longitude)
    expect(pathDistanceKm([a, b, c])).toBeCloseTo(expected, 10)
  })
})
