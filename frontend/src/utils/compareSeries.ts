/**
 * 듀얼맵 비교 뷰(예측/보간)의 시계열 변환.
 * 저장된 예측·보간 이력을 기간으로 잘라 지점별 시계열(SeriesSite 형태)로 묶는다.
 */

import type { InterpolationResult, Prediction, Site } from '../api/client'

export interface CompareSeries {
  siteId: number
  siteName: string
  latitude: number
  longitude: number
  samples: { time: string; pm25: number }[]
}

function inWindow(timeIso: string, fromIso: string, toIso: string): boolean {
  const t = Date.parse(timeIso)
  return t >= Date.parse(fromIso) && t <= Date.parse(toIso)
}

/**
 * 예측 이력 → 관측소별 시계열. 좌표는 관측소 목록에서 찾으며,
 * 목록에 없는 관측소의 예측은 제외한다(좌표 없이는 지도 표시 불가).
 */
export function predictionSeries(
  predictions: Prediction[],
  sites: Site[],
  fromIso: string,
  toIso: string,
): CompareSeries[] {
  const bySite = new Map<number, CompareSeries>()
  for (const p of predictions) {
    if (!inWindow(p.predictedAt, fromIso, toIso)) continue
    let series = bySite.get(p.siteId)
    if (!series) {
      const site = sites.find((s) => s.id === p.siteId)
      if (!site) continue
      series = {
        siteId: p.siteId,
        siteName: `${p.siteName} (예측)`,
        latitude: site.latitude,
        longitude: site.longitude,
        samples: [],
      }
      bySite.set(p.siteId, series)
    }
    series.samples.push({ time: p.predictedAt, pm25: p.predictedPm25 })
  }
  const result = [...bySite.values()]
  result.forEach((s) => s.samples.sort((a, b) => Date.parse(a.time) - Date.parse(b.time)))
  return result
}

/** 보간 이력 → 대상 지점(좌표)별 시계열. */
export function interpolationSeries(
  results: InterpolationResult[],
  fromIso: string,
  toIso: string,
): CompareSeries[] {
  const byPoint = new Map<string, CompareSeries>()
  for (const r of results) {
    if (!inWindow(r.interpolatedAt, fromIso, toIso)) continue
    const key = `${r.latitude.toFixed(4)},${r.longitude.toFixed(4)}`
    let series = byPoint.get(key)
    if (!series) {
      series = {
        siteId: 0,
        siteName: `${r.targetName ?? `보간지점 (${key})`} (보간)`,
        latitude: r.latitude,
        longitude: r.longitude,
        samples: [],
      }
      byPoint.set(key, series)
    }
    series.samples.push({ time: r.interpolatedAt, pm25: r.pm25 })
  }
  const result = [...byPoint.values()]
  result.forEach((s) => s.samples.sort((a, b) => Date.parse(a.time) - Date.parse(b.time)))
  return result
}
