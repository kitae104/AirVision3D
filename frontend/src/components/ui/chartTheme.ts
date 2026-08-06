import { DATA_KINDS } from '../../config/dataKinds'
import type { DataKindKey } from '../../config/dataKinds'
import { useThemeStore } from '../../store/theme'

/**
 * Recharts는 CSS 변수를 직접 읽지 못하므로 테마별 실제 색을 넘겨준다.
 * 값 계열 색(선 색)은 등급색과 겹치지 않게 브랜드/보조색을 쓴다.
 */
export interface ChartTheme {
  grid: string
  axis: string
  tooltipBg: string
  tooltipBorder: string
  tooltipInk: string
  /** 계열 색: 실측 / 예측 / 보조 */
  actual: string
  predicted: string
  accent: string
}

const LIGHT: ChartTheme = {
  grid: '#e9ecf1',
  axis: '#8a93a2',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e4e7ec',
  tooltipInk: '#12161c',
  actual: '#4f46e5',
  predicted: '#0ea5e9',
  accent: '#8b5cf6',
}

const DARK: ChartTheme = {
  grid: '#242a34',
  axis: '#6d7787',
  tooltipBg: '#1b2029',
  tooltipBorder: '#333b47',
  tooltipInk: '#e8ebef',
  actual: '#818cf8',
  predicted: '#38bdf8',
  accent: '#a78bfa',
}

export function useChartTheme(): ChartTheme {
  return useThemeStore((s) => s.mode) === 'dark' ? DARK : LIGHT
}

/**
 * 데이터 종류의 액센트 색을 현재 테마에 맞춰 돌려준다.
 * 화면 액센트와 차트 계열색이 같은 값을 쓰도록 진입점을 하나로 둔다.
 */
export function useKindColor(kind: DataKindKey): string {
  const dark = useThemeStore((s) => s.mode) === 'dark'
  return dark ? DATA_KINDS[kind].dark : DATA_KINDS[kind].light
}

/** Recharts Tooltip 공통 스타일 */
export function tooltipProps(theme: ChartTheme) {
  return {
    contentStyle: {
      backgroundColor: theme.tooltipBg,
      border: `1px solid ${theme.tooltipBorder}`,
      borderRadius: 10,
      fontSize: 12,
      color: theme.tooltipInk,
      boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
    },
    labelStyle: { color: theme.tooltipInk, fontWeight: 600 },
    itemStyle: { color: theme.tooltipInk },
  }
}
