import { useEffect, useState } from 'react'
import { Siren } from 'lucide-react'
import { apiClient } from '../api/client'
import type { AirAlert, ApiResponse } from '../api/client'

const ITEM_LABELS: Record<string, string> = {
  PM10: '미세먼지',
  PM25: '초미세먼지',
  O3: '오존',
}

/**
 * 활성 대기오염 경보 배너 (모든 페이지 상단).
 * 경보가 없거나 조회에 실패하면 아무것도 표시하지 않는다 (오류처럼 보이지 않게).
 */
export default function AlertBanner() {
  const [alerts, setAlerts] = useState<AirAlert[]>([])

  useEffect(() => {
    apiClient
      .get<ApiResponse<AirAlert[]>>('/air-quality/alerts/active')
      .then((res) => setAlerts(res.data.data))
      .catch(() => setAlerts([]))
  }, [])

  if (alerts.length === 0) return null

  return (
    <div className="mb-4 space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          role="alert"
          className="flex items-start gap-3 rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
        >
          <Siren size={18} className="mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">
              [{alert.districtName ?? '-'}
              {alert.moveName ? ` · ${alert.moveName}` : ''}]{' '}
              {ITEM_LABELS[alert.itemCode ?? ''] ?? alert.itemCode} {alert.issueLevel} 발령 중
            </p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-300/80">
              실외 활동을 자제하고 보건용 마스크(KF80 이상)를 착용하세요
              {alert.issuedAt &&
                ` · ${new Date(alert.issuedAt).toLocaleString('ko-KR')}부터`}
              {alert.issueValue != null && ` · 발령 농도 ${alert.issueValue}㎍/㎥`}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
