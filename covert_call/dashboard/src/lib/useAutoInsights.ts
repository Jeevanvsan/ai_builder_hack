import { useEffect, useRef, useState } from 'react'
import { aiInsightsAvailable, generateInsights } from './aiInsights'
import { getCachedInsights, isStale, saveInsights, type CachedInsights } from './aiInsightsCache'
import type { IncidentAnalytics } from './analytics'

// Best-effort daily auto-generation: no server cron (would need Firebase billing), so instead the first
// responder to open the Analytics page each day silently triggers a background regenerate if the shared cache
// is missing or over a day old. Whoever's already looking at AI Insights sees it update live; everyone else just
// gets a fresh cached result the next time they check. A manual Refresh (in AiInsightsPanel) stays available too.
export function useAutoInsights(analytics: IncidentAnalytics, generatedBy: string) {
  const [cached, setCached] = useState<CachedInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefreshing, setAutoRefreshing] = useState(false)
  const triedAutoRefresh = useRef(false)

  useEffect(() => {
    if (!aiInsightsAvailable) { setLoading(false); return }
    let cancelled = false

    getCachedInsights()
      .then(async (c) => {
        if (cancelled) return
        setCached(c)
        setLoading(false)

        if (!triedAutoRefresh.current && isStale(c)) {
          triedAutoRefresh.current = true
          setAutoRefreshing(true)
          try {
            const result = await generateInsights(analytics)
            await saveInsights(result, generatedBy)
            if (!cancelled) setCached(await getCachedInsights())
          } catch {
            // Silent: this is a background best-effort refresh, not a user-initiated action — the manual
            // Refresh button in AiInsightsPanel surfaces errors when someone actually asks for a retry.
          } finally {
            if (!cancelled) setAutoRefreshing(false)
          }
        }
      })
      .catch(() => setLoading(false))

    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page load; analytics/generatedBy intentionally not re-triggering
  }, [])

  return { cached, setCached, loading, autoRefreshing }
}
