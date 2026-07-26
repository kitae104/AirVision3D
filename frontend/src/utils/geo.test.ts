import { describe, it, expect } from 'vitest'
import { haversineKm, pathDistanceKm, polygonAreaKm2 } from './geo'

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

describe('polygonAreaKm2', () => {
  it('점이 0~2개면 0이다', () => {
    expect(polygonAreaKm2([])).toBe(0)
    expect(polygonAreaKm2([{ latitude: 37.5, longitude: 127.0 }])).toBe(0)
    expect(
      polygonAreaKm2([
        { latitude: 37.5, longitude: 127.0 },
        { latitude: 37.51, longitude: 127.01 },
      ]),
    ).toBe(0)
  })

  it('적도 부근 0.01°×0.01° 정사각형은 한 변 거리의 제곱과 근사한다', () => {
    const area = polygonAreaKm2([
      { latitude: 0, longitude: 127 },
      { latitude: 0, longitude: 127.01 },
      { latitude: 0.01, longitude: 127.01 },
      { latitude: 0.01, longitude: 127 },
    ])
    const side = haversineKm(0, 127, 0, 127.01)
    expect(area).toBeCloseTo(side * side, 2)
  })

  it('점 순서(시계/반시계)와 무관하게 같은 면적이다', () => {
    const pts = [
      { latitude: 37.4, longitude: 126.6 },
      { latitude: 37.4, longitude: 126.7 },
      { latitude: 37.5, longitude: 126.7 },
      { latitude: 37.5, longitude: 126.6 },
    ]
    const forward = polygonAreaKm2(pts)
    const backward = polygonAreaKm2([...pts].reverse())
    expect(forward).toBeGreaterThan(0)
    expect(forward).toBeCloseTo(backward, 10)
  })

  it('삼각형은 같은 밑변·높이 직사각형의 절반과 근사한다 (투영 기준 위도 차이로 ~0.01% 오차)', () => {
    const rect = polygonAreaKm2([
      { latitude: 37.4, longitude: 126.6 },
      { latitude: 37.4, longitude: 126.7 },
      { latitude: 37.45, longitude: 126.7 },
      { latitude: 37.45, longitude: 126.6 },
    ])
    const tri = polygonAreaKm2([
      { latitude: 37.4, longitude: 126.6 },
      { latitude: 37.4, longitude: 126.7 },
      { latitude: 37.45, longitude: 126.7 },
    ])
    expect(tri).toBeCloseTo(rect / 2, 1)
  })
})
