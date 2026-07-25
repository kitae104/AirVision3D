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
    odor: '#a16207',
    wind: '#06b6d4',
    advection: '#64748b',
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

  /** 바람길 파티클 애니메이션 (cesium-wind-layer)
   *  흐름 이해가 목적이므로 적고·가늘고·느리게 유지한다 (2026-07-25 사용자 피드백). */
  windLayer: {
    /** 파티클 수 = size² (64 → 4,096개) */
    particlesTextureSize: 64,
    /** 파티클 표시 고도 (m) */
    particleHeight: 120,
    speedFactor: 0.15,
    lineWidth: { min: 0.8, max: 1.6 },
    lineLength: { min: 20, max: 80 },
    dropRate: 0.003,
    dropRateBump: 0.001,
    /** 풍속 저→고 색상 램프 (Windy 스타일) */
    colors: ['#3b82f6', '#22d3ee', '#4ade80', '#facc15', '#fb923c', '#ef4444'],
  },

  /** 바람장 격자 화살표 오버레이 (방향을 한눈에 읽는 정적 화살표) */
  windArrowGrid: {
    /** 축당 목표 화살표 수 (격자를 이 수준으로 균등 샘플링) */
    perAxis: 9,
    /** 표시 고도 (m) */
    altitudeM: 150,
    /** 화살표 선 두께 (px) — PolylineArrow는 이 폭으로 화살촉을 그린다 */
    widthPx: 12,
    /** 풍속 최소~기준(refSpeedMs 이상)일 때 화살표 길이 (m) */
    minLengthM: 3000,
    maxLengthM: 10000,
    /** 길이·색 스케일 기준 풍속 (m/s) */
    refSpeedMs: 8,
    /** 이 풍속(m/s) 미만이면 화살표를 그리지 않는다 (무풍) */
    minSpeedMs: 0.2,
    alpha: 0.9,
  },
} as const
