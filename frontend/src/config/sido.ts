/**
 * AirKorea sidoName 허용값(17개)과 지도 이동용 대략적 중심좌표.
 * 백엔드 AirKoreaService.SIDO_NAMES와 동일한 목록을 유지한다.
 * 좌표는 시/도청 소재지 부근의 대표 지점으로, 시도 선택 시 카메라 flyTo에만 사용한다.
 */
export interface SidoCenter {
  name: string
  latitude: number
  longitude: number
}

export const SIDO_CENTERS: SidoCenter[] = [
  { name: '서울', latitude: 37.5665, longitude: 126.978 },
  { name: '인천', latitude: 37.4563, longitude: 126.7052 },
  { name: '경기', latitude: 37.4138, longitude: 127.5183 },
  { name: '강원', latitude: 37.8228, longitude: 128.1555 },
  { name: '충북', latitude: 36.6357, longitude: 127.4917 },
  { name: '충남', latitude: 36.6588, longitude: 126.6728 },
  { name: '대전', latitude: 36.3504, longitude: 127.3845 },
  { name: '세종', latitude: 36.48, longitude: 127.289 },
  { name: '전북', latitude: 35.7175, longitude: 127.153 },
  { name: '전남', latitude: 34.8161, longitude: 126.463 },
  { name: '광주', latitude: 35.1595, longitude: 126.8526 },
  { name: '경북', latitude: 36.4919, longitude: 128.8889 },
  { name: '경남', latitude: 35.4606, longitude: 128.2132 },
  { name: '대구', latitude: 35.8714, longitude: 128.6014 },
  { name: '울산', latitude: 35.5384, longitude: 129.3114 },
  { name: '부산', latitude: 35.1796, longitude: 129.0756 },
  { name: '제주', latitude: 33.4996, longitude: 126.5312 },
]

/** 시도 선택 시 카메라 높이(m). 시도 전역이 보이도록 광역 수준으로 잡는다. */
export const SIDO_VIEW_HEIGHT = 220_000

/**
 * 프로젝트 핵심 대상지: 인천 미추홀구·남동구·연수구.
 * 최종보고서의 "사업대상지 지도 이동" 기능에 대응하며, 데이터가 가장 확실한
 * 인천 도심권(AirKorea 실측 밀집 지역)을 초기 화면과 빠른 이동 대상으로 삼는다.
 */
export const INCHEON_CORE_DISTRICTS: SidoCenter[] = [
  { name: '미추홀구', latitude: 37.46, longitude: 126.665 },
  { name: '남동구', latitude: 37.435, longitude: 126.72 },
  { name: '연수구', latitude: 37.405, longitude: 126.67 },
]

/** 구 단위 이동 시 카메라 높이(m) */
export const DISTRICT_VIEW_HEIGHT = 12_000

/** 핵심 3구가 한눈에 보이는 초기/인천 선택 시 조망 (3구 중심 상공) */
export const INCHEON_FOCUS_VIEW = { longitude: 126.69, latitude: 37.433, height: 40_000 }
