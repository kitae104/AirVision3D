import { useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type {
  AirAlert, AirForecastEnvelope, ApiResponse, ComparisonResult, OdorResponse, WeeklyForecast,
} from '../api/client'
import { PUBLIC_GRADE_COLORS } from '../config/publicGrades'
import { odorGradeOf } from '../config/odorGrades'

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

  if (loading) return <p className="text-gray-500">불러오는 중...</p>

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-xl font-bold text-gray-900">공공 대기질</h2>
        <span className="text-xs text-gray-500">
          대기질 데이터: 환경부·한국환경공단 AirKorea · 기상 데이터: 기상청
        </span>
      </div>

      {error && <p className="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

      {/* 대기질 예보 (현재 측정·AI 추정과 구분되는 "대기질 예보") */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-gray-900">대기질 예보</h3>
          <select
            value={informCode}
            onChange={(e) => setInformCode(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            {INFORM_CODES.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          {forecast?.lastUpdatedAt && (
            <span className="text-xs text-gray-400">
              수집 {new Date(forecast.lastUpdatedAt).toLocaleString('ko-KR')}
            </span>
          )}
          {forecast?.stale && (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-800">
              외부 API 연결 문제로 마지막 정상 데이터를 표시합니다
            </span>
          )}
        </div>

        {forecast && forecast.forecasts.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">예보 데이터가 없습니다</p>
        )}
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          {forecast?.forecasts.map((f, i) => (
            <div key={i} className="rounded-md border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{dayLabel(f.forecastDate, i)}</p>
                <p className="text-xs text-gray-400">{f.forecastDate}</p>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {f.grades.map((g) => (
                  <span key={g.region} className="flex items-center gap-1 text-xs text-gray-600">
                    {g.region} <GradeChip grade={g.grade} />
                  </span>
                ))}
              </div>
              {f.overall && <p className="mt-2 text-xs text-gray-600">{f.overall}</p>}
              {i === 0 && f.cause && (
                <p className="mt-1 text-xs text-gray-400">원인: {f.cause}</p>
              )}
              {i === 0 && f.actionKnack && (
                <p className="mt-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                  행동요령: {f.actionKnack}
                </p>
              )}
              {f.announcedAt && (
                <p className="mt-1 text-right text-[11px] text-gray-400">
                  발표 {new Date(f.announcedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 초미세먼지 주간예보 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">초미세먼지 주간예보</h3>
          {weekly?.announcedAt && (
            <span className="text-xs text-gray-400">
              발표 {new Date(weekly.announcedAt).toLocaleString('ko-KR')}
            </span>
          )}
        </div>
        {!weekly || weekly.days.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">주간예보 데이터가 없습니다</p>
        ) : (
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {weekly.days.map((d) => (
              <div key={d.date} className="rounded-md border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-900">{d.date}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(d.content ?? '').split(',').map((part) => {
                    const [region, grade] = part.split(':').map((s) => s.trim())
                    if (!region || !grade) return null
                    return (
                      <span key={region} className="flex items-center gap-1 text-xs text-gray-600">
                        {region}{' '}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          grade === '높음' ? 'bg-orange-100 text-orange-700'
                            : 'bg-blue-100 text-blue-700'}`}>
                          {grade}
                        </span>
                      </span>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 경보 현황 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="font-semibold text-gray-900">대기오염 경보 (올해)</h3>
        {alerts.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">
            현재 발령 중인 대기오염 경보가 없습니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
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
                {alerts.map((a, i) => (
                  <tr key={i} className="border-t border-gray-100">
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
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          발령 중
                        </span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
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
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-gray-900">악취 측정 현황 (인천)</h3>
          <span className="text-xs text-gray-500">
            인천환경공단 사업소 주변 복합악취 희석배수 · 연 단위 개방 자료 (실시간 아님)
          </span>
          {odor?.mock && (
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
              Mock 데이터
            </span>
          )}
          {odor?.stale && (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-800">
              외부 API 연결 문제로 마지막 정상 데이터를 표시합니다
            </span>
          )}
        </div>
        {odor && odor.failedOffices.length > 0 && (
          <p className="mt-2 rounded bg-orange-50 px-3 py-1.5 text-xs text-orange-700">
            일부 사업소 조회 실패: {odor.failedOffices.join(', ')}
          </p>
        )}
        {!odor || odor.spots.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">악취 측정 데이터가 없습니다</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
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
                {odor.spots.map((s, i) => {
                  const grade = s.latestDilution != null ? odorGradeOf(s.latestDilution) : null
                  return (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2">{s.office}</td>
                      <td className="px-3 py-2">
                        {s.spotName}
                        {!s.locationAvailable && (
                          <span className="ml-1 text-[11px] text-gray-400">(좌표 없음)</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{s.address ?? '-'}</td>
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
            <p className="mt-2 text-xs text-gray-400">
              등급 기준: 악취방지법 부지경계 배출허용기준(기타 지역 15배, 공업 지역 20배) 참고.
              좌표가 있는 지점은 3D 지도의 "악취 측정(인천)" 레이어에도 표시됩니다.
            </p>
          </div>
        )}
      </section>

      {/* AI 추정 vs 공공 실측 비교 */}
      <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="font-semibold text-gray-900">AI 추정 vs 공공 실측 (PM2.5)</h3>
          {comparison && (
            <span className="text-xs text-gray-400">
              매칭 기준: {comparison.maxDistanceKm}km 이내 · {comparison.maxMinutes}분 이내 ·{' '}
              {comparison.sido} 측정소
            </span>
          )}
        </div>
        {!comparison || comparison.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            비교할 AI 예측 결과가 없습니다. [AI 예측] 메뉴에서 예측을 실행하면 최근 예측과
            가장 가까운 공공 측정소 실측값을 비교합니다.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
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
                  <tr key={row.siteId} className="border-t border-gray-100">
                    <td className="px-3 py-2">
                      {row.siteName}
                      <span className="block text-[11px] text-gray-400">
                        {new Date(row.predictedAt).toLocaleString('ko-KR')}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium">{row.predictedPm25.toFixed(1)}</td>
                    {row.matched ? (
                      <>
                        <td className="px-3 py-2">
                          {row.measuredPm25?.toFixed(1)}
                          <span className="block text-[11px] text-gray-400">
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
                      <td className="px-3 py-2 text-xs text-gray-400" colSpan={5}>
                        매칭 불가: {row.reason}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-gray-400">
              AI 추정값은 학습된 모델의 예측이며 공공 실측값과 성격이 다른 데이터입니다.
              오차율은 실측값이 0이거나 유효하지 않으면 계산하지 않습니다.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
