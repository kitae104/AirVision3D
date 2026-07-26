import { Route, Routes } from 'react-router-dom'
import Layout, { AdminOnly } from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import DataEntryPage from './pages/DataEntryPage'
import InterpolationPage from './pages/InterpolationPage'
import LoginPage from './pages/LoginPage'
import MapPage from './pages/MapPage'
import MetricsPage from './pages/MetricsPage'
import MyPage from './pages/MyPage'
import ObservationsPage from './pages/ObservationsPage'
import PredictPage from './pages/PredictPage'
import PublicAirPage from './pages/PublicAirPage'
import UsersPage from './pages/UsersPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/observations" element={<ObservationsPage />} />
        <Route path="/public-air" element={<PublicAirPage />} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/my-page" element={<MyPage />} />
        <Route
          path="/users"
          element={
            <AdminOnly>
              <UsersPage />
            </AdminOnly>
          }
        />
        <Route
          path="/data-entry"
          element={
            <AdminOnly>
              <DataEntryPage />
            </AdminOnly>
          }
        />
        <Route
          path="/predict"
          element={
            <AdminOnly>
              <PredictPage />
            </AdminOnly>
          }
        />
        <Route
          path="/interpolation"
          element={
            <AdminOnly>
              <InterpolationPage />
            </AdminOnly>
          }
        />
      </Route>
    </Routes>
  )
}
