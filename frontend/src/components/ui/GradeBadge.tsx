import { PUBLIC_GRADE_COLORS } from '../../config/publicGrades'

interface GradeBadgeProps {
  grade: string | null | undefined
  size?: 'sm' | 'md'
}

/**
 * 대기질 등급 배지.
 * 등급명은 자체 관측(좋음/보통/나쁨/매우나쁨)과 공공 데이터가 같은 팔레트를 쓰므로
 * 색 계산을 한 곳(publicGrades.PUBLIC_GRADE_COLORS)으로 모은다.
 */
export default function GradeBadge({ grade, size = 'md' }: GradeBadgeProps) {
  if (!grade) return <span className="text-ink-faint">-</span>

  const color = PUBLIC_GRADE_COLORS[grade]
  const sizing = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizing}`}
      style={color ? { backgroundColor: `${color}1f`, color } : undefined}
    >
      {color && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      )}
      {grade}
    </span>
  )
}
