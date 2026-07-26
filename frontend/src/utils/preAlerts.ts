/** 예측 기반 사전 경보 계산 (구별 이류 예측에서 등급 악화 진입 시점 탐지) */

import type { DistrictHourForecast, DistrictNow } from '../api/client'
import { GRADES } from '../config/grades'

/** '나쁨' 등급의 랭크 (GRADES 배열 인덱스) — 이 랭크 이상 진입 예상만 경보한다 */
const BAD_RANK = GRADES.findIndex((g) => g.name === '나쁨')

export interface PreAlert {
  district: string
  /** 진입이 예상되는 등급명 (나쁨 또는 매우나쁨) */
  grade: string
  /** 해당 시점 예측 PM2.5 */
  pm25: number
  /** 진입 예상 시각 (ISO-8601) */
  time: string
  /** 몇 시간 후인지 (+1h 프레임 = 1) */
  hoursAhead: number
}

function rankOf(pm25: number): number {
  for (let i = 0; i < GRADES.length; i++) {
    const upper = GRADES[i].upper
    if (upper === null || pm25 <= upper) return i
  }
  return GRADES.length - 1
}

/**
 * 구별로 "현재 등급보다 나빠지고 나쁨 이상"이 되는 시점을 찾는다.
 * 같은 구에서 여러 등급에 도달하면 가장 나쁜 등급의 첫 도달 시점을 보고한다.
 * 현재 값이 없는 구는 좋음(랭크 0)으로 간주해 악화만 탐지한다.
 */
export function computePreAlerts(
  current: DistrictNow[], hourly: DistrictHourForecast[]): PreAlert[] {
  const currentRank = new Map<string, number>()
  for (const now of current) {
    currentRank.set(now.district, now.pm25 != null ? rankOf(now.pm25) : 0)
  }

  const worst = new Map<string, PreAlert & { rank: number }>()
  hourly.forEach((hour, i) => {
    for (const d of hour.districts) {
      if (d.pm25 == null) continue
      const rank = rankOf(d.pm25)
      const base = currentRank.get(d.district) ?? 0
      if (rank < BAD_RANK || rank <= base) continue
      const prev = worst.get(d.district)
      if (prev && prev.rank >= rank) continue
      worst.set(d.district, {
        district: d.district,
        grade: GRADES[rank].name,
        pm25: d.pm25,
        time: hour.time,
        hoursAhead: i + 1,
        rank,
      })
    }
  })

  return [...worst.values()]
    .sort((a, b) => a.district.localeCompare(b.district, 'ko'))
    .map(({ rank: _rank, ...alert }) => alert)
}
