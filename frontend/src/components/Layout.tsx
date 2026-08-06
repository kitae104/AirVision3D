import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LogOut, PanelLeftClose, PanelLeftOpen, UserRound, Wind } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import AlertBanner from './AlertBanner'
import PreAlertBanner from './PreAlertBanner'
import ThemeToggle from './ThemeToggle'
import { NAV_GROUPS, findNavMeta } from './navItems'

const COLLAPSE_KEY = 'airvision-sidebar-collapsed'

/** 로그인 필수 공통 레이아웃 (사이드바 + 헤더 + 콘텐츠) */
export default function Layout() {
  const { token, name, role, logout } = useAuthStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(COLLAPSE_KEY) === '1',
  )

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  if (!token) return <Navigate to="/login" replace />

  const isAdmin = role === 'ADMIN'
  const meta = findNavMeta(pathname)
  // 3D 지도는 화면 전체를 써야 해서 콘텐츠 여백을 없앤다
  const fullBleed = pathname.startsWith('/map')

  return (
    <div className="flex min-h-screen bg-canvas">
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ${
          collapsed ? 'w-[4.5rem]' : 'w-60'
        }`}
      >
        <div
          className={`flex h-14 items-center border-b border-line ${
            collapsed ? 'justify-center px-2' : 'gap-2.5 px-4'
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <Wind size={17} />
          </span>
          {!collapsed && (
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold tracking-tight text-ink">
                AirVision 3D
              </span>
              <span className="block truncate text-[0.6875rem] text-ink-faint">
                미세먼지 예측·시각화
              </span>
            </span>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4">
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => !item.adminOnly || isAdmin)
            if (items.length === 0) return null
            return (
              <div key={group.title} className="mb-5 last:mb-0">
                {collapsed ? (
                  <div aria-hidden className="mx-auto mb-2 h-px w-6 bg-line" />
                ) : (
                  <p className="mb-1.5 px-2.5 text-[0.6875rem] font-semibold tracking-wider text-ink-faint">
                    {group.title}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={item.to === '/'}
                          title={collapsed ? item.label : undefined}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 rounded-control py-2 text-sm font-medium transition-colors ${
                              collapsed ? 'justify-center px-2' : 'px-2.5'
                            } ${
                              isActive
                                ? 'bg-brand-soft text-brand-ink'
                                : 'text-ink-muted hover:bg-surface-muted hover:text-ink'
                            }`
                          }
                        >
                          <Icon size={17} className="shrink-0" />
                          {!collapsed && <span className="truncate">{item.label}</span>}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-line p-2.5">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            className={`flex w-full items-center gap-2.5 rounded-control py-2 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink ${
              collapsed ? 'justify-center px-2' : 'px-2.5'
            }`}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            {!collapsed && <span>메뉴 접기</span>}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-line bg-surface/85 px-5 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight text-ink">
              {meta.label}
            </h1>
            {meta.summary && (
              <p className="truncate text-xs text-ink-faint">{meta.summary}</p>
            )}
          </div>

          <ThemeToggle />

          <div className="flex items-center gap-2 border-l border-line pl-3">
            <NavLink
              to="/my-page"
              className="flex items-center gap-2 rounded-control px-2 py-1.5 transition-colors hover:bg-surface-muted"
              title="마이페이지"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                <UserRound size={15} />
              </span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-medium leading-tight text-ink">{name}</span>
                <span className="block text-[0.6875rem] leading-tight text-ink-faint">
                  {isAdmin ? '관리자' : '일반 사용자'}
                </span>
              </span>
            </NavLink>
            <button
              type="button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
              title="로그아웃"
              aria-label="로그아웃"
              className="flex h-9 w-9 items-center justify-center rounded-control text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <main className={`min-w-0 flex-1 ${fullBleed ? 'p-4' : 'p-6'}`}>
          <div className={fullBleed ? '' : 'mx-auto max-w-[1400px]'}>
            <AlertBanner />
            <PreAlertBanner />
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

/** 관리자 전용 라우트 가드 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((s) => s.role)
  if (role !== 'ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}
