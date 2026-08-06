import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowUp, Database, Radio, Trash2 } from 'lucide-react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, Observation, PageResponse, Site } from '../api/client'
import { gradeOf } from '../config/grades'
import { summarizeObservations } from '../utils/obsStats'
import { useAuthStore } from '../store/auth'
import {
  Button,
  Card,
  EmptyState,
  GradeBadge,
  Notice,
  PageHero,
  SectionHeading,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  selectClass,
  tooltipProps,
  useChartTheme,
  useKindColor,
} from '../components/ui'

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
  const chart = useChartTheme()
  const accent = useKindColor('observation')

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
    () =>
      [...sample]
        .filter((o) => o.pm25 != null)
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
        .map((o) => ({
          time: new Date(o.observedAt).toLocaleString('ko-KR', {
            month: 'numeric',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          pm25: o.pm25,
          site: o.siteName,
        })),
    [sample],
  )
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

  const avgGrade = summary ? gradeOf(summary.avgPm25) : null
  const siteLabel = siteId ? (sites.find((s) => String(s.id) === siteId)?.name ?? '선택 관측소') : '전체 관측소'
  const periodLabel = from || to ? `${from || '처음'} ~ ${to || '지금'}` : '전체 기간'

  return (
    <div className="space-y-6">
      <PageHero
        accent={accent}
        eyebrow={`자체 관측 · ${siteLabel}`}
        value={summary ? summary.avgPm25.toFixed(1) : '—'}
        unit={summary ? '㎍/㎥' : undefined}
        valueColor={avgGrade?.chart}
        badge={avgGrade && <GradeBadge grade={avgGrade.name} />}
        description={
          summary
            ? `조회 조건에 맞는 관측값 ${summary.pm25Count.toLocaleString()}건의 평균입니다.`
            : '조회 조건에 맞는 관측값이 없습니다. 기간이나 관측소를 넓혀 보세요.'
        }
        facts={[
          {
            icon: <Database size={15} />,
            label: '조회 건수',
            value: data ? `${data.totalElements.toLocaleString()}건` : '—',
          },
          {
            icon: <ArrowUp size={15} />,
            label: '최고',
            value: summary ? `${summary.maxPm25.toFixed(1)} ㎍/㎥` : '—',
          },
          {
            icon: <Radio size={15} />,
            label: '최고 지점',
            value: summary ? summary.maxSite : '—',
          },
          { label: '기간', value: periodLabel },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={siteId}
              onChange={(e) => {
                setSiteId(e.target.value)
                setPage(0)
              }}
              className={`${selectClass} py-1.5`}
              aria-label="관측소"
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
              className={`${selectClass} py-1.5`}
              aria-label="시작일"
            />
            <span className="text-ink-faint">~</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setPage(0)
              }}
              className={`${selectClass} py-1.5`}
              aria-label="종료일"
            />
            {(siteId || from || to) && (
              <Button size="sm" onClick={resetFilters}>
                필터 초기화
              </Button>
            )}
          </div>
        }
        aside={
          summary && (
            <div>
              <p className="mb-1.5 text-right text-[0.6875rem] text-ink-faint">등급 분포</p>
              <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-muted">
                {summary.dist
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <div
                      key={d.name}
                      style={{ width: `${d.ratio * 100}%`, backgroundColor: d.color }}
                      title={`${d.name} ${d.count}건`}
                    />
                  ))}
              </div>
              <div className="mt-2 flex flex-wrap justify-end gap-x-3 gap-y-1 text-[0.6875rem] text-ink-muted">
                {summary.dist
                  .filter((d) => d.count > 0)
                  .map((d) => (
                    <span key={d.name} className="flex items-center gap-1">
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.name} <span className="num">{(d.ratio * 100).toFixed(0)}%</span>
                    </span>
                  ))}
              </div>
            </div>
          )
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      <section>
        <SectionHeading
          title="PM2.5 추이"
          accent={accent}
          hint={
            sampleTruncated ? `조건에 맞는 최근 ${SAMPLE_SIZE}건 기준` : '조회 조건의 관측값 전체'
          }
        />
        <Card>
          {chartData.length === 0 ? (
            <EmptyState
              title="그릴 관측값이 없습니다"
              hint="조건을 넓히거나 데이터 등록 화면에서 관측값을 추가해 보세요."
            />
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="obsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10 }}
                  stroke={chart.axis}
                  minTickGap={40}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  stroke={chart.axis}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  {...tooltipProps(chart)}
                  formatter={(value) => [`${value} ㎍/㎥`, 'PM2.5']}
                  labelFormatter={(label, payload) =>
                    `${label}${payload?.[0]?.payload.site ? ` · ${payload[0].payload.site}` : ''}`
                  }
                />
                <Area
                  type="monotone"
                  dataKey="pm25"
                  stroke={accent}
                  strokeWidth={2}
                  fill="url(#obsFill)"
                  dot={chartData.length <= 60}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </section>

      <section>
        <SectionHeading
          title="관측 기록"
          accent={accent}
          hint={data ? `${data.totalElements.toLocaleString()}건 중 15건씩` : undefined}
        />
        <TableWrap>
          <Thead>
            <tr>
              <Th>관측소</Th>
              <Th>관측 시각</Th>
              <Th className="min-w-40">PM2.5</Th>
              <Th>등급</Th>
              <Th>PM10</Th>
              <Th>기온</Th>
              <Th>습도</Th>
              <Th>풍속</Th>
              {isAdmin && <Th />}
            </tr>
          </Thead>
          <Tbody>
            {data?.content.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 9 : 8}>
                  <EmptyState
                    title="조건에 맞는 관측값이 없습니다"
                    hint="기간이나 관측소 조건을 넓혀 보세요."
                  />
                </td>
              </tr>
            )}
            {data?.content.map((o) => {
              const grade = o.pm25 != null ? gradeOf(o.pm25) : null
              return (
                <Tr key={o.id}>
                  <Td className="font-medium">{o.siteName}</Td>
                  <Td className="num text-ink-muted">
                    {new Date(o.observedAt).toLocaleString('ko-KR')}
                  </Td>
                  <Td>
                    {o.pm25 != null && grade ? (
                      <span className="flex items-center gap-2">
                        <span className="num w-10 text-right font-medium">{o.pm25}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (o.pm25 / BAR_SCALE) * 100)}%`,
                              backgroundColor: grade.chart,
                            }}
                          />
                        </span>
                      </span>
                    ) : (
                      '-'
                    )}
                  </Td>
                  <Td>{grade && <GradeBadge grade={grade.name} size="sm" />}</Td>
                  <Td className="num">{o.pm10 ?? '-'}</Td>
                  <Td className="num">{o.temperature ?? '-'}℃</Td>
                  <Td className="num">{o.humidity ?? '-'}%</Td>
                  <Td className="num">{o.windSpeed ?? '-'}m/s</Td>
                  {isAdmin && (
                    <Td className="text-right">
                      <button
                        onClick={() => remove(o.id)}
                        aria-label={`${o.siteName} 관측값 삭제`}
                        className="rounded-control p-1.5 text-ink-faint transition-colors hover:bg-surface-muted hover:text-red-600"
                      >
                        <Trash2 size={15} />
                      </button>
                    </Td>
                  )}
                </Tr>
              )
            })}
          </Tbody>
        </TableWrap>

        {data && data.totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
            <span className="num">
              {page + 1} / {Math.max(data.totalPages, 1)} 페이지
            </span>
            <div className="flex gap-2">
              <Button size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                이전
              </Button>
              <Button
                size="sm"
                disabled={page + 1 >= data.totalPages}
                onClick={() => setPage(page + 1)}
              >
                다음
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
