import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

/** OS 설정을 초기값으로 쓴다 (사용자가 한 번이라도 고르면 그 값이 우선한다) */
function systemMode(): ThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** <html> 클래스에 반영한다. Tailwind의 dark variant가 이 클래스를 본다. */
export function applyTheme(mode: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: systemMode(),
      setMode: (mode) => {
        applyTheme(mode)
        set({ mode })
      },
      toggle: () => get().setMode(get().mode === 'dark' ? 'light' : 'dark'),
    }),
    {
      name: 'airvision-theme',
      onRehydrateStorage: () => (state) => {
        applyTheme(state?.mode ?? systemMode())
      },
    },
  ),
)
