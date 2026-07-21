import { describe, it, expect } from 'vitest'
import {
  PUBLIC_GRADE_COLORS, PUBLIC_POLLUTANTS, displayHeightM, publicGradeOf,
} from './publicGrades'

describe('publicGradeOf', () => {
  it('PM2.5 공식 구간(15/35/75)을 경계 포함으로 판정한다', () => {
    expect(publicGradeOf('pm25', 15)).toBe('좋음')
    expect(publicGradeOf('pm25', 35)).toBe('보통')
    expect(publicGradeOf('pm25', 75)).toBe('나쁨')
    expect(publicGradeOf('pm25', 76)).toBe('매우나쁨')
  })

  it('PM10 공식 구간(30/80/150)을 판정한다', () => {
    expect(publicGradeOf('pm10', 30)).toBe('좋음')
    expect(publicGradeOf('pm10', 81)).toBe('나쁨')
    expect(publicGradeOf('pm10', 151)).toBe('매우나쁨')
  })

  it('KHAI 공식 구간(50/100/250)을 판정한다', () => {
    expect(publicGradeOf('khai', 50)).toBe('좋음')
    expect(publicGradeOf('khai', 250)).toBe('나쁨')
    expect(publicGradeOf('khai', 251)).toBe('매우나쁨')
  })
})

describe('displayHeightM', () => {
  it('0이면 최소 높이, scaleMax 이상이면 최대 높이로 정규화한다', () => {
    expect(displayHeightM('pm25', 0)).toBe(120)
    expect(displayHeightM('pm25', 100)).toBe(2800)
    expect(displayHeightM('pm25', 500)).toBe(2800) // 상한 클램프
  })

  it('중간 값은 최소~최대 사이', () => {
    const h = displayHeightM('pm25', 50)
    expect(h).toBeGreaterThan(120)
    expect(h).toBeLessThan(2800)
  })
})

describe('공공 등급 설정', () => {
  it('오염물질 3종의 등급 상한은 오름차순이다', () => {
    for (const p of PUBLIC_POLLUTANTS) {
      const [a, b, c] = p.breakpoints
      expect(a).toBeLessThan(b)
      expect(b).toBeLessThan(c)
    }
  })

  it('모든 등급명에 색상이 정의되어 있다', () => {
    for (const name of ['좋음', '보통', '나쁨', '매우나쁨', '데이터 없음']) {
      expect(PUBLIC_GRADE_COLORS[name]).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
