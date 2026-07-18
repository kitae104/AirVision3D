/**
 * 공공 대기질(AirKorea) 등급 표시 설정.
 * 등급 색상은 자체 관측 등급(grades.ts)과 동일 색을 쓰되,
 * 공공 데이터의 오염물질별 공식 등급 구간(에어코리아 기준)을 별도로 관리한다.
 */

export type PublicPollutantKey = 'pm10' | 'pm25' | 'khai'

export interface PublicPollutantConfig {
  key: PublicPollutantKey
  label: string
  unit: string
  /** 등급 구간 상한 [좋음, 보통, 나쁨] (초과 시 매우나쁨) — 에어코리아 공식 기준 */
  breakpoints: [number, number, number]
  /** 3D 막대 높이 정규화 상한 (이 값 이상이면 최대 높이) */
  scaleMax: number
}

export const PUBLIC_POLLUTANTS: PublicPollutantConfig[] = [
  { key: 'pm25', label: '초미세먼지 PM2.5', unit: '㎍/㎥', breakpoints: [15, 35, 75], scaleMax: 100 },
  { key: 'pm10', label: '미세먼지 PM10', unit: '㎍/㎥', breakpoints: [30, 80, 150], scaleMax: 200 },
  { key: 'khai', label: '통합대기환경지수 KHAI', unit: '', breakpoints: [50, 100, 250], scaleMax: 300 },
]

/** 등급명 → 색상 (grades.ts와 동일 팔레트 + 데이터 없음 회색) */
export const PUBLIC_GRADE_COLORS: Record<string, string> = {
  좋음: '#3b82f6',
  보통: '#22c55e',
  나쁨: '#f97316',
  매우나쁨: '#ef4444',
  '데이터 없음': '#9ca3af',
}

export const PUBLIC_GRADE_ORDER = ['좋음', '보통', '나쁨', '매우나쁨', '데이터 없음'] as const

/** 값 → 등급명 (공공 등급 코드가 없을 때 폴백) */
export function publicGradeOf(key: PublicPollutantKey, value: number): string {
  const config = PUBLIC_POLLUTANTS.find((p) => p.key === key)!
  if (value <= config.breakpoints[0]) return '좋음'
  if (value <= config.breakpoints[1]) return '보통'
  if (value <= config.breakpoints[2]) return '나쁨'
  return '매우나쁨'
}

/**
 * 3D 막대 표시 높이(m) 정규화.
 * 표시 높이는 농도 비교용 시각 표현일 뿐 실제 오염층의 물리적 높이가 아니다.
 */
export function displayHeightM(key: PublicPollutantKey, value: number): number {
  const config = PUBLIC_POLLUTANTS.find((p) => p.key === key)!
  const ratio = Math.min(Math.max(value / config.scaleMax, 0), 1)
  const minH = 120
  const maxH = 2800
  return minH + ratio * (maxH - minH)
}

/** 측정값 상태 코드 → 사용자 표시 문구 */
export const VALUE_STATUS_LABELS: Record<string, string> = {
  NORMAL: '정상',
  NO_DATA: '데이터 없음',
  COMM_ERROR: '통신장애',
  MAINTENANCE: '점검 중',
  INVALID: '자료 이상',
}
