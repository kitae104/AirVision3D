import { useChartTheme } from '../ui'
import { useThemeStore } from '../../store/theme'

/**
 * 2D 차트 토큰(chartTheme.ts)을 3D 씬에서 쓸 색으로 옮긴다.
 * chartTheme.ts는 건드리지 않고 읽기만 한다.
 */
export interface Chart3DPalette {
  grid: string
  axis: string
  label: string
  /** 바닥면 색 */
  floor: string
  tooltipBg: string
  tooltipBorder: string
  tooltipInk: string
}

export function useChart3DPalette(): Chart3DPalette {
  const theme = useChartTheme()
  const dark = useThemeStore((s) => s.mode) === 'dark'
  return {
    grid: theme.grid,
    axis: theme.axis,
    label: theme.axis,
    // 바닥은 카드 배경보다 아주 살짝 눌러 입체감의 기준면을 만든다
    floor: dark ? '#171b22' : '#f4f6f9',
    tooltipBg: theme.tooltipBg,
    tooltipBorder: theme.tooltipBorder,
    tooltipInk: theme.tooltipInk,
  }
}
