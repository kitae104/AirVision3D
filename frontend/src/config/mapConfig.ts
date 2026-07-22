/** CesiumJS 3D 시각화 설정 (하드코딩 대신 이 파일에서 관리) */

export const MAP_CONFIG = {
  /** 초기 카메라 위치: 핵심 대상지인 인천 미추홀·남동·연수 3구 조망
   *  (config/sido.ts INCHEON_FOCUS_VIEW와 동일 값 유지) */
  initialView: { longitude: 126.69, latitude: 37.433, height: 40_000 },

  /** 관측소당 3D 박스 격자 크기 (MVP: 3x3x2, 성능 확인 후 확장 가능) */
  grid: {
    countX: 3,
    countY: 3,
    countZ: 2,
    /** 격자 간격 (m) */
    spacing: 400,
    /** 박스 한 변 크기 (m) */
    boxSize: 340,
    /** 박스 높이 (m) */
    boxHeight: 200,
    /** 최하층 박스 중심 고도 (m) */
    baseAltitude: 150,
    /** 층 간 고도 간격 (m) */
    levelGap: 280,
  },

  /** 박스 투명도 */
  boxAlpha: 0.35,

  /** 레이어별 아이콘 색상 */
  markers: {
    observation: '#2563eb',
    prediction: '#f97316',
    interpolation: '#8b5cf6',
    airkorea: '#0ea5e9',
    idwSurface: '#14b8a6',
    alertRegion: '#dc2626',
  },

  /** 경보 발령 시도 강조 (반투명 원) */
  alertRegion: {
    /** 강조 원 반지름 (m) — 시도를 대략 덮는 크기 */
    radiusM: 45_000,
    /** 표시 고도 (m) */
    altitudeM: 2_000,
    /** 경보(더 심각) 색 / 주의보 색 */
    warningColor: '#dc2626',
    watchColor: '#f97316',
    /** 채움 투명도 */
    alpha: 0.22,
  },

  /** 공공(AirKorea) 측정소 농도 막대 (원기둥) */
  publicBar: {
    /** 반지름 (m) */
    radius: 240,
    /** 채움 투명도 */
    alpha: 0.55,
  },

  /** 풍향 화살표 (기상청) */
  windArrow: {
    /** 화살표 길이 (m) */
    lengthM: 1600,
    /** 표시 고도 (m) */
    altitudeM: 80,
    color: '#0891b2',
  },
} as const
