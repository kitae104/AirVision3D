import { useEffect, useState } from 'react'
import { Clock, Grid3x3, Plus, Sigma, Trash2 } from 'lucide-react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, InterpolationResult, PageResponse } from '../api/client'
import { gradeOf } from '../config/grades'
import {
  Button,
  Card,
  CardHeader,
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
  inputClass,
  labelClass,
  useKindColor,
} from '../components/ui'

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
  const [totalRuns, setTotalRuns] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const accent = useKindColor('interpolation')

  const loadRecent = () =>
    apiClient
      .get<ApiResponse<PageResponse<InterpolationResult>>>('/interpolations?size=10')
      .then((res) => {
        setRecent(res.data.data.content)
        setTotalRuns(res.data.data.totalElements)
      })

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
      const res = await apiClient.post<ApiResponse<InterpolationResult[]>>('/interpolations/run', {
        power: Number(power),
        method,
        targets: targets.map((t) => ({
          name: t.name || null,
          latitude: Number(t.latitude),
          longitude: Number(t.longitude),
        })),
      })
      setResults(res.data.data)
      loadRecent()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  // 히어로는 방금 실행한 결과가 있으면 그 첫 지점을, 없으면 가장 최근 이력을 보여 준다
  const headline = results[0] ?? recent[0] ?? null
  const headlineGrade = headline ? gradeOf(headline.pm25) : null

  return (
    <div className="space-y-6">
      <PageHero
        accent={accent}
        eyebrow={headline ? `IDW 보간 · ${headline.targetName ?? '지정 지점'}` : 'IDW 보간'}
        value={headline ? headline.pm25.toFixed(1) : '—'}
        unit={headline ? '㎍/㎥' : undefined}
        valueColor={headlineGrade?.chart}
        badge={headlineGrade && <GradeBadge grade={headlineGrade.name} />}
        description={
          headline
            ? `${results.length > 0 ? '방금 계산한' : '가장 최근'} 보간값입니다. 주변 관측소의 최신 값을 거리에 반비례해 가중 평균했습니다.`
            : '아직 보간을 실행한 적이 없습니다. 아래에서 위치를 지정하고 실행해 보세요.'
        }
        facts={[
          {
            icon: <Grid3x3 size={15} />,
            label: '누적 실행',
            value: totalRuns != null ? `${totalRuns.toLocaleString()}건` : '—',
          },
          {
            icon: <Sigma size={15} />,
            label: '알고리즘',
            value: headline ? `${headline.algorithm} · p=${headline.power}` : '—',
          },
          {
            icon: <Clock size={15} />,
            label: '기준 시각',
            value: headline ? new Date(headline.interpolatedAt).toLocaleString('ko-KR') : '—',
          },
        ]}
      />

      <SectionHeading title="보간 실행" accent={accent} hint="위치를 지정하고 거리 역가중 평균으로 추정" />
      <Card>
        <CardHeader
          title="입력"
          hint="관측소별 최신 PM2.5를 기준으로, 관측소가 없는 지점의 값을 추정합니다"
        />
        <form onSubmit={submit} className="space-y-5">
          <div className="flex flex-wrap gap-4">
            <div className="w-48">
              <label className={labelClass}>거리 가중치 지수 p (0.1~10)</label>
              <input
                type="number"
                step="0.1"
                min={0.1}
                max={10}
                value={power}
                onChange={(e) => setPower(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="w-64">
              <label className={labelClass}>보간 방법</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as 'IDW' | 'MODIFIED_IDW')}
                className={inputClass}
              >
                <option value="IDW">일반 IDW</option>
                <option value="MODIFIED_IDW">Modified IDW (보정 가중치)</option>
              </select>
              <p className="mt-1.5 text-xs text-ink-faint">
                Modified IDW는 관측지점별 1차 보간 오차로 가중치를 보정합니다.
              </p>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className={labelClass + ' mb-0'}>보간 대상 위치</span>
              <Button
                type="button"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setTargets([...targets, { name: '', latitude: '', longitude: '' }])}
              >
                위치 추가
              </Button>
            </div>
            <div className="space-y-2">
              {targets.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    placeholder="이름 (선택)"
                    value={t.name}
                    onChange={(e) => updateRow(i, { name: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    required
                    placeholder="위도"
                    type="number"
                    step="any"
                    min={-90}
                    max={90}
                    value={t.latitude}
                    onChange={(e) => updateRow(i, { latitude: e.target.value })}
                    className={inputClass}
                  />
                  <input
                    required
                    placeholder="경도"
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={t.longitude}
                    onChange={(e) => updateRow(i, { longitude: e.target.value })}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    disabled={targets.length === 1}
                    onClick={() => setTargets(targets.filter((_, idx) => idx !== i))}
                    aria-label={`${i + 1}번 위치 삭제`}
                    className="shrink-0 rounded-control p-2 text-ink-faint transition-colors hover:bg-surface-muted hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-faint"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {error && <Notice tone="error">{error}</Notice>}
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? '보간 중...' : '보간 실행'}
          </Button>
        </form>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader title="이번 실행 결과" hint={`대상 ${results.length}곳`} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => {
              const grade = gradeOf(r.pm25)
              return (
                <div key={r.id} className="rounded-control border border-line p-3.5">
                  <p className="text-sm font-medium text-ink">{r.targetName ?? `지점 ${r.id}`}</p>
                  <p className="num mt-1 text-2xl font-semibold" style={{ color: grade.chart }}>
                    {r.pm25.toFixed(1)}
                    <span className="ml-1 text-sm font-normal text-ink-muted">㎍/㎥</span>
                  </p>
                  <div className="mt-1.5">
                    <GradeBadge grade={grade.name} size="sm" />
                  </div>
                  <p className="num mt-2 text-xs text-ink-faint">
                    ({r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}) · p={r.power}
                  </p>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      <div>
        <SectionHeading title="최근 보간 이력" accent={accent} hint="최신 10건" />
        {recent.length === 0 ? (
          <Card>
            <EmptyState
              title="보간 이력이 없습니다"
              hint="위 양식으로 보간을 실행하면 최근 10건이 여기에 쌓입니다."
            />
          </Card>
        ) : (
          <TableWrap>
            <Thead>
              <tr>
                <Th>지점</Th>
                <Th>좌표</Th>
                <Th>PM2.5</Th>
                <Th>알고리즘</Th>
                <Th>p</Th>
                <Th>기준 시각</Th>
              </tr>
            </Thead>
            <Tbody>
              {recent.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.targetName ?? '-'}</Td>
                  <Td className="num text-ink-muted">
                    {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                  </Td>
                  <Td className="num font-medium">{r.pm25.toFixed(1)}</Td>
                  <Td>{r.algorithm}</Td>
                  <Td className="num">{r.power}</Td>
                  <Td className="num text-ink-muted">
                    {new Date(r.interpolatedAt).toLocaleString('ko-KR')}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </TableWrap>
        )}
      </div>
    </div>
  )
}
