/** 초미세먼지 주간예보 "지역: 등급, ..." 문자열을 지역×날짜 매트릭스로 변환 */

export interface WeeklyMatrix {
  dates: string[]
  /** 첫 등장 순서 유지 */
  regions: string[]
  /** grades[region][date] = 등급 문자열 (예: 높음/낮음) */
  grades: Record<string, Record<string, string>>
}

export function parseWeeklyMatrix(
  days: { date: string; content: string | null }[]): WeeklyMatrix {
  const dates: string[] = []
  const regions: string[] = []
  const grades: Record<string, Record<string, string>> = {}

  for (const day of days) {
    dates.push(day.date)
    for (const part of (day.content ?? '').split(',')) {
      const [region, grade] = part.split(':').map((s) => s.trim())
      if (!region || !grade) continue
      if (!grades[region]) {
        regions.push(region)
        grades[region] = {}
      }
      grades[region][day.date] = grade
    }
  }

  return { dates, regions, grades }
}
