import type { IncidentAnalytics } from './analytics'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
// Lite tier: this call is a short summarization task (a dozen aggregated numbers -> a few sentences), well
// within what the lightest model handles, and keeps free-tier quota usage minimal for a once-a-day auto-refresh.
// gemini-2.5-flash-lite was retired for new API keys; 3.5-flash-lite is its direct successor.
const MODEL = 'gemini-3.5-flash-lite'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export const aiInsightsAvailable = Boolean(API_KEY)

export type Insights = {
  immediateActions: string[]
  recommendations: string[]
  suggestions: string[]
}

// Short property names and no per-field descriptions — the schema itself is sent as part of the request and
// counts toward input tokens, so keep it minimal; the prompt carries the actual instructions.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    immediateActions: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    suggestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['immediateActions', 'recommendations', 'suggestions'],
}

// Compact key=value line format instead of prose — carries the same numbers in far fewer tokens, and an LLM
// parses "k=v, k=v" just as well as a sentence.
function buildPrompt(a: IncidentAnalytics): string {
  const top = (label: string, entries: string[]) => (entries.length ? `${label}: ${entries.join('; ')}` : '')

  const addresses = a.topAddresses.slice(0, 5).map((r) => `${r.address}(n=${r.count},sev=${r.avgSeverity.toFixed(1)},${r.topIndicator ?? '-'})`)
  const hotspots = a.hotspotCells.slice(0, 5).map((r) => `${r.lat.toFixed(2)},${r.lng.toFixed(2)}(n=${r.count})`)
  const hours = [...a.byHour].sort((x, y) => y.count - x.count).slice(0, 3).map((h) => `${h.hour}h`)
  const days = [...a.byWeekday].sort((x, y) => y.count - x.count).slice(0, 2).map((d) => d.day)
  const indicators = a.byIndicator.slice(0, 6).map((i) => `${i.indicator}(${i.count})`)

  const stats = [
    `total=${a.total} open=${a.open} resolved=${a.resolved}`,
    `severity: high=${a.bySeverity.high} med=${a.bySeverity.medium} low=${a.bySeverity.low}`,
    `channel: call=${a.byChannel.liveCall} tap=${a.byChannel.silentTap} codedOrder=${a.byChannel.clickOrder} silentSos=${a.byChannel.silentSos} (sosTotal=${a.sosCount})`,
    `avgAckMin=${a.avgTimeToAcknowledgeMin?.toFixed(0) ?? '-'} avgResolveMin=${a.avgTimeToResolveMin?.toFixed(0) ?? '-'} avgStress=${a.avgVoiceStress?.toFixed(0) ?? '-'}`,
    top('busiestHours', hours),
    top('busiestDays', days),
    top('indicators', indicators),
    top('topAddresses', addresses),
    top('hotspots', hotspots),
  ].filter(Boolean).join('\n')

  return `Incident-pattern analyst for a coercion/SOS response system. Data is pre-aggregated, no personal info.\n` +
    `Focus only on the INCIDENTS themselves — timing, location, severity, danger-indicator patterns and open-case ` +
    `risk. Do NOT discuss responder staffing, team workload, or patrol assignments — that's a separate report.\n` +
    `Interpret into concrete next steps, don't restate numbers.\n\n${stats}\n\n` +
    `Return: immediateActions (urgent, e.g. an open high-severity incident, a response-time SLA being missed right now), ` +
    `recommendations (patterns worth acting on: recurring hotspot locations, dangerous times/indicators, address-level risk), ` +
    `suggestions (longer-term: policy, infrastructure, community outreach tied to the incident patterns). ` +
    `One sentence each, specific to the data. Empty array if nothing noteworthy — don't invent filler.`
}

export async function generateInsights(a: IncidentAnalytics): Promise<Insights> {
  if (!API_KEY) throw new Error('Gemini API key not configured')

  const res = await fetch(`${ENDPOINT}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(a) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini returned no content')

  const parsed = JSON.parse(text) as Insights
  return {
    immediateActions: parsed.immediateActions ?? [],
    recommendations: parsed.recommendations ?? [],
    suggestions: parsed.suggestions ?? [],
  }
}
