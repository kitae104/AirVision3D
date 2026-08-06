import { useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, UserSummary } from '../api/client'
import { ShieldCheck, User, UserRound } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import {
  Button,
  Card,
  CardHeader,
  Notice,
  PageHero,
  SectionHeading,
  inputClass,
  labelClass,
  useKindColor,
} from '../components/ui'

const inputCls = inputClass
const labelCls = labelClass
const smallInputCls =
  'w-full rounded-control border border-line-strong bg-surface px-2 py-1 text-sm text-ink focus:border-brand focus:outline-none'

function Message({ text, ok }: { text: string; ok: boolean }) {
  return <Notice tone={ok ? 'success' : 'error'}>{text}</Notice>
}

const ROLE_LABELS: Record<UserSummary['role'], string> = {
  ADMIN: '관리자',
  USER: '일반 사용자',
}

/** 관리자 사용자 관리: 목록 조회·등록·수정·비밀번호 재설정·삭제 (보고서 표 3-20) */
export default function UsersPage() {
  const myUsername = useAuthStore((s) => s.username)
  const accent = useKindColor('account')

  const [users, setUsers] = useState<UserSummary[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const loadUsers = async () => {
    setListError(null)
    try {
      const res = await apiClient.get<ApiResponse<UserSummary[]>>('/users')
      setUsers(res.data.data)
    } catch (err) {
      setListError(errorMessage(err))
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // --- 등록 폼 ---
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'USER' })
  const [creating, setCreating] = useState(false)

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMsg(null)
    setCreating(true)
    try {
      await apiClient.post('/users', form)
      setMsg({ text: `사용자 '${form.username}' 등록 완료`, ok: true })
      setForm({ username: '', name: '', password: '', role: 'USER' })
      loadUsers()
    } catch (err) {
      setMsg({ text: errorMessage(err), ok: false })
    } finally {
      setCreating(false)
    }
  }

  // --- 행 편집 (이름·역할) ---
  const [editingId, setEditingId] = useState<number | null>(null)
  const [edit, setEdit] = useState({ name: '', role: 'USER' })

  const startEdit = (u: UserSummary) => {
    setEditingId(u.id)
    setEdit({ name: u.name, role: u.role })
    setResetId(null)
  }

  const submitEdit = async (id: number) => {
    setMsg(null)
    try {
      await apiClient.put(`/users/${id}`, edit)
      setMsg({ text: '사용자 정보 수정 완료', ok: true })
      setEditingId(null)
      loadUsers()
    } catch (err) {
      setMsg({ text: errorMessage(err), ok: false })
    }
  }

  // --- 비밀번호 재설정 ---
  const [resetId, setResetId] = useState<number | null>(null)
  const [resetPw, setResetPw] = useState('')

  const submitReset = async (id: number) => {
    setMsg(null)
    try {
      await apiClient.put(`/users/${id}/password`, { password: resetPw })
      setMsg({ text: '비밀번호 재설정 완료', ok: true })
      setResetId(null)
      setResetPw('')
    } catch (err) {
      setMsg({ text: errorMessage(err), ok: false })
    }
  }

  // --- 삭제 ---
  const submitDelete = async (u: UserSummary) => {
    if (!window.confirm(`사용자 '${u.username}' (${u.name})을(를) 삭제할까요?`)) return
    setMsg(null)
    try {
      await apiClient.delete(`/users/${u.id}`)
      setMsg({ text: `사용자 '${u.username}' 삭제 완료`, ok: true })
      loadUsers()
    } catch (err) {
      setMsg({ text: errorMessage(err), ok: false })
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        accent={accent}
        eyebrow="계정 관리"
        value={users.length}
        unit="명"
        description="이 시스템에 로그인할 수 있는 계정입니다. 자기 자신과 마지막 관리자 계정은 삭제할 수 없습니다."
        facts={[
          {
            icon: <ShieldCheck size={15} />,
            label: '관리자',
            value: `${users.filter((u) => u.role === 'ADMIN').length}명`,
          },
          {
            icon: <User size={15} />,
            label: '일반 사용자',
            value: `${users.filter((u) => u.role === 'USER').length}명`,
          },
          { icon: <UserRound size={15} />, label: '내 계정', value: myUsername ?? '—' },
        ]}
      />

      {msg && <Message text={msg.text} ok={msg.ok} />}

      <SectionHeading title="계정 목록과 등록" accent={accent} hint="등록·수정·비밀번호 재설정·삭제" />
      <div className="grid gap-5 xl:grid-cols-3">
        {/* 등록 폼 */}
        <Card className="self-start">
          <CardHeader
            title="사용자 등록"
            hint="자기 자신과 마지막 관리자 계정은 삭제할 수 없습니다"
          />
          <form onSubmit={submitCreate} className="space-y-4">
          <div>
            <label className={labelCls}>아이디 * (영문·숫자 3~50자)</label>
            <input
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className={inputCls}
              autoComplete="off"
            />
          </div>
          <div>
            <label className={labelCls}>이름 *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>비밀번호 * (8자 이상)</label>
            <input
              required
              type="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className={inputCls}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className={labelCls}>역할 *</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className={inputCls}
            >
              <option value="USER">일반 사용자 (조회)</option>
              <option value="ADMIN">관리자 (등록·실행·삭제)</option>
            </select>
          </div>
          <Button type="submit" variant="primary" disabled={creating} className="w-full">
            {creating ? '등록 중…' : '등록'}
          </Button>
          </form>
        </Card>

        {/* 목록 */}
        <Card className="xl:col-span-2">
          <CardHeader title="사용자 목록" hint={`${users.length}명`} />
          {listError && <Message text={listError} ok={false} />}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-ink-muted">
                  <th className="py-2 pr-3">아이디</th>
                  <th className="py-2 pr-3">이름</th>
                  <th className="py-2 pr-3">역할</th>
                  <th className="py-2 pr-3">생성일</th>
                  <th className="py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-line align-top last:border-b-0">
                    <td className="py-2.5 pr-3 font-medium text-ink">
                      {u.username}
                      {u.username === myUsername && (
                        <span className="ml-1.5 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand-ink">
                          나
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-ink">
                      {editingId === u.id ? (
                        <input
                          value={edit.name}
                          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                          className={smallInputCls}
                        />
                      ) : (
                        u.name
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {editingId === u.id ? (
                        <select
                          value={edit.role}
                          onChange={(e) => setEdit({ ...edit, role: e.target.value })}
                          className={smallInputCls}
                        >
                          <option value="USER">일반 사용자</option>
                          <option value="ADMIN">관리자</option>
                        </select>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            u.role === 'ADMIN'
                              ? 'bg-brand-soft text-brand-ink'
                              : 'bg-surface-muted text-ink-muted'
                          }`}
                        >
                          {ROLE_LABELS[u.role]}
                        </span>
                      )}
                    </td>
                    <td className="num py-2.5 pr-3 text-ink-faint">
                      {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="space-x-1 whitespace-nowrap py-2.5 text-xs">
                      {editingId === u.id ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => submitEdit(u.id)}
                          >
                            저장
                          </Button>
                          <Button type="button" size="sm" onClick={() => setEditingId(null)}>
                            취소
                          </Button>
                        </>
                      ) : resetId === u.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="password"
                            placeholder="새 비밀번호 (8자 이상)"
                            value={resetPw}
                            onChange={(e) => setResetPw(e.target.value)}
                            className="w-40 rounded-control border border-line-strong bg-surface px-2 py-1 text-xs text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
                            autoComplete="new-password"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="primary"
                            onClick={() => submitReset(u.id)}
                            disabled={resetPw.length < 8}
                          >
                            변경
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setResetId(null)
                              setResetPw('')
                            }}
                          >
                            취소
                          </Button>
                        </span>
                      ) : (
                        <>
                          <Button type="button" size="sm" onClick={() => startEdit(u)}>
                            수정
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setResetId(u.id)
                              setResetPw('')
                              setEditingId(null)
                            }}
                          >
                            비밀번호
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => submitDelete(u)}
                            disabled={u.username === myUsername}
                            title={
                              u.username === myUsername ? '자기 자신은 삭제할 수 없습니다' : undefined
                            }
                          >
                            삭제
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !listError && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-sm text-ink-faint">
                      아직 등록된 사용자가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
