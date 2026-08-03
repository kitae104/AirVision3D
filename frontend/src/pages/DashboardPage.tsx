import { useEffect, useState } from 'react'
import {
  Area,
  AreaChart,
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
import {
  ArrowRight,
  CalendarDays,
  Database,
  Droplets,
  Navigation,
  Radio,
  Sparkles,
  Target,
  Thermometer,
  Wind,
} from 'lucide-react'
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
import RegionSelector from '../components/RegionSelector'
import { LazyBar3DChart } from '../components/chart3d'
import {
  Card,
  CardHeader,
  EmptyState,
  GradeBadge,
  Notice,
  SectionHeading,
  Skeleton,
  StatTile,
  tooltipProps,
  useChartTheme,
  useKindColor,
} from '../components/ui'

interface HourlyPoint {
  time: string
  avgPm25: number
}

const NO_DATA = '—'

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
  const [errorHistory, setErrorHistory] = useState<{ time: string; error: number | null }[]>([])
  const [accumulated, setAccumulated] = useState<number | null>(null)
  const [district, setDistrict] = useState<string | null>(null)
  const chart = useChartTheme()
  // 데이터 종류별 색 — 같은 종류는 다른 화면에서도 같은 색을 쓴다
  const obsColor = useKindColor('observation')
  const aiColor = useKindColor('prediction')
  const publicColor = useKindColor('publicAir')
  const accountColor = useKindColor('account')
  const idwColor = useKindColor('interpolation')

  // 공공 데이터는 실패해도 대시보드 나머지에 영향을 주지 않도록 개별 로드
  useEffect(() => {
    apiClient
      .get<ApiResponse<CurrentAirQuality>>('/air-quality/current')
      .then((res) => {
        const data = res.data.data
        setPublicAir(data)
        const located = data.stations.filter((s) => s.locationAvailable)
        if (located.length > 0) {
          const lat = located.reduce((a, s) => a + (s.latitude ?? 0), 0) / located.length
          const lng = located.reduce((a, s) => a + (s.longitude ?? 0), 0) / located.length
          apiClient
            .get<ApiResponse<WeatherNow>>(
              `/weather/current?latitude=${lat.toFixed(5)}&longitude=${lng.toFixed(5)}`,
            )
            .then((w) => setWeather(w.data.data))
            .catch(() => setWeather(null))
        }
      })
      .catch(() => setPublicAir(null))
    apiClient
      .get<ApiResponse<AirForecastEnvelope>>('/air-quality/forecast?informCode=PM25')
      .then((res) => setForecast(res.data.data))
      .catch(() => setForecast(null))
    apiClient
      .get<ApiResponse<ComparisonResult>>('/air-quality/comparison/latest')
      .then((res) => setComparison(res.data.data))
      .catch(() => setComparison(null))
  }, [])

  useEffect(() => {
    const now = Date.now()
    const from = new Date(now - 48 * 3600 * 1000).toISOString()
    const to = new Date(now).toISOString()
    // 프로젝트 핵심 대상지인 인천 기준으로 실측 추이를 표시한다
    apiClient
      .get<ApiResponse<MeasurementHourlyPoint[]>>(
        `/public-data/history/measurements/hourly?sido=${encodeURIComponent('인천')}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      )
      .then((res) =>
        setAirHistory(
          res.data.data.map((p) => ({
            time: new Date(p.hour).toLocaleString('ko-KR', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
            }),
            pm25: p.avgPm25 != null ? Math.round(p.avgPm25 * 10) / 10 : null,
          })),
        ),
      )
      .catch(() => setAirHistory([]))
    apiClient
      .get<ApiResponse<ComparisonHistoryPoint[]>>('/air-quality/comparison/history')
      .then((res) =>
        setErrorHistory(
          res.data.data.map((p) => ({
            time: new Date(p.computedAt).toLocaleString('ko-KR', {
              month: 'numeric',
              day: 'numeric',
              hour: '2-digit',
            }),
            error: p.absoluteError,
          })),
        ),
      )
      .catch(() => setErrorHistory([]))
    apiClient
      .get<ApiResponse<PublicHistorySummary>>('/public-data/history/summary')
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
      apiClient.get<ApiResponse<PageResponse<Prediction>>>(
        `/predictions?size=20${dq ? `&${dq}` : ''}`,
      ),
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
        setPredictions(p.data.data.content.filter((x) => x.actualPm25 != null).reverse())
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [district])

  const grade = gradeStyle(summary?.grade ?? null)
  const regionLabel = district ?? '인천 전역'
  const gradeColor = grade?.chart ?? '#9ca3af'

  const bestStation = publicAir?.stations.find((s) => s.pm25.valid && s.pm25.value != null)
  const matched = comparison?.rows.filter((r) => r.matched) ?? []
  const avgError =
    matched.length > 0
      ? matched.reduce((a, r) => a + (r.absoluteError ?? 0), 0) / matched.length
      : null

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-52" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    )
  }

  if (error) return <Notice tone="error">{error}</Notice>

  return (
    <div className="space-y-8">
      {/* 히어로 — 이 화면에 온 사람이 가장 먼저 알고 싶은 한 가지 */}
      <section className="relative overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${gradeColor}26 0%, ${gradeColor}0d 40%, transparent 70%)`,
          }}
        />
        <div className="relative p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-medium text-ink-muted">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: gradeColor }}
              />
              {regionLabel} · 지금
            </span>
            <RegionSelector value={district} onChange={setDistrict} />
          </div>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <span
                  className="num text-[3.25rem] font-semibold leading-none tracking-tight"
                  style={{ color: gradeColor }}
                >
                  {summary?.latestAvgPm25 ?? NO_DATA}
                </span>
                <span className="text-sm text-ink-muted">㎍/㎥</span>
                <GradeBadge grade={summary?.grade ?? null} />
              </div>
              <p className="mt-2.5 text-sm text-ink-muted">
                {grade?.advice ?? '관측값이 아직 없습니다. 데이터를 등록하면 표시됩니다.'}
              </p>
            </div>

            {hourly.length > 0 && (
              <div className="w-full max-w-xs">
                <p className="mb-1 text-right text-[0.6875rem] text-ink-faint">최근 24시간</p>
                <ResponsiveContainer width="100%" height={64}>
                  <AreaChart data={hourly} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={gradeColor} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={gradeColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="avgPm25"
                      stroke={gradeColor}
                      strokeWidth={2}
                      fill="url(#heroFill)"
                      dot={false}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <dl className="mt-5 flex flex-wrap gap-x-7 gap-y-2 border-t border-line pt-4 text-sm">
            <HeroFact
              icon={<Wind size={15} />}
              label="PM10"
              value={bestStation?.pm10.value != null ? `${bestStation.pm10.value} ㎍/㎥` : NO_DATA}
            />
            <HeroFact
              icon={<Thermometer size={15} />}
              label="기온"
              value={weather?.temperature != null ? `${weather.temperature} ℃` : NO_DATA}
            />
            <HeroFact
              icon={<Droplets size={15} />}
              label="습도"
              value={weather?.humidity != null ? `${weather.humidity} %` : NO_DATA}
            />
            <HeroFact
              icon={<Navigation size={15} />}
              label="바람"
              value={
                weather?.windSpeed != null
                  ? `${weather.windDirectionText ?? ''} ${weather.windSpeed} m/s`.trim()
                  : NO_DATA
              }
            />
            <HeroFact
              icon={<Radio size={15} />}
              label="관측소"
              value={summary?.siteCount != null ? `${summary.siteCount} 곳` : NO_DATA}
            />
          </dl>
        </div>
      </section>

      {/* 오늘의 현황 */}
      <section>
        <SectionHeading
          title="오늘의 현황"
          accent={publicColor}
          hint="인천 전역 · 출처 환경부·한국환경공단 AirKorea / 기상청"
          action={
            <Link
              to="/public-air"
              className="flex items-center gap-1 text-xs font-medium text-brand hover:underline"
            >
              예보·경보 자세히 <ArrowRight size={13} />
            </Link>
          }
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <StatTile
            accent={publicColor}
            icon={<Radio size={13} />}
            label={`공공 실측 (${publicAir?.sido ?? '인천'})`}
            value={bestStation?.pm25.value ?? NO_DATA}
            unit={bestStation ? '㎍/㎥' : undefined}
            sub={
              bestStation
                ? `${bestStation.stationName} · KHAI ${bestStation.khai.value ?? NO_DATA}`
                : '실측 데이터가 아직 없습니다'
            }
          />
          <StatTile
            accent={publicColor}
            icon={<CalendarDays size={13} />}
            label="PM2.5 예보"
            value={<ForecastRow forecast={forecast} sido={publicAir?.sido ?? '인천'} />}
            sub="측정값이 아닌 예보입니다"
          />
          <StatTile
            accent={publicColor}
            icon={<Database size={13} />}
            label="공공 데이터 수집"
            value={<CollectionStatus air={publicAir} />}
            sub={
              publicAir?.collectedAt
                ? `마지막 수집 ${new Date(publicAir.collectedAt).toLocaleTimeString('ko-KR')}`
                : '백엔드 공공 API 연결을 확인하세요'
            }
          />
        </div>

        <Card className="mt-4">
          <CardHeader
            title="시간별 평균 PM2.5"
            hint={`${regionLabel} 관측값 · 최근 24시간`}
          />
          {hourly.length === 0 ? (
            <EmptyState
              title="표시할 관측값이 없습니다"
              hint="관측 데이터가 쌓이면 시간별 평균이 여기에 그려집니다."
            />
          ) : (
            <LazyBar3DChart
              data={hourly}
              xKey="time"
              series={[{ key: 'avgPm25', name: '평균 PM2.5' }]}
              height={280}
              unit="㎍/㎥"
              fallback={
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={hourly}>
                    <defs>
                      <linearGradient id="hourlyFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={obsColor} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={obsColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="time" fontSize={11} stroke={chart.axis} tickLine={false} />
                    <YAxis fontSize={11} stroke={chart.axis} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipProps(chart)} />
                    <Area
                      type="monotone"
                      dataKey="avgPm25"
                      name="평균 PM2.5"
                      stroke={obsColor}
                      strokeWidth={2}
                      fill="url(#hourlyFill)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              }
            />
          )}
        </Card>
      </section>

      {/* AI 분석 */}
      <section>
        <SectionHeading title="AI 분석" accent={aiColor} hint={`${regionLabel} 기준 · 최근 24시간`} />
        <div className="grid gap-4 lg:grid-cols-3">
          <StatTile
            accent={aiColor}
            icon={<Target size={13} />}
            label="AI 추정 vs 공공 실측"
            value={avgError != null ? `±${avgError.toFixed(1)}` : NO_DATA}
            unit={avgError != null ? '㎍/㎥' : undefined}
            sub={
              matched.length > 0
                ? `매칭 ${matched.length}건 평균 절대오차`
                : 'AI 예측을 실행하면 비교할 수 있습니다'
            }
          />
          <StatTile
            accent={aiColor}
            icon={<Sparkles size={13} />}
            label="AI 예측 실행"
            value={summary?.recentPredictionCount ?? NO_DATA}
            unit="건"
            sub="최근 24시간"
          />
          <StatTile
            accent={idwColor}
            icon={<Database size={13} />}
            label="IDW 보간 실행"
            value={summary?.recentInterpolationCount ?? NO_DATA}
            unit="건"
            sub={district ? '최근 24시간 · 인천 전역 기준' : '최근 24시간'}
          />
        </div>

        <Card className="mt-4">
          <CardHeader title="관측값과 AI 예측값 비교" hint="실측이 기록된 최근 예측 순서대로" />
          {predictions.length === 0 ? (
            <EmptyState
              title="비교할 예측이 없습니다"
              hint="AI 예측 화면에서 예측을 실행하면 관측값과 나란히 비교됩니다."
            />
          ) : (
            <LazyBar3DChart
              data={predictions.map((p, i) => ({ ...p, idx: String(i + 1) }))}
              xKey="idx"
              series={[
                { key: 'actualPm25', name: '관측값', color: obsColor },
                { key: 'predictedPm25', name: 'AI 예측값', color: aiColor },
              ]}
              height={300}
              unit="㎍/㎥"
              fallback={
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={predictions.map((p, i) => ({ ...p, idx: i + 1 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                    <XAxis dataKey="idx" fontSize={11} stroke={chart.axis} tickLine={false} />
                    <YAxis fontSize={11} stroke={chart.axis} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipProps(chart)} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      dataKey="actualPm25"
                      name="관측값"
                      stroke={obsColor}
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      dataKey="predictedPm25"
                      name="AI 예측값"
                      stroke={aiColor}
                      strokeWidth={2}
                      strokeDasharray="4 3"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              }
            />
          )}
        </Card>
      </section>

      {/* 데이터 축적 */}
      <section>
        <SectionHeading
          title="데이터 축적"
          accent={accountColor}
          hint={`매시간 자동 수집${accumulated != null ? ` · 누적 ${accumulated.toLocaleString()}건` : ''}`}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader title="공공 실측 PM2.5 추이" hint="인천 시간별 평균 · 최근 48시간" />
            {airHistory.length === 0 ? (
              <EmptyState
                title="누적된 실측 데이터가 없습니다"
                hint="수집이 진행되면 시간별 평균이 표시됩니다."
              />
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={airHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="time" fontSize={11} stroke={chart.axis} tickLine={false} />
                  <YAxis fontSize={11} stroke={chart.axis} tickLine={false} axisLine={false} />
                  <Tooltip {...tooltipProps(chart)} />
                  <Line
                    type="monotone"
                    dataKey="pm25"
                    name="평균 PM2.5"
                    stroke={publicColor}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card>
            <CardHeader title="AI 추정 절대오차 추이" hint="AI 추정값과 공공 실측의 차이" />
            {errorHistory.length === 0 ? (
              <EmptyState
                title="비교 이력이 없습니다"
                hint="AI 예측을 실행하면 매칭된 오차가 시간에 따라 쌓입니다."
              />
            ) : (
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={errorHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="time" fontSize={11} stroke={chart.axis} tickLine={false} />
                  <YAxis
                    fontSize={11}
                    stroke={chart.axis}
                    tickLine={false}
                    axisLine={false}
                    unit="㎍"
                  />
                  <Tooltip {...tooltipProps(chart)} />
                  <Line
                    type="monotone"
                    dataKey="error"
                    name="절대오차"
                    stroke={aiColor}
                    strokeWidth={2}
                    dot={{ r: 2.5 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}

/** 히어로 하단의 보조 사실 한 개 */
function HeroFact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-ink-faint">{icon}</span>
      <dt className="text-ink-faint">{label}</dt>
      <dd className="num font-medium text-ink">{value}</dd>
    </div>
  )
}

/** 오늘·내일·모레 예보 등급 */
function ForecastRow({
  forecast,
  sido,
}: {
  forecast: AirForecastEnvelope | null
  sido: string
}) {
  const days = ['오늘', '내일', '모레']
  if (!forecast || forecast.forecasts.length === 0) return <span>{NO_DATA}</span>
  return (
    <span className="flex flex-wrap items-center gap-2">
      {forecast.forecasts.slice(0, 3).map((f, i) => (
        <span key={i} className="flex items-center gap-1">
          <span className="text-xs font-normal text-ink-faint">{days[i]}</span>
          <GradeBadge
            grade={f.grades.find((g) => g.region.includes(sido))?.grade ?? null}
            size="sm"
          />
        </span>
      ))}
    </span>
  )
}

/** 공공 API 수집 상태 */
function CollectionStatus({ air }: { air: CurrentAirQuality | null }) {
  if (!air) return <span className="text-base text-ink-faint">연결 안 됨</span>
  if (air.mock) return <span className="text-base text-amber-600 dark:text-amber-400">샘플 데이터</span>
  if (air.stale) return <span className="text-base text-orange-600 dark:text-orange-400">지연됨</span>
  return <span className="text-base text-emerald-600 dark:text-emerald-400">정상</span>
}
