import type { ReactNode } from 'react'

interface SectionHeadingProps {
  title: string
  /** 이 섹션이 무엇을 기준으로 한 값인지 (지역, 기간, 출처) */
  hint?: ReactNode
  action?: ReactNode
  /** 이 섹션이 다루는 데이터 종류의 색. 생략하면 브랜드색. */
  accent?: string
}

/**
 * 화면을 의미 단위로 끊어 주는 구분자.
 * 왼쪽 막대 색이 "이 아래는 어떤 종류의 데이터인지"를 알려 준다.
 */
export default function SectionHeading({ title, hint, action, accent }: SectionHeadingProps) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden
          className={`h-4 w-1 shrink-0 translate-y-0.5 rounded-full ${accent ? '' : 'bg-brand'}`}
          style={accent ? { backgroundColor: accent } : undefined}
        />
        <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <span className="text-xs text-ink-faint">{hint}</span>}
      </div>
      {action}
    </div>
  )
}
