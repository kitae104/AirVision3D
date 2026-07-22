import { useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, InterpolationResult, PageResponse } from '../api/client'
import { gradeOf } from '../config/grades'

const inputCls =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none'

interface TargetRow {
  name: string
  latitude: string
  longitude: string
}

/** 관리자: IDW 보간 실행 */
export default function InterpolationPage() {
  const [power, setPower] = useState('2.0')
  const [method, setMethod] = useState<'IDW' | 'MODIFIED_IDW'>('IDW')
  const [targets, setTargets] = useState<TargetRow[]>([
    { name: '서울숲', latitude: '37.5443', longitude: '127.0374' },
  ])
  const [results, setResults] = useState<InterpolationResult[]>([])
  const [recent, setRecent] = useState<InterpolationResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadRecent = () =>
    apiClient
      .get<ApiResponse<PageResponse<InterpolationResult>>>('/interpolations?size=10')
      .then((res) => setRecent(res.data.data.content))

  useEffect(() => {
    loadRecent()
  }, [])

  const updateRow = (i: number, patch: Partial<TargetRow>) =>
    setTargets(targets.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await apiClient.post<ApiResponse<InterpolationResult[]>>(
        '/interpolations/run',
        {
          power: Number(power),
          method,
          targets: targets.map((t) => ({
            name: t.name || null,
            latitude: Number(t.latitude),
            longitude: Number(t.longitude),
          })),
        },
      )
      setResults(res.data.data)
      loadRecent()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">IDW 공간 보간</h2>
      <p className="text-sm text-gray-500">
        관측소별 최신 PM2.5를 기준으로, 관측소가 없는 지점의 값을 거리 역가중 평균으로 추정합니다.
      </p>

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap gap-4">
          <div className="w-48">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              거리 가중치 지수 p (0.1~10)
            </label>
            <input type="number" step="0.1" min={0.1} max={10} value={power} onChange={(e) => setPower(e.target.value)} className={inputCls} />
          </div>
          <div className="w-56">
            <label className="mb-1 block text-sm font-medium text-gray-700">보간 방법</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as 'IDW' | 'MODIFIED_IDW')}
              className={inputCls}
            >
              <option value="IDW">일반 IDW</option>
              <option value="MODIFIED_IDW">Modified IDW (보정 가중치)</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">
              Modified IDW는 관측지점별 1차 보간 오차로 가중치를 보정합니다
            </p>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">보간 대상 위치</span>
            <button
              type="button"
              onClick={() => setTargets([...targets, { name: '', latitude: '', longitude: '' }])}
              className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100"
            >
              + 위치 추가
            </button>
          </div>
          <div className="space-y-2">
            {targets.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <input placeholder="이름 (선택)" value={t.name} onChange={(e) => updateRow(i, { name: e.target.value })} className={inputCls} />
                <input required placeholder="위도" type="number" step="any" min={-90} max={90} value={t.latitude} onChange={(e) => updateRow(i, { latitude: e.target.value })} className={inputCls} />
                <input required placeholder="경도" type="number" step="any" min={-180} max={180} value={t.longitude} onChange={(e) => updateRow(i, { longitude: e.target.value })} className={inputCls} />
                <button
                  type="button"
                  disabled={targets.length === 1}
                  onClick={() => setTargets(targets.filter((_, idx) => idx !== i))}
                  className="shrink-0 text-sm text-red-500 disabled:opacity-30"
                >
                  삭제
                </button>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {loading ? '보간 중...' : '보간 실행'}
        </button>
      </form>

      {results.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">보간 결과</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => {
              const grade = gradeOf(r.pm25)
              return (
                <div key={r.id} className="rounded-md border border-gray-200 p-3">
                  <p className="font-medium text-gray-900">{r.targetName ?? `지점 ${r.id}`}</p>
                  <p className="text-2xl font-bold">{r.pm25.toFixed(1)} <span className="text-sm font-normal text-gray-500">㎍/㎥</span></p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${grade.badge}`}>{grade.name}</span>
                  <p className="mt-1 text-xs text-gray-400">({r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}) · p={r.power}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <h3 className="border-b border-gray-100 px-5 py-3 font-semibold text-gray-900">최근 보간 이력</h3>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">지점</th>
              <th className="px-4 py-2">좌표</th>
              <th className="px-4 py-2">PM2.5</th>
              <th className="px-4 py-2">알고리즘</th>
              <th className="px-4 py-2">p</th>
              <th className="px-4 py-2">기준 시각</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recent.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2">{r.targetName ?? '-'}</td>
                <td className="px-4 py-2 text-gray-600">
                  {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                </td>
                <td className="px-4 py-2 font-medium">{r.pm25.toFixed(1)}</td>
                <td className="px-4 py-2">{r.algorithm}</td>
                <td className="px-4 py-2">{r.power}</td>
                <td className="px-4 py-2 text-gray-600">
                  {new Date(r.interpolatedAt).toLocaleString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
