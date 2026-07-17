import { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE_URL, AI_SERVICE_URL } from './api/client'
import type { ApiResponse } from './api/client'

type HealthStatus = 'checking' | 'up' | 'down'

interface HealthData {
  status: string
  service: string
}

/** 개별 서비스 헬스체크 카드 */
function HealthCard({ name, url }: { name: string; url: string }) {
  const [status, setStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    let cancelled = false
    axios
      .get<ApiResponse<HealthData>>(url, { timeout: 5_000 })
      .then((res) => {
        if (!cancelled) setStatus(res.data.success ? 'up' : 'down')
      })
      .catch(() => {
        if (!cancelled) setStatus('down')
      })
    return () => {
      cancelled = true
    }
  }, [url])

  const styles: Record<HealthStatus, { badge: string; label: string }> = {
    checking: { badge: 'bg-gray-200 text-gray-600', label: '확인 중...' },
    up: { badge: 'bg-green-100 text-green-700', label: '정상' },
    down: { badge: 'bg-red-100 text-red-700', label: '연결 실패' },
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <p className="font-medium text-gray-900">{name}</p>
        <p className="text-sm text-gray-500">{url}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-sm font-medium ${styles[status].badge}`}>
        {styles[status].label}
      </span>
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">AirVision 3D</h1>
          <p className="mt-1 text-gray-600">
            AI 영상인식 기반 미세먼지 예측 및 3차원 시각화 시스템
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">서비스 상태</h2>
        <div className="space-y-3">
          <HealthCard name="Backend (Spring Boot)" url={`${API_BASE_URL}/health`} />
          <HealthCard name="AI Service (FastAPI)" url={`${AI_SERVICE_URL}/health`} />
        </div>
        <p className="mt-8 text-sm text-gray-400">
          Phase 1 — 프로젝트 기반 구축. 대시보드와 3차원 지도는 이후 단계에서 추가됩니다.
        </p>
      </main>
    </div>
  )
}
