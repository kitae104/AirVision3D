import { describe, it, expect } from 'vitest'
import { computePreAlerts } from './preAlerts'
import type { DistrictHourForecast, DistrictNow } from '../api/client'

function now(district: string, pm25: number | null): DistrictNow {
  return { district, pm25, pm10: null, wind: null }
}

function hour(time: string, values: [string, number | null][]): DistrictHourForecast {
  return { time, districts: values.map(([d, v]) => now(d, v)) }
}

describe('computePreAlerts', () => {
  it('현재 보통에서 나쁨 진입이 예상되면 첫 시점을 보고한다', () => {
    const alerts = computePreAlerts(
      [now('남동구', 20)],
      [
        hour('2026-07-26T06:00:00Z', [['남동구', 30]]),
        hour('2026-07-26T07:00:00Z', [['남동구', 40]]),
        hour('2026-07-26T08:00:00Z', [['남동구', 50]]),
      ])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      district: '남동구', grade: '나쁨', pm25: 40,
      time: '2026-07-26T07:00:00Z', hoursAhead: 2,
    })
  })

  it('모든 시간이 보통 이하면 경보가 없다', () => {
    const alerts = computePreAlerts(
      [now('연수구', 10)],
      [hour('t1', [['연수구', 20]]), hour('t2', [['연수구', 34]])])
    expect(alerts).toEqual([])
  })

  it('이미 나쁨인 구는 나쁨 유지로는 경보하지 않고 매우나쁨 악화만 경보한다', () => {
    const alerts = computePreAlerts(
      [now('미추홀구', 50)],
      [hour('t1', [['미추홀구', 60]]), hour('t2', [['미추홀구', 80]])])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ grade: '매우나쁨', pm25: 80, hoursAhead: 2 })
  })

  it('나쁨을 거쳐 매우나쁨에 도달하면 가장 나쁜 등급의 첫 시점을 보고한다', () => {
    const alerts = computePreAlerts(
      [now('남동구', 10)],
      [
        hour('t1', [['남동구', 40]]),
        hour('t2', [['남동구', 90]]),
        hour('t3', [['남동구', 95]]),
      ])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ grade: '매우나쁨', pm25: 90, hoursAhead: 2 })
  })

  it('pm25가 null인 프레임·구는 건너뛰고, 현재값 null은 좋음으로 간주한다', () => {
    const alerts = computePreAlerts(
      [now('연수구', null)],
      [hour('t1', [['연수구', null]]), hour('t2', [['연수구', 36]])])
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({ district: '연수구', grade: '나쁨', hoursAhead: 2 })
  })

  it('여러 구는 구 이름순으로 정렬된다', () => {
    const alerts = computePreAlerts(
      [now('연수구', 10), now('남동구', 10)],
      [hour('t1', [['연수구', 40], ['남동구', 50]])])
    expect(alerts.map((a) => a.district)).toEqual(['남동구', '연수구'])
  })
})
