import { describe, it, expect } from 'vitest'
import { estimateBadgeText, nearestSite } from './cctvEstimate'

describe('nearestSite', () => {
  const sites = [
    { id: 1, name: '연수송도', latitude: 37.3925, longitude: 126.635 },
    { id: 2, name: '남동구청', latitude: 37.4477, longitude: 126.7313 },
    { id: 3, name: '미추홀주안', latitude: 37.4646, longitude: 126.6803 },
  ]

  it('빈 목록이면 null을 반환한다', () => {
    expect(nearestSite([], 37.4, 126.7)).toBeNull()
  })

  it('가장 가까운 관측소를 반환한다', () => {
    // 송도 인근 좌표 → 연수송도
    expect(nearestSite(sites, 37.39, 126.64)?.name).toBe('연수송도')
    // 남동구청 인근 좌표 → 남동구청
    expect(nearestSite(sites, 37.45, 126.73)?.name).toBe('남동구청')
  })

  it('관측소 좌표와 동일한 지점은 해당 관측소를 반환한다', () => {
    expect(nearestSite(sites, 37.4646, 126.6803)?.name).toBe('미추홀주안')
  })
})

describe('estimateBadgeText', () => {
  it('pm25가 없으면 null이다', () => {
    expect(estimateBadgeText(null, '좋음')).toBeNull()
  })

  it('소수 1자리 PM2.5와 등급을 조합한다', () => {
    expect(estimateBadgeText(12.34, '좋음')).toBe('PM2.5 12.3 (좋음)')
  })

  it('등급이 없으면 값만 표시한다', () => {
    expect(estimateBadgeText(40, null)).toBe('PM2.5 40.0')
  })
})
