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

// ── 공공 데이터 (AirKorea·기상청) 타입 ──────────────────────

/** 오염물질 측정값. valid=false면 value는 null이고 status로 사유를 구분 */
export interface PollutantValue {
  value: number | null
  unit: string | null
  grade: string | null
  valid: boolean
  status: 'NORMAL' | 'NO_DATA' | 'COMM_ERROR' | 'MAINTENANCE' | 'INVALID'
}

export interface PublicStationAir {
  stationName: string
  sidoName: string
  latitude: number | null
  longitude: number | null
  locationAvailable: boolean
  measuredAt: string | null
  pm10: PollutantValue
  pm25: PollutantValue
  o3: PollutantValue
  no2: PollutantValue
  co: PollutantValue
  so2: PollutantValue
  khai: PollutantValue
}

export interface CurrentAirQuality {
  sido: string
  source: string
  mock: boolean
  stale: boolean
  collectedAt: string | null
  message: string | null
  stations: PublicStationAir[]
}

export interface PublicStation {
  stationName: string
  addr: string | null
  sido: string | null
  mangName: string | null
  items: string | null
  latitude: number | null
  longitude: number | null
  locationAvailable: boolean
  distanceKm: number | null
}

export interface RegionGrade {
  region: string
  grade: string
}

export interface AirForecast {
  informCode: string
  forecastDate: string | null
  announcedAt: string | null
  overall: string | null
  cause: string | null
  actionKnack: string | null
  grades: RegionGrade[]
  imageUrls: string[]
}

export interface AirForecastEnvelope {
  informCode: string
  stale: boolean
  lastUpdatedAt: string | null
  forecasts: AirForecast[]
}

export interface WeeklyForecast {
  announcedAt: string | null
  days: { date: string; content: string | null }[]
}

export interface AirAlert {
  districtName: string | null
  moveName: string | null
  itemCode: string | null
  issueLevel: string | null
  issuedAt: string | null
  issueValue: number | null
  clearedAt: string | null
  clearValue: number | null
  active: boolean
}

export interface WeatherNow {
  latitude: number
  longitude: number
  gridX: number
  gridY: number
  baseTime: string | null
  source: string
  mock: boolean
  stale: boolean
  temperature: number | null
  humidity: number | null
  precipitationMm: number | null
  precipitationType: string | null
  windSpeed: number | null
  windDirectionDegree: number | null
  windDirectionText: string | null
  windArrowDegree: number | null
}

export interface WeatherForecastHour {
  forecastAt: string
  temperature: number | null
  humidity: number | null
  sky: string | null
  precipitationType: string | null
  windSpeed: number | null
  windDirectionDegree: number | null
  windDirectionText: string | null
}

export interface WeatherForecast {
  latitude: number
  longitude: number
  baseTime: string | null
  source: string
  mock: boolean
  hours: WeatherForecastHour[]
}

export interface ComparisonRow {
  siteId: number
  siteName: string
  predictedAt: string
  predictedPm25: number
  stationName: string | null
  measuredAt: string | null
  measuredPm25: number | null
  distanceKm: number | null
  timeDiffMinutes: number | null
  absoluteError: number | null
  errorRatePercent: number | null
  matched: boolean
  reason: string | null
}

export interface ComparisonResult {
  maxDistanceKm: number
  maxMinutes: number
  sido: string
  mock: boolean
  rows: ComparisonRow[]
}

export interface PublicDataStatus {
  airkorea: Record<string, unknown>
  weather: Record<string, unknown>
}

export interface MeasurementHourlyPoint {
  hour: string
  avgPm10: number | null
  avgPm25: number | null
  count: number
}

export interface ComparisonHistoryPoint {
  computedAt: string
  siteName: string
  predictedAt: string
  predictedPm25: number
  stationName: string | null
  measuredPm25: number | null
  absoluteError: number | null
  errorRatePercent: number | null
}

export interface PublicHistorySummary {
  accumulatedCount: number
  earliestCollectedAt: string | null
}

export interface IdwGridCell {
  latitude: number
  longitude: number
  pm25: number
  grade: string
}

export interface IdwGridResponse {
  sido: string
  power: number
  resolution: number
  source: string
  mock: boolean
  stale: boolean
  sourceCount: number
  bbox: { minLatitude: number; minLongitude: number; maxLatitude: number; maxLongitude: number }
  cells: IdwGridCell[]
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
