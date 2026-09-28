import { useState } from 'react'
import type { Incident } from '../../../shared/incidents/types'
import { aiSearch, aiSearchAvailable, localSearch, type AiMatch } from '../lib/nlSearch'

type AiState = { query: string; status: 'loading' | 'done' | 'failed'; matches: AiMatch[] }

// Filters a list by a natural-language query. Typing filters instantly (local); Enter or "Ask AI" asks Gemini
// to match the described situation. The AI result only applies while the query is unchanged.
export function useSmartSearch(incidents: Incident[], q: string) {
  const [ai, setAi] = useState<AiState | null>(null)
  const current = ai && ai.query === q ? ai : null

  const runAi = async () => {
    if (!q.trim() || !aiSearchAvailable) return
    setAi({ query: q, status: 'loading', matches: [] })
    try {
      const matches = await aiSearch(incidents, q)
      setAi({ query: q, status: 'done', matches })
    } catch (e) {
      console.warn('[dashboard] AI search failed, showing keyword matches:', e)
      setAi({ query: q, status: 'failed', matches: [] })
    }
  }

  let results: Incident[]
  const reasons = new Map<string, string>()
  if (current?.status === 'done') {
    const byId = new Map(incidents.map((i) => [i.id, i]))
    results = current.matches.map((m) => byId.get(m.id)).filter((i): i is Incident => Boolean(i))
    current.matches.forEach((m) => reasons.set(m.id, m.reason))
  } else {
    results = q.trim() ? localSearch(incidents, q) : incidents
  }
  return { results, reasons, aiStatus: current?.status ?? null, runAi }
}

export default function SmartSearchBar({
  value,
  onChange,
  onAsk,
  aiStatus,
  placeholder = 'Describe the situation, e.g. "woman attacked with a weapon near Vazhichery"',
}: {
  value: string
  onChange: (v: string) => void
  onAsk: () => void
  aiStatus: AiState['status'] | null
  placeholder?: string
}) {
  return (
    <div className="smart-search">
      <input
        className="input filter-search"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') onAsk() }}
        placeholder={placeholder}
        aria-label="Search incidents in plain language"
      />
      {aiSearchAvailable && (
        <button type="button" className="btn" onClick={onAsk} disabled={!value.trim() || aiStatus === 'loading'}>
          {aiStatus === 'loading' ? 'Searching…' : 'Ask AI'}
        </button>
      )}
      {aiStatus === 'done' && <span className="sub smart-search-note">AI matches for this description</span>}
      {aiStatus === 'failed' && <span className="sub smart-search-note">AI search unavailable — showing keyword matches</span>}
    </div>
  )
}
