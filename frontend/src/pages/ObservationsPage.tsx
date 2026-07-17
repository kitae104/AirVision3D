import { useCallback, useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, Observation, PageResponse, Site } from '../api/client'
import { gradeOf } from '../config/grades'
import { useAuthStore } from '../store/auth'

export default function ObservationsPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState<string>('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<PageResponse<Observation> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const isAdmin = useAuthStore((s) => s.role) === 'ADMIN'

  useEffect(() => {
    apiClient
      .get<ApiResponse<Site[]>>('/sites')
      .then((res) => setSites(res.data.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), size: '15' })
    if (siteId) params.set('siteId', siteId)
    apiClient
      .get<ApiResponse<PageResponse<Observation>>>(`/observations?${params}`)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(errorMessage(err)))
  }, [page, siteId])

  useEffect(load, [load])

  const remove = async (id: number) => {
    if (!confirm('이 관측값을 삭제할까요?')) return
    try {
      await apiClient.delete(`/observations/${id}`)
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">관측 데이터</h2>
        <select
          value={siteId}
          onChange={(e) => {
            setSiteId(e.target.value)
            setPage(0)
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="">전체 관측소</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">관측소</th>
              <th className="px-4 py-2">관측 시각</th>
              <th className="px-4 py-2">PM2.5</th>
              <th className="px-4 py-2">등급</th>
              <th className="px-4 py-2">PM10</th>
              <th className="px-4 py-2">기온</th>
              <th className="px-4 py-2">습도</th>
              <th className="px-4 py-2">풍속</th>
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.content.map((o) => {
              const grade = o.pm25 != null ? gradeOf(o.pm25) : null
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{o.siteName}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {new Date(o.observedAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-2">{o.pm25 ?? '-'}</td>
                  <td className="px-4 py-2">
                    {grade && (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${grade.badge}`}>
                        {grade.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{o.pm10 ?? '-'}</td>
                  <td className="px-4 py-2">{o.temperature ?? '-'}℃</td>
                  <td className="px-4 py-2">{o.humidity ?? '-'}%</td>
                  <td className="px-4 py-2">{o.windSpeed ?? '-'}m/s</td>
                  {isAdmin && (
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => remove(o.id)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        삭제
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            총 {data.totalElements.toLocaleString()}건 · {page + 1}/{Math.max(data.totalPages, 1)}{' '}
            페이지
          </span>
          <div className="space-x-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
            >
              이전
            </button>
            <button
              disabled={page + 1 >= data.totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-md border border-gray-300 px-3 py-1 disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
