import type { ReactNode } from 'react'

type Tone = 'error' | 'warning' | 'info' | 'success'

const TONES: Record<Tone, string> = {
  error:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200',
  warning:
    'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  info: 'border-line bg-surface-muted text-ink-muted',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
}

/** 화면 안내 문구. 무엇이 일어났고 무엇을 하면 되는지만 적는다. */
export default function Notice({
  tone = 'info',
  children,
  className = '',
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-control border px-4 py-2.5 text-sm ${TONES[tone]} ${className}`}
      role={tone === 'error' ? 'alert' : undefined}
    >
      {children}
    </div>
  )
}
