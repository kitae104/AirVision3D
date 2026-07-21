import type { AirAlert } from '../api/client'

/** 시도(districtName)별 활성 경보 요약 — 3D 지도 시도 강조용. */
export interface DistrictAlertSummary {
  /** AirKorea districtName (예: 서울, 경기, 인천) */
  district: string
  /** 가장 심각한 발령 단계 (경보 > 주의보) */
  maxLevel: string
  /** 발령된 오염물질 코드 목록 (중복 제거, 예: PM25, PM10) */
  items: string[]
  /** 활성 경보 건수 */
  count: number
}

/** 발령 단계 심각도 순위 (클수록 심각). 알 수 없는 단계는 0. */
const LEVEL_RANK: Record<string, number> = { 경보: 2, 주의보: 1 }

function levelRank(level: string | null): number {
  return level ? (LEVEL_RANK[level] ?? 0) : 0
}

/**
 * 활성 경보 목록을 시도별로 묶어 요약한다.
 * districtName이 없는 경보는 제외하며, 각 시도는 가장 심각한 단계와
 * 발령 항목(중복 제거)을 갖는다. 결과는 심각도 내림차순으로 정렬한다.
 */
export function summarizeAlertsByDistrict(alerts: AirAlert[]): DistrictAlertSummary[] {
  const byDistrict = new Map<string, DistrictAlertSummary>()
  for (const a of alerts) {
    if (!a.active || !a.districtName) continue
    const key = a.districtName
    const cur = byDistrict.get(key)
    if (!cur) {
      byDistrict.set(key, {
        district: key,
        maxLevel: a.issueLevel ?? '',
        items: a.itemCode ? [a.itemCode] : [],
        count: 1,
      })
    } else {
      cur.count += 1
      if (levelRank(a.issueLevel) > levelRank(cur.maxLevel)) {
        cur.maxLevel = a.issueLevel ?? cur.maxLevel
      }
      if (a.itemCode && !cur.items.includes(a.itemCode)) {
        cur.items.push(a.itemCode)
      }
    }
  }
  return [...byDistrict.values()].sort((x, y) => levelRank(y.maxLevel) - levelRank(x.maxLevel))
}
