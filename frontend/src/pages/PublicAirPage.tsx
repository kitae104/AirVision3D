import { useEffect, useMemo, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type {
  AirAlert, AirForecastEnvelope, ApiResponse, ComparisonResult, CurrentAirQuality,
  OdorResponse, WeeklyForecast,
} from '../api/client'
import { PUBLIC_GRADE_COLORS, PUBLIC_POLLUTANTS, publicGradeOf } from '../config/publicGrades'
import type { PublicPollutantKey } from '../config/publicGrades'
import { SIDO_CENTERS } from '../config/sido'
import { parseWeeklyMatrix } from '../utils/weeklyMatrix'
import { odorGradeOf } from '../config/odorGrades'
import { Clock, Radio, TrendingUp } from 'lucide-react'
import {
  GradeBadge,
  Notice,
  PageHero,
  Skeleton,
  selectClass,
  useKindColor,
} from '../components/ui'

/** 카드 안 제목 — 왼쪽 막대 색으로 어떤 종류의 데이터인지 알린다 */
function SectionTitle({ accent, children }: { accent: string; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[0.9375rem] font-semibold text-ink">
      <span
        aria-hidden
        className="h-3.5 w-1 shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
      />
      {children}
    </h3>
  )
}

const INFORM_CODES = [
  { code: 'PM25', label: '초미세먼지 PM2.5' },
  { code: 'PM10', label: '미세먼지 PM10' },
  { code: 'O3', label: '오존 O₃' },
]

const ITEM_LABELS: Record<string, string> = {
  PM10: '미세먼지',
  PM25: '초미세먼지',
  O3: '오존',
}

function dayLabel(dateStr: string | null, index: number): string {
  const fallback = ['오늘', '내일', '모레'][index] ?? ''
  if (!dateStr) return fallback
  const today = new Date()
  const target = new Date(dateStr + 'T00:00:00')
  const diff = Math.round(
    (target.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime())
      / 86_400_000)
  if (diff === 0) return '오늘'
  if (diff === 1) return '내일'
  if (diff === 2) return '모레'
  return dateStr
}

function GradeChip({ grade }: { grade: string }) {
  const color = PUBLIC_GRADE_COLORS[grade]
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={color
        ? { backgroundColor: `${color}22`, color }
        : { backgroundColor: '#f3f4f6', color: '#4b5563' }}
    >
      {grade}
    </span>
  )
}

/** 공공 대기질 페이지: 예보·주간예보·경보·AI 비교 (모두 명확한 출처 구분) */
export default function PublicAirPage() {
  const [informCode, setInformCode] = useState('PM25')
  const [forecast, setForecast] = useState<AirForecastEnvelope | null>(null)
  const [weekly, setWeekly] = useState<WeeklyForecast | null>(null)
  const [alerts, setAlerts] = useState<AirAlert[]>([])
  const [comparison, setComparison] = useState<ComparisonResult | null>(null)
  const [odor, setOdor] = useState<OdorResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // 실시간 측정 현황 (신설 섹션)
  const [sido, setSido] = useState('인천')
  const [pollutant, setPollutant] = useState<PublicPollutantKey>('pm25')
  const [current, setCurrent] = useState<CurrentAirQuality | null>(null)
  const [currentError, setCurrentError] = useState<string | null>(null)
  // 경보·악취 클라이언트 필터
  const [alertItem, setAlertItem] = useState('')
  const [alertStatus, setAlertStatus] = useState('')
  const [odorOffice, setOdorOffice] = useState('')
  const publicAccent = useKindColor('publicAir')
  const odorAccent = useKindColor('odor')
  const predictionAccent = useKindColor('prediction')

  useEffect(() => {
    setCurrentError(null)
    apiClient
      .get<ApiResponse<CurrentAirQuality>>(`/air-quality/current?sido=${encodeURIComponent(sido)}`)
      .then((res) => setCurrent(res.data.data))
      .catch((err) => {
        setCurrent(null)
        setCurrentError(errorMessage(err))
      })
  }, [sido])

  /** 측정소별 선택 오염물질 값 (높은 순), 측정 불가 수, 등급 분포 */
  const stationView = useMemo(() => {
    if (!current) return null
    const rows: { name: string; value: number; grade: string }[] = []
    let invalid = 0
    for (const s of current.stations) {
      const v = s[pollutant]
      if (v.valid && v.value != null) {
        rows.push({
          name: s.stationName,
          value: v.value,
          grade: v.grade ?? publicGradeOf(pollutant, v.value),
        })
      } else {
        invalid++
      }
    }
    rows.sort((a, b) => b.value - a.value)
    const gradeCounts = new Map<string, number>()
    for (const r of rows) gradeCounts.set(r.grade, (gradeCounts.get(r.grade) ?? 0) + 1)
    return { rows, invalid, gradeCounts, maxValue: Math.max(...rows.map((r) => r.value), 1) }
  }, [current, pollutant])

  const weeklyMatrix = useMemo(
    () => (weekly ? parseWeeklyMatrix(weekly.days) : null), [weekly])

  const filteredAlerts = useMemo(() => alerts
    .filter((a) => !alertItem || a.itemCode === alertItem)
    .filter((a) => !alertStatus || (alertStatus === 'active' ? a.active : !a.active))
    .sort((a, b) => Number(b.active) - Number(a.active)
      || (b.issuedAt ?? '').localeCompare(a.issuedAt ?? '')), [alerts, alertItem, alertStatus])

  const odorOffices = useMemo(
    () => [...new Set((odor?.spots ?? []).map((s) => s.office))], [odor])
  const filteredOdorSpots = useMemo(
    () => (odor?.spots ?? []).filter((s) => !odorOffice || s.office === odorOffice),
    [odor, odorOffice])
  const odorTop = useMemo(() => [...filteredOdorSpots]
    .filter((s) => s.latestDilution != null)
    .sort((a, b) => (b.latestDilution as number) - (a.latestDilution as number))
    .slice(0, 10), [filteredOdorSpots])

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiClient.get<ApiResponse<AirForecastEnvelope>>(
        `/air-quality/forecast?informCode=${informCode}`),
      apiClient.get<ApiResponse<WeeklyForecast>>('/air-quality/forecast/weekly'),
      apiClient.get<ApiResponse<AirAlert[]>>('/air-quality/alerts'),
      apiClient.get<ApiResponse<ComparisonResult>>('/air-quality/comparison/latest')
        .catch(() => null),
      apiClient.get<ApiResponse<OdorResponse>>('/odor/measurements')
        .catch(() => null),
    ])
      .then(([forecastRes, weeklyRes, alertsRes, comparisonRes, odorRes]) => {
        setForecast(forecastRes.data.data)
        setWeekly(weeklyRes.data.data)
        setAlerts(alertsRes.data.data)
        setComparison(comparisonRes?.data.data ?? null)
        setOdor(odorRes?.data.data ?? null)
      })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }, [informCode])

  if (loading) return <Skeleton className="h-64" />

  const pollutantCfg = PUBLIC_POLLUTANTS.find((p) => p.key === pollutant)!
  const avgValue =
    stationView && stationView.rows.length > 0
      ? stationView.rows.reduce((a, r) => a + r.value, 0) / stationView.rows.length
      : null
  const avgGrade = avgValue != null ? publicGradeOf(pollutant, avgValue) : null
  const collectionState = !current
    ? '연결 안 됨'
    : current.mock
      ? '샘플 데이터'
      : current.stale
        ? '지연됨'
        : '정상'

  return (
    <div className="space-y-6">
      <PageHero
        accent={publicAccent}
        eyebrow={`공공 대기질 · ${sido} ${pollutantCfg.label}`}
        value={avgValue != null ? avgValue.toFixed(1) : '—'}
        unit={avgValue != null ? pollutantCfg.unit || undefined : undefined}
        valueColor={avgGrade ? PUBLIC_GRADE_COLORS[avgGrade] : undefined}
        badge={avgGrade && <GradeBadge grade={avgGrade} />}
        description={
          avgValue != null
            ? `${sido} 측정소 ${stationView?.rows.length ?? 0}곳의 평균입니다. 출처는 환경부·한국환경공단 AirKorea입니다.`
            : '유효한 측정값이 없습니다. 지역이나 항목을 바꿔 보세요.'
        }
        facts={[
          {
            icon: <Radio size={15} />,
            label: '측정소',
            value: current
              ? `${current.stations.length}곳 (유효 ${stationView?.rows.length ?? 0})`
              : '—',
          },
          {
            icon: <TrendingUp size={15} />,
            label: '최고 지점',
            value: stationView && stationView.rows.length > 0 ? stationView.rows[0].name : '—',
          },
          {
            icon: <Clock size={15} />,
            label: '수집',
            value: current?.collectedAt
              ? new Date(current.collectedAt).toLocaleString('ko-KR')
              : '—',
          },
          { label: '상태', value: collectionState },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={sido}
              onChange={(e) => setSido(e.target.value)}
              className={`${selectClass} py-1.5`}
              aria-label="시도"
            >
              {SIDO_CENTERS.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={pollutant}
              onChange={(e) => setPollutant(e.target.value as PublicPollutantKey)}
              className={`${selectClass} py-1.5`}
              aria-label="측정 항목"
            >
              {PUBLIC_POLLUTANTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      {/* 실시간 측정 현황: 측정소별 농도 바 (한눈 비교) */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle accent={publicAccent}>실시간 측정 현황</SectionTitle>
          <span className="text-xs text-ink-faint">
            지역·항목은 위 요약에서 고릅니다 · 농도 높은 순
          </span>
          {current?.mock && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Mock 데이터
            </span>
          )}
          {current?.stale && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-500/15 dark:text-orange-300">
              외부 API 연결 문제로 마지막 정상 데이터를 표시합니다
            </span>
          )}
        </div>

        {currentError && (
          <div className="mt-3"><Notice tone="error">{currentError}</Notice></div>
        )}
        {stationView && stationView.rows.length === 0 && !currentError && (
          <p className="py-6 text-center text-sm text-ink-faint">표시할 유효 측정값이 없습니다</p>
        )}
        {stationView && stationView.rows.length > 0 && (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              {[...stationView.gradeCounts.entries()].map(([grade, count]) => (
                <span key={grade} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: PUBLIC_GRADE_COLORS[grade] ?? '#9ca3af' }}
                  />
                  {grade} {count}곳
                </span>
              ))}
              {stationView.invalid > 0 && (
                <span className="text-ink-faint">측정 불가 {stationView.invalid}곳</span>
              )}
              <span className="text-ink-faint">· 농도 높은 순</span>
            </div>
            <div className="mt-2 max-h-96 space-y-1 overflow-y-auto pr-1">
              {stationView.rows.map((r) => {
                const color = PUBLIC_GRADE_COLORS[r.grade] ?? '#9ca3af'
                return (
                  <div key={r.name} className="flex items-center gap-2 text-sm">
                    <span className="w-24 shrink-0 truncate text-ink" title={r.name}>
                      {r.name}
                    </span>
                    <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${(r.value / stationView.maxValue) * 100}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right font-medium num">
                      {r.value}
                    </span>
                    <span
                      className="w-14 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-medium"
                      style={{ backgroundColor: `${color}22`, color }}
                    >
                      {r.grade}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-ink-faint">
              단위 {PUBLIC_POLLUTANTS.find((p) => p.key === pollutant)?.unit || '지수'} ·
              같은 데이터가 3D 지도의 "공공 실측(AirKorea)" 레이어에도 표시됩니다.
            </p>
          </>
        )}
      </section>

      {/* 대기질 예보 (현재 측정·AI 추정과 구분되는 "대기질 예보") */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle accent={publicAccent}>대기질 예보</SectionTitle>
          <select
            value={informCode}
            onChange={(e) => setInformCode(e.target.value)}
            className={selectClass}
          >
            {INFORM_CODES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          {forecast?.lastUpdatedAt && (
            <span className="text-xs text-ink-faint">
              수집 {new Date(forecast.lastUpdatedAt).toLocaleString('ko-KR')}
            </span>
          )}
          {forecast?.stale && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-500/15 dark:text-orange-300">
              외부 API 연결 문제로 마지막 정상 데이터를 표시합니다
            </span>
          )}
        </div>

        {forecast && forecast.forecasts.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-faint">예보 데이터가 없습니다</p>
        )}
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {forecast?.forecasts.map((f, i) => (
            <div key={i} className="rounded-control border border-line p-3.5">
              <div className="flex items-center justify-between">
                <p className="text-[0.9375rem] font-semibold text-ink">{dayLabel(f.forecastDate, i)}</p>
                <p className="text-xs text-ink-faint">{f.forecastDate}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.grades.map((g) => (
                  <span key={g.region} className="flex items-center gap-1 text-xs text-ink-muted">
                    {g.region} <GradeChip grade={g.grade} />
                  </span>
                ))}
              </div>
              {f.overall && <p className="mt-2 text-xs text-ink-muted">{f.overall}</p>}
              {i === 0 && f.cause && (
                <p className="mt-1 text-xs text-ink-faint">원인: {f.cause}</p>
              )}
              {i === 0 && f.actionKnack && (
                <p className="mt-1 rounded-control bg-brand-soft px-2 py-1 text-xs text-brand-ink">
                  행동요령: {f.actionKnack}
                </p>
              )}
              {f.announcedAt && (
                <p className="mt-1 text-right text-[0.6875rem] text-ink-faint">
                  발표 {new Date(f.announcedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 초미세먼지 주간예보 */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-center gap-3">
          <SectionTitle accent={publicAccent}>초미세먼지 주간예보</SectionTitle>
          {weekly?.announcedAt && (
            <span className="text-xs text-ink-faint">
              발표 {new Date(weekly.announcedAt).toLocaleString('ko-KR')}
            </span>
          )}
        </div>
        {!weeklyMatrix || weeklyMatrix.regions.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-faint">주간예보 데이터가 없습니다</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-muted text-left text-xs font-medium text-ink-muted">
                  <th className="px-3 py-2">권역</th>
                  {weeklyMatrix.dates.map((d) => (
                    <th key={d} className="px-3 py-2 text-center font-medium">
                      {d.length >= 10 ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {weeklyMatrix.regions.map((region) => (
                  <tr key={region} className="border-t border-line">
                    <td className="px-3 py-1.5 font-medium text-ink">{region}</td>
                    {weeklyMatrix.dates.map((d) => {
                      const grade = weeklyMatrix.grades[region][d]
                      return (
                        <td key={d} className="px-1.5 py-1.5 text-center">
                          {grade ? (
                            <span className={`block rounded px-1 py-1 text-xs font-medium ${
                              grade === '높음' ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300'
                                : grade === '낮음' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
                                  : 'bg-surface-muted text-ink-muted'}`}>
                              {grade}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-faint">-</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-faint">
              권역별 초미세먼지 발생 가능성: <span className="text-orange-600 dark:text-orange-400">높음</span> /
              <span className="text-blue-600 dark:text-blue-400"> 낮음</span>
            </p>
          </div>
        )}
      </section>

      {/* 경보 현황 */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle accent={publicAccent}>대기오염 경보 (올해)</SectionTitle>
          <select
            value={alertItem}
            onChange={(e) => setAlertItem(e.target.value)}
            className={selectClass}
          >
            <option value="">전체 항목</option>
            <option value="PM10">미세먼지</option>
            <option value="PM25">초미세먼지</option>
            <option value="O3">오존</option>
          </select>
          <select
            value={alertStatus}
            onChange={(e) => setAlertStatus(e.target.value)}
            className={selectClass}
          >
            <option value="">전체 상태</option>
            <option value="active">발령 중</option>
            <option value="cleared">해제됨</option>
          </select>
          {alerts.length > 0 && (
            <span className="text-xs text-ink-muted">
              {filteredAlerts.length}건
              {alertItem === '' && alertStatus === '' &&
                ` (발령 중 ${alerts.filter((a) => a.active).length}건)`}
            </span>
          )}
        </div>
        {alerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            현재 발령 중인 대기오염 경보가 없습니다.
          </p>
        ) : filteredAlerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-faint">
            선택한 조건에 해당하는 경보가 없습니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs font-medium text-ink-muted">
                <tr>
                  <th className="px-3 py-2">지역</th>
                  <th className="px-3 py-2">권역</th>
                  <th className="px-3 py-2">항목</th>
                  <th className="px-3 py-2">단계</th>
                  <th className="px-3 py-2">발령</th>
                  <th className="px-3 py-2">해제</th>
                  <th className="px-3 py-2">상태</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((a, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2">{a.districtName}</td>
                    <td className="px-3 py-2">{a.moveName}</td>
                    <td className="px-3 py-2">{ITEM_LABELS[a.itemCode ?? ''] ?? a.itemCode}</td>
                    <td className="px-3 py-2">{a.issueLevel}</td>
                    <td className="px-3 py-2 text-xs">
                      {a.issuedAt ? new Date(a.issuedAt).toLocaleString('ko-KR') : '-'}
                      {a.issueValue != null && ` (${a.issueValue}㎍/㎥)`}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {a.clearedAt ? new Date(a.clearedAt).toLocaleString('ko-KR') : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {a.active ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-300">
                          발령 중
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-ink-muted">
                          해제됨
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 악취 측정 현황 (인천환경공단) */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle accent={odorAccent}>악취 측정 현황 (인천)</SectionTitle>
          <select
            value={odorOffice}
            onChange={(e) => setOdorOffice(e.target.value)}
            className={selectClass}
          >
            <option value="">전체 사업소</option>
            {odorOffices.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <span className="text-xs text-ink-muted">
            인천환경공단 사업소 주변 복합악취 희석배수 · 연 단위 개방 자료 (실시간 아님)
          </span>
          {odor?.mock && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              Mock 데이터
            </span>
          )}
          {odor?.stale && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-500/15 dark:text-orange-300">
              외부 API 연결 문제로 마지막 정상 데이터를 표시합니다
            </span>
          )}
        </div>
        {odor && odor.failedOffices.length > 0 && (
          <p className="mt-2 rounded-control bg-orange-50 px-3 py-1.5 text-xs text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
            일부 사업소 조회 실패: {odor.failedOffices.join(', ')}
          </p>
        )}
        {!odor || odor.spots.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-faint">악취 측정 데이터가 없습니다</p>
        ) : (
          <div className="mt-3">
            {odorTop.length > 0 && (
              <div className="mb-4 rounded-control border border-line bg-surface-muted p-3.5">
                <p className="mb-2 text-xs font-medium text-ink-muted">
                  희석배수 상위 {odorTop.length}개 지점 (최근 측정 기준)
                </p>
                <div className="space-y-1">
                  {odorTop.map((s) => {
                    const grade = odorGradeOf(s.latestDilution as number)
                    const max = odorTop[0].latestDilution as number
                    return (
                      <div key={`${s.office}-${s.spotName}`} className="flex items-center gap-2 text-sm">
                        <span
                          className="w-40 shrink-0 truncate text-ink"
                          title={`${s.spotName} (${s.office})`}
                        >
                          {s.spotName}
                        </span>
                        <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <div
                            className="h-full rounded"
                            style={{
                              width: `${((s.latestDilution as number) / max) * 100}%`,
                              backgroundColor: grade.chart,
                            }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right font-medium num">
                          {s.latestDilution}배
                        </span>
                        <span className={`w-16 shrink-0 rounded-full px-1.5 py-0.5 text-center text-[11px] font-medium ${grade.badge}`}>
                          {grade.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs font-medium text-ink-muted">
                <tr>
                  <th className="px-3 py-2">관할 사업소</th>
                  <th className="px-3 py-2">측정지점</th>
                  <th className="px-3 py-2">주소</th>
                  <th className="px-3 py-2">최근 측정일</th>
                  <th className="px-3 py-2">희석배수</th>
                  <th className="px-3 py-2">등급</th>
                  <th className="px-3 py-2">최대 / 측정 수</th>
                </tr>
              </thead>
              <tbody>
                {filteredOdorSpots.map((s, i) => {
                  const grade = s.latestDilution != null ? odorGradeOf(s.latestDilution) : null
                  return (
                    <tr key={i} className="border-t border-line">
                      <td className="px-3 py-2">{s.office}</td>
                      <td className="px-3 py-2">
                        {s.spotName}
                        {!s.locationAvailable && (
                          <span className="ml-1 text-[0.6875rem] text-ink-faint">(좌표 없음)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-ink-muted">{s.address ?? '-'}</td>
                      <td className="px-3 py-2 text-xs">{s.latestDate ?? '-'}</td>
                      <td className="px-3 py-2 font-medium">
                        {s.latestDilution != null ? `${s.latestDilution}배` : '-'}
                      </td>
                      <td className="px-3 py-2">
                        {grade ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${grade.badge}`}>
                            {grade.name}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {s.maxDilution != null ? `${s.maxDilution}배` : '-'} / {s.measurementCount}회
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-faint">
              등급 기준: 악취방지법 부지경계 배출허용기준(기타 지역 15배, 공업 지역 20배) 참고.
              좌표가 있는 지점은 3D 지도의 "악취 측정(인천)" 레이어에도 표시됩니다.
            </p>
            </div>
          </div>
        )}
      </section>

      {/* AI 추정 vs 공공 실측 비교 */}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-center gap-3">
          <SectionTitle accent={predictionAccent}>AI 추정 vs 공공 실측 (PM2.5)</SectionTitle>
          {comparison && (
            <span className="text-xs text-ink-faint">
              매칭 기준: {comparison.maxDistanceKm}km 이내 · {comparison.maxMinutes}분 이내 ·{' '}
              {comparison.sido} 측정소
            </span>
          )}
        </div>
        {!comparison || comparison.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-faint">
            비교할 AI 예측 결과가 없습니다. [AI 예측] 메뉴에서 예측을 실행하면 최근 예측과
            가장 가까운 공공 측정소 실측값을 비교합니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-xs font-medium text-ink-muted">
                <tr>
                  <th className="px-3 py-2">예측 지점</th>
                  <th className="px-3 py-2">AI 추정</th>
                  <th className="px-3 py-2">실측 (측정소)</th>
                  <th className="px-3 py-2">절대오차</th>
                  <th className="px-3 py-2">오차율</th>
                  <th className="px-3 py-2">거리</th>
                  <th className="px-3 py-2">시간차</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.siteId} className="border-t border-line">
                    <td className="px-3 py-2">
                      {row.siteName}
                      <span className="block text-[0.6875rem] text-ink-faint">
                        {new Date(row.predictedAt).toLocaleString('ko-KR')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{row.predictedPm25.toFixed(1)}</td>
                    {row.matched ? (
                      <>
                        <td className="px-3 py-2">
                          {row.measuredPm25?.toFixed(1)}
                          <span className="block text-[0.6875rem] text-ink-faint">
                            {row.stationName}
                          </span>
                        </td>
                        <td className="px-3 py-2">{row.absoluteError?.toFixed(1)}</td>
                        <td className="px-3 py-2">
                          {row.errorRatePercent != null
                            ? `${row.errorRatePercent.toFixed(1)}%` : '-'}
                        </td>
                        <td className="px-3 py-2">{row.distanceKm?.toFixed(1)}km</td>
                        <td className="px-3 py-2">{row.timeDiffMinutes}분</td>
                      </>
                    ) : (
                      <td className="px-3 py-2 text-xs text-ink-faint" colSpan={5}>
                        매칭 불가: {row.reason}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-faint">
              AI 추정값은 학습된 모델의 예측이며 공공 실측값과 성격이 다른 데이터입니다.
              오차율은 실측값이 0이거나 유효하지 않으면 계산하지 않습니다.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
