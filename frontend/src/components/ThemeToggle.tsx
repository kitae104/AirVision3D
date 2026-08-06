import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../store/theme'

/** 라이트/다크 전환. 선택은 브라우저에 저장된다. */
export default function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
  const toggle = useThemeStore((s) => s.toggle)
  const nextLabel = mode === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'

  return (
    <button
      type="button"
      onClick={toggle}
      title={nextLabel}
      aria-label={nextLabel}
      className="flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
    >
      {mode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}
