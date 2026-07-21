import { describe, it, expect } from 'vitest'
import { GRADES, gradeOf, gradeStyle } from './grades'

describe('gradeOf', () => {
  it('상한 경계값은 해당 등급에 포함된다 (이하)', () => {
    expect(gradeOf(15).name).toBe('좋음')
    expect(gradeOf(35).name).toBe('보통')
    expect(gradeOf(75).name).toBe('나쁨')
  })

  it('상한을 초과하면 다음 등급으로 넘어간다', () => {
    expect(gradeOf(15.1).name).toBe('보통')
    expect(gradeOf(35.1).name).toBe('나쁨')
    expect(gradeOf(75.1).name).toBe('매우나쁨')
  })

  it('0과 매우 큰 값도 등급을 반환한다', () => {
    expect(gradeOf(0).name).toBe('좋음')
    expect(gradeOf(9999).name).toBe('매우나쁨')
  })
})

describe('gradeStyle', () => {
  it('등급명으로 스타일을 찾는다', () => {
    expect(gradeStyle('나쁨')?.chart).toBe('#f97316')
  })

  it('없는 등급명/ null은 undefined', () => {
    expect(gradeStyle('없음')).toBeUndefined()
    expect(gradeStyle(null)).toBeUndefined()
  })
})

describe('GRADES 설정', () => {
  it('마지막 등급만 상한이 null(무한)이다', () => {
    expect(GRADES[GRADES.length - 1].upper).toBeNull()
    expect(GRADES.slice(0, -1).every((g) => g.upper !== null)).toBe(true)
  })

  it('상한은 오름차순이다', () => {
    const uppers = GRADES.slice(0, -1).map((g) => g.upper as number)
    expect(uppers).toEqual([...uppers].sort((a, b) => a - b))
  })
})
