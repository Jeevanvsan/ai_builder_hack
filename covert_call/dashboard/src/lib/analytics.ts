import type { Incident, Severity } from '../../../shared/incidents/types'

function minutesBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / 60_000
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

// --- Team-wide incident KPIs (visible to every responder) ---------------------------------------------------

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ~0.005 degrees is roughly 500m at the equator — coarse enough to merge nearby addresses into one hotspot,
// fine enough not to blur together genuinely different neighborhoods.
const GRID_SIZE = 0.005

function gridCell(lat: number, lng: number): { lat: number; lng: number; key: string } {
  const glat = Math.round(lat / GRID_SIZE) * GRID_SIZE
  const glng = Math.round(lng / GRID_SIZE) * GRID_SIZE
  return { lat: glat, lng: glng, key: `${glat.toFixed(3)},${glng.toFixed(3)}` }
}

const severityWeight: Record<Severity, number> = { low: 1, medium: 2, high: 3 }

export type IncidentAnalytics = {
  total: number
  open: number
  resolved: number
  bySeverity: Record<Severity, number>
  byChannel: { liveCall: number; silentTap: number; clickOrder: number; silentSos: number }
  sosCount: number
  avgTimeToAcknowledgeMin: number | null
  avgTimeToResolveMin: number | null
  avgVoiceStress: number | null
  byDay: { day: string; count: number }[]
  byHour: { hour: number; count: number }[]
  byWeekday: { day: string; count: number }[]
  byIndicator: { indicator: string; count: number }[]
  byPeopleCount: { people: string; count: number }[]
  stressBySeverity: { severity: Severity; avgStress: number | null; count: number }[]
  points: { id: string; lat: number; lng: number; severity: Severity; label: string }[]
  topAddresses: { address: string; count: number; avgSeverity: number; topIndicator: string | null }[]
  hotspotCells: { lat: number; lng: number; count: number; avgSeverity: number; topIndicator: string | null }[]
}

export function computeIncidentAnalytics(incidents: Incident[]): IncidentAnalytics {
  const bySeverity: Record<Severity, number> = { low: 0, medium: 0, high: 0 }
  let liveCall = 0
  let silentTap = 0
  let clickOrder = 0
  let silentSos = 0
  let sosCount = 0
  const ackTimes: number[] = []
  const resolveTimes: number[] = []
  const stressScores: number[] = []
  const dayCounts = new Map<string, number>()
  const hourCounts = new Map<number, number>()
  const weekdayCounts = new Map<number, number>()
  const indicatorCounts = new Map<string, number>()
  const peopleCounts = new Map<string, number>()
  const stressBySeverityRaw = new Map<Severity, number[]>()
  const points: IncidentAnalytics['points'] = []
  const addressGroups = new Map<string, { count: number; severitySum: number; indicators: Map<string, number> }>()
  const cellGroups = new Map<string, { lat: number; lng: number; count: number; severitySum: number; indicators: Map<string, number> }>()

  const bumpIndicatorMap = (m: Map<string, number>, indicators: string[]) => {
    for (const ind of indicators) m.set(ind, (m.get(ind) ?? 0) + 1)
  }
  const topOf = (m: Map<string, number>): string | null =>
    [...m.entries()].sort(([, a], [, b]) => b - a)[0]?.[0] ?? null

  for (const i of incidents) {
    bySeverity[i.severity]++
    if (i.channel === 'live-call') liveCall++
    else if (i.channel === 'silent-tap') silentTap++
    else if (i.channel === 'click-order') clickOrder++
    else if (i.channel === 'silent-sos') silentSos++
    if (i.incidentType === 'sos') sosCount++

    if (i.response.acknowledgedAt) ackTimes.push(minutesBetween(i.sessionStartedAt, i.response.acknowledgedAt))
    if (i.response.resolvedAt) resolveTimes.push(minutesBetween(i.sessionStartedAt, i.response.resolvedAt))
    if (i.voiceStressScore !== null) {
      stressScores.push(i.voiceStressScore)
      const arr = stressBySeverityRaw.get(i.severity) ?? []
      arr.push(i.voiceStressScore)
      stressBySeverityRaw.set(i.severity, arr)
    }

    const started = new Date(i.sessionStartedAt)
    const day = i.sessionStartedAt.slice(0, 10)
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
    hourCounts.set(started.getHours(), (hourCounts.get(started.getHours()) ?? 0) + 1)
    weekdayCounts.set(started.getDay(), (weekdayCounts.get(started.getDay()) ?? 0) + 1)

    bumpIndicatorMap(indicatorCounts, i.extractedFieldsLive.dangerIndicators)

    const people = i.extractedFieldsLive.peopleCount
    const peopleKey = people === null ? 'Unknown' : people >= 5 ? '5+' : String(people)
    peopleCounts.set(peopleKey, (peopleCounts.get(peopleKey) ?? 0) + 1)

    const c = i.location.confirmed
    const spot = (c && c.lat != null && c.lng != null ? { lat: c.lat, lng: c.lng } : null) ?? i.location.rough
    if (spot) {
      points.push({ id: i.id, lat: spot.lat, lng: spot.lng, severity: i.severity, label: i.id })

      const cell = gridCell(spot.lat, spot.lng)
      const cellEntry = cellGroups.get(cell.key) ?? { lat: cell.lat, lng: cell.lng, count: 0, severitySum: 0, indicators: new Map() }
      cellEntry.count++
      cellEntry.severitySum += severityWeight[i.severity]
      bumpIndicatorMap(cellEntry.indicators, i.extractedFieldsLive.dangerIndicators)
      cellGroups.set(cell.key, cellEntry)
    }

    if (i.location.confirmed?.address) {
      const address = i.location.confirmed.address
      const entry = addressGroups.get(address) ?? { count: 0, severitySum: 0, indicators: new Map() }
      entry.count++
      entry.severitySum += severityWeight[i.severity]
      bumpIndicatorMap(entry.indicators, i.extractedFieldsLive.dangerIndicators)
      addressGroups.set(address, entry)
    }
  }

  const resolved = incidents.filter((i) => i.response.status === 'resolved').length

  return {
    total: incidents.length,
    open: incidents.length - resolved,
    resolved,
    bySeverity,
    byChannel: { liveCall, silentTap, clickOrder, silentSos },
    sosCount,
    avgTimeToAcknowledgeMin: average(ackTimes),
    avgTimeToResolveMin: average(resolveTimes),
    avgVoiceStress: average(stressScores),
    byDay: [...dayCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count })),
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, count: hourCounts.get(hour) ?? 0 })),
    byWeekday: Array.from({ length: 7 }, (_, d) => ({ day: DAY_NAMES[d], count: weekdayCounts.get(d) ?? 0 })),
    byIndicator: [...indicatorCounts.entries()].sort(([, a], [, b]) => b - a).map(([indicator, count]) => ({ indicator, count })),
    byPeopleCount: ['1', '2', '3', '4', '5+', 'Unknown']
      .filter((k) => peopleCounts.has(k))
      .map((people) => ({ people, count: peopleCounts.get(people) ?? 0 })),
    stressBySeverity: (['high', 'medium', 'low'] as const).map((severity) => ({
      severity,
      avgStress: average(stressBySeverityRaw.get(severity) ?? []),
      count: (stressBySeverityRaw.get(severity) ?? []).length,
    })),
    points,
    topAddresses: [...addressGroups.entries()]
      .map(([address, g]) => ({ address, count: g.count, avgSeverity: g.severitySum / g.count, topIndicator: topOf(g.indicators) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    hotspotCells: [...cellGroups.values()]
      .map((g) => ({ lat: g.lat, lng: g.lng, count: g.count, avgSeverity: g.severitySum / g.count, topIndicator: topOf(g.indicators) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
  }
}

// --- Per-responder performance (admin-only) ------------------------------------------------------------------

export type ResponderStats = {
  name: string
  acknowledged: number
  resolved: number
  avgTimeToAcknowledgeMin: number | null
  avgTimeToResolveMin: number | null
  resolutionRate: number | null
  bySeverity: Record<Severity, number>
}

export function computeResponderStats(incidents: Incident[]): ResponderStats[] {
  const byResponder = new Map<
    string,
    { ack: number; resolved: number; ackTimes: number[]; resolveTimes: number[]; bySeverity: Record<Severity, number> }
  >()

  for (const i of incidents) {
    const name = i.response.acknowledgedBy
    if (!name) continue
    const entry = byResponder.get(name) ?? { ack: 0, resolved: 0, ackTimes: [], resolveTimes: [], bySeverity: { low: 0, medium: 0, high: 0 } }
    entry.ack++
    entry.bySeverity[i.severity]++
    if (i.response.acknowledgedAt) entry.ackTimes.push(minutesBetween(i.sessionStartedAt, i.response.acknowledgedAt))
    if (i.response.status === 'resolved') {
      entry.resolved++
      if (i.response.resolvedAt) entry.resolveTimes.push(minutesBetween(i.sessionStartedAt, i.response.resolvedAt))
    }
    byResponder.set(name, entry)
  }

  return [...byResponder.entries()]
    .map(([name, s]) => ({
      name,
      acknowledged: s.ack,
      resolved: s.resolved,
      avgTimeToAcknowledgeMin: average(s.ackTimes),
      avgTimeToResolveMin: average(s.resolveTimes),
      resolutionRate: s.ack > 0 ? s.resolved / s.ack : null,
      bySeverity: s.bySeverity,
    }))
    .sort((a, b) => b.acknowledged - a.acknowledged)
}

// One responder's own trend over time (incidents they acknowledged, by day) — for their personal card.
export function computeResponderTrend(incidents: Incident[], name: string): { day: string; count: number }[] {
  const dayCounts = new Map<string, number>()
  for (const i of incidents) {
    if (i.response.acknowledgedBy !== name) continue
    const day = i.sessionStartedAt.slice(0, 10)
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1)
  }
  return [...dayCounts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, count]) => ({ day, count }))
}
