import { describe, it, expect } from 'vitest'
import { SIDO_CENTERS, SIDO_VIEW_HEIGHT } from './sido'

// 백엔드 AirKoreaService.SIDO_NAMES와 동일해야 한다 (외부 API 전달 시 검증됨).
const AIRKOREA_SIDO_NAMES = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '경기', '강원',
  '충북', '충남', '전북', '전남', '경북', '경남', '제주', '세종',
]

describe('SIDO_CENTERS', () => {
  it('AirKorea 17개 시도를 빠짐없이 포함한다', () => {
    const names = SIDO_CENTERS.map((s) => s.name)
    expect(names).toHaveLength(AIRKOREA_SIDO_NAMES.length)
    for (const name of AIRKOREA_SIDO_NAMES) {
      expect(names).toContain(name)
    }
  })

  it('시도명 중복이 없다', () => {
    const names = SIDO_CENTERS.map((s) => s.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('중심좌표가 한반도 범위(위도 33~39, 경도 124~132) 안에 있다', () => {
    for (const s of SIDO_CENTERS) {
      expect(s.latitude).toBeGreaterThanOrEqual(33)
      expect(s.latitude).toBeLessThanOrEqual(39)
      expect(s.longitude).toBeGreaterThanOrEqual(124)
      expect(s.longitude).toBeLessThanOrEqual(132)
    }
  })

  it('카메라 높이는 양수다', () => {
    expect(SIDO_VIEW_HEIGHT).toBeGreaterThan(0)
  })
})
