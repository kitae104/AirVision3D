import { useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, UserSummary } from '../api/client'

const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-gray-700'

/** 마이페이지: 내 계정 정보 확인 + 비밀번호 변경 (보고서 그림 3-65) */
export default function MyPage() {
  const [me, setMe] = useState<UserSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<ApiResponse<UserSummary>>('/users/me')
      .then((res) => setMe(res.data.data))
      .catch((err) => setLoadError(errorMessage(err)))
  }, [])

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    if (pw.next !== pw.confirm) {
      setMsg({ text: '새 비밀번호와 확인 값이 일치하지 않습니다', ok: false })
      return
    }
    setSaving(true)
    try {
      await apiClient.put('/users/me/password', {
        currentPassword: pw.current,
        newPassword: pw.next,
      })
      setMsg({ text: '비밀번호가 변경되었습니다', ok: true })
      setPw({ current: '', next: '', confirm: '' })
    } catch (err) {
      setMsg({ text: errorMessage(err), ok: false })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">마이페이지</h2>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">내 정보</h3>
          {loadError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
          )}
          {me && (
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">아이디</dt>
                <dd className="font-medium text-gray-900">{me.username}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">이름</dt>
                <dd className="font-medium text-gray-900">{me.name}</dd>
              </div>
              <div className="flex justify-between border-b border-gray-100 pb-2">
                <dt className="text-gray-500">역할</dt>
                <dd className="font-medium text-gray-900">
                  {me.role === 'ADMIN' ? '관리자' : '일반 사용자'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">계정 생성일</dt>
                <dd className="text-gray-700">
                  {new Date(me.createdAt).toLocaleString('ko-KR')}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <form
          onSubmit={submit}
          className="space-y-3 self-start rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h3 className="font-semibold text-gray-900">비밀번호 변경</h3>
          {msg && (
            <p
              className={`rounded-md px-3 py-2 text-sm ${
                msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {msg.text}
            </p>
          )}
          <div>
            <label className={labelCls}>현재 비밀번호 *</label>
            <input
              required
              type="password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              className={inputCls}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={labelCls}>새 비밀번호 * (8자 이상)</label>
            <input
              required
              type="password"
              minLength={8}
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelCls}>새 비밀번호 확인 *</label>
            <input
              required
              type="password"
              minLength={8}
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? '변경 중…' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}
