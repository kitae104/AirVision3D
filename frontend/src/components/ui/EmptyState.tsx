import type { ReactNode } from 'react'

interface EmptyStateProps {
  /** 지금 화면이 비어 있는 이유 */
  title: string
  /** 채우려면 무엇을 하면 되는지 */
  hint?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
}

/** 빈 화면은 사과가 아니라 다음 할 일을 알려 주는 자리다. */
export default function EmptyState({
  title,
  hint,
  action,
  icon,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-12 text-center ${className}`}>
      {icon && <div className="mb-3 text-ink-faint">{icon}</div>}
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-xs text-ink-faint">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
