import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  /** 여백 없이 표·지도 등을 꽉 채울 때 */
  flush?: boolean
}

/** 모든 화면이 공유하는 기본 면(surface). 카드 스타일은 여기서만 정의한다. */
export function Card({ children, className = '', flush = false }: CardProps) {
  return (
    <div
      className={`rounded-card border border-line bg-surface shadow-card ${
        flush ? '' : 'p-5'
      } ${className}`}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: ReactNode
  /** 제목 아래 한 줄 설명 (출처, 기준, 주의사항) */
  hint?: ReactNode
  /** 우측 정렬 액션 (필터, 링크 등) */
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, hint, action, className = '' }: CardHeaderProps) {
  return (
    <div className={`mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-[0.9375rem] font-semibold text-ink">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
