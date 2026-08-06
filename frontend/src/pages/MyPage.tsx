import { useEffect, useState } from 'react'
import { CalendarDays, IdCard, ShieldCheck } from 'lucide-react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, UserSummary } from '../api/client'
import {
  Button,
  Card,
  CardHeader,
  Notice,
  PageHero,
  Skeleton,
  inputClass,
  labelClass,
  useKindColor,
} from '../components/ui'

/** 마이페이지: 내 계정 정보 확인 + 비밀번호 변경 (보고서 그림 3-65) */
export default function MyPage() {
  const [me, setMe] = useState<UserSummary | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const accent = useKindColor('account')

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
    <div className="max-w-4xl space-y-6">
      <PageHero
        accent={accent}
        eyebrow="내 계정"
        value={me ? me.name : '—'}
        description={
          me
            ? '로그인 중인 계정 정보입니다. 아래에서 비밀번호를 바꿀 수 있습니다.'
            : '계정 정보를 불러오는 중입니다.'
        }
        facts={[
          { icon: <IdCard size={15} />, label: '아이디', value: me ? me.username : '—' },
          {
            icon: <ShieldCheck size={15} />,
            label: '역할',
            value: me ? (me.role === 'ADMIN' ? '관리자' : '일반 사용자') : '—',
          },
          {
            icon: <CalendarDays size={15} />,
            label: '계정 생성일',
            value: me ? new Date(me.createdAt).toLocaleString('ko-KR') : '—',
          },
        ]}
      />

      {loadError && <Notice tone="error">{loadError}</Notice>}
      {!me && !loadError && <Skeleton className="h-32" />}

      <Card className="max-w-md">
        <CardHeader title="비밀번호 변경" hint="새 비밀번호는 8자 이상이어야 합니다" />
        <form onSubmit={submit} className="space-y-4">
          {msg && <Notice tone={msg.ok ? 'success' : 'error'}>{msg.text}</Notice>}
          <div>
            <label className={labelClass}>현재 비밀번호 *</label>
            <input
              required
              type="password"
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
              className={inputClass}
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className={labelClass}>새 비밀번호 *</label>
            <input
              required
              type="password"
              minLength={8}
              value={pw.next}
              onChange={(e) => setPw({ ...pw, next: e.target.value })}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelClass}>새 비밀번호 확인 *</label>
            <input
              required
              type="password"
              minLength={8}
              value={pw.confirm}
              onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              className={inputClass}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" variant="primary" disabled={saving} className="w-full">
            {saving ? '변경 중…' : '비밀번호 변경'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
