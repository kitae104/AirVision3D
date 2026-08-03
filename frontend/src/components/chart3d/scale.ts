/**
 * 데이터 값을 3D 월드 좌표로 옮기는 순수 함수 모음.
 * three에 의존하지 않으므로 단위 테스트가 그대로 된다.
 */

/** 모든 3D 차트가 공유하는 월드 크기. 카메라 거리도 이 값을 기준으로 잡는다. */
export const WORLD = {
  width: 10,
  height: 5,
  /** 계열을 앞뒤로 갈라놓을 때 쓰는 간격 */
  seriesDepth: 1.2,
} as const

/** 1·2·5 × 10^n 중 value 이상인 가장 작은 값 */
export function niceCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const exponent = Math.floor(Math.log10(value))
  const base = 10 ** exponent
  for (const step of [1, 2, 5, 10]) {
    const candidate = step * base
    // 부동소수 오차로 100이 100.00000000000001보다 작다고 판정되는 것을 막는다
    if (candidate >= value - candidate * 1e-9) return candidate
  }
  return 10 * base
}

/** 데이터 최대값에 10% 여유를 준 축 상한 */
export function axisMaxFor(values: number[], minimum = 10): number {
  const valid = values.filter((v) => Number.isFinite(v))
  if (valid.length === 0) return minimum
  return Math.max(minimum, niceCeil(Math.max(...valid) * 1.1))
}

/** 0부터 max까지 count 등분한 눈금값 (양 끝 포함) */
export function axisTicks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, i) => (max / count) * i)
}

/** index번째 막대의 중심 x와 막대 폭 */
export function barSlot(index: number, count: number): { x: number; width: number } {
  const safeCount = Math.max(1, count)
  const slot = WORLD.width / safeCount
  return {
    x: -WORLD.width / 2 + slot * (index + 0.5),
    // 막대 사이에 틈을 둬야 개수를 셀 수 있다
    width: slot * 0.62,
  }
}

/** 계열을 앞뒤로 갈라놓는 z 좌표. 인덱스가 작을수록 앞(카메라 쪽)이다. */
export function seriesZ(seriesIndex: number, seriesCount: number): number {
  if (seriesCount <= 1) return 0
  const span = WORLD.seriesDepth * (seriesCount - 1)
  return span / 2 - WORLD.seriesDepth * seriesIndex
}

/** 축 라벨이 겹치지 않도록 최대 max개만 균등 간격으로 고른다 (마지막 항목은 항상 포함) */
export function pickLabelIndexes(count: number, max: number): number[] {
  if (count <= 0) return []
  if (count <= max) return Array.from({ length: count }, (_, i) => i)
  const step = Math.ceil(count / max)
  const picked: number[] = []
  for (let i = 0; i < count; i += step) picked.push(i)
  if (picked[picked.length - 1] !== count - 1) picked.push(count - 1)
  return picked
}
