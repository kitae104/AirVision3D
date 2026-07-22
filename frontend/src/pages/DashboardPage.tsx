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
import { Link } from 'react-router-dom'
import { apiClient, errorMessage } from '../api/client'
import type {
  AirForecastEnvelope,
  ApiResponse,
  ComparisonHistoryPoint,
  ComparisonResult,
  CurrentAirQuality,
  DashboardSummary,
  MeasurementHourlyPoint,
  PageResponse,
  Prediction,
  PublicHistorySummary,
  WeatherNow,
} from '../api/client'
import { gradeStyle } from '../config/grades'
import { PUBLIC_GRADE_COLORS } from '../config/publicGrades'
import RegionSelector from '../components/RegionSelector'

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

/** 공공 등급명 배지 */
function PublicGradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <span className="text-gray-400">-</span>
  const color = PUBLIC_GRADE_COLORS[grade]
  return (
    <span
      className="rounded-full px-2.5 py-0.5 text-sm font-medium"
      style={color ? { backgroundColor: `${color}22`, color } : undefined}
    >
      {grade}
    </span>
  )
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [hourly, setHourly] = useState<HourlyPoint[]>([])
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [publicAir, setPublicAir] = useState<CurrentAirQuality | null>(null)
  const [weather, setWeather] = useState<WeatherNow | null>(null)
  const [forecast, setForecast] = useState<AirForecastEnvelope | null>(null)
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [airHistory, setAirHistory] = useState<{ time: string; pm25: number | null }[]>([])
  const [errorHistory, setErrorHistory] =
    useState<{ time: string; error: number | null }[]>([])
  const [accumulated, setAccumulated] = useState<number | null>(null)
  const [district, setDistrict] = useState<string | null>(null)

  // 공공 데이터는 실패해도 대시보드 나머지에 영향을 주지 않도록 개별 로드
  useEffect(() => {
    apiClient.get<ApiResponse<CurrentAirQuality>>('/air-quality/current')
      .then((res) => {
        const data = res.data.data
        setPublicAir(data)
        const located = data.stations.filter((s) => s.locationAvailable)
        if (located.length > 0) {
          const lat = located.reduce((a, s) => a + (s.latitude ?? 0), 0) / located.length
          const lng = located.reduce((a, s) => a + (s.longitude ?? 0), 0) / located.length
          apiClient.get<ApiResponse<WeatherNow>>(
            `/weather/current?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}`)
            .then((w) => setWeather(w.data.data))
            .catch(() => setWeather(null))
        }
      })
      .catch(() => setPublicAir(null))
    apiClient.get<ApiResponse<AirForecastEnvelope>>('/air-quality/forecast?informCode=PM25')
      .then((res) => setForecast(res.data.data))
      .catch(() => setForecast(null))
    apiClient.get<ApiResponse<ComparisonResult>>('/air-quality/comparison/latest')
      .then((res) => setComparison(res.data.data))
      .catch(() => setComparison(null))
  }, [])

  useEffect(() => {
    const now = Date.now()
    const from = new Date(now - 48 * 3600 * 1000).toISOString()
    const to = new Date(now).toISOString()
    // 프로젝트 핵심 대상지인 인천 기준으로 실측 추이를 표시한다
    apiClient.get<ApiResponse<MeasurementHourlyPoint[]>>(
      `/public-data/history/measurements/hourly?sido=${encodeURIComponent('인천')}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .then((res) => setAirHistory(res.data.data.map((p) => ({
        time: new Date(p.hour).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit' }),
        pm25: p.avgPm25 != null ? Math.round(p.avgPm25 * 10) / 10 : null,
      }))))
      .catch(() => setAirHistory([]))
    apiClient.get<ApiResponse<ComparisonHistoryPoint[]>>('/air-quality/comparison/history')
      .then((res) => setErrorHistory(res.data.data.map((p) => ({
        time: new Date(p.computedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit' }),
        error: p.absoluteError,
      }))))
      .catch(() => setErrorHistory([]))
    apiClient.get<ApiResponse<PublicHistorySummary>>('/public-data/history/summary')
      .then((res) => setAccumulated(res.data.data.accumulatedCount))
      .catch(() => setAccumulated(null))
  }, [])

  // 자체 데이터(요약·시간별·예측)는 선택한 구 기준으로 재조회한다.
  // 구 전환 시 전체 로딩 화면 대신 이전 데이터를 잠깐 유지한다 (첫 로드만 로딩 표시).
  useEffect(() => {
    const dq = district ? `district=${encodeURIComponent(district)}` : ''
    Promise.all([
      apiClient.get<ApiResponse<DashboardSummary>>(`/dashboard/summary${dq ? `?${dq}` : ''}`),
      apiClient.get<ApiResponse<HourlyPoint[]>>(`/dashboard/hourly?hours=24${dq ? `&${dq}` : ''}`),
      apiClient.get<ApiResponse<PageResponse<Prediction>>>(`/predictions?size=20${dq ? `&${dq}` : ''}`),
    ])
      .then(([s, h, p]) => {
        setError(null)
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
  }, [district])

  if (loading) return <p className="text-gray-500">불러오는 중...</p>
  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>

  const grade = gradeStyle(summary?.grade ?? null)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">
          대시보드
          <span className="ml-2 text-sm font-normal text-gray-500">
            {district ? `${district} 기준` : '인천 전역 기준'}
          </span>
        </h2>
        <RegionSelector value={district} onChange={setDistrict} />
      </div>

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
        <StatCard
          label="최근 보간"
          value={summary?.recentInterpolationCount ?? '-'}
          sub={district ? '24시간 · 전체 기준' : '24시간'}
        />
      </div>

      {/* 공공 데이터 영역 (현재 측정 / 기상 / 대기질 예보 / AI 비교 / 시스템 상태 구분) */}
      <div>
        <div className="mb-2 flex items-baseline gap-3">
          <h3 className="font-semibold text-gray-900">공공 대기질·기상</h3>
          <span className="text-xs text-gray-400">
            인천 전역 (시/도 단위 자료) · 출처: 환경부·한국환경공단 AirKorea / 기상청
          </span>
          <Link to="/public-air" className="text-xs text-blue-600 hover:underline">
            예보·경보 자세히 →
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {(() => {
            const best = publicAir?.stations.find(
              (s) => s.pm25.valid && s.pm25.value != null)
            return (
              <StatCard
                label={`현재 대기질 (${publicAir?.sido ?? '-'} 실측)`}
                value={best
                  ? <span>{best.pm25.value} <span className="text-sm font-normal">㎍/㎥</span>{' '}
                      <PublicGradeBadge grade={best.pm25.grade} /></span>
                  : '-'}
                sub={best
                  ? `${best.stationName} · PM10 ${best.pm10.value ?? '-'} · KHAI ${best.khai.value ?? '-'}`
                  : '실측 데이터 없음'}
              />
            )
          })()}
          <StatCard
            label="기상 (기상청)"
            value={weather?.temperature != null
              ? <span>{weather.temperature}<span className="text-sm font-normal">℃</span></span>
              : '-'}
            sub={weather
              ? `습도 ${weather.humidity ?? '-'}% · ${weather.windDirectionText ?? ''} ${weather.windSpeed ?? '-'}m/s · 강수 ${weather.precipitationType ?? '-'}`
              : '기상 데이터 없음'}
          />
          {(() => {
            const sido = publicAir?.sido ?? '인천'
            const days = ['오늘', '내일', '모레']
            return (
              <StatCard
                label={`대기질 예보 (PM2.5 · ${sido})`}
                value={
                  forecast && forecast.forecasts.length > 0 ? (
                    <span className="flex flex-wrap items-center gap-1.5 text-sm font-normal">
                      {forecast.forecasts.slice(0, 3).map((f, i) => {
                        const grade = f.grades.find((g) => g.region.includes(sido))?.grade ?? null
                        return (
                          <span key={i} className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">{days[i]}</span>
                            <PublicGradeBadge grade={grade} />
                          </span>
                        )
                      })}
                    </span>
                  ) : '-'}
                sub="현재 측정값이 아닌 예보입니다"
              />
            )
          })()}
          {(() => {
            const matched = comparison?.rows.filter((r) => r.matched) ?? []
            const avgError = matched.length > 0
              ? matched.reduce((a, r) => a + (r.absoluteError ?? 0), 0) / matched.length
              : null
            return (
              <StatCard
                label="AI 추정 vs 실측 (PM2.5)"
                value={avgError != null
                  ? <span>±{avgError.toFixed(1)} <span className="text-sm font-normal">㎍/㎥</span></span>
                  : '-'}
                sub={matched.length > 0
                  ? `매칭 ${matched.length}건 평균 절대오차`
                  : 'AI 예측 실행 후 비교 가능'}
              />
            )
          })()}
          <StatCard
            label="공공 데이터 상태"
            value={publicAir
              ? (publicAir.mock
                ? <span className="text-base text-amber-600">Mock 모드</span>
                : publicAir.stale
                  ? <span className="text-base text-orange-600">지연 데이터</span>
                  : <span className="text-base text-green-600">정상</span>)
              : <span className="text-base text-gray-400">연결 안 됨</span>}
            sub={publicAir?.collectedAt
              ? `마지막 수집 ${new Date(publicAir.collectedAt).toLocaleTimeString('ko-KR')}${publicAir.mock ? ' · 서비스키 입력 시 실 데이터' : ''}`
              : '백엔드 공공 API 상태를 확인하세요'}
          />
        </div>
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

      <div>
        <div className="mb-2 flex items-baseline gap-3">
          <h3 className="font-semibold text-gray-900">공공 데이터 누적 추이</h3>
          <span className="text-xs text-gray-400">
            인천 전역 (시/도 단위 자료) · 매시간 자동 수집 · 출처: AirKorea / 기상청
            {accumulated != null && ` · 누적 ${accumulated.toLocaleString()}건`}
          </span>
        </div>
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-700">
              공공 실측 PM2.5 추이 (인천 시간별 평균, 최근 48h)
            </h4>
            {airHistory.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">
                아직 누적된 실측 데이터가 없습니다. 수집이 진행되면 표시됩니다.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={airHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" fontSize={11} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Line type="monotone" dataKey="pm25" name="평균 PM2.5"
                    stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <h4 className="mb-3 text-sm font-semibold text-gray-700">
              AI 추정-실측 절대오차 추이 (PM2.5)
            </h4>
            {errorHistory.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-400">
                비교 이력이 아직 없습니다. AI 예측을 실행하면 매칭된 오차가 시간에 따라 쌓입니다.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={errorHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" fontSize={11} />
                  <YAxis fontSize={12} unit="㎍" />
                  <Tooltip />
                  <Line type="monotone" dataKey="error" name="절대오차"
                    stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
