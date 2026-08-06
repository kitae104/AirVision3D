import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wind } from 'lucide-react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse } from '../api/client'
import { useAuthStore } from '../store/auth'
import ThemeToggle from '../components/ThemeToggle'
import { Button, Notice, inputClass, labelClass } from '../components/ui'

interface LoginResult {
  token: string
  username: string
  name: string
  role: string
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiClient.post<ApiResponse<LoginResult>>('/auth/login', {
        username,
        password,
      })
      login(res.data.data)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-canvas px-4">
      {/* 대기 흐름을 연상시키는 배경 — 로그인 화면에만 쓴다 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60rem 30rem at 50% -10%, color-mix(in srgb, var(--av-brand) 14%, transparent), transparent 70%)',
        }}
      />

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-panel">
            <Wind size={24} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">AirVision 3D</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            AI 영상인식 기반 미세먼지 예측 및 3차원 시각화
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-card border border-line bg-surface p-6 shadow-card"
        >
          <div>
            <label className={labelClass} htmlFor="login-username">
              아이디
            </label>
            <input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              className={inputClass}
              placeholder="admin 또는 user"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="login-password">
              비밀번호
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="primary" disabled={loading} className="w-full">
            {loading ? '로그인 중...' : '로그인'}
          </Button>
        </form>
      </div>
    </div>
  )
}
