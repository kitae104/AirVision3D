import type { ReactNode } from 'react'

/**
 * 표 공통 스타일.
 * 세로줄을 없애고 가로줄만 남겨 행을 눈으로 따라가기 쉽게 한다.
 */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card">
      <table className="w-full min-w-max text-sm">{children}</table>
    </div>
  )
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-muted text-left text-xs font-medium tracking-wide text-ink-muted">
      {children}
    </thead>
  )
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line">{children}</tbody>
}

export function Th({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-4 py-2.5 font-medium ${className}`}>{children}</th>
}

export function Td({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 text-ink ${className}`}>{children}</td>
}

export function Tr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <tr className={`hover:bg-surface-muted/60 ${className}`}>{children}</tr>
}
