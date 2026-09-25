import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Chip from '../../components/Chip'
import DataState from '../../components/DataState'
import Pagination from '../../components/Pagination'
import { channelLabel, formatElapsed, formatTime } from '../../lib/format'
import { useIncidents } from '../../lib/incidentsStore'
import type { Incident } from '../../../../shared/incidents/types'
import { useNow } from '../../lib/useNow'
import { usePagination } from '../../lib/usePagination'

const PERIODS = { all: 'Any time', today: 'Last 24 hours', week: 'Last 7 days' } as const
type Period = keyof typeof PERIODS

function matchesPeriod(i: Incident, period: Period, now: number): boolean {
  if (period === 'all' || !i.response.resolvedAt) return period === 'all'
  const age = now - Date.parse(i.response.resolvedAt)
  return age <= (period === 'today' ? 1 : 7) * 86_400_000
}

function matchesSearch(i: Incident, q: string): boolean {
  if (!q) return true
  const haystack = [
    i.id,
    i.location.confirmed?.address,
    i.response.acknowledgedBy,
    i.consolidatedSummary,
    ...i.extractedFieldsLive.dangerIndicators,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q.toLowerCase())
}

export default function HistoryPage() {
  const { data, loading, error } = useIncidents('resolved')
  const navigate = useNavigate()
  // Filters live in the URL so a filtered view survives reloads and back-navigation and can be shared.
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const severity = params.get('severity') ?? ''
  const channel = params.get('channel') ?? ''
  const handledBy = params.get('by') ?? ''
  const period = (params.get('period') ?? 'all') as Period

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value && value !== 'all') next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setParams(next, { replace: true })
  }

  const now = useNow(60_000)
  const responders = [...new Set(data.map((i) => i.response.acknowledgedBy).filter((r): r is string => Boolean(r)))].sort()
  const filtered = data
    .filter(
      (i) =>
        matchesSearch(i, q) &&
        (!severity || i.severity === severity) &&
        (!channel || i.channel === channel) &&
        (!handledBy || i.response.acknowledgedBy === handledBy) &&
        matchesPeriod(i, period, now),
    )
    .sort((a, b) => Date.parse(b.response.resolvedAt ?? '') - Date.parse(a.response.resolvedAt ?? ''))
  const pager = usePagination(filtered)
  const anyFilter = Boolean(q || severity || channel || handledBy || period !== 'all')

  return (
    <section>
      <div className="page-head">
        <h1>Case history</h1>
        <p className="muted">Resolved incidents, most recent first. Kept separate from the live queue.</p>
      </div>

      <div className="filters">
        <input
          className="input filter-search"
          type="search"
          value={q}
          onChange={(e) => setFilter('q', e.target.value)}
          placeholder="Search ID, address, responder, danger indicator…"
          aria-label="Search cases"
        />
        <select className="input" value={severity} onChange={(e) => setFilter('severity', e.target.value)} aria-label="Severity">
          <option value="">All severities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select className="input" value={channel} onChange={(e) => setFilter('channel', e.target.value)} aria-label="Channel">
          <option value="">All channels</option>
          <option value="live-call">Voice call</option>
          <option value="silent-tap">Silent tap</option>
          <option value="click-order">Coded order</option>
        </select>
        <select className="input" value={handledBy} onChange={(e) => setFilter('by', e.target.value)} aria-label="Handled by">
          <option value="">Anyone</option>
          {responders.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="input" value={period} onChange={(e) => setFilter('period', e.target.value)} aria-label="Resolved">
          {Object.entries(PERIODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        {anyFilter && (
          <button type="button" className="btn" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
            Clear filters
          </button>
        )}
      </div>

      {loading || error ? (
        <DataState loading={loading} error={error} />
      ) : (
        <>
          <p className="result-count">
            {anyFilter ? `${filtered.length} of ${data.length} resolved cases` : `${data.length} resolved cases`}
          </p>
          {filtered.length === 0 ? (
            <div className="card empty">{data.length === 0 ? 'No resolved cases yet.' : 'No cases match these filters.'}</div>
          ) : (
            <table className="table queue">
              <thead>
                <tr>
                  <th>Incident</th>
                  <th>Severity</th>
                  <th>Channel</th>
                  <th>Resolved</th>
                  <th>Time to resolve</th>
                  <th>Handled by</th>
                  <th>Danger indicators</th>
                  <th>Location</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {pager.pageItems.map((i) => (
                  <tr key={i.id} className={`row-${i.severity}`} onClick={() => navigate(`/incident/${i.id}`)}>
                    <td className="mono"><Link to={`/incident/${i.id}`}>{i.id}</Link></td>
                    <td><Chip tone={i.severity} filled>{i.severity}</Chip></td>
                    <td className="nowrap">{channelLabel(i.channel)}</td>
                    <td className="mono">{i.response.resolvedAt ? formatTime(i.response.resolvedAt) : '—'}</td>
                    <td className="mono">{i.response.resolvedAt ? formatElapsed(i.sessionStartedAt, Date.parse(i.response.resolvedAt)) : '—'}</td>
                    <td className="nowrap">{i.response.acknowledgedBy ?? '—'}</td>
                    <td>
                      {i.extractedFieldsLive.dangerIndicators.length
                        ? i.extractedFieldsLive.dangerIndicators.map((d) => <Chip key={d} tone="danger">{d}</Chip>)
                        : <span className="muted-inline">None</span>}
                    </td>
                    <td>{i.location.confirmed?.address ?? <span className="muted-inline">Not confirmed</span>}</td>
                    <td title={i.consolidatedSummary ?? undefined}>
                      <span className="summary-cell">{i.consolidatedSummary ?? '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {filtered.length > 0 && <Pagination {...pager} noun="cases" onPage={pager.setPage} />}
        </>
      )}
    </section>
  )
}
