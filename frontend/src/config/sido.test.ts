import { describe, it, expect } from 'vitest'
import {
  DISTRICT_VIEW_HEIGHT, INCHEON_CORE_DISTRICTS, INCHEON_FOCUS_VIEW,
  SIDO_CENTERS, SIDO_VIEW_HEIGHT,
} from './sido'
import { MAP_CONFIG } from './mapConfig'

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

describe('INCHEON_CORE_DISTRICTS (핵심 대상지)', () => {
  it('미추홀구·남동구·연수구 3곳이다', () => {
    expect(INCHEON_CORE_DISTRICTS.map((d) => d.name)).toEqual(
      ['미추홀구', '남동구', '연수구'])
  })

  it('구 중심좌표가 인천 도심권 범위(위도 37.3~37.6, 경도 126.5~126.9) 안에 있다', () => {
    for (const d of INCHEON_CORE_DISTRICTS) {
      expect(d.latitude).toBeGreaterThanOrEqual(37.3)
      expect(d.latitude).toBeLessThanOrEqual(37.6)
      expect(d.longitude).toBeGreaterThanOrEqual(126.5)
      expect(d.longitude).toBeLessThanOrEqual(126.9)
    }
  })

  it('초기 조망은 3구 좌표 범위 안이고 구 이동보다 높은 고도다', () => {
    const lats = INCHEON_CORE_DISTRICTS.map((d) => d.latitude)
    const lngs = INCHEON_CORE_DISTRICTS.map((d) => d.longitude)
    expect(INCHEON_FOCUS_VIEW.latitude).toBeGreaterThanOrEqual(Math.min(...lats))
    expect(INCHEON_FOCUS_VIEW.latitude).toBeLessThanOrEqual(Math.max(...lats))
    expect(INCHEON_FOCUS_VIEW.longitude).toBeGreaterThanOrEqual(Math.min(...lngs))
    expect(INCHEON_FOCUS_VIEW.longitude).toBeLessThanOrEqual(Math.max(...lngs))
    expect(INCHEON_FOCUS_VIEW.height).toBeGreaterThan(DISTRICT_VIEW_HEIGHT)
  })

  it('지도 초기 카메라(mapConfig.initialView)는 핵심 대상지 조망과 동일하다', () => {
    expect(MAP_CONFIG.initialView).toEqual(INCHEON_FOCUS_VIEW)
  })
})
