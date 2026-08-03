import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildAxes, disposeObject, makeTextSprite } from './axes'
import type { Chart3DPalette } from './chart3dTheme'

/**
 * jsdom에는 2D 컨텍스트가 없다. 그냥 두면 스프라이트를 만들 때마다
 * "Not implemented" 경고가 쏟아지므로 명시적으로 null을 돌려주게 막는다.
 * 이 상태가 곧 makeTextSprite가 견뎌야 하는 환경이기도 하다.
 */
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

const PALETTE: Chart3DPalette = {
  grid: '#e9ecf1',
  axis: '#8a93a2',
  label: '#8a93a2',
  floor: '#f4f6f9',
  tooltipBg: '#ffffff',
  tooltipBorder: '#e4e7ec',
  tooltipInk: '#12161c',
}

describe('makeTextSprite', () => {
  it('2D 컨텍스트가 없는 환경(jsdom)에서도 스프라이트를 돌려준다', () => {
    const sprite = makeTextSprite('12', '#000000')
    expect(sprite).toBeInstanceOf(THREE.Sprite)
    disposeObject(sprite)
  })
})

describe('buildAxes', () => {
  it('바닥면·가이드선·라벨을 담은 그룹을 만든다', () => {
    const group = buildAxes({
      max: 100,
      depth: 2,
      xLabels: ['00', '06', '12', '18'],
      palette: PALETTE,
    })
    expect(group).toBeInstanceOf(THREE.Group)
    // 바닥면 1개 + 가이드선 1개 + y눈금 5개 + x라벨 4개
    expect(group.children.length).toBe(11)
    disposeObject(group)
  })

  it('x 라벨이 많으면 솎아낸다', () => {
    const labels = Array.from({ length: 24 }, (_, i) => String(i))
    const group = buildAxes({ max: 50, depth: 2, xLabels: labels, palette: PALETTE })
    const sprites = group.children.filter((c) => c instanceof THREE.Sprite)
    // y눈금 5개 + 솎아낸 x라벨(최대 7개)
    expect(sprites.length).toBeLessThanOrEqual(12)
    expect(sprites.length).toBeGreaterThan(5)
    disposeObject(group)
  })
})

describe('disposeObject', () => {
  it('자식의 geometry와 material을 정리한다', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshBasicMaterial()
    const mesh = new THREE.Mesh(geometry, material)
    let disposed = 0
    geometry.addEventListener('dispose', () => (disposed += 1))
    material.addEventListener('dispose', () => (disposed += 1))
    disposeObject(mesh)
    expect(disposed).toBe(2)
  })
})
