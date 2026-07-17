/** CesiumJS 3차원 지도 (Phase 7에서 구현 예정) */
export default function MapPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center py-24 text-center">
      <h2 className="text-xl font-bold text-gray-900">3D 지도</h2>
      <p className="mt-2 text-gray-500">
        CesiumJS 기반 3차원 미세먼지 시각화는 Phase 7에서 제공됩니다.
      </p>
      <p className="mt-1 text-sm text-gray-400">
        관측소 위치 · 관측/예측/보간 레이어 · 농도별 3D 격자 · 시계열 재생
      </p>
    </div>
  )
}
