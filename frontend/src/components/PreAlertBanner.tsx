import { useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
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
    <div className="mb-4 space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.district}
          className="flex items-start gap-3 rounded-card border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">
              {alert.district} · 약 {alert.hoursAhead}시간 후 &lsquo;{alert.grade}&rsquo; 진입 예상
            </p>
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300/80">
              PM2.5 {alert.pm25.toFixed(1)}㎍/㎥ ·{' '}
              {new Date(alert.time).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              기준 · 단순 이류 추정에 따른 참고 정보이며 공식 경보가 아닙니다
              {mock && ' · Mock 데이터'}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
