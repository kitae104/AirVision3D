/**
 * 폼 컨트롤 공통 클래스.
 * 컴포넌트로 감싸면 기존 화면의 input/select 속성을 전부 옮겨야 하므로,
 * 클래스 문자열만 공유해 점진적으로 적용한다.
 */

export const inputClass =
  'w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'placeholder:text-ink-faint focus:border-brand focus:outline-none disabled:opacity-60'

export const selectClass =
  'rounded-control border border-line-strong bg-surface px-3 py-2 text-sm text-ink ' +
  'focus:border-brand focus:outline-none disabled:opacity-60'

export const labelClass = 'mb-1.5 block text-xs font-medium text-ink-muted'

/** 라벨과 컨트롤을 한 줄로 붙이는 인라인 필드 (툴바용) */
export const inlineFieldClass = 'flex items-center gap-2 text-sm text-ink-muted'

/** 화면 상단 필터 줄 */
export const toolbarClass =
  'flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface px-4 py-3 shadow-card'
