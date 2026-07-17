/** CesiumJS 3D 시각화 설정 (하드코딩 대신 이 파일에서 관리) */

export const MAP_CONFIG = {
  /** 초기 카메라 위치 (수도권 상공) */
  initialView: { longitude: 126.98, latitude: 37.2, height: 160_000 },

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
  },
} as const
