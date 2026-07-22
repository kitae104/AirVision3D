import { describe, it, expect } from 'vitest'
import { interpolationSeries, predictionSeries } from './compareSeries'
import type { InterpolationResult, Prediction, Site } from '../api/client'

const FROM = '2026-07-21T00:00:00Z'
const TO = '2026-07-22T00:00:00Z'

const site = (id: number, name: string, lat: number, lng: number): Site => ({
  id, name, latitude: lat, longitude: lng,
  altitude: null, siteType: 'SENSOR', description: null, geomWkt: null,
})

const pred = (siteId: number, siteName: string, at: string, pm25: number): Prediction => ({
  id: Math.random(), siteId, siteName, modelName: 'm',
  predictedAt: at, actualPm25: null, predictedPm25: pm25, predictedGrade: '보통',
})

const idw = (name: string | null, lat: number, lng: number,
             at: string, pm25: number): InterpolationResult => ({
  id: Math.random(), targetName: name, latitude: lat, longitude: lng,
  pm25, algorithm: 'IDW', power: 2, interpolatedAt: at,
})

describe('predictionSeries', () => {
  const sites = [site(1, '미추홀주안', 37.4646, 126.6803), site(2, '남동구월', 37.4487, 126.7016)]

  it('관측소별로 묶고 시각 오름차순으로 정렬한다', () => {
    const out = predictionSeries([
      pred(1, '미추홀주안', '2026-07-21T12:00:00Z', 30),
      pred(1, '미추홀주안', '2026-07-21T09:00:00Z', 20),
      pred(2, '남동구월', '2026-07-21T10:00:00Z', 15),
    ], sites, FROM, TO)

    expect(out).toHaveLength(2)
    const s1 = out.find((s) => s.siteId === 1)!
    expect(s1.siteName).toBe('미추홀주안 (예측)')
    expect(s1.latitude).toBe(37.4646)
    expect(s1.samples.map((x) => x.pm25)).toEqual([20, 30])
  })

  it('기간 밖 예측과 좌표를 모르는 관측소는 제외한다', () => {
    const out = predictionSeries([
      pred(1, '미추홀주안', '2026-07-20T12:00:00Z', 30), // 기간 이전
      pred(99, '미상', '2026-07-21T12:00:00Z', 25),      // sites에 없음
    ], sites, FROM, TO)
    expect(out).toHaveLength(0)
  })
})

describe('interpolationSeries', () => {
  it('동일 좌표를 한 지점으로 묶고 정렬한다', () => {
    const out = interpolationSeries([
      idw('인천시청', 37.4563, 126.7052, '2026-07-21T12:00:00Z', 18),
      idw('인천시청', 37.4563, 126.7052, '2026-07-21T08:00:00Z', 12),
      idw(null, 37.4, 126.65, '2026-07-21T09:00:00Z', 22),
    ], FROM, TO)

    expect(out).toHaveLength(2)
    const cityHall = out.find((s) => s.siteName.startsWith('인천시청'))!
    expect(cityHall.siteName).toBe('인천시청 (보간)')
    expect(cityHall.samples.map((x) => x.pm25)).toEqual([12, 18])
    const unnamed = out.find((s) => s.siteName.includes('보간지점'))!
    expect(unnamed.siteName).toContain('37.4000,126.6500')
  })

  it('기간 밖 이력은 제외한다', () => {
    const out = interpolationSeries(
      [idw('a', 37.4, 126.7, '2026-07-23T00:00:01Z', 10)], FROM, TO)
    expect(out).toHaveLength(0)
  })
})
