/**
 * 복합악취 희석배수 등급 표시 설정.
 * 근거: 악취방지법 시행규칙 별표 3 배출허용기준(부지경계선) — 기타 지역 15배, 공업 지역 20배.
 * 15배 초과는 기타(주거) 지역 기준 초과, 20배 초과는 공업 지역 기준까지 초과를 뜻한다.
 */

import type { GradeStyle } from './grades'

export const ODOR_GRADES: GradeStyle[] = [
  {
    name: '양호',
    upper: 10,
    badge: 'bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
    chart: '#3b82f6',
  },
  {
    name: '관심',
    upper: 15,
    badge: 'bg-green-500/10 text-green-700 dark:bg-green-400/15 dark:text-green-300',
    chart: '#22c55e',
  },
  {
    name: '주의',
    upper: 20,
    badge: 'bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
    chart: '#f97316',
  },
  {
    name: '기준 초과',
    upper: null,
    badge: 'bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300',
    chart: '#ef4444',
  },
]

export function odorGradeOf(dilution: number): GradeStyle {
  for (const g of ODOR_GRADES) {
    if (g.upper === null || dilution <= g.upper) return g
  }
  return ODOR_GRADES[ODOR_GRADES.length - 1]
}
