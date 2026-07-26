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
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, ModelMetrics, PredictionAccuracy } from '../api/client'

const DEFAULT_MODEL = 'resnet18_multimodal_v1'

/** 산점도 모델별 색상 (등급색과 무관한 구분용 팔레트) */
const MODEL_COLORS = ['#3b82f6', '#f97316', '#22c55e', '#8b5cf6', '#ec4899', '#14b8a6']

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{hint}</p>
    </div>
  )
}

/** AI 테스트 세트 지표 (기존 화면) — AI 서비스 프록시라 백엔드 리포트와 독립적으로 로드 */
function TestSetMetrics() {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<ApiResponse<ModelMetrics>>(`/predictions/models/${DEFAULT_MODEL}/metrics`)
      .then((res) => setMetrics(res.data.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>
  if (!metrics) return <p className="text-gray-500">불러오는 중...</p>

  const total = metrics.confusion_matrix.flat().reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">모델: {DEFAULT_MODEL} (테스트 세트 기준)</p>
        <p className="mt-1 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
          ⚠ 현재 지표는 합성 샘플 데이터로 학습한 파이프라인 검증용 결과입니다. 실측 데이터
          성능이 아닙니다.
        </p>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-gray-900">회귀 성능 (PM2.5 연속값)</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="MAE" value={metrics.mae.toFixed(2)} hint="평균 절대 오차 (㎍/㎥)" />
          <MetricCard label="RMSE" value={metrics.rmse.toFixed(2)} hint="평균 제곱근 오차 (㎍/㎥)" />
          <MetricCard label="MAPE" value={`${metrics.mape.toFixed(1)}%`} hint="평균 절대 백분율 오차" />
          <MetricCard label="R²" value={metrics.r2.toFixed(3)} hint="결정계수 (1에 가까울수록 좋음)" />
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-gray-900">등급 분류 성능 (4등급)</h3>
        <div className="grid gap-4 lg:grid-cols-3">
          <MetricCard
            label="등급 정확도"
            value={`${(metrics.grade_accuracy * 100).toFixed(1)}%`}
            hint={`테스트 ${total}건 기준`}
          />
          <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm lg:col-span-2">
            <p className="mb-2 text-sm text-gray-500">혼동행렬 (행: 실제, 열: 예측)</p>
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-1" />
                  {metrics.labels.map((l) => (
                    <th key={l} className="px-3 py-1 font-medium text-gray-600">{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {metrics.confusion_matrix.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1 font-medium text-gray-600">{metrics.labels[i]}</td>
                    {row.map((v, j) => (
                      <td
                        key={j}
                        className={`px-3 py-1 text-center ${
                          i === j && v > 0
                            ? 'bg-green-50 font-semibold text-green-700'
                            : v > 0
                              ? 'bg-red-50 text-red-700'
                              : 'text-gray-400'
                        }`}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 실측 대비 정확도 리포트 (저장된 예측의 actual_pm25 기준, 모델 비교) */
function AccuracyReport() {
  const [accuracy, setAccuracy] = useState<PredictionAccuracy | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<ApiResponse<PredictionAccuracy>>('/predictions/accuracy')
      .then((res) => setAccuracy(res.data.data))
      .catch((err) => setError(errorMessage(err)))
  }, [])

  if (error) return <p className="rounded-md bg-red-50 px-4 py-3 text-red-700">{error}</p>
  if (!accuracy) return <p className="text-gray-500">불러오는 중...</p>
  if (accuracy.totalWithActual === 0) {
    return (
      <p className="rounded-md bg-gray-50 px-4 py-3 text-sm text-gray-600">
        실측값이 기록된 예측이 아직 없습니다. 예측 실행 시 해당 관측소에 최신 관측값이
        있으면 실측값(actual_pm25)이 자동으로 함께 기록됩니다.
      </p>
    )
  }

  const maxValue = Math.max(
    ...accuracy.models.flatMap((m) => m.points.flatMap((p) => [p.predictedPm25, p.actualPm25])),
    10)
  const axisMax = Math.ceil(maxValue * 1.1)
  const pointsShown = accuracy.models.reduce((a, m) => a + m.points.length, 0)

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2">모델</th>
              <th className="px-4 py-2 text-right">건수</th>
              <th className="px-4 py-2 text-right">MAE</th>
              <th className="px-4 py-2 text-right">RMSE</th>
              <th className="px-4 py-2 text-right">평균 오차</th>
              <th className="px-4 py-2 text-right">등급 일치율</th>
            </tr>
          </thead>
          <tbody>
            {accuracy.models.map((m, i) => (
              <tr key={m.modelName} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-900">
                  <span
                    className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: MODEL_COLORS[i % MODEL_COLORS.length] }}
                  />
                  {m.modelName}
                </td>
                <td className="px-4 py-2 text-right">{m.count}</td>
                <td className="px-4 py-2 text-right">{m.mae.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">{m.rmse.toFixed(2)}</td>
                <td className="px-4 py-2 text-right">
                  {m.meanError >= 0 ? '+' : ''}{m.meanError.toFixed(2)}
                </td>
                <td className="px-4 py-2 text-right">{(m.gradeAccuracy * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-400">
          MAE·RMSE·평균 오차 단위 ㎍/㎥ · 평균 오차가 양수면 과대예측 경향 ·
          실측값은 예측 실행 시점의 관측소 최신 관측값(간이 대조)
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm text-gray-500">
          예측 vs 실측 산점도 — 대각선(y=x)에 가까울수록 정확
          {pointsShown < accuracy.totalWithActual &&
            ` (최신 ${pointsShown}건 표시 / 전체 ${accuracy.totalWithActual}건 집계)`}
        </p>
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="actualPm25"
              name="실측 PM2.5"
              domain={[0, axisMax]}
              label={{ value: '실측 PM2.5 (㎍/㎥)', position: 'insideBottom', offset: -5, fontSize: 12 }}
            />
            <YAxis
              type="number"
              dataKey="predictedPm25"
              name="예측 PM2.5"
              domain={[0, axisMax]}
              label={{ value: '예측 (㎍/㎥)', angle: -90, position: 'insideLeft', fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => (typeof value === 'number' ? value.toFixed(1) : value)}
              labelFormatter={() => ''}
            />
            <Legend />
            <ReferenceLine
              segment={[{ x: 0, y: 0 }, { x: axisMax, y: axisMax }]}
              stroke="#9ca3af"
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
      </div>
    </div>
  )
}

/** 모델 성능: AI 테스트 세트 지표 + 저장된 예측의 실측 대비 정확도 리포트 */
export default function MetricsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">모델 성능</h2>
      </div>
      <TestSetMetrics />
      <div>
        <h3 className="mb-1 font-semibold text-gray-900">실측 대비 정확도 (저장된 예측 기준)</h3>
        <p className="mb-3 text-xs text-gray-500">
          예측 실행 시 함께 기록된 실측값과 비교한 모델별 정확도입니다. 위의 테스트 세트
          지표와 달리 실제 저장된 예측 이력을 집계합니다.
        </p>
        <AccuracyReport />
      </div>
    </div>
  )
}
