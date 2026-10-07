import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { CallPage } from './pages/CallPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { HomePage } from './pages/HomePage'
import { OrderPlacedPage } from './pages/OrderPlacedPage'
import { SilentTapPage } from './pages/SilentTapPage'
import { DemoResultPage } from './pages/DemoResultPage'
import { SosPage } from './pages/SosPage'
import { AccountPage } from './pages/AccountPage'

// Demo recording control panel: staging (and dev) builds only, never in the production bundle.
const DEMO_CONTROL = import.meta.env.MODE === 'staging' || import.meta.env.DEV
const DemoControlPage = DEMO_CONTROL ? lazy(() => import('./pages/DemoControlPage')) : null
const AiUsagePage = DEMO_CONTROL ? lazy(() => import('./pages/AiUsagePage')) : null

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="app-shell">
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-placed" element={<OrderPlacedPage />} />
        <Route path="/call" element={<CallPage />} />
        <Route path="/delivery-instructions" element={<SilentTapPage />} />
        <Route path="/sos" element={<SosPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/demo-result/:id" element={<DemoResultPage />} />
        {DemoControlPage && <Route path="/demo-control" element={<Suspense fallback={null}><DemoControlPage /></Suspense>} />}
        {AiUsagePage && <Route path="/ai-usage" element={<Suspense fallback={null}><AiUsagePage /></Suspense>} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
