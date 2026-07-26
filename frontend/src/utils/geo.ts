/** 지리 계산 유틸 (백엔드 GeoUtils와 동일 규약: Haversine, IUGG 평균 반지름). */

const EARTH_RADIUS_KM = 6371.0088

/** 두 좌표 간 Haversine 거리(km). */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a))
}

/** 경로(위경도 점 목록)의 누적 거리(km). */
export function pathDistanceKm(points: { latitude: number; longitude: number }[]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(
      points[i - 1].latitude, points[i - 1].longitude,
      points[i].latitude, points[i].longitude)
  }
  return total
}

/**
 * 다각형(위경도 점 목록, 마지막-첫 점 자동 연결) 면적(km²).
 * 평균 위도 기준 등장방형 투영 후 신발끈 공식 — 시 단위(수십 km) 규모까지 적합.
 */
export function polygonAreaKm2(points: { latitude: number; longitude: number }[]): number {
  if (points.length < 3) return 0
  const toRad = (d: number) => (d * Math.PI) / 180
  const lat0 = points.reduce((sum, p) => sum + p.latitude, 0) / points.length
  const cos0 = Math.cos(toRad(lat0))
  const xy = points.map((p) => ({
    x: EARTH_RADIUS_KM * toRad(p.longitude) * cos0,
    y: EARTH_RADIUS_KM * toRad(p.latitude),
  }))
  let sum = 0
  for (let i = 0; i < xy.length; i++) {
    const a = xy[i]
    const b = xy[(i + 1) % xy.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}
