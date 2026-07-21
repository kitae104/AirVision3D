import { describe, it, expect } from 'vitest'
import type { AirAlert } from '../api/client'
import { summarizeAlertsByDistrict } from './alerts'

function alert(p: Partial<AirAlert>): AirAlert {
  return {
    districtName: null, moveName: null, itemCode: null, issueLevel: null,
    issuedAt: null, issueValue: null, clearedAt: null, clearValue: null,
    active: true, ...p,
  }
}

describe('summarizeAlertsByDistrict', () => {
  it('시도별로 묶고 건수를 센다', () => {
    const out = summarizeAlertsByDistrict([
      alert({ districtName: '서울', itemCode: 'PM25', issueLevel: '주의보' }),
      alert({ districtName: '서울', itemCode: 'PM10', issueLevel: '주의보' }),
      alert({ districtName: '경기', itemCode: 'PM25', issueLevel: '경보' }),
    ])
    const seoul = out.find((d) => d.district === '서울')!
    expect(seoul.count).toBe(2)
    expect(seoul.items).toEqual(['PM25', 'PM10'])
  })

  it('가장 심각한 단계를 maxLevel로 유지한다 (경보 > 주의보)', () => {
    const out = summarizeAlertsByDistrict([
      alert({ districtName: '서울', itemCode: 'PM25', issueLevel: '주의보' }),
      alert({ districtName: '서울', itemCode: 'PM10', issueLevel: '경보' }),
    ])
    expect(out[0].maxLevel).toBe('경보')
  })

  it('심각도 내림차순으로 정렬한다 (경보 시도 먼저)', () => {
    const out = summarizeAlertsByDistrict([
      alert({ districtName: '서울', issueLevel: '주의보' }),
      alert({ districtName: '경기', issueLevel: '경보' }),
    ])
    expect(out.map((d) => d.district)).toEqual(['경기', '서울'])
  })

  it('active=false 또는 districtName 없는 경보는 제외한다', () => {
    const out = summarizeAlertsByDistrict([
      alert({ districtName: '서울', issueLevel: '주의보', active: false }),
      alert({ districtName: null, issueLevel: '경보' }),
      alert({ districtName: '인천', issueLevel: '주의보' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].district).toBe('인천')
  })

  it('항목 코드 중복은 제거한다', () => {
    const out = summarizeAlertsByDistrict([
      alert({ districtName: '서울', itemCode: 'PM25', issueLevel: '주의보' }),
      alert({ districtName: '서울', itemCode: 'PM25', issueLevel: '경보' }),
    ])
    expect(out[0].items).toEqual(['PM25'])
  })
})
