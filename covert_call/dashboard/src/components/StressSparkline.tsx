const W = 320
const H = 72

export default function StressSparkline({ trend, live }: { trend: { timestamp: string; score: number }[]; live: boolean }) {
  if (trend.length < 2) return <p className="sub">{live ? 'Trend appears as the call continues.' : 'No stress trend recorded for this call.'}</p>

  const t0 = Date.parse(trend[0].timestamp)
  const span = Math.max(1, Date.parse(trend[trend.length - 1].timestamp) - t0)
  const points = trend.map((p) => {
    const x = ((Date.parse(p.timestamp) - t0) / span) * W
    const y = H - (p.score / 100) * H
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const last = points[points.length - 1].split(',')

  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Voice stress over the call">
      <line x1="0" x2={W} y1={H * 0.3} y2={H * 0.3} className="spark-threshold" />
      <polyline points={points.join(' ')} className="spark-line" />
      <circle cx={last[0]} cy={last[1]} r="3.5" className="spark-dot" />
    </svg>
  )
}
