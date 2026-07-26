/** 관측 데이터 화면 요약 통계 (필터된 표본 기준, 순수 함수) */

import type { Observation } from '../api/client'
import { GRADES, gradeOf } from '../config/grades'

export interface GradeSlice {
  name: string
  color: string
  count: number
  /** PM2.5 유효 표본 대비 비율 (0~1) */
  ratio: number
}

export interface ObsSummary {
  /** 표본 건수 (PM2.5 없는 행 포함) */
  count: number
  /** PM2.5 유효 표본 건수 */
  pm25Count: number
  avgPm25: number
  maxPm25: number
  maxAt: string
  maxSite: string
  /** 등급 분포 (GRADES 순서, count 0 포함) */
  dist: GradeSlice[]
}

/** 표본 관측값 요약. PM2.5 유효 표본이 없으면 null. */
export function summarizeObservations(rows: Observation[]): ObsSummary | null {
  const valid = rows.filter((o) => o.pm25 != null)
  if (valid.length === 0) return null

  let sum = 0
  let max = valid[0]
  const counts = new Map<string, number>()
  for (const o of valid) {
    const pm25 = o.pm25 as number
    sum += pm25
    if (pm25 > (max.pm25 as number)) max = o
    const name = gradeOf(pm25).name
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return {
    count: rows.length,
    pm25Count: valid.length,
    avgPm25: sum / valid.length,
    maxPm25: max.pm25 as number,
    maxAt: max.observedAt,
    maxSite: max.siteName,
    dist: GRADES.map((g) => {
      const count = counts.get(g.name) ?? 0
      return { name: g.name, color: g.chart, count, ratio: count / valid.length }
    }),
  }
}
