import axios from 'axios'
import { useAuthStore } from '../store/auth'

/** 백엔드 공통 응답 형식 */
export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string | null
  timestamp: string
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface Site {
  id: number
  name: string
  latitude: number
  longitude: number
  altitude: number | null
  siteType: string
  description: string | null
  geomWkt: string | null
}

export interface Observation {
  id: number
  siteId: number
  siteName: string
  observedAt: string
  pm10: number | null
  pm25: number | null
  temperature: number | null
  humidity: number | null
  windSpeed: number | null
  windDirection: number | null
}

export interface Prediction {
  id: number
  siteId: number
  siteName: string
  modelName: string
  predictedAt: string
  actualPm25: number | null
  predictedPm25: number
  predictedGrade: string
}

export interface InterpolationResult {
  id: number
  targetName: string | null
  latitude: number
  longitude: number
  pm25: number
  algorithm: string
  power: number
  interpolatedAt: string
}

export interface DashboardSummary {
  latestAvgPm25: number | null
  grade: string | null
  siteCount: number
  recentPredictionCount: number
  recentInterpolationCount: number
}

export interface ModelMetrics {
  mae: number
  rmse: number
  mape: number
  r2: number
  grade_accuracy: number
  labels: string[]
  confusion_matrix: number[][]
}

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
})

// 요청마다 JWT 첨부
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 401이면 로그아웃 후 로그인 화면으로
apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && useAuthStore.getState().token) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

/** axios 오류에서 사용자 표시용 메시지 추출 */
export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as ApiResponse<unknown> | undefined)?.message
    if (msg) return msg
    if (err.code === 'ERR_NETWORK') return '서버에 연결할 수 없습니다'
  }
  return '요청 처리 중 오류가 발생했습니다'
}
