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
    <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.district)}
          className={`px-3 py-1.5 text-sm transition-colors ${
            value === opt.district
              ? 'bg-blue-600 font-medium text-white'
              : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
