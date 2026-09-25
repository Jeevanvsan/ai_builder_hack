import type { EChartsOption } from 'echarts'
import DataState from '../../components/DataState'
import EChart from '../../components/EChart'
import { baseAxisLabel, baseAxisLine, baseGrid, baseSplitLine, baseTooltip, chartColors, severityColor } from '../../lib/chartTheme'
import { computeResponderStats } from '../../lib/analytics'
import { useIncidents } from '../../lib/incidentsStore'

function formatMinutes(min: number | null): string {
  if (min === null) return '—'
  if (min < 1) return '<1 min'
  if (min < 60) return `${Math.round(min)} min`
  return `${(min / 60).toFixed(1)} hr`
}

function formatPct(rate: number | null): string {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`
}

// Response-time bars can be dwarfed by one slow outlier incident, which is exactly the kind of thing worth
// seeing rather than hiding — but it also breaks a shared linear axis for everyone else. Capping the display
// value (not the underlying data) keeps the chart legible while the exact minutes are still in the tooltip/table.
const DISPLAY_CAP_MIN = 240

export default function ResponderPerformancePage() {
  const { data: incidents, loading, error } = useIncidents('all')

  if (loading || error) return <DataState loading={loading} error={error} />

  const stats = computeResponderStats(incidents)
  const names = stats.map((s) => s.name)

  const totalAck = stats.reduce((sum, s) => sum + s.acknowledged, 0)
  const totalResolved = stats.reduce((sum, s) => sum + s.resolved, 0)
  const teamAvgAck = (() => {
    const vals = stats.map((s) => s.avgTimeToAcknowledgeMin).filter((v): v is number => v !== null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()
  const teamAvgResolve = (() => {
    const vals = stats.map((s) => s.avgTimeToResolveMin).filter((v): v is number => v !== null)
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  })()

  const leaderboardOption: EChartsOption = {
    grid: baseGrid,
    tooltip: { ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, right: 0, textStyle: { color: chartColors.muted(), fontSize: 12 } },
    xAxis: { type: 'category', data: names, axisLabel: baseAxisLabel, axisLine: baseAxisLine },
    yAxis: { type: 'value', minInterval: 1, axisLabel: baseAxisLabel, splitLine: baseSplitLine },
    series: [
      { type: 'bar', name: 'Acknowledged', data: stats.map((s) => s.acknowledged), itemStyle: { color: chartColors.accent(), borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 },
      { type: 'bar', name: 'Resolved', data: stats.map((s) => s.resolved), itemStyle: { color: chartColors.live(), borderRadius: [4, 4, 0, 0] }, barMaxWidth: 30 },
    ],
    animationDuration: 500,
  }

  // Donut per top responder's share of team workload — a proportion, so a pie family fits better than another bar.
  // Labels stay off (the legend already names each slice); an outer label ring plus a legend duplicated the same
  // names and overlapped each other in a card this size.
  const workloadShareOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: chartColors.muted(), fontSize: 12 } },
    series: [{
      type: 'pie',
      radius: ['46%', '72%'],
      center: ['50%', '42%'],
      itemStyle: { borderColor: '#fff', borderWidth: 2 },
      label: { show: false },
      data: stats.map((s, idx) => ({
        name: s.name,
        value: s.acknowledged,
        itemStyle: { color: [chartColors.accent(), chartColors.live(), chartColors.medium(), chartColors.low(), chartColors.high()][idx % 5] },
      })),
    }],
    animationDuration: 500,
  }

  const severityOption: EChartsOption = {
    grid: baseGrid,
    tooltip: { ...baseTooltip, trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { top: 0, right: 0, textStyle: { color: chartColors.muted(), fontSize: 12 } },
    xAxis: { type: 'category', data: names, axisLabel: baseAxisLabel, axisLine: baseAxisLine },
    yAxis: { type: 'value', minInterval: 1, axisLabel: baseAxisLabel, splitLine: baseSplitLine },
    series: (['high', 'medium', 'low'] as const).map((severity) => ({
      type: 'bar',
      name: severity,
      stack: 'severity',
      data: stats.map((s) => s.bySeverity[severity]),
      itemStyle: { color: severityColor[severity] },
      barMaxWidth: 30,
    })),
    animationDuration: 500,
  }

  // Horizontal bars read better than vertical ones once a value can be an outlier (a very slow ack time) —
  // the label sits right next to its bar instead of forcing a shared tall vertical scale on everyone.
  const responseTimeOption: EChartsOption = {
    grid: { ...baseGrid, left: 8 },
    tooltip: {
      ...baseTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params]
        const idx = list[0]?.dataIndex ?? 0
        const s = stats[idx]
        return `<strong>${s.name}</strong><br/>Avg to acknowledge: ${formatMinutes(s.avgTimeToAcknowledgeMin)}<br/>Avg to resolve: ${formatMinutes(s.avgTimeToResolveMin)}`
      },
    },
    legend: { top: 0, right: 0, textStyle: { color: chartColors.muted(), fontSize: 12 } },
    yAxis: { type: 'category', data: names, axisLabel: baseAxisLabel, axisLine: baseAxisLine },
    xAxis: { type: 'value', axisLabel: { ...baseAxisLabel, formatter: '{value} min' }, splitLine: baseSplitLine },
    series: [
      {
        type: 'bar',
        name: 'Avg to acknowledge',
        data: stats.map((s) => s.avgTimeToAcknowledgeMin !== null ? Math.min(Math.round(s.avgTimeToAcknowledgeMin), DISPLAY_CAP_MIN) : 0),
        itemStyle: { color: chartColors.medium(), borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 16,
      },
      {
        type: 'bar',
        name: 'Avg to resolve',
        data: stats.map((s) => s.avgTimeToResolveMin !== null ? Math.min(Math.round(s.avgTimeToResolveMin), DISPLAY_CAP_MIN) : 0),
        itemStyle: { color: chartColors.low(), borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 16,
      },
    ],
    animationDuration: 500,
  }

  // One gauge per responder — a resolution rate is a single 0-100% value per person, exactly what a gauge
  // communicates at a glance, and visually distinct from every bar chart already on the page.
  const gaugeCount = Math.max(stats.length, 1)
  const gaugeWidth = 100 / gaugeCount
  const resolutionGaugeOption: EChartsOption = {
    series: stats.map((s, idx) => ({
      type: 'gauge',
      center: [`${gaugeWidth * idx + gaugeWidth / 2}%`, '58%'],
      radius: '75%',
      startAngle: 210,
      endAngle: -30,
      min: 0,
      max: 100,
      progress: { show: true, width: 10, itemStyle: { color: chartColors.live() } },
      axisLine: { lineStyle: { width: 10, color: [[1, chartColors.border()]] } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      pointer: { show: false },
      anchor: { show: false },
      title: { show: true, offsetCenter: [0, '85%'], fontSize: 12, color: chartColors.muted() },
      detail: { valueAnimation: true, formatter: '{value}%', fontSize: 18, color: chartColors.text(), offsetCenter: [0, '10%'] },
      data: [{ value: s.resolutionRate !== null ? Math.round(s.resolutionRate * 100) : 0, name: s.name }],
    })),
    animationDuration: 500,
  }

  // Speed vs. volume tradeoff: is a responder fast because they take fewer/easier cases, or fast despite
  // heavy volume? A scatter is the only chart type that actually shows this relationship.
  const scatterOption: EChartsOption = {
    grid: baseGrid,
    tooltip: {
      ...baseTooltip,
      trigger: 'item',
      formatter: (p) => {
        const d = Array.isArray(p) ? p[0] : p
        const s = stats[d.dataIndex as number]
        return `<strong>${s.name}</strong><br/>Acknowledged: ${s.acknowledged}<br/>Avg to resolve: ${formatMinutes(s.avgTimeToResolveMin)}<br/>Resolved: ${s.resolved}`
      },
    },
    xAxis: { type: 'value', name: 'Acknowledged', nameLocation: 'middle', nameGap: 28, axisLabel: baseAxisLabel, splitLine: baseSplitLine, nameTextStyle: { color: chartColors.muted() } },
    yAxis: { type: 'value', name: 'Avg min to resolve', nameLocation: 'middle', nameGap: 40, axisLabel: baseAxisLabel, splitLine: baseSplitLine, nameTextStyle: { color: chartColors.muted() } },
    series: [{
      type: 'scatter',
      symbolSize: (_val, params) => {
        const idx = params.dataIndex
        return 16 + stats[idx].resolved * 6
      },
      data: stats.map((s) => [s.acknowledged, s.avgTimeToResolveMin !== null ? Math.round(s.avgTimeToResolveMin) : 0]),
      itemStyle: { color: `${chartColors.accent()}aa` },
      label: { show: true, formatter: (p) => stats[p.dataIndex as number].name, position: 'top', color: chartColors.muted(), fontSize: 11 },
    }],
    animationDuration: 500,
  }

  return (
    <section className="analytics-page">
      <div className="page-head">
        <h1>Responder performance</h1>
        <p className="muted">Individual response counts, workload mix and speed, compared across the team. Admins-only.</p>
      </div>

      {stats.length === 0 ? (
        <div className="card empty">No acknowledged incidents yet.</div>
      ) : (
        <>
          <div className="stats">
            <div className="stat"><span className="stat-value">{stats.length}</span><span className="stat-label">Active responders</span></div>
            <div className="stat"><span className="stat-value">{totalAck}</span><span className="stat-label">Total acknowledged</span></div>
            <div className="stat stat-live"><span className="stat-value">{totalResolved}</span><span className="stat-label">Total resolved</span></div>
            <div className="stat"><span className="stat-value">{formatMinutes(teamAvgAck)}</span><span className="stat-label">Team avg time to acknowledge</span></div>
            <div className="stat"><span className="stat-value">{formatMinutes(teamAvgResolve)}</span><span className="stat-label">Team avg time to resolve</span></div>
          </div>

          <div className="card chart-card" style={{ marginBottom: '1rem' }}>
            <h2>Incidents per responder</h2>
            <p className="muted chart-hint">Acknowledged vs. resolved, side by side.</p>
            <EChart option={leaderboardOption} height={260} />
          </div>

          <div className="chart-row">
            <div className="card chart-card">
              <h2>Share of team workload</h2>
              <p className="muted chart-hint">By acknowledged count.</p>
              <EChart option={workloadShareOption} height={260} />
            </div>

            <div className="card chart-card">
              <h2>Speed vs. volume</h2>
              <p className="muted chart-hint">Bubble size = incidents resolved. Bottom-right = fast and busy.</p>
              <EChart option={scatterOption} height={260} />
            </div>
          </div>

          <div className="chart-row">
            <div className="card chart-card">
              <h2>Workload by severity</h2>
              <p className="muted chart-hint">Who's carrying the higher-severity load.</p>
              <EChart option={severityOption} height={220} />
            </div>

            <div className="card chart-card">
              <h2>Response speed</h2>
              <p className="muted chart-hint">Lower is faster. Very long outliers are capped on the chart — exact minutes are in the table below.</p>
              <EChart option={responseTimeOption} height={220} />
            </div>
          </div>

          <div className="card chart-card" style={{ marginBottom: '1rem' }}>
            <h2>Resolution rate</h2>
            <p className="muted chart-hint">Share of acknowledged incidents each responder saw through to resolved.</p>
            <EChart option={resolutionGaugeOption} height={200} />
          </div>

          <h3 className="section-label">Detail</h3>
          <table className="table queue">
            <thead>
              <tr>
                <th>Responder</th>
                <th>Acknowledged</th>
                <th>Resolved</th>
                <th>Resolution rate</th>
                <th>Avg time to acknowledge</th>
                <th>Avg time to resolve</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td className="mono">{s.acknowledged}</td>
                  <td className="mono">{s.resolved}</td>
                  <td className="mono">{formatPct(s.resolutionRate)}</td>
                  <td className="mono">{formatMinutes(s.avgTimeToAcknowledgeMin)}</td>
                  <td className="mono">{formatMinutes(s.avgTimeToResolveMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
