import type { Incident } from '../../../../shared/incidents/types'

// Situation diagram built only from reported facts: who is where, how they move, and where the caller is heading.
// Left → right: subject (on foot, or inside their vehicle when reported so), pursuit, caller, route to safety.
const COLORS: [RegExp, string, string][] = [
  [/white|silver/i, '#ffffff', 'white/silver'],
  [/black|dark/i, '#2b2f36', 'dark'],
  [/red/i, '#c92a2a', 'red'],
  [/blue/i, '#2b6cb0', 'blue'],
  [/grey|gray/i, '#8a919c', 'grey'],
  [/green/i, '#2f9e44', 'green'],
  [/yellow/i, '#f2c94c', 'yellow'],
]
const PERSON = 'M0 -9a4 4 0 1 1 0.01 0Zm-6.5 16c0-5 2.9-8 6.5-8s6.5 3 6.5 8Z'
const KIND_COLOR = { police: '#2c4a9e', fire: '#b8391f', hospital: '#1f7a45' } as const

export default function SceneSketch({ incident }: { incident: Incident }) {
  const f = incident.extractedFieldsLive
  const text = f.dangerIndicators.join(' | ')
  const has = (re: RegExp) => re.test(text)
  const vehicleText = f.dangerIndicators.filter((d) => /car|vehicle|bike|scooter|van|truck|auto/i.test(d)).join(' ')
  const vehicle = Boolean(vehicleText)
  const color = COLORS.find(([re]) => re.test(vehicleText))
  const twoWheeler = /bike|scooter|motorbike/i.test(vehicleText)
  const inVehicle = vehicle && /attacker|subject|suspect|in a|driving|on a/i.test(vehicleText)
  const chasing = has(/follow|chas|pursu/i)
  const weapon = has(/weapon|knife|gun|firearm/i)
  const injured = has(/injur|blood|bleed|hurt/i)
  const present = has(/still present/i)
  const clothing = f.dangerIndicators.find((d) => /wearing|cloth/i.test(d))
  const darkClothes = clothing && /dark|black/i.test(clothing)
  const count = f.peopleCount ?? Number(text.match(/(\d+) (people|person)/i)?.[1] ?? 1)
  const route = incident.safeRoute

  if (!f.dangerIndicators.length && f.peopleCount == null) {
    return <p className="panel-empty">The diagram builds itself as facts are reported.</p>
  }

  const subjectLabel = [
    `${count > 1 ? `${count} subjects` : 'Subject'}`,
    darkClothes ? 'dark clothes' : null,
    inVehicle ? `in ${color ? `${color[2]} ` : ''}${twoWheeler ? 'two-wheeler' : 'car'}` : null,
    weapon ? 'armed' : null,
  ].filter(Boolean).join(' · ')
  const km = route ? (route.distanceM >= 1000 ? `${(route.distanceM / 1000).toFixed(1)} km` : `${route.distanceM} m`) : ''

  const subjectX = 60
  const callerX = route ? 185 : 250
  return (
    <div className="scene-diagram">
      <svg viewBox="0 0 320 180" className="scene-svg2" role="img" aria-label={`Situation: ${subjectLabel}${chasing ? ', following the caller' : ''}${route ? `, caller heading to ${route.destination.name}` : ''}`}>
        <defs>
          <pattern id="sd-grid" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#eef1f5" /></pattern>
          <marker id="sd-red" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#d92a3f" /></marker>
          <marker id="sd-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#1a73e8" /></marker>
        </defs>
        <rect width="320" height="180" rx="10" fill="url(#sd-grid)" />
        <rect x="0" y="72" width="320" height="40" fill="#f1f4f8" />
        <line x1="0" y1="92" x2="320" y2="92" stroke="#cfd7e3" strokeWidth="2" strokeDasharray="10 8" />

        {/* Subject: inside their vehicle when reported that way, otherwise on foot */}
        <g transform={`translate(${subjectX}, 92)`}>
          {inVehicle ? (
            twoWheeler ? (
              <rect x="-18" y="-6" width="36" height="12" rx="6" fill={color?.[1] ?? '#9aa3af'} stroke="#3b4250" strokeWidth="1.5" />
            ) : (
              <g>
                <rect x="-26" y="-13" width="52" height="26" rx="7" fill={color?.[1] ?? '#9aa3af'} stroke="#3b4250" strokeWidth="1.5" />
                <rect x="6" y="-10" width="11" height="20" rx="2.5" fill="#3b4250" opacity="0.5" />
                <rect x="-19" y="-10" width="8" height="20" rx="2" fill="#3b4250" opacity="0.3" />
              </g>
            )
          ) : null}
          <g transform={inVehicle ? 'translate(-2,0)' : undefined}>
            <circle r="11" fill={darkClothes ? '#2b2f36' : '#d92a3f'} stroke="#fff" strokeWidth="2.5" />
            <path d={PERSON} fill="#fff" transform="translate(0,1) scale(0.62)" />
            {weapon && <g transform="translate(9,-9)"><circle r="5.5" fill="#d92a3f" stroke="#fff" strokeWidth="1.5" /><path d="M-2 2L2 -2" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></g>}
          </g>
        </g>
        <text x={subjectX} y="56" className="sd-label sd-danger">{subjectLabel}</text>
        {present && <text x={subjectX} y="132" className="sd-note">still present</text>}

        {/* Pursuit */}
        {chasing && (
          <>
            <path d={`M${subjectX + 34} 92 L${callerX - 20} 92`} stroke="#d92a3f" strokeWidth="2.5" strokeDasharray="6 5" markerEnd="url(#sd-red)" />
            <text x={(subjectX + callerX) / 2 + 7} y="86" className="sd-note sd-danger-note">following</text>
          </>
        )}

        {/* Caller */}
        <g transform={`translate(${callerX}, 92)`}>
          <circle r="19" fill="#2b6cb0" opacity="0.14" />
          <circle r="11" fill="#2b6cb0" stroke="#fff" strokeWidth="2.5" />
          <path d={PERSON} fill="#fff" transform="translate(0,1) scale(0.62)" />
          {injured && <g transform="translate(9,-9)"><circle r="5.5" fill="#fff" stroke="#d92a3f" strokeWidth="1.5" /><path d="M-2.5 0H2.5M0 -2.5V2.5" stroke="#d92a3f" strokeWidth="1.6" /></g>}
        </g>
        <text x={callerX} y="132" className="sd-label sd-caller">Caller{injured ? ' · injured' : ''}</text>

        {/* Route to safety */}
        {route && (
          <>
            <path d={`M${callerX + 22} 92 L278 92`} stroke="#1a73e8" strokeWidth="3.5" strokeLinecap="round" markerEnd="url(#sd-blue)" />
            <g transform="translate(296, 92)">
              <rect x="-13" y="-13" width="26" height="26" rx="7" fill={KIND_COLOR[route.destination.kind]} />
              <path d="M0 -7 6 -4v4c0 4-3 6.5-6 7.5-3-1-6-3.5-6-7.5v-4l6-3Z" fill="#fff" />
            </g>
            <text x="274" y="56" className="sd-label sd-route">{route.destination.kind} · {km}</text>
            <text x="274" y="132" className="sd-note">{Math.max(1, Math.round(route.durationS / 60))} min drive</text>
          </>
        )}
      </svg>
      <ul className="sd-callouts">
        {chasing && <li>Caller is being followed{inVehicle ? ' by a vehicle' : ''}</li>}
        {clothing && <li>{clothing.charAt(0).toUpperCase() + clothing.slice(1)}</li>}
        {vehicle && <li>Vehicle: {vehicleText.replace(/\s+/g, ' ')}</li>}
        {route && <li className="sd-route-li">Heading to {route.destination.name} — {km}, ~{Math.max(1, Math.round(route.durationS / 60))} min</li>}
      </ul>
    </div>
  )
}
