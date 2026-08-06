import type { ReactNode } from 'react'
import { accentWash } from '../../config/dataKinds'

export interface HeroFact {
  icon?: ReactNode
  label: string
  value: ReactNode
}

interface PageHeroProps {
  /** 이 화면이 다루는 데이터 종류의 액센트 색 (config/dataKinds.ts) */
  accent: string
  /** 값 위에 붙는 짧은 문맥 — 무엇의, 언제 값인지 */
  eyebrow: ReactNode
  /** 화면에서 가장 큰 숫자 하나 */
  value: ReactNode
  unit?: string
  /** 값 자체의 색. PM2.5처럼 등급이 있는 값은 등급색을 넘긴다. */
  valueColor?: string
  badge?: ReactNode
  /** 값을 어떻게 읽어야 하는지 한 줄 */
  description?: ReactNode
  /** 값을 뒷받침하는 보조 사실들 */
  facts?: HeroFact[]
  /** 오른쪽 위 컨트롤 (지역 선택 등) */
  actions?: ReactNode
  /** 값 오른쪽 영역 (스파크라인, 분포 바 등) */
  aside?: ReactNode
}

/**
 * 각 화면 맨 위의 요약 배너.
 * "이 화면에 온 사람이 가장 먼저 알고 싶은 값 하나"를 크게 보여 주고,
 * 배경에 종류색을 옅게 깔아 어떤 데이터를 보는 화면인지 읽기 전에 알 수 있게 한다.
 */
export default function PageHero({
  accent,
  eyebrow,
  value,
  unit,
  valueColor,
  badge,
  description,
  facts,
  actions,
  aside,
}: PageHeroProps) {
  return (
    <section className="relative overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: accentWash(accent) }}
      />
      <div className="relative p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-ink-muted">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: accent }}
            />
            {eyebrow}
          </span>
          {actions}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-3">
              <span
                className="num text-[3.25rem] font-semibold leading-none tracking-tight"
                style={{ color: valueColor ?? accent }}
              >
                {value}
              </span>
              {unit && <span className="text-sm text-ink-muted">{unit}</span>}
              {badge}
            </div>
            {description && <p className="mt-2.5 text-sm text-ink-muted">{description}</p>}
          </div>
          {aside && <div className="w-full max-w-xs">{aside}</div>}
        </div>

        {facts && facts.length > 0 && (
          <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-2 border-t border-line pt-4 text-sm">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-center gap-2">
                {fact.icon && <span className="text-ink-faint">{fact.icon}</span>}
                <dt className="text-ink-faint">{fact.label}</dt>
                <dd className="num font-medium text-ink">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  )
}
