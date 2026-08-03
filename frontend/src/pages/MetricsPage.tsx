import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Cpu, Gauge, Sigma, Target } from 'lucide-react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, ModelMetrics, PredictionAccuracy } from '../api/client'
import {
  Card,
  CardHeader,
  EmptyState,
  Notice,
  PageHero,
  SectionHeading,
  Skeleton,
  StatTile,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  tooltipProps,
  useChartTheme,
  useKindColor,
} from '../components/ui'
import { LazyScatter3DChart } from '../components/chart3d'
import type { Scatter3DSeries } from '../components/chart3d'

const DEFAULT_MODEL = 'resnet18_multimodal_v1'

/**
 * 산점도 모델 구분 색.
 * 대기질 등급색(파랑·초록·주황·빨강)과 섞이지 않도록 의도적으로 다른 계열을 쓴다.
 */
const MODEL_COLORS = ['#4f46e5', '#0ea5e9', '#8b5cf6', '#14b8a6', '#ec4899', '#64748b']

/** AI 테스트 세트 지표 — 로드는 상위(MetricsPage)에서 하고 여기서는 표시만 한다 */
function TestSetMetrics({
  metrics,
  error,
  accent,
}: {
  metrics: ModelMetrics | null
  error: string | null
  accent: string
}) {
  if (error) return <Notice tone="error">{error}</Notice>
  if (!metrics) return <Skeleton className="h-40" />

  const total = metrics.confusion_matrix.flat().reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-5">
      <Notice tone="warning">
        지금 지표는 합성 샘플 데이터로 학습한 파이프라인 검증 결과입니다. 실측 데이터 성능이
        아닙니다. (모델 {DEFAULT_MODEL} · 테스트 세트 기준)
      </Notice>

      <div>
        <h3 className="mb-3 text-[0.9375rem] font-semibold text-ink">
          회귀 성능 <span className="font-normal text-ink-faint">PM2.5 연속값</span>
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile accent={accent} label="MAE" value={metrics.mae.toFixed(2)} sub="평균 절대 오차 (㎍/㎥)" />
          <StatTile accent={accent} label="RMSE" value={metrics.rmse.toFixed(2)} sub="평균 제곱근 오차 (㎍/㎥)" />
          <StatTile
            accent={accent}
            label="MAPE"
            value={`${metrics.mape.toFixed(1)}%`}
            sub="평균 절대 백분율 오차"
          />
          <StatTile accent={accent} label="R²" value={metrics.r2.toFixed(3)} sub="1에 가까울수록 좋음" />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[0.9375rem] font-semibold text-ink">
          등급 분류 성능 <span className="font-normal text-ink-faint">4등급</span>
        </h3>
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <StatTile
            accent={accent}
            label="등급 정확도"
            value={`${(metrics.grade_accuracy * 100).toFixed(1)}%`}
            sub={`테스트 ${total}건 기준`}
          />
          <Card className="lg:col-span-2">
            <CardHeader title="혼동행렬" hint="행은 실제 등급, 열은 예측 등급" />
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-1" />
                  {metrics.labels.map((l) => (
                    <th key={l} className="px-3 py-1 text-xs font-medium text-ink-muted">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.confusion_matrix.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1 text-xs font-medium text-ink-muted">
                      {metrics.labels[i]}
                    </td>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className={`num px-3 py-1 text-center ${
                          i === j && v > 0
                            ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : v > 0
                              ? 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300'
                              : 'text-ink-faint'
                        }`}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  )
}

/** 실측 대비 정확도 리포트 (저장된 예측의 actual_pm25 기준, 모델 비교) */
function AccuracyReport() {
  const [accuracy, setAccuracy] = useState<PredictionAccuracy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const chart = useChartTheme()

  useEffect(() => {
    apiClient
      .get<ApiResponse<PredictionAccuracy>>('/predictions/accuracy')
      .then((res) => setAccuracy(res.data.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  if (error) return <Notice tone="error">{error}</Notice>
  if (!accuracy) return <Skeleton className="h-40" />
  if (accuracy.totalWithActual === 0) {
    return (
      <Card>
        <EmptyState
          title="실측값이 기록된 예측이 없습니다"
          hint="예측 실행 시 해당 관측소에 최신 관측값이 있으면 실측값이 자동으로 함께 기록됩니다."
        />
      </Card>
    )
  }

  const maxValue = Math.max(
    ...accuracy.models.flatMap((m) => m.points.flatMap((p) => [p.predictedPm25, p.actualPm25])),
    10,
  )
  const axisMax = Math.ceil(maxValue * 1.1)
  const pointsShown = accuracy.models.reduce((a, m) => a + m.points.length, 0)

  // Z축(시간) 정규화 — 모든 모델의 예측 시각을 한 범위에 놓아야 앞뒤 비교가 된다
  const allTimes = accuracy.models.flatMap((m) =>
    m.points.map((p) => new Date(p.predictedAt).getTime()),
  )
  const minTime = allTimes.length > 0 ? Math.min(...allTimes) : 0
  const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : 0
  const timeSpan = maxTime - minTime
  const scatterSeries: Scatter3DSeries[] = accuracy.models.map((m, i) => ({
    name: m.modelName,
    color: MODEL_COLORS[i % MODEL_COLORS.length],
    points: m.points.map((p) => ({
      x: p.actualPm25,
      y: p.predictedPm25,
      // 시각이 모두 같으면 한 면에 모아 놓는다
      z: timeSpan > 0 ? (new Date(p.predictedAt).getTime() - minTime) / timeSpan : 0.5,
      label: p.siteName,
    })),
  }))

  return (
    <div className="space-y-4">
      <div>
        <TableWrap>
          <Thead>
            <tr>
              <Th>모델</Th>
              <Th className="text-right">건수</Th>
              <Th className="text-right">MAE</Th>
              <Th className="text-right">RMSE</Th>
              <Th className="text-right">평균 오차</Th>
              <Th className="text-right">등급 일치율</Th>
            </tr>
          </Thead>
          <Tbody>
            {accuracy.models.map((m, i) => (
              <Tr key={m.modelName}>
                <Td className="font-medium">
                  <span
                    aria-hidden
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                  />
                  {m.modelName}
                </Td>
                <Td className="num text-right">{m.count}</Td>
                <Td className="num text-right">{m.mae.toFixed(2)}</Td>
                <Td className="num text-right">{m.rmse.toFixed(2)}</Td>
                <Td className="num text-right">
                  {m.meanError >= 0 ? '+' : ''}
                  {m.meanError.toFixed(2)}
                </Td>
                <Td className="num text-right">{(m.gradeAccuracy * 100).toFixed(1)}%</Td>
              </Tr>
            ))}
          </Tbody>
        </TableWrap>
        <p className="mt-2 text-xs text-ink-faint">
          MAE·RMSE·평균 오차 단위는 ㎍/㎥ · 평균 오차가 양수면 과대예측 경향 · 실측값은 예측
          실행 시점의 관측소 최신 관측값(간이 대조)입니다.
        </p>
      </div>

      <Card>
        <CardHeader
          title="예측 vs 실측 산점도"
          hint={
            <>
              기준면(y=x)에 가까울수록 정확합니다 · 안쪽에서 바깥쪽이 시간 순서입니다
              {pointsShown < accuracy.totalWithActual &&
                ` · 최신 ${pointsShown}건 표시 / 전체 ${accuracy.totalWithActual}건 집계`}
            </>
          }
        />
        <LazyScatter3DChart
          series={scatterSeries}
          axisMax={axisMax}
          height={400}
          xLabel="실측"
          yLabel="예측"
          zLabel="시간"
          fallback={
            <ResponsiveContainer width="100%" height={360}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
                <XAxis
                  type="number"
                  dataKey="actualPm25"
                  name="실측 PM2.5"
                  domain={[0, axisMax]}
                  stroke={chart.axis}
                  fontSize={11}
                  label={{
                    value: '실측 PM2.5 (㎍/㎥)',
                    position: 'insideBottom',
                    offset: -5,
                    fontSize: 12,
                    fill: chart.axis,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="predictedPm25"
                  name="예측 PM2.5"
                  domain={[0, axisMax]}
                  stroke={chart.axis}
                  fontSize={11}
                  label={{
                    value: '예측 (㎍/㎥)',
                    angle: -90,
                    position: 'insideLeft',
                    fontSize: 12,
                    fill: chart.axis,
                  }}
                />
                <Tooltip
                  {...tooltipProps(chart)}
                  formatter={(value) => (typeof value === 'number' ? value.toFixed(1) : value)}
                  labelFormatter={() => ''}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: axisMax, y: axisMax },
                  ]}
                  stroke={chart.axis}
                  strokeDasharray="4 4"
                />
                {accuracy.models.map((m, i) => (
                  <Scatter
                    key={m.modelName}
                    name={m.modelName}
                    data={m.points}
                    fill={MODEL_COLORS[i % MODEL_COLORS.length]}
                    fillOpacity={0.7}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          }
        />
      </Card>
    </div>
  )
}

/** 모델 성능: AI 테스트 세트 지표 + 저장된 예측의 실측 대비 정확도 리포트 */
export default function MetricsPage() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  // 모델 성능은 'AI 예측'과 같은 종류의 데이터이므로 같은 액센트 색을 쓴다
  const accent = useKindColor('prediction')

  useEffect(() => {
    apiClient
      .get<ApiResponse<ModelMetrics>>(`/predictions/models/${DEFAULT_MODEL}/metrics`)
      .then((res) => setMetrics(res.data.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  return (
    <div className="space-y-8">
      <PageHero
        accent={accent}
        eyebrow={`AI 예측 · ${DEFAULT_MODEL}`}
        value={metrics ? metrics.mae.toFixed(2) : '—'}
        unit={metrics ? '㎍/㎥' : undefined}
        description="테스트 세트에서 예측값이 정답과 평균적으로 얼마나 벗어났는지(MAE)입니다. 작을수록 정확합니다."
        facts={[
          {
            icon: <Sigma size={15} />,
            label: 'RMSE',
            value: metrics ? metrics.rmse.toFixed(2) : '—',
          },
          {
            icon: <Target size={15} />,
            label: '등급 정확도',
            value: metrics ? `${(metrics.grade_accuracy * 100).toFixed(1)}%` : '—',
          },
          {
            icon: <Gauge size={15} />,
            label: 'R²',
            value: metrics ? metrics.r2.toFixed(3) : '—',
          },
          { icon: <Cpu size={15} />, label: '모델', value: DEFAULT_MODEL },
        ]}
      />

      <section>
        <SectionHeading
          title="테스트 세트 지표"
          accent={accent}
          hint="학습 파이프라인이 낸 결과"
        />
        <TestSetMetrics metrics={metrics} error={error} accent={accent} />
      </section>
      <section>
        <SectionHeading
          title="실측 대비 정확도"
          accent={accent}
          hint="저장된 예측 이력을 실측값과 비교한 결과"
        />
        <AccuracyReport />
      </section>
    </div>
  )
}
