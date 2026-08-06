interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  /** 이 레이어가 무엇을 보여 주는지 (지도 컨트롤에서 사용) */
  hint?: string
  /** 켜졌을 때 표시할 색 점 (지도 범례와 맞춤) */
  dotColor?: string
  disabled?: boolean
}

/** 켜고 끄는 항목. 체크박스보다 상태가 한눈에 보인다. */
export default function Toggle({
  checked,
  onChange,
  label,
  hint,
  dotColor,
  disabled = false,
}: ToggleProps) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded-control px-2 py-1.5 text-sm ${
        disabled ? 'opacity-50' : 'cursor-pointer hover:bg-surface-muted'
      }`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand' : 'bg-line-strong'
        } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] ${
            checked ? 'left-4.5' : 'left-0.5'
          }`}
        />
      </button>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-ink">
          {dotColor && (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: dotColor }}
            />
          )}
          {label}
        </span>
        {hint && <span className="block text-xs text-ink-faint">{hint}</span>}
      </span>
    </label>
  )
}
