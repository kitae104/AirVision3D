import { describe, expect, it } from 'vitest'
import {
  WORLD,
  axisMaxFor,
  axisTicks,
  barSlot,
  niceCeil,
  pickLabelIndexes,
  seriesZ,
} from './scale'

describe('niceCeil', () => {
  it('1·2·5 × 10^n 중 하나로 올림한다', () => {
    expect(niceCeil(0.7)).toBe(1)
    expect(niceCeil(12)).toBe(20)
    expect(niceCeil(23)).toBe(50)
    expect(niceCeil(51)).toBe(100)
    expect(niceCeil(100)).toBe(100)
  })

  it('0 이하는 1을 돌려준다', () => {
    expect(niceCeil(0)).toBe(1)
    expect(niceCeil(-5)).toBe(1)
  })
})

describe('axisMaxFor', () => {
  it('최대값에 10% 여유를 준 뒤 보기 좋은 눈금으로 올린다', () => {
    expect(axisMaxFor([10, 32, 18])).toBe(50)
  })

  it('null·NaN을 무시한다', () => {
    expect(axisMaxFor([10, Number.NaN, 32])).toBe(50)
  })

  it('값이 없으면 최소값을 돌려준다', () => {
    expect(axisMaxFor([], 20)).toBe(20)
  })

  it('데이터가 작아도 최소값 아래로 내려가지 않는다', () => {
    expect(axisMaxFor([1, 2], 20)).toBe(20)
  })
})

describe('axisTicks', () => {
  it('0부터 최대값까지 균등하게 나눈다', () => {
    expect(axisTicks(100, 4)).toEqual([0, 25, 50, 75, 100])
  })
})

describe('barSlot', () => {
  it('막대를 월드 폭 안에 균등 배치한다', () => {
    const first = barSlot(0, 4)
    const last = barSlot(3, 4)
    expect(first.x).toBeCloseTo(-WORLD.width / 2 + WORLD.width / 8)
    expect(last.x).toBeCloseTo(WORLD.width / 2 - WORLD.width / 8)
    expect(first.width).toBeGreaterThan(0)
    expect(first.width).toBeLessThan(WORLD.width / 4)
  })

  it('막대가 하나면 가운데에 둔다', () => {
    expect(barSlot(0, 1).x).toBeCloseTo(0)
  })
})

describe('seriesZ', () => {
  it('계열이 하나면 z는 0이다', () => {
    expect(seriesZ(0, 1)).toBe(0)
  })

  it('계열이 둘이면 앞뒤로 갈라놓는다', () => {
    expect(seriesZ(0, 2)).toBeCloseTo(WORLD.seriesDepth / 2)
    expect(seriesZ(1, 2)).toBeCloseTo(-WORLD.seriesDepth / 2)
  })
})

describe('pickLabelIndexes', () => {
  it('개수가 상한 이하면 전부 고른다', () => {
    expect(pickLabelIndexes(4, 6)).toEqual([0, 1, 2, 3])
  })

  it('상한을 넘으면 균등 간격으로 솎아내고 마지막을 포함한다', () => {
    // 균등 간격으로 6개를 고른 뒤 마지막 항목을 덧붙이므로 최대 7개가 된다
    expect(pickLabelIndexes(24, 6)).toEqual([0, 4, 8, 12, 16, 20, 23])
  })
})
