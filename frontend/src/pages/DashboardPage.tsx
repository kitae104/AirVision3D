import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiClient, errorMessage } from '../api/client'
import type {
  ApiResponse,
  DashboardSummary,
  PageResponse,
  Prediction,
} from '../api/client'
import { gradeStyle } from '../config/grades'

interface HourlyPoint {
  time: string
  avgPm25: number
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [hourly, setHourly] = useState<HourlyPoint[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      apiClient.get<ApiResponse<DashboardSummary>>('/dashboard/summary'),
      apiClient.get<ApiResponse<HourlyPoint[]>>('/dashboard/hourly?hours=24'),
      apiClient.get<ApiResponse<PageResponse<Prediction>>>('/predictions?size=20'),
    ])
      .then(([s, h, p]) => {
        setSummary(s.data.data)
        setHourly(
          h.data.data.map((row) => ({
            ...row,
            time: new Date(row.time).toLocaleTimeString('ko-KR', {
              hour: '2-digit',
              hour12: false,
            }),
          })),
        )
        setPredictions(
          p.data.data.content.filter((x) => x.actualPm25 != null).reverse(),
        )
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500">불러오는 중...</p>
  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>

  const grade = gradeStyle(summary?.grade ?? null)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">대시보드</h2>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="최신 평균 PM2.5"
          value={summary?.latestAvgPm25 != null ? `${summary.latestAvgPm25} ㎍/㎥` : '-'}
        />
        <StatCard
          label="대기 상태"
          value={
            grade ? (
              <span className={`rounded-full px-3 py-1 text-base ${grade.badge}`}>
                {grade.name}
              </span>
            ) : (
              '-'
            )
          }
        />
        <StatCard label="관측소 수" value={summary?.siteCount ?? '-'} />
        <StatCard label="최근 예측" value={summary?.recentPredictionCount ?? '-'} sub="24시간" />
        <StatCard label="최근 보간" value={summary?.recentInterpolationCount ?? '-'} sub="24시간" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">시간별 평균 PM2.5 (최근 24시간)</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="time" fontSize={12} />
              <YAxis fontSize={12} unit="" />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="avgPm25"
                name="평균 PM2.5"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 font-semibold text-gray-900">관측값 vs AI 예측값 (최근 예측)</h3>
          {predictions.length === 0 ? (
            <p className="py-16 text-center text-sm text-gray-400">
              비교할 예측 데이터가 없습니다. AI 예측을 실행해 보세요.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={predictions.map((p, i) => ({ ...p, idx: i + 1 }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="idx" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Line dataKey="actualPm25" name="관측값" stroke="#22c55e" strokeWidth={2} />
                <Line dataKey="predictedPm25" name="예측값" stroke="#f97316" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
