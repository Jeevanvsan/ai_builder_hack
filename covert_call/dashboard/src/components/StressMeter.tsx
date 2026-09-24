export default function StressMeter({ score }: { score: number | null }) {
  if (score === null) return <span className="muted-inline">No audio</span>
  const tone = score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low'
  return (
    <span className="stress" aria-label={`Voice stress ${score} of 100`}>
      <span className="stress-track">
        <span className={`stress-fill stress-${tone}`} style={{ width: `${score}%` }} />
      </span>
      <span className="stress-value">{score}</span>
    </span>
  )
}
