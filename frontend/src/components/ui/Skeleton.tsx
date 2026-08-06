/** 로딩 자리표시자. 실제 콘텐츠와 같은 위치·크기를 잡아 화면이 튀지 않게 한다. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-surface-muted ${className}`} />
}

/** 카드 격자 로딩 */
export function SkeletonTiles({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  )
}
