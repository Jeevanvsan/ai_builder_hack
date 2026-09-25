import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import RequireAdmin from './components/RequireAdmin'
import QueuePage from './pages/queue/QueuePage'
import IncidentDetailPage from './pages/incident/IncidentDetailPage'
import IncidentVideoPage from './pages/incident/IncidentVideoPage'
import DevCameraPage from './pages/dev/DevCameraPage'
import HistoryPage from './pages/history/HistoryPage'
import AnalyticsPage from './pages/analytics/AnalyticsPage'
import ResponderManagementPage from './pages/admin/ResponderManagementPage'
import ResponderPerformancePage from './pages/admin/ResponderPerformancePage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<QueuePage />} />
        <Route path="incident/:id" element={<IncidentDetailPage />} />
        <Route path="incident/:id/video" element={<IncidentVideoPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="admin/responders" element={<RequireAdmin><ResponderManagementPage /></RequireAdmin>} />
        <Route path="admin/performance" element={<RequireAdmin><ResponderPerformancePage /></RequireAdmin>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {/* Dev-only test tool, outside the dashboard layout (no nav, no alerts). */}
      <Route path="dev/camera" element={<DevCameraPage />} />
    </Routes>
  )
}
