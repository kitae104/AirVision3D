import { useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, UserSummary } from '../api/client'
import { useAuthStore } from '../store/auth'

const inputCls =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none'
const labelCls = 'mb-1 block text-sm font-medium text-gray-700'
const smallInputCls =
  'w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none'

function Message({ text, ok }: { text: string; ok: boolean }) {
  return (
    <p
      className={`rounded-md px-3 py-2 text-sm ${ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
    >
      {text}
    </p>
  )
}

const ROLE_LABELS: Record<UserSummary['role'], string> = {
  ADMIN: '관리자',
  USER: '일반 사용자',
}

/** 관리자 사용자 관리: 목록 조회·등록·수정·비밀번호 재설정·삭제 (보고서 표 3-20) */
export default function UsersPage() {
  const myUsername = useAuthStore((s) => s.username)

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
      <h2 className="text-xl font-bold text-gray-900">사용자 관리</h2>
      <p className="text-sm text-gray-500">
        계정 등록·수정·삭제와 비밀번호 재설정을 관리합니다. 자기 자신과 마지막 관리자
        계정은 삭제할 수 없습니다.
      </p>

      {msg && <Message text={msg.text} ok={msg.ok} />}

      <div className="grid gap-6 xl:grid-cols-3">
        {/* 등록 폼 */}
        <form
          onSubmit={submitCreate}
          className="space-y-3 self-start rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
        >
          <h3 className="font-semibold text-gray-900">사용자 등록</h3>
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
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? '등록 중…' : '등록'}
          </button>
        </form>

        {/* 목록 */}
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm xl:col-span-2">
          <h3 className="mb-3 font-semibold text-gray-900">
            사용자 목록 <span className="text-sm font-normal text-gray-500">({users.length}명)</span>
          </h3>
          {listError && <Message text={listError} ok={false} />}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="py-2 pr-3">아이디</th>
                  <th className="py-2 pr-3">이름</th>
                  <th className="py-2 pr-3">역할</th>
                  <th className="py-2 pr-3">생성일</th>
                  <th className="py-2">관리</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gray-100 align-top">
                    <td className="py-2 pr-3 font-medium text-gray-900">
                      {u.username}
                      {u.username === myUsername && (
                        <span className="ml-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                          나
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3">
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
                    <td className="py-2 pr-3">
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
                          className={`rounded px-1.5 py-0.5 text-xs ${
                            u.role === 'ADMIN'
                              ? 'bg-purple-50 text-purple-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {ROLE_LABELS[u.role]}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="space-x-1 whitespace-nowrap py-2 text-xs">
                      {editingId === u.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => submitEdit(u.id)}
                            className="rounded-md bg-blue-600 px-2 py-1 text-white hover:bg-blue-700"
                          >
                            저장
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100"
                          >
                            취소
                          </button>
                        </>
                      ) : resetId === u.id ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="password"
                            placeholder="새 비밀번호 (8자 이상)"
                            value={resetPw}
                            onChange={(e) => setResetPw(e.target.value)}
                            className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                            autoComplete="new-password"
                          />
                          <button
                            type="button"
                            onClick={() => submitReset(u.id)}
                            disabled={resetPw.length < 8}
                            className="rounded-md bg-blue-600 px-2 py-1 text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            변경
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetId(null)
                              setResetPw('')
                            }}
                            className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100"
                          >
                            취소
                          </button>
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(u)}
                            className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setResetId(u.id)
                              setResetPw('')
                              setEditingId(null)
                            }}
                            className="rounded-md border border-gray-300 px-2 py-1 text-gray-600 hover:bg-gray-100"
                          >
                            비밀번호
                          </button>
                          <button
                            type="button"
                            onClick={() => submitDelete(u)}
                            disabled={u.username === myUsername}
                            className="rounded-md border border-red-200 px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40"
                            title={u.username === myUsername ? '자기 자신은 삭제할 수 없습니다' : undefined}
                          >
                            삭제
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !listError && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">
                      사용자가 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
