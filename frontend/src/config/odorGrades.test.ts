import { describe, expect, it } from 'vitest'
import { ODOR_GRADES, odorGradeOf } from './odorGrades'

describe('odorGrades', () => {
  it('등급 경계값이 법정 기준(기타 15배·공업 20배)과 정합한다', () => {
    expect(odorGradeOf(0).name).toBe('양호')
    expect(odorGradeOf(10).name).toBe('양호')
    expect(odorGradeOf(10.1).name).toBe('관심')
    expect(odorGradeOf(15).name).toBe('관심')
    expect(odorGradeOf(15.1).name).toBe('주의')
    expect(odorGradeOf(20).name).toBe('주의')
    expect(odorGradeOf(20.1).name).toBe('기준 초과')
  })

  it('등급은 상한 오름차순으로 정렬돼 있고 마지막 등급만 상한이 없다', () => {
    const uppers = ODOR_GRADES.slice(0, -1).map((g) => g.upper)
    expect(uppers.every((u) => u !== null)).toBe(true)
    const sorted = [...(uppers as number[])].sort((a, b) => a - b)
    expect(uppers).toEqual(sorted)
    expect(ODOR_GRADES[ODOR_GRADES.length - 1].upper).toBeNull()
  })
})
