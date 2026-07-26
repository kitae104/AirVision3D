import { useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import type { ApiResponse, DistrictForecast } from '../api/client'
import { computePreAlerts } from '../utils/preAlerts'
import type { PreAlert } from '../utils/preAlerts'

/**
 * 예측 기반 사전 경보 배너 (모든 페이지 상단, 공식 경보 배너 아래).
 * 구별 이류 예측에서 "현재보다 악화되어 나쁨 이상 진입"이 예상되는 구를 안내한다.
 * 예측이 없거나 조회에 실패하면 아무것도 표시하지 않는다 (AlertBanner와 동일 정책).
 */
export default function PreAlertBanner() {
  const [alerts, setAlerts] = useState<PreAlert[]>([])
  const [mock, setMock] = useState(false)

  useEffect(() => {
    apiClient
      .get<ApiResponse<DistrictForecast>>('/air-quality/district-forecast?hours=6')
      .then((res) => {
        setMock(res.data.data.mock)
        setAlerts(computePreAlerts(res.data.data.current, res.data.data.hourly))
      })
      .catch(() => setAlerts([]))
  }, [])

  if (alerts.length === 0) return null

  return (
    <div className="mb-4 space-y-1">
      {alerts.map((alert) => (
        <div
          key={alert.district}
          className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900"
        >
          <span aria-hidden>⚠️</span>
          <span className="font-semibold">
            예측 사전 경보 · {alert.district} 약 {alert.hoursAhead}시간 후
            &lsquo;{alert.grade}&rsquo; 진입 예상
          </span>
          <span className="text-xs text-amber-700">
            PM2.5 {alert.pm25.toFixed(1)}㎍/㎥ ·{' '}
            {new Date(alert.time).toLocaleTimeString('ko-KR', {
              hour: '2-digit', minute: '2-digit',
            })}
            {' '}기준 · 단순 이류 추정 참고용
            {mock && ' · Mock 데이터'}
          </span>
        </div>
      ))}
    </div>
  )
}
