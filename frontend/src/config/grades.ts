/** 미세먼지 등급 표시 설정 (백엔드·AI 서비스 등급 기준과 동일하게 유지) */

export interface GradeStyle {
  name: string
  upper: number | null
  badge: string
  chart: string
  /** 사용자가 바로 행동을 판단할 수 있게 하는 한 줄 안내 (대기질 등급에만 있음) */
  advice?: string
}

export const GRADES: GradeStyle[] = [
  {
    name: '좋음',
    upper: 15,
    badge: 'bg-blue-500/10 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300',
    chart: '#3b82f6',
    advice: '야외 활동하기 좋습니다.',
  },
  {
    name: '보통',
    upper: 35,
    badge: 'bg-green-500/10 text-green-700 dark:bg-green-400/15 dark:text-green-300',
    chart: '#22c55e',
    advice: '평소대로 활동해도 괜찮습니다.',
  },
  {
    name: '나쁨',
    upper: 75,
    badge: 'bg-orange-500/10 text-orange-700 dark:bg-orange-400/15 dark:text-orange-300',
    chart: '#f97316',
    advice: '민감군은 실외 활동을 줄이세요.',
  },
  {
    name: '매우나쁨',
    upper: null,
    badge: 'bg-red-500/10 text-red-700 dark:bg-red-400/15 dark:text-red-300',
    chart: '#ef4444',
    advice: '실외 활동을 자제하고 마스크를 착용하세요.',
  },
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
