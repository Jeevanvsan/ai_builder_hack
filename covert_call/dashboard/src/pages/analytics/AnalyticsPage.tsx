import { lazy, Suspense, useState } from 'react'
import type { EChartsOption } from 'echarts'
import AiInsightsPanel from '../../components/AiInsightsPanel'
import Chip from '../../components/Chip'
import DataState from '../../components/DataState'
import EChart from '../../components/EChart'
import { baseAxisLabel, baseAxisLine, baseGrid, baseSplitLine, baseTooltip, chartColors, gradientFill, severityColor } from '../../lib/chartTheme'
import { computeIncidentAnalytics, type IncidentAnalytics } from '../../lib/analytics'
import { useIncidents } from '../../lib/incidentsStore'
import { useAuth } from '../../lib/authContext'
import { responderLabel } from '../../lib/auth'
import { useAutoInsights } from '../../lib/useAutoInsights'

const IncidentsOverviewMap = lazy(() => import('../../components/IncidentsOverviewMap'))

function formatMinutes(min: number | null): string {
  if (min === null) return '—'
  if (min < 1) return '<1 min'
  if (min < 60) return `${Math.round(min)} min`
  return `${(min / 60).toFixed(1)} hr`
}

function formatHour(h: number): string {
  const period = h < 12 ? 'am' : 'pm'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}${period}`
}

function severityFromScore(avg: number): string {
  if (avg >= 2.5) return 'high'
  if (avg >= 1.5) return 'medium'
  return 'low'
}

type Tab = 'charts' | 'ai'

const EMPTY_ANALYTICS: IncidentAnalytics = computeIncidentAnalytics([])

export default function AnalyticsPage() {
  const { data: incidents, loading, error } = useIncidents('all')
  const { user, responder } = useAuth()
  const [tab, setTab] = useState<Tab>('charts')

  // computeIncidentAnalytics([]) when incidents haven't loaded yet keeps this hook call unconditional (required
  // by the rules of hooks) — the auto-refresh effect inside only acts once real data + a live doc read confirm
  // staleness, so an empty placeholder here never triggers a spurious Gemini call.
  const insights = useAutoInsights(loading ? EMPTY_ANALYTICS : computeIncidentAnalytics(incidents), responderLabel(user, responder))

  if (loading || error) return <DataState loading={loading} error={error} />

  const a = computeIncidentAnalytics(incidents)
  const hourData = a.byHour.map((h) => ({ ...h, label: formatHour(h.hour) }))
  const stressRows = a.stressBySeverity.filter((s) => s.avgStress !== null)

  const trendOption: EChartsOption = {
    grid: baseGrid,
    tooltip: { ...baseTooltip, trigger: 'axis' },
    xAxis: { type: 'category', data: a.byDay.map((d) => d.day), axisLabel: baseAxisLabel, axisLine: baseAxisLine },
    yAxis: { type: 'value', minInterval: 1, axisLabel: baseAxisLabel, splitLine: baseSplitLine },
    series: [{
      type: 'line',
      data: a.byDay.map((d) => d.count),
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: chartColors.accent(), width: 3 },
      itemStyle: { color: chartColors.accent() },
      areaStyle: { color: gradientFill(chartColors.accent()) },
    }],
    animationDuration: 600,
  }

  const severityOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: chartColors.muted(), fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['48%', '72%'],
      center: ['50%', '44%'],
      avoidLabelOverlap: true,
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: (['high', 'medium', 'low'] as const).map((s) => ({ name: s, value: a.bySeverity[s], itemStyle: { color: severityColor[s] } })),
    }],
    animationDuration: 600,
  }

  // Cyclical data (24-hour clock) reads naturally as a polar bar — the "shape" of the day is visible at a
  // glance in a way a straight bar chart can't show.
  const hourOption: EChartsOption = {
    polar: { radius: [30, '85%'] },
    angleAxis: { type: 'category', data: hourData.map((h) => h.label), axisLabel: { ...baseAxisLabel, fontSize: 10, interval: 1 }, axisLine: baseAxisLine, splitLine: { show: false } },
    radiusAxis: { axisLabel: baseAxisLabel, splitLine: baseSplitLine },
    tooltip: { ...baseTooltip, trigger: 'item' },
    series: [{ type: 'bar', coordinateSystem: 'polar', data: hourData.map((h) => h.count), itemStyle: { color: gradientFill(chartColors.accent()) } }],
    animationDuration: 500,
  }

  // A radar shows the week's whole "shape" in one glance (e.g. weekend-heavy vs. weekday-heavy) — a pattern a
  // row of 7 bars makes the reader compute mentally instead of see directly.
  const weekdayOption: EChartsOption = {
    tooltip: { ...baseTooltip, trigger: 'item' },
    radar: {
      radius: '70%',
      indicator: a.byWeekday.map((d) => ({ name: d.day, max: Math.max(...a.byWeekday.map((x) => x.count), 1) })),
      axisName: { color: chartColors.muted(), fontSize: 12 },
      splitLine: { lineStyle: { color: chartColors.border() } },
      axisLine: { lineStyle: { color: chartColors.border() } },
      splitArea: { show: false },
    },
    series: [{
      type: 'radar',
      data: [{ value: a.byWeekday.map((d) => d.count), name: 'Incidents', areaStyle: { color: `${chartColors.accent()}33` }, lineStyle: { color: chartColors.accent(), width: 2 }, itemStyle: { color: chartColors.accent() } }],
    }],
    animationDuration: 500,
  }

  // Composition across all four reporting channels ("what share is each"), which a donut communicates directly.
  // Empty channels are dropped so the legend stays clean when only some are in use.
  const channelOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: chartColors.muted(), fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['46%', '72%'],
      center: ['50%', '42%'],
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: [
        { name: 'Voice call', value: a.byChannel.liveCall, itemStyle: { color: chartColors.accent() } },
        { name: 'Silent tap', value: a.byChannel.silentTap, itemStyle: { color: chartColors.low() } },
        { name: 'Coded order', value: a.byChannel.clickOrder, itemStyle: { color: chartColors.medium() } },
        { name: 'Silent SOS', value: a.byChannel.silentSos, itemStyle: { color: chartColors.high() } },
      ].filter((d) => d.value > 0),
    }],
    animationDuration: 500,
  }

  const peopleOption: EChartsOption = {
    grid: baseGrid,
    tooltip: { ...baseTooltip, trigger: 'axis' },
    xAxis: { type: 'category', data: a.byPeopleCount.map((p) => p.people), axisLabel: baseAxisLabel, axisLine: baseAxisLine },
    yAxis: { type: 'value', minInterval: 1, axisLabel: baseAxisLabel, splitLine: baseSplitLine },
    series: [{ type: 'bar', data: a.byPeopleCount.map((p) => p.count), itemStyle: { color: gradientFill(chartColors.accent()), borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32 }],
    animationDuration: 500,
  }

  // Each severity's average stress is a single 0-100 value — the same shape of question as the resolution-rate
  // gauges on the responder-performance page, so a gauge trio stays visually consistent with that pattern.
  const stressGaugeWidth = 100 / Math.max(stressRows.length, 1)
  const stressOption: EChartsOption = {
    series: stressRows.map((s, idx) => ({
      type: 'gauge',
      center: [`${stressGaugeWidth * idx + stressGaugeWidth / 2}%`, '58%'],
      radius: '75%',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      progress: { show: true, width: 10, itemStyle: { color: severityColor[s.severity] } },
      axisLine: { lineStyle: { width: 10, color: [[1, chartColors.border()]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      title: { show: true, offsetCenter: [0, '85%'], fontSize: 12, color: chartColors.muted() },
      detail: { valueAnimation: true, formatter: '{value}', fontSize: 18, color: chartColors.text(), offsetCenter: [0, '10%'] },
      data: [{ value: Math.round(s.avgStress ?? 0), name: s.severity }],
    })),
    animationDuration: 500,
  }

  const indicatorOption: EChartsOption = {
    grid: { ...baseGrid, left: 8 },
    tooltip: { ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value', minInterval: 1, axisLabel: baseAxisLabel, splitLine: baseSplitLine },
    yAxis: { type: 'category', data: a.byIndicator.map((i) => i.indicator), axisLabel: { ...baseAxisLabel, fontSize: 11 }, axisLine: baseAxisLine, inverse: true },
    series: [{ type: 'bar', data: a.byIndicator.map((i) => i.count), itemStyle: { color: chartColors.high(), borderRadius: [0, 4, 4, 0] }, barMaxWidth: 16 }],
    animationDuration: 500,
  }

  return (
    <section className="analytics-page">
      <div className="page-head">
        <h1>Analytics</h1>
        <p className="muted">
          Incident patterns across the whole team — when, where, and how incidents happen, for spotting hotspots
          and recurring risk, not just reviewing individual cases. Visible to every responder.
        </p>
      </div>

      {/* Row 1 — KPI strip: the glanceable numbers, read first, left to right. */}
      <div className="stats">
        <div className="stat"><span className="stat-value">{a.total}</span><span className="stat-label">Total incidents</span></div>
        <div className="stat stat-high"><span className="stat-value">{a.open}</span><span className="stat-label">Open</span></div>
        <div className="stat stat-live"><span className="stat-value">{a.resolved}</span><span className="stat-label">Resolved</span></div>
        <div className="stat"><span className="stat-value">{formatMinutes(a.avgTimeToAcknowledgeMin)}</span><span className="stat-label">Avg time to acknowledge</span></div>
        <div className="stat"><span className="stat-value">{formatMinutes(a.avgTimeToResolveMin)}</span><span className="stat-label">Avg time to resolve</span></div>
        <div className="stat"><span className="stat-value">{a.avgVoiceStress !== null ? Math.round(a.avgVoiceStress) : '—'}</span><span className="stat-label">Avg voice stress</span></div>
      </div>

      <div className="subtabs">
        <button type="button" className={tab === 'charts' ? 'active' : ''} onClick={() => setTab('charts')}>Charts</button>
        <button type="button" className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>AI Insights</button>
      </div>

      {tab === 'ai' ? (
        <AiInsightsPanel analytics={a} cached={insights.cached} onUpdate={insights.setCached} autoRefreshing={insights.autoRefreshing} />
      ) : (
      <>
      {/* Row 2 — hero: the "where" story gets the most space, since location is the primary prevention signal. */}
      <div className="analytics-grid">
        <div className="card chart-card az-map">
          <h2>Incident locations</h2>
          <p className="muted chart-hint">Colour = severity. Zoom fits every located incident automatically.</p>
          <Suspense fallback={<div className="map map-loading">Loading map…</div>}>
            <IncidentsOverviewMap points={a.points} />
          </Suspense>
        </div>

        <div className="card chart-card az-trend">
          <h2>Incidents over time</h2>
          {a.byDay.length === 0 ? <p className="muted">No incidents yet.</p> : <EChart option={trendOption} height={200} />}
        </div>

        <div className="card chart-card az-severity">
          <h2>Severity mix</h2>
          <EChart option={severityOption} height={220} />
        </div>
      </div>

      {/* Row 3 — "when": timing patterns, useful for staffing/patrol scheduling. Both charts are circular, so a
          two-column row uses the available width instead of stretching a small circle across a full-width card. */}
      <h3 className="section-label">When incidents happen</h3>
      <div className="chart-row">
        <div className="card chart-card">
          <h2>Time of day</h2>
          <p className="muted chart-hint">Local time incidents started.</p>
          <EChart option={hourOption} height={280} />
        </div>

        <div className="card chart-card">
          <h2>Day of week</h2>
          <p className="muted chart-hint">Shape of the week's load.</p>
          <EChart option={weekdayOption} height={280} />
        </div>
      </div>

      {/* Row 4 — "what": nature of the incidents (channel, people count, danger type, stress correlation). */}
      <h3 className="section-label">What's happening</h3>
      <div className="chart-row chart-row-4">
        <div className="card chart-card">
          <h2>Channel</h2>
          <EChart option={channelOption} height={170} />
        </div>

        <div className="card chart-card">
          <h2>People involved</h2>
          <EChart option={peopleOption} height={170} />
        </div>

        <div className="card chart-card">
          <h2>Voice stress by severity</h2>
          <p className="muted chart-hint">Validates whether higher severity tracks with vocal stress.</p>
          {stressRows.length === 0 ? <p className="muted">Not enough data yet.</p> : <EChart option={stressOption} height={170} />}
        </div>

        <div className="card chart-card">
          <h2>Danger indicators</h2>
          {a.byIndicator.length === 0 ? <p className="muted">None recorded yet.</p> : <EChart option={indicatorOption} height={170} />}
        </div>
      </div>

      {/* Row 5 — "where, precisely": drill-down tables, read last, after the visuals set context. */}
      <h3 className="section-label">Where it's concentrated</h3>
      <div className="analytics-tables">
        <div className="card">
          <h2>Top confirmed addresses</h2>
          <p className="muted chart-hint">Repeat confirmed locations — the clearest signal for targeted patrol or infrastructure action.</p>
          {a.topAddresses.length === 0 ? (
            <p className="muted">No confirmed addresses yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Address</th><th>Incidents</th><th>Avg severity</th><th>Most common indicator</th></tr>
              </thead>
              <tbody>
                {a.topAddresses.map((row) => (
                  <tr key={row.address}>
                    <td>{row.address}</td>
                    <td className="mono">{row.count}</td>
                    <td><Chip tone={severityFromScore(row.avgSeverity)} filled>{severityFromScore(row.avgSeverity)}</Chip></td>
                    <td>{row.topIndicator ?? <span className="muted-inline">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Hotspot areas</h2>
          <p className="muted chart-hint">Grouped by ~500m grid cell, using approximate or confirmed location — catches clusters even before an address is confirmed.</p>
          {a.hotspotCells.length === 0 ? (
            <p className="muted">No located incidents yet.</p>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Approx. location</th><th>Incidents</th><th>Avg severity</th><th>Most common indicator</th></tr>
              </thead>
              <tbody>
                {a.hotspotCells.map((row) => (
                  <tr key={`${row.lat},${row.lng}`}>
                    <td className="mono">{row.lat.toFixed(3)}, {row.lng.toFixed(3)}</td>
                    <td className="mono">{row.count}</td>
                    <td><Chip tone={severityFromScore(row.avgSeverity)} filled>{severityFromScore(row.avgSeverity)}</Chip></td>
                    <td>{row.topIndicator ?? <span className="muted-inline">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      </>
      )}
    </section>
  )
}
