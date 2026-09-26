import { useState } from 'react'
import { aiInsightsAvailable, generateInsights } from '../lib/aiInsights'
import { getCachedInsights, isStale, saveInsights, type CachedInsights } from '../lib/aiInsightsCache'
import { useAuth } from '../lib/authContext'
import type { IncidentAnalytics } from '../lib/analytics'

const GROUPS = {
  high: { title: 'Immediate actions', subtitle: 'Act now', icon: '⚡' },
  medium: { title: 'Recommendations', subtitle: 'Plan this week', icon: '🎯' },
  low: { title: 'Suggestions', subtitle: 'Worth considering', icon: '💡' },
} as const

function InsightList({ tone, items }: { tone: keyof typeof GROUPS; items: string[] }) {
  const group = GROUPS[tone]
  return (
    <div className={`insight-group insight-${tone}`}>
      <div className="insight-group-head">
        <span className="insight-icon" aria-hidden="true">{group.icon}</span>
        <div>
          <h3>{group.title}</h3>
          <span className="insight-subtitle">{group.subtitle}</span>
        </div>
        <span className="insight-count">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="muted-inline insight-empty">Nothing notable right now.</p>
      ) : (
        <ol className="insight-items">
          {items.map((item, i) => <li key={i}><span className="insight-marker" />{item}</li>)}
        </ol>
      )}
    </div>
  )
}

export default function AiInsightsPanel({
  analytics,
  cached,
  onUpdate,
  autoRefreshing,
}: {
  analytics: IncidentAnalytics
  cached: CachedInsights | null
  onUpdate: (c: CachedInsights | null) => void
  autoRefreshing: boolean
}) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await generateInsights(analytics)
      await saveInsights(result, user?.email ?? 'unknown')
      onUpdate(await getCachedInsights())
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!aiInsightsAvailable) {
    return (
      <div className="card empty">
        AI Insights isn't set up yet. Ask an admin to enable it.
      </div>
    )
  }

  const stale = isStale(cached)
  const working = busy || autoRefreshing

  return (
    <div className="insights-panel">
      <div className="insights-toolbar">
        <div className="insights-toolbar-text">
          <span className="ai-badge">✨ AI</span>
          <p className="muted">
            Reads the stats above (no personal data) and suggests concrete next steps. Refreshes itself once a
            day automatically — anyone can refresh sooner.
            {cached && <> Last generated {new Date(cached.generatedAt).toLocaleString()} by {cached.generatedBy}.</>}
          </p>
        </div>
        <button type="button" className="btn btn-primary" disabled={working} onClick={() => void run()}>
          {working ? 'Generating…' : cached ? 'Refresh' : 'Generate insights'}
        </button>
      </div>

      {error && <p className="action-error" role="alert">{error}</p>}

      {working && !cached && <div className="insights-loading">Analyzing incident patterns…</div>}

      {!cached && !working && !error && (
        <p className="muted">No insights generated yet — click "Generate insights" to get started.</p>
      )}

      {stale && cached && !working && (
        <p className="muted chart-hint insight-stale">This is more than a day old — refreshing automatically, or click Refresh now.</p>
      )}

      {cached && (
        <div className="insights-grid">
          <InsightList tone="high" items={cached.immediateActions} />
          <InsightList tone="medium" items={cached.recommendations} />
          <InsightList tone="low" items={cached.suggestions} />
        </div>
      )}
    </div>
  )
}
