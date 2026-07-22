import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth'
import AlertBanner from './AlertBanner'

const NAV_ITEMS = [
  { to: '/', label: '대시보드', adminOnly: false },
  { to: '/map', label: '3D 지도', adminOnly: false },
  { to: '/observations', label: '관측 데이터', adminOnly: false },
  { to: '/public-air', label: '공공 대기질', adminOnly: false },
  { to: '/data-entry', label: '데이터 등록', adminOnly: true },
  { to: '/predict', label: 'AI 예측', adminOnly: true },
  { to: '/interpolation', label: 'IDW 보간', adminOnly: true },
  { to: '/metrics', label: '모델 성능', adminOnly: false },
]

/** 로그인 필수 공통 레이아웃 (사이드바 + 콘텐츠) */
export default function Layout() {
  const { token, name, role, logout } = useAuthStore()
  const navigate = useNavigate()

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-5">
          <h1 className="text-lg font-bold text-gray-900">AirVision 3D</h1>
          <p className="text-xs text-gray-500">미세먼지 예측·시각화</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.filter((item) => !item.adminOnly || role === 'ADMIN').map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-900">{name}</p>
          <p className="mb-2 text-xs text-gray-500">{role === 'ADMIN' ? '관리자' : '일반 사용자'}</p>
          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            로그아웃
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-auto p-6">
        <AlertBanner />
        <Outlet />
      </main>
    </div>
  )
}

/** 관리자 전용 라우트 가드 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((s) => s.role)
  if (role !== 'ADMIN') return <Navigate to="/" replace />
  return <>{children}</>
}
