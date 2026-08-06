import { useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
 * 3D 지도 위에 떠 있는 컨트롤 패널의 뼈대.
 * 지도가 화면을 가득 채우도록 컨트롤을 지도 위로 올리고,
 * 주제별 접기로 한 번에 보이는 항목 수를 줄인다.
 */
export function MapPanel({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(true)

  return (
    // 좌하단은 Cesium 재생 위젯 자리이므로 패널 높이를 그 위까지만 잡는다
    <div className="absolute left-3 top-3 z-20 flex max-h-[calc(100%-10rem)] w-[19.5rem] max-w-[calc(100%-1.5rem)] flex-col">
      <div className="flex min-h-0 flex-col overflow-hidden rounded-card border border-line bg-overlay shadow-panel backdrop-blur-md">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-3.5 py-2.5 text-left"
        >
          <span className="text-sm font-semibold text-ink">지도 설정</span>
          <ChevronDown
            size={16}
            className={`text-ink-faint transition-transform ${open ? '' : '-rotate-90'}`}
          />
        </button>
        {open && <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>}
      </div>
    </div>
  )
}

interface PanelSectionProps {
  title: string
  icon: LucideIcon
  /** 접혀 있어도 상태를 알 수 있게 하는 요약 (예: "6개 켜짐") */
  summary?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function PanelSection({
  title,
  icon: Icon,
  summary,
  defaultOpen = false,
  children,
}: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-surface-muted"
      >
        <Icon size={15} className="shrink-0 text-ink-faint" />
        <span className="flex-1 text-sm font-medium text-ink">{title}</span>
        {summary && <span className="text-[0.6875rem] text-ink-faint">{summary}</span>}
        <ChevronDown
          size={15}
          className={`shrink-0 text-ink-faint transition-transform ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {open && <div className="space-y-2.5 px-3 pb-3.5 pt-0.5">{children}</div>}
    </section>
  )
}

/** 섹션 안에서 항목을 다시 묶는 소제목 */
export function PanelGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 px-2 text-[0.6875rem] font-semibold tracking-wide text-ink-faint">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

/** 패널 안의 라벨 + 컨트롤 한 줄 */
export function PanelField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block px-2">
      <span className="mb-1 block text-[0.6875rem] font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  )
}

/** 지도 우하단 등급 범례 */
export function MapLegend({
  items,
}: {
  items: { name: string; color: string; note?: string }[]
}) {
  return (
    <div className="pointer-events-none absolute bottom-12 right-3 z-20 max-w-[16rem] rounded-card border border-line bg-overlay px-3 py-2 shadow-panel backdrop-blur-md">
      <p className="mb-1.5 text-[0.6875rem] font-semibold text-ink-muted">PM2.5 등급</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {items.map((item) => (
          <span key={item.name} className="flex items-center gap-1.5 text-[0.6875rem] text-ink">
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
            {item.note && <span className="text-ink-faint">{item.note}</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
