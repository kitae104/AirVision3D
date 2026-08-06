import type { ReactNode } from 'react'

interface StatTileProps {
  label: string
  value: ReactNode
  /** 값의 단위. 값보다 작게 붙는다. */
  unit?: string
  /** 값을 어떻게 읽어야 하는지 (기간, 출처, 상태) */
  sub?: ReactNode
  icon?: ReactNode
  /** 값 자체를 강조해야 할 때 (등급색 등) */
  valueClassName?: string
  /** 데이터 종류색. 아이콘과 왼쪽 띠에 적용해 같은 종류끼리 묶여 보이게 한다. */
  accent?: string
}

/** 지표 한 개를 보여 주는 최소 단위. 숫자는 항상 고정폭으로 둔다. */
export default function StatTile({
  label,
  value,
  unit,
  sub,
  icon,
  valueClassName = '',
  accent,
}: StatTileProps) {
  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card">
      {accent && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-0.5"
          style={{ backgroundColor: accent }}
        />
      )}
      <div className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
        {icon && (
          <span style={accent ? { color: accent } : undefined} className={accent ? '' : 'text-ink-faint'}>
            {icon}
          </span>
        )}
        <span className="truncate">{label}</span>
      </div>
      <p className={`num mt-2 text-2xl font-semibold tracking-tight text-ink ${valueClassName}`}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-ink-muted">{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </div>
  )
}
