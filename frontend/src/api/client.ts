import axios from 'axios'

/** 백엔드 공통 응답 형식 */
export interface ApiResponse<T> {
  success: boolean
  data: T
  message: string | null
  timestamp: string
}

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

/** AI 서비스 주소 (헬스체크 표시용. 이후 단계에서 AI 호출은 백엔드를 경유한다) */
export const AI_SERVICE_URL =
  import.meta.env.VITE_AI_SERVICE_URL ?? 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10_000,
})
