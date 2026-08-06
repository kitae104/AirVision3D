/**
 * 데이터 종류별 액센트 색.
 *
 * 규칙
 *  - 같은 종류의 데이터는 어느 화면에서든 같은 색을 쓴다.
 *    (예: 자체 관측은 관측 데이터 화면·데이터 등록 화면·대시보드 차트에서 모두 인디고)
 *  - 대기질 등급색(파랑 #3b82f6 · 초록 #22c55e · 주황 #f97316 · 빨강 #ef4444)과
 *    혼동되지 않도록 색상환에서 등급색과 떨어진 구간만 쓴다.
 *  - 값 자체(PM2.5 수치)는 여전히 등급색으로 칠한다. 종류색은 화면·구역·계열을
 *    구분하는 틀에만 쓴다.
 */

export type DataKindKey =
  | 'observation'
  | 'prediction'
  | 'interpolation'
  | 'publicAir'
  | 'odor'
  | 'account'

export interface DataKind {
  key: DataKindKey
  label: string
  /** 라이트 모드 액센트 */
  light: string
  /** 다크 모드 액센트 (배경이 어두우므로 더 밝게) */
  dark: string
}

export const DATA_KINDS: Record<DataKindKey, DataKind> = {
  // 인디고 — 우리가 직접 수집한 관측값
  observation: { key: 'observation', label: '자체 관측', light: '#4f46e5', dark: '#818cf8' },
  // 바이올렛 — AI가 만들어 낸 값
  prediction: { key: 'prediction', label: 'AI 예측', light: '#7c3aed', dark: '#a78bfa' },
  // 푸시아 — 관측 사이를 계산으로 채운 값
  interpolation: { key: 'interpolation', label: 'IDW 보간', light: '#a21caf', dark: '#e879f9' },
  // 틸 — 외부 공공기관 실측
  publicAir: { key: 'publicAir', label: '공공 대기질', light: '#0f766e', dark: '#2dd4bf' },
  // 핑크 — 악취(대기질과 다른 측정 항목)
  odor: { key: 'odor', label: '악취 측정', light: '#db2777', dark: '#f472b6' },
  // 슬레이트 — 값이 아닌 계정·설정
  account: { key: 'account', label: '계정·관리', light: '#475569', dark: '#94a3b8' },
}

/** 히어로 배경에 깔 옅은 워시 (액센트 색 + 낮은 알파) */
export function accentWash(color: string): string {
  return `linear-gradient(135deg, ${color}26 0%, ${color}0d 40%, transparent 70%)`
}
