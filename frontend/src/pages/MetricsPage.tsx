import { useEffect, useState } from 'react'
import { apiClient, errorMessage } from '../api/client'
import type { ApiResponse, ModelMetrics } from '../api/client'

const DEFAULT_MODEL = 'resnet18_multimodal_v1'

function MetricCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{hint}</p>
    </div>
  )
}

/** 모델 성능 지표 (회귀 지표와 등급 분류 지표를 구분 표시) */
export default function MetricsPage() {
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
        <h2 className="text-xl font-bold text-gray-900">모델 성능</h2>
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
