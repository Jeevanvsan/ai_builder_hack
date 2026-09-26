import type { Incident } from '../../../shared/incidents/types'

// Epic 18.1: a simple schematic/iconographic scene diagram derived directly from known fields — deliberately
// NOT a generated image (no Gemini image call): a small, deterministic layout keeps this reliable and instantly
// reactive to live field updates, and avoids ever implying the system knows anyone's real appearance. Icons are
// generic glyphs (a person shape, a weapon glyph, a car), never an attempt at a likeness — see the extended
// feature brainstorm's explicit safety framing for this feature.
function hasAny(indicators: string[], pattern: RegExp): boolean {
  return indicators.some((d) => pattern.test(d))
}

export default function SceneSketch({ incident }: { incident: Incident }) {
  const f = incident.extractedFieldsLive
  const indicators = f.dangerIndicators
  const peopleCount = Math.min(f.peopleCount ?? 0, 6)
  const hasWeapon = hasAny(indicators, /weapon|gun|firearm|knife/i)
  const hasVehicle = hasAny(indicators, /vehicle|car|scooter|bike|motorbike/i)
  const hasInjury = hasAny(indicators, /injur|blood|hurt|bleeding/i)
  const isMoving = hasAny(indicators, /moving|abduction|taken/i)

  const hasAnything = peopleCount > 0 || hasWeapon || hasVehicle || hasInjury || indicators.length > 0

  return (
    <div className="card sketch-card">
      <h2>Scene sketch</h2>
      <p className="sub">A simple schematic view built from what's been reported — icons only, never a likeness.</p>
      {!hasAnything ? (
        <p className="muted">Nothing to sketch yet.</p>
      ) : (
        <svg viewBox="0 0 320 140" className="scene-svg" role="img" aria-label="Schematic scene diagram">
          {isMoving && (
            <g className="sketch-motion">
              <line x1="10" y1="70" x2="60" y2="70" strokeDasharray="4 4" />
              <polygon points="60,64 72,70 60,76" />
            </g>
          )}
          {Array.from({ length: Math.max(peopleCount, indicators.length ? 1 : 0) }).map((_, i) => {
            const x = 80 + i * 36
            return (
              <g key={i} className={hasWeapon && i === 0 ? 'sketch-person sketch-danger' : 'sketch-person'}>
                <circle cx={x} cy="45" r="10" />
                <line x1={x} y1="55" x2={x} y2="90" />
                <line x1={x - 12} y1="65" x2={x + 12} y2="65" />
                <line x1={x} y1="90" x2={x - 10} y2="115" />
                <line x1={x} y1="90" x2={x + 10} y2="115" />
              </g>
            )
          })}
          {hasWeapon && (
            <g className="sketch-weapon" transform="translate(76, 60)">
              <line x1="0" y1="0" x2="14" y2="-6" strokeWidth="3" />
            </g>
          )}
          {hasInjury && (
            <text x="80" y="130" className="sketch-label sketch-danger-text">injury reported</text>
          )}
          {hasVehicle && (
            <g className="sketch-vehicle" transform="translate(230, 90)">
              <rect x="0" y="0" width="60" height="24" rx="6" />
              <circle cx="14" cy="26" r="6" />
              <circle cx="46" cy="26" r="6" />
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
