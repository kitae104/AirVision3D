/** 미세먼지 등급 표시 설정 (백엔드·AI 서비스 등급 기준과 동일하게 유지) */

export interface GradeStyle {
  name: string
  upper: number | null
  badge: string
  chart: string
}

export const GRADES: GradeStyle[] = [
  { name: '좋음', upper: 15, badge: 'bg-blue-100 text-blue-700', chart: '#3b82f6' },
  { name: '보통', upper: 35, badge: 'bg-green-100 text-green-700', chart: '#22c55e' },
  { name: '나쁨', upper: 75, badge: 'bg-orange-100 text-orange-700', chart: '#f97316' },
  { name: '매우나쁨', upper: null, badge: 'bg-red-100 text-red-700', chart: '#ef4444' },
]

export function gradeOf(pm25: number): GradeStyle {
  for (const g of GRADES) {
    if (g.upper === null || pm25 <= g.upper) return g
  }
  return GRADES[GRADES.length - 1]
}

export function gradeStyle(name: string | null): GradeStyle | undefined {
  return GRADES.find((g) => g.name === name)
}
