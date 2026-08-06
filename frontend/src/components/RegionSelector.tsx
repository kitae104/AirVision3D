import { INCHEON_CORE_DISTRICTS } from '../config/sido'

/**
 * 대시보드 지역 선택 세그먼트 버튼 (인천 전역 / 핵심 3구).
 * value가 null이면 인천 전역(필터 없음)을 뜻한다.
 */
export default function RegionSelector({
  value,
  onChange,
}: {
  value: string | null
  onChange: (district: string | null) => void
}) {
  const options: { label: string; district: string | null }[] = [
    { label: '인천 전역', district: null },
    ...INCHEON_CORE_DISTRICTS.map((d) => ({ label: d.name, district: d.name })),
  ]
  return (
    <div className="inline-flex gap-0.5 rounded-control border border-line bg-surface-muted p-0.5">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.district)}
          className={`rounded-[0.375rem] px-3 py-1.5 text-sm transition-colors ${
            value === opt.district
              ? 'bg-surface font-semibold text-ink shadow-card'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
