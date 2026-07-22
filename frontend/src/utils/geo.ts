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
