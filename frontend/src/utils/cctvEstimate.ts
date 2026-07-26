/** CCTV 프레임 즉시 추정 보조 로직 (MapPage에서 사용, 순수 함수로 분리해 테스트) */

import { haversineKm } from './geo'

/** 최신 관측에 온·습도가 없을 때 사용하는 기본값 */
export const DEFAULT_TEMPERATURE = 20
export const DEFAULT_HUMIDITY = 50

interface SitePoint {
  latitude: number
  longitude: number
}

/** 주어진 좌표에서 가장 가까운 관측소. 목록이 비어 있으면 null. */
export function nearestSite<T extends SitePoint>(
  sites: T[], latitude: number, longitude: number): T | null {
  let best: T | null = null
  let bestKm = Infinity
  for (const site of sites) {
    const km = haversineKm(latitude, longitude, site.latitude, site.longitude)
    if (km < bestKm) {
      best = site
      bestKm = km
    }
  }
  return best
}

/** CCTV 마커 라벨에 붙일 추정 배지 문자열. pm25가 없으면 null. */
export function estimateBadgeText(pm25: number | null, gradeName: string | null): string | null {
  if (pm25 == null) return null
  return `PM2.5 ${pm25.toFixed(1)}${gradeName ? ` (${gradeName})` : ''}`
}
