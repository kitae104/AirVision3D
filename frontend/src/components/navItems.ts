import {
  Database,
  Gauge,
  Globe2,
  Grid3x3,
  LayoutDashboard,
  Sparkles,
  Upload,
  Users,
  Wind,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  /** 헤더에 표시할 한 줄 설명 — 이 화면이 무엇에 답하는지 */
  summary: string
  icon: LucideIcon
  adminOnly: boolean
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

/**
 * 사이드바 메뉴를 역할별로 묶는다.
 * 현황 보기: 지금 대기질이 어떤지 — 로그인한 누구나
 * AI 분석:   모델이 무엇을 내놓는지 — 예측·보간 실행은 관리자
 * 관리:      데이터와 계정을 다루는 화면 — 관리자 전용
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: '현황 보기',
    items: [
      {
        to: '/',
        label: '대시보드',
        summary: '지금 인천 대기질과 오늘의 흐름',
        icon: LayoutDashboard,
        adminOnly: false,
      },
      {
        to: '/map',
        label: '3D 지도',
        summary: '관측·예측·보간을 3차원 지도에서 보기',
        icon: Globe2,
        adminOnly: false,
      },
      {
        to: '/observations',
        label: '관측 데이터',
        summary: '직접 수집한 관측값 기록',
        icon: Database,
        adminOnly: false,
      },
      {
        to: '/public-air',
        label: '공공 대기질',
        summary: '에어코리아 실측·예보·경보와 악취 측정',
        icon: Wind,
        adminOnly: false,
      },
    ],
  },
  {
    title: 'AI 분석',
    items: [
      {
        to: '/predict',
        label: 'AI 예측',
        summary: '대기 이미지와 환경값으로 PM2.5 추정',
        icon: Sparkles,
        adminOnly: true,
      },
      {
        to: '/interpolation',
        label: 'IDW 보간',
        summary: '관측 지점 사이 농도를 공간 보간',
        icon: Grid3x3,
        adminOnly: true,
      },
      {
        to: '/metrics',
        label: '모델 성능',
        summary: '학습 지표와 예측 정확도 비교',
        icon: Gauge,
        adminOnly: false,
      },
    ],
  },
  {
    title: '관리',
    items: [
      {
        to: '/data-entry',
        label: '데이터 등록',
        summary: '관측값 개별 입력과 CSV 일괄 업로드',
        icon: Upload,
        adminOnly: true,
      },
      {
        to: '/users',
        label: '사용자 관리',
        summary: '계정 추가·권한 변경',
        icon: Users,
        adminOnly: true,
      },
    ],
  },
]

/** 마이페이지처럼 사이드바에 없는 화면도 헤더 제목이 필요하다 */
const EXTRA_TITLES: Record<string, { label: string; summary: string }> = {
  '/my-page': { label: '마이페이지', summary: '내 계정 정보와 비밀번호 변경' },
}

export function findNavMeta(pathname: string): { label: string; summary: string } {
  const all = NAV_GROUPS.flatMap((g) => g.items)
  const exact = all.find((i) => i.to === pathname)
  if (exact) return { label: exact.label, summary: exact.summary }
  if (EXTRA_TITLES[pathname]) return EXTRA_TITLES[pathname]
  const prefix = all.find((i) => i.to !== '/' && pathname.startsWith(i.to))
  if (prefix) return { label: prefix.label, summary: prefix.summary }
  return { label: 'AirVision 3D', summary: '' }
}
