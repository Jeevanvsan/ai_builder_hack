import { Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import QueuePage from './pages/queue/QueuePage'
import IncidentDetailPage from './pages/incident/IncidentDetailPage'
import IncidentVideoPage from './pages/incident/IncidentVideoPage'
import DevCameraPage from './pages/dev/DevCameraPage'
import HistoryPage from './pages/history/HistoryPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<QueuePage />} />
        <Route path="incident/:id" element={<IncidentDetailPage />} />
        <Route path="incident/:id/video" element={<IncidentVideoPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
      {/* Dev-only test tool, outside the dashboard layout (no nav, no alerts). */}
      <Route path="dev/camera" element={<DevCameraPage />} />
    </Routes>
  )
}
