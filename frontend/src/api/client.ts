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
  district: string | null
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

export interface OdorSpot {
  office: string
  spotName: string
  address: string | null
  latitude: number | null
  longitude: number | null
  locationAvailable: boolean
  latestDate: string | null
  latestDilution: number | null
  maxDilution: number | null
  measurementCount: number
}

export interface OdorResponse {
  mock: boolean
  stale: boolean
  loadedAt: string | null
  spotCount: number
  spots: OdorSpot[]
  failedOffices: string[]
}

export interface CctvCamera {
  name: string
  district: string
  latitude: number
  longitude: number
  /** HLS(m3u8) 스트림 주소 — Mock 모드에서는 빈 문자열 */
  streamUrl: string
  format: string
}

export interface CctvStreamsResponse {
  mock: boolean
  stale: boolean
  loadedAt: string | null
  source: string
  count: number
  cameras: CctvCamera[]
}

/** CCTV 이미지 즉시 추정 결과 (backend CctvEstimateResponse 대응, 저장 안 함) */
export interface CctvEstimate {
  siteId: number
  modelName: string
  /** AI_IMAGE: 주간 AI 이미지 추론 / STATION_FALLBACK: 야간 최근접 실측 대체 */
  mode: 'AI_IMAGE' | 'STATION_FALLBACK'
  night: boolean
  solarElevationDeg: number
  pm25: number | null
  pm10: number | null
  grade: string | null
  visibilityKm: number | null
  stationName: string | null
  estimatedAt: string
}

export interface CsvUploadResult {
  totalRows: number
  inserted: number
  duplicateSkipped: number
  failed: number
  errors: { line: number; message: string }[]
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

export interface WindFieldHour {
  time: string
  u: number[]
  v: number[]
  speedMin: number
  speedMax: number
}

export interface WindFieldResponse {
  bounds: { west: number; south: number; east: number; north: number }
  width: number
  height: number
  baseTime: string | null
  source: string
  mock: boolean
  stale: boolean
  hours: WindFieldHour[]
}

export interface AdvectionFrame {
  time: string
  pm25: number[]
  pm10: number[] | null
}

export interface AdvectionResponse {
  bounds: { west: number; south: number; east: number; north: number }
  width: number
  height: number
  model: string
  mock: boolean
  frames: AdvectionFrame[]
}

// ── 모델 정확도 리포트 (predictions/accuracy) 타입 ──────────

export interface AccuracyPoint {
  predictedPm25: number
  actualPm25: number
  predictedAt: string
  siteName: string
}

export interface ModelAccuracy {
  modelName: string
  count: number
  mae: number
  rmse: number
  /** (예측-실측) 평균. 양수면 과대예측 경향 */
  meanError: number
  /** 등급 일치율 (0~1) */
  gradeAccuracy: number
  points: AccuracyPoint[]
}

export interface PredictionAccuracy {
  totalWithActual: number
  pointLimit: number
  models: ModelAccuracy[]
}

// ── 구별 확산 예측 (district-forecast) 타입 ──────────────────

/** 바람 벡터 요약. directionDeg는 기상학적 풍향(불어오는 방향, 북=0) */
export interface DistrictWind {
  speedMs: number | null
  directionDeg: number | null
  directionText: string | null
  movementText: string | null
}

export interface DistrictNow {
  district: string
  pm25: number | null
  pm10: number | null
  wind: DistrictWind | null
}

export interface DistrictHourForecast {
  time: string
  districts: DistrictNow[]
}

export interface DistrictForecast {
  baseTime: string | null
  source: string
  model: string
  mock: boolean
  current: DistrictNow[]
  hourly: DistrictHourForecast[]
}

/** 사용자 관리 API 응답 (보고서 표 3-20: 사용자 목록/등록/상세/수정/삭제) */
export interface UserSummary {
  id: number
  username: string
  name: string
  role: 'USER' | 'ADMIN'
  createdAt: string
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
