import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, Observation, PageResponse, Site } from '../api/client'
import { gradeOf } from '../config/grades'
import { summarizeObservations } from '../utils/obsStats'
import { useAuthStore } from '../store/auth'

/** 요약·차트용 표본 크기 (백엔드 size 상한 200) */
const SAMPLE_SIZE = 200
/** PM2.5 미니 바 스케일 상한 (㎍/㎥) */
const BAR_SCALE = 100

/** 로컬 날짜(yyyy-MM-dd)를 하루 시작/끝 ISO Instant로 변환 */
function dayToInstant(date: string, endOfDay: boolean): string {
  return new Date(`${date}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString()
}

export default function ObservationsPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [siteId, setSiteId] = useState<string>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(0)
  const [data, setData] = useState<PageResponse<Observation> | null>(null)
  const [sample, setSample] = useState<Observation[]>([])
  const [error, setError] = useState<string | null>(null)
  const isAdmin = useAuthStore((s) => s.role) === 'ADMIN'

  useEffect(() => {
    apiClient
      .get<ApiResponse<Site[]>>('/sites')
      .then((res) => setSites(res.data.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  const filterParams = useCallback(() => {
    const params = new URLSearchParams()
    if (siteId) params.set('siteId', siteId)
    if (from) params.set('from', dayToInstant(from, false))
    if (to) params.set('to', dayToInstant(to, true))
    return params
  }, [siteId, from, to])

  const load = useCallback(() => {
    const params = filterParams()
    params.set('page', String(page))
    params.set('size', '15')
    apiClient
      .get<ApiResponse<PageResponse<Observation>>>(`/observations?${params}`)
      .then((res) => setData(res.data.data))
      .catch((err) => setError(errorMessage(err)))
  }, [filterParams, page])

  useEffect(load, [load])

  // 요약·차트용 표본 (같은 필터, 최신 200건)
  useEffect(() => {
    const params = filterParams()
    params.set('page', '0')
    params.set('size', String(SAMPLE_SIZE))
    apiClient
      .get<ApiResponse<PageResponse<Observation>>>(`/observations?${params}`)
      .then((res) => setSample(res.data.data.content))
      .catch(() => setSample([]))
  }, [filterParams])

  const summary = useMemo(() => summarizeObservations(sample), [sample])
  const chartData = useMemo(
    () => [...sample]
      .filter((o) => o.pm25 != null)
      .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
      .map((o) => ({
        time: new Date(o.observedAt).toLocaleString('ko-KR', {
          month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
        pm25: o.pm25,
        site: o.siteName,
      })),
    [sample])
  const sampleTruncated = (data?.totalElements ?? 0) > SAMPLE_SIZE

  const resetFilters = () => {
    setSiteId('')
    setFrom('')
    setTo('')
    setPage(0)
  }

  const remove = async (id: number) => {
    if (!confirm('이 관측값을 삭제할까요?')) return
    try {
      await apiClient.delete(`/observations/${id}`)
      load()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  const inputClass = 'rounded-md border border-gray-300 px-3 py-1.5 text-sm'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">관측 데이터</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <select
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value)
              setPage(0)
            }}
            className={inputClass}
          >
            <option value="">전체 관측소</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setPage(0)
            }}
            className={inputClass}
            aria-label="시작일"
          />
          <span className="text-gray-400">~</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setPage(0)
            }}
            className={inputClass}
            aria-label="종료일"
          />
          {(siteId || from || to) && (
            <button
              onClick={resetFilters}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-600 hover:bg-gray-100"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {/* 필터 결과 요약 + 등급 분포 + 추이 차트 */}
      {summary && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">조회 결과</p>
                <p className="text-xl font-bold text-gray-900">
                  {(data?.totalElements ?? summary.count).toLocaleString()}건
                </p>
              </div>
              <div>
                <p className="text-gray-500">평균 PM2.5</p>
                <p className="text-xl font-bold" style={{ color: gradeOf(summary.avgPm25).chart }}>
                  {summary.avgPm25.toFixed(1)}
                  <span className="ml-1 text-xs font-normal text-gray-400">㎍/㎥</span>
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500">최고 PM2.5</p>
                <p className="font-semibold text-gray-900">
                  <span style={{ color: gradeOf(summary.maxPm25).chart }}>
                    {summary.maxPm25.toFixed(1)}
                  </span>
                  <span className="ml-2 text-xs font-normal text-gray-500">
                    {summary.maxSite} · {new Date(summary.maxAt).toLocaleString('ko-KR')}
                  </span>
                </p>
              </div>
            </div>
            <div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                {summary.dist.filter((d) => d.count > 0).map((d) => (
                  <div
                    key={d.name}
                    style={{ width: `${d.ratio * 100}%`, backgroundColor: d.color }}
                    title={`${d.name} ${d.count}건`}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
                {summary.dist.map((d) => (
                  <span key={d.name} className="flex items-center gap-1">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: d.color }}
                    />
                    {d.name} {d.count}건 ({(d.ratio * 100).toFixed(0)}%)
                  </span>
                ))}
              </div>
            </div>
            {sampleTruncated && (
              <p className="text-[11px] text-gray-400">
                요약·차트는 필터 조건의 최근 {SAMPLE_SIZE}건 기준입니다
              </p>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
            <p className="mb-1 text-sm text-gray-500">PM2.5 추이 (시간순)</p>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={40} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(value) => [`${value} ㎍/㎥`, 'PM2.5']}
                  labelFormatter={(label, payload) =>
                    `${label}${payload?.[0]?.payload.site ? ` · ${payload[0].payload.site}` : ''}`}
                />
                <Line
                  type="monotone"
                  dataKey="pm25"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={chartData.length <= 60}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">관측소</th>
              <th className="px-4 py-2">관측 시각</th>
              <th className="px-4 py-2" style={{ minWidth: 160 }}>PM2.5</th>
              <th className="px-4 py-2">등급</th>
              <th className="px-4 py-2">PM10</th>
              <th className="px-4 py-2">기온</th>
              <th className="px-4 py-2">습도</th>
              <th className="px-4 py-2">풍속</th>
              {isAdmin && <th className="px-4 py-2" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data?.content.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 9 : 8} className="px-4 py-8 text-center text-gray-400">
                  조건에 맞는 관측값이 없습니다
                </td>
              </tr>
            )}
            {data?.content.map((o) => {
              const grade = o.pm25 != null ? gradeOf(o.pm25) : null
              return (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{o.siteName}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {new Date(o.observedAt).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-2">
                    {o.pm25 != null && grade ? (
                      <span className="flex items-center gap-2">
                        <span className="w-10 text-right font-medium tabular-nums">{o.pm25}</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (o.pm25 / BAR_SCALE) * 100)}%`,
                              backgroundColor: grade.chart,
                            }}
                          />
                        </span>
                      </span>
                    ) : '-'}
                  </td>
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
